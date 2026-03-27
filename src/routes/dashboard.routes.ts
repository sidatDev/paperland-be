
import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';


export default async function dashboardRoutes(fastify: FastifyInstance) {
  
  const getDateFilter = (query: any) => {
    const { startDate, endDate, month, quarter } = query;
    const filter: any = {};

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.gte = new Date(startDate);
      if (endDate) filter.createdAt.lte = new Date(endDate);
    } else if (month) {
      const year = new Date().getFullYear();
      const monthIdx = parseInt(month);
      const start = new Date(year, monthIdx, 1);
      const end = new Date(year, monthIdx + 1, 0, 23, 59, 59);
      filter.createdAt = { gte: start, lte: end };
    } else if (quarter) {
      const year = new Date().getFullYear();
      const q = parseInt(quarter); // 1, 2, 3, 4
      const start = new Date(year, (q - 1) * 3, 1);
      const end = new Date(year, q * 3, 0, 23, 59, 59);
      filter.createdAt = { gte: start, lte: end };
    }

    return filter;
  };

  // GET /admin/dashboard/kpi
  fastify.get('/admin/dashboard/kpi', {
    schema: {
      description: 'Get Dashboard KPI Metrics (Real Data)',
      tags: ['Dashboard'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                revenue: {
                  type: 'object',
                  properties: {
                    value: { type: 'string' },
                    growth: { type: 'string' }
                  }
                },
                orders: {
                  type: 'object',
                  properties: {
                    value: { type: 'string' }, // Changed to string or number depending on backend. createResponse sends value: totalOrders which is int. 
                    // Actually, schema said string. Backend sends number for orders.
                    // It's safer to handle both or relax it.
                    // Let's check backend implementation:
                    // revenue: totalRevenue._sum.totalAmount || 0 (Decimal -> likely number or object?)
                    // orders: totalOrders (number or BigInt?)
                    // Prisma aggregate returns?
                    growth: { type: 'string' }
                  }
                },
                activeCustomers: {
                  type: 'object',
                  properties: {
                    value: { type: 'string' },
                    growth: { type: 'string' }
                  }
                },
                deliveredRate: {
                  type: 'object',
                  properties: {
                    value: { type: 'string' },
                    growth: { type: 'string' }
                  }
                },
                deliveredCount: { type: 'integer' },
                returnRate: {
                  type: 'object',
                  properties: {
                    value: { type: 'string' },
                    growth: { type: 'string' }
                  }
                }
              }
            }
          }
        },

        500: {
          type: 'object',
          properties: {
             message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const prisma = (fastify.prisma as any);

      const dateFilter = getDateFilter(request.query);

      // 1. Revenue
      const totalRevenue = await prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { 
          status: { not: 'CANCELLED' },
          ...dateFilter
        }
      });

      // 2. Orders
      const totalOrders = await prisma.order.count({
        where: dateFilter
      });

      // 3. Active Customers (Users excluding admins)
      // Assuming role names SUPER_ADMIN, REGIONAL_ADMIN are strictly for internal staff
      const userCount = await prisma.user.count({
        where: { role: { name: { notIn: ['SUPER_ADMIN', 'REGIONAL_ADMIN'] } } }
      });

      // 4. Delivered Rate & Count
      const deliveredOrders = await prisma.order.count({ where: { status: 'DELIVERED' } });
      const deliveredRate = totalOrders > 0 ? ((deliveredOrders / totalOrders) * 100).toFixed(1) : "0.0";

      // 5. Return Rate (Returned or Refunded)
      const returnedOrders = await prisma.order.count({ 
        where: { status: { in: ['RETURN_REQUESTED', 'REFUNDED', 'RETURN_PROCESSING'] } } 
      });
      const returnRate = totalOrders > 0 ? ((returnedOrders / totalOrders) * 100).toFixed(1) : "0.0";

      return createResponse({
        revenue: {
          value: totalRevenue._sum.totalAmount || 0, // Sending raw number, frontend formats currency
          growth: "+0.0%" 
        },
        orders: {
          value: totalOrders, // Sending raw number
          growth: "+0.0%"
        },
        activeCustomers: {
          value: userCount,
          growth: "+0.0%"
        },
        deliveredRate: {
          value: deliveredRate, // Sending raw number/string
          growth: "+0.0%"
        },
        deliveredCount: deliveredOrders,
        returnRate: {
          value: returnRate,
          growth: "+0.0%"
        }
      }, "KPIs Retrieved");

    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Internal Server Error'));
    }
  });

  // GET /admin/dashboard/sales-trends
  fastify.get('/admin/dashboard/sales-trends', {
    schema: {
        description: 'Get Sales Trends (Real Data) - Weekly or Yearly',
        tags: ['Dashboard'],
        querystring: {
          type: 'object',
          properties: {
            period: { type: 'string', enum: ['weekly', 'yearly'], default: 'yearly' }
          }
        }
    }
  }, async (request: any, reply) => {
    try {
        const prisma = (fastify.prisma as any);
        const { period = 'yearly', startDate: qStart, endDate: qEnd } = request.query;
        const dateFilter = getDateFilter(request.query);
        
        if (period === 'weekly' || (qStart && qEnd)) {
          // If a custom range is provided or weekly is requested
          const endDate = qEnd ? new Date(qEnd) : new Date();
          const startDate = qStart ? new Date(qStart) : new Date();
          if (!qStart) startDate.setDate(endDate.getDate() - 6); 
          startDate.setHours(0,0,0,0);

          const orders = await prisma.order.findMany({
            where: {
              createdAt: { gte: startDate, lte: endDate },
              status: { not: 'CANCELLED' }
            },
            include: { currency: true, address: { include: { country: true } } }
          });

          // Generate date buckets
          const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          const result = [];
          
          for (let d = 0; d < diffDays; d++) {
             const date = new Date(startDate);
             date.setDate(date.getDate() + d);
             const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
             
             const dayOrders = orders.filter((o: any) => {
               const oDate = new Date(o.createdAt);
               return oDate.toDateString() === date.toDateString();
             });

             let revenue = 0;
             let KSA = 0, UAE = 0, PK = 0;

             dayOrders.forEach((o: any) => {
               const amt = Number(o.totalAmount);
               revenue += amt;
               
               const country = o.address?.country?.name?.toLowerCase() || '';
               const currency = o.currency?.code;

               if (country.includes('pakistan') || currency === 'PKR') PK += amt;
               else if (country.includes('uae') || country.includes('emirates') || currency === 'AED') UAE += amt;
               else KSA += amt; // Default (Other/Legacy)
             });

             result.push({
               name: label,
               revenue,
               KSA,
               UAE,
               PK,
               date: date.toISOString()
             });
          }
          
          return createResponse(result, "Sales Trends Retrieved");

        } else {
          // Yearly or specific Month/Quarter
          const currentYear = new Date().getFullYear();
          const orders = await prisma.order.findMany({
              where: {
                  status: { not: 'CANCELLED' },
                  ...dateFilter
              },
              select: { createdAt: true, totalAmount: true }
          });

          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const trends = months.map((month, index) => {
              const monthlyOrders = orders.filter((o: any) => o.createdAt.getMonth() === index);
              const revenue = monthlyOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount), 0);
              return {
                  month,
                  revenue,
                  orders: monthlyOrders.length
              };
          });
          return createResponse(trends, "Sales Trends Retrieved");
        }
    } catch (err: any) {
        return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // GET /admin/dashboard/regional-sales
  fastify.get('/admin/dashboard/regional-sales', {
      schema: { description: 'Get Sales by Region', tags: ['Dashboard'] }
  }, async (request, reply) => {
      try {
          const prisma = (fastify.prisma as any);
          const dateFilter = getDateFilter(request.query);
          
          // Using Order -> Address -> Country relation
          const orders = await prisma.order.findMany({
              where: { 
                status: { not: 'CANCELLED' },
                ...dateFilter
              },
              include: { 
                  address: {
                      include: { country: true }
                  }
              }
          });

          const regionMap: Record<string, number> = {};
          
          orders.forEach((order: any) => {
              const countryName = order.address?.country?.name || 'Unknown';
              const amount = Number(order.totalAmount);
              regionMap[countryName] = (regionMap[countryName] || 0) + amount;
          });

          const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
          
          // Transform to array
          const result = Object.entries(regionMap).map(([name, value], index) => ({
              name, 
              value,
              color: colors[index % colors.length]
          })).sort((a, b) => b.value - a.value).slice(0, 5); // Top 5

          return createResponse(result, "Regional Sales Retrieved");
      } catch (err: any) {
          return reply.status(500).send(createErrorResponse(err.message));
      }
  });

  // GET /admin/dashboard/today-regional-sales
  fastify.get('/admin/dashboard/today-regional-sales', {
      schema: { description: 'Get Today Orders by Region', tags: ['Dashboard'] }
  }, async (request, reply) => {
      try {
          const prisma = (fastify.prisma as any);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const orders = await prisma.order.findMany({
              where: { 
                  status: { not: 'CANCELLED' },
                  createdAt: { gte: today }
              },
              include: { 
                  address: { include: { country: true } },
                  currency: true
              }
          });

          // --- NEW: City Breakdown grouping ---
          const cityMap: Record<string, number> = {};
          orders.forEach((order: any) => {
              const city = order.address?.city || 'Unknown';
              cityMap[city] = (cityMap[city] || 0) + 1;
          });

          const cityResult = Object.entries(cityMap).map(([city, count]) => ({
              city, 
              count,
              color: 'bg-indigo-500' // Consistent color for cities
          })).sort((a: any, b: any) => b.count - a.count).slice(0, 8);
          // ------------------------------------

          return createResponse(cityResult, "Today City Orders Retrieved");
      } catch (err: any) {
          return reply.status(500).send(createErrorResponse(err.message));
      }
  });

  // GET /admin/dashboard/category-breakdown
  fastify.get('/admin/dashboard/category-breakdown', {
      schema: { description: 'Get Sales/Product distribution by Category', tags: ['Dashboard'] }
  }, async (request: any, reply) => {
      try {
          const prisma = (fastify.prisma as any);
          const dateFilter = getDateFilter(request.query);

          // If date filters are active, we show SALES by category
          // If not, we show PRODUCT COUNT by category (inventory distribution)
          const isFilterActive = Object.keys(dateFilter).length > 0;

          if (isFilterActive) {
            // Get all order items within the date range
            const orderItems = await prisma.orderItem.findMany({
              where: {
                order: {
                  status: { not: 'CANCELLED' },
                  ...dateFilter
                }
              },
              include: {
                product: {
                  include: {
                    category: {
                      where: { isActive: true, deletedAt: null },
                      include: { parent: true }
                    }
                  }
                }
              }
            });

            const categoryRevenue: Record<string, number> = {};

            orderItems.forEach((item: any) => {
              if (!item.product?.category) return;
              
              // Rollup to parent category if it exists
              const category = item.product.category;
              const parentCategory = category.parent || category;
              const categoryName = parentCategory.name;
              
              const amount = Number(item.price) * item.quantity;
              categoryRevenue[categoryName] = (categoryRevenue[categoryName] || 0) + amount;
            });

            const result = Object.entries(categoryRevenue).map(([name, value]) => ({
              name,
              value,
              color: "#10b981"
            })).sort((a: any, b: any) => b.value - a.value);

            return createResponse(result, "Category Sales Breakdown Retrieved");

          } else {
            // Original logic: Product distribution
            const categories = await prisma.category.findMany({
                where: { 
                  parentId: null,
                  isActive: true,
                  deletedAt: null 
                }, // Only show active parent categories
                include: { _count: { select: { products: true } } }
            });

            const result = categories.map((c: any) => ({
                name: c.name,
                value: c._count.products,
                color: "#10b981" 
            })).sort((a: any, b: any) => b.value - a.value);

            return createResponse(result, "Category Product Distribution Retrieved");
          }

      } catch (err: any) {
          return reply.status(500).send(createErrorResponse(err.message));
      }
  });
  
  // GET /admin/dashboard/inventory-snapshot
  fastify.get('/admin/dashboard/inventory-snapshot', {
      schema: { description: 'Get Inventory Overview', tags: ['Dashboard'] }
  }, async (request, reply) => {
      try {
          // Mocking or simple count
          const prisma = (fastify.prisma as any);
          const totalProducts = await prisma.product.count({ where: { deletedAt: null } });
          
          // Calculate low stock where qty <= reorderLevel
          // Using raw query for field-to-field comparison in inventory snapshot
          const lowStockResult = await prisma.$queryRaw`SELECT COUNT(*) as count FROM stocks WHERE qty <= reorder_level`;
          const lowStock = Number(lowStockResult[0]?.count || 0);

          const status = lowStock > 0 ? "Warning" : "Healthy";
          
           return createResponse({
               totalProducts,
               lowStock,
               status
           }, "Inventory Snapshot Retrieved");
      } catch (err: any) {
           return reply.status(500).send(createErrorResponse(err.message));
      }
  });

  // GET /admin/dashboard/fulfillment-status
  fastify.get('/admin/dashboard/fulfillment-status', {
      schema: { description: 'Get Order Status Distribution', tags: ['Dashboard'] }
  }, async (request: any, reply) => {
      try {
          const prisma = (fastify.prisma as any);
          const dateFilter = getDateFilter(request.query);
          
          const statusCounts = await prisma.order.groupBy({
              by: ['status'],
              where: dateFilter,
              _count: { status: true }
          });

          // Map Prisma status to frontend friendly names/colors
          const statusMap: Record<string, { name: string, color: string }> = {
              'PENDING': { name: 'New Order', color: '#cbd5e1' }, // Slate 300
              'PROCESSING': { name: 'Processing', color: '#f59e0b' }, // Amber 500
              'SHIPPED': { name: 'Shipped', color: '#0ea5e9' }, // Sky 500
              'DELIVERED': { name: 'Completed', color: '#10b981' }, // Emerald 500
              'CANCELLED': { name: 'Cancelled', color: '#ef4444' }, // Red 500
              'RETURN_REQUESTED': { name: 'Return Requested', color: '#f43f5e' },
              'REFUNDED': { name: 'Refunded', color: '#881337' }
          };

          const result = statusCounts.map((item: any) => {
              const meta = statusMap[item.status] || { name: item.status, color: '#94a3b8' };
              return {
                  name: meta.name,
                  value: item._count.status,
                  color: meta.color,
                  rawStatus: item.status
              };
          }).sort((a: any, b: any) => b.value - a.value);

          return createResponse(result, "Fulfillment Status Retrieved");
      } catch (err: any) {
          return reply.status(500).send(createErrorResponse(err.message));
      }
  });

  // GET /admin/dashboard/alerts — System alerts
  fastify.get('/admin/dashboard/alerts', {
    schema: {
      description: 'Get system alerts for dashboard',
      tags: ['Dashboard'],
    },
  }, async (request: any, reply) => {
    try {
      const prisma = (fastify.prisma as any);

      // 1. Low Stock Products (stock quantity <= 10)
      const lowStockProducts = await prisma.stock.findMany({
        where: { qty: { lte: 10 } },
        include: { product: { select: { id: true, name: true, sku: true } } },
        take: 10,
        orderBy: { qty: 'asc' },
      });

      // 2. Pending B2B Approvals
      const pendingB2B = await prisma.user.count({
        where: { accountStatus: { in: ['PENDING', 'PENDING_DOCS', 'IN_REVIEW'] } },
      });

      // 3. New Orders Today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const newOrdersToday = await prisma.order.count({
        where: { createdAt: { gte: today } },
      });

      // 4. Pending Orders
      const pendingOrders = await prisma.order.count({
        where: { status: 'PENDING' },
      });

      return createResponse({
        lowStock: {
          count: lowStockProducts.length,
          items: lowStockProducts.map((s: any) => ({
            productId: s.product?.id,
            productName: s.product?.name,
            sku: s.product?.sku,
            quantity: s.qty,
          })),
        },
        pendingB2B,
        newOrdersToday,
        pendingOrders,
      }, 'Alerts Retrieved');
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // GET /admin/dashboard/activity — Recent activity feed
  fastify.get('/admin/dashboard/activity', {
    schema: {
      description: 'Get recent activity from audit logs',
      tags: ['Dashboard'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 20 },
        },
      },
    },
  }, async (request: any, reply) => {
    try {
      const prisma = (fastify.prisma as any);
      const { limit = 20 } = request.query;

      const activities = await prisma.auditLog.findMany({
        where: {
          performer: {
            role: {
              name: { in: ['SUPER_ADMIN', 'REGIONAL_ADMIN', 'ADMIN'] }
            }
          }
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          performer: { 
            select: { 
               id: true, 
               firstName: true, 
               lastName: true, 
               email: true,
               role: { select: { name: true } }
            } 
          },
        },
      });

      return createResponse(activities, 'Activity Feed Retrieved');
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

}
