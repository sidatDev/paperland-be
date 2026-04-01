import { FastifyInstance } from 'fastify';
import { NotificationTemplateController } from '../controllers/notification-template.controller';

export default async function notificationTemplateRoutes(fastify: FastifyInstance) {
  const controller = new NotificationTemplateController(fastify.prisma);

  // Admin Management Routes (Protected)
  fastify.register(async (adminRoutes) => {
    adminRoutes.addHook('preHandler', fastify.authenticate);
    adminRoutes.addHook('preHandler', fastify.hasPermission('system_manage'));

    adminRoutes.get('/notification-templates', (req, reply) => controller.listTemplates(req, reply));
    adminRoutes.get('/notification-templates/:id', (req, reply) => controller.getTemplate(req as any, reply));
    adminRoutes.post('/notification-templates', (req, reply) => controller.createTemplate(req as any, reply));
    adminRoutes.put('/notification-templates/:id', (req, reply) => controller.updateTemplate(req as any, reply));
    adminRoutes.delete('/notification-templates/:id', (req, reply) => controller.deleteTemplate(req as any, reply));
    adminRoutes.post('/notification-templates/test', (req, reply) => controller.sendTestEmail(req as any, reply));
  });
}
