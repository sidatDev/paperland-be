import fp from 'fastify-plugin';
import fastifyJwt, { JWT } from '@fastify/jwt';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export default fp(async (fastify: FastifyInstance) => {
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'supersecret',
    sign: {
      expiresIn: '8h',
    },
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.send(err);
    }
  });

  fastify.decorate('requireSuperAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const user = request.user as any;
      if (!user || user.role?.toUpperCase() !== 'SUPER_ADMIN') {
        return reply.status(403).send({ 
          status: 'error',
          message: 'Forbidden: Requires SUPER_ADMIN role.',
          code: 'FORBIDDEN'
        });
      }
    } catch (err) {
      return reply.status(401).send({ message: 'Unauthorized' });
    }
  });

  fastify.decorate('hasPermission', (permissionKey: string) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
        const user = request.user as any;
        
        // SUPER_ADMIN bypass
        if (user && user.role?.toUpperCase() === 'SUPER_ADMIN') {
          return;
        }

        if (!user || !user.permissions || !user.permissions.includes(permissionKey)) {
          return reply.status(403).send({
            status: 'error',
            message: `Forbidden: Missing required permission [${permissionKey}]`,
            code: 'PERMISSION_DENIED'
          });
        }
      } catch (err) {
        return reply.status(401).send({ message: 'Unauthorized' });
      }
    };
  });

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Allow CORS Preflight
    if (request.method === 'OPTIONS') {
      return reply.status(204).send();
    }

    const path = request.url.split('?')[0];
    console.log(`[AUTH DEBUG] Request: ${request.method} ${path}`);

    const publicPaths = [
      '/api/v1/admin/auth/login',
      '/api/v1/auth/login',
      '/api/v1/auth/signup',
      '/api/v1/auth/signup-step1',
      '/api/v1/auth/verify-otp',
      '/api/v1/auth/resend-otp',
      '/api/v1/auth/set-account-type',
      '/api/v1/auth/complete-signup-details',
      '/api/v1/auth/b2b-company-details',
      '/api/v1/auth/b2b-contact-details',
      '/api/v1/auth/forgot-password-initiate',
      '/api/v1/auth/forgot-password-verify',
      '/api/v1/auth/forgot-password-reset',
      '/api/v1/auth/forgot-password',
      '/api/v1/auth/verify-code',
      '/api/v1/health',
      '/api/orders/track',
      '/api/public/newsletter/subscribe',
      '/api/public/newsletter/unsubscribe',
      '/api/redis-health',
    ];

    // Allow Swagger
    if (request.url.startsWith('/documentation')) {
      console.log(`[AUTH DEBUG] Allowing Swagger: ${path}`);
      return;
    }

    // 1. Truly Public Paths (Allow any method, e.g. Login, Signup, Guest Cart)
    if (publicPaths.includes(path)) {
      console.log(`[AUTH DEBUG] Truly Public Path (Always Allowed): ${path}`);
      return;
    }

    // 2. Discover/Public Discovery (Mostly GETs)
    // We restrict these to GET only to prevent accidental write bypasses
    const isDiscoveryPath = path.startsWith('/api/shop') || path.startsWith('/api/public') || path.startsWith('/api/v1/public');
    if (request.method === 'GET' && isDiscoveryPath) {
      console.log(`[AUTH DEBUG] Discovery Path (Allow GET): ${path}`);
      try {
        await request.jwtVerify(); // Optional check for user context
      } catch (e) {
        // Safe to ignore for discovery GET
      }
      return;
    }

    // 3. Cart Paths (Special Case: Guests need POST/PUT/DELETE)
    if (path.startsWith('/api/v1/cart')) {
      console.log(`[AUTH DEBUG] Cart Path (Guest Support): ${path}`);
      try {
         await request.jwtVerify();
      } catch (e) {
         // Ignore error for cart - the handler handles missing user as guest
      }
      return;
    }

    // 4. White-listed GET paths (e.g. products, categories for unauthenticated users)
    const publicGetPaths = [
      '/api/v1/brands',
      '/api/v1/categories',
      '/api/v1/industries',
      '/api/v1/products',
      '/api/v1/regions',
      '/api/v1/homepage',
      '/api/v1/system/public-settings',
      '/api/v1/system/sitemap-content',
      '/api/v1/search',
      '/api/v1/countries'
    ];

    if (request.method === 'GET' && publicGetPaths.some(p => path.startsWith(p))) {
      console.log(`[AUTH DEBUG] White-listed GET Path: ${path}`);
      try {
         await request.jwtVerify();
      } catch (e) {
         // Safe to ignore for white-listed GET
      }
      return;
    }

    // 5. Mandatory Verification for everything else (Admin, CRM, Support, etc.)
    console.log(`[AUTH DEBUG] MANDATORY jwtVerify for: ${request.method} ${path}`);
    try {
      await request.jwtVerify();
      console.log(`[AUTH DEBUG] jwtVerify SUCCESS for: ${path}`);
    } catch (err) {
      console.log(`[AUTH DEBUG] jwtVerify FAILED for: ${path}`, err);
      return reply.status(401).send({ 
        status: 'error',
        message: 'Unauthorized: Invalid or missing access token',
        code: 'AUTH_FAILED'
      });
    }
  });
});

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: any;
    requireSuperAdmin: any;
    hasPermission: (permissionKey: string) => any;
    jwt: JWT;
  }
}
