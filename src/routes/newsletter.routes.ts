import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { emailService } from '../services/email.service';

export default async function newsletterRoutes(fastify: FastifyInstance) {
  
  // Subscribe to newsletter (Public)
  fastify.post('/public/newsletter/subscribe', {
    schema: {
      description: 'Subscribe to blog newsletter',
      tags: ['Newsletter'],
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { 
            type: 'string', 
            format: 'email',
            pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
          }
        }
      }
    }
  }, async (request: any, reply) => {
    const { email } = request.body;
    
    try {
      // Check if email already exists
      const existing = await (fastify.prisma as any).blogSubscriber.findUnique({
        where: { email: email.toLowerCase() }
      });
      
      if (existing) {
        if (existing.isActive) {
          return reply.status(400).send(createErrorResponse('This email is already subscribed to our newsletter'));
        } else {
          // Reactivate subscription
          await (fastify.prisma as any).blogSubscriber.update({
            where: { email: email.toLowerCase() },
            data: { isActive: true }
          });
          
          return createResponse(null, 'Welcome back! Your subscription has been reactivated.');
        }
      }
      
      // Create new subscriber
      await (fastify.prisma as any).blogSubscriber.create({
        data: {
          email: email.toLowerCase()
        }
      });
      
      // Send welcome email using centralized email service
      try {
        if (emailService) {
          await emailService.sendNewsletterWelcomeEmail(email);
        } else {
          fastify.log.warn('Email service not initialized, skipping welcome email');
        }
      } catch (emailError: any) {
        fastify.log.error(
          { 
            error: emailError.message, 
            code: emailError.code,
            command: emailError.command,
            response: emailError.response,
            stack: emailError.stack,
            email 
          }, 
          `❌ Newsletter Welcome Email Failed for ${email}. Check EmailService logs for SMTP connection details.`
        );
        // Don't fail the subscription if email fails
      }
      
      return createResponse(
        { email: email.toLowerCase() },
        'Successfully subscribed! Check your email for confirmation.'
      );
    } catch (err: any) {
      fastify.log.error(err);
      if (err.code === 'P2002') {
        return reply.status(400).send(createErrorResponse('Email already subscribed'));
      }
      return reply.status(500).send(createErrorResponse('Failed to subscribe. Please try again.'));
    }
  });
  
  // Unsubscribe from newsletter (Public)
  fastify.post('/public/newsletter/unsubscribe', {
    schema: {
      description: 'Unsubscribe from blog newsletter',
      tags: ['Newsletter'],
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' }
        }
      }
    }
  }, async (request: any, reply) => {
    const { email } = request.body;
    
    try {
      const subscriber = await (fastify.prisma as any).blogSubscriber.findUnique({
        where: { email: email.toLowerCase() }
      });
      
      if (!subscriber) {
        return reply.status(404).send(createErrorResponse('Email not found in our subscriber list'));
      }
      
      // Soft delete by setting isActive to false
      await (fastify.prisma as any).blogSubscriber.update({
        where: { email: email.toLowerCase() },
        data: { isActive: false }
      });
      
      return createResponse(null, 'You have been unsubscribed from our newsletter');
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to unsubscribe'));
    }
  });
  
  // Get all subscribers (Admin only)
  fastify.get('/admin/newsletter/subscribers', {
    schema: {
      description: 'List all newsletter subscribers',
      tags: ['Newsletter'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          active: { type: 'boolean' }
        }
      }
    }
  }, async (request: any, reply) => {
    const { page = 1, limit = 50, active } = request.query;
    
    try {
      const where: any = {};
      
      if (typeof active === 'boolean') {
        where.isActive = active;
      }
      
      const [subscribers, total] = await Promise.all([
        (fastify.prisma as any).blogSubscriber.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        (fastify.prisma as any).blogSubscriber.count({ where })
      ]);
      
      return createResponse({
        subscribers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }, 'Subscribers retrieved successfully');
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse('Failed to fetch subscribers'));
    }
  });
}
