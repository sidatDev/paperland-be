import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { s3Client, S3_BUCKET_NAME } from '../plugins/storage';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import path from 'path';
import sharp from 'sharp';

export default async function uploadRoutes(fastify: FastifyInstance) {
    
    fastify.post('/admin/upload', {
        schema: {
            description: 'Upload a file to S3',
            tags: ['Upload'],
            consumes: ['multipart/form-data'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: {
                            type: 'object',
                            properties: {
                                url: { type: 'string' }
                            }
                        }
                    }
                },
                400: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' },
                        success: { type: 'boolean' }
                    }
                },
                500: {
                    type: 'object',
                    properties: {
                        message: { type: 'string' },
                        success: { type: 'boolean' }
                    }
                }
            }
        }
    }, async (request: any, reply) => {
        try {
            const data = await request.file();
            const folder = request.query.folder || 'products';
            
            if (!data) {
                return reply.status(400).send(createErrorResponse("No file uploaded"));
            }

            const buffer = await data.toBuffer();
            const ext = path.extname(data.filename);
            const uuid = randomUUID();
            const key = `${folder}/${uuid}${ext}`;

            // 1. Upload Original Image
            const command = new PutObjectCommand({
                Bucket: S3_BUCKET_NAME,
                Key: key,
                Body: buffer,
                ContentType: data.mimetype,
            });

            await s3Client.send(command);

            // 2. Process and Upload WebP Version (if it's an image)
            if (data.mimetype.startsWith('image/')) {
                try {
                    const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();
                    const webpKey = `${folder}/${uuid}.webp`;
                    
                    const webpCommand = new PutObjectCommand({
                        Bucket: S3_BUCKET_NAME,
                        Key: webpKey,
                        Body: webpBuffer,
                        ContentType: 'image/webp',
                    });

                    await s3Client.send(webpCommand);
                } catch (sharpErr) {
                    fastify.log.warn({ err: sharpErr }, `Failed to generate WebP for ${data.filename}`);
                    // We don't fail the entire upload if webp generation fails, we just log it.
                }
            }

            // Construct public URL
            const endpoint = process.env.S3_ENDPOINT?.replace(/\/$/, ""); 
            const url = `${endpoint}/${S3_BUCKET_NAME}/${key}`;

            // Save to Media table
            const media = await (fastify.prisma as any).media.create({
                data: {
                    filename: data.filename,
                    url: url,
                    mimetype: data.mimetype,
                    size: buffer.length,
                    key: key
                }
            });

            return createResponse(media, "File uploaded successfully");

        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("Upload failed: " + err.message));
        }
    });

}
