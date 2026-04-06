import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Update or Create GlobalSettings with Paperland Branding
  const settings = await prisma.globalSettings.findFirst();
  
  if (settings) {
    await prisma.globalSettings.update({
      where: { id: settings.id },
      data: {
        storeName: "Paperland",
        contactEmail: "info@paperland.com.pk",
        senderName: "Paperland Team",
        senderEmail: "seehar.aqib@gmail.com", // Keeping current sender but updating branding
        storeSlogan: "School Se Office Tak",
        // Clearing invalid/stale SMTP from DB if any (to keep falling back to .env for now, or until user provides new one)
        smtpUser: null, 
        smtpPass: null
      }
    });
    console.log('✅ GlobalSettings updated with Paperland branding.');
  } else {
    await prisma.globalSettings.create({
      data: {
        storeName: "Paperland",
        contactEmail: "info@paperland.com.pk",
        senderName: "Paperland Team",
        senderEmail: "seehar.aqib@gmail.com",
        storeSlogan: "School Se Office Tak"
      }
    });
    console.log('✅ GlobalSettings created with Paperland branding.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
