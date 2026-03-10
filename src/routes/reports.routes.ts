import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';

export default async function reportsRoutes(fastify: FastifyInstance) {
    
    // Helper to calculate percentage change
    const calculateChange = (current: number, previous: number): number => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    };

    // Helper to get date range based on timeline
    const getDateRange = (timeline: string, customStart?: string, customEnd?: string) => {
        const now = new Date();
        let startDate = new Date();
        let endDate = now;

        if (timeline === 'custom' && customStart && customEnd) {
            return { startDate: new Date(customStart), endDate: new Date(customEnd) };
        }

        switch (timeline) {
            case 'daily':
                startDate.setDate(now.getDate() - 1);
                break;
            case 'weekly':
                startDate.setDate(now.getDate() - 7);
                break;
            case 'monthly':
                startDate.setMonth(now.getMonth() - 1);
                break;
            case 'quarterly':
                startDate.setMonth(now.getMonth() - 3);
                break;
            case 'yearly':
                startDate.setFullYear(now.getFullYear() - 1);
                break;
            case 'all':
                startDate = new Date('2000-01-01');
                break;
            default:
                startDate.setMonth(now.getMonth() - 1); // Default to monthly
        }

        return { startDate, endDate };
    };

    // GET /admin/reports/kpis - Dashboard KPIs
    fastify.get('/admin/reports/kpis', {
        schema: { description: 'Get dashboard KPIs', tags: ['Reports'] }
    }, async (request: any, reply) => {
            const { timeline = 'monthly', startDate: customStart, endDate: customEnd } = request.query;
            const { startDate, endDate } = getDateRange(timeline, customStart, customEnd);
            
            fastify.log.info({ msg: 'Fetching KPIs', timeline, startDate, endDate });

            // Calculate previous period
            const timeDiff = endDate.getTime() - startDate.getTime();
            const prevStartDate = new Date(startDate.getTime() - timeDiff);
            const prevEndDate = startDate;

            const getStats = async (start: Date, end: Date) => {
                const revenueResult = await (fastify.prisma as any).order.aggregate({
                    _sum: { totalAmount: true },
                    where: {
                        createdAt: { gte: start, lte: end },
                        status: { in: ['DELIVERED', 'COMPLETED', 'SHIPPED', 'PROCESSING', 'PENDING', 'RETURN_REQUESTED', 'RETURNED', 'CANCELLED'] }
                    }
                });

                const totalOrders = await (fastify.prisma as any).order.count({
                    where: { 
                        createdAt: { gte: start, lte: end },
                        status: { in: ['DELIVERED', 'COMPLETED', 'SHIPPED', 'PROCESSING', 'PENDING', 'RETURN_REQUESTED', 'RETURNED', 'CANCELLED'] }
                    }
                });

                const b2bCustomers = await (fastify.prisma as any).user.count({
                    where: {
                        b2bProfileId: { not: null },
                        createdAt: { gte: start, lte: end }
                    }
                });

                const b2cCustomers = await (fastify.prisma as any).user.count({
                    where: {
                        b2bProfileId: null,
                        createdAt: { gte: start, lte: end }
                    }
                });

                return {
                    revenue: Number(revenueResult._sum.totalAmount || 0),
                    orders: totalOrders,
                    b2b: b2bCustomers,
                    b2c: b2cCustomers
                };
            };

            try {
                const current = await getStats(startDate, endDate);
                const previous = await getStats(prevStartDate, prevEndDate);

                return createResponse({
                    current: {
                        totalRevenue: current.revenue,
                        totalOrders: current.orders,
                        b2bCustomers: current.b2b,
                        b2cCustomers: current.b2c
                    },
                    previous: {
                        totalRevenue: previous.revenue,
                        totalOrders: previous.orders,
                        b2bCustomers: previous.b2b,
                        b2cCustomers: previous.b2c
                    },
                    changes: {
                        revenue: calculateChange(current.revenue, previous.revenue),
                        orders: calculateChange(current.orders, previous.orders),
                        b2b: calculateChange(current.b2b, previous.b2b),
                        b2c: calculateChange(current.b2c, previous.b2c)
                    },
                    period: { startDate, endDate }
                }, 'KPIs retrieved successfully');
            } catch (err) {
                fastify.log.error(err);
                return reply.status(500).send(createErrorResponse('Failed to fetch KPIs'));
            }
    });

    // GET /admin/reports/sales-trend - Sales trend with comparison
    fastify.get('/admin/reports/sales-trend', {
        schema: { description: 'Get sales trend with comparison', tags: ['Reports'] }
    }, async (request: any, reply) => {
        try {
            const { timeline = 'monthly', startDate: customStart, endDate: customEnd } = request.query;
            const { startDate, endDate } = getDateRange(timeline, customStart, customEnd);

            // Calculate previous period
            const timeDiff = endDate.getTime() - startDate.getTime();
            const prevStartDate = new Date(startDate.getTime() - timeDiff);
            const prevEndDate = startDate;

            // Current period sales (daily trend)
            const currentSales: any[] = await (fastify.prisma as any).$queryRaw`
                SELECT 
                    DATE_TRUNC('day', created_at) as "date",
                    SUM(total_amount)::float as "revenue",
                    COUNT(*)::int as "count"
                FROM orders
                WHERE status IN ('DELIVERED', 'COMPLETED', 'SHIPPED', 'PROCESSING', 'PENDING', 'RETURN_REQUESTED', 'RETURNED', 'CANCELLED')
                AND created_at >= ${startDate} AND created_at <= ${endDate}
                GROUP BY 1
                ORDER BY 1 ASC
            `;

            // Previous period sales
            const previousSales = await (fastify.prisma as any).order.aggregate({
                _sum: { totalAmount: true },
                where: {
                    createdAt: { gte: prevStartDate, lte: prevEndDate },
                    status: { in: ['DELIVERED', 'COMPLETED', 'SHIPPED', 'PROCESSING', 'PENDING', 'RETURN_REQUESTED', 'RETURNED', 'CANCELLED'] }
                }
            });

            const currentTotal = currentSales.reduce((sum: number, item: any) => sum + Number(item.revenue || 0), 0);
            const previousTotal = Number(previousSales._sum?.totalAmount || 0);
            const changePercent = calculateChange(currentTotal, previousTotal);

            return createResponse({
                timeline,
                currentPeriod: { startDate, endDate, total: currentTotal },
                previousPeriod: { startDate: prevStartDate, endDate: prevEndDate, total: previousTotal },
                changePercent,
                trend: currentSales
            }, 'Sales trend retrieved successfully');

        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Failed to fetch sales trend'));
        }
    });

    // GET /admin/reports/customer-acquisition - Customer acquisition trend
    fastify.get('/admin/reports/customer-acquisition', {
        schema: { description: 'Get customer acquisition trend', tags: ['Reports'] }
    }, async (request: any, reply) => {
        try {
            const { timeline = 'monthly', startDate: customStart, endDate: customEnd } = request.query;
            const { startDate, endDate } = getDateRange(timeline, customStart, customEnd);

            // Current period registrations (daily trend)
            const customersByDate = await (fastify.prisma as any).$queryRaw`
                SELECT DATE_TRUNC('day', created_at) as "date", COUNT(*)::int as "count"
                FROM users
                WHERE created_at >= ${startDate} AND created_at <= ${endDate}
                GROUP BY 1
                ORDER BY 1 ASC
            `;

            // Previous period registrations for comparison
            const timeDiff = endDate.getTime() - startDate.getTime();
            const prevStartDate = new Date(startDate.getTime() - timeDiff);
            const prevEndDate = startDate;

            const currentCount = await (fastify.prisma as any).user.count({
                where: { createdAt: { gte: startDate, lte: endDate } }
            });

            const previousCount = await (fastify.prisma as any).user.count({
                where: { createdAt: { gte: prevStartDate, lte: prevEndDate } }
            });

            const changePercent = calculateChange(currentCount, previousCount);

            return createResponse({
                timeline,
                currentPeriod: { startDate, endDate, total: currentCount },
                previousPeriod: { startDate: prevStartDate, endDate: prevEndDate, total: previousCount },
                changePercent,
                data: customersByDate
            }, 'Customer acquisition trend retrieved');

        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Failed to fetch customer acquisition'));
        }
    });

    // GET /admin/reports/customer-stats - Customer statistics
    fastify.get('/admin/reports/customer-stats', {
        schema: { description: 'Get customer statistics', tags: ['Reports'] }
    }, async (request: any, reply) => {
        try {
            const [totalCustomers, totalOrders] = await Promise.all([
                (fastify.prisma as any).user.count(),
                (fastify.prisma as any).order.count()
            ]);

            const avgOrderPerCustomer = totalCustomers > 0 ? (totalOrders / totalCustomers) : 0;

            // JOIN with address and country to get actual country names
            const countryStats: any[] = await (fastify.prisma as any).$queryRaw`
                SELECT c.name as "country", COUNT(DISTINCT o.user_id)::int as "count"
                FROM orders o
                JOIN addresses a ON o.address_id = a.id
                JOIN countries c ON a.country_id = c.id
                GROUP BY 1
                ORDER BY 2 DESC
                LIMIT 10
            `;

            return createResponse({
                totalCustomers,
                totalOrders,
                avgOrderPerCustomer: Number(avgOrderPerCustomer.toFixed(2)),
                usersByCountry: countryStats
            }, 'Customer stats retrieved');

        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Failed to fetch customer stats'));
        }
    });

    // GET /admin/reports/revenue-by-country - Revenue by country
    fastify.get('/admin/reports/revenue-by-country', {
        schema: { description: 'Get revenue by country', tags: ['Reports'] }
    }, async (request: any, reply) => {
        try {
            const { timeline = 'all', startDate: customStart, endDate: customEnd } = request.query;
            
            let dateFilter = '';
            if (timeline !== 'all') {
                const { startDate, endDate } = getDateRange(timeline, customStart, customEnd);
                dateFilter = `AND o.created_at >= '${startDate.toISOString()}' AND o.created_at <= '${endDate.toISOString()}'`;
            }

            // Using raw query for revenue by country as well for consistency
            const revenueByCountry: any[] = await (fastify.prisma as any).$queryRawUnsafe(`
                SELECT c.name as "country", SUM(o.total_amount)::float as "revenue"
                FROM orders o
                JOIN addresses a ON o.address_id = a.id
                JOIN countries c ON a.country_id = c.id
                WHERE o.status IN ('DELIVERED', 'COMPLETED', 'SHIPPED', 'PROCESSING', 'PENDING', 'RETURN_REQUESTED', 'RETURNED', 'CANCELLED')
                ${dateFilter}
                GROUP BY 1
                ORDER BY 2 DESC
                LIMIT 10
            `);

            return createResponse({
                timeline,
                data: revenueByCountry
            }, 'Revenue by country retrieved');

        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Failed to fetch revenue data'));
        }
    });

    // GET /admin/reports/revenue-by-country-trend - Revenue by country trend over time
    fastify.get('/admin/reports/revenue-by-country-trend', {
        schema: { description: 'Get revenue by country trend', tags: ['Reports'] }
    }, async (request: any, reply) => {
        try {
            const { timeline = 'monthly', startDate: customStart, endDate: customEnd } = request.query;
            const { startDate, endDate } = getDateRange(timeline, customStart, customEnd);

            // Using raw query to get revenue by country grouped by date
            const trendData: any[] = await (fastify.prisma as any).$queryRaw`
                SELECT 
                    c.name as "country",
                    DATE_TRUNC('day', o.created_at) as "date",
                    SUM(o.total_amount)::float as "revenue"
                FROM orders o
                JOIN addresses a ON o.address_id = a.id
                JOIN countries c ON a.country_id = c.id
                WHERE o.status IN ('DELIVERED', 'COMPLETED', 'SHIPPED', 'PROCESSING', 'PENDING', 'RETURN_REQUESTED', 'RETURNED', 'CANCELLED')
                AND o.created_at >= ${startDate} AND o.created_at <= ${endDate}
                GROUP BY 1, 2
                ORDER BY 2 ASC, 1 ASC
            `;

            return createResponse({
                timeline,
                period: { startDate, endDate },
                data: trendData
            }, 'Revenue by country trend retrieved');

        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Failed to fetch revenue trend'));
        }
    });

    // GET /admin/reports/predefined - List predefined reports
    fastify.get('/admin/reports/predefined', {
        schema: { description: 'List all predefined reports', tags: ['Reports'] }
    }, async (request, reply) => {
        try {
            const reports = await (fastify.prisma as any).predefinedReport.findMany({
                where: { isActive: true },
                orderBy: { category: 'asc' }
            });

            return createResponse(reports, 'Predefined reports retrieved');
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Failed to fetch reports'));
        }
    });

    // POST /admin/reports/generate - Generate and download report
    fastify.post('/admin/reports/generate', {
        schema: {
            description: 'Generate custom report',
            tags: ['Reports'],
            body: {
                type: 'object',
                required: ['reportId'],
                properties: {
                    reportId: { type: 'string' },
                    params: { type: 'object' }
                }
            }
        }
    }, async (request: any, reply) => {
        const { reportId, params = {} } = request.body;
        const user = request.user as any;
        if (!user || !user.id) {
             return reply.status(401).send(createErrorResponse('Unauthorized: User identification failed'));
        }
        const userId = user.id;

        try {
            const report = await (fastify.prisma as any).predefinedReport.findUnique({
                where: { id: reportId }
            });

            if (!report) {
                return reply.status(404).send(createErrorResponse('Report not found'));
            }

            // Execute custom SQL query
            let result;
            let queryParams: any[] = [];

            try {
                // PARAMETER MAPPING:
                // $1 = startDate
                // $2 = endDate
                
                // Only pass parameters if the query actually uses them to avoid "BIND message supplies X parameters..." error
                queryParams = report.sqlQuery.includes('$1') 
                    ? [
                        params.startDate ? new Date(params.startDate) : null,
                        params.endDate ? new Date(params.endDate) : null
                      ]
                    : [];

                result = await (fastify.prisma as any).$queryRawUnsafe(report.sqlQuery, ...queryParams);
                
                // Convert BigInt to string to avoid JSON serialization issues
                result = result.map((row: any) => {
                    const converted: any = {};
                    for (const key in row) {
                        if (typeof row[key] === 'bigint') {
                            converted[key] = row[key].toString();
                        } else {
                            converted[key] = row[key];
                        }
                    }
                    return converted;
                });
            } catch (queryErr: any) {
                // Log failure details
                fastify.log.error({
                    msg: 'Query execution failed',
                    reportName: report.name,
                    queryParams: queryParams,
                    error: queryErr.message
                });

                // Safe logging attempt
                try {
                    await (fastify.prisma as any).reportLog.create({
                        data: {
                            reportId,
                            userId,
                            format: 'csv',
                            status: 'failed',
                            errorMsg: queryErr.message
                        }
                    });
                } catch(logErr) {
                     fastify.log.error('Failed to write failure log: ' + logErr);
                }

                return reply.status(500).send(createErrorResponse(`Query execution failed: ${queryErr.message}`));
            }

            // Log success safely
            try {
                await (fastify.prisma as any).reportLog.create({
                    data: {
                        reportId,
                        userId,
                        format: 'csv',
                        status: 'success'
                    }
                });
            } catch(logErr) {
                fastify.log.error('Failed to write success log: ' + logErr);
            }

            return createResponse({
                reportName: report.name,
                data: result
            }, 'Report generated successfully');

        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Failed to generate report'));
        }
    });

    // GET /admin/reports/inventory - Inventory statistics
    fastify.get('/admin/reports/inventory', {
        schema: { description: 'Get inventory statistics', tags: ['Reports'] }
    }, async (request: any, reply) => {
        try {
            const prisma = fastify.prisma as any;
            
            // 1. Total Products & Active Status
            const totalProducts = await prisma.product.count();
            const activeProducts = await prisma.product.count({ where: { isActive: true } });
            
            // 2. Stock levels
            const stocks = await prisma.stock.findMany({
                include: { product: { select: { price: true } } }
            });
            
            let totalStockValue = 0;
            let lowStockCount = 0;
            let outOfStockCount = 0;

            stocks.forEach((stock: any) => {
                const qty = Math.max(0, (stock.qty || 0) - (stock.reservedQty || 0));
                const price = Number(stock.product?.price || 0);
                
                totalStockValue += (qty * price);
                
                if (qty === 0) {
                    outOfStockCount++;
                } else if (qty <= 10) {
                    lowStockCount++;
                }
            });

            // 3. Products by Category (Top 5)
            const categories = await prisma.category.findMany({
                include: { _count: { select: { products: true } } }
            });

            const productsByCategory = categories
                .map((c: any) => ({
                    category: c.name,
                    count: c._count.products
                }))
                .sort((a: any, b: any) => b.count - a.count)
                .slice(0, 5);

            return createResponse({
                totalProducts,
                activeProducts,
                inactiveProducts: totalProducts - activeProducts,
                totalStockValue,
                outOfStockCount,
                lowStockCount,
                productsByCategory
            }, 'Inventory stats retrieved');
            
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse('Failed to fetch inventory stats'));
        }
    });
}
