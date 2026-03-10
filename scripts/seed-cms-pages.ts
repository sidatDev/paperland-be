/**
 * Seed CMS Pages Script
 * Seeds the About Us and Privacy Policy pages with default content matching current frontend mock data.
 * Usage: npx ts-node scripts/seed-cms-pages.ts
 */

import { PrismaClient } from '@prisma/client';
import { CMS_TEMPLATES } from '../src/data/cms-templates';

const prisma = new PrismaClient();

// Default content for About Us page (matches current frontend mock data)
const aboutPageContent = {
    hero: {
        backgroundImage: "/images/aboutbackground.png",
        titleEn: "About",
        highlightEn: "Us"
    },
    companyHistory: {
        sectionTitle: "COMPANY HISTORY",
        description: "Filters Experts has been at the forefront of the automotive and industrial filtration industry for over two decades. Founded with a commitment to delivering superior quality filters and spare parts, we have grown from a modest regional distributor to a trusted multi-national supplier serving thousands of businesses and individual customers across Saudi Arabia, UAE, and Pakistan."
    },
    ceoMessage: {
        image: "/images/about us/CEO's Message.jpg",
        subtitle: "FILTERS SPECIALISTS",
        heading: "CEO's Message",
        message: "Since our founding in 1998, we have built our reputation on a simple but powerful foundation: delivering the right product, at the right time, at the right price. This commitment has earned the trust of thousands of businesses and individuals who depend on us to keep their operations running smoothly."
    },
    mission: {
        heading: "Mission",
        description: "Our mission is to be the most trusted and accessible source of automotive filters and spare parts in the Middle East and South Asia, delivering superior quality products, exceptional service, and competitive pricing to both individual customers and businesses."
    },
    vision: {
        heading: "Vision",
        description: "To become the leading omnichannel filtration and spare parts provider in the region, recognized globally for innovation, reliability, and customer-centricity, while creating sustainable value for all stakeholders."
    },
    timelineSection: {
        sectionTitle: "COMPANY TIMELINE",
        sectionHeading: "Each milestone marks a moment of vision, progress, and refined growth.",
        timeline: [
            {
                year: "1998",
                description: "Founded in Jeddah, Saudi Arabia as a regional automotive filter distributor",
                icon: "/images/vectors/homeicon.png",
                isActive: true
            },
            {
                year: "2002",
                description: "Expanded operations to Riyadh and Dammam; established main distribution hub",
                icon: "/images/vectors/groupicon.png",
                isActive: false
            },
            {
                year: "2006",
                description: "Opened 20+ additional locations across Saudi Arabia; reached 100,000+ SKU inventory",
                icon: "/images/vectors/locationIcon.png",
                isActive: false
            },
            {
                year: "2010",
                description: "Established operations in Dubai, UAE; entered the UAE market",
                icon: "/images/vectors/cogwheel.png",
                isActive: false
            }
        ]
    },
    leadership: {
        sectionTitle: "LEADERSHIP",
        sectionHeading: "Meet the Team",
        teamMembers: [
            { name: "David Knetz", role: "Chief Financial Officer", image: "/images/about us/david.jpg" },
            { name: "Zaire Mortman", role: "Founder", image: "/images/about us/zaire.jpg" },
            { name: "Jhon Wilber", role: "CEO", image: "/images/about us/CEO.jpg" },
            { name: "Alex Anthem", role: "Marketing Director", image: "/images/about us/Alex.jpg" },
            { name: "David Knetz", role: "Director", image: "/images/about us/david ktiz.png" },
            { name: "David Knetz", role: "Accounts Manager", image: "/images/about us/david kvitiz.jpg" }
        ]
    }
};

// Default content for Privacy Policy page
const privacyPolicyContent = {
    title: "Privacy Policy",
    lastUpdated: "Last Updated: February 11, 2026",
    sections: [
        {
            heading: "1. Introduction",
            text: "Welcome to Filter Experts. We value your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and safeguard your information when you visit our website or use our services."
        },
        {
            heading: "2. Information We Collect",
            text: "We collect information that you provide directly to us, such as when you create an account, make a purchase, or contact us. This may include your name, email address, phone number, shipping address, and payment information. We also automatically collect certain information about your device and browsing activity."
        },
        {
            heading: "3. How We Use Your Information",
            text: "We use the information we collect to process your orders, communicate with you, improve our services, and send you marketing communications (if you have opted in). We do not sell your personal data to third parties."
        },
        {
            heading: "4. Information Sharing",
            text: "We may share your information with trusted third-party service providers who assist us in operating our website, conducting our business, or servicing you, as long as those parties agree to keep this information confidential."
        },
        {
            heading: "5. Data Security",
            text: "We implement a variety of security measures to maintain the safety of your personal information. However, no method of transmission over the internet or method of electronic storage is 100% secure."
        },
        {
            heading: "6. Your Rights",
            text: "You have the right to access, correct, or delete your personal information. You may also object to the processing of your data or request a restriction of processing."
        },
        {
            heading: "7. Contact Us",
            text: "If you have any questions about this Privacy Policy, please contact us at info@filtersexperts.com."
        }
    ]
};

const careerPageContent = (CMS_TEMPLATES.find(t => t.slug === 'career') as any)?.defaultContent || {};
const mediaCenterPageContent = (CMS_TEMPLATES.find(t => t.slug === 'media-center') as any)?.defaultContent || {};
const companyPageContent = (CMS_TEMPLATES.find(t => t.slug === 'company') as any)?.defaultContent || {};

const pagesToSeed = [
    { slug: "about", content: aboutPageContent },
    { slug: "privacy-policy", content: privacyPolicyContent },
    { slug: "career", content: careerPageContent },
    { slug: "media-center", content: mediaCenterPageContent },
    { slug: "company", content: companyPageContent }
];

async function seedCmsPages() {
    console.log("🌱 Starting CMS page seeding...\n");

    // Find an admin user to use as creator (CMSVersion requires valid user FK)
    const adminUser = await (prisma as any).user.findFirst({
        where: { role: { name: { in: ['SUPER_ADMIN', 'B2B_ADMIN', 'REGIONAL_ADMIN', 'admin'] } } },
        select: { id: true, email: true }
    });

    if (!adminUser) {
        console.error("❌ No admin user found. Please create an admin user first.");
        return;
    }
    console.log(`📌 Using admin user: ${adminUser.email} (${adminUser.id})\n`);

    for (const pageData of pagesToSeed) {
        const template = CMS_TEMPLATES.find(t => t.slug === pageData.slug);
        if (!template) {
            console.error(`❌ Template not found for slug: ${pageData.slug}`);
            continue;
        }

        // Check if page already exists
        const existing = await (prisma as any).cMSPage.findUnique({
            where: { slug: pageData.slug }
        });

        if (existing) {
            console.log(`⚠️  Page "${template.title}" (slug: ${pageData.slug}) already exists. Updating schema and content...`);
            
            // Sync schema and default content to ensure it reflects in the admin panel
            // We update content ONLY if it's empty or for the career page which we just mapped
            const currentContent = existing.contentJson;
            const hasData = currentContent && Object.keys(currentContent as object).length > 0;
            
            const updateData: any = {
                schema: JSON.stringify(template.schema),
                title: template.title,
            };

            // Force content update for career and media-center and company pages to ensure it matches the new detailed schema
            // OR if the page has no data yet
            if (['career', 'media-center'].includes(pageData.slug) || !hasData) {
                updateData.content = JSON.stringify(pageData.content);
                updateData.contentJson = pageData.content;
                console.log(`🔄 Resetting content to default for "${pageData.slug}" to match new schema.`);
            }

            await (prisma as any).cMSPage.update({
                where: { id: existing.id },
                data: updateData
            });
            console.log(`✅ Synced schema and content for "${template.title}"`);
            continue;
        }

        // Create the page
        const page = await (prisma as any).cMSPage.create({
            data: {
                title: template.title,
                slug: pageData.slug,
                content: JSON.stringify(pageData.content),
                schema: JSON.stringify(template.schema),
                contentJson: pageData.content as any,
                isActive: true,
                versions: {
                    create: {
                        content: JSON.stringify(pageData.content),
                        contentJson: pageData.content as any,
                        version: 1,
                        createdBy: adminUser.id
                    }
                }
            }
        });

        console.log(`✅ Created "${template.title}" (id: ${page.id})`);
    }

    console.log("\n🎉 CMS seeding complete!");
}

seedCmsPages()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
