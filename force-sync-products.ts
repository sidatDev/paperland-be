
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const productsTemplate = {
    slug: "products",
    title: "Company Products",
    description: "Products showcase page",
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
                    features: {
                        type: "array",
                        title: "Features List",
                        items: {
                            type: "object",
                            properties: {
                                title: { type: "string", title: "Title" },
                                desc: { type: "string", title: "Description" },
                                icon: { type: "string", title: "Icon Image", widget: "image" }
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
                    }
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
            ]
        },
        productList: [
            { title: "Filter Element Ultrapleat", desc: "As the next step on the path toward Leadership in Filtration, Filters Expert is strengthening its leadership structure and expanding its Management Board", image: "/images/companyproduct/filterelement.jpg" },
            { title: "Filter Dfo Ultra-Web", desc: "New CO2-reduced filters impregnated with plant-based raw materials, manufactured using renewable energy, and packaged in sustainable, recycled material.", image: "/images/companyproduct/filterdfo.jpg" },
            { title: "Air Filter", desc: "New CO2-reduced filters impregnated with plant-based raw materials, manufactured using renewable energy, and packaged in sustainable, recycled material.", image: "/images/companyproduct/airfilter.jpg" },
            { title: "Water Filter", desc: "As the next step on the path toward Leadership in Filtration, Filters Expert is strengthening its leadership structure and expanding its Management Board", image: "/images/companyproduct/waterfilter.jpg" },
            { title: "Hydraulic Filter", desc: "New CO2-reduced filters impregnated with plant-based raw materials, manufactured using renewable energy, and packaged in sustainable, recycled material.", image: "/images/companyproduct/hydraulic.jpg" },
            { title: "Oil Filter", desc: "New CO2-reduced filters impregnated with plant-based raw materials, manufactured using renewable energy, and packaged in sustainable, recycled material.", image: "/images/companyproduct/oil.jpg" }
        ]
    }
};

async function main() {
    console.log('Force updating Products CMS page...');
    
    const productsPage = await prisma.cMSPage.findFirst({
        where: { slug: 'products' }
    });

    if (productsPage) {
        await prisma.cMSPage.update({
            where: { id: productsPage.id },
            data: {
                title: productsTemplate.title,
                description: productsTemplate.description,
                schema: productsTemplate.schema as any,
                content: productsTemplate.defaultContent as any
            }
        });
        console.log('Success: Products page updated with new schema and default content.');
    } else {
        await prisma.cMSPage.create({
            data: {
                slug: productsTemplate.slug,
                title: productsTemplate.title,
                description: productsTemplate.description,
                schema: productsTemplate.schema as any,
                content: productsTemplate.defaultContent as any
            }
        });
        console.log('Success: Products page created with new schema and default content.');
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
