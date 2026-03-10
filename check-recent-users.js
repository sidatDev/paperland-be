const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkRecentUsers() {
  try {
    const users = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        role: true,
        b2bCompanyDetails: true,
      },
    });

    console.log("Recent Users:");
    users.forEach((u) => {
      console.log(
        `ID: ${u.id}, Email: ${u.email}, Status: ${u.accountStatus}, Role: ${u.role?.name}, HasDetails: ${!!u.b2bCompanyDetails}`,
      );
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecentUsers();
