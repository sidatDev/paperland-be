const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkColumns() {
  try {
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'b2b_profiles'
    `;
    console.log("Columns in b2b_profiles:");
    console.table(columns);
  } catch (error) {
    console.error("Error checking columns:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkColumns();
