
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDashboardKPI() {
  console.log('Testing Dashboard KPI Logic directly against DB...');

  try {
    // 1. Revenue
    const totalRevenue = await prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { status: { not: 'CANCELLED' } }
    });
    console.log('Total Revenue:', totalRevenue._sum.totalAmount?.toString());

    // 2. Orders
    const totalOrders = await prisma.order.count();
    console.log('Total Orders:', totalOrders);

    // 3. Active Customers
    const userCount = await prisma.user.count({
        where: { role: { name: { notIn: ['SUPER_ADMIN', 'REGIONAL_ADMIN'] } } }
    });
    console.log('Active Customers:', userCount);

    // 4. Delivered Rate
    const deliveredOrders = await prisma.order.count({ where: { status: 'DELIVERED' } });
    const deliveredRate = totalOrders > 0 ? ((deliveredOrders / totalOrders) * 100).toFixed(1) : "0.0";
    console.log('Delivered Rate:', deliveredRate, '%');

    // 5. Return Rate
    const returnedOrders = await prisma.order.count({ 
        where: { status: { in: ['RETURN_REQUESTED', 'REFUNDED', 'RETURN_PROCESSING'] } } 
    });
    const returnRate = totalOrders > 0 ? ((returnedOrders / totalOrders) * 100).toFixed(1) : "0.0";
    console.log('Return Rate:', returnRate, '%');

  } catch (err: any) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testDashboardKPI();
