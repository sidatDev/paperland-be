import axios from 'axios';
import { trackProviderCredits } from './analyzer-quota.service';

export type WebSearchProvider = 'SERPAPI' | 'TAVILY' | 'SERPER' | null;

export interface WebSearchSnippet {
  title: string;
  snippet: string;
  url: string;
}

export interface WebSearchResult {
  provider: WebSearchProvider;
  answer: string | null;
  snippets: WebSearchSnippet[];
  images: string[];
}

export interface ProductImageSearchResult {
  provider: WebSearchProvider;
  images: string[];
}

const IGNORED_IMAGE_URL_PATTERNS = [
  'favicon',
  'sprite',
  '1x1',
  'pixel',
  'avatar',
  'placeholder',
  '/logo',
  'logo.',
  'badge',
  'icon-',
  '/icons/',
  'gstatic.com/images/branding',
  'limited-time-deal',
  '_sr1910,1000',
  '_bo30,255,255,255_uf',
  'enc_avif',
];

const LOW_RES_THUMB_PATTERNS = [
  'image_256',
  'image_128',
  'width=265',
  'height=265',
  'width=200',
  'height=200',
  '_150x150',
  '_200x200',
  '_sx200',
  '_sy200',
  'w_200',
];

/**
 * Filters, cleans, deduplicates, and sorts candidate product image URLs
 * so high-resolution studio photos always appear before small thumbnails.
 */
export function filterProductImageUrls(rawUrls: any[], limit = 6): string[] {
  const seen = new Set<string>();
  const highRes: string[] = [];
  const lowRes: string[] = [];

  for (const candidate of rawUrls || []) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) continue;

    const lower = trimmed.toLowerCase();
    if (lower.endsWith('.svg') || lower.includes('.svg?')) continue;
    if (IGNORED_IMAGE_URL_PATTERNS.some((p) => lower.includes(p))) continue;

    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      if (LOW_RES_THUMB_PATTERNS.some((p) => lower.includes(p))) {
        lowRes.push(trimmed);
      } else {
        highRes.push(trimmed);
      }
    }
  }

  return [...highRes, ...lowRes].slice(0, limit);
}

/**
 * Ranks image candidates returned by Serper / SerpApi by ideal eCommerce clarity:
 * - Prefers crisp medium-to-high resolution photos (500px - 1600px) first
 * - Accepts larger sharp photos (> 1600px) next
 * - Drops blurry tiny thumbnails (< 400px) unless nothing else exists
 */
function pickClearResolutionUrls(
  items: { url?: string | null; width?: number | null; height?: number | null }[],
  limit: number
): string[] {
  const ideal: { url: string; score: number }[] = [];
  const large: { url: string; score: number }[] = [];
  const smallFallback: string[] = [];

  for (const item of items || []) {
    const url = typeof item?.url === 'string' ? item.url.trim() : '';
    if (!url || !url.startsWith('http')) continue;

    const w = Number(item.width || 0);
    const h = Number(item.height || 0);
    const maxDim = Math.max(w, h);
    const minDim = w > 0 && h > 0 ? Math.min(w, h) : maxDim;

    if (maxDim === 0) {
      // Unknown dimension: treat as medium candidate
      ideal.push({ url, score: 800 });
    } else if (minDim < 380 || maxDim < 420) {
      smallFallback.push(url);
    } else if (maxDim <= 1600) {
      // Closer to ~900px ideal medium-sharp eCommerce size gets highest priority
      ideal.push({ url, score: Math.abs(900 - maxDim) });
    } else {
      large.push({ url, score: maxDim });
    }
  }

  ideal.sort((a, b) => a.score - b.score);
  large.sort((a, b) => a.score - b.score);

  const ordered = [
    ...ideal.map((x) => x.url),
    ...large.map((x) => x.url),
    ...(ideal.length + large.length === 0 ? smallFallback : []),
  ];

  return filterProductImageUrls(ordered, limit);
}

export function getActiveLookupCapabilities() {
  const hasSerpApi = Boolean(process.env.SERPAPI_API_KEY?.trim());
  const hasTavily = Boolean(process.env.TAVILY_API_KEY?.trim());
  const hasSerper = Boolean(process.env.SERPER_API_KEY?.trim());
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY?.trim());

  const webSearchProvider = hasSerpApi
    ? 'SerpApi (Google)'
    : hasTavily
      ? 'Tavily'
      : hasSerper
        ? 'Serper (Google)'
        : null;

  return {
    webSearchEnabled: hasSerpApi || hasTavily || hasSerper,
    webSearchProvider,
    aiEnabled: hasOpenRouter,
    aiModel: hasOpenRouter ? process.env.OPENROUTER_MODEL || 'openrouter/free' : null,
  };
}

/**
 * SerpApi Google Web Search (1 credit per query; 250 free/month, resets monthly).
 * Extracts organic product links, knowledge graph/answer snippets, and inline/shopping images.
 */
async function searchWithSerpApi(query: string): Promise<WebSearchResult | null> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const res = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google',
        q: query,
        hl: 'en',
        num: 5,
        api_key: apiKey,
      },
      timeout: 10000,
    });

    const data = res.data || {};
    if (data.error) return null;

    const snippets: WebSearchSnippet[] = (data.organic_results || [])
      .map((r: any) => ({
        title: String(r.title || '').trim(),
        snippet: String(r.snippet || '').trim(),
        url: String(r.link || '').trim(),
      }))
      .filter((r: WebSearchSnippet) => r.title || r.snippet);

    const answer =
      data.answer_box?.snippet ||
      data.answer_box?.answer ||
      data.answer_box?.result ||
      data.knowledge_graph?.description ||
      null;

    const candidateImages: any[] = [];
    for (const img of data.inline_images || []) {
      candidateImages.push(img?.original, img?.source_image, img?.thumbnail);
    }
    for (const shop of [...(data.shopping_results || []), ...(data.inline_shopping_results || [])]) {
      candidateImages.push(shop?.thumbnail);
    }
    for (const kgImg of data.knowledge_graph?.header_images || []) {
      candidateImages.push(kgImg?.image);
    }
    for (const org of data.organic_results || []) {
      candidateImages.push(org?.thumbnail);
    }

    const images = filterProductImageUrls(candidateImages, 6);

    if (snippets.length === 0 && !answer && images.length === 0) return null;

    return {
      provider: 'SERPAPI',
      answer: answer ? String(answer).trim() : null,
      snippets,
      images,
    };
  } catch {
    return null;
  }
}

/**
 * SerpApi dedicated Google Images lookup (1 credit) for crisp studio product photos.
 */
async function searchImagesWithSerpApi(query: string, limit = 6): Promise<string[]> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) return [];

  try {
    const res = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_images',
        q: query,
        hl: 'en',
        api_key: apiKey,
      },
      timeout: 10000,
    });

    const data = res.data || {};
    if (data.error) return [];

    const results = Array.isArray(data.images_results) ? data.images_results : [];
    return pickClearResolutionUrls(
      results.map((r: any) => ({
        url: r?.original,
        width: r?.original_width,
        height: r?.original_height,
      })),
      limit
    );
  } catch {
    return [];
  }
}

async function searchWithTavily(query: string): Promise<WebSearchResult | null> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const res = await axios.post(
      'https://api.tavily.com/search',
      {
        api_key: apiKey,
        query,
        search_depth: 'basic',
        include_answer: true,
        include_images: true,
        max_results: 5,
      },
      { timeout: 10000 }
    );

    const snippets: WebSearchSnippet[] = (res.data?.results || [])
      .map((r: any) => ({
        title: String(r.title || '').trim(),
        snippet: String(r.content || '').trim(),
        url: String(r.url || '').trim(),
      }))
      .filter((r: WebSearchSnippet) => r.title || r.snippet);

    const rawImages = (res.data?.images || []).map((img: any) =>
      typeof img === 'string' ? img : img?.url
    );
    const images = filterProductImageUrls(rawImages, 6);

    if (snippets.length === 0 && !res.data?.answer && images.length === 0) return null;

    return {
      provider: 'TAVILY',
      answer: res.data?.answer ? String(res.data.answer).trim() : null,
      snippets,
      images,
    };
  } catch {
    return null;
  }
}

async function searchWithSerper(query: string): Promise<WebSearchResult | null> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const headers = {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    };

    const [webRes, imgRes] = await Promise.allSettled([
      axios.post('https://google.serper.dev/search', { q: query, num: 5 }, { headers, timeout: 9000 }),
      axios.post('https://google.serper.dev/images', { q: query, num: 10 }, { headers, timeout: 9000 }),
    ]);

    const webData = webRes.status === 'fulfilled' ? webRes.value.data : null;
    const imgData = imgRes.status === 'fulfilled' ? imgRes.value.data : null;

    const spentCredits = (webData ? 1 : 0) + (imgData ? 1 : 0);
    if (spentCredits > 0) {
      void trackProviderCredits('SERPER', spentCredits, 'search+images', query);
    }

    const snippets: WebSearchSnippet[] = (webData?.organic || [])
      .map((r: any) => ({
        title: String(r.title || '').trim(),
        snippet: String(r.snippet || '').trim(),
        url: String(r.link || '').trim(),
      }))
      .filter((r: WebSearchSnippet) => r.title || r.snippet);

    const images = pickClearResolutionUrls(
      (imgData?.images || []).map((i: any) => ({
        url: i.imageUrl,
        width: i.imageWidth,
        height: i.imageHeight,
      })),
      6
    );

    const answer =
      webData?.answerBox?.snippet ||
      webData?.knowledgeGraph?.description ||
      null;

    if (snippets.length === 0 && !answer && images.length === 0) return null;

    return {
      provider: 'SERPER',
      answer: answer ? String(answer).trim() : null,
      snippets,
      images,
    };
  } catch {
    return null;
  }
}

async function searchImagesWithSerper(query: string, limit = 6): Promise<string[]> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) return [];

  try {
    const res = await axios.post(
      'https://google.serper.dev/images',
      { q: query, num: 10 },
      {
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        timeout: 9000,
      }
    );
    void trackProviderCredits('SERPER', 1, 'images', query);
    return pickClearResolutionUrls(
      (res.data?.images || []).map((i: any) => ({
        url: i.imageUrl,
        width: i.imageWidth,
        height: i.imageHeight,
      })),
      limit
    );
  } catch {
    return [];
  }
}

/**
 * Searches the live web using configured APIs (SerpApi -> Tavily -> Serper).
 * Uses exact quoted barcode first for high precision, then name/barcode fallback.
 */
export async function searchWebForProduct(
  barcode?: string | null,
  nameHint?: string | null
): Promise<WebSearchResult> {
  const empty: WebSearchResult = {
    provider: null,
    answer: null,
    snippets: [],
    images: [],
  };

  if (!barcode && !nameHint) return empty;
  if (
    !process.env.SERPAPI_API_KEY?.trim() &&
    !process.env.TAVILY_API_KEY?.trim() &&
    !process.env.SERPER_API_KEY?.trim()
  ) {
    return empty;
  }

  const queries: string[] = [];
  if (barcode) {
    queries.push(`"${barcode}"`);
    if (nameHint) queries.push(`${barcode} ${nameHint}`);
  } else if (nameHint) {
    queries.push(nameHint);
  }

  for (const q of queries) {
    const serpApi = await searchWithSerpApi(q);
    if (serpApi) return serpApi;

    const tavily = await searchWithTavily(q);
    if (tavily) return tavily;

    const serper = await searchWithSerper(q);
    if (serper) return serper;
  }

  return empty;
}

/**
 * Dedicated studio product image search (SerpApi Google Images -> Serper Images -> Tavily).
 * Used as a smart post-AI fallback when barcode-only lookup returned no product photos,
 * and for the on-demand "Find Photos Online" button in the Review Modal.
 */
export async function searchProductImages(
  query: string,
  limit = 6
): Promise<ProductImageSearchResult> {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) return { provider: null, images: [] };

  if (process.env.SERPAPI_API_KEY?.trim()) {
    const imgs = await searchImagesWithSerpApi(cleanQuery, limit);
    if (imgs.length > 0) return { provider: 'SERPAPI', images: imgs };
  }

  if (process.env.SERPER_API_KEY?.trim()) {
    const imgs = await searchImagesWithSerper(cleanQuery, limit);
    if (imgs.length > 0) return { provider: 'SERPER', images: imgs };
  }

  if (process.env.TAVILY_API_KEY?.trim()) {
    const res = await searchWithTavily(cleanQuery);
    if (res && res.images.length > 0) {
      return { provider: 'TAVILY', images: res.images.slice(0, limit) };
    }
  }

  return { provider: null, images: [] };
}
