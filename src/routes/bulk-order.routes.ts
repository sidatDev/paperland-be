import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { z } from 'zod';
import { Readable } from 'stream';

export default async function bulkOrderRoutes(fastify: FastifyInstance) {

    fastify.addHook('preHandler', async (request: any, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.code(401).send(createErrorResponse('Unauthorized: Please login'));
        }
    });

    // 1. GET /b2b/bulk-order/template - Download CSV Template
    fastify.get('/b2b/bulk-order/template', {
        schema: {
            description: 'Download the B2B Bulk Order CSV Template',
            tags: ['B2B Bulk Order']
        }
    }, async (request, reply) => {
        const csvContent = 'SKU,Quantity,PO Number,Notes\nPROD-001,10,PO-123,Sample Order\nPROD-002,25,,Urgent delivery requested';
        
        reply
            .header('Content-Type', 'text/csv')
            .header('Content-Disposition', 'attachment; filename="paperland-bulk-order-template.csv"')
            .send(csvContent);
    });

    // 2. POST /b2b/bulk-order/validate - Validate CSV Content
    fastify.post('/b2b/bulk-order/validate', {
        schema: {
            description: 'Upload and validate a CSV file for bulk ordering',
            tags: ['B2B Bulk Order']
        }
    }, async (request: any, reply) => {
        const data = await request.file();
        if (!data) return reply.status(400).send(createErrorResponse('No file uploaded'));
        if (data.mimetype !== 'text/csv' && !data.filename.endsWith('.csv')) {
            return reply.status(400).send(createErrorResponse('Only CSV files are allowed'));
        }

        try {
            const buffer = await data.toBuffer();
            const content = buffer.toString('utf-8');
            const lines = content.split(/\r?\n/);
            
            if (lines.length < 2) return reply.status(400).send(createErrorResponse('CSV file is empty or missing data'));

            const headers = lines[0].split(',').map((h: string) => h.trim().toLowerCase());
            const skuIdx = headers.indexOf('sku');
            const qtyIdx = headers.indexOf('quantity');
            const poIdx = headers.indexOf('po number');
            const notesIdx = headers.indexOf('notes');

            if (skuIdx === -1 || qtyIdx === -1) {
                return reply.status(400).send(createErrorResponse('CSV must contain "SKU" and "Quantity" columns'));
            }

            const rawItems = lines.slice(1)
                .map((line: string) => {
                    const cells = parseCsvLine(line);
                    if (cells.length < 2) return null;
                    return {
                        sku: cells[skuIdx]?.trim(),
                        quantity: parseInt(cells[qtyIdx]?.trim() || '0'),
                        poNumber: poIdx !== -1 ? cells[poIdx]?.trim() : '',
                        notes: notesIdx !== -1 ? cells[notesIdx]?.trim() : ''
                    };
                })
                .filter((item: any) => item && item.sku);

            if (rawItems.length === 0) return reply.status(400).send(createErrorResponse('No valid data rows found in CSV'));

            // De-duplicate: Sum quantities for same SKU
            const mergedMap = new Map<string, any>();
            rawItems.forEach((item: any) => {
                if (mergedMap.has(item.sku)) {
                    mergedMap.get(item.sku).quantity += item.quantity;
                } else {
                    mergedMap.set(item.sku, { ...item });
                }
            });

            const uniqueSkus = Array.from(mergedMap.keys());
            const products = await fastify.prisma.product.findMany({
                where: { sku: { in: uniqueSkus }, isActive: true, deletedAt: null },
                include: { prices: { where: { isActive: true } } }
            });

            const productMap = new Map(products.map(p => [p.sku, p]));
            const results = Array.from(mergedMap.values()).map(item => {
                const product = productMap.get(item.sku);
                let status = 'VALID';
                let error = null;
                let productData = null;

                if (!product) {
                    status = 'ERROR';
                    error = 'Product not found';
                } else if (isNaN(item.quantity) || item.quantity <= 0) {
                    status = 'ERROR';
                    error = 'Invalid quantity';
                } else {
                    // Pricing Logic: Use Wholesale for B2B if available
                    const isB2B = request.user?.role?.name === 'BUSINESS';
                    const priceObj = product.prices?.[0]; // Simplified for now, should match currency
                    const unitPrice = isB2B ? (priceObj?.priceWholesale || priceObj?.priceRetail || 0) : (priceObj?.priceRetail || 0);
                    
                    productData = {
                        id: product.id,
                        name: product.name,
                        imageUrl: product.imageUrl,
                        unitPrice: Number(unitPrice),
                        currency: 'PKR', // Default for Paperland
                        lineTotal: Number(unitPrice) * item.quantity
                    };
                }

                return {
                    ...item,
                    status,
                    error,
                    product: productData
                };
            });

            return createResponse({
                summary: {
                    totalRows: results.length,
                    validRows: results.filter(r => r.status === 'VALID').length,
                    errorRows: results.filter(r => r.status === 'ERROR').length,
                    grandTotal: results.reduce((acc, r) => acc + (r.product?.lineTotal || 0), 0)
                },
                items: results
            }, 'CSV validated successfully');

        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Server error during CSV processing'));
        }
    });

    // 3. POST /b2b/bulk-order/submit - Convert validated items to cart
    fastify.post('/b2b/bulk-order/submit', {
        schema: {
            description: 'Submit validated bulk order items to the shopping cart',
            tags: ['B2B Bulk Order'],
            body: {
                type: 'object',
                required: ['items'],
                properties: {
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['productId', 'quantity'],
                            properties: {
                                productId: { type: 'string' },
                                quantity: { type: 'integer', minimum: 1 }
                            }
                        }
                    },
                    clearCart: { type: 'boolean', default: false }
                }
            }
        }
    }, async (request: any, reply) => {
        const { items, clearCart } = request.body;
        const userId = request.user?.id;

        if (!userId) return reply.status(401).send(createErrorResponse('Authentication required'));

        try {
            await fastify.prisma.$transaction(async (tx) => {
                // 1. Find or Create Cart
                let cart = await tx.cart.findFirst({
                    where: { userId, status: 'ACTIVE' }
                });

                if (!cart) {
                    cart = await tx.cart.create({
                        data: { userId, status: 'ACTIVE' }
                    });
                } else if (clearCart) {
                    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
                }

                // 2. Add Items
                for (const item of items) {
                    const existing = await tx.cartItem.findFirst({
                        where: { cartId: cart.id, productId: item.productId }
                    });

                    if (existing) {
                        await tx.cartItem.update({
                            where: { id: existing.id },
                            data: { quantity: existing.quantity + item.quantity }
                        });
                    } else {
                        // Fetch price for snapshot
                        const product = await tx.product.findUnique({
                            where: { id: item.productId },
                            include: { prices: { where: { isActive: true }, take: 1 } }
                        });
                        
                        const isB2B = request.user?.role?.name === 'BUSINESS';
                        const priceObj = product?.prices?.[0];
                        const unitPrice = isB2B ? (priceObj?.priceWholesale || priceObj?.priceRetail || 0) : (priceObj?.priceRetail || 0);

                        await tx.cartItem.create({
                            data: {
                                cartId: cart.id,
                                productId: item.productId,
                                quantity: item.quantity,
                                priceSnapshot: Number(unitPrice)
                            }
                        });
                    }
                }
            }, { timeout: 30000 });

            return createResponse(null, 'Items added to cart successfully');
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse(err.message));
        }
    });

    // Helper: Simple CSV line parser that handles quoted cells
    function parseCsvLine(line: string): string[] {
        const result: string[] = [];
        let curCell = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(curCell);
                curCell = '';
            } else {
                curCell += char;
            }
        }
        result.push(curCell);
        return result;
    }
}
