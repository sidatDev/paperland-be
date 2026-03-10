import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';

export default async function publicBlogRoutes(fastify: FastifyInstance) {
  
  // List published posts (Public)
  fastify.get('/public/blog/posts', {
    schema: {
      description: 'List published blog posts (public)',
      tags: ['Blog'],
      querystring: {
        type: 'object',
        properties: {
          categoryId: { type: 'string' },
          categorySlug: { type: 'string' },
          search: { type: 'string' },
          tag: { type: 'string' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 12 }
        }
      }
    }
  }, async (request: any, reply) => {
    const { categoryId, categorySlug, search, tag, page = 1, limit = 12 } = request.query;
    
    try {
      const where: any = {
        status: 'PUBLISHED',
        deletedAt: null,
        publishedAt: { lte: new Date() }
      };
      
      if (categoryId) {
        where.categoryId = categoryId;
      } else if (categorySlug) {
        const category = await (fastify.prisma as any).blogCategory.findUnique({
          where: { slug: categorySlug }
        });
        if (category) {
          where.categoryId = category.id;
        }
      }
      
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { excerpt: { contains: search, mode: 'insensitive' } }
        ];
      }
      
      if (tag) {
        where.tags = { has: tag };
      }
      
      const [posts, total] = await Promise.all([
        (fastify.prisma as any).blogPost.findMany({
          where,
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            featuredImageUrl: true,
            publishedAt: true,
            createdAt: true,
            viewCount: true,
            isFeatured: true,
            category: { select: { id: true, name: true, slug: true } },
            author: { select: { id: true, firstName: true, lastName: true } }
          },
          orderBy: { publishedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        (fastify.prisma as any).blogPost.count({ where })
      ]);
      
      return createResponse({
        posts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }, 'Posts retrieved successfully');
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to fetch posts'));
    }
  });
  
  // Get single post by slug (Public)
  fastify.get('/public/blog/posts/:slug', {
    schema: {
      description: 'Get published blog post by slug (public)',
      tags: ['Blog']
    }
  }, async (request: any, reply) => {
    const { slug } = request.params;
    
    try {
      const post = await (fastify.prisma as any).blogPost.findFirst({
        where: {
          slug,
          status: 'PUBLISHED',
          deletedAt: null,
          publishedAt: { lte: new Date() }
        },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          author: { select: { firstName: true, lastName: true } }
        }
      });
      
      if (!post) {
        return reply.status(404).send(createErrorResponse('Post not found'));
      }
      
      // Increment view count
      await (fastify.prisma as any).blogPost.update({
        where: { id: post.id },
        data: { viewCount: { increment: 1 } }
      });
      
      // Get related posts (same category, exclude current)
      const relatedPosts = await (fastify.prisma as any).blogPost.findMany({
        where: {
          categoryId: post.categoryId,
          id: { not: post.id },
          status: 'PUBLISHED',
          deletedAt: null
        },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          featuredImageUrl: true,
          publishedAt: true
        },
        orderBy: { publishedAt: 'desc' },
        take: 3
      });
      
      return createResponse({
        ...post,
        relatedPosts
      }, 'Post retrieved successfully');
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to fetch post'));
    }
  });

  // Public Categories
  fastify.get('/public/blog/categories', {
    schema: {
      description: 'List blog categories (public)',
      tags: ['Blog']
    }
  }, async (request: any, reply) => {
    try {
      const categories = await (fastify.prisma as any).blogCategory.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          slug: true,
          _count: {
             select: { posts: { where: { status: 'PUBLISHED', deletedAt: null } } }
          }
        },
        orderBy: { name: 'asc' }
      });
      
      return createResponse(categories, 'Categories retrieved successfully');
    } catch (err) {
      fastify.log.error(err);
      // return reply.status(500).send(createErrorResponse('Failed to fetch categories'));
      return [];
    }
  });
}
