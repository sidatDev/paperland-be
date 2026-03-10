
import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { logActivity } from '../utils/audit';

export default async function addressRoutes(fastify: FastifyInstance) {
    
    // GET /addresses - List all addresses for current user
    fastify.get('/addresses', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const userId = (request.user as any)?.id;
        try {
            const addresses = await fastify.prisma.address.findMany({
                where: { userId, deletedAt: null },
                include: { country: true },
                orderBy: [
                    { isDefault: 'desc' },
                    { createdAt: 'desc' }
                ]
            });
            return reply.send(addresses); // Keeping it simple for the frontend which expects a raw array
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse(err.message));
        }
    });

    // POST /addresses - Create a new address
    fastify.post('/addresses', {
        preHandler: [fastify.authenticate],
        schema: {
            body: {
                type: 'object',
                required: ['firstName', 'lastName', 'street1', 'city', 'countryId', 'phone', 'zipCode'],
                properties: {
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    street1: { type: 'string' },
                    street2: { type: 'string' },
                    city: { type: 'string' },
                    state: { type: 'string' },
                    zipCode: { type: 'string' },
                    countryId: { type: 'string' },
                    phone: { type: 'string' },
                    type: { type: 'string', default: 'SHIPPING' },
                    isDefault: { type: 'boolean', default: false }
                }
            }
        }
    }, async (request, reply) => {
        const userId = (request.user as any)?.id;
        const body = request.body as any;
        // Remove phoneCountryCode if present, as it's not in the schema
        const { phoneCountryCode, ...data } = body;

        try {
            // Validation & Formatting
            const phoneRegex = /^\+?[0-9\s-]{7,20}$/;
            if (!phoneRegex.test(data.phone)) {
                return reply.status(400).send(createErrorResponse("Invalid phone number format"));
            }

            // Duplicate Check
            const existing = await fastify.prisma.address.findFirst({
                where: {
                    userId,
                    street1: data.street1,
                    city: data.city,
                    zipCode: data.zipCode,
                    countryId: data.countryId,
                    deletedAt: null
                }
            });

            if (existing) {
                return reply.status(400).send(createErrorResponse("This address already exists in your book."));
            }

            // If setting as default, unset others first
            if (data.isDefault) {
                await fastify.prisma.address.updateMany({
                    where: { userId, isDefault: true },
                    data: { isDefault: false }
                });
            }

            const address = await fastify.prisma.address.create({
                data: {
                    ...data,
                    userId
                },
                include: { country: true }
            });

            await logActivity(fastify, {
                entityType: 'ADDRESS',
                entityId: address.id,
                action: 'CREATE',
                performedBy: userId,
                details: { city: address.city, street: address.street1 },
                ip: request.ip,
                userAgent: request.headers['user-agent']
            });

            return reply.status(201).send(address);
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse(err.message));
        }
    });

    // PATCH /addresses/:id - Update an address
    fastify.patch('/addresses/:id', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const userId = (request.user as any)?.id;
        const { id } = request.params as any;
        const body = request.body as any;
        // Remove phoneCountryCode if present
        const { phoneCountryCode, ...data } = body;

        try {
            const existing = await fastify.prisma.address.findFirst({ where: { id, userId } });
            if (!existing) return reply.status(404).send(createErrorResponse("Address not found"));

            if (data.isDefault) {
                await fastify.prisma.address.updateMany({
                    where: { userId, isDefault: true, id: { not: id } },
                    data: { isDefault: false }
                });
            }

            const address = await fastify.prisma.address.update({
                where: { id },
                data,
                include: { country: true }
            });

            return reply.send(address);
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse(err.message));
        }
    });

    // DELETE /addresses/:id - Soft delete
    fastify.delete('/addresses/:id', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const userId = (request.user as any)?.id;
        const { id } = request.params as any;

        try {
            const existing = await fastify.prisma.address.findFirst({ where: { id, userId } });
            if (!existing) return reply.status(404).send(createErrorResponse("Address not found"));

            await fastify.prisma.address.update({
                where: { id },
                data: { deletedAt: new Date(), isDefault: false }
            });

            return reply.status(204).send();
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send(createErrorResponse(err.message));
        }
    });
}
