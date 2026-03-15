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
            storeName: "Filters Expert",
            contactEmail: "admin@filtersexpert.com",
            maintenanceMode: false,
            twoFactorEnabled: true,
            smtpHost: "smtp.sendgrid.net",
            smtpPort: 587,
            smtpEncryption: "TLS",
            senderName: "Filters Expert Support",
            senderEmail: "no-reply@filtersexpert.com"
        }, 'Default settings retrieved');
      }
      
      // If no settings exist, return default values
      if (!settings) {
          return createResponse({
              storeName: "Filters Expert",
              contactEmail: "admin@filtersexpert.com",
              maintenanceMode: false,
              twoFactorEnabled: true,
              smtpHost: "smtp.sendgrid.net",
              smtpPort: 587,
              smtpEncryption: "TLS",
              senderName: "Filters Expert Support",
              senderEmail: "no-reply@filtersexpert.com"
          }, 'Default settings retrieved');
      }
      
      
      return createResponse(settings, 'Settings retrieved');
    } catch (err: any) {
      fastify.log.error(`[SystemSettings] Error fetching settings: ${err.message || err}`);
      // Return defaults if critical failure to avoid 500 UI crash
      return createResponse({
          error: "Failed to fetch settings from DB",
          usingDefaults: true,
          storeName: "Filters Expert",
          contactEmail: "admin@filtersexpert.com",
          maintenanceMode: false,
          twoFactorEnabled: true,
          smtpHost: "smtp.sendgrid.net",
          smtpPort: 587,
          smtpEncryption: "TLS",
          senderName: "Filters Expert Support",
          senderEmail: "no-reply@filtersexpert.com"
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
                            senderEmail: { type: 'string' }
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
              storeName: "Filters Expert",
              contactEmail: "admin@filtersexpert.com",
              maintenanceMode: false,
              senderName: "Filters Expert Support",
              senderEmail: "no-reply@filtersexpert.com"
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
          senderEmail: settings.senderEmail
      }, 'Public settings retrieved');
    } catch (err: any) {
        fastify.log.error(`[SystemSettings] Error fetching public settings: ${err.message}`);
        return createResponse({
            storeName: "Filters Expert",
            contactEmail: "admin@filtersexpert.com",
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
          bankSwiftCode: { type: 'string', nullable: true }
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
        subject: "Filters Expert - SMTP Test Email",
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
    preHandler: [fastify.authenticate, fastify.hasPermission('system_manage')],
  }, async (request: any, reply: any) => {
    try {
      const gateways = await (fastify.prisma as any).paymentGateway.findMany({
        orderBy: { sortOrder: 'asc' }
      });
      return createResponse(gateways, 'Payment gateways retrieved');
    } catch (err: any) {
      return reply.status(500).send(createErrorResponse('Failed to fetch gateways'));
    }
  });

  fastify.put('/admin/system/payment-gateways/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('system_manage')],
  }, async (request: any, reply: any) => {
    try {
      const { id } = request.params as any;
      const data = request.body as any;
      
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

}
