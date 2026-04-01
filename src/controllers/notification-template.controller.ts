import { FastifyReply, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { emailService } from '../services/email.service';

export class NotificationTemplateController {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * List all notification templates
   */
  async listTemplates(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { page = 1, limit = 10, search = '' } = request.query as any;
      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [templates, total] = await Promise.all([
        this.prisma.notificationTemplate.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' }
        }),
        this.prisma.notificationTemplate.count({ where })
      ]);

      return {
        data: templates,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / take)
      };
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Failed to fetch templates', error: error.message });
    }
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as any;
      const template = await this.prisma.notificationTemplate.findUnique({
        where: { id }
      });

      if (!template) {
        return reply.status(404).send({ message: 'Template not found' });
      }

      return template;
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Failed to fetch template', error: error.message });
    }
  }

  /**
   * Create a new template
   */
  async createTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = request.body as any;
      const template = await this.prisma.notificationTemplate.create({
        data: {
          name: data.name,
          subject: data.subject,
          body: data.body,
          variables: data.variables || [],
          description: data.description,
          type: data.type || 'EMAIL',
          isActive: data.isActive !== undefined ? data.isActive : true
        }
      });

      return reply.status(201).send(template);
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Failed to create template', error: error.message });
    }
  }

  /**
   * Update an existing template
   */
  async updateTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as any;
      const data = request.body as any;

      const template = await this.prisma.notificationTemplate.update({
        where: { id },
        data: {
          name: data.name,
          subject: data.subject,
          body: data.body,
          variables: data.variables,
          description: data.description,
          type: data.type,
          isActive: data.isActive
        }
      });

      return template;
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Failed to update template', error: error.message });
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as any;
      await this.prisma.notificationTemplate.delete({
        where: { id }
      });

      return reply.status(204).send();
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Failed to delete template', error: error.message });
    }
  }

  /**
   * Send a test email using a template
   */
  async sendTestEmail(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { templateId, email, variables } = request.body as any;

      const template = await this.prisma.notificationTemplate.findUnique({
        where: { id: templateId }
      });

      if (!template) {
        return reply.status(404).send({ message: 'Template not found' });
      }

      await emailService.sendDynamicEmail(template.name, email, variables);

      return { message: 'Test email sent successfully' };
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ message: 'Failed to send test email', error: error.message });
    }
  }
}
