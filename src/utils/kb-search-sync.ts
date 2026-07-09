import { FastifyInstance } from 'fastify';
import { KbArticle } from '@prisma/client';

/**
 * Syncs a published KB article to Typesense.
 * If status is not PUBLISHED, it removes the article from Typesense.
 */
export async function syncKbArticleToSearch(fastify: FastifyInstance, articleId: string) {
  const prisma = fastify.prisma;
  const typesense = (fastify as any).typesense;

  if (!typesense) return;

  const article = await prisma.kbArticle.findUnique({
    where: { id: articleId },
    include: { category: { select: { name: true, slug: true } } }
  });

  if (!article || article.deletedAt) {
    try {
      await typesense.collections('knowledge_base').documents(articleId).delete();
    } catch (e) {}
    return;
  }

  const lowerTitle = article.title.trim().toLowerCase();
  const isUntitled = lowerTitle === 'untitled' || lowerTitle === 'untitled article';

  if (article.status !== 'PUBLISHED' || article.visibility !== 'PUBLIC' || isUntitled) {
    // Remove from index if not public/published/titled
    try {
      await typesense.collections('knowledge_base').documents(article.id).delete();
    } catch (e) {}
    return;
  }

  // Prep document
  const document = {
    id: article.id,
    title: article.title,
    slug: article.slug,
    content: article.contentText || '',
    category: article.category?.name || 'Uncategorized',
    category_slug: article.category?.slug || '',
    tags: article.tags || [],
    published_at: article.publishedAt ? Math.floor(article.publishedAt.getTime() / 1000) : 0,
    view_count: article.viewCount,
    popularity_score: article.viewCount || 0 // Can be expanded later
  };

  try {
    // Ensure collection exists (lazy creation or skip if already handled)
    await typesense.collections('knowledge_base').documents().upsert(document);
  } catch (error) {
    fastify.log.error({ err: error, articleId: article.id }, 'Failed to sync KB article to Typesense');
  }
}
