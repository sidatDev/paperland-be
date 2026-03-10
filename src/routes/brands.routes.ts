import { FastifyInstance } from 'fastify';
import { logActivity } from '../utils/audit';

export default async function brandRoutes(fastify: FastifyInstance) {
  
  // List all brands
  fastify.get('/admin/brands', {
    schema: {
      description: 'List all product brands',
      tags: ['Catalog'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['Active', 'Inactive'] }
        }
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              slug: { type: 'string', nullable: true },
              description: { type: 'string', nullable: true },
              logoUrl: { type: 'string', nullable: true },
              isActive: { type: 'boolean' },
              createdAt: { type: 'string' }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { status } = request.query as any;
    try {
      const whereClause: any = { deletedAt: null };
      
      if (status) {
        whereClause.isActive = status === 'Active';
      }

      const brands = await (fastify.prisma as any).brand.findMany({
        where: whereClause,
        orderBy: { name: 'asc' }
      });
      return brands;
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // List deactivated brands
  fastify.get('/admin/brands/deactivated', {
    preHandler: [fastify.authenticate, fastify.hasPermission('brand_manage')],
    schema: {
      description: 'List all deactivated product brands',
      tags: ['Catalog'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              slug: { type: 'string', nullable: true },
              description: { type: 'string', nullable: true },
              logoUrl: { type: 'string', nullable: true },
              isActive: { type: 'boolean' },
              createdAt: { type: 'string' },
              deletedAt: { type: 'string', nullable: true }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const brands = await (fastify.prisma as any).brand.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' }
      });
      return brands;
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Create a brand
  fastify.post('/admin/brands', {
    preHandler: [fastify.authenticate, fastify.hasPermission('brand_manage')],
    schema: {
      description: 'Create a new brand',
      tags: ['Catalog'],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string' },
          logoUrl: { type: 'string' },
          isActive: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const { name, slug, description, logoUrl, isActive } = request.body as any;
    try {
      const brand = await (fastify.prisma as any).brand.create({
        data: { 
          name, 
          slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          description, 
          logoUrl, 
          isActive: isActive ?? true 
        }
      });

      // Log Activity
      await logActivity(fastify, {
          entityType: 'BRAND',
          entityId: brand.id,
          action: 'CREATE',
          performedBy: (request.user as any)?.id || 'unknown',
          details: { name, slug: brand.slug },
          ip: request.ip,
          userAgent: request.headers['user-agent']
      });

      return reply.status(201).send(brand);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.status(400).send({ message: 'Brand name or slug already exists' });
      }
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Update a brand
  fastify.put('/admin/brands/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('brand_manage')],
    schema: {
      description: 'Update a brand',
      tags: ['Catalog'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string' },
          logoUrl: { type: 'string' },
          isActive: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const { name, slug, description, logoUrl, isActive } = request.body as any;
    try {
      const brand = await (fastify.prisma as any).brand.update({
        where: { id },
        data: { name, slug, description, logoUrl, isActive }
      });

      // Log Activity
      await logActivity(fastify, {
          entityType: 'BRAND',
          entityId: id,
          action: 'UPDATE',
          performedBy: (request.user as any)?.id || 'unknown',
          details: { name, slug },
          ip: request.ip,
          userAgent: request.headers['user-agent']
      });

      return brand;
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Soft delete a brand
  fastify.delete('/admin/brands/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('brand_manage')],
    schema: {
      description: 'Soft delete a brand',
      tags: ['Catalog'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    try {
      // Check for products (only active/visible ones?)
      const productCount = await (fastify.prisma as any).product.count({ 
        where: { brandId: id, deletedAt: null } 
      });
      if (productCount > 0) {
        return reply.status(400).send({ message: 'Cannot deactivate brand with associated active products' });
      }

      await (fastify.prisma as any).brand.update({
        where: { id },
        data: { 
          deletedAt: new Date(),
          isActive: false 
        }
      });

      // Log Activity
      await logActivity(fastify, {
          entityType: 'BRAND',
          entityId: id,
          action: 'DELETE',
          performedBy: (request.user as any)?.id || 'unknown',
          details: { type: 'SOFT_DELETE' },
          ip: request.ip,
          userAgent: request.headers['user-agent']
      });

      return reply.status(204).send();
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Permanent Delete a brand
  fastify.delete('/admin/brands/:id/permanent', {
    preHandler: [fastify.authenticate, fastify.hasPermission('brand_manage')],
    schema: {
      description: 'Permanently delete a brand',
      tags: ['Catalog'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    try {
      const brand = await (fastify.prisma as any).brand.findUnique({
        where: { id }
      });

      if (!brand) {
        return reply.status(404).send({ message: 'Brand not found' });
      }

      if (!brand.deletedAt) {
        return reply.status(400).send({ message: 'Only deactivated brands can be permanently deleted.' });
      }

      const productCount = await (fastify.prisma as any).product.count({ where: { brandId: id } });
      if (productCount > 0) {
        return reply.status(400).send({ message: 'Cannot permanently delete brand with associated products' });
      }

      await (fastify.prisma as any).brand.delete({ where: { id } });

      // Log Activity
      await logActivity(fastify, {
          entityType: 'BRAND',
          entityId: id,
          action: 'PERMANENT_DELETE',
          performedBy: (request.user as any)?.id || 'unknown',
          details: { name: brand.name },
          ip: request.ip,
          userAgent: request.headers['user-agent']
      });

      return reply.status(200).send({ success: true, message: 'Brand permanently deleted' });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Restore a brand
  fastify.patch('/admin/brands/:id/restore', {
    preHandler: [fastify.authenticate, fastify.hasPermission('brand_manage')],
    schema: {
      description: 'Restore a deactivated brand',
      tags: ['Catalog'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    try {
      const brand = await (fastify.prisma as any).brand.update({
        where: { id },
        data: { 
          deletedAt: null,
          isActive: true 
        }
      });

      // Log Activity
      await logActivity(fastify, {
          entityType: 'BRAND',
          entityId: id,
          action: 'RESTORE',
          performedBy: (request.user as any)?.id || 'unknown',
          details: { name: brand.name },
          ip: request.ip,
          userAgent: request.headers['user-agent']
      });

      return { success: true, message: 'Brand restored successfully' };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });
}
