import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Client } from 'typesense';

declare module 'fastify' {
  interface FastifyInstance {
    typesense: Client;
  }
}

async function typesensePlugin(fastify: FastifyInstance) {
  const host = (process.env.TYPESENSE_HOST || 'localhost')
    .replace('http://', '')
    .replace('https://', '')
    .split(':')[0]; // Strip protocol and port if present

  const client = new Client({
    nodes: [
      {
        host: host,
        port: parseInt(process.env.TYPESENSE_PORT || '80'),
        protocol: process.env.TYPESENSE_PROTOCOL || 'http',
      },
    ],
    apiKey: process.env.TYPESENSE_API_KEY || 'xyz',
    connectionTimeoutSeconds: 10,
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
