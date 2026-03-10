import { FastifyInstance } from 'fastify';
import { logActivity } from '../utils/audit';

export default async function roleRoutes(fastify: FastifyInstance) {


  // List system permissions
  fastify.get('/admin/permissions', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Roles'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
             properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              key: { type: 'string' }
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
        const perms = await fastify.prisma.permission.findMany({
            orderBy: { key: 'asc' }
        });
        return perms;
      } catch(err) {
        fastify.log.error(err);
        return reply.status(500).send({ message: 'Internal Server Error' });
      }
  });
  
  // List all roles (Paginated & Search)
  fastify.get('/admin/roles', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'List roles with pagination and search',
      tags: ['Roles'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          search: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { 
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string', nullable: true },
                        usersCount: { type: 'integer' },
                        permissions: { type: 'array', items: { type: 'string' } },
                        createdAt: { type: 'string' },
                        updatedAt: { type: 'string' }
                    }
                } 
            },
            total: { type: 'integer' },
            page: { type: 'integer' },
            totalPages: { type: 'integer' }
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
    const { page, limit, search } = request.query as any;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (search) {
        where.name = { contains: search, mode: 'insensitive' };
    }

    try {
      const [roles, total] = await Promise.all([
          fastify.prisma.role.findMany({
            where,
            skip,
            take: limit,
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { users: true } },
                permissions: { include: { permission: true } }
            }
          }),
          fastify.prisma.role.count({ where })
      ]);

      const formattedRoles = roles.map(r => ({
          id: r.id,
          name: r.name,
          description: r.description,
          usersCount: r._count.users,
          permissions: r.permissions.map(rp => rp.permission.key),
          createdAt: r.createdAt,
          updatedAt: r.updatedAt
      }));

      return {
          data: formattedRoles,
          total,
          page,
          totalPages: Math.ceil(total / limit)
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Create a new role
  fastify.post('/admin/roles', {
    preHandler: [fastify.authenticate, fastify.hasPermission('user_manage')],
    schema: {
      description: 'Create a new role',
      tags: ['Roles'],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          permissionIds: { type: 'array', items: { type: 'string' } }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true }
          }
        },
        400: {
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
  }, async (request: any, reply) => {
    const { name, description, permissionIds } = request.body;
    try {
      const role = await fastify.prisma.role.create({
        data: { 
            name: name.toUpperCase(), 
            description,
            permissions: permissionIds ? {
                  create: permissionIds.map((pid: string) => ({
                    permission: { connect: { key: pid } }
                }))
            } : undefined
        }
      });
      
      // Log Activity
      await logActivity(fastify, {
          entityType: 'ROLE',
          entityId: role.id,
          action: 'CREATE',
          performedBy: request.user?.id || 'SYSTEM',
          details: { name: role.name, description, permissions: permissionIds },
          ip: request.ip,
          userAgent: request.headers['user-agent']
      });

      return reply.status(201).send(role);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.status(400).send({ message: 'Role already exists' });
      }
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Update a role
  fastify.put('/admin/roles/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('user_manage')],
    schema: {
      description: 'Update a role',
      tags: ['Roles'],
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
          permissionIds: { type: 'array', items: { type: 'string' } }
        }
      },
      response: {
        200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string', nullable: true }
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
  }, async (request: any, reply) => {
    const { id } = request.params;
    const { name, description, permissionIds } = request.body;
    try {
      
      // Transaction to handle permission updates
      const role = await fastify.prisma.$transaction(async (tx) => {
          // 1. Update basic info
           const updated = await tx.role.update({
            where: { id },
            data: { 
              name: name ? name.toUpperCase() : undefined, 
              description
            }
          });

          // 2. If permissions provided, replace them
          if (permissionIds) {
              // Delete existing
              await tx.rolePermission.deleteMany({ where: { roleId: id } });
              
              // Create new
              if (permissionIds.length > 0) {
                  // Fetch IDs for the Keys
                  const perms = await tx.permission.findMany({
                      where: { key: { in: permissionIds } },
                      select: { id: true }
                  });

                  if (perms.length > 0) {
                      await tx.rolePermission.createMany({
                          data: perms.map(p => ({
                              roleId: id,
                              permissionId: p.id
                          }))
                      });
                  }
              }
          }
          return updated;
      });

      // Log Activity
      await logActivity(fastify, {
          entityType: 'ROLE',
          entityId: role.id,
          action: 'UPDATE',
          performedBy: request.user?.id || 'SYSTEM',
          details: { changes: { name, description, permissionIds } },
          ip: request.ip,
          userAgent: request.headers['user-agent']
      });

      return role;
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Delete a role
  fastify.delete('/admin/roles/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('user_manage')],
    schema: {
      description: 'Delete a role',
      tags: ['Roles'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
          204: {
              type: 'null',
              description: 'Role deleted successfully'
          },
          400: {
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
  }, async (request: any, reply) => {
    const { id } = request.params;
    try {
      // Check if role has users
      const usersCount = await fastify.prisma.user.count({ where: { roleId: id } });
      if (usersCount > 0) {
        return reply.status(400).send({ message: 'Cannot delete role that has assigned users' });
      }
      
      // Log before delete (or after success)
      await logActivity(fastify, {
          entityType: 'ROLE',
          entityId: id,
          action: 'DELETE',
          performedBy: request.user?.id || 'SYSTEM',
          details: { id },
          ip: request.ip,
          userAgent: request.headers['user-agent']
      });

      await fastify.prisma.role.update({ 
        where: { id },
        data: { deletedAt: new Date() }
      });
      return reply.status(204).send();
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });
}
