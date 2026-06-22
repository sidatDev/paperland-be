import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { stringify } from 'csv-stringify';

export default async function financeRoutes(fastify: FastifyInstance) {
  // GET /admin/finance/sales/export (CSV Export)
  fastify.get('/admin/finance/sales/export', {
    preHandler: [fastify.authenticate, fastify.hasPermission('finance_view')],
    schema: {
      description: 'Export Order Profitability Report as CSV',
      tags: ['Finance'],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' }
        }
      }
    }
  }, async (request: any, reply) => {
    try {
      const { startDate, endDate } = request.query;
      const prisma = fastify.prisma as any;

      const where: any = {
        status: { not: 'DRAFT' }
      };

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      }

      const orders = await prisma.order.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' }
      });

      const csvData = orders.map((o: any) => {
        const revenue = Number(o.totalAmount);
        const tax = Number(o.taxAmount);
        const purchaseCost = Number(o.totalCost || 0);
        const expenses = Number(o.totalExpenses || 0);
        
        const grossProfit = (revenue - tax) - purchaseCost;
        const finalProfit = grossProfit - expenses;

        return {
          'Order Number': o.orderNumber,
          'Customer': o.user ? `${o.user.firstName} ${o.user.lastName}` : (o.billingSnapshot?.name || 'Guest'),
          'Date': o.createdAt.toISOString().split('T')[0],
          'Revenue': revenue.toFixed(2),
          'Cost (COGS)': purchaseCost.toFixed(2),
          'Tax': tax.toFixed(2),
          'Expenses': expenses.toFixed(2),
          'Net Profit': finalProfit.toFixed(2),
          'Status': o.status
        };
      });

      const fileName = `sales-profitability-${new Date().toISOString().split('T')[0]}`;
      
      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename=${fileName}.csv`);

      // Add BOM for Excel UTF-8 support
      const BOM = '\uFEFF';
      
      const csvString = await new Promise<string>((resolve, reject) => {
        stringify(csvData, { header: true }, (err, output) => {
          if (err) reject(err);
          else resolve(output);
        });
      });

      return reply.send(BOM + csvString);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // GET /admin/finance/sales (Finance Summary)
  fastify.get('/admin/finance/sales', {
    preHandler: [fastify.authenticate, fastify.hasPermission('finance_view')],
    schema: {
      description: 'Get Order Profitability Summary for Admin Finance Dashboard',
      tags: ['Finance'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' }
        }
      }
    }
  }, async (request: any, reply) => {
    try {
      const { page = 1, limit = 10, startDate, endDate } = request.query;
      console.log(`[Finance API] Fetching sales: page=${page}, limit=${limit}`);
      const skip = (Number(page) - 1) * Number(limit);
      const prisma = fastify.prisma as any;

      const where: any = {
        status: { not: 'DRAFT' } // Only real orders
      };

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      }

      const [orders, total, totals] = await Promise.all([
        prisma.order.findMany({
          where,
          include: { user: true },
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' }
        }),
        prisma.order.count({ where }),
        prisma.order.aggregate({
          where,
          _sum: {
            totalAmount: true,
            taxAmount: true,
            totalCost: true,
            totalExpenses: true
          },
          _count: {
             id: true
          }
        })
      ]);

      console.log(`[Finance API] Found ${orders.length} orders. Total in DB: ${total}`);

      const data = orders.map((o: any) => {
        const revenue = Number(o.totalAmount);
        const tax = Number(o.taxAmount);
        const purchaseCost = Number(o.totalCost || 0);
        const expenses = Number(o.totalExpenses || 0);
        
        // Final Profit = (Revenue - Tax) - Purchase Cost - Expenses
        const grossProfit = (revenue - tax) - purchaseCost;
        const finalProfit = grossProfit - expenses;

        return {
          id: o.id,
          orderNumber: o.orderNumber,
          customer: o.user ? `${o.user.firstName} ${o.user.lastName}` : (o.billingSnapshot?.name || 'Guest'),
          revenue,
          tax,
          cost: purchaseCost,
          expenses,
          profit: finalProfit,
          status: o.status,
          createdAt: o.createdAt
        };
      });

      const totalRevenue = Number(totals._sum.totalAmount || 0);
      const totalTax = Number(totals._sum.taxAmount || 0);
      const totalCost = Number(totals._sum.totalCost || 0);
      const totalExpenses = Number(totals._sum.totalExpenses || 0);
      const totalProfit = (totalRevenue - totalTax) - totalCost - totalExpenses;

      return createResponse(data, "Finance Summary Retrieved", {
        page,
        limit,
        total,
        summary: {
          totalOrders: totals._count.id,
          totalRevenue,
          totalTax,
          totalCost,
          totalExpenses,
          totalProfit
        }
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // GET /admin/finance/sales/:id (Detail Profit Breakdown)
  fastify.get('/admin/finance/sales/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('finance_view')],
    schema: {
        description: 'Get Detailed Financial Summary for a specific order',
        tags: ['Finance'],
        params: {
            type: 'object',
            properties: {
                id: { type: 'string' }
            }
        }
    }
  }, async (request: any, reply) => {
      const { id } = request.params;
      try {
          const prisma = fastify.prisma as any;
          const order = await prisma.order.findUnique({
              where: { id },
              include: { 
                  items: { include: { product: true } },
                  user: true,
                  currency: true
              }
          });

          if (!order) return reply.status(404).send(createErrorResponse("Order Not Found"));

          const revenue = Number(order.totalAmount);
          const tax = Number(order.taxAmount);
          const cost = Number(order.totalCost || 0);
          const expenses = Number(order.totalExpenses || 0);
          
          const pricing = (order.pricingSummary as any) || {};
          const subtotal = Number(pricing.subtotal || 0);
          const discount = Number(pricing.couponDiscount || 0);
          const shipping = Number(pricing.shippingCost || 0);

          const grossProfit = subtotal - cost;
          const finalProfit = (subtotal - discount - tax) - cost - expenses;

          return createResponse({
              orderId: order.id,
              orderNumber: order.orderNumber,
              createdAt: order.createdAt,
              status: order.status,
              financialSummary: {
                  sellingPrice: subtotal,
                  discount,
                  tax,
                  shippingCost: shipping,
                  purchasePrice: cost,
                  grossProfit,
                  expenses,
                  finalProfit,
                  totalRevenue: revenue,
                  currency: order.currency?.code || 'PKR'
              },
              items: order.items.map((item: any) => ({
                  productId: item.productId,
                  name: item.product?.name || 'Unknown',
                  sku: item.sku,
                  quantity: item.quantity,
                  unitPrice: Number(item.price),
                  unitCost: Number(item.unitCost || 0),
                  lineTotal: Number(item.price) * item.quantity,
                  lineCost: Number(item.unitCost || 0) * item.quantity,
                  lineProfit: (Number(item.price) * item.quantity) - (Number(item.unitCost || 0) * item.quantity)
              }))
          }, "Order Financial Breakdown Retrieved");
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse(err.message));
      }
  });

  // GET /admin/finance/price-logs
  fastify.get('/admin/finance/price-logs', {
    preHandler: [fastify.authenticate, fastify.hasPermission('finance_view')],
    schema: {
        description: 'Get Product Price Change Logs',
        tags: ['Finance'],
        querystring: {
            type: 'object',
            properties: {
                page: { type: 'integer', default: 1 },
                limit: { type: 'integer', default: 10 },
                search: { type: 'string' },
                startDate: { type: 'string', format: 'date' },
                endDate: { type: 'string', format: 'date' }
            }
        }
    }
  }, async (request: any, reply) => {
      try {
          const { page = 1, limit = 10, search, startDate, endDate } = request.query;
          const skip = (Number(page) - 1) * Number(limit);
          const prisma = fastify.prisma as any;

          const where: any = {};

          if (search) {
              where.OR = [
                  { sku: { contains: search, mode: 'insensitive' } },
                  { productName: { contains: search, mode: 'insensitive' } },
                  { userName: { contains: search, mode: 'insensitive' } }
              ];
          }

          if (startDate || endDate) {
              where.createdAt = {};
              if (startDate) where.createdAt.gte = new Date(startDate);
              if (endDate) where.createdAt.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
          }

          const [logs, total] = await Promise.all([
              prisma.priceUpdateLog.findMany({
                  where,
                  skip,
                  take: Number(limit),
                  orderBy: { createdAt: 'desc' }
              }),
              prisma.priceUpdateLog.count({ where })
          ]);

          return createResponse(logs, "Price logs retrieved", {
              total,
              page: Number(page),
              limit: Number(limit)
          });
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse(err.message));
      }
  });
}
