const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();
    try {
        console.log("Starting QA verification for Global S3 Endpoint reconfiguration...");
        
        // 1. Get or Create Settings
        let settings = await prisma.globalSettings.findFirst();
        if (!settings) {
            console.log("Settings not found, creating default...");
            settings = await prisma.globalSettings.create({
                data: {
                    storeName: "Test Store"
                }
            });
        } else {
            console.log("Existing settings found.");
        }

        // 2. Update with Endpoint
        const testEndpoint = "https://s3.custom-region.example.com";
        console.log(`Updating setting with test endpoint: ${testEndpoint}`);
        
        const updated = await prisma.globalSettings.update({
            where: { id: settings.id },
            data: { backupS3Endpoint: testEndpoint }
        });

        // 3. Verify
        console.log("Value read from DB:", updated.backupS3Endpoint);

        if (updated.backupS3Endpoint === testEndpoint) {
            console.log("\n[PASSED] Test Case: Verify 'backupS3Endpoint' field persistence.");
        } else {
            console.log("\n[FAILED] Test Case: Verify 'backupS3Endpoint' field persistence.");
        }

    } catch (e) {
        console.error("Error during test execution:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
