import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { 
  extractTextFromTiptapJson, 
  calculateReadingTime, 
  generateKbSlug, 
  renderTiptapToHtml, 
  computeCategoryPath 
} from '../utils/kb-utils';
import { syncKbArticleToSearch } from '../utils/kb-search-sync';
import { logActivity } from '../utils/audit';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';

const knowledgeBaseRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const prisma = fastify.prisma;

  // Middleware for permissions
  const checkView = { preHandler: [fastify.authenticate, (fastify as any).hasPermission('kb_view')] };
  const checkManage = { preHandler: [fastify.authenticate, (fastify as any).hasPermission('kb_manage')] };

  // ─── CATEGORIES ───────────────────────────────────────────────────

  // List categories as tree
  fastify.get('/admin/kb/categories', checkView, async (request, reply) => {
    const categories = await prisma.kbCategory.findMany({
      where: { deletedAt: null },
      orderBy: { position: 'asc' },
      include: {
        _count: {
          select: { articles: true, faqs: true }
        }
      }
    });

    const buildTree = (parentId: string | null = null): any[] => {
      return categories
        .filter(c => c.parentId === parentId)
        .map(c => ({
          ...c,
          children: buildTree(c.id)
        }));
    };

    return createResponse(buildTree());
  });

  // Create Category
  fastify.post('/admin/kb/categories', checkManage, async (request: any, reply) => {
    const { name, parentId, description, icon, visibility, isActive } = request.body;
    
    // Check case-insensitive name uniqueness among active categories
    const existingName = await prisma.kbCategory.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        deletedAt: null
      }
    });
    if (existingName) {
      return reply.status(400).send(createErrorResponse('Category name must be unique'));
    }

    const slug = generateKbSlug(name);
    
    // Check slug uniqueness
    const existing = await prisma.kbCategory.findUnique({ where: { slug } });
    const finalSlug = existing ? `${slug}-${Date.now().toString().slice(-4)}` : slug;

    const { path, depth } = await computeCategoryPath(prisma, parentId, finalSlug);

    const category = await prisma.kbCategory.create({
      data: {
        name,
        slug: finalSlug,
        parentId,
        description,
        icon,
        visibility: visibility || 'PUBLIC',
        isActive: isActive !== undefined ? isActive : true,
        path,
        depth
      }
    });

    await logActivity(fastify, {
      entityType: 'KB_CATEGORY',
      entityId: category.id,
      action: 'CREATE',
      performedBy: (request.user as any).id,
      details: category
    });

    return createResponse(category, 'Category created successfully');
  });

  // Update Category
  fastify.put('/admin/kb/categories/:id', checkManage, async (request: any, reply) => {
    const { id } = request.params;
    const data = request.body;
    
    const current = await prisma.kbCategory.findUnique({ where: { id } });
    if (!current) return reply.status(404).send(createErrorResponse('Category not found'));

    if (data.name) {
      // Check case-insensitive name uniqueness among active categories excluding this category itself
      const existingName = await prisma.kbCategory.findFirst({
        where: {
          name: { equals: data.name, mode: 'insensitive' },
          deletedAt: null,
          id: { not: id }
        }
      });
      if (existingName) {
        return reply.status(400).send(createErrorResponse('Category name must be unique'));
      }
      data.slug = generateKbSlug(data.name);
    }

    if (data.parentId !== undefined || data.slug) {
      const finalSlug = data.slug || current.slug;
      const finalParentId = data.parentId !== undefined ? data.parentId : current.parentId;
      const { path, depth } = await computeCategoryPath(prisma, finalParentId, finalSlug);
      data.path = path;
      data.depth = depth;
    }

    const category = await prisma.kbCategory.update({
      where: { id },
      data
    });

    await logActivity(fastify, {
      entityType: 'KB_CATEGORY',
      entityId: category.id,
      action: 'UPDATE',
      performedBy: (request.user as any).id,
      details: data
    });

    return createResponse(category, 'Category updated successfully');
  });

  // Delete Category
  fastify.delete('/admin/kb/categories/:id', checkManage, async (request: any, reply) => {
    const { id } = request.params;

    const category = await prisma.kbCategory.findUnique({
      where: { id },
      include: {
        children: { where: { deletedAt: null } },
        articles: { where: { deletedAt: null } },
        faqs: { where: { deletedAt: null } }
      }
    });

    if (!category || category.deletedAt) {
      return reply.status(404).send(createErrorResponse('Category not found'));
    }

    if (category.children.length > 0) {
      return reply.status(400).send(createErrorResponse('Cannot delete category: it has active subcategories'));
    }
    if (category.articles.length > 0) {
      return reply.status(400).send(createErrorResponse('Cannot delete category: it has active articles'));
    }
    if (category.faqs.length > 0) {
      return reply.status(400).send(createErrorResponse('Cannot delete category: it has active FAQs'));
    }

    await prisma.kbCategory.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    await logActivity(fastify, {
      entityType: 'KB_CATEGORY',
      entityId: id,
      action: 'DELETE',
      performedBy: (request.user as any).id
    });

    return createResponse(null, 'Category deleted successfully');
  });

  // ─── ARTICLES ─────────────────────────────────────────────────────

  // List Articles
  fastify.get('/admin/kb/articles', checkView, async (request: any, reply) => {
    const { page = 1, limit = 10, status, categoryId, search, visibility, isDeleted } = request.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (isDeleted === 'true' || isDeleted === true) {
      where.deletedAt = { not: null };
    } else {
      where.deletedAt = null;
    }
    if (status && status !== "") where.status = status;
    if (categoryId && categoryId !== "" && categoryId !== "none") where.categoryId = categoryId;
    if (visibility && visibility !== "") where.visibility = visibility;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { contentText: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [articles, total] = await Promise.all([
      prisma.kbArticle.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { updatedAt: 'desc' },
        include: {
          category: { select: { name: true, id: true } },
          author: { select: { firstName: true, lastName: true } }
        }
      }),
      prisma.kbArticle.count({ where })
    ]);

    return createResponse(articles, 'Articles fetched successfully', {
      page: Number(page),
      limit: Number(limit),
      total
    });
  });

  // Get Single Article
  fastify.get('/admin/kb/articles/:id', checkView, async (request: any, reply) => {
    const { id } = request.params;
    const article = await prisma.kbArticle.findUnique({
      where: { id },
      include: {
        category: true,
        author: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { revisions: true } }
      }
    });

    if (!article || article.deletedAt) {
      return reply.status(404).send(createErrorResponse('Article not found'));
    }

    return createResponse(article);
  });

  // Create Article
  fastify.post('/admin/kb/articles', checkManage, async (request: any, reply) => {
    const data = request.body;
    const authorId = (request.user as any).id;
    
    let slug = generateKbSlug(data.title || 'Untitled Article');
    let finalSlug = slug;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      const existing = await prisma.kbArticle.findUnique({ where: { slug: finalSlug } });
      if (existing) {
        finalSlug = `${slug}-${Math.random().toString(36).substring(2, 7)}`;
        attempts++;
      } else {
        isUnique = true;
      }
    }
    data.slug = finalSlug;

    const contentText = extractTextFromTiptapJson(data.contentJson);
    const renderedHtml = renderTiptapToHtml(data.contentJson);
    const readingTime = calculateReadingTime(contentText);
    const status = data.status || 'DRAFT';
    const publishedAt = status === 'PUBLISHED' ? (data.publishedAt || new Date()) : (data.publishedAt || null);

    let article;
    try {
      article = await prisma.kbArticle.create({
        data: {
          ...data,
          authorId,
          contentText,
          renderedHtml,
          readingTime,
          status,
          publishedAt
        }
      });
    } catch (error: any) {
      // If we still hit a unique constraint on slug (race condition), try one more time with a timestamp
      if (error.code === 'P2002' && error.meta?.target?.includes('slug')) {
        data.slug = `${finalSlug}-${Date.now()}`;
        article = await prisma.kbArticle.create({
          data: {
            ...data,
            authorId,
            contentText,
            renderedHtml,
            readingTime,
            status,
            publishedAt
          }
        });
      } else {
        throw error;
      }
    }

    // Create Revision v1
    await prisma.kbArticleRevision.create({
      data: {
        articleId: article.id,
        contentJson: data.contentJson as any,
        contentText,
        renderedHtml,
        title: data.title,
        version: 1,
        createdById: authorId,
        changeNote: 'Initial version'
      }
    });

    await syncKbArticleToSearch(fastify, article.id);

    await logActivity(fastify, {
      entityType: 'KB_ARTICLE',
      entityId: article.id,
      action: 'CREATE',
      performedBy: authorId,
      details: article
    });

    return createResponse(article, 'Article created successfully');
  });

  // Update Article (Creates Revision)
  fastify.put('/admin/kb/articles/:id', checkManage, async (request: any, reply) => {
    const { id } = request.params;
    const data = request.body;
    const authorId = (request.user as any).id;

    const current = await prisma.kbArticle.findUnique({ where: { id } });
    if (!current) return reply.status(404).send(createErrorResponse('Article not found'));

    if (data.title && data.title !== current.title) {
      const slug = generateKbSlug(data.title);
      const existing = await prisma.kbArticle.findUnique({ where: { slug } });
      data.slug = existing ? `${slug}-${Date.now().toString().slice(-4)}` : slug;
    }

    if (data.contentJson) {
      data.contentText = extractTextFromTiptapJson(data.contentJson);
      data.renderedHtml = renderTiptapToHtml(data.contentJson);
      data.readingTime = calculateReadingTime(data.contentText);
    }

    if (data.status) {
      if (data.status === 'PUBLISHED') {
        data.publishedAt = data.publishedAt || current.publishedAt || new Date();
      } else {
        data.publishedAt = null;
      }
    }

    const article = await prisma.kbArticle.update({
      where: { id },
      data
    });

    // Create New Revision
    const lastRevision = await prisma.kbArticleRevision.findFirst({
      where: { articleId: id },
      orderBy: { version: 'desc' }
    });

    await prisma.kbArticleRevision.create({
      data: {
        articleId: id,
        contentJson: (data.contentJson || current.contentJson) as any,
        contentText: data.contentText || current.contentText,
        renderedHtml: data.renderedHtml || current.renderedHtml,
        title: data.title || current.title,
        version: (lastRevision?.version || 0) + 1,
        createdById: authorId,
        changeNote: data.changeNote || 'Updated article'
      }
    });

    await syncKbArticleToSearch(fastify, article.id);

    await logActivity(fastify, {
      entityType: 'KB_ARTICLE',
      entityId: article.id,
      action: 'UPDATE',
      performedBy: authorId,
      details: data
    });

    return createResponse(article, 'Article updated successfully');
  });

  // Autosave (NO Revision)
  fastify.post('/admin/kb/articles/:id/autosave', checkManage, async (request: any, reply) => {
    const { id } = request.params;
    const { contentJson, title } = request.body;

    const contentText = extractTextFromTiptapJson(contentJson);
    const renderedHtml = renderTiptapToHtml(contentJson);
    const readingTime = calculateReadingTime(contentText);

    const article = await prisma.kbArticle.update({
      where: { id },
      data: {
        title,
        contentJson,
        contentText,
        renderedHtml,
        readingTime
      }
    });

    await syncKbArticleToSearch(fastify, article.id);

    return createResponse(article, 'Autosaved successfully');
  });

  // Delete Article
  fastify.delete('/admin/kb/articles/:id', checkManage, async (request: any, reply) => {
    const { id } = request.params;
    await prisma.kbArticle.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    
    // Sync to search (remove from index if it's now deleted)
    await syncKbArticleToSearch(fastify, id);

    await logActivity(fastify, {
      entityType: 'KB_ARTICLE',
      entityId: id,
      action: 'DELETE',
      performedBy: (request.user as any).id
    });

    return createResponse(null, 'Article deleted successfully');
  });

  // Bulk Delete Articles
  fastify.post('/admin/kb/articles/bulk-delete', checkManage, async (request: any, reply) => {
    const { ids } = request.body;
    if (!ids || !Array.isArray(ids)) {
      return reply.status(400).send(createErrorResponse('Invalid IDs provided'));
    }

    await prisma.kbArticle.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date() }
    });

    // Sync each to search (optional: could be optimized but for safety...)
    for (const id of ids) {
        await syncKbArticleToSearch(fastify, id);
    }

    await logActivity(fastify, {
      entityType: 'KB_ARTICLE',
      entityId: ids.join(','),
      action: 'BULK_DELETE',
      performedBy: (request.user as any).id,
      details: { count: ids.length }
    });

    return createResponse(null, `${ids.length} articles deleted successfully`);
  });

  // Restore Article
  fastify.post('/admin/kb/articles/:id/restore', checkManage, async (request: any, reply) => {
    const { id } = request.params;
    const article = await prisma.kbArticle.update({
      where: { id },
      data: { deletedAt: null }
    });
    
    await syncKbArticleToSearch(fastify, id);

    await logActivity(fastify, {
      entityType: 'KB_ARTICLE',
      entityId: id,
      action: 'RESTORE',
      performedBy: (request.user as any).id
    });

    return createResponse(article, 'Article restored successfully');
  });

  // Permanent Delete Article
  fastify.delete('/admin/kb/articles/:id/permanent', checkManage, async (request: any, reply) => {
    const { id } = request.params;
    
    // Check if it's already soft deleted
    const current = await prisma.kbArticle.findUnique({ where: { id } });
    if (!current?.deletedAt) {
        return reply.status(400).send(createErrorResponse('Article must be moved to trash first before permanent deletion'));
    }

    // Delete revisions first (cascading if not handled by DB)
    await prisma.kbArticleRevision.deleteMany({ where: { articleId: id } });
    
    await prisma.kbArticle.delete({ where: { id } });
    
    // Sync to search (remove)
    await syncKbArticleToSearch(fastify, id);

    await logActivity(fastify, {
      entityType: 'KB_ARTICLE',
      entityId: id,
      action: 'PERMANENT_DELETE',
      performedBy: (request.user as any).id
    });

    return createResponse(null, 'Article permanently deleted');
  });

  // Bulk Restore Articles
  fastify.post('/admin/kb/articles/bulk-restore', checkManage, async (request: any, reply) => {
    const { ids } = request.body;
    await prisma.kbArticle.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: null }
    });

    for (const id of ids) await syncKbArticleToSearch(fastify, id);

    return createResponse(null, `${ids.length} articles restored successfully`);
  });

  // Bulk Permanent Delete
  fastify.delete('/admin/kb/articles/bulk-permanent', checkManage, async (request: any, reply) => {
    const { ids } = request.body;
    
    await prisma.kbArticleRevision.deleteMany({ where: { articleId: { in: ids } } });
    await prisma.kbArticle.deleteMany({ where: { id: { in: ids } } });

    for (const id of ids) await syncKbArticleToSearch(fastify, id);

    return createResponse(null, `${ids.length} articles permanently deleted`);
  });

  // ─── REVISIONS ────────────────────────────────────────────────────

  // List Revisions
  fastify.get('/admin/kb/articles/:id/revisions', checkView, async (request: any, reply) => {
    const { id } = request.params;
    const revisions = await prisma.kbArticleRevision.findMany({
      where: { articleId: id },
      orderBy: { version: 'desc' },
      include: {
        createdBy: { select: { firstName: true, lastName: true } }
      }
    });
    return createResponse(revisions);
  });

  // Restore Revision
  fastify.post('/admin/kb/articles/:id/revisions/:revId/restore', checkManage, async (request: any, reply) => {
    const { id, revId } = request.params;
    const authorId = (request.user as any).id;

    const revision = await prisma.kbArticleRevision.findUnique({
      where: { id: revId }
    });

    if (!revision) {
      return reply.status(404).send(createErrorResponse('Revision not found'));
    }

    const lastRevision = await prisma.kbArticleRevision.findFirst({
      where: { articleId: id },
      orderBy: { version: 'desc' }
    });

    const article = await prisma.kbArticle.update({
      where: { id },
      data: {
        title: revision.title,
        contentJson: (revision.contentJson as any) || undefined,
        contentText: revision.contentText || undefined,
        renderedHtml: revision.renderedHtml || undefined,
      }
    });

    // Create New Revision (as a snapshot of the restored version)
    await prisma.kbArticleRevision.create({
      data: {
        articleId: id,
        contentJson: revision.contentJson as any,
        contentText: revision.contentText,
        renderedHtml: revision.renderedHtml,
        title: revision.title,
        version: (lastRevision?.version || 0) + 1,
        createdById: authorId,
        changeNote: `Restored from version ${revision.version}`
      }
    });

    await syncKbArticleToSearch(fastify, id);

    return createResponse(article, 'Revision restored successfully');
  });

  // ─── FAQs ─────────────────────────────────────────────────────────

  fastify.get('/admin/kb/faqs', checkView, async (request: any, reply) => {
    const { categoryId } = request.query;
    const where: any = { deletedAt: null };
    if (categoryId) where.categoryId = categoryId;

    const faqs = await prisma.kbFaq.findMany({
      where,
      orderBy: { position: 'asc' },
      include: { category: { select: { name: true } } }
    });

    return createResponse(faqs);
  });

  fastify.post('/admin/kb/faqs', checkManage, async (request: any, reply) => {
    const data = request.body;
    if (data.answerJson) {
      data.answerText = extractTextFromTiptapJson(data.answerJson);
    }
    const faq = await prisma.kbFaq.create({ data });
    return createResponse(faq, 'FAQ created successfully');
  });

  fastify.put('/admin/kb/faqs/:id', checkManage, async (request: any, reply) => {
    const { id } = request.params;
    const data = request.body;
    if (data.answerJson) {
      data.answerText = extractTextFromTiptapJson(data.answerJson);
    }
    const faq = await prisma.kbFaq.update({ where: { id }, data });
    return createResponse(faq, 'FAQ updated successfully');
  });

  fastify.delete('/admin/kb/faqs/:id', checkManage, async (request: any, reply) => {
    const { id } = request.params;
    await prisma.kbFaq.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
    return createResponse(null, 'FAQ deleted successfully');
  });

  // Publish Article
  fastify.post('/admin/kb/articles/:id/publish', checkManage, async (request: any, reply) => {
    const { id } = request.params;
    const { status } = request.body;
    
    const current = await prisma.kbArticle.findUnique({ where: { id } });
    if (!current) return reply.status(404).send(createErrorResponse('Article not found'));

    if (status === 'PUBLISHED') {
      if (!current.title || current.title === 'Untitled Article') {
        return reply.status(400).send(createErrorResponse('Cannot publish: Article title is required and cannot be default'));
      }
      if (!current.categoryId) {
        return reply.status(400).send(createErrorResponse('Cannot publish: Category must be selected'));
      }
      if (!current.contentText || current.contentText.trim() === '') {
        return reply.status(400).send(createErrorResponse('Cannot publish: Article content cannot be empty'));
      }
    }

    const publishedAt = status === 'PUBLISHED' ? (current.publishedAt || new Date()) : null;

    const article = await prisma.kbArticle.update({
      where: { id },
      data: {
        status,
        publishedAt
      }
    });

    await syncKbArticleToSearch(fastify, id);

    await logActivity(fastify, {
      entityType: 'KB_ARTICLE',
      entityId: id,
      action: status === 'PUBLISHED' ? 'PUBLISH' : 'UNPUBLISH',
      performedBy: (request.user as any).id,
      details: { status }
    });

    return createResponse(article, `Article ${status.toLowerCase()} successfully`);
  });

  // Reorder Categories
  fastify.put('/admin/kb/categories/reorder', checkManage, async (request: any, reply) => {
    const { items } = request.body;
    if (!items || !Array.isArray(items)) {
      return reply.status(400).send(createErrorResponse('Invalid items array'));
    }

    await prisma.$transaction(
      items.map((item: any) =>
        prisma.kbCategory.update({
          where: { id: item.id },
          data: { position: item.position }
        })
      )
    );

    return createResponse(null, 'Categories reordered successfully');
  });

  // Reorder Articles
  fastify.put('/admin/kb/articles/reorder', checkManage, async (request: any, reply) => {
    const { items } = request.body;
    if (!items || !Array.isArray(items)) {
      return reply.status(400).send(createErrorResponse('Invalid items array'));
    }

    await prisma.$transaction(
      items.map((item: any) =>
        prisma.kbArticle.update({
          where: { id: item.id },
          data: { position: item.position }
        })
      )
    );

    for (const item of items) {
      await syncKbArticleToSearch(fastify, item.id);
    }

    return createResponse(null, 'Articles reordered successfully');
  });

  // Reorder FAQs
  fastify.put('/admin/kb/faqs/reorder', checkManage, async (request: any, reply) => {
    const { items } = request.body;
    if (!items || !Array.isArray(items)) {
      return reply.status(400).send(createErrorResponse('Invalid items array'));
    }

    await prisma.$transaction(
      items.map((item: any) =>
        prisma.kbFaq.update({
          where: { id: item.id },
          data: { position: item.position }
        })
      )
    );

    return createResponse(null, 'FAQs reordered successfully');
  });

  // Get Feedback Analytics
  fastify.get('/admin/kb/feedback/analytics', checkView, async (request, reply) => {
    try {
      // 1. Overall stats
      const totalCount = await prisma.kbFeedback.count();
      const helpfulCount = await prisma.kbFeedback.count({ where: { helpful: true } });
      const notHelpfulCount = totalCount - helpfulCount;
      const satisfactionRate = totalCount > 0 ? Math.round((helpfulCount / totalCount) * 100) : 0;

      // 2. Per-article feedback analytics
      const articlesWithFeedback = await prisma.kbArticle.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          title: true,
          slug: true,
          viewCount: true,
          feedbacks: {
            select: {
              helpful: true
            }
          }
        }
      });

      const articleStats = articlesWithFeedback
        .map(art => {
          const total = art.feedbacks.length;
          const helpful = art.feedbacks.filter(f => f.helpful).length;
          const notHelpful = total - helpful;
          const satisfaction = total > 0 ? Math.round((helpful / total) * 100) : 0;
          return {
            id: art.id,
            title: art.title,
            slug: art.slug,
            viewCount: art.viewCount,
            total,
            helpful,
            notHelpful,
            satisfaction
          };
        })
        .filter(art => art.total > 0)
        .sort((a, b) => b.total - a.total);

      // 3. Per-faq feedback analytics
      const faqsWithFeedback = await prisma.kbFaq.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          question: true,
          feedbacks: {
            select: {
              helpful: true
            }
          }
        }
      });

      const faqStats = faqsWithFeedback
        .map(faq => {
          const total = faq.feedbacks.length;
          const helpful = faq.feedbacks.filter(f => f.helpful).length;
          const notHelpful = total - helpful;
          const satisfaction = total > 0 ? Math.round((helpful / total) * 100) : 0;
          return {
            id: faq.id,
            question: faq.question,
            total,
            helpful,
            notHelpful,
            satisfaction
          };
        })
        .filter(faq => faq.total > 0)
        .sort((a, b) => b.total - a.total);

      // 4. Recent feedback responses
      const recentFeedback = await prisma.kbFeedback.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          article: {
            select: {
              id: true,
              title: true
            }
          },
          faq: {
            select: {
              id: true,
              question: true
            }
          }
        }
      });

      return createResponse({
        overall: {
          totalCount,
          helpfulCount,
          notHelpfulCount,
          satisfactionRate
        },
        articles: articleStats,
        faqs: faqStats,
        recent: recentFeedback
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to fetch feedback analytics'));
    }
  });

};

export default knowledgeBaseRoutes;
