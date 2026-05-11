import fp from 'fastify-plugin';
import { Queue, Worker, ConnectionOptions } from 'bullmq';
import { FastifyInstance } from 'fastify';

/**
 * Unified BullMQ Plugin
 * Manages all background queues: Product Import, Search Sync, Image Optimization
 */
export default fp(async (fastify: FastifyInstance) => {
    const redisEnabled = process.env.REDIS_ENABLED === 'true';
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    if (!redisEnabled) {
        fastify.log.warn('[BullMQ] Redis is disabled. Background jobs will not work.');
        return;
    }

    const url = new URL(redisUrl);
    const connection: ConnectionOptions = {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
    };

    // 1. Initialize Queues
    const queues = {
        import: new Queue('product-import', { connection }),
        search: new Queue('search-sync', { connection }),
        image: new Queue('image-optimization', { connection }),
        orders: new Queue('order-tasks', { connection })
    };

    // 2. Register Decorated Queues
    fastify.decorate('queues', queues);

    // 3. Initialize Workers
    // Product Import Worker (Existing)
    const { processImportJob } = await import('../services/import-worker.service');
    const importWorker = new Worker('product-import', (job) => processImportJob(job), { 
        connection,
        concurrency: 1 
    });

    // Search Sync Worker
    const { processSearchSyncJob } = await import('../services/search-worker.service');
    const searchWorker = new Worker('search-sync', (job) => processSearchSyncJob(job, fastify), { 
        connection,
        concurrency: 5 
    });

    // Image Optimization Worker
    const { processImageJob } = await import('../services/image-worker.service');
    const imageWorker = new Worker('image-optimization', (job) => processImageJob(job, fastify), { 
        connection,
        concurrency: 2 
    });

    // Order Tasks Worker (New)
    const { processOrderCancellationTask } = await import('../services/order-task.service');
    const orderWorker = new Worker('order-tasks', async (job) => {
        if (job.name === 'auto-cancel-expired') {
            await processOrderCancellationTask(fastify);
        }
    }, { 
        connection,
        concurrency: 1 
    });

    // 4. Schedule Repeatable Jobs
    // Run every hour to check for expired orders
    await queues.orders.add('auto-cancel-expired', {}, {
        repeat: { pattern: '0 * * * *' } // Every hour at minute 0
    });

    // 5. Logging & Error Handling
    [importWorker, searchWorker, imageWorker, orderWorker].forEach((worker, idx) => {
        const name = ['Import', 'Search', 'Image', 'Order'][idx];
        
        worker.on('completed', (job) => {
            fastify.log.info(`✅ ${name} Job ${job?.id} completed`);
        });

        worker.on('failed', (job, err) => {
            fastify.log.error(`❌ ${name} Job ${job?.id} failed: ${err.message}`);
        });
    });

    // 6. Cleanup
    fastify.addHook('onClose', async (instance) => {
        await Promise.all([
            ...Object.values(instance.queues).map(q => q.close()),
            importWorker.close(),
            searchWorker.close(),
            imageWorker.close(),
            orderWorker.close()
        ]);
    });

    fastify.log.info('🚀 BullMQ (Import, Search, Image, Order) initialized');
});

declare module 'fastify' {
    interface FastifyInstance {
        queues: {
            import: Queue;
            search: Queue;
            image: Queue;
            orders: Queue;
        };
    }
}
