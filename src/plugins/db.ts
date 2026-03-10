import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default fp(async (fastify: FastifyInstance) => {
  try {
    await prisma.$connect();
    fastify.decorate('prisma', prisma);
    
    fastify.addHook('onClose', async (server) => {
      await server.prisma.$disconnect();
    });

    fastify.log.info('Prisma connected successfully');
  } catch (err) {
    fastify.log.error(err as Error, 'Failed to connect to database via Prisma');
    throw err;
  }
});

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}
