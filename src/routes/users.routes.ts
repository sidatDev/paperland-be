import { FastifyInstance } from 'fastify';
import * as bcrypt from 'bcryptjs';
import { logActivity } from '../utils/audit';

export default async function userRoutes(fastify: FastifyInstance) {
  
  // List all users
  fastify.get('/admin/users', {
    preHandler: [fastify.authenticate, fastify.requireSuperAdmin],
    schema: {
      description: 'List all staff users with pagination and search',
      tags: ['Users'],
      querystring: {
        type: 'object',
        properties: {
          roleId: { type: 'string' },
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
                  email: { type: 'string' },
                  firstName: { type: 'string', nullable: true },
                  lastName: { type: 'string', nullable: true },
                  isActive: { type: 'boolean' },
                  role: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' }
                    }
                  },
                  createdAt: { type: 'string' }
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
    const { roleId, page, limit, search } = request.query as any;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (roleId && roleId !== 'all') {
        where.roleId = roleId;
    }
    if (search) {
        where.OR = [
            { email: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } }
        ];
    }

    try {
      const [users, total] = await Promise.all([
          fastify.prisma.user.findMany({
            where,
            skip,
            take: limit,
            include: { role: true },
            orderBy: { createdAt: 'desc' }
          }),
          fastify.prisma.user.count({ where })
      ]);

      return {
          data: users,
          total,
          page,
          totalPages: Math.ceil(total / limit)
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Create a new staff user
  fastify.post('/admin/users', {
    preHandler: [fastify.authenticate, fastify.hasPermission('user_manage')],
    schema: {
      description: 'Create a new staff user',
      tags: ['Users'],
      body: {
        type: 'object',
        required: ['email', 'password', 'roleId'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          roleId: { type: 'string' },
          isActive: { type: 'boolean' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' }
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
  }, async (request, reply) => {
    const { email, password, firstName, lastName, roleId, isActive } = request.body as any;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await fastify.prisma.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          firstName,
          lastName,
          roleId,
          isActive: isActive ?? true,
          createdById: (request.user as any)?.id
        }
      });

      // Log Activity
      await logActivity(fastify, {
        entityType: 'USER',
        entityId: user.id,
        action: 'CREATE',
        performedBy: (request.user as any)?.id,
        details: { email, firstName, lastName, roleId },
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });

      return reply.status(201).send(user);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.status(400).send({ message: 'User already exists' });
      }
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Update user
  fastify.put('/admin/users/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('user_manage')],
    schema: {
      description: 'Update user details',
      tags: ['Users'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          roleId: { type: 'string' },
          isActive: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    const { firstName, lastName, roleId, isActive } = request.body as any;
    try {
      const beforeUser = await fastify.prisma.user.findUnique({ where: { id } });
      const currentLockedAt = beforeUser?.lockedAt;
      
      let newLockedAt = currentLockedAt;
      if (isActive === false && beforeUser?.isActive !== false) {
        newLockedAt = new Date();
      } else if (isActive === true && beforeUser?.isActive !== true) {
        newLockedAt = null;
      }

      const user = await fastify.prisma.user.update({
        where: { id },
        data: { 
          firstName, 
          lastName, 
          roleId, 
          isActive,
          lockedAt: newLockedAt
        }
      });

      // Log Activity
      await logActivity(fastify, {
        entityType: 'USER',
        entityId: id,
        action: 'UPDATE',
        performedBy: (request.user as any)?.id,
        details: { before: beforeUser, after: user },
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });

      return user;
    } catch (err: any) {
      if (err.code === 'P2003') {
        return reply.status(400).send({ message: 'Invalid Role ID provided' });
      }
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Delete user
  fastify.delete('/admin/users/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('user_manage')],
    schema: {
      description: 'Delete a staff user',
      tags: ['Users'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as any;
    fastify.log.info(`Attempting to delete user with ID: ${id}`);
    try {
      const user = await fastify.prisma.user.findUnique({ where: { id } });
      if (!user) {
        fastify.log.warn(`User with ID ${id} not found`);
        return reply.status(404).send({ message: 'User not found' });
      }
      
      await fastify.prisma.user.delete({ where: { id } });
      
      // Log Activity
      await logActivity(fastify, {
        entityType: 'USER',
        entityId: id,
        action: 'DELETE',
        performedBy: (request.user as any)?.id,
        details: { email: user.email },
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });

      fastify.log.info(`Successfully deleted user with ID: ${id}`);
      return reply.status(204).send();
    } catch (err: any) {
      fastify.log.error(`Error deleting user ${id}: ${err.message || err}`);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Bulk delete users
  fastify.post('/admin/users/bulk-delete', {
    preHandler: [fastify.authenticate, fastify.hasPermission('user_manage')],
    schema: {
      description: 'Bulk delete staff users',
      tags: ['Users'],
      body: {
        type: 'object',
        required: ['ids'],
        properties: {
          ids: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { ids } = request.body as any;
    fastify.log.info(`Attempting to bulk delete users with IDs: ${ids.join(', ')}`);
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return reply.status(400).send({ message: 'Invalid or empty IDs array' });
      }

      const users = await fastify.prisma.user.findMany({
        where: { id: { in: ids } }
      });

      if (users.length === 0) {
        return reply.status(404).send({ message: 'No users found for the provided IDs' });
      }

      // Use a transaction for atomic cleanup and deletion
      await fastify.prisma.$transaction(async (tx) => {
        // 1. Delete associated permissions
        await tx.userPermission.deleteMany({
          where: { userId: { in: ids } }
        });

        // 2. Delete personal addresses
        await tx.address.deleteMany({
          where: { userId: { in: ids } }
        });

        // 3. Delete carts and cart items
        // First delete items to avoid FK issues with cart_id
        await tx.cartItem.deleteMany({
          where: { cart: { userId: { in: ids } } }
        });
        await tx.cart.deleteMany({
          where: { userId: { in: ids } }
        });

        // 4. Delete the users themselves
        await tx.user.deleteMany({
          where: { id: { in: ids } }
        });
      });

      // Log Activity for the bulk operation
      await logActivity(fastify, {
        entityType: 'USER',
        entityId: 'BULK',
        action: 'DELETE',
        performedBy: (request.user as any)?.id,
        details: { deletedEmails: users.map(u => u.email), count: users.length },
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });

      fastify.log.info(`Successfully bulk deleted ${users.length} users`);
      return reply.status(204).send();
    } catch (err: any) {
      fastify.log.error(`Error bulk deleting users: ${err.message || err}`);
      
      // Provide more specific error message if it's a known constraint issue
      if (err.message?.includes('foreign key constraint') || err.code === 'P2003') {
        return reply.status(400).send({ 
          message: 'Some users cannot be deleted because they have associated critical data (like Orders or Blog Posts) that must be preserved.' 
        });
      }
      
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });

  // Update own profile
  fastify.put('/admin/users/profile', {
    preHandler: [fastify.authenticate],
    schema: {
      description: 'Update current user profile',
      tags: ['Users'],
      body: {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phoneNumber: { type: 'string' },
          profilePictureUrl: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            firstName: { type: 'string', nullable: true },
            lastName: { type: 'string', nullable: true },
            phoneNumber: { type: 'string', nullable: true },
            profilePictureUrl: { type: 'string', nullable: true }
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
    const userId = (request.user as any).id;
    const { firstName, lastName, phoneNumber, profilePictureUrl } = request.body as any;

    try {
      const updatedUser = await fastify.prisma.user.update({
        where: { id: userId },
        data: {
          firstName,
          lastName,
          phoneNumber,
          profilePictureUrl
        }
      });

      // Log Activity
      await logActivity(fastify, {
        entityType: 'USER',
        entityId: userId,
        action: 'UPDATE_PROFILE',
        performedBy: userId,
        details: { firstName, lastName, phoneNumber, profilePictureUrl },
        ip: request.ip,
        userAgent: request.headers['user-agent']
      });

      return updatedUser;
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Internal Server Error' });
    }
  });
}
