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
