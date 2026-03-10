const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function verify() {
  try {
    console.log("--- B2B Users Verification ---");
    const users = await prisma.user.findMany({
      where: {
        b2bCompanyDetails: { isNot: null },
      },
      include: {
        role: true,
        b2bCompanyDetails: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (users.length === 0) {
      console.log("No users with B2B company details found.");
      return;
    }

    users.forEach((u) => {
      console.log(`Email: ${u.email}`);
      console.log(`  Role: ${u.role?.name || "NONE"}`);
      console.log(`  Account Status: ${u.accountStatus}`);
      console.log(`  Details ID: ${u.b2bCompanyDetails?.id}`);
      console.log(`  Company: ${u.b2bCompanyDetails?.companyName}`);
      console.log("---------------------------");
    });

    const pendingCount = await prisma.user.count({
      where: {
        accountStatus: "IN_REVIEW",
        OR: [
          { role: { name: { in: ["BUSINESS", "B2B_ADMIN"] } } },
          { b2bCompanyDetails: { isNot: null } },
        ],
      },
    });
    console.log(`Total Pending by Filter: ${pendingCount}`);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
