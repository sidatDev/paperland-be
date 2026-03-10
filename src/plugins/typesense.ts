import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Client } from 'typesense';

declare module 'fastify' {
  interface FastifyInstance {
    typesense: Client;
  }
}

async function typesensePlugin(fastify: FastifyInstance) {
  const client = new Client({
    nodes: [
      {
        host: process.env.TYPESENSE_HOST || 'typesense-n888cg0k0kko4gks8kgs4s0s.178.18.252.45.sslip.io',
        port: parseInt(process.env.TYPESENSE_PORT || '80'),
        protocol: process.env.TYPESENSE_PROTOCOL || 'http',
      },
    ],
    apiKey: process.env.TYPESENSE_API_KEY || 'nU4A1FjMs5iowjv21IpkoAnu9KdPeZU47u7I',
    connectionTimeoutSeconds: 5,
  });

  try {
    // Basic health check
    await client.health.retrieve();
    fastify.log.info('Typesense client initialized and healthy');
    fastify.decorate('typesense', client);
  } catch (error) {
    fastify.log.error({ err: error }, 'Failed to connect to Typesense');
    // We still decorate it but subsequent calls might fail
    fastify.decorate('typesense', client);
  }
}

export default fp(typesensePlugin);
