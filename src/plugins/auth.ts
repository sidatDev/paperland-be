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
    const normalizedPath = path.replace(/^\/api\/v1/, '');
    console.log(`[AUTH DEBUG] Request: ${request.method} ${path} (Normalized: ${normalizedPath})`);

    const publicPaths = [
      '/admin/auth/login',
      '/api/public/contact',
      '/api/public/orders/track',
      '/auth/login',
      '/auth/signup',
      '/auth/signup-step1',
      '/auth/verify-otp',
      '/auth/resend-otp',
      '/auth/set-account-type',
      '/auth/complete-signup-details',
      '/auth/b2b-company-details',
      '/auth/b2b-contact-details',
      '/auth/forgot-password-initiate',
      '/auth/forgot-password-verify',
      '/auth/forgot-password-reset',
      '/auth/forgot-password',
      '/auth/verify-code',
      '/health',
      '/orders/track',
      '/public/newsletter/subscribe',
      '/public/newsletter/unsubscribe',
      '/redis-health',
    ];

    // Allow Swagger
    if (path.startsWith('/documentation')) {
      return;
    }

    // Allow static uploads
    if (path.startsWith('/uploads/')) {
      return;
    }

    // 1. Truly Public Paths (Allow any method, e.g. Login, Signup, Guest Cart)
    if (publicPaths.includes(normalizedPath) || publicPaths.includes(path) || publicPaths.some(p => path.endsWith(`/api/v1${p}`))) {
      return;
    }

    // 2. Discover/Public Discovery (Mostly GETs)
    const isDiscoveryPath = normalizedPath.startsWith('/shop') || normalizedPath.startsWith('/public') || path.startsWith('/api/shop') || path.startsWith('/api/public');
    if (request.method === 'GET' && isDiscoveryPath) {
      try {
        await request.jwtVerify(); 
      } catch (e) {}
      return;
    }

    // 3. Cart Paths (Special Case: Guests need POST/PUT/DELETE)
    if (normalizedPath.startsWith('/cart') || path.startsWith('/api/v1/cart')) {
      try {
         await request.jwtVerify();
      } catch (e) {}
      return;
    }

    // 4. White-listed GET paths (e.g. products, categories for unauthenticated users)
    const publicGetPaths = [
      '/brands',
      '/categories',
      '/industries',
      '/products',
      '/regions',
      '/homepage',
      '/system/public-settings',
      '/system/sitemap-content',
      '/search',
      '/countries'
    ];

    if (request.method === 'GET' && (publicGetPaths.some(p => normalizedPath.startsWith(p)) || publicGetPaths.some(p => path.startsWith(`/api/v1${p}`)))) {
      try {
         await request.jwtVerify();
      } catch (e) {}
      return;
    }

    // 5. Mandatory Verification for everything else
    try {
      await request.jwtVerify();
    } catch (err) {
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
