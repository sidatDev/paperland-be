import { PrismaClient } from '@prisma/client';
import { s3Client, S3_BUCKET_NAME } from '../plugins/storage';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

const prisma = new PrismaClient();

async function streamToBuffer(stream: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', (chunk: any) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
}

async function run() {
    console.log('Starting image optimization backfill...');
    
    // Fetch all image media
    const mediaFiles = await prisma.media.findMany({
        where: {
            mimetype: {
                startsWith: 'image/'
            },
            // we don't need to re-process webp files
            NOT: {
                mimetype: 'image/webp'
            }
        }
    });

    console.log(`Found ${mediaFiles.length} images to process.`);

    let successCount = 0;
    let failCount = 0;

    for (const media of mediaFiles) {
        try {
            console.log(`Processing ${media.filename} (${media.key})...`);
            
            // 1. Download original from S3
            const getCommand = new GetObjectCommand({
                Bucket: S3_BUCKET_NAME,
                Key: media.key
            });
            const response = await s3Client.send(getCommand);
            const originalBuffer = await streamToBuffer(response.Body);

            // 2. Convert to webp
            const webpBuffer = await sharp(originalBuffer).webp({ quality: 80 }).toBuffer();
            
            // 3. Construct new webp key
            // E.g., folder/1234abcd.jpg -> folder/1234abcd.webp
            const extensionRegex = /\.(jpg|jpeg|png|gif|bmp)$/i;
            const webpKey = media.key.replace(extensionRegex, '.webp');

            // 4. Upload webp
            const putCommand = new PutObjectCommand({
                Bucket: S3_BUCKET_NAME,
                Key: webpKey,
                Body: webpBuffer,
                ContentType: 'image/webp'
            });

            await s3Client.send(putCommand);
            console.log(`  -> Successfully uploaded ${webpKey}`);
            successCount++;

        } catch (error) {
            console.error(`  -> Failed to process ${media.filename}:`, error);
            failCount++;
        }
    }

    console.log('--- Summary ---');
    console.log(`Successfully processed: ${successCount}`);
    console.log(`Failed to process: ${failCount}`);
    console.log('Done.');
    
    await prisma.$disconnect();
}

run().catch(console.error);
