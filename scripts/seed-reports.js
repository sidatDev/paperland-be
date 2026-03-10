"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function seedPredefinedReports() {
    console.log('Seeding predefined reports...');
    // Default Date Range: If no params provided, default to last 10 years (effectively all time) to Now
    // Logic will be handled in SQL: WHERE date >= COALESCE($1, '2000-01-01') AND date <= COALESCE($2, NOW())
    const reports = [
        {
            name: 'Monthly Sales Summary',
            description: 'Total sales by month',
            sqlQuery: `SELECT 
                TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM-DD') as "Month",
                COUNT(*)::int as "Total Orders",
                SUM(total_amount)::float as "Total Revenue"
                FROM orders 
                WHERE status IN ('DELIVERED', 'COMPLETED')
                AND created_at >= COALESCE($1::timestamp, '2000-01-01') 
                AND created_at <= COALESCE($2::timestamp, NOW())
                GROUP BY 1 
                ORDER BY 1 DESC`,
            category: 'sales'
        },
        {
            name: 'Top 10 Products by Revenue',
            description: 'Best selling products by total revenue',
            sqlQuery: `SELECT 
                p.name as "Product Name",
                p.sku as "SKU",
                COUNT(oi.id)::int as "Units Sold",
                SUM(oi.price * oi.quantity)::float as "Total Revenue"
                FROM products p
                JOIN order_items oi ON oi.product_id = p.id
                JOIN orders o ON o.id = oi.order_id
                WHERE o.status IN ('DELIVERED', 'COMPLETED')
                AND o.created_at >= COALESCE($1::timestamp, '2000-01-01') 
                AND o.created_at <= COALESCE($2::timestamp, NOW())
                GROUP BY p.id, p.name, p.sku
                ORDER BY "Total Revenue" DESC
                LIMIT 10`,
            category: 'sales'
        },
        {
            name: 'Customer Growth Report',
            description: 'New customer registrations by month',
            sqlQuery: `SELECT 
                TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM-DD') as "Month",
                COUNT(*)::int as "New Customers",
                COUNT(CASE WHEN b2b_profile_id IS NOT NULL THEN 1 END)::int as "B2B Customers",
                COUNT(CASE WHEN b2b_profile_id IS NULL THEN 1 END)::int as "B2C Customers"
                FROM users
                WHERE created_at >= COALESCE($1::timestamp, '2000-01-01') 
                AND created_at <= COALESCE($2::timestamp, NOW())
                GROUP BY 1
                ORDER BY 1 DESC`,
            category: 'customers'
        },
        {
            name: 'Top Customers by Spend',
            description: 'Customers with highest total purchase value',
            sqlQuery: `SELECT 
                u.first_name || ' ' || u.last_name as "Customer Name",
                u.email as "Email",
                COUNT(o.id)::int as "Total Orders",
                SUM(o.total_amount)::float as "Total Spent"
                FROM users u
                JOIN orders o ON o.user_id = u.id
                WHERE o.status IN ('DELIVERED', 'COMPLETED')
                AND o.created_at >= COALESCE($1::timestamp, '2000-01-01') 
                AND o.created_at <= COALESCE($2::timestamp, NOW())
                GROUP BY u.id, u.first_name, u.last_name, u.email
                ORDER BY "Total Spent" DESC
                LIMIT 20`,
            category: 'customers'
        },
        {
            name: 'Revenue by Country',
            description: 'Total revenue breakdown by shipping country',
            sqlQuery: `SELECT 
                c.name as "Country",
                COUNT(o.id)::int as "Total Orders",
                SUM(o.total_amount)::float as "Total Revenue",
                ROUND(AVG(o.total_amount), 2)::float as "Avg Order Value"
                FROM orders o
                JOIN addresses a ON o.address_id = a.id
                JOIN countries c ON a.country_id = c.id
                WHERE o.status IN ('DELIVERED', 'COMPLETED')
                AND o.created_at >= COALESCE($1::timestamp, '2000-01-01') 
                AND o.created_at <= COALESCE($2::timestamp, NOW())
                GROUP BY c.name
                ORDER BY "Total Revenue" DESC`,
            category: 'financial'
        },
        {
            name: 'Payment Method Analysis',
            description: 'Orders and revenue by payment method',
            sqlQuery: `SELECT 
                payment_method as "Payment Method",
                COUNT(*)::int as "Total Orders",
                SUM(total_amount)::float as "Total Revenue",
                ROUND(AVG(total_amount), 2)::float as "Avg Order Value"
                FROM orders
                WHERE status IN ('DELIVERED', 'COMPLETED')
                AND created_at >= COALESCE($1::timestamp, '2000-01-01') 
                AND created_at <= COALESCE($2::timestamp, NOW())
                GROUP BY payment_method
                ORDER BY "Total Revenue" DESC`,
            category: 'financial'
        },
        {
            name: 'Low Stock Products',
            description: 'Products with stock below reorder level (Snapshot)',
            // Fixed: Joined with stocks table, hardcoded threshold as column doesn't exist on product
            sqlQuery: `SELECT 
                p.name as "Product Name",
                p.sku as "SKU",
                COALESCE(s.qty, 0)::int as "Current Stock",
                10 as "Reorder Level"
                FROM products p
                LEFT JOIN stocks s ON s.product_id = p.id
                WHERE (s.qty <= 10 OR s.qty IS NULL)
                AND s.qty > 0
                ORDER BY s.qty ASC
                LIMIT 50`,
            category: 'inventory'
        },
        {
            name: 'Inventory Value Report',
            description: 'Total inventory value by category (Snapshot)',
            // Fixed: Joined with stocks and prices tables to get actual qty and price
            sqlQuery: `SELECT 
                c.name as "Category",
                COUNT(DISTINCT p.id)::int as "Product Count",
                COALESCE(SUM(s.qty), 0)::int as "Total Units",
                COALESCE(SUM(s.qty * pr."priceRetail"), 0)::float as "Inventory Value"
                FROM products p
                LEFT JOIN categories c ON c.id = p.category_id
                LEFT JOIN stocks s ON s.product_id = p.id
                LEFT JOIN prices pr ON pr.product_id = p.id AND pr.is_active = true
                WHERE s.qty > 0
                GROUP BY c.id, c.name
                ORDER BY "Inventory Value" DESC`,
            category: 'inventory'
        }
    ];
    for (const report of reports) {
        const existing = await prisma.predefinedReport.findFirst({
            where: { name: report.name }
        });
        if (existing) {
            console.log(`Updating report: ${report.name}`);
            await prisma.predefinedReport.update({
                where: { id: existing.id },
                data: {
                    sqlQuery: report.sqlQuery,
                    description: report.description,
                    category: report.category
                }
            });
        }
        else {
            await prisma.predefinedReport.create({
                data: {
                    ...report,
                    isActive: true
                }
            });
            console.log(`✓ Created report: ${report.name}`);
        }
    }
    console.log('\nPredefined reports seeding completed!');
}
seedPredefinedReports()
    .catch((error) => {
    console.error('Error seeding reports:', error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
