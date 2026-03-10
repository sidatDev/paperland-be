
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const productsTemplate = {
    slug: "products",
    title: "Company Products",
    schema: {
        type: "object",
        properties: {
            banner: {
                type: "object",
                title: "Banner Section",
                properties: {
                    backgroundImage: { type: "string", title: "Background Image", widget: "image" },
                    title: { type: "string", title: "Title" },
                    subtitle: { type: "string", title: "Subtitle" }
                }
            },
            ctaSection: {
                type: "object",
                title: "CTA Section",
                properties: {
                    badge: { type: "string", title: "Section Badge", default: "Premium Quality Filters" },
                    title: { type: "string", title: "Main Title", default: "Get the Best Filters" },
                    subtitle: { type: "string", title: "Subtitle", default: "for Your Business" },
                    description: { type: "string", title: "Description", widget: "textarea", default: "Join thousands of satisfied customers who trust Filters Experts for their industrial and automotive filtration needs." },
                    shopText: { type: "string", title: "Shop Button Text", default: "Shop Now" },
                    shopLink: { type: "string", title: "Shop Button Link" },
                    contactText: { type: "string", title: "Contact Button Text", default: "Contact Sales" },
                    contactLink: { type: "string", title: "Contact Button Link" },
                    features: {
                        type: "array",
                        title: "Features List",
                        items: {
                            type: "object",
                            properties: {
                                title: { type: "string", title: "Title" },
                                desc: { type: "string", title: "Description" },
                                icon: { type: "string", title: "Icon Image (White recommended)", widget: "image" }
                            }
                        }
                    },
                    cards: {
                        type: "array",
                        title: "Cards List",
                        items: {
                            type: "object",
                            properties: {
                                title: { type: "string", title: "Title" },
                                desc: { type: "string", title: "Description" },
                                icon: { type: "string", title: "Icon Image", widget: "image" },
                                badge: { type: "string", title: "Badge Text" }
                            }
                        }
                    },
                    stats: {
                        type: "array",
                        title: "Stats Summary",
                        items: {
                            type: "object",
                            properties: {
                                value: { type: "string", title: "Stat Value" },
                                label: { type: "string", title: "Stat Label" }
                            }
                        }
                    },
                    viewMoreText: { type: "string", title: "Card 'View More' Text", default: "View More" }
                }
            },
            productList: {
                type: "array",
                title: "Static Product List",
                items: {
                    type: "object",
                    properties: {
                        title: { type: "string", title: "Product Title" },
                        desc: { type: "string", title: "Description", widget: "textarea" },
                        image: { type: "string", title: "Product Image", widget: "image" }
                    }
                }
            },
            content: { type: "string", title: "Page Content", widget: "richtext" }
        }
    },
    defaultContent: {
        banner: {
            backgroundImage: "/images/Productbanner.jpg",
            title: "Our Products",
            subtitle: ""
        },
        ctaSection: {
            badge: "Premium Quality Filters",
            title: "Get the Best Filters",
            subtitle: "for Your Business",
            description: "Join thousands of satisfied customers who trust Filters Experts for their industrial and automotive filtration needs.",
            shopText: "Shop Now",
            shopLink: "",
            contactText: "Contact Sales",
            contactLink: "",
            features: [
                { title: "Quality Guaranteed", desc: "ISO certified products with 2+ decades of expertise", icon: "/images/icons/quality-icon.png" },
                { title: "Fast Delivery", desc: "Quick shipping to keep your operations running", icon: "/images/icons/delivery-icon.png" },
                { title: "Best Prices", desc: "Competitive pricing without compromising quality", icon: "/images/icons/price-icon.png" }
            ],
            cards: [
                { title: "Air Filters", desc: "Premium quality filtration", icon: "/images/icons/air-filter-icon.png", badge: "30% OFF" },
                { title: "Oil Filters", desc: "Industrial grade performance", icon: "/images/icons/oil-filter-icon.png", badge: "" },
                { title: "Water Filters", desc: "Superior purification system", icon: "/images/icons/water-filter-icon.png", badge: "" }
            ],
            stats: [
                { value: "2000+", label: "Happy Clients" },
                { value: "20+", label: "Years Experience" },
                { value: "50K+", label: "Products Delivered" }
            ],
            viewMoreText: "View More"
        }
    }
};

async function main() {
    console.log('Syncing viewMoreText to Products CMS record...');
    
    const page = await prisma.cMSPage.findUnique({
        where: { slug: 'products' }
    });

    if (!page) {
        console.log('Error: Products page not found in DB.');
        return;
    }

    const existingContent = page.contentJson as any || {};
    
    // Merge logic: prioritize existing but ensure new fields are added
    const newContent = {
        ...existingContent,
        ctaSection: {
            ...productsTemplate.defaultContent.ctaSection,
            ...existingContent?.ctaSection
        }
    };

    await prisma.cMSPage.update({
        where: { id: page.id },
        data: {
            schema: JSON.stringify(productsTemplate.schema),
            content: JSON.stringify(newContent),
            contentJson: newContent
        }
    });

    console.log('Success: Products page updated with viewMoreText field.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
