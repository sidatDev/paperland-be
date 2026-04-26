import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_BUCKET_NAME } from '../plugins/storage';
import ExcelJS from 'exceljs';
import { featureFlags } from '../config/feature-flags';
import { HEADER_MAP } from '../services/import-worker.service';

export default async function importRoutes(fastify: FastifyInstance) {

  // POST /admin/products/import/preview
  // Dry-run validation before committing to queue
  fastify.post('/admin/products/import/preview', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
    schema: {
        description: 'Preview product import file validation',
        tags: ['Catalog'],
        consumes: ['multipart/form-data']
    }
  }, async (request: any, reply) => {
    try {
        const data = await request.file();
        if (!data) return reply.status(400).send(createErrorResponse("No file uploaded"));

        const buffer = await data.toBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const worksheet = workbook.worksheets[0];

        const rows: any[] = [];
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header
            const values = Array.isArray(row.values) ? row.values.slice(1) : [];
            rows.push({ rowNumber, values });
        });

        // Task 0.7: Extract Mappings for Accurate Preview
        const mappingsRaw = data.fields?.mappings?.value || request.body?.mappings;
        let mappings: any = null;
        if (mappingsRaw) {
            try {
                mappings = typeof mappingsRaw === 'string' ? JSON.parse(mappingsRaw) : mappingsRaw;
            } catch (_) { /* invalid json */ }
        }

        const totalRows = rows.length;
        const validRows: any[] = [];
        const invalidRows: any[] = [];
        
        // Accurate preview validation using mappings
        const headers = worksheet.getRow(1).values as any[];
        const headerList = Array.isArray(headers) ? headers.slice(1).map(h => String(h).trim()) : [];

        rows.forEach(r => {
            const rowData: any = {};
            headerList.forEach((h, idx) => {
                let sysField = mappings ? mappings[h] : null;
                if (!sysField) {
                    sysField = HEADER_MAP[h] || HEADER_MAP[h.toLowerCase().replace(/[\s_-]/g, '')];
                }
                if (sysField) {
                    rowData[sysField] = r.values[idx];
                }
            });

            // SKU and Name are mandatory
            if (rowData.sku && rowData.name) {
                validRows.push(r);
            } else {
                let reason = "Missing required fields";
                if (!rowData.sku && !rowData.name) reason = "Missing SKU and Name";
                else if (!rowData.sku) reason = "Missing SKU";
                else if (!rowData.name) reason = "Missing Name";
                
                invalidRows.push({ ...r, reason });
            }
        });

        const previewResult = {
            total: totalRows,
            valid: validRows.length,
            invalid: invalidRows.length,
            sampleErrors: invalidRows.slice(0, 10)
        };

        // Task 0.7 Observability: IMPORT_PREVIEW_GENERATED
        try {
            await (fastify.prisma as any).auditLog.create({
                data: {
                    entityType: 'IMPORT',
                    entityId: 'preview',
                    action: 'IMPORT_PREVIEW_GENERATED',
                    details: { total: totalRows, valid: validRows.length, invalid: invalidRows.length }
                }
            });
        } catch (_) { /* non-critical — don't block response */ }

        return createResponse(previewResult, "Preview generated");

    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse("Preview failed: " + err.message));
    }
  });

  // POST /admin/products/import
  // Enqueue import job
  fastify.post('/admin/products/import', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
    schema: {
        description: 'Start bulk product import process',
        tags: ['Catalog'],
        consumes: ['multipart/form-data']
    }
  }, async (request: any, reply) => {
    try {
        const data = await request.file();
        const mode = request.query.mode || 'UPSERT';
        const stockMode = request.query.stockMode || 'OVERWRITE';

        if (!data) return reply.status(400).send(createErrorResponse("No file uploaded"));

        const ext = path.extname(data.filename);
        if (!['.xlsx', '.csv'].includes(ext.toLowerCase())) {
            return reply.status(400).send(createErrorResponse("Only .xlsx and .csv files are supported"));
        }

        // Feature flag safety check for V2 (variant mapping)
        const variantOptionColumns = request.body?.variantOptionColumns;
        if (variantOptionColumns && !featureFlags.IMPORT_V2_ENABLED) {
             return reply.status(400).send(createErrorResponse("Import V2 is not enabled."));
        }

        const buffer = await data.toBuffer();
        const uuid = randomUUID();
        const filename = `${uuid}${ext}`;
        const key = `imports/${filename}`;

        // 1. Upload to S3 for background access
        await s3Client.send(new PutObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: data.mimetype
        }));

        const endpoint = (process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT || "").replace(/\/$/, "");
        const fileUrl = `${endpoint}/${S3_BUCKET_NAME}/${key}`;

        // 2. Create Progress Log
        const importLog = await (fastify.prisma as any).productImportLog.create({
            data: {
                fileName: data.filename,
                filePath: key,
                status: 'QUEUED',
                mode: mode,
                stockMode: stockMode,
                triggeredBy: (request.user as any)?.id || 'system'
            }
        });

        // 3. Add to Queue (Check if available)
        if (!fastify.queues?.import) {
            return reply.status(400).send({
                success: false,
                message: 'Background import queue is not enabled. Please enable REDIS_ENABLED in your environment.'
            });
        }

        const mappingsRaw = data.fields?.mappings?.value || request.body?.mappings;
        let mappings: any = null;
        if (mappingsRaw) {
            try {
                mappings = typeof mappingsRaw === 'string' ? JSON.parse(mappingsRaw) : mappingsRaw;
            } catch (_) { /* invalid json */ }
        }

        await fastify.queues.import.add('process-import', {
            logId: importLog.id,
            fileKey: key,
            mode,
            stockMode,
            mappings, // Pass mappings to the worker
            userId: (request.user as any)?.id
        }, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: true,
            removeOnFail: false
        });

        return createResponse({
            jobId: importLog.id,
            status: 'QUEUED'
        }, "Import queued successfully");

    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse("Start import failed: " + err.message));
    }
  });

  // GET /admin/products/import/:id
  fastify.get('/admin/products/import/:id', {
    preHandler: [fastify.authenticate],
    schema: {
        description: 'Get import job status and progress',
        tags: ['Catalog'],
        params: {
            type: 'object',
            properties: { id: { type: 'string' } }
        }
    }
  }, async (request: any, reply) => {
    try {
        const log = await (fastify.prisma as any).productImportLog.findUnique({
            where: { id: request.params.id }
        });
        if (!log) return reply.status(404).send(createErrorResponse("Import job not found"));
        return createResponse(log);
    } catch (err: any) {
        return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // GET /admin/products/import-logs
  fastify.get('/admin/products/import-logs', {
    preHandler: [fastify.authenticate],
    schema: {
        description: 'Get import history logs',
        tags: ['Catalog'],
        querystring: {
            type: 'object',
            properties: {
                page: { type: 'integer', default: 1 },
                limit: { type: 'integer', default: 10 }
            }
        }
    }
  }, async (request: any, reply) => {
    try {
        const { page = 1, limit = 10 } = request.query;
        const [logs, total] = await Promise.all([
            (fastify.prisma as any).productImportLog.findMany({
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit
            }),
            (fastify.prisma as any).productImportLog.count()
        ]);

        return createResponse(logs, "Import logs retrieved", { total, page, limit });
    } catch (err: any) {
        return reply.status(500).send(createErrorResponse(err.message));
    }
  });
}
