import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const email = 'admin.sidattech@paperland.com';
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      }
    }
  });

  if (!user) {
    console.log("User not found!");
    return;
  }

  console.log("User found:", user.email);
  console.log("Role ID:", user.roleId);
  console.log("Role Name:", user.role?.name);
  console.log("Permissions keys assigned to this role:", user.role?.permissions.map((rp: any) => rp.permission.key));
}

main().catch(console.error).finally(() => prisma.$disconnect());
