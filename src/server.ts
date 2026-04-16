import Fastify from 'fastify';
import dotenv from 'dotenv';

dotenv.config();

import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import fastifyCors from '@fastify/cors';
import { swaggerConfig, swaggerUiConfig } from './_docs/swagger';

const fastify = Fastify({
  logger: true,
  pluginTimeout: 30000,
  bodyLimit: 10 * 1024 * 1024 // 10MB
});

import path from 'path';
import fs from 'fs';
import productRelationsRoutes from './routes/product-relations.routes';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const start = async () => {
  try {
    // Register CORS
    await fastify.register(fastifyCors, {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    });

    // Register @fastify/static to serve uploaded files
    await fastify.register(import('@fastify/static'), {
      root: path.join(process.cwd(), 'public', 'uploads'),
      prefix: '/uploads/',
      decorateReply: false // Avoid decoration conflicts
    });

    // Register Rate Limit
    await fastify.register(import('@fastify/rate-limit'), {
      max: 1000,
      timeWindow: '1 minute'
    });

    // Register Swagger
    await fastify.register(fastifySwagger, swaggerConfig);
    await fastify.register(fastifySwaggerUi, swaggerUiConfig);
    const port = parseInt(process.env.PORT || '3001');
    const apiUrl = process.env.API_URL || `http://localhost:${port}`;
    console.log(`Swagger UI registered at ${apiUrl}/documentation`);

    // Register Database
    await fastify.register(import('./plugins/db'));

    // Register Redis & Cache Service (NEW)
    await fastify.register(import('./plugins/redis'));
    await fastify.register(import('./services/cache.service'));

    // Initialize Email Service with Prisma
    const { initializeEmailService } = await import('./services/email.service');
    initializeEmailService(fastify.prisma);
    console.log('✅ Email service initialized with database settings');

    // Register Auth
    await fastify.register(import('./plugins/auth'));

    // Register Multipart
    await fastify.register(import('@fastify/multipart'), {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      }
    });

    // Global Request Monitor (Aggressive Logging)
    fastify.addHook('onRequest', async (request) => {
        process.stdout.write(`🚀 [ENTRY LOG]: ${request.method} ${request.url}\n`);
    });

    // Register Routes
    await fastify.register(import('./routes/auth.routes'), { prefix: '/api/v1' });
    
    // Multi-Step Signup Routes (NEW)
    await fastify.register(import('./routes/auth-signup.routes'), { prefix: '/api/v1' });
    
    await fastify.register(import('./routes/dashboard.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/roles.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/users.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/addresses.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/profile.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/countries.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/categories.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/brands.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/products.routes'), { prefix: '/api/v1' });
    await fastify.register(productRelationsRoutes, { prefix: '/api/v1' });
    await fastify.register(import('./routes/warehouse.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/industries.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/orders.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/payments.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/checkout.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/guest-checkout.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/cart.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/wishlist.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/b2b.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/bulk-order.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/support.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/shipping.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/shipment.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/crm.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/reviews.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/pricing.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/coupons.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/returns.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/whatsapp.routes'), { prefix: '/api/v1' });
    
    // New Admin Module Routes
    await fastify.register(import('./routes/flash-sales.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/referrals.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/logistics.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/customers.routes'), { prefix: '/api/v1' });
    // Upload Routes
    // Upload Routes
    await fastify.register(import('./routes/upload.routes'), { prefix: '/api/v1' });
    
    // CMS Routes
    await fastify.register(import('./routes/cms.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/blog.routes'), { prefix: '/api/v1' });
    
    // Sync Routes (Disabled for Paperland Rebrand)
    // await fastify.register(import('./routes/sync.routes'), { prefix: '/api/v1' });
    
    // Reports Routes
    await fastify.register(import('./routes/reports.routes'), { prefix: '/api/v1' });

    // System Routes
    await fastify.register(import('./routes/system.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/logs.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/backup.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/notification-template.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/catalogs.routes'), { prefix: '/api/v1' });

    // Homepage & Shop Discovery Routes
    await fastify.register(import('./routes/homepage.routes'), { prefix: '/api/v1' });
    await fastify.register(import('./routes/public-shop.routes'), { prefix: '/api' });
    await fastify.register(import('./routes/public-blog.routes'), { prefix: '/api' });
    await fastify.register(import('./routes/newsletter.routes'), { prefix: '/api' });
    await fastify.register(import('./routes/public-cms.routes')); // Route paths are absolute (/api/public/cms/...)
    
    // Public Tracking Routes (No Auth)
    await fastify.register(import('./routes/public-tracking.routes'), { prefix: '/api/public' });
    
    // Public Contact Routes (No Auth)
    await fastify.register(import('./routes/public-contact.routes'), { prefix: '/api' });

    // Typesense Search Plugin (NEW)
    await fastify.register(import('./plugins/typesense'));

    // Search Routes (NEW)
    await fastify.register(import('./routes/search.routes'), { prefix: '/api/v1' });


    // Health Check
    fastify.get('/health', async (request, reply) => {
      return { status: 'ok' };
    });

    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
