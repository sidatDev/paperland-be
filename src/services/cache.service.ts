import { FastifyInstance } from 'fastify';

export class CacheService {
  private fastify: FastifyInstance;
  private defaultTTL = 3600; // 1 hour

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.fastify.redis) return null;
      const data = await this.fastify.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      this.fastify.log.error(err, `Cache GET error for key: ${key}`);
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    try {
      if (!this.fastify.redis) return;
      await this.fastify.redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (err) {
      this.fastify.log.error(err, `Cache SET error for key: ${key}`);
    }
  }

  /**
   * Delete a key from cache
   */
  async del(key: string): Promise<void> {
    try {
      if (!this.fastify.redis) return;
      await this.fastify.redis.del(key);
    } catch (err) {
      this.fastify.log.error(err, `Cache DEL error for key: ${key}`);
    }
  }

  /**
   * Clear cache by pattern
   */
  async clearPattern(pattern: string): Promise<void> {
    try {
      if (!this.fastify.redis) return;
      const keys = await this.fastify.redis.keys(pattern);
      if (keys.length > 0) {
        await this.fastify.redis.del(...keys);
      }
    } catch (err) {
      this.fastify.log.error(err, `Cache CLEAR error for pattern: ${pattern}`);
    }
  }

  /**
   * Cache-aside pattern: Get from cache, or fetch, set, and return
   */
  async wrap<T>(key: string, fetchFn: () => Promise<T>, ttl: number = this.defaultTTL): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const freshData = await fetchFn();
    await this.set(key, freshData, ttl);
    return freshData;
  }

  /**
   * Invalidate all shop-related cache keys
   */
  async invalidateShopCache(type: 'products' | 'categories' | 'home' | 'all' = 'all'): Promise<void> {
    if (type === 'products' || type === 'all') await this.clearPattern('shop:products:*');
    if (type === 'categories' || type === 'all') await this.clearPattern('shop:categories:*');
    if (type === 'home' || type === 'all') await this.clearPattern('shop:home:*');
    this.fastify.log.info(`[Cache] Invalidated shop cache: ${type}`);
  }

  /**
   * Invalidate cache for a specific product and its parent if it is a variant
   */
  async invalidateProductCache(product: { id: string; slug?: string | null; parentId?: string | null }): Promise<void> {
    try {
      if (product.slug) {
        await this.clearPattern(`product:${product.slug}:*`);
      }
      await this.clearPattern(`product:${product.id}:*`);

      // If it has parent, find parent and clear parent's cache as well
      if (product.parentId) {
        const parent = await (this.fastify.prisma as any).product.findUnique({
          where: { id: product.parentId },
          select: { slug: true }
        });
        if (parent?.slug) {
          await this.clearPattern(`product:${parent.slug}:*`);
        }
        await this.clearPattern(`product:${product.parentId}:*`);
      }

      // Invalidate general shop/search listings, categories and home cache
      await this.invalidateShopCache('all');
    } catch (err) {
      this.fastify.log.error(err, `Failed to invalidate product cache for ID: ${product.id}`);
    }
  }
}

// Fastify plugin to decorate instance with cache service
import fp from 'fastify-plugin';

export default fp(async (fastify: FastifyInstance) => {
  const cacheService = new CacheService(fastify);
  fastify.decorate('cache', cacheService);
});

declare module 'fastify' {
  interface FastifyInstance {
    cache: CacheService;
  }
}
