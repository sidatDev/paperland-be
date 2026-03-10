import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';

export default async function publicCmsRoutes(fastify: FastifyInstance) {
    
    // Get public CMS page by slug
    fastify.get('/api/public/cms/:slug', {
        schema: {
            description: 'Get CMS page content by slug',
            tags: ['Public Shop'],
            params: {
                type: 'object',
                properties: {
                    slug: { type: 'string' }
                }
            }
        }
    }, async (request: any, reply) => {
        const { slug } = request.params;
        try {
            const page = await (fastify.prisma as any).cMSPage.findUnique({
                where: { slug },
                select: {
                    title: true,
                    contentJson: true,
                    featuredImageUrl: true,
                    // We might include basic meta info here
                    isActive: true
                }
            });

            if (!page || !page.isActive) {
                return reply.status(404).send(createErrorResponse("Page not found"));
            }

            return createResponse(page, "Page content retrieved");
        } catch (err) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse("Failed to fetch page content"));
        }
    });

}
