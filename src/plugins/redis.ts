import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import Redis from 'ioredis';

export default fp(async (fastify: FastifyInstance) => {
  const redisEnabled = process.env.REDIS_ENABLED === 'true';
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisEnabled) {
    fastify.log.info('[Redis] Caching is disabled via REDIS_ENABLED=false');
    return;
  }

  if (!redisUrl) {
    fastify.log.warn('[Redis] REDIS_URL is not defined in environment variables. Falling back to localhost:6379.');
  }

  const connectionString = redisUrl || 'redis://localhost:6379';
  const maskedUrl = connectionString.replace(/:[^:@/]+@/, ':****@');
  fastify.log.info(`[Redis] Connecting to: ${maskedUrl}`);

  let lastErrorTime = 0;
  const ERROR_LOG_COOLDOWN = 10000; // Log error every 10 seconds only

  try {
    const redis = new Redis(connectionString, {
        maxRetriesPerRequest: 3, // Don't block indefinitely
        enableOfflineQueue: false, // Fail fast if not connected
        commandTimeout: 5000, // 5 seconds timeout for any command
        autoResubscribe: false,
        retryStrategy(times) {
            // Gradually slow down retries, capped at 30 seconds
            const delay = Math.min(times * 500, 30000);
            return delay;
        }
    });

    redis.on('connect', () => {
      fastify.log.info('✅ Redis connected successfully');
      lastErrorTime = 0; // Reset error tracker
    });

    redis.on('error', (err: any) => {
      // Only log if redis exists and we haven't logged recently
      const now = Date.now();
      if (now - lastErrorTime > ERROR_LOG_COOLDOWN) {
        // Only log if it's not a local connection failure (since we might be waiting for it) or if explicitly enabled
        if (!connectionString.includes('localhost') || process.env.NODE_ENV === 'development') {
            fastify.log.error(`[Redis] Connection failed: ${err.message}`);
        }
        lastErrorTime = now;
      }
    });

    fastify.decorate('redis', redis);

    fastify.addHook('onClose', async (server) => {
      if (server.redis) {
        try {
          await server.redis.quit();
        } catch (e) {
          server.redis.disconnect();
        }
      }
    });

  } catch (err) {
    fastify.log.error(err as Error, 'Failed to initialize Redis client');
  }
});

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}
