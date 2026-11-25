import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import {
  analyzeExcelBatch,
  analyzeSingleProduct,
  approveAnalyzerItem,
  generateAnalyzerTemplateBuffer,
  reanalyzeAnalyzerItem,
} from '../services/product-analyzer.service';
import {
  getActiveLookupCapabilities,
  searchProductImages,
} from '../services/web-search.service';
import { mergeStudioImagesFirst, validateImageUrls } from '../services/image-mirror.service';
import { getAnalyzerQuotas, setQuotaPrisma } from '../services/analyzer-quota.service';

export default async function productAnalyzerRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma as any;
  setQuotaPrisma(prisma);

  // GET /admin/product-analyzer/quotas — Live & tracked API quota limits + reset countdowns
  fastify.get(
    '/admin/product-analyzer/quotas',
    {
      preHandler: [fastify.authenticate, fastify.hasPermission('product_view')],
      schema: {
        description: 'Get live & tracked usage limits, remaining balance, and reset schedule for Product Analyzer APIs',
        tags: ['Product Analyzer'],
      },
    },
    async (request: any, reply) => {
      try {
        const refresh = String(request.query?.refresh || '').toLowerCase() === 'true';
        const quotas = await getAnalyzerQuotas(prisma, refresh);
        return createResponse(
          {
            quotas,
            serverTime: new Date().toISOString(),
          },
          'Analyzer API quotas retrieved'
        );
      } catch (err: any) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send(createErrorResponse('Failed to load API quotas: ' + err.message));
      }
    }
  );

  // GET /admin/product-analyzer — List staging queue with filters & counts
  fastify.get(
    '/admin/product-analyzer',
    {
      preHandler: [fastify.authenticate, fastify.hasPermission('product_view')],
      schema: {
        description: 'List product analyzer staging items with status counts',
        tags: ['Product Analyzer'],
      },
    },
    async (request: any, reply) => {
      try {
        const {
          page = '1',
          limit = '20',
          status,
          search,
          batchId,
          inputType,
        } = request.query as Record<string, string | undefined>;

        const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20', 10) || 20));
        const skip = (pageNum - 1) * limitNum;

        const where: any = {};
        if (status && status !== 'ALL') {
          where.lookupStatus = status;
        }
        if (batchId) {
          where.batchId = batchId;
        }
        if (inputType && inputType !== 'ALL') {
          where.inputType = inputType;
        }
        if (search && search.trim()) {
          const q = search.trim();
          where.OR = [
            { name: { contains: q, mode: 'insensitive' } },
            { barcode: { contains: q, mode: 'insensitive' } },
            { sku: { contains: q, mode: 'insensitive' } },
            { brandName: { contains: q, mode: 'insensitive' } },
            { categoryName: { contains: q, mode: 'insensitive' } },
          ];
        }

        const [items, total, groupedCounts] = await Promise.all([
          prisma.productAnalyzerItem.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limitNum,
            include: {
              submittedBy: {
                select: { id: true, email: true, firstName: true, lastName: true },
              },
              approvedBy: {
                select: { id: true, email: true, firstName: true, lastName: true },
              },
              approvedProduct: {
                select: { id: true, name: true, sku: true, slug: true },
              },
            },
          }),
          prisma.productAnalyzerItem.count({ where }),
          prisma.productAnalyzerItem.groupBy({
            by: ['lookupStatus'],
            _count: { _all: true },
          }),
        ]);

        const statusCounts: Record<string, number> = {
          ALL: 0,
          ANALYZING: 0,
          PENDING_REVIEW: 0,
          APPROVED: 0,
          REJECTED: 0,
          FAILED: 0,
        };
        groupedCounts.forEach((g: any) => {
          statusCounts[g.lookupStatus] = g._count._all;
          statusCounts.ALL += g._count._all;
        });

        const serialized = items.map((it: any) => ({
          ...it,
          salesPrice: Number(it.salesPrice || 0),
          wholesalePrice: Number(it.wholesalePrice || 0),
          costPrice: Number(it.costPrice || 0),
        }));

        const capabilities = getActiveLookupCapabilities();

        return createResponse(serialized, 'Analyzer items retrieved', {
          page: pageNum,
          limit: limitNum,
          total,
          statusCounts,
          ...capabilities,
        });
      } catch (err: any) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send(createErrorResponse('Failed to fetch analyzer items: ' + err.message));
      }
    }
  );

  // GET /admin/product-analyzer/template — Download ready-to-fill .xlsx template
  fastify.get(
    '/admin/product-analyzer/template',
    {
      preHandler: [fastify.authenticate, fastify.hasPermission('product_view')],
      schema: {
        description: 'Download Product Analyzer Excel template with Barcode + Product columns',
        tags: ['Product Analyzer'],
      },
    },
    async (_request, reply) => {
      try {
        const buffer = await generateAnalyzerTemplateBuffer();
        reply.header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        reply.header(
          'Content-Disposition',
          'attachment; filename="Paperland_Product_Analyzer_Template.xlsx"'
        );
        return reply.send(buffer);
      } catch (err: any) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send(createErrorResponse('Failed to generate template: ' + err.message));
      }
    }
  );

  // GET /admin/product-analyzer/:id — Retrieve a single analyzer item (e.g., to prefill 7-Step Add Product Wizard)
  fastify.get(
    '/admin/product-analyzer/:id',
    {
      preHandler: [fastify.authenticate, fastify.hasPermission('product_view')],
      schema: {
        description: 'Get a single Product Analyzer item by ID',
        tags: ['Product Analyzer'],
      },
    },
    async (request: any, reply) => {
      try {
        const item = await prisma.productAnalyzerItem.findUnique({
          where: { id: request.params.id },
          include: {
            submittedBy: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
            approvedBy: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
            approvedProduct: {
              select: { id: true, name: true, sku: true, slug: true },
            },
          },
        });
        if (!item) {
          return reply.status(404).send(createErrorResponse('Analyzer item not found'));
        }
        return createResponse(
          {
            ...item,
            salesPrice: Number(item.salesPrice || 0),
            wholesalePrice: Number(item.wholesalePrice || 0),
            costPrice: Number(item.costPrice || 0),
          },
          'Analyzer item retrieved'
        );
      } catch (err: any) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send(createErrorResponse('Failed to fetch analyzer item: ' + err.message));
      }
    }
  );

  // POST /admin/product-analyzer/analyze-single — Single image + barcode analysis
  fastify.post(
    '/admin/product-analyzer/analyze-single',
    {
      preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
      schema: {
        description: 'Analyze a single product picture/barcode and add to staging list',
        tags: ['Product Analyzer'],
      },
    },
    async (request: any, reply) => {
      try {
        const {
          barcode,
          uploadedImageUrl,
          imageBase64,
          originalFileName,
          overrides,
        } = request.body || {};

        if (!barcode && !uploadedImageUrl && !imageBase64 && !overrides?.name) {
          return reply
            .status(400)
            .send(
              createErrorResponse(
                'Provide at least a barcode number, product image, or product name.'
              )
            );
        }

        const item = await analyzeSingleProduct(fastify, {
          barcode,
          uploadedImageUrl,
          imageBase64,
          originalFileName,
          submittedById: (request.user as any)?.id,
          overrides,
        });

        return createResponse(
          {
            ...item,
            salesPrice: Number(item.salesPrice || 0),
            wholesalePrice: Number(item.wholesalePrice || 0),
            costPrice: Number(item.costPrice || 0),
          },
          'Product analyzed and added to Product Analyzer list'
        );
      } catch (err: any) {
        fastify.log.error(err);
        return reply
          .status(err.statusCode || 500)
          .send(createErrorResponse(err.message || 'Analysis failed'));
      }
    }
  );

  // POST /admin/product-analyzer/analyze-excel — Upload Excel/CSV file for batch analysis
  fastify.post(
    '/admin/product-analyzer/analyze-excel',
    {
      preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
      schema: {
        description: 'Upload Excel/CSV with product barcodes/columns to analyze in batch',
        tags: ['Product Analyzer'],
        consumes: ['multipart/form-data'],
      },
    },
    async (request: any, reply) => {
      try {
        const data = await request.file();
        if (!data) {
          return reply.status(400).send(createErrorResponse('No Excel/CSV file uploaded'));
        }

        const buffer = await data.toBuffer();
        const result = await analyzeExcelBatch(
          fastify,
          buffer,
          data.filename || 'products.xlsx',
          (request.user as any)?.id
        );

        return createResponse(
          result,
          `${result.totalRows} product(s) queued for barcode & internet analysis`
        );
      } catch (err: any) {
        fastify.log.error(err);
        return reply
          .status(err.statusCode || 500)
          .send(createErrorResponse(err.message || 'Excel analysis failed'));
      }
    }
  );

  // PATCH /admin/product-analyzer/:id — Edit staged product fields before approval
  fastify.patch(
    '/admin/product-analyzer/:id',
    {
      preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
      schema: {
        description: 'Update fields of a staged Product Analyzer item',
        tags: ['Product Analyzer'],
      },
    },
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const body = request.body || {};

        const existing = await prisma.productAnalyzerItem.findUnique({ where: { id } });
        if (!existing) {
          return reply.status(404).send(createErrorResponse('Analyzer item not found'));
        }

        const updateData: any = {};
        const directFields = [
          'barcode',
          'name',
          'sku',
          'brandId',
          'brandName',
          'categoryId',
          'categoryName',
          'status',
          'description',
          'fullDescription',
          'isFeatured',
          'isVisibleOnEcommerce',
          'width',
          'length',
          'weight',
          'volume',
          'specs',
          'images',
          'seo',
          'lookupStatus',
          'approvedProductId',
        ];

        directFields.forEach((key) => {
          if (body[key] !== undefined) updateData[key] = body[key];
        });

        // Preserve full candidate pool inside rawLookupData so unselecting images keeps them pickable
        if (Array.isArray(body.images)) {
          const prevRaw =
            existing.rawLookupData && typeof existing.rawLookupData === 'object'
              ? (existing.rawLookupData as Record<string, any>)
              : {};
          const mergedPool = Array.from(
            new Set([
              ...(Array.isArray(prevRaw.candidateImages) ? prevRaw.candidateImages : []),
              ...(Array.isArray(existing.images) ? existing.images : []),
              ...body.images,
              ...(existing.uploadedImageUrl ? [existing.uploadedImageUrl] : []),
            ].filter((u: any) => typeof u === 'string' && u.trim()))
          ).slice(0, 16);
          updateData.rawLookupData = { ...prevRaw, candidateImages: mergedPool };
        }

        if (body.salesPrice !== undefined) updateData.salesPrice = Number(body.salesPrice) || 0;
        if (body.wholesalePrice !== undefined)
          updateData.wholesalePrice = Number(body.wholesalePrice) || 0;
        if (body.costPrice !== undefined) updateData.costPrice = Number(body.costPrice) || 0;
        if (body.stock !== undefined) updateData.stock = Math.max(0, parseInt(body.stock, 10) || 0);
        if (body.threshold !== undefined)
          updateData.threshold = Math.max(0, parseInt(body.threshold, 10) || 0);

        // If previously rejected or failed and edited, return to PENDING_REVIEW
        if (['REJECTED', 'FAILED'].includes(existing.lookupStatus) && !body.lookupStatus) {
          updateData.lookupStatus = 'PENDING_REVIEW';
          updateData.rejectionReason = null;
        }

        const updated = await prisma.productAnalyzerItem.update({
          where: { id },
          data: updateData,
          include: {
            submittedBy: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
            approvedBy: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
            approvedProduct: {
              select: { id: true, name: true, sku: true, slug: true },
            },
          },
        });

        return createResponse(
          {
            ...updated,
            salesPrice: Number(updated.salesPrice || 0),
            wholesalePrice: Number(updated.wholesalePrice || 0),
            costPrice: Number(updated.costPrice || 0),
          },
          'Analyzer item updated'
        );
      } catch (err: any) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send(createErrorResponse('Update failed: ' + err.message));
      }
    }
  );

  // POST /admin/product-analyzer/:id/reanalyze — Re-run internet search
  fastify.post(
    '/admin/product-analyzer/:id/reanalyze',
    {
      preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
      schema: {
        description: 'Re-run barcode & internet lookup for an analyzer item',
        tags: ['Product Analyzer'],
      },
    },
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const { barcode } = request.body || {};
        const updated = await reanalyzeAnalyzerItem(fastify, id, barcode);
        return createResponse(
          {
            ...updated,
            salesPrice: Number(updated.salesPrice || 0),
            wholesalePrice: Number(updated.wholesalePrice || 0),
            costPrice: Number(updated.costPrice || 0),
          },
          'Product re-analyzed'
        );
      } catch (err: any) {
        fastify.log.error(err);
        return reply
          .status(err.statusCode || 500)
          .send(createErrorResponse(err.message || 'Re-analysis failed'));
      }
    }
  );

  // POST /admin/product-analyzer/:id/fetch-images — On-demand studio image search (SerpApi / Serper / Tavily)
  fastify.post(
    '/admin/product-analyzer/:id/fetch-images',
    {
      preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
      schema: {
        description: 'Fetch studio product images online via SerpApi / Serper / Tavily for a staged item',
        tags: ['Product Analyzer'],
      },
    },
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const { query: customQuery } = request.body || {};

        const item = await prisma.productAnalyzerItem.findUnique({ where: { id } });
        if (!item) {
          return reply.status(404).send(createErrorResponse('Analyzer item not found'));
        }

        const caps = getActiveLookupCapabilities();
        if (!caps.webSearchEnabled) {
          return reply
            .status(400)
            .send(
              createErrorResponse(
                'Web image search is not configured. Add SERPAPI_API_KEY (or TAVILY_API_KEY / SERPER_API_KEY) to backend .env.'
              )
            );
        }

        const searchQuery =
          String(customQuery || '').trim() ||
          [item.brandName, item.name].filter(Boolean).join(' ').trim() ||
          String(item.barcode || '').trim();

        if (!searchQuery) {
          return reply
            .status(400)
            .send(createErrorResponse('Enter a product name or barcode first to search for photos'));
        }

        const found = await searchProductImages(searchQuery, 8);
        const validNewImages = await validateImageUrls(found.images, 8);
        const prevRaw =
          item.rawLookupData && typeof item.rawLookupData === 'object'
            ? (item.rawLookupData as Record<string, any>)
            : {};
        const prevPool: string[] = Array.from(
          new Set([
            ...(Array.isArray(prevRaw.candidateImages) ? prevRaw.candidateImages : []),
            ...(Array.isArray(item.images) ? item.images : []),
          ])
        );
        const validPrevPool = await validateImageUrls(prevPool, 12);
        const nextCandidatePool = mergeStudioImagesFirst(
          validNewImages,
          validPrevPool,
          item.uploadedImageUrl,
          16
        );

        // Keep existing selected images intact; only auto-select if nothing (or only barcode shot) is selected
        const currentSelected: string[] = Array.isArray(item.images) ? item.images : [];
        const hasRealSelection = currentSelected.some(
          (u) => u && u !== item.uploadedImageUrl
        );
        const nextSelected = hasRealSelection
          ? currentSelected
          : validNewImages.length > 0
            ? validNewImages.slice(0, 3)
            : currentSelected;

        const updated = await prisma.productAnalyzerItem.update({
          where: { id },
          data: {
            images: nextSelected,
            rawLookupData: { ...prevRaw, candidateImages: nextCandidatePool },
          },
          include: {
            submittedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
            approvedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
            approvedProduct: { select: { id: true, name: true, sku: true, slug: true } },
          },
        });

        return createResponse(
          {
            item: {
              ...updated,
              salesPrice: Number(updated.salesPrice || 0),
              wholesalePrice: Number(updated.wholesalePrice || 0),
              costPrice: Number(updated.costPrice || 0),
            },
            addedImages: validNewImages,
            provider: found.provider,
            query: searchQuery,
          },
          validNewImages.length > 0
            ? `Found ${validNewImages.length} verified product photo(s) via ${found.provider}`
            : 'No reachable online product photos matched this query — try refining the product name or uploading directly'
        );
      } catch (err: any) {
        fastify.log.error(err);
        return reply
          .status(err.statusCode || 500)
          .send(createErrorResponse(err.message || 'Image search failed'));
      }
    }
  );

  // POST /admin/product-analyzer/:id/approve — Approve & publish to Live Product Catalog
  fastify.post(
    '/admin/product-analyzer/:id/approve',
    {
      preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
      schema: {
        description: 'Approve a Product Analyzer item and publish it to live Product Catalog',
        tags: ['Product Analyzer'],
      },
    },
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const { autoCreateEntities = true } = request.body || {};

        const result = await approveAnalyzerItem(
          fastify,
          id,
          {
            id: (request.user as any)?.id || 'unknown',
            ip: request.ip,
            userAgent: request.headers['user-agent'],
          },
          autoCreateEntities
        );

        return createResponse(
          {
            analyzerItem: {
              ...result.analyzerItem,
              salesPrice: Number(result.analyzerItem.salesPrice || 0),
              wholesalePrice: Number(result.analyzerItem.wholesalePrice || 0),
              costPrice: Number(result.analyzerItem.costPrice || 0),
            },
            productId: result.product.id,
            productSku: result.product.sku,
          },
          'Product approved and added to Live Product Catalog'
        );
      } catch (err: any) {
        if (err.code === 'P2002') {
          return reply
            .status(400)
            .send(createErrorResponse('A live product with this SKU already exists. Edit the SKU before approving.'));
        }
        fastify.log.error(err);
        return reply
          .status(err.statusCode || 500)
          .send(createErrorResponse(err.message || 'Approval failed'));
      }
    }
  );

  // POST /admin/product-analyzer/bulk-approve — Bulk approve selected items
  fastify.post(
    '/admin/product-analyzer/bulk-approve',
    {
      preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
      schema: {
        description: 'Bulk approve multiple Product Analyzer items into live catalog',
        tags: ['Product Analyzer'],
      },
    },
    async (request: any, reply) => {
      try {
        const { ids = [], autoCreateEntities = true } = request.body || {};
        if (!Array.isArray(ids) || ids.length === 0) {
          return reply.status(400).send(createErrorResponse('Select at least one item to approve'));
        }

        const approved: { id: string; productId: string; sku: string }[] = [];
        const failed: { id: string; reason: string }[] = [];

        for (const id of ids) {
          try {
            const res = await approveAnalyzerItem(
              fastify,
              id,
              {
                id: (request.user as any)?.id || 'unknown',
                ip: request.ip,
                userAgent: request.headers['user-agent'],
              },
              autoCreateEntities
            );
            approved.push({
              id,
              productId: res.product.id,
              sku: res.product.sku,
            });
          } catch (err: any) {
            failed.push({
              id,
              reason:
                err.code === 'P2002'
                  ? 'Duplicate SKU in live catalog'
                  : err.message || 'Approval failed',
            });
          }
        }

        return createResponse(
          { approved, failed },
          `Approved ${approved.length} of ${ids.length} product(s)`
        );
      } catch (err: any) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send(createErrorResponse('Bulk approve failed: ' + err.message));
      }
    }
  );

  // POST /admin/product-analyzer/:id/reject — Reject an item
  fastify.post(
    '/admin/product-analyzer/:id/reject',
    {
      preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
      schema: {
        description: 'Reject a Product Analyzer item',
        tags: ['Product Analyzer'],
      },
    },
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const { reason = '' } = request.body || {};

        const updated = await prisma.productAnalyzerItem.update({
          where: { id },
          data: {
            lookupStatus: 'REJECTED',
            rejectionReason: reason || null,
            approvedById: (request.user as any)?.id || null,
            approvedAt: new Date(),
          },
        });

        return createResponse(updated, 'Item rejected');
      } catch (err: any) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send(createErrorResponse('Reject failed: ' + err.message));
      }
    }
  );

  // DELETE /admin/product-analyzer/:id — Delete single item
  fastify.delete(
    '/admin/product-analyzer/:id',
    {
      preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
      schema: {
        description: 'Delete a Product Analyzer item',
        tags: ['Product Analyzer'],
      },
    },
    async (request: any, reply) => {
      try {
        await prisma.productAnalyzerItem.delete({ where: { id: request.params.id } });
        return createResponse({ deleted: true }, 'Item deleted');
      } catch (err: any) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send(createErrorResponse('Delete failed: ' + err.message));
      }
    }
  );

  // POST /admin/product-analyzer/bulk-delete — Bulk delete items
  fastify.post(
    '/admin/product-analyzer/bulk-delete',
    {
      preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
      schema: {
        description: 'Bulk delete Product Analyzer items',
        tags: ['Product Analyzer'],
      },
    },
    async (request: any, reply) => {
      try {
        const { ids = [] } = request.body || {};
        if (!Array.isArray(ids) || ids.length === 0) {
          return reply.status(400).send(createErrorResponse('No IDs provided'));
        }
        const res = await prisma.productAnalyzerItem.deleteMany({
          where: { id: { in: ids } },
        });
        return createResponse({ count: res.count }, `${res.count} item(s) deleted`);
      } catch (err: any) {
        fastify.log.error(err);
        return reply
          .status(500)
          .send(createErrorResponse('Bulk delete failed: ' + err.message));
      }
    }
  );
}
