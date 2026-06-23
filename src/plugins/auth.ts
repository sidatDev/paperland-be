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
        
        // 1. SUPER_ADMIN bypass
        if (user && user.role?.toUpperCase() === 'SUPER_ADMIN') {
          return;
        }

        if (!user) {
          return reply.status(401).send({ message: 'Unauthorized' });
        }

        // Use lowercase for robust comparison
        const permissions = (user.permissions ?? []).map((p: string) => p.toLowerCase());
        const searchKey = permissionKey.toLowerCase();

        // 2. Direct match
        if (permissions.includes(searchKey)) {
          return;
        }

        // 3. Unified Prefix Group Matching
        const prefixGroups = [
          ["finance", "pricing", "gateway"],
          ["product", "category", "brand", "industry", "relation"],
          ["promotion", "marketing"],
          ["logistics", "region", "shipping"],
          ["customer", "support", "b2b", "catalog", "crm"]
        ];

        const searchParts = searchKey.split('_');
        if (searchParts.length === 2) {
          const [searchPrefix, searchAction] = searchParts;
          
          // Find if searchPrefix is in any group
          const matchedGroup = prefixGroups.find(group => group.includes(searchPrefix));
          if (matchedGroup) {
            // Check if user has a permission in this group that satisfies the action
            const hasSatisfyingPermission = permissions.some((userPerm: string) => {
              const userParts = userPerm.split('_');
              if (userParts.length !== 2) return false;
              const [userPrefix, userAction] = userParts;
              
              if (!matchedGroup.includes(userPrefix)) return false;

              // If checking for view, user can have view or manage/edit/create/delete
              if (searchAction === 'view') {
                return true; // Any permission in this group allows viewing
              }
              // If checking for manage, user must have manage/edit/create/delete/update
              if (searchAction === 'manage') {
                return ['manage', 'create', 'edit', 'delete', 'update'].includes(userAction);
              }
              // For other specific actions, check exact action match or manage
              return userAction === searchAction || userAction === 'manage';
            });

            if (hasSatisfyingPermission) {
              return;
            }
          }
        }

        // 3. Fallback for manage permissions
        if (searchKey.endsWith('_manage')) {
          const module = searchKey.replace('_manage', '');
          const hasMod = permissions.some((p: string) => 
            p === `${module}_create` || 
            p === `${module}_edit` || 
            p === `${module}_delete` || 
            p === `${module}_update` ||
            p === `${module}_manage`
          );
          if (hasMod) return;
        }

        // 4. Fallback for view permissions
        if (searchKey.endsWith('_view')) {
          const module = searchKey.replace('_view', '');
          const hasView = permissions.some((p: string) => 
            p === `${module}_create` || 
            p === `${module}_edit` || 
            p === `${module}_delete` || 
            p === `${module}_update` ||
            p === `${module}_manage` ||
            p === `${module}_view`
          );
          if (hasView) return;
        }

        // If we get here, no permission matches
        return reply.status(403).send({
          status: 'error',
          message: `Forbidden: Missing required permission [${permissionKey}]`,
          code: 'PERMISSION_DENIED'
        });
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
      '/public/contact',
      '/api/v1/public/contact',
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
      '/auth/activate-guest',
      '/auth/activate-finalize',
      '/health',
      '/orders/track',
      '/public/newsletter/subscribe',
      '/api/public/newsletter/subscribe',
      '/public/newsletter/unsubscribe',
      '/api/public/newsletter/unsubscribe',
      '/public/upload',
      '/redis-health',
      '/api/redis-health',
      '/chat/session',
      '/chat/message',
      '/chat/messages',
      '/chat/webhook',
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
    const isDiscoveryPath = 
      normalizedPath.startsWith('/shop') || 
      normalizedPath.startsWith('/public') || 
      normalizedPath.startsWith('/api/shop') || 
      path.startsWith('/api/shop') || 
      path.startsWith('/api/v1/shop') || 
      path.startsWith('/api/public') || 
      path.startsWith('/api/v1/public') ||
      path.startsWith('/api/v1/homepage') ||
      path.startsWith('/api/v1/system/public-settings') ||
      path.startsWith('/api/logistics') ||
      path.startsWith('/api/newsletter');

    if (request.method === 'GET' && isDiscoveryPath) {
      try {
        await request.jwtVerify(); 
      } catch (e) {}
      return;
    }

    // 3. Cart & Guest Checkout Paths (Special Case: Guests need POST/PUT/DELETE)
    const isGuestFlow = normalizedPath.startsWith('/cart') || 
                       path.startsWith('/api/v1/cart') || 
                       normalizedPath.startsWith('/guest-checkout') || 
                       path.startsWith('/api/v1/guest-checkout') ||
                       normalizedPath.startsWith('/checkout') || 
                       path.startsWith('/api/v1/checkout') ||
                       normalizedPath.startsWith('/payments/stripe') || 
                       path.startsWith('/api/v1/payments/stripe') ||
                       normalizedPath.startsWith('/payments/gopayfast') ||
                       path.startsWith('/api/v1/payments/gopayfast');
                       
    if (isGuestFlow) {
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
      '/countries',
      '/locations'
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
