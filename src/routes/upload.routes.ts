import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';

export default async function uploadRoutes(fastify: FastifyInstance) {
    
    fastify.post('/admin/upload', {
        schema: {
            description: 'Upload a file to local storage',
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
            const filename = `${uuid}${ext}`;

            const isS3Configured = !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);
            let url: string;
            let key: string;

            if (isS3Configured) {
                const { s3Client, S3_BUCKET_NAME } = await import('../plugins/storage');
                const { PutObjectCommand, CreateBucketCommand } = await import('@aws-sdk/client-s3');
                
                console.log(`[S3 DEBUG] Attempting upload to: ${process.env.S3_ENDPOINT} | Bucket: ${S3_BUCKET_NAME}`);
                try {
                    await s3Client.send(new CreateBucketCommand({ Bucket: S3_BUCKET_NAME }));
                } catch (e: any) {
                    console.log(`[S3 DEBUG] Bucket creation check: ${e.message}`);
                }

                key = `${folder}/${filename}`;

                // Upload original file
                await s3Client.send(new PutObjectCommand({
                    Bucket: S3_BUCKET_NAME,
                    Key: key,
                    Body: buffer,
                    ContentType: data.mimetype,
                    ACL: 'public-read'
                }));

                const endpoint = (process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT || "").replace(/\/$/, "");
                url = `${endpoint}/${S3_BUCKET_NAME}/${key}`;

                // Process and Save WebP Version (if it's an image)
                if (data.mimetype.startsWith('image/')) {
                    try {
                        const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();
                        const webpFilename = `${uuid}.webp`;
                        const webpKey = `${folder}/${webpFilename}`;
                        
                        await s3Client.send(new PutObjectCommand({
                            Bucket: S3_BUCKET_NAME,
                            Key: webpKey,
                            Body: webpBuffer,
                            ContentType: 'image/webp',
                            ACL: 'public-read'
                        }));
                    } catch (sharpErr) {
                        fastify.log.warn({ err: sharpErr }, `Failed to generate WebP for ${data.filename} on S3`);
                    }
                }
            } else {
                const uploadPath = path.join(process.cwd(), 'public', 'uploads', folder);
                
                // Ensure folder exists
                await fs.mkdir(uploadPath, { recursive: true });

                const filePath = path.join(uploadPath, filename);
                await fs.writeFile(filePath, buffer);

                // 2. Process and Save WebP Version (if it's an image)
                if (data.mimetype.startsWith('image/')) {
                    try {
                        const webpBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();
                        const webpFilename = `${uuid}.webp`;
                        const webpPath = path.join(uploadPath, webpFilename);
                        await fs.writeFile(webpPath, webpBuffer);
                    } catch (sharpErr) {
                        fastify.log.warn({ err: sharpErr }, `Failed to generate WebP for ${data.filename}`);
                    }
                }

                const apiUrl = process.env.API_URL || `http://127.0.0.1:${process.env.PORT || 3001}`;
                url = `${apiUrl}/uploads/${folder}/${filename}`;
                key = `${folder}/${filename}`;
            }

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

            return createResponse(media, isS3Configured ? "File uploaded successfully to S3" : "File uploaded successfully locally");

        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("Upload failed: " + err.message));
        }
    });
    
    fastify.post('/s3-upload', {
        schema: {
            description: 'Upload a file to SeaweedFS (S3)',
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
            if (!data) return reply.status(400).send(createErrorResponse("No file uploaded"));

            const { s3Client, S3_BUCKET_NAME } = await import('../plugins/storage');
            const { PutObjectCommand, CreateBucketCommand } = await import('@aws-sdk/client-s3');
            
            // Try to create bucket if it doesn't exist (ignore error if it already exists)
            try {
                await s3Client.send(new CreateBucketCommand({ Bucket: S3_BUCKET_NAME }));
            } catch (e) {}

            const buffer = await data.toBuffer();
            const ext = path.extname(data.filename);
            const filename = `${randomUUID()}${ext}`;
            
            const command = new PutObjectCommand({
                Bucket: S3_BUCKET_NAME,
                Key: filename,
                Body: buffer,
                ContentType: data.mimetype
            });
            
            await s3Client.send(command);
            
            const endpoint = (process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT || "").replace(/\/$/, "");
            const url = `${endpoint}/${S3_BUCKET_NAME}/${filename}`;
            
            return createResponse({ url }, "File uploaded to S3 successfully");
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("S3 Upload failed: " + err.message));
        }
    });

}
