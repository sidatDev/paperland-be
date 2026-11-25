import axios from 'axios';
import sharp from 'sharp';
import {
  searchProductImages,
  searchWebForProduct,
  WebSearchResult,
} from './web-search.service';
import { mergeStudioImagesFirst, validateImageUrls } from './image-mirror.service';
import { invalidateQuotaCache, setQuotaPrisma } from './analyzer-quota.service';
import {
  extractProductFromWebsites,
  MarketPriceHint,
  parseDimensionString,
  parseWeightToKg,
  WebsiteExtractedProduct,
} from './product-page-extractor.service';

export interface AnalyzedSpec {
  label: string;
  value: string;
  unit?: string;
}

export interface BarcodeLookupResult {
  barcode: string | null;
  lookupSource:
    | 'OPEN_PRODUCTS_FACTS'
    | 'UPCITEMDB'
    | 'OPENROUTER_AI'
    | 'WEB_SNIPPET'
    | 'EXCEL_ONLY'
    | 'NOT_FOUND';
  duplicateProductId: string | null;
  duplicateProductName: string | null;
  name: string | null;
  sku: string | null;
  brandId: string | null;
  brandName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  description: string | null;
  fullDescription: string | null;
  width: string | null;
  length: string | null;
  weight: string | null;
  volume: string | null;
  specs: AnalyzedSpec[];
  images: string[];
  seo: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  rawLookupData: Record<string, any>;
}

const REQUEST_TIMEOUT_MS = 6500;
const PAPERLAND_USER_AGENT = 'PaperlandAdminAnalyzer/1.0 (https://paperland.com.pk)';

const STATIONERY_CATEGORY_HINTS: { keywords: string[]; categoryHints: string[] }[] = [
  {
    keywords: ['pencil', 'pen', 'marker', 'highlighter', 'ballpoint', 'gel pen', 'fountain', 'sharpener', 'eraser', 'correction'],
    categoryHints: ['writing', 'pen', 'pencil', 'marker'],
  },
  {
    keywords: ['notebook', 'register', 'diary', 'a4 paper', 'ream', 'sticky note', 'copy paper', 'pad', 'ledger'],
    categoryHints: ['paper', 'notebook'],
  },
  {
    keywords: ['stapler', 'punch', 'calculator', 'laminator', 'shredder', 'binder', 'scissors', 'cutter', 'tape'],
    categoryHints: ['office', 'equipment', 'desk'],
  },
  {
    keywords: ['paint', 'crayon', 'acrylic', 'brush', 'canvas', 'sketch', 'pastel', 'watercolor', 'color pencil', 'craft'],
    categoryHints: ['art', 'craft'],
  },
  {
    keywords: ['geometry', 'ruler', 'compass', 'school bag', 'lunch box', 'pencil box', 'pouch', 'whiteboard'],
    categoryHints: ['school', 'student'],
  },
];

function extractNumericString(val?: string | number | null): string | null {
  if (val === undefined || val === null) return null;
  const match = String(val).match(/[\d]+(\.[\d]+)?/);
  return match ? match[0] : null;
}

function truncateText(text: string | null | undefined, maxLen: number): string | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return clean.length > maxLen ? `${clean.slice(0, maxLen - 3)}...` : clean;
}

function cleanWebProductTitle(rawTitle?: string | null): string | null {
  if (!rawTitle) return null;
  const cleaned = rawTitle
    .replace(/\s*[\|–—-]\s*(buy online|shop|store|pakistan|daraz|amazon|walmart|ferozsons|deli\s*europe|stationery.*|official.*)$/i, '')
    .replace(/\s*\|\s*[^|]{2,40}$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return truncateText(cleaned || rawTitle, 180);
}

function parseJsonFromAi(raw: string): any | null {
  if (!raw) return null;
  const stripped = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function lookupOpenFactsSingleHost(host: string, barcode: string): Promise<any | null> {
  try {
    const res = await axios.get(`${host}/api/v2/product/${encodeURIComponent(barcode)}.json`, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: { 'User-Agent': PAPERLAND_USER_AGENT },
    });

    if (res.data?.status === 1 && res.data?.product) {
      const p = res.data.product;
      const images: string[] = [];
      if (p.image_front_url) images.push(p.image_front_url);
      if (p.image_url && !images.includes(p.image_url)) images.push(p.image_url);

      const specs: AnalyzedSpec[] = [];
      if (p.quantity) specs.push({ label: 'Size / Dimensions', value: String(p.quantity) });
      if (p.packaging) specs.push({ label: 'Packaging Type', value: String(p.packaging) });

      return {
        provider: 'OPEN_PRODUCTS_FACTS',
        host,
        name: p.product_name || p.product_name_en || p.generic_name || null,
        brandName: p.brands ? String(p.brands).split(',')[0].trim() : null,
        categoryName: p.categories
          ? String(p.categories).split(',').pop()?.trim() || null
          : null,
        description: truncateText(p.generic_name || p.product_name, 240),
        fullDescription: p.ingredients_text || p.generic_name || null,
        weight: parseWeightToKg(p.quantity || p.product_quantity),
        specs,
        images,
        raw: {
          code: res.data.code,
          product_name: p.product_name,
          brands: p.brands,
          categories: p.categories,
          quantity: p.quantity,
          sourceHost: host,
        },
      };
    }
  } catch {
    // Non-fatal
  }
  return null;
}

async function lookupOpenFacts(barcode: string): Promise<any | null> {
  const [productsRes, foodRes] = await Promise.all([
    lookupOpenFactsSingleHost('https://world.openproductsfacts.org', barcode),
    lookupOpenFactsSingleHost('https://world.openfoodfacts.org', barcode),
  ]);
  return (productsRes?.name ? productsRes : null) || (foodRes?.name ? foodRes : null) || productsRes || foodRes;
}

async function lookupUpcItemDb(barcode: string): Promise<any | null> {
  try {
    const apiKey = process.env.UPCITEMDB_API_KEY?.trim();
    const url = apiKey
      ? `https://api.upcitemdb.com/prod/v1/lookup?upc=${encodeURIComponent(barcode)}`
      : `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`;

    const headers: Record<string, string> = {
      'User-Agent': PAPERLAND_USER_AGENT,
      Accept: 'application/json',
    };
    if (apiKey) {
      headers['user_key'] = apiKey;
      headers['key_type'] = '3scale';
    }

    const res = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS, headers });
    const item = res.data?.items?.[0];
    if (!item) return null;

    const specs: AnalyzedSpec[] = [];
    if (item.color) specs.push({ label: 'Color', value: String(item.color) });
    if (item.size) specs.push({ label: 'Size / Dimensions', value: String(item.size) });
    if (item.dimension) specs.push({ label: 'Size / Dimensions', value: String(item.dimension) });
    if (item.model) specs.push({ label: 'Special Features', value: `Model: ${item.model}` });

    const dims = parseDimensionString(item.dimension);
    const weightKg = parseWeightToKg(item.weight);

    const categoryParts = item.category ? String(item.category).split('>') : [];
    const leafCategory =
      categoryParts.length > 0 ? categoryParts[categoryParts.length - 1].trim() : null;

    let marketPriceHint: MarketPriceHint | null = null;
    const firstOffer = Array.isArray(item.offers)
      ? item.offers.find((o: any) => o?.price && Number(o.price) > 0)
      : null;
    if (firstOffer) {
      marketPriceHint = {
        price: Number(firstOffer.price),
        currency: String(firstOffer.currency || item.currency || 'USD').toUpperCase(),
        sourceDomain: String(firstOffer.domain || firstOffer.merchant || 'upcitemdb.com'),
        sourceUrl: String(firstOffer.link || `https://www.upcitemdb.com/upc/${barcode}`),
      };
    } else if (item.lowest_recorded_price && Number(item.lowest_recorded_price) > 0) {
      marketPriceHint = {
        price: Number(item.lowest_recorded_price),
        currency: String(item.currency || 'USD').toUpperCase(),
        sourceDomain: 'upcitemdb.com',
        sourceUrl: `https://www.upcitemdb.com/upc/${barcode}`,
      };
    }

    return {
      provider: 'UPCITEMDB',
      name: item.title || null,
      brandName: item.brand || null,
      model: item.model || null,
      categoryName: leafCategory,
      description: truncateText(item.description || item.title, 240),
      fullDescription: item.description || null,
      width: dims.width,
      length: dims.length,
      volume: dims.volume,
      weight: weightKg,
      specs,
      images: Array.isArray(item.images) ? item.images.filter(Boolean).slice(0, 6) : [],
      marketPriceHint,
      raw: {
        ean: item.ean,
        upc: item.upc,
        title: item.title,
        brand: item.brand,
        model: item.model,
        category: item.category,
        lowest_recorded_price: item.lowest_recorded_price,
        highest_recorded_price: item.highest_recorded_price,
        offersCount: Array.isArray(item.offers) ? item.offers.length : 0,
      },
    };
  } catch {
    return null;
  }
}

async function imageUrlToCompactDataUri(url: string): Promise<string | null> {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
    const resized = await sharp(Buffer.from(res.data))
      .rotate()
      .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${resized.toString('base64')}`;
  } catch {
    return null;
  }
}

async function structureWithOpenRouter(params: {
  barcode?: string | null;
  imageUrl?: string | null;
  imageBase64?: string | null;
  partialData: Record<string, any>;
  webSearch: WebSearchResult;
  websiteExtracted: WebsiteExtractedProduct;
  existingBrands: string[];
  existingCategories: string[];
}): Promise<any | null> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;

  const hasWebOrRegistry =
    Boolean(params.partialData.registry) ||
    params.webSearch.snippets.length > 0 ||
    params.websiteExtracted.extractedWebsites.length > 0;
  const hasImage = Boolean(params.imageBase64 || params.imageUrl);

  if (!hasWebOrRegistry && !hasImage) return null;

  const model = process.env.OPENROUTER_MODEL?.trim() || 'openrouter/free';

  const systemPrompt = [
    'You are a product cataloging engine for Paperland (stationery, paper, office & school supplies eCommerce store).',
    'Extract and normalize ALL product attributes from the provided barcode registry, product webpage data, and/or product image (note: photos may be rotated 90 degrees).',
    'Do NOT include price or stock quantity (admins enter those manually).',
    'Return ONLY a single valid JSON object (no markdown fences) with these exact keys:',
    '{',
    '  "name": string | null (full clean eCommerce product title including brand, model & pack count),',
    '  "brandName": string | null,',
    '  "categoryName": string | null,',
    '  "model": string | null (exact ref/model code e.g. U516 00),',
    '  "description": string | null (concise storefront summary, max 240 chars),',
    '  "fullDescription": string | null (detailed description with key features),',
    '  "width": string | null (numeric mm only if known),',
    '  "length": string | null (numeric mm only if known),',
    '  "weight": string | null (numeric kg only if known),',
    '  "volume": string | null (numeric m3 only if known),',
    '  "specs": Array<{ "label": string, "value": string, "unit"?: string }>,',
    '  "seo": { "title": string, "description": string, "keywords": string[] }',
    '}',
    'Prefer matching existingCatalogBrands and existingCatalogCategories whenever appropriate.',
    'For specs.label use: Color, Size / Dimensions, Material, Packaging Type, Paper Quality / GSM, Ink Color, Page Count, Binding Style, Ruling Type, Cover Type, Tip Size, Ink Type, Water Resistance, Warranty Period, Special Features, Other.',
  ].join('\n');

  const userPayloadText = JSON.stringify({
    barcode: params.barcode || null,
    registryData: params.partialData.registry || null,
    webSearchAnswer: params.webSearch.answer,
    webSearchSnippets: params.webSearch.snippets,
    websiteExtractedData: {
      name: params.websiteExtracted.name,
      brandName: params.websiteExtracted.brandName,
      categoryName: params.websiteExtracted.categoryName,
      model: params.websiteExtracted.model,
      description: params.websiteExtracted.description,
      fullDescription: params.websiteExtracted.fullDescription?.slice(0, 1200),
      width: params.websiteExtracted.width,
      length: params.websiteExtracted.length,
      weight: params.websiteExtracted.weight,
      volume: params.websiteExtracted.volume,
      specs: params.websiteExtracted.specs,
    },
    existingCatalogBrands: params.existingBrands.slice(0, 80),
    existingCatalogCategories: params.existingCategories.slice(0, 80),
  });

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.BASE_URL || 'https://paperland.com.pk',
    'X-Title': 'Paperland Product Analyzer',
  };

  let visualSource = params.imageBase64 || null;
  if (!visualSource && params.imageUrl) {
    visualSource = (await imageUrlToCompactDataUri(params.imageUrl)) || params.imageUrl;
  }

  // Try multimodal (with image) first when an image is provided; fallback to text-only if needed
  const attempts: any[] = [];
  if (visualSource) {
    attempts.push([
      { type: 'text', text: userPayloadText },
      { type: 'image_url', image_url: { url: visualSource } },
    ]);
  }
  if (hasWebOrRegistry) {
    attempts.push(userPayloadText);
  }

  for (const contentPayload of attempts) {
    try {
      const res = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model,
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contentPayload },
          ],
        },
        { timeout: 25000, headers }
      );

      const content = res.data?.choices?.[0]?.message?.content;
      const textContent = Array.isArray(content)
        ? content.map((c: any) => c.text || '').join('\n')
        : String(content || '');

      const parsed = parseJsonFromAi(textContent);
      if (parsed) {
        return {
          provider: 'OPENROUTER_AI',
          modelUsed: res.data?.model || model,
          ...parsed,
        };
      }
    } catch {
      // Try next fallback attempt
    }
  }

  return null;
}

function suggestSku(
  brandName?: string | null,
  categoryName?: string | null,
  model?: string | null,
  barcode?: string | null
): string {
  const bAbbr =
    (brandName || 'GEN')
      .replace(/[^A-Za-z0-9]/g, '')
      .substring(0, 3)
      .toUpperCase() || 'GEN';
  const cAbbr =
    (categoryName || 'CAT')
      .replace(/[^A-Za-z0-9]/g, '')
      .substring(0, 3)
      .toUpperCase() || 'CAT';
  const cleanModel = (model || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const cleanCode = (barcode || '').replace(/[^A-Za-z0-9]/g, '');
  const suffix =
    cleanModel.length >= 3 && cleanModel.length <= 10
      ? cleanModel
      : cleanCode.length >= 4
        ? cleanCode.slice(-6).toUpperCase()
        : String(Math.floor(1000 + Math.random() * 9000));
  return `${bAbbr}-${cAbbr}-${suffix}`;
}

function inferBrandFromText(text: string, brands: { id: string; name: string }[]) {
  if (!text) return null;
  const lower = text.toLowerCase();
  const sorted = [...brands].sort((a, b) => b.name.length - a.name.length);
  return (
    sorted.find((b) => {
      const escaped = b.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(lower);
    }) || null
  );
}

function inferCategoryFromText(text: string, categories: { id: string; name: string }[]) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const rule of STATIONERY_CATEGORY_HINTS) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      const match = categories.find((c) =>
        rule.categoryHints.some((hint) => c.name.toLowerCase().includes(hint))
      );
      if (match) return match;
    }
  }
  return null;
}

export async function lookupAndEnrichProduct(
  prisma: any,
  input: {
    barcode?: string | null;
    uploadedImageUrl?: string | null;
    imageBase64?: string | null;
    existingHints?: {
      name?: string | null;
      brandName?: string | null;
      categoryName?: string | null;
      sku?: string | null;
    };
  }
): Promise<BarcodeLookupResult> {
  const cleanBarcode = input.barcode ? String(input.barcode).trim() : null;

  const [brands, categories] = await Promise.all([
    prisma.brand.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, normalizedName: true },
    }),
    prisma.category.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, normalizedName: true },
    }),
  ]);

  setQuotaPrisma(prisma);

  // 1. Paperland Duplicate Check
  let duplicateProductId: string | null = null;
  let duplicateProductName: string | null = null;

  if (cleanBarcode || input.existingHints?.sku) {
    const orClauses: any[] = [];
    if (cleanBarcode) {
      orClauses.push({ barcode: cleanBarcode });
      orClauses.push({ sku: cleanBarcode });
    }
    if (input.existingHints?.sku) {
      orClauses.push({ sku: input.existingHints.sku.trim() });
    }

    const dup = await prisma.product.findFirst({
      where: { deletedAt: null, OR: orClauses },
      select: { id: true, name: true, sku: true },
    });
    if (dup) {
      duplicateProductId = dup.id;
      duplicateProductName = dup.name;
    }
  }

  // 2. Parallel Free Barcode Registries (Open Products/Food Facts + UPCitemdb concurrently)
  let upcData: any = null;
  let openFactsData: any = null;

  if (cleanBarcode) {
    [openFactsData, upcData] = await Promise.all([
      lookupOpenFacts(cleanBarcode),
      lookupUpcItemDb(cleanBarcode),
    ]);
  }

  const primaryRegistry =
    (upcData?.name ? upcData : null) ||
    (openFactsData?.name ? openFactsData : null) ||
    upcData ||
    openFactsData;

  // 3. Live Web Search API (Tavily / Serper) to discover real product pages
  let webSearch: WebSearchResult = { provider: null, answer: null, snippets: [], images: [] };
  if ((!primaryRegistry?.name || !primaryRegistry?.description) && (cleanBarcode || input.existingHints?.name)) {
    webSearch = await searchWebForProduct(cleanBarcode, input.existingHints?.name);
  }

  // 4. Direct Website Product Page Extraction (Schema.org JSON-LD + OpenGraph + Spec Tables)
  const candidateUrls = webSearch.snippets.map((s) => s.url).filter(Boolean);
  const websiteExtracted = await extractProductFromWebsites(candidateUrls);

  // 5. Optional OpenRouter Free AI Structuring & Multimodal Enrichment
  let openRouterData: any = null;
  if (process.env.OPENROUTER_API_KEY?.trim()) {
    openRouterData = await structureWithOpenRouter({
      barcode: cleanBarcode,
      imageUrl: input.uploadedImageUrl,
      imageBase64: input.imageBase64,
      partialData: {
        hints: input.existingHints || {},
        registry: primaryRegistry?.raw || null,
      },
      webSearch,
      websiteExtracted,
      existingBrands: brands.map((b: any) => b.name),
      existingCategories: categories.map((c: any) => c.name),
    });
    invalidateQuotaCache();
  }

  // 6. Merge all discovered fields by priority
  const fallbackWebTitle =
    webSearch.snippets.length > 0 ? cleanWebProductTitle(webSearch.snippets[0].title) : null;
  const fallbackWebDesc = truncateText(
    webSearch.answer || webSearch.snippets[0]?.snippet || null,
    240
  );

  const mergedName =
    input.existingHints?.name ||
    openRouterData?.name ||
    websiteExtracted.name ||
    primaryRegistry?.name ||
    fallbackWebTitle ||
    null;

  const combinedTextForInference = [
    mergedName,
    websiteExtracted.description,
    primaryRegistry?.description,
    fallbackWebDesc,
  ]
    .filter(Boolean)
    .join(' ');

  const inferredBrand = inferBrandFromText(combinedTextForInference, brands);
  const inferredCategory = inferCategoryFromText(combinedTextForInference, categories);

  const mergedBrandName =
    input.existingHints?.brandName ||
    openRouterData?.brandName ||
    websiteExtracted.brandName ||
    primaryRegistry?.brandName ||
    inferredBrand?.name ||
    null;

  const mergedCategoryName =
    input.existingHints?.categoryName ||
    openRouterData?.categoryName ||
    websiteExtracted.categoryName ||
    primaryRegistry?.categoryName ||
    inferredCategory?.name ||
    null;

  const mergedModel =
    openRouterData?.model || websiteExtracted.model || primaryRegistry?.model || null;

  const mergedDescription = truncateText(
    openRouterData?.description ||
      websiteExtracted.description ||
      primaryRegistry?.description ||
      fallbackWebDesc,
    250
  );

  const mergedFullDescription =
    openRouterData?.fullDescription ||
    websiteExtracted.fullDescription ||
    primaryRegistry?.fullDescription ||
    webSearch.answer ||
    mergedDescription ||
    null;

  const mergedSpecs: AnalyzedSpec[] = [];
  const seenSpecs = new Set<string>();
  for (const s of [
    ...(openRouterData?.specs || []),
    ...(websiteExtracted.specs || []),
    ...(primaryRegistry?.specs || []),
  ]) {
    if (s?.label && s?.value) {
      const k = `${String(s.label).toLowerCase()}:${String(s.value).toLowerCase()}`;
      if (!seenSpecs.has(k)) {
        seenSpecs.add(k);
        mergedSpecs.push({
          label: String(s.label),
          value: String(s.value),
          unit: s.unit ? String(s.unit) : undefined,
        });
      }
    }
  }

  // 6b. Collect & validate studio product photos (drops 403/ECONNRESET URLs before saving)
  const rawStudioImages: string[] = [
    ...(websiteExtracted.images || []),
    ...(primaryRegistry?.images || []),
    ...(webSearch.images || []),
  ].filter(Boolean);

  let studioImages = await validateImageUrls(rawStudioImages, 10);

  if (studioImages.length === 0 && (mergedName || cleanBarcode)) {
    const imgQuery = mergedName
      ? [mergedBrandName && !mergedName.toLowerCase().includes(mergedBrandName.toLowerCase()) ? mergedBrandName : null, mergedName, mergedModel && !mergedName.toLowerCase().includes(mergedModel.toLowerCase()) ? mergedModel : null]
          .filter(Boolean)
          .join(' ')
      : String(cleanBarcode);
    const imgSearch = await searchProductImages(imgQuery, 8);
    if (imgSearch.images.length > 0) {
      studioImages = await validateImageUrls(imgSearch.images, 8);
    }
  }

  const mergedImages = mergeStudioImagesFirst(studioImages, [], input.uploadedImageUrl, 10);

  // 7. Auto-map Brand & Category against Paperland DB
  const matchEntity = (list: any[], target?: string | null) => {
    if (!target) return null;
    const norm = target.trim().toLowerCase();
    return (
      list.find(
        (x) =>
          x.name.toLowerCase() === norm ||
          (x.normalizedName && x.normalizedName.toLowerCase() === norm)
      ) ||
      list.find(
        (x) => norm.includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(norm)
      ) ||
      null
    );
  };

  const matchedBrand = matchEntity(brands, mergedBrandName) || inferredBrand;
  const matchedCategory = matchEntity(categories, mergedCategoryName) || inferredCategory;

  let lookupSource: BarcodeLookupResult['lookupSource'] = 'NOT_FOUND';
  if (openRouterData?.name) lookupSource = 'OPENROUTER_AI';
  else if (websiteExtracted.name || websiteExtracted.extractedWebsites.length > 0)
    lookupSource = 'WEB_SNIPPET';
  else if (upcData?.name) lookupSource = 'UPCITEMDB';
  else if (openFactsData?.name) lookupSource = 'OPEN_PRODUCTS_FACTS';
  else if (webSearch.snippets.length > 0 || webSearch.answer) lookupSource = 'WEB_SNIPPET';
  else if (input.existingHints?.name) lookupSource = 'EXCEL_ONLY';

  const suggestedSku =
    input.existingHints?.sku ||
    suggestSku(
      matchedBrand?.name || mergedBrandName,
      matchedCategory?.name || mergedCategoryName,
      mergedModel,
      cleanBarcode
    );

  const seo = {
    title: openRouterData?.seo?.title || websiteExtracted.seo.title || mergedName || undefined,
    description:
      openRouterData?.seo?.description ||
      websiteExtracted.seo.description ||
      mergedDescription ||
      undefined,
    keywords:
      openRouterData?.seo?.keywords?.length
        ? openRouterData.seo.keywords
        : websiteExtracted.seo.keywords?.length
          ? websiteExtracted.seo.keywords
          : ([
              matchedBrand?.name || mergedBrandName,
              matchedCategory?.name || mergedCategoryName,
              mergedModel,
              cleanBarcode,
            ].filter(Boolean) as string[]),
  };

  const marketPriceHint =
    websiteExtracted.marketPriceHint || primaryRegistry?.marketPriceHint || null;

  return {
    barcode: cleanBarcode,
    lookupSource,
    duplicateProductId,
    duplicateProductName,
    name: mergedName,
    sku: suggestedSku,
    brandId: matchedBrand?.id || null,
    brandName: matchedBrand?.name || mergedBrandName,
    categoryId: matchedCategory?.id || null,
    categoryName: matchedCategory?.name || mergedCategoryName,
    description: mergedDescription,
    fullDescription: mergedFullDescription,
    width: extractNumericString(
      openRouterData?.width || websiteExtracted.width || primaryRegistry?.width
    ),
    length: extractNumericString(
      openRouterData?.length || websiteExtracted.length || primaryRegistry?.length
    ),
    weight: extractNumericString(
      openRouterData?.weight || websiteExtracted.weight || primaryRegistry?.weight
    ),
    volume: extractNumericString(
      openRouterData?.volume || websiteExtracted.volume || primaryRegistry?.volume
    ),
    specs: mergedSpecs,
    images: mergedImages,
    seo,
    rawLookupData: {
      openFacts: openFactsData?.raw || null,
      upcItemDb: upcData?.raw || null,
      webSearchProvider: webSearch.provider,
      webSearchAnswer: webSearch.answer,
      webSnippets: webSearch.snippets,
      extractedWebsites: websiteExtracted.extractedWebsites,
      marketPriceHint,
      candidateImages: mergedImages,
      openRouterModel: openRouterData?.modelUsed || null,
      googleSearchUrl: cleanBarcode
        ? `https://www.google.com/search?q=${encodeURIComponent(cleanBarcode)}`
        : null,
      googleShoppingUrl: cleanBarcode
        ? `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(cleanBarcode)}`
        : null,
    },
  };
}
