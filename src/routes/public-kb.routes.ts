import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';

export default async function publicKbRoutes(fastify: FastifyInstance) {
    const prisma = fastify.prisma as any;

    // 1. Get KB Categories (Tree)
    fastify.get('/public/kb/categories', {
        schema: {
            description: 'Get public knowledge base categories tree',
            tags: ['Knowledge Base']
        }
    }, async (request, reply) => {
        try {
            const categories = await prisma.kbCategory.findMany({
                where: { 
                    deletedAt: null, 
                    isActive: true,
                    visibility: 'PUBLIC'
                },
                orderBy: { position: 'asc' },
                include: {
                    _count: {
                        select: { 
                            articles: { 
                                where: { 
                                    status: 'PUBLISHED', 
                                    deletedAt: null,
                                    OR: [
                                        { publishedAt: { lte: new Date() } },
                                        { publishedAt: null }
                                    ],
                                    NOT: [
                                        { title: { equals: 'Untitled', mode: 'insensitive' } },
                                        { title: { equals: 'Untitled Article', mode: 'insensitive' } }
                                    ]
                                } 
                            } 
                        }
                    }
                }
            });

            const buildTree = (parentId: string | null = null): any[] => {
                return categories
                    .filter((c: any) => c.parentId === parentId)
                    .map((c: any) => ({
                        ...c,
                        children: buildTree(c.id)
                    }));
            };

            return createResponse(buildTree());
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("Failed to fetch KB categories"));
        }
    });

    // 2. List Articles (Public)
    fastify.get('/public/kb/articles', {
        schema: {
            description: 'List published KB articles (public)',
            tags: ['Knowledge Base'],
            querystring: {
                type: 'object',
                properties: {
                    categoryId: { type: 'string' },
                    categorySlug: { type: 'string' },
                    search: { type: 'string' },
                    isFeatured: { type: 'boolean' },
                    page: { type: 'integer', minimum: 1, default: 1 },
                    limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 }
                }
            }
        }
    }, async (request: any, reply) => {
        const { categoryId, categorySlug, search, isFeatured, page = 1, limit = 10 } = request.query;
        const skip = (page - 1) * limit;

        try {
            const where: any = {
                status: 'PUBLISHED',
                visibility: 'PUBLIC',
                deletedAt: null,
                OR: [
                    { publishedAt: { lte: new Date() } },
                    { publishedAt: null }
                ],
                NOT: [
                    { title: { equals: 'Untitled', mode: 'insensitive' } },
                    { title: { equals: 'Untitled Article', mode: 'insensitive' } }
                ]
            };

            if (categoryId) {
                where.categoryId = categoryId;
            } else if (categorySlug) {
                const category = await prisma.kbCategory.findUnique({ where: { slug: categorySlug } });
                if (category) where.categoryId = category.id;
            }

            if (isFeatured !== undefined) {
                where.isFeatured = isFeatured;
            }

            if (search) {
                where.OR = [
                    { title: { contains: search, mode: 'insensitive' } },
                    { contentText: { contains: search, mode: 'insensitive' } },
                    { excerpt: { contains: search, mode: 'insensitive' } }
                ];
            }

            const [articles, total] = await Promise.all([
                prisma.kbArticle.findMany({
                    where,
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        excerpt: true,
                        coverImageUrl: true,
                        publishedAt: true,
                        readingTime: true,
                        viewCount: true,
                        isFeatured: true,
                        category: { select: { id: true, name: true, slug: true } }
                    },
                    orderBy: { position: 'asc' },
                    skip,
                    take: limit
                }),
                prisma.kbArticle.count({ where })
            ]);

            return createResponse({
                articles,
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
            });
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("Failed to fetch KB articles"));
        }
    });

    // 3. Get Single Article by Slug
    fastify.get('/public/kb/articles/:slug', {
        schema: {
            description: 'Get published KB article by slug (public)',
            tags: ['Knowledge Base'],
            params: {
                type: 'object',
                properties: { slug: { type: 'string' } }
            }
        }
    }, async (request: any, reply) => {
        const { slug } = request.params;

        try {
            const article = await prisma.kbArticle.findFirst({
                where: {
                    slug,
                    status: 'PUBLISHED',
                    visibility: 'PUBLIC',
                    deletedAt: null,
                    OR: [
                        { publishedAt: { lte: new Date() } },
                        { publishedAt: null }
                    ]
                },
                include: {
                    category: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            articles: {
                                where: { 
                                    status: 'PUBLISHED', 
                                    deletedAt: null,
                                    OR: [
                                        { publishedAt: { lte: new Date() } },
                                        { publishedAt: null }
                                    ],
                                    NOT: [
                                        { title: { equals: 'Untitled', mode: 'insensitive' } },
                                        { title: { equals: 'Untitled Article', mode: 'insensitive' } }
                                    ]
                                },
                                select: { id: true, title: true, slug: true, position: true },
                                orderBy: { position: 'asc' }
                            }
                        }
                    }
                }
            });

            if (!article) {
                return reply.status(404).send(createErrorResponse("Article not found"));
            }

            // Increment view count (fire and forget for public)
            prisma.kbArticle.update({
                where: { id: article.id },
                data: { viewCount: { increment: 1 } }
            }).catch((err: any) => fastify.log.error(err));

            return createResponse(article);
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("Failed to fetch article"));
        }
    });

    // 4. Search KB Articles (Typesense Powered)
    fastify.get('/public/kb/search', {
        schema: {
            description: 'Search KB articles using Typesense',
            tags: ['Knowledge Base'],
            querystring: {
                type: 'object',
                properties: {
                    q: { type: 'string' },
                    limit: { type: 'integer', default: 10 }
                }
            }
        }
    }, async (request: any, reply) => {
        const { q, limit = 10 } = request.query;
        if (!q) return createResponse([]);

        try {
            const searchParameters = {
                q: q,
                query_by: 'title,content,category,tags',
                per_page: limit,
                prefix: true,
                num_typos: 1,
                highlight_full_fields: 'title,content'
            };

            const result = await (fastify as any).typesense.collections('knowledge_base').documents().search(searchParameters);

            const results = result.hits?.map((hit: any) => ({
                id: hit.document.id,
                title: hit.document.title,
                slug: hit.document.slug,
                category: hit.document.category,
                category_slug: hit.document.category_slug,
                excerpt: hit.highlights?.[0]?.segments?.join('...') || hit.document.content.substring(0, 160) + '...',
                score: hit.text_match
            })) || [];

            return createResponse(results);
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("Search failed"));
        }
    });

    // 5. Get FAQs
    fastify.get('/public/kb/faqs', {
        schema: {
            description: 'Get public FAQs',
            tags: ['Knowledge Base'],
            querystring: {
                type: 'object',
                properties: {
                    categoryId: { type: 'string' },
                    categorySlug: { type: 'string' }
                }
            }
        }
    }, async (request: any, reply) => {
        const { categoryId, categorySlug } = request.query;
        try {
            const where: any = { isActive: true, deletedAt: null };
            if (categoryId) {
                where.categoryId = categoryId;
            } else if (categorySlug) {
                const category = await prisma.kbCategory.findUnique({ where: { slug: categorySlug } });
                if (category) where.categoryId = category.id;
            }

            const faqs = await prisma.kbFaq.findMany({
                where,
                orderBy: { position: 'asc' },
                include: { category: { select: { id: true, name: true, slug: true } } }
            });

            return createResponse(faqs);
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("Failed to fetch FAQs"));
        }
    });

    // 6. Submit feedback (helpful / not helpful)
    fastify.post('/public/kb/feedback', {
        schema: {
            description: 'Submit feedback for a KB article or FAQ',
            tags: ['Knowledge Base'],
            body: {
                type: 'object',
                required: ['helpful'],
                properties: {
                    articleId: { type: 'string' },
                    faqId: { type: 'string' },
                    helpful: { type: 'boolean' }
                }
            }
        }
    }, async (request: any, reply) => {
        const { articleId, faqId, helpful } = request.body;
        const ipAddress = request.ip;
        const userAgent = request.headers['user-agent'];

        try {
            if (!articleId && !faqId) {
                return reply.status(400).send(createErrorResponse("Either articleId or faqId must be provided"));
            }

            const feedback = await prisma.kbFeedback.create({
                data: {
                    articleId: articleId || null,
                    faqId: faqId || null,
                    helpful,
                    ipAddress,
                    userAgent
                }
            });

            return createResponse(feedback, "Feedback submitted successfully");
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("Failed to submit feedback"));
        }
    });
}
