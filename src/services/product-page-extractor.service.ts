import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ExtractedSpec {
  label: string;
  value: string;
  unit?: string;
}

export interface MarketPriceHint {
  price: number;
  currency: string;
  sourceDomain: string;
  sourceUrl: string;
}

export interface ExtractedPageSummary {
  url: string;
  domain: string;
  title?: string | null;
  hasJsonLd: boolean;
}

export interface WebsiteExtractedProduct {
  name: string | null;
  brandName: string | null;
  categoryName: string | null;
  model: string | null;
  description: string | null;
  fullDescription: string | null;
  width: string | null;
  length: string | null;
  weight: string | null;
  volume: string | null;
  specs: ExtractedSpec[];
  images: string[];
  seo: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  marketPriceHint: MarketPriceHint | null;
  extractedWebsites: ExtractedPageSummary[];
}

const PAGE_FETCH_TIMEOUT_MS = 6000;

const SPEC_KEY_MAPPING: { patterns: RegExp[]; label: string }[] = [
  { patterns: [/^colou?r$/i, /barrel\s*colou?r/i, /shade/i], label: 'Color' },
  { patterns: [/ink\s*colou?r/i], label: 'Ink Color' },
  { patterns: [/ink\s*type/i], label: 'Ink Type' },
  { patterns: [/tip\s*size/i, /point\s*size/i, /nib/i, /line\s*width/i], label: 'Tip Size' },
  { patterns: [/material/i, /body/i, /wood/i, /casing/i], label: 'Material' },
  { patterns: [/pack(aging|age|\s*size|\s*qty)?/i, /qty|quantity|count|pieces|pcs/i], label: 'Packaging Type' },
  { patterns: [/gsm|paper\s*quality|paper\s*weight/i], label: 'Paper Quality / GSM' },
  { patterns: [/page(s|\s*count)?|sheets/i], label: 'Page Count' },
  { patterns: [/binding/i], label: 'Binding Style' },
  { patterns: [/ruling|ruled/i], label: 'Ruling Type' },
  { patterns: [/cover/i], label: 'Cover Type' },
  { patterns: [/pocket/i], label: 'Number of Pockets' },
  { patterns: [/ring\s*size/i], label: 'Ring Size' },
  { patterns: [/water\s*resistan/i, /waterproof/i], label: 'Water Resistance' },
  { patterns: [/warranty/i], label: 'Warranty Period' },
  { patterns: [/size|dimension/i], label: 'Size / Dimensions' },
  { patterns: [/grade|hardness|lead|model|item\s*code|sku|mpn|feature|shape|grip/i], label: 'Special Features' },
];

/**
 * Convert weight strings ("7.25 lbs", "250 g", "0.5 kg", "4 oz") to numeric kg string.
 */
export function parseWeightToKg(raw?: string | number | null): string | null {
  if (raw === undefined || raw === null) return null;
  const text = String(raw).trim().toLowerCase();
  const match = text.match(/([\d]+(?:\.[\d]+)?)\s*(kg|kilograms?|g|grams?|gm|lbs?|pounds?|oz|ounces?)?/i);
  if (!match) return null;
  const val = parseFloat(match[1]);
  if (isNaN(val) || val <= 0) return null;
  const unit = (match[2] || '').toLowerCase();

  let kg = val;
  if (unit === 'g' || unit.startsWith('gram') || unit === 'gm') kg = val / 1000;
  else if (unit.startsWith('lb') || unit.startsWith('pound')) kg = val * 0.453592;
  else if (unit.startsWith('oz') || unit.startsWith('ounce')) kg = val * 0.0283495;

  return Number(kg.toFixed(4)).toString();
}

/**
 * Convert a single length value ("19.2 cm", "192 mm", "7.5 in") to numeric mm string.
 */
export function parseLengthToMm(raw?: string | number | null): string | null {
  if (raw === undefined || raw === null) return null;
  const text = String(raw).trim().toLowerCase();
  const match = text.match(/([\d]+(?:\.[\d]+)?)\s*(mm|millimeters?|cm|centimeters?|in|inch|inches|"|m)?/i);
  if (!match) return null;
  const val = parseFloat(match[1]);
  if (isNaN(val) || val <= 0) return null;
  const unit = (match[2] || 'mm').toLowerCase();

  let mm = val;
  if (unit.startsWith('cm') || unit.startsWith('centi')) mm = val * 10;
  else if (unit === 'in' || unit.startsWith('inch') || unit === '"') mm = val * 25.4;
  else if (unit === 'm') mm = val * 1000;

  return Number(mm.toFixed(2)).toString();
}

/**
 * Parse 2D/3D dimension strings ("192 x 48 x 15 mm", "19.2x4.8x1.5 cm", "8 x 188 mm")
 * into Paperland's width (mm), length (mm), and computed volume (m³).
 */
export function parseDimensionString(raw?: string | null): {
  width: string | null;
  length: string | null;
  volume: string | null;
} {
  if (!raw) return { width: null, length: null, volume: null };
  const text = String(raw).replace(/[×*]/g, 'x').trim();
  const match = text.match(
    /([\d]+(?:\.[\d]+)?)\s*(?:mm|cm|in|")?\s*x\s*([\d]+(?:\.[\d]+)?)\s*(?:mm|cm|in|")?(?:\s*x\s*([\d]+(?:\.[\d]+)?))?\s*(mm|cm|in|inch|inches|")?/i
  );
  if (!match) return { width: null, length: null, volume: null };

  const unit = (match[4] || 'mm').toLowerCase();
  const scale = unit.startsWith('cm') ? 10 : unit.startsWith('in') || unit === '"' ? 25.4 : 1;

  const d1 = parseFloat(match[1]) * scale;
  const d2 = parseFloat(match[2]) * scale;
  const d3 = match[3] ? parseFloat(match[3]) * scale : null;

  if (isNaN(d1) || isNaN(d2)) return { width: null, length: null, volume: null };

  // Convention: longest horizontal axis = length, next = width
  const sorted = [d1, d2].sort((a, b) => b - a);
  const length = Number(sorted[0].toFixed(2)).toString();
  const width = Number(sorted[1].toFixed(2)).toString();

  let volume: string | null = null;
  if (d3 && !isNaN(d3) && d3 > 0) {
    const m3 = (d1 * d2 * d3) / 1_000_000_000;
    volume = Number(m3.toFixed(6)).toString();
  }

  return { width, length, volume };
}

function mapSpecLabelAndUnit(rawKey: string, rawVal: string): ExtractedSpec | null {
  const key = rawKey.replace(/[:*]/g, '').trim();
  const val = rawVal.replace(/\s+/g, ' ').trim();
  if (!key || !val || val.length > 160) return null;

  const matched = SPEC_KEY_MAPPING.find((m) => m.patterns.some((p) => p.test(key)));
  const label = matched ? matched.label : 'Special Features';
  const finalVal = matched ? val : `${key}: ${val}`;

  // Detect unit suffix for Paperland's SPEC_UNITS dropdown
  const unitMatch = val.match(/^([\d]+(?:\.[\d]+)?)\s*(mm|cm|inches|kg|grams|g|ml|gsm|pages|pcs|pieces|pack|box|set|%)$/i);
  if (unitMatch && matched) {
    let unit = unitMatch[2].toLowerCase();
    if (unit === 'g') unit = 'grams';
    if (unit === 'pieces') unit = 'pcs';
    return { label, value: unitMatch[1], unit };
  }

  return { label, value: finalVal };
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function normalizeImageUrls(img: any, baseUrl: string): string[] {
  const urls: string[] = [];
  const pushUrl = (u: any) => {
    if (!u) return;
    if (typeof u === 'string') {
      try {
        const resolved = new URL(u, baseUrl).toString();
        if (resolved.startsWith('http') && !urls.includes(resolved)) urls.push(resolved);
      } catch {
        // ignore invalid URL
      }
    } else if (typeof u === 'object') {
      if (u.url) pushUrl(u.url);
      else if (u.contentUrl) pushUrl(u.contentUrl);
    }
  };

  if (Array.isArray(img)) img.forEach(pushUrl);
  else pushUrl(img);

  return urls;
}

function findProductNodesInJsonLd(node: any): any[] {
  const found: any[] = [];
  if (!node) return found;
  if (Array.isArray(node)) {
    node.forEach((n) => found.push(...findProductNodesInJsonLd(n)));
    return found;
  }
  if (typeof node === 'object') {
    const typeVal = node['@type'];
    const types = Array.isArray(typeVal) ? typeVal : [typeVal];
    if (types.some((t) => typeof t === 'string' && t.toLowerCase() === 'product')) {
      found.push(node);
    }
    if (node['@graph']) {
      found.push(...findProductNodesInJsonLd(node['@graph']));
    }
  }
  return found;
}

async function fetchAndParseSinglePage(url: string): Promise<{
  summary: ExtractedPageSummary;
  data: Partial<WebsiteExtractedProduct>;
} | null> {
  const domain = extractDomain(url);
  try {
    const res = await axios.get(url, {
      timeout: PAGE_FETCH_TIMEOUT_MS,
      maxContentLength: 2 * 1024 * 1024,
      headers: {
        'User-Agent': 'PaperlandAdminAnalyzer/1.0 (+https://paperland.com.pk)',
        Accept: 'text/html,application/xhtml+xml',
      },
      validateStatus: (s) => s >= 200 && s < 400,
    });

    const contentType = String(res.headers['content-type'] || '');
    if (!contentType.includes('html')) return null;

    const $ = cheerio.load(res.data);

    // 1. Parse Schema.org JSON-LD Product nodes
    let jsonLdProduct: any = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      if (jsonLdProduct) return;
      const rawText = $(el).html()?.trim();
      if (!rawText) return;
      try {
        const parsed = JSON.parse(rawText);
        const products = findProductNodesInJsonLd(parsed);
        if (products.length > 0) jsonLdProduct = products[0];
      } catch {
        // Malformed JSON-LD on site — skip safely
      }
    });

    // 2. Extract Meta & OpenGraph tags
    const pageTitle = $('title').first().text().trim() || null;
    const h1Title = $('h1').first().text().trim() || null;
    const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || null;
    const ogDesc = $('meta[property="og:description"]').attr('content')?.trim() || null;
    const metaDesc = $('meta[name="description"]').attr('content')?.trim() || null;
    const metaKeywordsRaw = $('meta[name="keywords"]').attr('content')?.trim() || '';
    const ogImage = $('meta[property="og:image"]').attr('content')?.trim() || null;
    const metaBrand = $('meta[property="product:brand"]').attr('content')?.trim() || null;
    const metaCategory = $('meta[property="product:category"]').attr('content')?.trim() || null;
    const metaPrice = $('meta[property="product:price:amount"]').attr('content')?.trim() || null;
    const metaCurrency = $('meta[property="product:price:currency"]').attr('content')?.trim() || null;

    const ldBrand =
      typeof jsonLdProduct?.brand === 'string'
        ? jsonLdProduct.brand
        : jsonLdProduct?.brand?.name || null;

    const ldCategory =
      typeof jsonLdProduct?.category === 'string'
        ? jsonLdProduct.category.split('>').pop()?.trim() || null
        : null;

    const images: string[] = [];
    if (jsonLdProduct?.image) {
      images.push(...normalizeImageUrls(jsonLdProduct.image, url));
    }
    if (ogImage) {
      normalizeImageUrls(ogImage, url).forEach((u) => {
        if (!images.includes(u)) images.push(u);
      });
    }

    // 3. Extract specs & dimensions from JSON-LD + HTML tables/dl
    const specs: ExtractedSpec[] = [];
    const seenSpecKeys = new Set<string>();
    const addSpec = (k: string, v: string) => {
      const mapped = mapSpecLabelAndUnit(k, v);
      if (!mapped) return;
      const dedupeKey = `${mapped.label.toLowerCase()}:${mapped.value.toLowerCase()}`;
      if (!seenSpecKeys.has(dedupeKey)) {
        seenSpecKeys.add(dedupeKey);
        specs.push(mapped);
      }
    };

    let width: string | null = parseLengthToMm(
      typeof jsonLdProduct?.width === 'object' ? jsonLdProduct.width?.value : jsonLdProduct?.width
    );
    let length: string | null = parseLengthToMm(
      typeof jsonLdProduct?.depth === 'object'
        ? jsonLdProduct.depth?.value
        : jsonLdProduct?.depth || jsonLdProduct?.height?.value || jsonLdProduct?.height
    );
    let weight: string | null = parseWeightToKg(
      typeof jsonLdProduct?.weight === 'object'
        ? `${jsonLdProduct.weight?.value || ''} ${jsonLdProduct.weight?.unitCode || ''}`
        : jsonLdProduct?.weight
    );
    let volume: string | null = null;

    if (jsonLdProduct?.color) addSpec('Color', String(jsonLdProduct.color));
    if (jsonLdProduct?.material) addSpec('Material', String(jsonLdProduct.material));
    if (jsonLdProduct?.mpn || jsonLdProduct?.model) {
      addSpec('Model', String(jsonLdProduct.mpn || jsonLdProduct.model));
    }

    if (Array.isArray(jsonLdProduct?.additionalProperty)) {
      jsonLdProduct.additionalProperty.forEach((prop: any) => {
        if (prop?.name && prop?.value) {
          const valStr = prop.unitText ? `${prop.value} ${prop.unitText}` : String(prop.value);
          addSpec(String(prop.name), valStr);
          if (/dimension|size/i.test(prop.name) && (!width || !length)) {
            const dims = parseDimensionString(valStr);
            if (!width && dims.width) width = dims.width;
            if (!length && dims.length) length = dims.length;
            if (!volume && dims.volume) volume = dims.volume;
          }
          if (/weight/i.test(prop.name) && !weight) {
            weight = parseWeightToKg(valStr);
          }
        }
      });
    }

    // Parse compact HTML spec tables / definition lists
    $('table tr').each((_, tr) => {
      if (specs.length >= 12) return;
      const cells = $(tr).find('th, td');
      if (cells.length === 2) {
        const k = $(cells[0]).text().trim();
        const v = $(cells[1]).text().trim();
        if (k.length > 1 && k.length < 40 && v.length > 0 && v.length < 140) {
          if (/dimension|size/i.test(k) && (!width || !length)) {
            const dims = parseDimensionString(v);
            if (!width && dims.width) width = dims.width;
            if (!length && dims.length) length = dims.length;
            if (!volume && dims.volume) volume = dims.volume;
          } else if (/weight/i.test(k) && !weight) {
            weight = parseWeightToKg(v);
          } else {
            addSpec(k, v);
          }
        }
      }
    });

    // 4. Extract read-only Market Reference Price Hint
    let marketPriceHint: MarketPriceHint | null = null;
    const ldOffer = Array.isArray(jsonLdProduct?.offers)
      ? jsonLdProduct.offers[0]
      : jsonLdProduct?.offers;
    const rawPrice = ldOffer?.price || ldOffer?.lowPrice || metaPrice;
    const rawCurrency = ldOffer?.priceCurrency || metaCurrency || 'PKR';
    if (rawPrice && !isNaN(Number(rawPrice)) && Number(rawPrice) > 0) {
      marketPriceHint = {
        price: Number(rawPrice),
        currency: String(rawCurrency).toUpperCase(),
        sourceDomain: domain,
        sourceUrl: url,
      };
    }

    // 5. Description & SEO
    const rawFullDesc =
      (typeof jsonLdProduct?.description === 'string' && jsonLdProduct.description.trim()) ||
      ogDesc ||
      metaDesc ||
      null;
    const cleanDescText = rawFullDesc ? cheerio.load(rawFullDesc).text().replace(/\s+/g, ' ').trim() : null;
    const shortDesc = cleanDescText
      ? cleanDescText.length > 240
        ? `${cleanDescText.slice(0, 237)}...`
        : cleanDescText
      : null;

    const keywords = metaKeywordsRaw
      ? metaKeywordsRaw
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
          .slice(0, 15)
      : [];

    const name = jsonLdProduct?.name || ogTitle || h1Title || null;

    return {
      summary: {
        url,
        domain,
        title: name || pageTitle,
        hasJsonLd: Boolean(jsonLdProduct),
      },
      data: {
        name: name ? String(name).trim() : null,
        brandName: ldBrand || metaBrand || null,
        categoryName: ldCategory || metaCategory || null,
        model: jsonLdProduct?.mpn || jsonLdProduct?.sku || null,
        description: shortDesc,
        fullDescription: rawFullDesc,
        width,
        length,
        weight,
        volume,
        specs,
        images: images.slice(0, 6),
        seo: {
          title: pageTitle || ogTitle || undefined,
          description: metaDesc || ogDesc || undefined,
          keywords,
        },
        marketPriceHint,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Fetches top 1-3 discovered product websites and merges structured JSON-LD,
 * OpenGraph, HTML spec tables, dimensions, and market reference price hints.
 */
export async function extractProductFromWebsites(urls: string[]): Promise<WebsiteExtractedProduct> {
  const uniqueUrls = Array.from(new Set(urls.filter((u) => u && u.startsWith('http')))).slice(0, 3);

  const empty: WebsiteExtractedProduct = {
    name: null,
    brandName: null,
    categoryName: null,
    model: null,
    description: null,
    fullDescription: null,
    width: null,
    length: null,
    weight: null,
    volume: null,
    specs: [],
    images: [],
    seo: {},
    marketPriceHint: null,
    extractedWebsites: [],
  };

  if (uniqueUrls.length === 0) return empty;

  const settled = await Promise.allSettled(uniqueUrls.map((u) => fetchAndParseSinglePage(u)));
  const results = settled
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && Boolean(r.value))
    .map((r) => r.value);

  // Prefer pages that exposed structured Schema.org JSON-LD Product data first
  results.sort((a, b) => Number(b.summary.hasJsonLd) - Number(a.summary.hasJsonLd));

  const merged: WebsiteExtractedProduct = { ...empty, specs: [], images: [], extractedWebsites: [] };
  const seenSpecs = new Set<string>();

  for (const r of results) {
    merged.extractedWebsites.push(r.summary);
    const d = r.data as Partial<WebsiteExtractedProduct>;
    if (!merged.name && d.name) merged.name = d.name;
    if (!merged.brandName && d.brandName) merged.brandName = d.brandName;
    if (!merged.categoryName && d.categoryName) merged.categoryName = d.categoryName;
    if (!merged.model && d.model) merged.model = d.model;
    if (!merged.description && d.description) merged.description = d.description;
    if (!merged.fullDescription && d.fullDescription) merged.fullDescription = d.fullDescription;
    if (!merged.width && d.width) merged.width = d.width;
    if (!merged.length && d.length) merged.length = d.length;
    if (!merged.weight && d.weight) merged.weight = d.weight;
    if (!merged.volume && d.volume) merged.volume = d.volume;
    if (!merged.marketPriceHint && d.marketPriceHint) merged.marketPriceHint = d.marketPriceHint;
    if (!merged.seo.title && d.seo?.title) merged.seo.title = d.seo.title;
    if (!merged.seo.description && d.seo?.description) merged.seo.description = d.seo.description;
    if ((!merged.seo.keywords || merged.seo.keywords.length === 0) && d.seo?.keywords?.length) {
      merged.seo.keywords = d.seo.keywords;
    }

    for (const img of d.images || []) {
      if (!merged.images.includes(img) && merged.images.length < 8) {
        merged.images.push(img);
      }
    }
    for (const s of d.specs || []) {
      const k = `${s.label.toLowerCase()}:${s.value.toLowerCase()}`;
      if (!seenSpecs.has(k)) {
        seenSpecs.add(k);
        merged.specs.push(s);
      }
    }
  }

  return merged;
}
