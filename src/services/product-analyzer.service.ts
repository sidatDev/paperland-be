import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import { lookupAndEnrichProduct } from './barcode-lookup.service';
import { createLiveProduct } from './product-creation.service';
import {
  mergeStudioImagesFirst,
  mirrorExternalImagesToStorage,
} from './image-mirror.service';
import { logActivity } from '../utils/audit';

const EXCEL_HEADER_ALIASES: Record<string, string> = {
  barcode: 'barcode',
  upc: 'barcode',
  ean: 'barcode',
  gtin: 'barcode',
  barcodeeanupc: 'barcode',
  sku: 'sku',
  partno: 'sku',
  partnumber: 'sku',
  name: 'name',
  productname: 'name',
  title: 'name',
  brand: 'brandName',
  brandname: 'brandName',
  manufacturer: 'brandName',
  category: 'categoryName',
  categoryname: 'categoryName',
  salesprice: 'salesPrice',
  retailprice: 'salesPrice',
  retailpricepkr: 'salesPrice',
  price: 'salesPrice',
  wholesaleprice: 'wholesalePrice',
  wholesalecorporatepricepkr: 'wholesalePrice',
  wholesale: 'wholesalePrice',
  b2bprice: 'wholesalePrice',
  costprice: 'costPrice',
  purchaseprice: 'costPrice',
  purchasebasepricepkr: 'costPrice',
  baseprice: 'costPrice',
  stock: 'stock',
  initialstock: 'stock',
  initialstockqty: 'stock',
  qty: 'stock',
  quantity: 'stock',
  threshold: 'threshold',
  lowstockthreshold: 'threshold',
  lowstockalertthreshold: 'threshold',
  reorderlevel: 'threshold',
  status: 'status',
  productstatus: 'status',
  description: 'description',
  shortdescription: 'description',
  descriptionshort: 'description',
  fulldescription: 'fullDescription',
  fullproductdescription: 'fullDescription',
  width: 'width',
  widthmm: 'width',
  length: 'length',
  lengthmm: 'length',
  weight: 'weight',
  weightkg: 'weight',
  volume: 'volume',
  volumem3: 'volume',
  imageurl: 'imageUrl',
  images: 'imageUrl',
  image: 'imageUrl',
  productimages: 'imageUrl',
  seotitle: 'seoTitle',
  metatitle: 'seoTitle',
  metatitleseo: 'seoTitle',
  seodescription: 'seoDescription',
  metadescription: 'seoDescription',
  metadescriptionseo: 'seoDescription',
  seokeywords: 'seoKeywords',
  keywords: 'seoKeywords',
  keywordsseo: 'seoKeywords',
  isfeatured: 'isFeatured',
  featured: 'isFeatured',
  featuredproduct: 'isFeatured',
  isvisibleonecommerce: 'isVisibleOnEcommerce',
  ecommercevisibility: 'isVisibleOnEcommerce',
  visible: 'isVisibleOnEcommerce',
};

function normalizeHeader(header: string): string {
  return String(header || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function parseBool(val: any, fallback: boolean): boolean {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'boolean') return val;
  const s = String(val).trim().toLowerCase();
  if (['true', 'yes', '1', 'y'].includes(s)) return true;
  if (['false', 'no', '0', 'n'].includes(s)) return false;
  return fallback;
}

function parseNumber(val: any, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  return isNaN(n) || n < 0 ? fallback : n;
}

function cellToString(val: any): string {
  if (val === undefined || val === null) return '';
  if (typeof val === 'object') {
    if (val.text) return String(val.text).trim();
    if (Array.isArray(val.richText)) {
      return val.richText.map((r: any) => r.text || '').join('').trim();
    }
    if (val.result !== undefined) return String(val.result).trim();
  }
  return String(val).trim();
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (index < items.length) {
        const current = items[index++];
        await worker(current);
      }
    }
  );
  await Promise.all(workers);
}

export async function generateAnalyzerTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Paperland Product Analyzer';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Products to Analyze', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'Barcode', key: 'barcode', width: 20 },
    { header: 'SKU', key: 'sku', width: 20 },
    { header: 'Product Name', key: 'name', width: 32 },
    { header: 'Brand', key: 'brandName', width: 18 },
    { header: 'Category', key: 'categoryName', width: 22 },
    { header: 'Retail Price (PKR)', key: 'salesPrice', width: 18 },
    { header: 'Wholesale Price (PKR)', key: 'wholesalePrice', width: 20 },
    { header: 'Cost Price (PKR)', key: 'costPrice', width: 18 },
    { header: 'Initial Stock Qty', key: 'stock', width: 16 },
    { header: 'Low Stock Threshold', key: 'threshold', width: 18 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Short Description', key: 'description', width: 34 },
    { header: 'Full Description', key: 'fullDescription', width: 36 },
    { header: 'Width (mm)', key: 'width', width: 14 },
    { header: 'Length (mm)', key: 'length', width: 14 },
    { header: 'Weight (kg)', key: 'weight', width: 14 },
    { header: 'Volume (m3)', key: 'volume', width: 14 },
    { header: 'Image URL', key: 'imageUrl', width: 30 },
    { header: 'Meta Title (SEO)', key: 'seoTitle', width: 26 },
    { header: 'Meta Description (SEO)', key: 'seoDescription', width: 32 },
    { header: 'Keywords (SEO)', key: 'seoKeywords', width: 26 },
    { header: 'Featured Product', key: 'isFeatured', width: 16 },
    { header: 'E-commerce Visibility', key: 'isVisibleOnEcommerce', width: 20 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Sample Row 1: Barcode-only (analyzer auto-searches internet for all missing details)
  sheet.addRow({
    barcode: '8852008100018',
    sku: '',
    name: '',
    brandName: '',
    categoryName: '',
    salesPrice: 1650,
    wholesalePrice: 1450,
    costPrice: 1200,
    stock: 100,
    threshold: 10,
    status: 'Active',
    description: '',
    fullDescription: '',
    width: '',
    length: '',
    weight: '',
    volume: '',
    imageUrl: '',
    seoTitle: '',
    seoDescription: '',
    seoKeywords: '',
    isFeatured: false,
    isVisibleOnEcommerce: true,
  });

  // Sample Row 2: Partially pre-filled with Barcode
  sheet.addRow({
    barcode: '4006381333627',
    sku: 'STA-HIG-33627',
    name: 'Stabilo Boss Original Highlighter Yellow',
    brandName: 'Stabilo',
    categoryName: 'Writing Instruments',
    salesPrice: 280,
    wholesalePrice: 240,
    costPrice: 190,
    stock: 250,
    threshold: 20,
    status: 'Active',
    description: 'Classic chisel-tip fluorescent highlighter with anti-dry-out technology.',
    fullDescription: '',
    width: '27',
    length: '105',
    weight: '0.025',
    volume: '',
    imageUrl: '',
    seoTitle: 'Stabilo Boss Original Highlighter Yellow',
    seoDescription: 'Buy Stabilo Boss Original Highlighter online at Paperland.',
    seoKeywords: 'highlighter, stabilo, marker, stationery',
    isFeatured: false,
    isVisibleOnEcommerce: true,
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

async function enrichAnalyzerItemAsync(
  fastify: FastifyInstance,
  itemId: string,
  params: {
    barcode?: string | null;
    uploadedImageUrl?: string | null;
    imageBase64?: string | null;
    existingImages?: string[];
    existingValues?: {
      name?: string | null;
      sku?: string | null;
      brandId?: string | null;
      brandName?: string | null;
      categoryId?: string | null;
      categoryName?: string | null;
      description?: string | null;
      fullDescription?: string | null;
      width?: string | null;
      length?: string | null;
      weight?: string | null;
      volume?: string | null;
      specs?: any;
      seo?: any;
    };
    preserveExistingFields?: boolean;
  }
) {
  const prisma = fastify.prisma as any;
  try {
    const lookup = await lookupAndEnrichProduct(prisma, {
      barcode: params.barcode,
      uploadedImageUrl: params.uploadedImageUrl,
      imageBase64: params.imageBase64,
      existingHints: params.preserveExistingFields
        ? {
            name: params.existingValues?.name,
            brandName: params.existingValues?.brandName,
            categoryName: params.existingValues?.categoryName,
            sku: params.existingValues?.sku,
          }
        : undefined,
    });

    const ex = params.existingValues || {};
    const preferExisting = Boolean(params.preserveExistingFields);
    const mergedImages = mergeStudioImagesFirst(
      lookup.images,
      params.existingImages || [],
      params.uploadedImageUrl,
      10
    );

    await prisma.productAnalyzerItem.update({
      where: { id: itemId },
      data: {
        barcode: lookup.barcode,
        lookupStatus: 'PENDING_REVIEW',
        lookupSource: lookup.lookupSource,
        lookupError: null,
        rawLookupData: lookup.rawLookupData,
        duplicateProductId: lookup.duplicateProductId,
        name: preferExisting ? ex.name || lookup.name : lookup.name || ex.name,
        sku: preferExisting ? ex.sku || lookup.sku : ex.sku || lookup.sku,
        brandId: lookup.brandId || ex.brandId || null,
        brandName: preferExisting
          ? ex.brandName || lookup.brandName
          : lookup.brandName || ex.brandName,
        categoryId: lookup.categoryId || ex.categoryId || null,
        categoryName: preferExisting
          ? ex.categoryName || lookup.categoryName
          : lookup.categoryName || ex.categoryName,
        description: preferExisting
          ? ex.description || lookup.description
          : lookup.description || ex.description,
        fullDescription: preferExisting
          ? ex.fullDescription || lookup.fullDescription
          : lookup.fullDescription || ex.fullDescription,
        width: preferExisting ? ex.width || lookup.width : lookup.width || ex.width,
        length: preferExisting ? ex.length || lookup.length : lookup.length || ex.length,
        weight: preferExisting ? ex.weight || lookup.weight : lookup.weight || ex.weight,
        volume: preferExisting ? ex.volume || lookup.volume : lookup.volume || ex.volume,
        specs: lookup.specs.length > 0 ? lookup.specs : ex.specs,
        images: mergedImages,
        seo: preferExisting && ex.seo ? ex.seo : lookup.seo || ex.seo,
      },
    });
  } catch (err: any) {
    fastify.log.error(err, `[ProductAnalyzer] Background enrichment failed for ${itemId}`);
    await prisma.productAnalyzerItem
      .update({
        where: { id: itemId },
        data: {
          lookupStatus: 'FAILED',
          lookupError: err?.message || 'Unexpected lookup failure',
        },
      })
      .catch(() => {});
  }
}

export async function analyzeSingleProduct(
  fastify: FastifyInstance,
  input: {
    barcode?: string;
    uploadedImageUrl?: string;
    imageBase64?: string;
    originalFileName?: string;
    submittedById?: string;
    overrides?: Partial<{
      name: string;
      sku: string;
      brandName: string;
      categoryName: string;
      salesPrice: number;
      wholesalePrice: number;
      costPrice: number;
      stock: number;
      threshold: number;
    }>;
  }
) {
  const prisma = fastify.prisma as any;
  const cleanBarcode = input.barcode ? String(input.barcode).trim() : null;

  // Immediately create staging row in ANALYZING state (< 200ms response, zero proxy timeouts!)
  const created = await prisma.productAnalyzerItem.create({
    data: {
      inputType: 'IMAGE',
      originalFileName: input.originalFileName || null,
      uploadedImageUrl: input.uploadedImageUrl || null,
      barcode: cleanBarcode,
      lookupStatus: 'ANALYZING',
      name: input.overrides?.name || null,
      sku: input.overrides?.sku || null,
      brandName: input.overrides?.brandName || null,
      categoryName: input.overrides?.categoryName || null,
      status: 'Active',
      isFeatured: false,
      isVisibleOnEcommerce: true,
      salesPrice: parseNumber(input.overrides?.salesPrice, 0),
      wholesalePrice: parseNumber(input.overrides?.wholesalePrice, 0),
      costPrice: parseNumber(input.overrides?.costPrice, 0),
      stock: Math.round(parseNumber(input.overrides?.stock, 0)),
      threshold: Math.round(parseNumber(input.overrides?.threshold, 10)),
      images: input.uploadedImageUrl ? [input.uploadedImageUrl] : [],
      submittedById: input.submittedById || null,
    },
    include: {
      submittedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      approvedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });

  // Run lookup & AI enrichment asynchronously so HTTP returns instantly
  void enrichAnalyzerItemAsync(fastify, created.id, {
    barcode: cleanBarcode,
    uploadedImageUrl: input.uploadedImageUrl,
    imageBase64: input.imageBase64,
    existingValues: {
      name: input.overrides?.name,
      sku: input.overrides?.sku,
      brandName: input.overrides?.brandName,
      categoryName: input.overrides?.categoryName,
    },
    preserveExistingFields: true,
  });

  return created;
}

export async function analyzeExcelBatch(
  fastify: FastifyInstance,
  fileBuffer: Buffer,
  fileName: string,
  submittedById?: string
) {
  const prisma = fastify.prisma as any;
  const workbook = new ExcelJS.Workbook();
  const isCsv = fileName.toLowerCase().endsWith('.csv');

  if (isCsv) {
    const { Readable } = await import('stream');
    await workbook.csv.read(Readable.from(fileBuffer));
  } else {
    await workbook.xlsx.load(fileBuffer as any);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw Object.assign(new Error('Uploaded workbook contains no worksheets'), {
      statusCode: 400,
    });
  }

  const rawHeaders = worksheet.getRow(1).values as any[];
  const headerMap: Record<number, string> = {};
  if (Array.isArray(rawHeaders)) {
    rawHeaders.forEach((h, colIdx) => {
      if (colIdx === 0 || !h) return;
      const norm = normalizeHeader(cellToString(h));
      const mapped = EXCEL_HEADER_ALIASES[norm];
      if (mapped) headerMap[colIdx] = mapped;
    });
  }

  const parsedRows: Record<string, any>[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const rowObj: Record<string, any> = {};
    let hasMeaningfulValue = false;

    Object.entries(headerMap).forEach(([colIdxStr, fieldKey]) => {
      const val = cellToString(row.getCell(Number(colIdxStr)).value);
      if (val !== '') {
        rowObj[fieldKey] = val;
        hasMeaningfulValue = true;
      }
    });

    if (hasMeaningfulValue && (rowObj.barcode || rowObj.name || rowObj.sku)) {
      parsedRows.push(rowObj);
    }
  });

  if (parsedRows.length === 0) {
    throw Object.assign(
      new Error(
        'No valid product rows found. Ensure your Excel sheet has at least a Barcode, Product Name, or SKU column.'
      ),
      { statusCode: 400 }
    );
  }

  const batchId = randomUUID();
  const createdItems: { id: string; rowData: Record<string, any> }[] = [];

  for (const r of parsedRows) {
    const images = r.imageUrl
      ? String(r.imageUrl)
          .split(',')
          .map((u) => u.trim())
          .filter(Boolean)
      : [];

    const seo =
      r.seoTitle || r.seoDescription || r.seoKeywords
        ? {
            title: r.seoTitle || undefined,
            description: r.seoDescription || undefined,
            keywords: r.seoKeywords
              ? String(r.seoKeywords)
                  .split(',')
                  .map((k) => k.trim())
                  .filter(Boolean)
              : [],
          }
        : undefined;

    const item = await prisma.productAnalyzerItem.create({
      data: {
        batchId,
        inputType: 'EXCEL',
        originalFileName: fileName,
        barcode: r.barcode || null,
        lookupStatus: 'ANALYZING',
        name: r.name || null,
        sku: r.sku || null,
        brandName: r.brandName || null,
        categoryName: r.categoryName || null,
        status: ['Active', 'Draft', 'Out of Stock'].includes(r.status)
          ? r.status
          : 'Active',
        description: r.description || null,
        fullDescription: r.fullDescription || null,
        salesPrice: parseNumber(r.salesPrice, 0),
        wholesalePrice: parseNumber(r.wholesalePrice, 0),
        costPrice: parseNumber(r.costPrice, 0),
        stock: Math.round(parseNumber(r.stock, 0)),
        threshold: Math.round(parseNumber(r.threshold, 10)),
        width: r.width || null,
        length: r.length || null,
        weight: r.weight || null,
        volume: r.volume || null,
        images,
        seo,
        isFeatured: parseBool(r.isFeatured, false),
        isVisibleOnEcommerce: parseBool(r.isVisibleOnEcommerce, true),
        submittedById: submittedById || null,
      },
    });
    createdItems.push({ id: item.id, rowData: r });
  }

  // Enrich asynchronously with rate-safe concurrency so UI responds immediately
  void runWithConcurrency(createdItems, 2, async ({ id, rowData }) => {
    try {
      const lookup = await lookupAndEnrichProduct(prisma, {
        barcode: rowData.barcode || null,
        existingHints: {
          name: rowData.name || null,
          brandName: rowData.brandName || null,
          categoryName: rowData.categoryName || null,
          sku: rowData.sku || null,
        },
      });

      const existingImages = rowData.imageUrl
        ? String(rowData.imageUrl)
            .split(',')
            .map((u) => u.trim())
            .filter(Boolean)
        : [];
      const combinedImages = Array.from(
        new Set([...existingImages, ...lookup.images])
      );

      await prisma.productAnalyzerItem.update({
        where: { id },
        data: {
          lookupStatus: 'PENDING_REVIEW',
          lookupSource: lookup.lookupSource,
          rawLookupData: lookup.rawLookupData,
          duplicateProductId: lookup.duplicateProductId,
          name: rowData.name || lookup.name,
          sku: rowData.sku || lookup.sku,
          brandId: lookup.brandId,
          brandName: rowData.brandName || lookup.brandName,
          categoryId: lookup.categoryId,
          categoryName: rowData.categoryName || lookup.categoryName,
          description: rowData.description || lookup.description,
          fullDescription: rowData.fullDescription || lookup.fullDescription,
          width: rowData.width || lookup.width,
          length: rowData.length || lookup.length,
          weight: rowData.weight || lookup.weight,
          volume: rowData.volume || lookup.volume,
          specs: lookup.specs.length > 0 ? lookup.specs : undefined,
          images: combinedImages,
          seo:
            rowData.seoTitle || rowData.seoDescription || rowData.seoKeywords
              ? undefined
              : lookup.seo,
        },
      });
    } catch (err: any) {
      fastify.log.error(err, `[ProductAnalyzer] Enrichment failed for item ${id}`);
      await prisma.productAnalyzerItem.update({
        where: { id },
        data: {
          lookupStatus: 'FAILED',
          lookupError: err?.message || 'Unexpected lookup failure',
        },
      });
    }
  });

  return {
    batchId,
    totalRows: createdItems.length,
    fileName,
  };
}

export async function reanalyzeAnalyzerItem(
  fastify: FastifyInstance,
  id: string,
  barcodeOverride?: string
) {
  const prisma = fastify.prisma as any;
  const existing = await prisma.productAnalyzerItem.findUnique({ where: { id } });
  if (!existing) {
    throw Object.assign(new Error('Analyzer item not found'), { statusCode: 404 });
  }

  const targetBarcode = barcodeOverride !== undefined ? barcodeOverride : existing.barcode;

  // Immediately flip to ANALYZING and return (< 200ms) to avoid proxy timeouts
  const updated = await prisma.productAnalyzerItem.update({
    where: { id },
    data: {
      barcode: targetBarcode ? String(targetBarcode).trim() : null,
      lookupStatus: 'ANALYZING',
      lookupError: null,
    },
    include: {
      submittedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      approvedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  });

  void enrichAnalyzerItemAsync(fastify, id, {
    barcode: targetBarcode,
    uploadedImageUrl: existing.uploadedImageUrl,
    existingImages: existing.images || [],
    existingValues: {
      name: barcodeOverride ? null : existing.name,
      sku: existing.sku,
      brandId: existing.brandId,
      brandName: existing.brandName,
      categoryId: existing.categoryId,
      categoryName: existing.categoryName,
      description: existing.description,
      fullDescription: existing.fullDescription,
      width: existing.width,
      length: existing.length,
      weight: existing.weight,
      volume: existing.volume,
      specs: existing.specs,
      seo: existing.seo,
    },
    preserveExistingFields: false,
  });

  return updated;
}

export async function approveAnalyzerItem(
  fastify: FastifyInstance,
  id: string,
  user: { id: string; ip?: string; userAgent?: string },
  autoCreateEntities = true
) {
  const prisma = fastify.prisma as any;
  const item = await prisma.productAnalyzerItem.findUnique({ where: { id } });

  if (!item) {
    throw Object.assign(new Error('Analyzer item not found'), { statusCode: 404 });
  }
  if (item.lookupStatus === 'APPROVED' && item.approvedProductId) {
    throw Object.assign(new Error('Item is already approved and live'), {
      statusCode: 400,
    });
  }

  if (!item.name || !item.name.trim()) {
    throw Object.assign(new Error('Product Name is required before approval'), {
      statusCode: 400,
    });
  }
  if (!item.sku || !item.sku.trim()) {
    throw Object.assign(new Error('SKU is required before approval'), {
      statusCode: 400,
    });
  }
  if (!item.brandId && !item.brandName) {
    throw Object.assign(new Error('Brand is required before approval'), {
      statusCode: 400,
    });
  }
  if (!item.categoryId && !item.categoryName) {
    throw Object.assign(new Error('Category is required before approval'), {
      statusCode: 400,
    });
  }

  const specsList = Array.isArray(item.specs) ? item.specs : [];
  const specsObj: Record<string, any> = {};
  specsList.forEach((s: any) => {
    if (s?.label) {
      specsObj[s.label] = s.unit && s.unit !== 'none' ? `${s.value} ${s.unit}` : s.value;
    }
  });
  if (item.width) specsObj['Width'] = `${item.width} mm`;
  if (item.length) specsObj['Length'] = `${item.length} mm`;
  if (item.weight) specsObj['Weight'] = `${item.weight} kg`;
  if (item.volume) specsObj['Volume'] = `${item.volume} m³`;

  // Mirror any external website/SerpApi images to Paperland MinIO S3 before going live
  const finalImages = await mirrorExternalImagesToStorage(item.images || [], prisma, 'products');

  const createdProduct = await createLiveProduct(
    fastify,
    {
      name: item.name,
      sku: item.sku,
      barcode: item.barcode,
      brandId: item.brandId || undefined,
      brand: item.brandName || undefined,
      categoryId: item.categoryId || undefined,
      category: item.categoryName || undefined,
      status: item.status || 'Active',
      isActive: item.status !== 'Draft',
      description: item.description || undefined,
      fullDescription: item.fullDescription || undefined,
      isFeatured: item.isFeatured,
      isVisibleOnEcommerce: item.isVisibleOnEcommerce,
      salesPrice: Number(item.salesPrice || 0),
      costPrice: Number(item.costPrice || 0),
      tierPricing: { wholesale: Number(item.wholesalePrice || 0) },
      stock: Number(item.stock || 0),
      threshold: Number(item.threshold ?? 10),
      width: item.width || undefined,
      length: item.length || undefined,
      weight: item.weight || undefined,
      volume: item.volume || undefined,
      specifications: specsObj,
      specs: specsList,
      media: finalImages,
      seo: item.seo || {},
    },
    {
      autoCreateEntities,
      performedBy: user.id,
      ip: user.ip,
      userAgent: user.userAgent,
      auditAction: 'ANALYZER_APPROVE',
      auditExtra: { analyzerItemId: item.id, lookupSource: item.lookupSource },
    }
  );

  const updatedItem = await prisma.productAnalyzerItem.update({
    where: { id },
    data: {
      lookupStatus: 'APPROVED',
      approvedById: user.id,
      approvedAt: new Date(),
      approvedProductId: createdProduct.id,
      brandId: createdProduct.brandId,
      categoryId: createdProduct.categoryId,
      images: finalImages,
      rejectionReason: null,
    },
    include: {
      submittedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      approvedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      approvedProduct: { select: { id: true, name: true, sku: true, slug: true } },
    },
  });

  await logActivity(fastify, {
    entityType: 'PRODUCT_ANALYZER',
    entityId: item.id,
    action: 'APPROVE',
    performedBy: user.id,
    details: { productId: createdProduct.id, sku: createdProduct.sku, barcode: item.barcode },
    ip: user.ip,
    userAgent: user.userAgent,
  });

  return { analyzerItem: updatedItem, product: createdProduct };
}
