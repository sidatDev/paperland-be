import fp from 'fastify-plugin';
import { Queue, Worker } from 'bullmq';
import { FastifyInstance } from 'fastify';

export default fp(async (fastify: FastifyInstance) => {
  const redisEnabled = process.env.REDIS_ENABLED === 'true';
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  if (!redisEnabled) {
    fastify.log.warn('[ImportQueue] Redis is disabled. Bulk import will not work.');
    return;
  }

  // BullMQ connection configuration
  const connection = {
    url: redisUrl,
    // Add any specific Redis connection options needed for BullMQ
  };

  // Define the main import queue
  const importQueue = new Queue('product-import', { 
    connection: {
        host: new URL(redisUrl).hostname,
        port: parseInt(new URL(redisUrl).port) || 6379,
        password: new URL(redisUrl).password || undefined,
    }
  });

  // Initialize Worker (Only if Redis is enabled)
  const { processImportJob } = await import('../services/import-worker.service');
  const worker = new Worker('product-import', processImportJob, {
    connection: {
        host: new URL(redisUrl).hostname,
        port: parseInt(new URL(redisUrl).port) || 6379,
        password: new URL(redisUrl).password || undefined,
    },
    concurrency: 1, // One import at a time to keep DB healthy
  });

  worker.on('completed', (job) => {
    fastify.log.info(`✅ Import Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    fastify.log.error(`❌ Import Job ${job?.id} failed: ${err.message}`);
  });

  // Register decorated queue for access in routes
  fastify.decorate('importQueue', importQueue);

  fastify.addHook('onClose', async (instance) => {
    await instance.importQueue.close();
  });

  fastify.log.info('🚀 Product Import Queue initialized');
});

declare module 'fastify' {
  interface FastifyInstance {
    importQueue: Queue;
  }
}
