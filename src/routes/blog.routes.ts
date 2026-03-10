import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { logActivity } from '../utils/audit';
import sanitizeHtml from 'sanitize-html';

function sanitizePostContent(content: string): string {
  return sanitizeHtml(content, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'span', 'u']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      '*': ['style', 'class'],
      'img': ['src', 'alt', 'width', 'height']
    },
    allowedSchemes: ['http', 'https', 'data']
  });
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default async function blogRoutes(fastify: FastifyInstance) {
  
  // --- BLOG POSTS (ADMIN) ---
  
  // List all blog posts (Admin)
  fastify.get('/admin/blog/posts', {
    preHandler: [fastify.authenticate, (fastify as any).hasPermission('blog_view')],
    schema: {
      description: 'List all blog posts with filters',
      tags: ['Blog'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['DRAFT', 'PUBLISHED', 'ALL'] },
          categoryId: { type: 'string' },
          search: { type: 'string' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          showDeleted: { type: 'boolean', default: false }
        }
      }
    }
  }, async (request: any, reply) => {
    const { status, categoryId, search, page = 1, limit = 20, showDeleted } = request.query;
    
    try {
      const where: any = {};
      
      // Fix: Show only deleted when showDeleted=true, only active when false
      if (showDeleted) {
        where.deletedAt = { not: null };
      } else {
        where.deletedAt = null;
      }
      
      if (status && status !== 'ALL') {
        where.status = status;
      }
      
      if (categoryId) {
        where.categoryId = categoryId;
      }
      
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { excerpt: { contains: search, mode: 'insensitive' } }
        ];
      }
      
      const [posts, total] = await Promise.all([
        (fastify.prisma as any).blogPost.findMany({
          where,
          include: {
            category: { select: { id: true, name: true, slug: true } },
            author: { select: { id: true, firstName: true, lastName: true, email: true } }
          },
          orderBy: { createdAt: 'desc' },
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
  
  // Get single blog post (Admin)
  fastify.get('/admin/blog/posts/:id', {
    preHandler: [fastify.authenticate, (fastify as any).hasPermission('blog_view')],
    schema: {
      description: 'Get blog post by ID',
      tags: ['Blog']
    }
  }, async (request: any, reply) => {
    const { id } = request.params;
    
    try {
      const post = await (fastify.prisma as any).blogPost.findUnique({
        where: { id },
        include: {
          category: true,
          author: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      });
      
      if (!post) {
        return reply.status(404).send(createErrorResponse('Post not found'));
      }
      
      return createResponse(post, 'Post retrieved successfully');
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to fetch post'));
    }
  });
  
  // Create blog post
  fastify.post('/admin/blog/posts', {
    preHandler: [fastify.authenticate, (fastify as any).hasPermission('blog_manage')],
    schema: {
      description: 'Create a new blog post',
      tags: ['Blog'],
      body: {
        type: 'object',
        required: ['title', 'content'],
        properties: {
          title: { type: 'string', minLength: 5, maxLength: 120 },
          slug: { type: 'string' },
          excerpt: { type: 'string', maxLength: 160 },
          content: { type: 'string' },
          featuredImageUrl: { type: 'string' },
          categoryId: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          metaTitle: { type: 'string' },
          metaDescription: { type: 'string' },
          status: { type: 'string', enum: ['DRAFT', 'PUBLISHED'] },
          isFeatured: { type: 'boolean' },
          publishedAt: { type: 'string', format: 'date-time' },
          authorId: { type: 'string' }
        }
      }
    }
  }, async (request: any, reply) => {
    const userId = (request.user as any)?.id;
    const {
      title,
      slug,
      excerpt,
      content,
      featuredImageUrl,
      categoryId,
      tags = [],
      metaTitle,
      metaDescription,
      status = 'DRAFT',
      isFeatured = false,
      publishedAt,
      authorId
    } = request.body;
    
    try {
      // Generate slug if not provided
      let finalSlug = slug || generateSlug(title);
      
      // Check slug uniqueness and auto-increment if needed
      let slugExists = await (fastify.prisma as any).blogPost.findUnique({
        where: { slug: finalSlug }
      });
      
      // Auto-increment slug if it exists
      let counter = 2;
      const baseSlug = finalSlug;
      while (slugExists) {
        finalSlug = `${baseSlug}-${counter}`;
        slugExists = await (fastify.prisma as any).blogPost.findUnique({
          where: { slug: finalSlug }
        });
        counter++;
      }
      
      // Validate featured image for published posts
      if (status === 'PUBLISHED' && !featuredImageUrl) {
        return reply.status(400).send(createErrorResponse('Please upload a featured image before publishing'));
      }
      
      // Validate publish date for published posts
      if (status === 'PUBLISHED' && !publishedAt) {
        // Auto-set to current date if not provided
        // This ensures publishedAt is always set for published posts
      }
      
      const sanitizedContent = sanitizePostContent(content);
      
      const post = await (fastify.prisma as any).blogPost.create({
        data: {
          title,
          slug: finalSlug,
          excerpt,
          content: sanitizedContent,
          featuredImageUrl,
          categoryId: categoryId || null,
          tags,
          metaTitle,
          metaDescription,
          status,
          isFeatured,
          publishedAt: status === 'PUBLISHED' ? (publishedAt || new Date()) : null,
          authorId: authorId || userId
        },
        include: {
          category: true,
          author: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      });
      
      await logActivity(fastify, {
        entityType: 'BLOG',
        entityId: post.id,
        action: 'CREATE',
        performedBy: userId,
        details: { title, slug: finalSlug, status },
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });
      
      return createResponse(post, 'Post created successfully');
    } catch (err: any) {
      fastify.log.error(err);
      if (err.code === 'P2002') {
        return reply.status(400).send(createErrorResponse('Slug already exists'));
      }
      return reply.status(500).send(createErrorResponse('Failed to create post'));
    }
  });
  
  // Update blog post
  fastify.put('/admin/blog/posts/:id', {
    preHandler: [fastify.authenticate, (fastify as any).hasPermission('blog_manage')],
    schema: {
      description: 'Update a blog post',
      tags: ['Blog'],
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 5, maxLength: 120 },
          slug: { type: 'string' },
          excerpt: { type: 'string', maxLength: 160 },
          content: { type: 'string' },
          featuredImageUrl: { type: 'string' },
          categoryId: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          metaTitle: { type: 'string' },
          metaDescription: { type: 'string' },
          status: { type: 'string', enum: ['DRAFT', 'PUBLISHED'] },
          isFeatured: { type: 'boolean' },
          publishedAt: { type: 'string', format: 'date-time' },
          authorId: { type: 'string' }
        }
      }
    }
  }, async (request: any, reply) => {
    const { id } = request.params;
    const userId = (request.user as any)?.id;
    const {
      title,
      slug,
      excerpt,
      content,
      featuredImageUrl,
      categoryId,
      tags,
      metaTitle,
      metaDescription,
      status,
      isFeatured,
      publishedAt,
      authorId
    } = request.body;
    
    try {
      const existing = await (fastify.prisma as any).blogPost.findUnique({
        where: { id }
      });
      
      if (!existing) {
        return reply.status(404).send(createErrorResponse('Post not found'));
      }
      
      const sanitizedContent = content ? sanitizePostContent(content) : undefined;

      const updateData: any = {
        title,
        slug,
        excerpt,
        content: sanitizedContent,
        featuredImageUrl,
        categoryId: categoryId || null,
        tags,
        metaTitle,
        metaDescription,
        status,
        isFeatured,
        publishedAt: publishedAt ? new Date(publishedAt) : undefined,
        authorId: authorId || undefined
      };
      
      // Check slug uniqueness if changed
      if (slug && slug !== existing.slug) {
        let finalSlug = slug;
        let slugExists = await (fastify.prisma as any).blogPost.findUnique({
          where: { slug: finalSlug }
        });
        
        // Auto-increment slug if it exists
        let counter = 2;
        const baseSlug = finalSlug;
        while (slugExists) {
          finalSlug = `${baseSlug}-${counter}`;
          slugExists = await (fastify.prisma as any).blogPost.findUnique({
            where: { slug: finalSlug }
          });
          counter++;
        }
        
        // Update to the unique slug
        updateData.slug = finalSlug;
      }
      
      // Validate featured image for published posts
      if (status === 'PUBLISHED' && !featuredImageUrl && !existing.featuredImageUrl) {
        return reply.status(400).send(createErrorResponse('Please upload a featured image before publishing'));
      }
      
      // Set publishedAt when publishing
      if (status === 'PUBLISHED' && existing.status === 'DRAFT') {
        updateData.publishedAt = publishedAt || new Date();
      }
      
      const post = await (fastify.prisma as any).blogPost.update({
        where: { id },
        data: updateData,
        include: {
          category: true,
          author: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      });
      
      await logActivity(fastify, {
        entityType: 'BLOG',
        entityId: id,
        action: 'UPDATE',
        performedBy: userId,
        details: { title, status },
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });
      
      return createResponse(post, 'Post updated successfully');
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to update post'));
    }
  });
  
  // Delete blog post (soft delete)
  fastify.delete('/admin/blog/posts/:id', {
    preHandler: [fastify.authenticate, (fastify as any).hasPermission('blog_manage')],
    schema: {
      description: 'Delete a blog post',
      tags: ['Blog'],
      querystring: {
        type: 'object',
        properties: {
          force: { type: 'boolean', default: false }
        }
      }
    }
  }, async (request: any, reply) => {
    const { id } = request.params;
    const { force } = request.query;
    const userId = (request.user as any)?.id;
    
    try {
      if (force) {
        await (fastify.prisma as any).blogPost.delete({ where: { id } });
        
        await logActivity(fastify, {
          entityType: 'BLOG',
          entityId: id,
          action: 'HARD_DELETE',
          performedBy: userId,
          details: { permanent: true },
          ip: request.ip,
          userAgent: request.headers['user-agent']
        });
        
        return createResponse(null, 'Post permanently deleted');
      } else {
        const post = await (fastify.prisma as any).blogPost.update({
          where: { id },
          data: { deletedAt: new Date() }
        });
        
        await logActivity(fastify, {
          entityType: 'BLOG',
          entityId: id,
          action: 'DELETE',
          performedBy: userId,
          details: { title: post.title },
          ip: request.ip,
          userAgent: request.headers['user-agent']
        });
        
        return createResponse(null, 'Post moved to trash');
      }
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to delete post'));
    }
  });
  
  // Publish/Unpublish post
  fastify.post('/admin/blog/posts/:id/publish', {
    preHandler: [fastify.authenticate, (fastify as any).hasPermission('blog_manage')],
    schema: {
      description: 'Publish or unpublish a blog post',
      tags: ['Blog'],
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['DRAFT', 'PUBLISHED'] }
        }
      }
    }
  }, async (request: any, reply) => {
    const { id } = request.params;
    const { status } = request.body;
    const userId = (request.user as any)?.id;
    
    try {
      const existing = await (fastify.prisma as any).blogPost.findUnique({
        where: { id }
      });
      
      if (!existing) {
        return reply.status(404).send(createErrorResponse('Post not found'));
      }
      
      if (status === 'PUBLISHED' && !existing.featuredImageUrl) {
        return reply.status(400).send(createErrorResponse('Please upload a featured image before publishing'));
      }
      
      const updateData: any = { status };
      
      if (status === 'PUBLISHED' && !existing.publishedAt) {
        updateData.publishedAt = new Date();
      }
      
      const post = await (fastify.prisma as any).blogPost.update({
        where: { id },
        data: updateData
      });
      
      await logActivity(fastify, {
        entityType: 'BLOG',
        entityId: id,
        action: status === 'PUBLISHED' ? 'PUBLISH' : 'UNPUBLISH',
        performedBy: userId,
        details: { title: post.title, status },
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });
      
      return createResponse(post, `Post ${status === 'PUBLISHED' ? 'published' : 'unpublished'} successfully`);
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to update post status'));
    }
  });
  
  // Bulk delete
  fastify.post('/admin/blog/posts/bulk-delete', {
    preHandler: [fastify.authenticate, (fastify as any).hasPermission('blog_manage')],
    schema: {
      description: 'Bulk delete blog posts',
      tags: ['Blog'],
      body: {
        type: 'object',
        required: ['ids'],
        properties: {
          ids: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (request: any, reply) => {
    const { ids } = request.body;
    const userId = (request.user as any)?.id;
    
    try {
      await (fastify.prisma as any).blogPost.updateMany({
        where: { id: { in: ids } },
        data: { deletedAt: new Date() }
      });
      
      await logActivity(fastify, {
        entityType: 'BLOG',
        entityId: 'BULK',
        action: 'BULK_DELETE',
        performedBy: userId,
        details: { count: ids.length, ids },
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });
      
      return createResponse(null, `${ids.length} posts moved to trash`);
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to delete posts'));
    }
  });
  
  // Bulk publish/unpublish
  fastify.post('/admin/blog/posts/bulk-publish', {
    preHandler: [fastify.authenticate, (fastify as any).hasPermission('blog_manage')],
    schema: {
      description: 'Bulk publish or unpublish blog posts',
      tags: ['Blog'],
      body: {
        type: 'object',
        required: ['ids', 'status'],
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['DRAFT', 'PUBLISHED'] }
        }
      }
    }
  }, async (request: any, reply) => {
    const { ids, status } = request.body;
    const userId = (request.user as any)?.id;
    
    try {
      const updateData: any = { status };
      
      if (status === 'PUBLISHED') {
        updateData.publishedAt = new Date();
      }
      
      await (fastify.prisma as any).blogPost.updateMany({
        where: { id: { in: ids } },
        data: updateData
      });
      
      await logActivity(fastify, {
        entityType: 'BLOG',
        entityId: 'BULK',
        action: status === 'PUBLISHED' ? 'BULK_PUBLISH' : 'BULK_UNPUBLISH',
        performedBy: userId,
        details: { count: ids.length, ids, status },
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });
      
      return createResponse(null, `${ids.length} posts ${status === 'PUBLISHED' ? 'published' : 'unpublished'}`);
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to update posts'));
    }
  });
  
  // --- BLOG CATEGORIES (ADMIN) ---
  
  // List categories
  fastify.get('/admin/blog/categories', {
    preHandler: [fastify.authenticate, (fastify as any).hasPermission('blog_view')],
    schema: {
      description: 'List all blog categories',
      tags: ['Blog']
    }
  }, async (request, reply) => {
    try {
      const categories = await (fastify.prisma as any).blogCategory.findMany({
        where: { deletedAt: null },
        include: {
          _count: { select: { posts: true } },
          parent: { select: { id: true, name: true, slug: true } }
        },
        orderBy: { name: 'asc' }
      });
      
      return createResponse(categories, 'Categories retrieved successfully');
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to fetch categories'));
    }
  });
  
  // Create category
  fastify.post('/admin/blog/categories', {
    preHandler: [fastify.authenticate, (fastify as any).hasPermission('blog_manage')],
    schema: {
      description: 'Create a blog category',
      tags: ['Blog'],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string' },
          parentId: { type: 'string' }
        }
      }
    }
  }, async (request: any, reply) => {
    const { name, slug, description, parentId } = request.body;
    const userId = (request.user as any)?.id;
    
    try {
      const finalSlug = slug || generateSlug(name);
      
      const category = await (fastify.prisma as any).blogCategory.create({
        data: {
          name,
          slug: finalSlug,
          description,
          parentId: parentId || null
        }
      });
      
      await logActivity(fastify, {
        entityType: 'BLOG_CATEGORY',
        entityId: category.id,
        action: 'CREATE',
        performedBy: userId,
        details: { name, slug: finalSlug },
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });
      
      return createResponse(category, 'Category created successfully');
    } catch (err: any) {
      fastify.log.error(err);
      if (err.code === 'P2002') {
        return reply.status(400).send(createErrorResponse('Category name or slug already exists'));
      }
      return reply.status(500).send(createErrorResponse('Failed to create category'));
    }
  });
  
  // Update category
  fastify.put('/admin/blog/categories/:id', {
    preHandler: [fastify.authenticate, (fastify as any).hasPermission('blog_manage')],
    schema: {
      description: 'Update a blog category',
      tags: ['Blog']
    }
  }, async (request: any, reply) => {
    const { id } = request.params;
    const { name, slug, description, parentId } = request.body;
    const userId = (request.user as any)?.id;
    
    try {
      const category = await (fastify.prisma as any).blogCategory.update({
        where: { id },
        data: { name, slug, description, parentId: parentId || null }
      });
      
      await logActivity(fastify, {
        entityType: 'BLOG_CATEGORY',
        entityId: id,
        action: 'UPDATE',
        performedBy: userId,
        details: { name, slug },
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });
      
      return createResponse(category, 'Category updated successfully');
    } catch (err: any) {
      fastify.log.error(err);
      if (err.code === 'P2002') {
        return reply.status(400).send(createErrorResponse('Category name or slug already exists'));
      }
      return reply.status(500).send(createErrorResponse('Failed to update category'));
    }
  });
  
  // Delete category
  fastify.delete('/admin/blog/categories/:id', {
    preHandler: [fastify.authenticate, (fastify as any).hasPermission('blog_manage')],
    schema: {
      description: 'Delete a blog category',
      tags: ['Blog']
    }
  }, async (request: any, reply) => {
    const { id } = request.params;
    const userId = (request.user as any)?.id;
    
    try {
      // Check if category has posts
      const count = await (fastify.prisma as any).blogPost.count({
        where: { categoryId: id, deletedAt: null }
      });
      
      if (count > 0) {
        return reply.status(400).send(createErrorResponse(`Cannot delete category with ${count} posts. Please reassign or delete posts first.`));
      }
      
      await (fastify.prisma as any).blogCategory.update({
        where: { id },
        data: { deletedAt: new Date() }
      });
      
      await logActivity(fastify, {
        entityType: 'BLOG_CATEGORY',
        entityId: id,
        action: 'DELETE',
        performedBy: userId,
        details: {},
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });
      
      return createResponse(null, 'Category deleted successfully');
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to delete category'));
    }
  });
}
