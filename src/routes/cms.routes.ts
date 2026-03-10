import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { logActivity } from '../utils/audit';
import { CMS_TEMPLATES } from '../data/cms-templates';

export default async function cmsRoutes(fastify: FastifyInstance) {
    
    const logCMSAction = async (request: any, action: string, pageId: string | null, details: any) => {
        const userId = (request.user as any)?.id || 'unknown';
        const ip = request.ip;
        const userAgent = request.headers['user-agent'];

        try {
            // 1. Maintain existing CMS Log (for CMS module internal history if used)
            await (fastify.prisma as any).cMSLog.create({
                data: {
                    userId,
                    action,
                    pageId,
                    details
                }
            });

            // 2. Add to Unified System Audit Log
            await logActivity(fastify, {
                entityType: 'CMS',
                entityId: pageId || 'CMS_GLOBAL',
                action: action,
                performedBy: userId,
                details: { ...details, pageId },
                ip,
                userAgent
            });

        } catch (err) {
            fastify.log.error(err, 'Failed to log CMS action');
        }
    };

    // --- CMS TEMPLATES ---

    // List available CMS page templates
    fastify.get('/admin/cms/templates', {
        schema: { description: 'List available CMS page templates', tags: ['CMS'] }
    }, async (request, reply) => {
        try {
            return createResponse(CMS_TEMPLATES.map(t => ({
                slug: t.slug,
                title: t.title,
                description: t.description,
                schema: t.schema
            })), "Templates retrieved");
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("Failed to fetch templates"));
        }
    });

    // Seed CMS pages: create DB rows for all templates that don't have one yet
    fastify.post('/admin/cms/seed', {
        schema: { description: 'Auto-create CMS pages for all templates (only creates missing ones)', tags: ['CMS'] }
    }, async (request: any, reply) => {
        const userId = (request.user as any)?.id || 'unknown';
        try {
            const created: string[] = [];
            const skipped: string[] = [];

            for (const template of CMS_TEMPLATES) {
                const existing = await (fastify.prisma as any).cMSPage.findUnique({
                    where: { slug: template.slug }
                });

                const defaultContent = template.defaultContent || {};
                
                if (existing) {
                    // Update existing page schema (always keep schema in sync with template)
                    const currentContent = existing.contentJson;
                    const hasData = currentContent && Object.keys(currentContent as object).length > 0;
                    
                    const updateData: any = {
                        schema: JSON.stringify(template.schema),
                        title: template.title,
                    };

                    // Force content update for specific pages we recently mapped (career, media-center)
                    // or if the page has no data yet
                    if (['career', 'media-center'].includes(template.slug) || !hasData) {
                         updateData.content = JSON.stringify(template.defaultContent);
                         updateData.contentJson = template.defaultContent;
                    }

                    await (fastify.prisma as any).cMSPage.update({
                        where: { id: existing.id },
                        data: updateData
                    });
                    skipped.push(template.slug);
                    continue;
                }

                // Create new page with template schema and default content
                await (fastify.prisma as any).cMSPage.create({
                    data: {
                        title: template.title,
                        slug: template.slug,
                        schema: JSON.stringify(template.schema),
                        contentJson: defaultContent,
                        content: JSON.stringify(defaultContent),
                        isActive: true,
                        versions: {
                            create: {
                                content: JSON.stringify(defaultContent),
                                contentJson: defaultContent,
                                version: 1,
                                createdBy: userId
                            }
                        }
                    }
                });

                created.push(template.slug);
                await logCMSAction(request, 'SEED_CREATE', null, { slug: template.slug, title: template.title });
            }

            return createResponse(
                { created, skipped, totalTemplates: CMS_TEMPLATES.length },
                `Seeded ${created.length} new pages, ${skipped.length} already existed`
            );
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("Failed to seed CMS pages"));
        }
    });

    // --- CMS PAGES ---

    // List all CMS pages
    fastify.get('/admin/cms/pages', {
        schema: { 
            description: 'List all CMS pages', 
            tags: ['CMS'],
            query: {
                type: 'object',
                properties: {
                    showDeleted: { type: 'boolean' }
                }
            }
        }
    }, async (request: any, reply) => {
        const { showDeleted } = request.query;
        try {
            const pages = await (fastify.prisma as any).cMSPage.findMany({
                where: showDeleted ? {} : { deletedAt: null },
                orderBy: { updatedAt: 'desc' },
                include: {
                    versions: {
                        take: 1,
                        orderBy: { version: 'desc' },
                        select: { creator: { select: { firstName: true, lastName: true, email: true } } }
                    }
                }
            });
            return createResponse(pages, "Pages retrieved");
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("Failed to fetch pages"));
        }
    });

    // Get a single CMS page with history
    fastify.get('/admin/cms/pages/:id', {
        schema: { description: 'Get CMS page details', tags: ['CMS'] }
    }, async (request: any, reply) => {
        const { id } = request.params;
        try {
            const page = await (fastify.prisma as any).cMSPage.findUnique({
                where: { id },
                include: {
                    versions: {
                        orderBy: { version: 'desc' },
                        include: { creator: { select: { firstName: true, lastName: true } } }
                    }
                }
            });
            if (!page) return reply.status(404).send(createErrorResponse("Page not found"));
            return createResponse(page, "Page retrieved");
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("Failed to fetch page details"));
        }
    });

    // Create a new CMS page
    fastify.post('/admin/cms/pages', {
        schema: {
            description: 'Create a CMS page',
            tags: ['CMS'],
            body: {
                type: 'object',
                required: ['title', 'slug'],
                properties: {
                    title: { type: 'string' },
                    slug: { type: 'string' },
                    content: { type: 'string' },
                    schema: { type: 'string', nullable: true },      // Changed to String for order preservation
                    contentJson: { type: 'object', nullable: true }, // New: Structured Content
                    featuredImageUrl: { type: 'string', nullable: true },
                    isActive: { type: 'boolean' }
                }
            }
        }
    }, async (request: any, reply) => {
        const { title, slug, content, schema, contentJson, featuredImageUrl, isActive } = request.body;
        const userId = (request.user as any)?.id || 'unknown';
        try {
            // Sync content and contentJson
            let finalContent = content;
            let finalContentJson = contentJson;

            if (contentJson && !content) {
                finalContent = JSON.stringify(contentJson);
            } else if (content && !contentJson) {
                try {
                    finalContentJson = JSON.parse(content);
                } catch (e) {
                    finalContentJson = undefined;
                }
            }

            const page = await (fastify.prisma as any).cMSPage.create({
                data: {
                    title,
                    slug,
                    content: finalContent,
                    schema: schema || undefined,
                    contentJson: finalContentJson || undefined,
                    featuredImageUrl,
                    isActive: isActive ?? true,
                    versions: {
                        create: {
                            content: finalContent || '',
                            contentJson: finalContentJson || undefined,
                            version: 1,
                            createdBy: userId
                        }
                    }
                }
            });
            
            await logCMSAction(request, 'CREATE', page.id, { title, slug });
            return createResponse(page, "Page created successfully");
        } catch (err: any) {
            fastify.log.error(err);
            if (err.code === 'P2002') return reply.status(400).send(createErrorResponse("Slug already exists"));
            return reply.status(500).send(createErrorResponse("Failed to create page"));
        }
    });

    // Update a CMS page
    fastify.put('/admin/cms/pages/:id', {
        schema: {
            description: 'Update a CMS page',
            tags: ['CMS']
        }
    }, async (request: any, reply) => {
        const { id } = request.params;
        const { title, slug, content, schema, contentJson, featuredImageUrl, isActive } = request.body;
        const userId = (request.user as any)?.id || 'unknown';
        const userRole = (request.user as any)?.role?.name; // Assuming role is populated

        try {
            const existing = await (fastify.prisma as any).cMSPage.findUnique({
                where: { id },
                include: { versions: { take: 1, orderBy: { version: 'desc' } } }
            });

            if (!existing) return reply.status(404).send(createErrorResponse("Page not found"));

            // Sync content and contentJson
            let finalContent = content;
            let finalContentJson = contentJson;

            if (contentJson !== undefined && content === undefined) {
                finalContent = JSON.stringify(contentJson);
            } else if (content !== undefined && contentJson === undefined) {
                try {
                    finalContentJson = JSON.parse(content);
                } catch (e) {
                    // If content is not valid JSON, leave contentJson alone or set to null?
                    // Better to keep it undefined if it fails to parse
                }
            }

            // Super Admin check for schema updates
            let updateData: any = {
                title,
                slug,
                content: finalContent,
                contentJson: finalContentJson,
                featuredImageUrl,
                isActive,
                deletedAt: request.body.deletedAt === null ? null : undefined
            };

            // Only allow schema update if super_admin (logic to be refined based on actual role text)
            // For now, allow it but we should strictly check permissions in production or via middleware
            if (schema !== undefined) {
                 updateData.schema = schema; // Expects string
            }

            const lastVersion = existing.versions[0]?.version || 0;
            const contentChanged = (finalContent !== undefined && finalContent !== existing.content) || 
                                 (finalContentJson !== undefined && JSON.stringify(finalContentJson) !== JSON.stringify(existing.contentJson));

            const updated = await (fastify.prisma as any).cMSPage.update({
                where: { id },
                data: {
                    ...updateData,
                    versions: contentChanged ? {
                        create: {
                            content: finalContent || existing.content || '',
                            contentJson: finalContentJson || existing.contentJson || undefined,
                            version: lastVersion + 1,
                            createdBy: userId
                        }
                    } : undefined
                }
            });

            await logCMSAction(request, 'UPDATE', id, { title, slug, versioned: contentChanged });
            return createResponse(updated, "Page updated successfully");
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("Failed to update page"));
        }
    });

    // Restore a version
    fastify.post('/admin/cms/pages/:id/restore', async (request: any, reply) => {
        const { id } = request.params;
        
        // Comprehensive logging
        fastify.log.info({
            params: request.params,
            body: request.body,
            headers: request.headers,
            contentType: request.headers['content-type']
        }, 'Restore endpoint hit');
        
        const { versionId } = request.body || {};
        const userId = (request.user as any)?.id || 'unknown';

        if (!versionId) {
            fastify.log.error({ body: request.body }, 'versionId not found in body');
            return reply.status(400).send(createErrorResponse("versionId is required"));
        }

        try {
            const version = await (fastify.prisma as any).cMSVersion.findUnique({
                where: { id: versionId }
            });

            if (!version || version.pageId !== id) {
                return reply.status(404).send(createErrorResponse("Version not found"));
            }

            let finalContentJson = version.contentJson;
            if (!finalContentJson && version.content) {
                try {
                    finalContentJson = JSON.parse(version.content);
                } catch (e) {
                    finalContentJson = undefined;
                }
            }

            const page = await (fastify.prisma as any).cMSPage.update({
                where: { id },
                data: { 
                    content: version.content,
                    contentJson: finalContentJson || undefined
                }
            });

            await logCMSAction(request, 'RESTORE', id, { version: version.version, versionId });
            return createResponse(page, `Restored to version ${version.version}`);
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("Failed to restore version"));
        }
    });

    fastify.delete('/admin/cms/pages/:id', {
        schema: { 
            description: 'Delete a CMS page (Soft or Hard)', 
            tags: ['CMS'],
            query: {
                type: 'object',
                properties: {
                    force: { type: 'boolean' }
                }
            }
        }
    }, async (request: any, reply) => {
        const { id } = request.params;
        const { force } = request.query;
        try {
            if (force) {
                // Hard Delete
                await (fastify.prisma as any).cMSPage.delete({
                    where: { id }
                });
                await logCMSAction(request, 'HARD_DELETE', id, { permanent: true });
            } else {
                // Soft Delete
                const page = await (fastify.prisma as any).cMSPage.update({
                    where: { id },
                    data: { deletedAt: new Date() }
                });
                await logCMSAction(request, 'DELETE', id, { title: page.title });
            }
            
            return createResponse(null, force ? "Page permanently deleted" : "Page deleted successfully");
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("Failed to delete page"));
        }
    });

    // --- MEDIA GALLERY ---

    // List all media
    fastify.get('/admin/cms/media', {
        schema: { description: 'List all media assets', tags: ['CMS'] }
    }, async (request, reply) => {
        try {
            const media = await (fastify.prisma as any).media.findMany({
                orderBy: { createdAt: 'desc' }
            });
            return createResponse(media, "Media assets retrieved");
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("Failed to fetch media assets"));
        }
    });

    // Delete media
    fastify.delete('/admin/cms/media/:id', {
        schema: { description: 'Delete media asset', tags: ['CMS'] }
    }, async (request: any, reply) => {
        const { id } = request.params;
        try {
            await (fastify.prisma as any).media.delete({ where: { id } });
            return createResponse(null, "Media deleted successfully");
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("Failed to delete media asset"));
        }
    });

    // --- LOGS ---

    // Get CMS action logs
    fastify.get('/admin/cms/logs', {
        schema: { description: 'Get CMS action logs', tags: ['CMS'] }
    }, async (request, reply) => {
        try {
            const logs = await (fastify.prisma as any).cMSLog.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    user: { select: { firstName: true, lastName: true, email: true } },
                    page: { select: { title: true } }
                },
                take: 100
            });
            return createResponse(logs, "CMS logs retrieved");
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("Failed to fetch logs"));
        }
    });
}
