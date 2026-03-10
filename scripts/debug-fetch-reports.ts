
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const reports = await prisma.predefinedReport.findMany({
    select: { id: true, name: true, sqlQuery: true }
  });
  const report = reports[0];
  if(report) {
      console.log(`REPORT_ID: ${report.id}`);
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
