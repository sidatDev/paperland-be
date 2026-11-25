import axios from 'axios';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const DOWNLOAD_TIMEOUT_MS = 8500;
const VALIDATE_TIMEOUT_MS = 3800;

const BROWSER_IMAGE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
};

export function isAlreadyPaperlandHosted(url: string): boolean {
  const lower = url.toLowerCase();
  const s3Endpoint = (process.env.S3_ENDPOINT || '').replace(/\/$/, '').toLowerCase();
  const s3Public = (process.env.S3_PUBLIC_URL || '').replace(/\/$/, '').toLowerCase();
  const apiUrl = (process.env.API_URL || '').replace(/\/$/, '').toLowerCase();

  if (s3Endpoint && lower.startsWith(s3Endpoint)) return true;
  if (s3Public && lower.startsWith(s3Public)) return true;
  if (apiUrl && lower.startsWith(apiUrl)) return true;
  if (lower.startsWith('http://localhost:') || lower.startsWith('http://127.0.0.1:')) return true;
  if (lower.includes('paperland-bucket') || lower.includes('pl-s3.sidattech.com')) return true;

  return false;
}

function isImageContentType(ct: string): boolean {
  const lower = String(ct || '').toLowerCase();
  return lower.startsWith('image/') && !lower.includes('svg');
}

interface ValidatedImageCandidate {
  url: string;
  hosted: boolean;
  width: number;
  height: number;
}

/**
 * Probes an external image URL for reachability, real image/* content-type,
 * and pixel dimensions via sharp (rejects 403/404 HTML, ECONNRESET, and tiny blurry icons).
 */
async function probeImageCandidate(url: string): Promise<ValidatedImageCandidate | null> {
  const cleanUrl = String(url || '').trim();
  if (!cleanUrl || (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://'))) {
    return null;
  }
  if (isAlreadyPaperlandHosted(cleanUrl)) {
    return { url: cleanUrl, hosted: true, width: 1000, height: 1000 };
  }

  try {
    const res = await axios.get(cleanUrl, {
      timeout: VALIDATE_TIMEOUT_MS,
      maxRedirects: 3,
      headers: BROWSER_IMAGE_HEADERS,
      responseType: 'arraybuffer',
      maxContentLength: MAX_IMAGE_BYTES,
      validateStatus: () => true,
    });

    if (res.status < 200 || res.status >= 400) return null;
    if (!isImageContentType(String(res.headers?.['content-type'] || ''))) return null;

    const buf = Buffer.from(res.data);
    if (buf.length < 1024) return null;

    const meta = await sharp(buf).metadata().catch(() => null);
    const width = Number(meta?.width || 0);
    const height = Number(meta?.height || 0);
    if (width === 0 || height === 0) return null;

    return { url: cleanUrl, hosted: false, width, height };
  } catch {
    return null;
  }
}

/**
 * Filters a list of candidate image URLs in parallel:
 * - Keeps only reachable real image/* URLs
 * - Rejects blurry low-res external images (< 400px) whenever crisp medium/high-res photos exist
 * - Sorts ideal medium-clear studio photos (500px - 1500px) first
 */
export async function validateImageUrls(urls: string[], limit = 10): Promise<string[]> {
  if (!Array.isArray(urls) || urls.length === 0) return [];
  const unique = Array.from(new Set(urls.map((u) => String(u || '').trim()).filter(Boolean)));
  const candidates = unique.slice(0, Math.max(limit + 4, 14));

  const probed = (await Promise.all(candidates.map((u) => probeImageCandidate(u)))).filter(
    (x): x is ValidatedImageCandidate => x !== null
  );

  const hosted = probed.filter((c) => c.hosted);
  const crispExternal = probed.filter(
    (c) => !c.hosted && Math.min(c.width, c.height) >= 380 && Math.max(c.width, c.height) >= 420
  );
  const blurryExternal = probed.filter(
    (c) => !c.hosted && (Math.min(c.width, c.height) < 380 || Math.max(c.width, c.height) < 420)
  );

  // Rank crisp external photos closest to the ~900px medium-clear sweet spot first
  crispExternal.sort((a, b) => {
    const aMax = Math.max(a.width, a.height);
    const bMax = Math.max(b.width, b.height);
    const aTier = aMax <= 1600 ? 0 : 1;
    const bTier = bMax <= 1600 ? 0 : 1;
    if (aTier !== bTier) return aTier - bTier;
    return Math.abs(900 - aMax) - Math.abs(900 - bMax);
  });

  // Drop blurry < 400px external images if we have crisp photos; only keep largest fallback if none exist
  const chosenExternal =
    crispExternal.length > 0
      ? crispExternal
      : blurryExternal.sort(
          (a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height)
        );

  return [...chosenExternal, ...hosted].map((c) => c.url).slice(0, limit);
}

/**
 * Downloads a single external image URL, optimizes it to WebP via sharp,
 * and uploads it to Paperland's MinIO S3 (or local uploads fallback).
 * Returns null if the external image is unreachable or returns non-image HTML (e.g. 403).
 */
export async function mirrorSingleExternalImage(
  url: string,
  prisma?: any,
  folder = 'products'
): Promise<string | null> {
  const cleanUrl = String(url || '').trim();
  if (!cleanUrl || (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://'))) {
    return null;
  }
  if (isAlreadyPaperlandHosted(cleanUrl)) {
    return cleanUrl;
  }

  try {
    const res = await axios.get(cleanUrl, {
      responseType: 'arraybuffer',
      timeout: DOWNLOAD_TIMEOUT_MS,
      maxContentLength: MAX_IMAGE_BYTES,
      headers: BROWSER_IMAGE_HEADERS,
    });

    const contentType = String(res.headers?.['content-type'] || '').toLowerCase();
    if (!isImageContentType(contentType)) {
      return null;
    }

    const rawBuf = Buffer.from(res.data);
    if (rawBuf.length < 512) {
      return null;
    }

    const optimizedBuf = await sharp(rawBuf)
      .rotate()
      .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 86 })
      .toBuffer();

    const filename = `${randomUUID()}.webp`;
    const key = `${folder}/${filename}`;
    const isS3Configured = Boolean(
      process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY
    );

    let hostedUrl: string;

    if (isS3Configured) {
      const { s3Client, S3_BUCKET_NAME } = await import('../plugins/storage');
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');

      await s3Client.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: key,
          Body: optimizedBuf,
          ContentType: 'image/webp',
          ACL: 'public-read',
        })
      );

      const endpoint = (process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT || '').replace(
        /\/$/,
        ''
      );
      hostedUrl = `${endpoint}/${S3_BUCKET_NAME}/${key}`;
    } else {
      const uploadPath = path.join(process.cwd(), 'public', 'uploads', folder);
      await fs.mkdir(uploadPath, { recursive: true });
      await fs.writeFile(path.join(uploadPath, filename), optimizedBuf);
      const apiUrl = process.env.API_URL || `http://127.0.0.1:${process.env.PORT || 3001}`;
      hostedUrl = `${apiUrl}/uploads/${folder}/${filename}`;
    }

    if (prisma?.media) {
      await prisma.media
        .create({
          data: {
            filename,
            url: hostedUrl,
            mimetype: 'image/webp',
            size: optimizedBuf.length,
            key,
          },
        })
        .catch(() => {});
    }

    return hostedUrl;
  } catch {
    // Drop unreachable / hotlink-blocked external image URLs so broken images never hit live storefront
    return null;
  }
}

/**
 * Mirrors an array of product image URLs into Paperland's storage in parallel.
 * Preserves ordering, deduplicates, and strips broken/unreachable external links.
 */
export async function mirrorExternalImagesToStorage(
  urls: string[],
  prisma?: any,
  folder = 'products'
): Promise<string[]> {
  if (!Array.isArray(urls) || urls.length === 0) return [];
  const uniqueUrls = Array.from(new Set(urls.filter((u) => typeof u === 'string' && u.trim())));
  const limited = uniqueUrls.slice(0, 10);

  const mirrored = await Promise.all(
    limited.map((u) => mirrorSingleExternalImage(u, prisma, folder))
  );

  return Array.from(new Set(mirrored.filter((u): u is string => Boolean(u))));
}

/**
 * Merges product images with clean studio/web images placed FIRST
 * and the uploaded barcode snapshot placed last (for reference / easy deletion).
 */
export function mergeStudioImagesFirst(
  studioImages: string[],
  existingImages: string[] = [],
  uploadedImageUrl?: string | null,
  maxImages = 10
): string[] {
  const uploaded = uploadedImageUrl?.trim() || null;
  const nonUploadedExisting = (existingImages || []).filter((u) => u && u !== uploaded);
  const ordered = [
    ...(studioImages || []),
    ...nonUploadedExisting,
    ...(uploaded ? [uploaded] : []),
  ];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of ordered) {
    const clean = typeof url === 'string' ? url.trim() : '';
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    result.push(clean);
    if (result.length >= maxImages) break;
  }
  return result;
}
