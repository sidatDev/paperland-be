import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Client } from 'typesense';

declare module 'fastify' {
  interface FastifyInstance {
    typesense: Client;
  }
}

async function typesensePlugin(fastify: FastifyInstance) {
  const rawHost = process.env.TYPESENSE_HOST || 'localhost';
  const protocol = process.env.TYPESENSE_PROTOCOL || 'http';
  const port = parseInt(process.env.TYPESENSE_PORT || '80');

  // Robust host parsing: 
  // 1. Remove protocol if user accidentally included it
  // 2. Remove trailing slash
  // 3. Keep the full hostname/domain even if it has dots
  const host = rawHost
    .replace('http://', '')
    .replace('https://', '')
    .replace(/\/$/, '') // Remove trailing slash
    .split(':')[0]; // Still strip port if present, as it's separate in typesense-js options

  fastify.log.info({ host, port, protocol }, 'Initializing Typesense client');

  const client = new Client({
    nodes: [
      {
        host: host,
        port: port,
        protocol: protocol,
      },
    ],
    apiKey: process.env.TYPESENSE_API_KEY || 'xyz',
    connectionTimeoutSeconds: 10,
  });

  try {
    // Basic health check
    await client.health.retrieve();
    fastify.log.info(`✅ Typesense client initialized and healthy at ${protocol}://${host}:${port}`);
    fastify.decorate('typesense', client);
  } catch (error: any) {
    fastify.log.error({ 
      err: error,
      host,
      port,
      protocol,
      message: error.message,
      code: error.code
    }, '❌ Failed to connect to Typesense during initialization');
    
    // We still decorate it but subsequent calls might fail
    fastify.decorate('typesense', client);
  }
}

export default fp(typesensePlugin);
