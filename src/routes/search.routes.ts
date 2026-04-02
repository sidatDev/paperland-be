import { FastifyInstance } from 'fastify';

export default async function searchRoutes(fastify: FastifyInstance) {
  // 1. Autocomplete Search (Fast suggestions)
  fastify.get('/search/autocomplete', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          limit: { type: 'integer', default: 5 },
          category: { type: 'string' },
        },
      },
    },
  }, async (request: any, reply) => {
    const { q, limit, category } = request.query;
    if (!q) return { results: [] };

    try {
      // Check if q matches a category name exactly for strict suggestion filtering
      const matchingCategory = await (fastify.prisma as any).category.findFirst({
        where: { name: { equals: q, mode: 'insensitive' }, isActive: true },
        select: { name: true }
      });

      const searchParameters: any = {
        q: q,
        query_by: 'name,sku,normalized_sku,part_no,normalized_part_no,slug,category,sub_category,brand',
        per_page: limit,
        prefix: true,
        num_typos: 1,
        prioritize_exact_match: true,
        exhaustive_search: true,
      };

      let filters = ['isActive:=true'];
      if (category) {
        filters.push(`category:=[${category}]`);
      } else if (matchingCategory) {
        // Apply strict filter if exact category match found in query string
        filters.push(`category:=[${matchingCategory.name}]`);
      }
      searchParameters.filter_by = filters.join(' && ');

      const result = await fastify.typesense.collections('products').documents().search(searchParameters);

      return {
        results: result.hits?.map((hit: any) => ({
          id: hit.document.id,
          name: hit.document.name,
          slug: hit.document.slug,
          sku: hit.document.sku,
          brand: hit.document.brand,
          category: hit.document.category,
          image_url: hit.document.image_url,
          currency: hit.document.currency,
        })) || [],
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ message: 'Search failed' });
    }
  });

  // 2. Main Search (Comprehensive filtering & ranking)
  fastify.get('/search', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 12 },
          sort: { type: 'string', enum: ['price_asc', 'price_desc', 'newest'] },
          brand: { type: 'string' },
          category: { type: 'string' },
          industry: { type: 'string' },
        },
      },
    },
  }, async (request: any, reply) => {
    const { q, page, limit, sort, brand, category, industry } = request.query;

    try {
      // Build filter string
      const filters: string[] = [];
      filters.push('isActive:=true'); // Only verify active products

      if (brand) filters.push(`brand:=[${brand}]`);
      if (category) filters.push(`category:=[${category}]`);
      if (industry) filters.push(`industry:=[${industry}]`);

      let sortBy = 'created_at:desc';
      if (sort === 'price_asc') sortBy = 'price:asc';
      if (sort === 'price_desc') sortBy = 'price:desc';

      const searchParameters: any = {
        q: q || '*',
        query_by: 'name,sku,normalized_sku,part_no,normalized_part_no,slug,description',
        filter_by: filters.join(' && '),
        sort_by: sortBy,
        page: page,
        per_page: limit,
        facet_by: 'brand,category,industry', // Return facets for filters
        num_typos: 2, // Standard typo tolerance
        typo_tokens_threshold: 1,
      };

      const result = await fastify.typesense.collections('products').documents().search(searchParameters);

      return {
        products: result.hits?.map((hit: any) => ({
          id: hit.document.id,
          name: hit.document.name,
          slug: hit.document.slug,
          sku: hit.document.sku,
          brand: hit.document.brand,
          category: hit.document.category,
          price: hit.document.price,
          currency: hit.document.currency,
          image_url: hit.document.image_url,
          description: hit.document.description,
        })) || [],
        metadata: {
          facets: result.facet_counts,
          total_results: result.found,
          total_pages: Math.ceil(result.found / limit),
          current_page: page,
        },
        suggestion: result.hits?.length === 0 && result.search_cutoff ? "Try a broader search term" : null, // Basic suggestion logic
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ message: 'Search failed' });
    }
  });

  // 3. Cross-Brand Recommendations (Compatible alternatives)
  fastify.get('/search/recommendations', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
        },
        required: ['productId'],
      },
    },
  }, async (request: any, reply) => {
    const { productId } = request.query;

    try {
      const crossRefs = await fastify.prisma.crossReference.findMany({
        where: { productId },
        include: {
          targetProduct: {
            include: {
              brand: true,
              category: true,
              prices: {
                take: 1,
                include: { currency: true },
              },
            },
          },
        },
      });

      return {
        recommendations: crossRefs.map((ref: any) => ({
          id: ref.targetProduct.id,
          name: ref.targetProduct.name,
          slug: ref.targetProduct.slug,
          price: Number(ref.targetProduct.prices[0]?.priceRetail || 0),
          currency: ref.targetProduct.prices[0]?.currency.code || 'PKR',
          image_url: ref.targetProduct.imageUrl,
          brand: ref.targetProduct.brand.name,
          category: ref.targetProduct.category.name,

          relationType: ref.relationType,
        })),
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ message: 'Failed to fetch recommendations' });
    }
  });
}
