
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const allReports = await prisma.predefinedReport.findMany();
  
  for (const report of allReports) {
      console.log(`Testing Report: ${report.name} (${report.id})`);
      const params: any = {};
      const queryParams = report.sqlQuery.includes('$1') 
          ? [params.startDate || null, params.endDate || null]
          : [];
      
      try {
       const result = await prisma.$queryRawUnsafe(report.sqlQuery, ...queryParams);
      console.log("SUCCESS");
      
      // Try logging with invalid user
      try {
        console.log("Attempting logging with userId='unknown'");
        await prisma.reportLog.create({
            data: {
                reportId: report.id,
                userId: 'unknown',
                format: 'csv',
                status: 'success'
            }
        });
      } catch (logErr: any) {
          console.error("LOGGING FAILED (Expected):", logErr.message);
      }

      } catch (e: any) {
          console.error("FAILED:", e.message);
      }
      console.log('---');
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
