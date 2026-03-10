import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { emailService } from '../services/email.service';

export default async function supportRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma as any;

  // Support Upload (Customer/Admin)
  fastify.post('/support/upload', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Upload an attachment for a support ticket',
      tags: ['Support'],
      consumes: ['multipart/form-data']
    }
  }, async (request: any, reply) => {
    try {
      const data = await request.file();
      if (!data) return reply.status(400).send(createErrorResponse("No file uploaded"));

      const buffer = await data.toBuffer();
      // Use existing upload logic or a helper if available, for now manual S3
      const { uploadFileToS3 } = require('../utils/file-upload.utils');
      const url = await uploadFileToS3({
        data: buffer,
        filename: data.filename,
        mimetype: data.mimetype
      }, 'support-attachments');

      return createResponse({ url }, "File uploaded successfully");
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse("Upload failed: " + err.message));
    }
  });

  // Create Ticket (Customer)
  fastify.post('/support/tickets', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Opens a new customer support ticket',
      tags: ['Support'],
      body: {
        type: 'object',
        required: ['subject', 'category', 'message'],
        properties: {
          subject: { type: 'string' },
          category: { type: 'string' },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
          message: { type: 'string' },
          attachments: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (request, reply) => {
    const { subject, category, priority, message, attachments } = request.body as any;
    const user = request.user as any;

    try {
      const ticket = await prisma.supportTicket.create({
        data: {
          subject,
          category,
          priority: priority || 'MEDIUM',
          userId: user.id,
          attachments: attachments || [],
          messages: {
            create: {
              userId: user.id,
              message,
              isAdmin: false,
              attachments: attachments || []
            }
          }
        },
        include: {
          user: true
        }
      });

      // Notify Admins
      const userName = `${ticket.user.firstName || ''} ${ticket.user.lastName || ''}`.trim() || ticket.user.email;
      await emailService.sendNewTicketNotification(ticket.id, ticket.subject, ticket.category, userName);

      return createResponse(ticket, 'Ticket created successfully');
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send(createErrorResponse(error.message));
    }
  });

  // Support History (Customer)
  fastify.get('/support/tickets', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Lists all previous tickets created by the current user',
      tags: ['Support']
    }
  }, async (request, reply) => {
    const user = request.user as any;
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
    return createResponse(tickets);
  });

  // Get Ticket Details (Customer)
  fastify.get('/support/tickets/:id', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Support'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const user = request.user as any;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { 
            user: { 
              select: { 
                firstName: true, 
                lastName: true, 
                email: true,
                role: { select: { name: true } }
              } 
            } 
          }
        }
      }
    });

    if (!ticket || ticket.userId !== user.id) {
      return reply.status(404).send({ message: 'Ticket not found' });
    }

    return createResponse(ticket);
  });

  // Reply to Ticket (Customer)
  fastify.post('/support/tickets/:id/messages', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Support'],
      params: { type: 'object', properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string' },
          attachments: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const { message, attachments } = request.body as any;
    const user = request.user as any;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!ticket || ticket.userId !== user.id) {
      return reply.status(404).send({ message: 'Ticket not found' });
    }

    const newMessage = await prisma.ticketMessage.create({
      data: {
        ticketId: id,
        userId: user.id,
        message,
        isAdmin: false,
        attachments: attachments || []
      }
    });

    // Update ticket status if it was closed or responded
    await prisma.supportTicket.update({
      where: { id },
      data: { status: 'OPEN', updatedAt: new Date() }
    });

    return createResponse(newMessage, 'Reply sent successfully');
  });

  // --- Admin Routes ---

  // Admin Ticket Queue
  fastify.get('/admin/support/tickets', {
    preHandler: [fastify.authenticate, fastify.hasPermission('support_view')],
    schema: {
      description: 'Lists all active tickets for agent processing',
      tags: ['Admin Support Management'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          priority: { type: 'string' },
          assignedToId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { status, priority, assignedToId } = request.query as any;
    
    const where: any = { deletedAt: null };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assignedToId) where.assignedToId = assignedToId;

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        assignedTo: { select: { firstName: true, lastName: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return createResponse(tickets);
  });

  // Admin Get Ticket Details
  fastify.get('/admin/support/tickets/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('support_view')],
    schema: {
      tags: ['Admin Support Management'],
      params: { type: 'object', properties: { id: { type: 'string' } } }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        assignedTo: { select: { firstName: true, lastName: true, email: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { 
            user: { 
              select: { 
                firstName: true, 
                lastName: true, 
                email: true,
                role: { select: { name: true } }
              } 
            } 
          }
        }
      }
    });

    if (!ticket) return reply.status(404).send({ message: 'Ticket not found' });

    return createResponse(ticket);
  });

  // Admin Respond to Ticket
  fastify.post('/admin/support/tickets/:id/messages', {
    preHandler: [fastify.authenticate, fastify.hasPermission('support_manage')],
    schema: {
      tags: ['Admin Support Management'],
      params: { type: 'object', properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string' },
          attachments: { type: 'array', items: { type: 'string' } },
          status: { type: 'string' } // Optional status update
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const { message, attachments, status } = request.body as any;
    const adminUser = request.user as any;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: { user: true }
    });

    if (!ticket) return reply.status(404).send({ message: 'Ticket not found' });

    const newMessage = await prisma.ticketMessage.create({
      data: {
        ticketId: id,
        userId: adminUser.id,
        message,
        isAdmin: true,
        attachments: attachments || []
      }
    });

    // Update status and assignment
    await prisma.supportTicket.update({
      where: { id },
      data: { 
        status: status || 'RESPONDED',
        assignedToId: adminUser.id,
        updatedAt: new Date()
      }
    });

    // Notify User
    const userName = `${ticket.user.firstName || ''} ${ticket.user.lastName || ''}`.trim() || ticket.user.email;
    
    if (status === 'CLOSED' || status === 'RESOLVED') {
      await emailService.sendTicketResolvedNotification(ticket.user.email, userName, ticket.id, ticket.subject);
    } else {
      await emailService.sendTicketReplyNotification(ticket.user.email, userName, ticket.id, ticket.subject);
    }

    return createResponse(newMessage, 'Reply sent successfully');
  });

  // Admin Update Ticket
  fastify.put('/admin/support/tickets/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('support_manage')],
    schema: {
      tags: ['Admin Support Management'],
      params: { type: 'object', properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          priority: { type: 'string' },
          assignedToId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const updateData = request.body as any;

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: { ...updateData, updatedAt: new Date() },
      include: {
        assignedTo: { select: { firstName: true, lastName: true, email: true } }
      }
    });

    return createResponse(ticket, 'Ticket updated successfully');
  });
}
