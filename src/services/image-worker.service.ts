import { Job } from 'bullmq';
import { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * Worker logic for Image Optimization
 * Converts images to WebP and generates thumbnails
 */
export async function processImageJob(job: Job, fastify: FastifyInstance) {
    const { url, key, mimetype, folder } = job.data;
    
    fastify.log.info({ job: job.id, key }, 'Processing image optimization job');

    if (!mimetype?.startsWith('image/')) {
        return { skipped: true, reason: 'Not an image' };
    }

    try {
        const isS3 = !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);
        let buffer: Buffer;

        // 1. Get the source buffer
        if (isS3) {
            const { s3Client, S3_BUCKET_NAME } = await import('../plugins/storage');
            const { GetObjectCommand } = await import('@aws-sdk/client-s3');
            
            const response = await s3Client.send(new GetObjectCommand({
                Bucket: S3_BUCKET_NAME,
                Key: key
            }));
            
            const chunks = [];
            for await (const chunk of response.Body as any) {
                chunks.push(chunk);
            }
            buffer = Buffer.concat(chunks);
        } else {
            // Local file
            const filePath = path.join(process.cwd(), 'public', 'uploads', key);
            buffer = await fs.readFile(filePath);
        }

        // 2. Process with Sharp
        const uuid = path.basename(key, path.extname(key));
        const webpFilename = `${uuid}.webp`;
        const webpKey = `${folder}/${webpFilename}`;
        
        const webpBuffer = await sharp(buffer)
            .webp({ quality: 80 })
            .toBuffer();

        // 3. Save optimized version
        if (isS3) {
            const { s3Client, S3_BUCKET_NAME } = await import('../plugins/storage');
            await s3Client.send(new PutObjectCommand({
                Bucket: S3_BUCKET_NAME,
                Key: webpKey,
                Body: webpBuffer,
                ContentType: 'image/webp',
                ACL: 'public-read'
            }));
            fastify.log.info(`✅ Optimized image saved to S3: ${webpKey}`);
        } else {
            const uploadPath = path.join(process.cwd(), 'public', 'uploads', folder);
            const webpPath = path.join(uploadPath, webpFilename);
            await fs.writeFile(webpPath, webpBuffer);
            fastify.log.info(`✅ Optimized image saved locally: ${webpPath}`);
        }

        return { success: true, webpKey };
    } catch (err: any) {
        fastify.log.error({ err, jobId: job.id }, 'Image optimization job failed');
        throw err;
    }
}
