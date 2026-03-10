import { FastifyInstance } from 'fastify';

export default async function industryRoutes(fastify: FastifyInstance) {
  
  // List all industries
  fastify.get('/admin/industries', {
    schema: {
      description: 'List all industries',
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

      // @ts-ignore
      const industries = await fastify.prisma.industry.findMany({
        where: whereClause,
        orderBy: { name: 'asc' }
      });
      return industries;
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // List deactivated industries
  fastify.get('/admin/industries/deactivated', {
    preHandler: [fastify.authenticate, fastify.hasPermission('industry_manage')],
    schema: {
      description: 'List all deactivated industries',
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
      // @ts-ignore
      const industries = await fastify.prisma.industry.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' }
      });
      return industries;
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Create an industry
  fastify.post('/admin/industries', {
    preHandler: [fastify.authenticate, fastify.hasPermission('industry_manage')],
    schema: {
      description: 'Create a new industry',
      tags: ['Catalog'],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          slug: { type: 'string' },
          logoUrl: { type: 'string' },
          isActive: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const { name, description, slug, logoUrl, isActive } = request.body as any;
    try {
      // @ts-ignore
      const industry = await fastify.prisma.industry.create({
        data: { 
          name, 
          description, 
          slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
          logoUrl,
          isActive: isActive ?? true
        }
      });
      return reply.status(201).send(industry);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.status(400).send({ message: 'Industry name or slug already exists' });
      }
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Update an industry
  fastify.put('/admin/industries/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('industry_manage')],
    schema: {
      description: 'Update an industry',
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
          description: { type: 'string' },
          slug: { type: 'string' },
          logoUrl: { type: 'string' },
          isActive: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const { name, description, slug, logoUrl, isActive } = request.body as any;
    try {
      // @ts-ignore
      const industry = await fastify.prisma.industry.update({
        where: { id },
        data: { 
            name, 
            description, 
            slug, 
            logoUrl,
            isActive 
        }
      });
      return industry;
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Soft Delete an industry
  fastify.delete('/admin/industries/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('industry_manage')],
    schema: {
      description: 'Soft delete an industry',
      tags: ['Catalog'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        204: {
          description: 'Industry successfully deleted',
          type: 'null'
        },
        500: {
          description: 'Internal server error',
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
      // @ts-ignore
      await fastify.prisma.industry.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false
        }
      });
      return reply.status(204).send();
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Permanent Delete an industry
  fastify.delete('/admin/industries/:id/permanent', {
    preHandler: [fastify.authenticate, fastify.hasPermission('industry_manage')],
    schema: {
      description: 'Permanently delete an industry',
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
        400: {
          properties: { message: { type: 'string' } }
        },
        404: {
          properties: { message: { type: 'string' } }
        },
        500: {
          properties: { message: { type: 'string' } }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    try {
      // @ts-ignore
      const industry = await fastify.prisma.industry.findUnique({
        where: { id }
      });

      if (!industry) {
        return reply.status(404).send({ message: 'Industry not found' });
      }

      if (!industry.deletedAt) {
        return reply.status(400).send({ message: 'Only deactivated industries can be permanently deleted.' });
      }

      // Check for products
      // @ts-ignore
      const productCount = await fastify.prisma.productIndustry.count({ where: { industryId: id } });
      if (productCount > 0) {
        return reply.status(400).send({ message: 'Cannot permanently delete industry with associated products' });
      }

      // @ts-ignore
      await fastify.prisma.industry.delete({ where: { id } });

      return reply.status(200).send({ success: true, message: 'Industry permanently deleted' });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Restore an industry
  fastify.patch('/admin/industries/:id/restore', {
    preHandler: [fastify.authenticate, fastify.hasPermission('industry_manage')],
    schema: {
      description: 'Restore a deactivated industry',
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
          properties: { message: { type: 'string' } }
        },
        500: {
          properties: { message: { type: 'string' } }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    try {
      // @ts-ignore
      const industry = await fastify.prisma.industry.update({
        where: { id },
        data: { 
          deletedAt: null,
          isActive: true 
        }
      });

      return reply.status(200).send({ success: true, message: 'Industry restored successfully' });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });
}
