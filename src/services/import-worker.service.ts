import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_BUCKET_NAME } from '../plugins/storage';
import ExcelJS from 'exceljs';
import { Readable } from 'stream';

const prisma = new PrismaClient();

export const HEADER_MAP: Record<string, string> = {
  sku: 'sku', SKU: 'sku', part_no: 'sku', partnumber: 'sku',
  name: 'name', title: 'name', product_name: 'name',
  brand: 'brand', Brand: 'brand',
  category: 'category', Category: 'category',
  price: 'price', sales_price: 'price', salesprice: 'price',
  stock: 'stock', totalstock: 'stock', quantity: 'stock',
  slug: 'slug',
  description: 'description',
  status: 'status',
  parentsku: 'parentSku', parentSku: 'parentSku',
  weight: 'weight', width: 'width', length: 'length', volume: 'volume',
};

const slugify = (text: string) => text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

const resolveEntity = async (type: 'category' | 'brand', name: string) => {
    if (!name) return null;
    const normalized = name.trim().toLowerCase();
    const model = type === 'category' ? prisma.category : prisma.brand;

    let entity = await (model as any).findUnique({
        where: { normalizedName: normalized }
    });

    if (!entity) {
        // Fallback to name search if normalizedName is empty
        entity = await (model as any).findFirst({
            where: { name: { equals: name.trim(), mode: 'insensitive' } }
        });
        
        if (!entity) {
            // Auto-create
            entity = await (model as any).create({
                data: {
                    name: name.trim(),
                    normalizedName: normalized,
                    slug: slugify(name.trim())
                }
            });
        } else if (!entity.normalizedName) {
            // Fill normalizedName if missing
            await (model as any).update({
                where: { id: entity.id },
                data: { normalizedName: normalized }
            });
        }
    }
    return entity.id;
};

const generateUniqueSlug = async (name: string, sku: string) => {
    const baseSlug = slugify(`${name}-${sku}`);
    let slug = baseSlug;
    let counter = 0;
    while (true) {
        const checkSlug = counter === 0 ? slug : `${slug}-${counter}`;
        const existing = await prisma.product.findUnique({ where: { slug: checkSlug } });
        if (!existing) return checkSlug;
        counter++;
    }
};

export async function processImportJob(job: Job) {
    const { logId, fileKey, mode, stockMode } = job.data;
    const startTime = Date.now();

    try {
        await prisma.productImportLog.update({
            where: { id: logId },
            data: { status: 'PROCESSING' }
        });

        await prisma.auditLog.create({
            data: {
                entityType: 'IMPORT',
                entityId: logId,
                action: 'IMPORT_STARTED',
                details: { fileKey, mode, stockMode }
            }
        });

        // 1. Get file from S3
        const s3Response = await s3Client.send(new GetObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: fileKey
        }));

        const body = s3Response.Body as Readable;
        if (!body) throw new Error("Could not read file from S3");

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.read(body);
        const worksheet = workbook.worksheets[0];
        const jobMappings = job.data.mappings || null;

        const rows: any[] = [];
        let headers: string[] = [];
        const seenSkus = new Set<string>();
        const duplicateSkusInFile = new Set<string>();

        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            const values = Array.isArray(row.values) ? row.values.slice(1) : [];
            if (rowNumber === 1) {
                headers = values.map(v => String(v).trim());
            } else {
                const rowData: any = {};
                headers.forEach((header, idx) => {
                    // 1. Try user-defined mappings first
                    let sysField = jobMappings ? jobMappings[header] : null;
                    
                    // 2. Fallback to hardcoded HEADER_MAP
                    if (!sysField) {
                        sysField = HEADER_MAP[header] || HEADER_MAP[header.toLowerCase().replace(/[\s_-]/g, '')];
                    }

                    if (sysField) {
                        rowData[sysField] = values[idx];
                    } else if (values[idx] !== undefined && values[idx] !== null && values[idx] !== '') {
                        // Task 3.2: Dynamic Option Columns Processing (Unmapped columns)
                        rowData.variantAttributes = rowData.variantAttributes || {};
                        rowData.variantAttributes[header] = String(values[idx]);
                    }
                });
                rowData._rowNumber = rowNumber;
                
                if (rowData.sku) {
                    if (seenSkus.has(String(rowData.sku))) {
                        duplicateSkusInFile.add(String(rowData.sku));
                    }
                    seenSkus.add(String(rowData.sku));
                }
                rows.push(rowData);
            }
        });

        await prisma.productImportLog.update({
            where: { id: logId },
            data: { totalRows: rows.length }
        });

        // 2. Segregate Parents and Variants
        const parents = rows.filter(r => !r.parentSku);
        const variants = rows.filter(r => r.parentSku);

        let added = 0;
        let updated = 0;
        let failed = 0;
        const errors: any[] = [];
        const CHUNK_SIZE = 50;

        const processRow = async (row: any, isVariant: boolean = false) => {
            try {
                if (!row.sku || !row.name) {
                    throw new Error("Missing required fields: SKU and Name");
                }

                if (duplicateSkusInFile.has(String(row.sku))) {
                    throw new Error(`Duplicate SKU found multiple times in this file: ${row.sku}`);
                }

                const brandId = await resolveEntity('brand', row.brand);
                const categoryId = await resolveEntity('category', row.category);

                if (!brandId || !categoryId) {
                    throw new Error(`Failed to resolve Brand (${row.brand}) or Category (${row.category})`);
                }

                let parentId = null;
                if (isVariant) {
                    const parent = await prisma.product.findUnique({ where: { sku: row.parentSku } });
                    if (!parent) throw new Error(`Parent product with SKU ${row.parentSku} not found`);
                    parentId = parent.id;
                }

                const productData = {
                    name: row.name,
                    description: row.description || null,
                    price: Number(row.price || 0),
                    status: row.status || 'Draft',
                    brandId,
                    categoryId,
                    parentId,
                    weight: row.weight?.toString(),
                    width: row.width?.toString(),
                    length: row.length?.toString(),
                    volume: row.volume?.toString(),
                    ...(row.variantAttributes ? { variantAttributes: row.variantAttributes } : {})
                };

                const existing = await prisma.product.findUnique({ where: { sku: row.sku } });

                if (existing) {
                    if (mode === 'UPSERT') {
                        // Log price change if any
                        const oldPrice = Number(existing.price || 0);
                        const newPrice = Number(row.price || 0);
                        if (row.price !== undefined && oldPrice !== newPrice) {
                            await prisma.priceUpdateLog.create({
                                data: {
                                    productId: existing.id,
                                    productName: existing.name,
                                    sku: existing.sku,
                                    priceType: 'RETAIL',
                                    oldPrice,
                                    newPrice,
                                    performedBy: job.data.userId || 'system',
                                    userName: 'System Import',
                                    reason: 'Bulk Import'
                                }
                            });
                        }

                        await prisma.product.update({
                            where: { id: existing.id },
                            data: productData
                        });
                        updated++;
                        if (isVariant) {
                            await prisma.auditLog.create({
                                data: { entityType: 'VARIANT', entityId: existing.id, action: 'VARIANT_UPDATED', details: { sku: row.sku } }
                            });
                        }
                    } else {
                        // INSERT_ONLY mode — product exists, skip
                        await prisma.auditLog.create({
                            data: { entityType: isVariant ? 'VARIANT' : 'PRODUCT', entityId: existing.id, action: 'VARIANT_SKIPPED', details: { sku: row.sku, reason: 'INSERT_ONLY: already exists' } }
                        });
                    }
                } else {
                    const slug = row.slug || await generateUniqueSlug(row.name, row.sku);
                    const newProd = await prisma.product.create({
                        data: {
                            ...productData,
                            sku: row.sku,
                            slug
                        }
                    });
                    added++;
                    if (isVariant) {
                        // Also update parent's variantOptions if new attribute added
                        if (parentId && row.variantAttributes) {
                             const parentRec = await prisma.product.findUnique({ where: { id: parentId } });
                             if (parentRec) {
                                 let pOpts: any[] = Array.isArray(parentRec.variantOptions) ? parentRec.variantOptions : [];
                                 let optionsChanged = false;
                                 Object.entries(row.variantAttributes).forEach(([k, v]) => {
                                     const opt = pOpts.find((o: any) => o.name === k);
                                     if (opt) {
                                         if (!opt.values.includes(v)) { opt.values.push(v); optionsChanged = true; }
                                     } else {
                                         pOpts.push({ name: k, values: [v] });
                                         optionsChanged = true;
                                     }
                                 });
                                 if (optionsChanged) {
                                     await prisma.product.update({ where: { id: parentId }, data: { variantOptions: pOpts } });
                                 }
                             }
                        }

                        await prisma.auditLog.create({
                            data: { entityType: 'VARIANT', entityId: newProd.id, action: 'VARIANT_CREATED', details: { sku: row.sku } }
                        });
                    }
                }

                // Handle Stock
                if (row.stock !== undefined) {
                  const defaultWarehouse = await prisma.warehouse.findFirst({ where: { isDefault: true } });
                  if (defaultWarehouse) {
                      const productId = existing ? existing.id : (await prisma.product.findUnique({where:{sku:row.sku}}))?.id;
                      if (productId) {
                          await prisma.stock.upsert({
                              where: { productId_warehouseId: { productId, warehouseId: defaultWarehouse.id } },
                              update: { qty: stockMode === 'INCREMENT' ? { increment: Number(row.stock) } : Number(row.stock) },
                              create: { productId, warehouseId: defaultWarehouse.id, locationId: 'DEFAULT', qty: Number(row.stock) }
                          });
                      }
                  }
                }

            } catch (err: any) {
                failed++;
                errors.push({ row: row._rowNumber, sku: row.sku, reason: err.message });
            }
        };

        const totalToProcess = rows.length;
        let processedCount = 0;

        // Process Parents
        for (let i = 0; i < parents.length; i += CHUNK_SIZE) {
            const chunk = parents.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(r => processRow(r)));
            processedCount += chunk.length;
            await prisma.productImportLog.update({
                where: { id: logId },
                data: { progress: Math.round((processedCount / totalToProcess) * 100), added, updated, failed }
            });
        }

        // Process Variants
        for (let i = 0; i < variants.length; i += CHUNK_SIZE) {
            const chunk = variants.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(r => processRow(r, true)));
            processedCount += chunk.length;
            await prisma.productImportLog.update({
                where: { id: logId },
                data: { progress: Math.round((processedCount / totalToProcess) * 100), added, updated, failed }
            });
        }

        await prisma.productImportLog.update({
            where: { id: logId },
            data: {
                status: failed === 0 ? 'COMPLETED' : (added + updated > 0 ? 'PARTIAL' : 'FAILED'),
                progress: 100,
                added,
                updated,
                failed,
                errorsJson: errors,
                duration: Date.now() - startTime,
                completedAt: new Date()
            }
        });

        await prisma.auditLog.create({
            data: {
                entityType: 'IMPORT',
                entityId: logId,
                action: 'IMPORT_EXECUTED',
                details: { added, updated, failed, total: rows.length, duration: Date.now() - startTime }
            }
        });

    } catch (err: any) {
        await prisma.productImportLog.update({
            where: { id: logId },
            data: { status: 'FAILED', errorsJson: [{ reason: err.message }], duration: Date.now() - startTime, completedAt: new Date() }
        });
        
        await prisma.auditLog.create({
            data: {
                entityType: 'IMPORT',
                entityId: logId,
                action: 'IMPORT_FAILED',
                details: { error: err.message }
            }
        });
        
        throw err;
    }
}
