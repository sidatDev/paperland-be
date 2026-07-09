import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { logActivity } from '../utils/audit';
import nodemailer from 'nodemailer';

export default async function systemRoutes(fastify: FastifyInstance) {
  
  // Get Global Settings
  fastify.get('/admin/system/settings', {
    preHandler: [fastify.authenticate, fastify.hasPermission('system_manage')],
    schema: { 
        description: 'Get Global System Settings', 
        tags: ['System'],
        response: {
            200: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    data: { type: 'object', additionalProperties: true }
                }
            },
            500: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    data: { type: 'null' }
                }
            }
        }
    }
  }, async (request: any, reply: any) => {
    try {
      // Try to fetch global settings
      let settings;
      try {
        const prisma = fastify.prisma as any;
        settings = await prisma.globalSettings.findFirst();
      } catch (prismaErr: any) {
        // If table doesn't exist or property name is wrong, return defaults
        fastify.log.warn('GlobalSettings table not accessible, returning defaults: ' + (prismaErr.message || prismaErr));
        return createResponse({
            storeName: "Paperland",
            contactEmail: "support@paperland.com",
            maintenanceMode: false,
            twoFactorEnabled: true,
            smtpHost: "smtp.sendgrid.net",
            smtpPort: 587,
            smtpEncryption: "TLS",
            senderName: "Paperland Support",
            senderEmail: "noreply@paperland.com",
            logoUrl: "/images/Paperland logo.png",
            themeColor: "#059669",
            supportPhone: "+92 300 1234567",
            address: "Karachi, Pakistan"
        }, 'Default settings retrieved');
      }
      
      // If no settings exist, return default values
      if (!settings) {
          return createResponse({
              storeName: "Stationery Expert",
              contactEmail: "admin@stationeryexpert.com",
              maintenanceMode: false,
              twoFactorEnabled: true,
              smtpHost: "smtp.sendgrid.net",
              smtpPort: 587,
              smtpEncryption: "TLS",
              senderName: "Stationery Expert Support",
              senderEmail: "no-reply@stationeryexpert.com",
              socialAuthEnabled: false,
              googleClientId: null,
              googleClientSecret: null,
              facebookAppId: null,
              facebookAppSecret: null
          }, 'Default settings retrieved');
      }
      
      
      return createResponse(settings, 'Settings retrieved');
    } catch (err: any) {
      fastify.log.error(`[SystemSettings] Error fetching settings: ${err.message || err}`);
      // Return defaults if critical failure to avoid 500 UI crash
      return createResponse({
          error: "Failed to fetch settings from DB",
          usingDefaults: true,
          storeName: "Stationery Expert",
          contactEmail: "admin@stationeryexpert.com",
          maintenanceMode: false,
          twoFactorEnabled: true,
          smtpHost: "smtp.sendgrid.net",
          smtpPort: 587,
          smtpEncryption: "TLS",
          senderName: "Stationery Expert Support",
          senderEmail: "no-reply@stationeryexpert.com"
      }, 'System recovered with default settings');
    }
  });

  // Get Public System Settings (Branding & Contact only)
  fastify.get('/system/public-settings', {
    schema: { 
        description: 'Get Public System Settings (Branding)', 
        tags: ['System'],
        response: {
            200: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    data: { 
                        type: 'object', 
                        properties: {
                            storeName: { type: 'string' },
                            contactEmail: { type: 'string' },
                            maintenanceMode: { type: 'boolean' },
                            seoTitle: { type: 'string' },
                            seoDescription: { type: 'string' },
                            senderName: { type: 'string' },
                            senderEmail: { type: 'string' },
                            freeShippingThreshold: { type: 'number' },
                            freeShippingMessage: { type: 'string' }
                        } 
                    }
                }
            }
        }
    }
  }, async (request: any, reply: any) => {
    try {
      const prisma = fastify.prisma as any;
      const settings = await prisma.globalSettings.findFirst();

      // Return defaults if not found
      if (!settings) {
          return createResponse({
              storeName: "Stationery Expert",
              contactEmail: "admin@stationeryexpert.com",
              maintenanceMode: false,
              senderName: "Stationery Expert Support",
              senderEmail: "no-reply@stationeryexpert.com",
              freeShippingThreshold: 2000,
              freeShippingMessage: "Orders above Rs. 2,000 automatically qualify for free shipping across Pakistan."
          }, 'Default public settings retrieved');
      }

      // Return only safe public fields
      return createResponse({
          storeName: settings.storeName,
          contactEmail: settings.contactEmail,
          maintenanceMode: settings.maintenanceMode,
          seoTitle: settings.seoTitle,
          seoDescription: settings.seoDescription,
          senderName: settings.senderName,
          senderEmail: settings.senderEmail,
          freeShippingThreshold: Number(settings.freeShippingThreshold || 2000),
          freeShippingMessage: settings.freeShippingMessage || "Orders above Rs. 2,000 automatically qualify for free shipping across Pakistan."
      }, 'Public settings retrieved');
    } catch (err: any) {
        fastify.log.error(`[SystemSettings] Error fetching public settings: ${err.message}`);
        return createResponse({
            storeName: "Stationery Expert",
            contactEmail: "admin@stationeryexpert.com",
            maintenanceMode: false
        }, 'Default settings (recovery)');
    }
  });
  
  // Get Public Sitemap Content
  fastify.get('/system/sitemap-content', {
    schema: { 
        description: 'Get Public Sitemap XML Content', 
        tags: ['System'],
        response: {
            200: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    data: { 
                      type: 'object', 
                      properties: { 
                        sitemapContent: { type: 'string' } 
                      } 
                    }
                }
            }
        }
    }
  }, async (request: any, reply: any) => {
    try {
      const settings = await (fastify.prisma as any).globalSettings.findFirst({
        select: { sitemapContent: true }
      });
      return createResponse({ sitemapContent: settings?.sitemapContent || '' }, 'Sitemap content retrieved');
    } catch (err: any) {
      return createErrorResponse('Failed to fetch sitemap content');
    }
  });

  // Update Global Settings
  fastify.put('/admin/system/settings', {
    preHandler: [fastify.authenticate, fastify.hasPermission('system_manage')],
    schema: { 
      description: 'Update Global System Settings', 
      tags: ['System'],
      body: {
        type: 'object',
        properties: {
          storeName: { type: 'string' },
          contactEmail: { type: 'string' },
          maintenanceMode: { type: 'boolean' },
          twoFactorEnabled: { type: 'boolean' },
          smtpHost: { type: 'string' },
          smtpPort: { type: 'number' },
          smtpEncryption: { type: 'string' },
          smtpUser: { type: 'string', nullable: true },
          smtpPass: { type: 'string', nullable: true },
          senderName: { type: 'string' },
          senderEmail: { type: 'string' },
          backupS3Enabled: { type: 'boolean' },
          backupS3Bucket: { type: 'string', nullable: true },
          backupS3Region: { type: 'string', nullable: true },
          backupS3AccessKey: { type: 'string', nullable: true },
          backupS3SecretKey: { type: 'string', nullable: true },
          backupS3Path: { type: 'string', nullable: true },
          backupFtpEnabled: { type: 'boolean' },
          backupFtpHost: { type: 'string', nullable: true },
          backupFtpPort: { type: 'number', nullable: true },
          backupFtpUser: { type: 'string', nullable: true },
          backupFtpPass: { type: 'string', nullable: true },
          backupFtpPath: { type: 'string', nullable: true },
          seoTitle: { type: 'string', nullable: true },
          seoDescription: { type: 'string', nullable: true },
          seoKeywords: { type: 'string', nullable: true },
          seoScriptsHeader: { type: 'string', nullable: true },
          seoScriptsBody: { type: 'string', nullable: true },
          sitemapUrl: { type: 'string', nullable: true },
          bankAccountName: { type: 'string', nullable: true },
          bankAccountNumber: { type: 'string', nullable: true },
          bankName: { type: 'string', nullable: true },
          bankIban: { type: 'string', nullable: true },
          bankSwiftCode: { type: 'string', nullable: true },
          freeShippingThreshold: { type: 'number', nullable: true },
          freeShippingMessage: { type: 'string', nullable: true },
          googleClientId: { type: 'string', nullable: true },
          googleClientSecret: { type: 'string', nullable: true },
          facebookAppId: { type: 'string', nullable: true },
          facebookAppSecret: { type: 'string', nullable: true },
          socialAuthEnabled: { type: 'boolean' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', additionalProperties: true }
          }
        },
        500: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'null' }
          }
        }
      }
    }
  }, async (request: any, reply: any) => {
    const data = request.body;
    try {
      const existing = await (fastify.prisma as any).globalSettings.findFirst();
      
      let updated;
      if (existing) {
        updated = await (fastify.prisma as any).globalSettings.update({
          where: { id: existing.id },
          data
        });
      } else {
        updated = await (fastify.prisma as any).globalSettings.create({
          data
        });
      }
      
      // Log Activity
      await logActivity(fastify, {
          entityType: 'SYSTEM',
          entityId: 'SETTINGS',
          action: 'UPDATE_SETTINGS',
          performedBy: request.user?.id || 'unknown',
          details: data,
          request: {
            method: request.method,
            url: request.url,
            headers: request.headers
          },
          ip: request.ip,
          userAgent: request.headers['user-agent']
      });

      return createResponse(updated, 'Settings updated successfully');
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Update Failed: ' + (err.message || err)));
    }
  });

  // Test Email
  fastify.post('/admin/system/settings/test-email', {
    preHandler: [fastify.authenticate, fastify.hasPermission('system_manage')],
    schema: { 
      description: 'Send a test email', 
      tags: ['System'],
      body: {
        type: 'object',
        required: ['smtpHost', 'smtpPort', 'senderEmail'],
        properties: {
          smtpHost: { type: 'string' },
          smtpPort: { type: 'number' },
          smtpEncryption: { type: 'string' },
          smtpUser: { type: 'string', nullable: true },
          smtpPass: { type: 'string', nullable: true },
          senderName: { type: 'string' },
          senderEmail: { type: 'string' },
          testRecipient: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'null' }
          }
        },
        500: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'null' }
          }
        }
      }
    }
  }, async (request: any, reply: any) => {
    const { 
      smtpHost, smtpPort, smtpEncryption, smtpUser, smtpPass, 
      senderName, senderEmail, testRecipient 
    } = request.body;

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, 
        auth: (smtpUser && smtpPass) ? {
          user: smtpUser,
          pass: smtpPass,
        } : undefined,
      });

      await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to: testRecipient || senderEmail,
        subject: "Paperland - SMTP Test Email",
        text: "This is a test email from your Global System Settings.",
        html: "<b>This is a test email from your Global System Settings.</b>",
      });

      // Log Activity
      await logActivity(fastify, {
          entityType: 'SYSTEM',
          entityId: 'EMAIL',
          action: 'TEST_EMAIL',
          performedBy: request.user?.id || 'unknown',
          details: { recipient: testRecipient || senderEmail },
          request: {
            method: request.method,
            url: request.url,
            headers: request.headers
          },
          ip: request.ip,
          userAgent: request.headers['user-agent']
      });

      return createResponse(null, 'Test email sent successfully');
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to send test email: ' + err.message));
    }
  });

  // Upload Sitemap.xml
  fastify.post('/admin/system/settings/sitemap', {
    preHandler: [fastify.authenticate, fastify.hasPermission('system_manage')],
    schema: {
      description: 'Upload sitemap.xml file',
      tags: ['System'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                sitemapUrl: { type: 'string' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: any, reply: any) => {
    try {
      const data = await request.file();
      
      if (!data) {
        return reply.status(400).send(createErrorResponse('No file uploaded'));
      }

      // Validate file extension
      if (!data.filename.endsWith('.xml')) {
        return reply.status(400).send(createErrorResponse('Only .xml files are allowed'));
      }

      const buffer = await data.toBuffer();
      const sitemapContent = buffer.toString('utf-8');
      
      // Construct sitemap URL
      const frontendUrl = process.env.FRONTEND_URL || request.headers.origin || 'http://localhost:3000';
      const sitemapUrl = `${frontendUrl}/sitemap.xml`;
      
      // Update database
      const existing = await (fastify.prisma as any).globalSettings.findFirst();
      
      if (existing) {
        await (fastify.prisma as any).globalSettings.update({
          where: { id: existing.id },
          data: { 
            sitemapUrl,
            sitemapContent
          }
        });
      } else {
        await (fastify.prisma as any).globalSettings.create({
          data: { 
            sitemapUrl,
            sitemapContent
          }
        });
      }

      // Log activity
      await logActivity(fastify, {
        entityType: 'SYSTEM',
        entityId: 'SITEMAP',
        action: 'UPLOAD_SITEMAP',
        performedBy: request.user?.id || 'unknown',
        details: { sitemapUrl, filename: data.filename },
        request: {
          method: request.method,
          url: request.url,
          headers: request.headers
        },
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });

      return createResponse({ sitemapUrl }, 'Sitemap uploaded successfully');
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to upload sitemap: ' + err.message));
    }
  });
  
  // Payment Gateway Routes
  fastify.get('/admin/system/payment-gateways', {
    preHandler: [fastify.authenticate, fastify.hasPermission('gateway_view')],
  }, async (request: any, reply: any) => {
    try {
      const gateways = await (fastify.prisma as any).paymentGateway.findMany({
        orderBy: { sortOrder: 'asc' }
      });

      // Mask sensitive Stripe credentials before returning to admin frontend
      const safeGateways = gateways.map((g: any) => {
        if (g.identifier === 'stripe' && g.config) {
          const cfg = typeof g.config === 'string' ? JSON.parse(g.config) : { ...g.config };
          if (cfg.secretKey && !cfg.secretKey.includes('*')) {
            cfg.secretKey = `${cfg.secretKey.slice(0, 10)}${'*'.repeat(Math.max(0, cfg.secretKey.length - 14))}${cfg.secretKey.slice(-4)}`;
          }
          if (cfg.webhookSecret && !cfg.webhookSecret.includes('*')) {
            cfg.webhookSecret = `${cfg.webhookSecret.slice(0, 6)}${'*'.repeat(Math.max(0, cfg.webhookSecret.length - 10))}${cfg.webhookSecret.slice(-4)}`;
          }
          return { ...g, config: cfg };
        }
        if (g.identifier === 'gopayfast' && g.config) {
          const cfg = typeof g.config === 'string' ? JSON.parse(g.config) : { ...g.config };
          if (cfg.secureKey && !cfg.secureKey.includes('*')) {
            cfg.secureKey = `${cfg.secureKey.slice(0, 4)}${'*'.repeat(Math.max(0, cfg.secureKey.length - 8))}${cfg.secureKey.slice(-4)}`;
          }
          return { ...g, config: cfg };
        }
        return g;
      });

      return createResponse(safeGateways, 'Payment gateways retrieved');
    } catch (err: any) {
      return reply.status(500).send(createErrorResponse('Failed to fetch gateways'));
    }
  });

  fastify.put('/admin/system/payment-gateways/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('gateway_manage')],
  }, async (request: any, reply: any) => {
    try {
      const { id } = request.params as any;
      const data = request.body as any;

      // Prevent overwriting Stripe sensitive keys with masked placeholder values
      if (data.config && typeof data.config === 'object') {
        const existingGw = await (fastify.prisma as any).paymentGateway.findUnique({ where: { id } });
        if (existingGw?.identifier === 'stripe' && existingGw.config) {
          const existingCfg = typeof existingGw.config === 'string'
            ? JSON.parse(existingGw.config)
            : existingGw.config;
          // If submitted secretKey is masked (contains '*'), keep the real stored one
          if (data.config.secretKey && String(data.config.secretKey).includes('*')) {
            data.config.secretKey = existingCfg.secretKey || '';
          }
          if (data.config.webhookSecret && String(data.config.webhookSecret).includes('*')) {
            data.config.webhookSecret = existingCfg.webhookSecret || '';
          }
        }
        if (existingGw?.identifier === 'gopayfast' && existingGw.config) {
          const existingCfg = typeof existingGw.config === 'string'
            ? JSON.parse(existingGw.config)
            : existingGw.config;
          // If submitted secureKey is masked (contains '*'), keep the real stored one
          if (data.config.secureKey && String(data.config.secureKey).includes('*')) {
            data.config.secureKey = existingCfg.secureKey || '';
          }
        }
      }

      const updated = await (fastify.prisma as any).paymentGateway.update({
        where: { id },
        data
      });

      // Log activity
      await logActivity(fastify, {
        entityType: 'PAYMENT_GATEWAY',
        entityId: id,
        action: 'UPDATE_GATEWAY',
        performedBy: request.user?.id || 'unknown',
        details: data,
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });

      return createResponse(updated, 'Payment gateway updated successfully');
    } catch (err: any) {
      return reply.status(500).send(createErrorResponse('Failed to update gateway'));
    }
  });

  // GET all Currencies
  fastify.get('/admin/system/currencies', {
    preHandler: [fastify.authenticate],
    schema: {
        description: 'Get all currencies',
        tags: ['System'],
    }
  }, async (request, reply) => {
    try {
        const currencies = await (fastify.prisma as any).currency.findMany({
            orderBy: { name: 'asc' }
        });
        return createResponse(currencies, 'Currencies retrieved successfully');
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Internal Server Error'));
    }
  });

  // Global Sync Status map to track background re-indexing
  const activeSyncJobs = new Map<string, {
    collection: string;
    status: 'idle' | 'processing' | 'completed' | 'failed';
    processed: number;
    total: number;
    startedAt: string;
    completedAt?: string;
    error?: string;
  }>();

  // GET /admin/system/search-status
  fastify.get('/admin/system/search-status', {
    preHandler: [fastify.authenticate, fastify.hasPermission('system_manage')],
    schema: {
        description: 'Get search engine status and sync progress',
        tags: ['System'],
    }
  }, async (request, reply) => {
    try {
        if (!fastify.typesense) {
            return reply.status(400).send(createErrorResponse('Typesense plugin is not initialized.'));
        }

        // 1. Health check
        let isHealthy = false;
        let latencyMs = 0;
        try {
            const start = Date.now();
            await fastify.typesense.health.retrieve();
            latencyMs = Date.now() - start;
            isHealthy = true;
        } catch (err) {}

        // 2. Fetch Typesense collection document counts
        let tsProducts = 0;
        let tsCustomers = 0;
        let tsArticles = 0;
        try {
            const info = await fastify.typesense.collections('products').retrieve();
            tsProducts = info.num_documents;
        } catch (e) {}
        try {
            const info = await fastify.typesense.collections('customers').retrieve();
            tsCustomers = info.num_documents;
        } catch (e) {}
        try {
            const info = await fastify.typesense.collections('knowledge_base').retrieve();
            tsArticles = info.num_documents;
        } catch (e) {}

        // 3. Fetch Database counts
        const dbProducts = await (fastify.prisma as any).product.count({ where: { deletedAt: null } });
        const dbCustomers = await (fastify.prisma as any).user.count({
            where: { role: { name: { in: ['CUSTOMER', 'BUSINESS', 'B2B_ADMIN', 'DEALER'] } } }
        });
        const dbArticles = await (fastify.prisma as any).kbArticle.count({
            where: { deletedAt: null, status: 'PUBLISHED', visibility: 'PUBLIC' }
        });

        // 4. Gather active background job details
        const jobs = Array.from(activeSyncJobs.values());

        return createResponse({
            health: {
                isHealthy,
                latencyMs,
                host: process.env.TYPESENSE_HOST || 'localhost',
            },
            collections: [
                { name: 'products', label: 'Products Catalog', tsCount: tsProducts, dbCount: dbProducts },
                { name: 'customers', label: 'Customers Database', tsCount: tsCustomers, dbCount: dbCustomers },
                { name: 'knowledge_base', label: 'Knowledge Base Articles', tsCount: tsArticles, dbCount: dbArticles },
            ],
            activeJobs: jobs,
        }, 'Search status retrieved successfully');
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Failed to retrieve search status: ' + err.message));
    }
  });

  // Helper background sync runner with zero-downtime alias swap
  async function runBackgroundReindex(collectionName: string) {
    const timestamp = Date.now();
    const tempCollectionName = `${collectionName}_sync_${timestamp}`;

    activeSyncJobs.set(collectionName, {
        collection: collectionName,
        status: 'processing',
        processed: 0,
        total: 0,
        startedAt: new Date().toISOString()
    });

    try {
        // Check if there is a physical collection with this name (not an alias)
        let isPhysical = false;
        try {
            await fastify.typesense.collections(collectionName).retrieve();
            try {
                await fastify.typesense.aliases(collectionName).retrieve();
            } catch (e) {
                isPhysical = true;
            }
        } catch (e) {}

        if (isPhysical) {
            fastify.log.warn(`Deleting physical collection ${collectionName} to clear name for alias swap`);
            await fastify.typesense.collections(collectionName).delete();
        }

        if (collectionName === 'products') {
            // 1. Create temporary schema
            const schema: any = {
                name: tempCollectionName,
                fields: [
                    { name: 'id', type: 'string' },
                    { name: 'name', type: 'string' },
                    { name: 'slug', type: 'string', facet: false, optional: true },
                    { name: 'sku', type: 'string', facet: false },
                    { name: 'normalized_sku', type: 'string', facet: false },
                    { name: 'part_no', type: 'string', facet: false, optional: true },
                    { name: 'normalized_part_no', type: 'string', facet: false, optional: true },
                    { name: 'description', type: 'string', optional: true },
                    { name: 'brand', type: 'string', facet: true },
                    { name: 'category', type: 'string', facet: true },
                    { name: 'sub_category', type: 'string', facet: true, optional: true },
                    { name: 'price', type: 'float', facet: true },
                    { name: 'currency', type: 'string', facet: true },
                    { name: 'image_url', type: 'string', facet: false, optional: true },
                    { name: 'industry', type: 'string[]', facet: true },
                    { name: 'created_at', type: 'int64', facet: false },
                    { name: 'is_featured', type: 'bool', facet: true },
                    { name: 'isActive', type: 'bool', facet: true },
                    { name: 'status', type: 'string', facet: true, optional: true },
                ],
                default_sorting_field: 'created_at',
            };
            await fastify.typesense.collections().create(schema);

            const totalCount = await (fastify.prisma as any).product.count({ where: { deletedAt: null } });
            activeSyncJobs.get(collectionName)!.total = totalCount;

            // 2. Stream database records using cursor
            let processed = 0;
            let cursorId: string | undefined = undefined;
            const batchSize = 500;

            while (true) {
                const batch: any[] = await (fastify.prisma as any).product.findMany({
                    where: { deletedAt: null },
                    take: batchSize,
                    skip: cursorId ? 1 : 0,
                    cursor: cursorId ? { id: cursorId } : undefined,
                    orderBy: { id: 'asc' },
                    include: {
                        brand: true,
                        category: { include: { parent: true } },
                        industries: { include: { industry: true } },
                        prices: { take: 1, include: { currency: true } }
                    }
                });

                if (batch.length === 0) break;
                cursorId = batch[batch.length - 1].id;

                const docs = batch.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    slug: p.slug || '',
                    sku: p.sku || '',
                    normalized_sku: p.sku ? p.sku.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '',
                    part_no: (p.specifications as any)?.partNo || '',
                    normalized_part_no: (p.specifications as any)?.partNo ? (p.specifications as any).partNo.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '',
                    description: p.description || '',
                    brand: p.brand?.name || 'Unknown',
                    category: p.category?.parent ? p.category.parent.name : (p.category?.name || 'Uncategorized'),
                    sub_category: p.category?.parent ? p.category.name : '',
                    price: Number(p.prices[0]?.priceRetail || 0),
                    currency: p.prices[0]?.currency?.code || 'PKR',
                    image_url: p.imageUrl || '',
                    industry: p.industries.map((i: any) => i.industry.name),
                    created_at: Math.floor(new Date(p.createdAt).getTime() / 1000),
                    is_featured: p.isFeatured,
                    isActive: p.isActive,
                    status: (p.specifications as any)?.status || (p.isActive ? 'Active' : 'Draft'),
                }));

                await fastify.typesense.collections(tempCollectionName).documents().import(docs, { action: 'upsert' });
                processed += batch.length;
                activeSyncJobs.get(collectionName)!.processed = processed;
            }

        } else if (collectionName === 'customers') {
            const schema: any = {
                name: tempCollectionName,
                fields: [
                    { name: 'id', type: 'string' },
                    { name: 'name', type: 'string' },
                    { name: 'email', type: 'string' },
                    { name: 'type', type: 'string', facet: true },
                    { name: 'status', type: 'string', facet: true }
                ]
            };
            await fastify.typesense.collections().create(schema);

            const totalCount = await (fastify.prisma as any).user.count({
                where: { role: { name: { in: ['CUSTOMER', 'BUSINESS', 'B2B_ADMIN', 'DEALER'] } } }
            });
            activeSyncJobs.get(collectionName)!.total = totalCount;

            let processed = 0;
            let cursorId: string | undefined = undefined;
            const batchSize = 500;

            while (true) {
                const batch: any[] = await (fastify.prisma as any).user.findMany({
                    where: { role: { name: { in: ['CUSTOMER', 'BUSINESS', 'B2B_ADMIN', 'DEALER'] } } },
                    take: batchSize,
                    skip: cursorId ? 1 : 0,
                    cursor: cursorId ? { id: cursorId } : undefined,
                    orderBy: { id: 'asc' },
                    include: { role: true, b2bCompanyDetails: true }
                });

                if (batch.length === 0) break;
                cursorId = batch[batch.length - 1].id;

                const docs = batch.map((user: any) => ({
                    id: user.id,
                    name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user.b2bCompanyDetails?.companyName || 'N/A'),
                    email: user.email,
                    type: (user.role?.name === 'BUSINESS' || user.role?.name === 'B2B_ADMIN') ? 'B2B' : (user.role?.name === 'DEALER' ? 'DEALER' : 'B2C'),
                    status: user.accountStatus.toLowerCase()
                }));

                await fastify.typesense.collections(tempCollectionName).documents().import(docs, { action: 'upsert' });
                processed += batch.length;
                activeSyncJobs.get(collectionName)!.processed = processed;
            }

        } else if (collectionName === 'knowledge_base') {
            const schema: any = {
                name: tempCollectionName,
                fields: [
                    { name: 'id', type: 'string' },
                    { name: 'title', type: 'string' },
                    { name: 'slug', type: 'string' },
                    { name: 'content', type: 'string' },
                    { name: 'category', type: 'string', facet: true },
                    { name: 'category_slug', type: 'string' },
                    { name: 'tags', type: 'string[]', facet: true },
                    { name: 'published_at', type: 'int64' },
                    { name: 'view_count', type: 'int32' },
                    { name: 'popularity_score', type: 'int32' }
                ],
                default_sorting_field: 'popularity_score'
            };
            await fastify.typesense.collections().create(schema);

            const totalCount = await (fastify.prisma as any).kbArticle.count({
                where: { deletedAt: null, status: 'PUBLISHED', visibility: 'PUBLIC' }
            });
            activeSyncJobs.get(collectionName)!.total = totalCount;

            let processed = 0;
            let cursorId: string | undefined = undefined;
            const batchSize = 500;

            while (true) {
                const batch: any[] = await (fastify.prisma as any).kbArticle.findMany({
                    where: { deletedAt: null, status: 'PUBLISHED', visibility: 'PUBLIC' },
                    take: batchSize,
                    skip: cursorId ? 1 : 0,
                    cursor: cursorId ? { id: cursorId } : undefined,
                    orderBy: { id: 'asc' },
                    include: { category: { select: { name: true, slug: true } } }
                });

                if (batch.length === 0) break;
                cursorId = batch[batch.length - 1].id;

                const docs = batch.map((article: any) => ({
                    id: article.id,
                    title: article.title,
                    slug: article.slug,
                    content: article.contentText || '',
                    category: article.category?.name || 'Uncategorized',
                    category_slug: article.category?.slug || '',
                    tags: article.tags || [],
                    published_at: article.publishedAt ? Math.floor(article.publishedAt.getTime() / 1000) : 0,
                    view_count: article.viewCount || 0,
                    popularity_score: article.viewCount || 0
                }));

                await fastify.typesense.collections(tempCollectionName).documents().import(docs, { action: 'upsert' });
                processed += batch.length;
                activeSyncJobs.get(collectionName)!.processed = processed;
            }
        }

        // 3. Swap alias for zero-downtime
        let oldCollectionName: string | null = null;
        try {
            const aliasInfo = await fastify.typesense.aliases(collectionName).retrieve();
            oldCollectionName = aliasInfo.collection_name;
        } catch (e) {}

        await fastify.typesense.aliases().upsert(collectionName, { collection_name: tempCollectionName });

        // 4. Drop the old collection
        if (oldCollectionName && oldCollectionName !== tempCollectionName) {
            try {
                await fastify.typesense.collections(oldCollectionName).delete();
            } catch (dropErr) {
                fastify.log.error(dropErr, `Failed to clean up old collection: ${oldCollectionName}`);
            }
        }

        activeSyncJobs.get(collectionName)!.status = 'completed';
        activeSyncJobs.get(collectionName)!.completedAt = new Date().toISOString();

    } catch (err: any) {
        fastify.log.error(err, `Error in background re-indexing for ${collectionName}`);
        const job = activeSyncJobs.get(collectionName);
        if (job) {
            job.status = 'failed';
            job.error = err.message || 'Unknown error';
            job.completedAt = new Date().toISOString();
        }
    }
  }

  // POST /admin/system/sync-search
  fastify.post('/admin/system/sync-search', {
    preHandler: [fastify.authenticate, fastify.hasPermission('system_manage')],
    schema: {
        description: 'Trigger search sync for one or all collections',
        tags: ['System'],
        body: {
            type: 'object',
            properties: {
                collection: { type: 'string', enum: ['products', 'customers', 'knowledge_base', 'all'] }
            },
            required: ['collection']
        }
    }
  }, async (request, reply) => {
    try {
        const { collection } = request.body as any;

        if (!fastify.typesense) {
            return reply.status(400).send(createErrorResponse('Typesense client not initialized.'));
        }

        const targets = collection === 'all' ? ['products', 'customers', 'knowledge_base'] : [collection];

        // Check if any of the target collections are already running a sync
        const activeTargets = targets.filter(t => activeSyncJobs.get(t)?.status === 'processing');
        if (activeTargets.length > 0) {
            return reply.status(409).send(createErrorResponse(`Sync already running for: ${activeTargets.join(', ')}`));
        }

        // Fire-and-forget background indexing for each target
        for (const target of targets) {
            setImmediate(() => runBackgroundReindex(target));
        }

        // Log operation in audits
        await logActivity(fastify, {
            entityType: 'SYSTEM',
            entityId: 'typesense-sync',
            action: 'SEARCH_INDEX_REBUILD',
            performedBy: (request.user as any)?.id || 'unknown',
            details: { targetCollection: collection },
            ip: request.ip,
            userAgent: request.headers['user-agent']
        });

        return reply.status(202).send(createResponse(null, 'Re-indexing initiated in background'));
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Failed to trigger re-index: ' + err.message));
    }
  });

  // GET /admin/system/search-documents
  fastify.get('/admin/system/search-documents', {
    preHandler: [fastify.authenticate, fastify.hasPermission('system_manage')],
    schema: {
        description: 'Query indexed documents from Typesense',
        tags: ['System'],
        querystring: {
            type: 'object',
            properties: {
                collection: { type: 'string', enum: ['products', 'customers', 'knowledge_base'] },
                q: { type: 'string' },
                page: { type: 'integer', default: 1 },
                limit: { type: 'integer', default: 10 }
            },
            required: ['collection']
        }
    }
  }, async (request, reply) => {
    try {
        const { collection, q, page = 1, limit = 10 } = request.query as any;

        if (!fastify.typesense) {
            return reply.status(400).send(createErrorResponse('Typesense client not initialized.'));
        }

        // Define search fields based on collection name
        const queryByFields: Record<string, string> = {
            products: 'name,sku,brand,category',
            customers: 'name,email,type',
            knowledge_base: 'title,content,category'
        };

        const searchParams = {
            q: q || '*',
            query_by: queryByFields[collection] || 'name',
            page: Number(page),
            per_page: Number(limit)
        };

        const result = await fastify.typesense.collections(collection).documents().search(searchParams);

        const documents = result.hits?.map((hit: any) => ({
            ...hit.document,
            _score: hit.text_match
        })) || [];

        return createResponse(documents, 'Documents retrieved successfully', {
            page: Number(page),
            limit: Number(limit),
            total: result.found || 0
        });
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Search failed: ' + err.message));
    }
  });

}

