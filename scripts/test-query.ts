
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const query = `
SELECT 
    t.id as "TXN ID",
    o.order_number as "Order #",
    t.amount as "Amount (SAR)",
    t.method as "Method",
    t.status as "Payment Status",
    t.type as "Type",
    t.created_at as "Transaction Date"
FROM transactions t
JOIN orders o ON t.order_id = o.id
WHERE t.created_at >= $1 AND t.created_at <= $2
ORDER BY t.created_at DESC
  `;

  console.log("Running query with nulls...");
  try {
      const result = await prisma.$queryRawUnsafe(query, null, null);
      console.log("Success:", result);
  } catch (e) {
      console.error("Error:", e);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
