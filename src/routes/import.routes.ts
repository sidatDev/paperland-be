import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_BUCKET_NAME } from '../plugins/storage';
import ExcelJS from 'exceljs';

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

        const totalRows = rows.length;
        const validRows: any[] = [];
        const invalidRows: any[] = [];
        
        // Basic preview validation logic (Simplified for UI feedback)
        rows.forEach(r => {
            if (r.values[0] && r.values[1]) { // Assuming SKU and Name are first two
                validRows.push(r);
            } else {
                invalidRows.push({ ...r, reason: "Missing required fields" });
            }
        });

        return createResponse({
            total: totalRows,
            valid: validRows.length,
            invalid: invalidRows.length,
            sampleErrors: invalidRows.slice(0, 10)
        }, "Preview generated");

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

        // 3. Add to Queue
        await fastify.queues.import.add('process-import', {
            logId: importLog.id,
            fileKey: key,
            mode,
            stockMode,
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
