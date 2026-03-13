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
            const url = `${apiUrl}/uploads/${folder}/${filename}`;

            // Save to Media table
            const media = await (fastify.prisma as any).media.create({
                data: {
                    filename: data.filename,
                    url: url,
                    mimetype: data.mimetype,
                    size: buffer.length,
                    key: `${folder}/${filename}`
                }
            });

            return createResponse(media, "File uploaded successfully locally");

        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("Upload failed: " + err.message));
        }
    });

}
