import { Job } from 'bullmq';
import { FastifyInstance } from 'fastify';

/**
 * Worker logic for Search Syncing
 * Offloads Typesense indexing from the request/response cycle
 */
export async function processSearchSyncJob(job: Job, fastify: FastifyInstance) {
    const { type, action, data } = job.data;
    
    fastify.log.info({ job: job.id, type, action }, 'Processing search sync job');

    try {
        if (!fastify.typesense) {
            throw new Error('Typesense plugin not initialized');
        }

        if (type === 'product') {
            const collection = fastify.typesense.collections('products');
            
            if (action === 'upsert') {
                // We expect data to be already mapped to Typesense format 
                // or we can map it here if we passed the Prisma object
                await collection.documents().upsert(data);
                fastify.log.info(`✅ Synced product ${data.id} to Typesense`);
            } else if (action === 'delete') {
                await collection.documents(data.id).delete();
                fastify.log.info(`✅ Deleted product ${data.id} from Typesense`);
            }
        }
        
        // Add more types (categories, brands) if needed
        
        return { success: true };
    } catch (err: any) {
        fastify.log.error({ err, jobId: job.id }, 'Search sync job failed');
        throw err; // BullMQ will retry based on settings
    }
}
