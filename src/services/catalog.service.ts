
import { PrismaClient } from '@prisma/client';

export class CatalogService {
    /**
     * Get all active catalogs assigned to a company, ordered by priority (highest first)
     */
    static async getCompanyCatalogs(prisma: PrismaClient, companyId: string) {
        if (!companyId) return [];

        const companyCatalogs = await prisma.companyCatalog.findMany({
            where: {
                companyId,
                catalog: {
                    isActive: true,
                    deletedAt: null,
                    OR: [
                        { validFrom: null, validUntil: null },
                        {
                            validFrom: { lte: new Date() },
                            validUntil: { gte: new Date() }
                        }
                    ]
                }
            },
            include: {
                catalog: true
            },
            orderBy: {
                priority: 'desc'
            }
        });

        return companyCatalogs.map(cc => cc.catalog);
    }

    /**
     * Get the effective pricing and MOQ for a variant given a list of catalogs
     * Priority: First catalog in the list that has a price for this variant
     */
    static async getVariantCatalogInfo(prisma: PrismaClient, variantId: string, catalogIds: string[]) {
        if (catalogIds.length === 0) return null;

        const pricing = await prisma.catalogPricing.findFirst({
            where: {
                variantId,
                catalogId: { in: catalogIds }
            }
        });

        // Prisma findFirst with cross-table orderBy is tricky.
        // Better: Fetch all and sort manually or use the order of catalogIds if they are already sorted by priority.
        
        const allPricings = await prisma.catalogPricing.findMany({
            where: {
                variantId,
                catalogId: { in: catalogIds }
            }
        });

        if (allPricings.length === 0) return null;

        // Map pricing to the priority index of its catalog
        const sortedPricings = allPricings.sort((a, b) => {
            return catalogIds.indexOf(a.catalogId) - catalogIds.indexOf(b.catalogId);
        });

        return sortedPricings[0];
    }

    /**
     * Check if a product is visible to a company's catalogs
     */
    static async isProductVisible(prisma: PrismaClient, productId: string, catalogIds: string[]) {
        if (catalogIds.length === 0) return true; // Default behavior? Or false? 
        // Based on reqs: B2B users only see what's in their catalog.
        
        const count = await prisma.catalogProduct.count({
            where: {
                productId,
                catalogId: { in: catalogIds }
            }
        });

        return count > 0;
    }
}
