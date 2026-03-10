import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';

export default async function logsRoutes(fastify: FastifyInstance) {
  
  // Get Audit Logs
  fastify.get('/admin/logs', {
    schema: {
      description: 'Get Audit/Activity Logs with pagination and filtering',
      tags: ['Logs'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          search: { type: 'string' },
          entityType: { type: 'string' },
          action: { type: 'string' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' }
        }
      },
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
                    data: { 
                        type: 'array',
                        items: { 
                            type: 'object', 
                            additionalProperties: true,
                            properties: {
                                id: { type: 'string' },
                                entityType: { type: 'string' },
                                action: { type: 'string' },
                                createdAt: { type: 'string' },
                                performer: {
                                    type: 'object',
                                    properties: {
                                        email: { type: 'string' },
                                        firstName: { type: 'string', nullable: true },
                                        lastName: { type: 'string', nullable: true }
                                    }
                                }
                            }
                        } 
                    },
                    total: { type: 'integer' },
                    page: { type: 'integer' },
                    totalPages: { type: 'integer' }
                }
            }
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
        const { page, limit, search, entityType, action, startDate, endDate } = request.query;
        const pageNum = page || 1;
        const limitNum = limit || 20;
        const skip = (pageNum - 1) * limitNum;

        const where: any = {};
        
        if (entityType) where.entityType = entityType;
        if (action) where.action = action;
        
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        if (search) {
            where.OR = [
                { id: { contains: search, mode: 'insensitive' } },
                { entityType: { contains: search, mode: 'insensitive' } },
                { action: { contains: search, mode: 'insensitive' } },
                { performedBy: { contains: search, mode: 'insensitive' } },
                { performer: { email: { contains: search, mode: 'insensitive' } } },
                { performer: { firstName: { contains: search, mode: 'insensitive' } } },
                { performer: { lastName: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const [logs, total] = await Promise.all([
            (fastify.prisma as any).auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
                include: { 
                    performer: { 
                        select: { 
                            email: true, 
                            firstName: true, 
                            lastName: true,
                            role: {
                                select: { name: true }
                            }
                        } 
                    } 
                }
            }),
            (fastify.prisma as any).auditLog.count({ where })
        ]);

        return createResponse({
            data: logs,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum)
        }, 'Audit logs retrieved');

    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Internal Server Error: ' + err.message));
    }
  });

  // Get User Account Logs (IAM)
  fastify.get('/admin/logs/user-accounts', {
    schema: {
      description: 'Get User Account details/logs with IAM metadata',
      tags: ['Logs'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          search: { type: 'string' },
          roleId: { type: 'string' },
          accountStatus: { type: 'string' }
        }
      },
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
                    data: { 
                        type: 'array',
                        items: { 
                            type: 'object', 
                            additionalProperties: true,
                            properties: {
                                id: { type: 'string' },
                                email: { type: 'string' },
                                firstName: { type: 'string', nullable: true },
                                lastName: { type: 'string', nullable: true },
                                createdAt: { type: 'string' },
                                lastLoginAt: { type: 'string', nullable: true },
                                lastPasswordChangedAt: { type: 'string', nullable: true },
                                lockedAt: { type: 'string', nullable: true },
                                accountStatus: { type: 'string' },
                                role: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' }
                                    }
                                }
                            }
                        } 
                    },
                    total: { type: 'integer' },
                    page: { type: 'integer' },
                    totalPages: { type: 'integer' }
                }
            }
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
        const { page, limit, search, roleId, accountStatus } = request.query;
        const pageNum = page || 1;
        const limitNum = limit || 20;
        const skip = (pageNum - 1) * limitNum;

        const where: any = {};
        
        if (roleId) where.roleId = roleId;
        if (accountStatus) where.accountStatus = accountStatus;
        
        if (search) {
            where.OR = [
                { id: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } }
            ];
        }

        const [users, total] = await Promise.all([
            fastify.prisma.user.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limitNum,
                include: { 
                    role: { 
                        select: { name: true } 
                    } 
                }
            }),
            fastify.prisma.user.count({ where })
        ]);

        return createResponse({
            data: users,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum)
        }, 'User account logs retrieved');

    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Internal Server Error: ' + err.message));
    }
  });
  // Export Logs (Super Admin Only)
  fastify.get('/admin/logs/export', {
    schema: {
      tags: ['Logs'],
      response: {
        200: { type: 'string' }, // CSV content
        403: {
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
  }, async (request: any, reply) => {
    try {
      // Check Super Admin
      if (request.user?.role !== 'SUPER_ADMIN') {
        return reply.status(403).send(createErrorResponse('Access denied. Export is allowed for Super Admins only.'));
      }

      const { search, entityType, action, startDate, endDate } = request.query;
      const where: any = {};
      if (entityType) where.entityType = entityType;
      if (action) where.action = action;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }
      if (search) {
        where.OR = [
          { entityType: { contains: search, mode: 'insensitive' } },
          { action: { contains: search, mode: 'insensitive' } },
        ];
      }

      const logs = await (fastify.prisma as any).auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { 
          performer: {
            include: { role: true }
          }
        },
        take: 1000 // Limit export to 1000 for safety
      });

      // Enhanced CSV generation with performer metadata
      const header = 'Event ID,Timestamp,User ID,User Name,ID Creation Date,ID Created By,Roles / Groups Assigned,ID Disabled / Locked / Blocked Date,Last Login Date,Last Password Changed Date,Account Status,Entity,Action,Details\n';
      const rows = logs.map((log: any) => {
        const perf = log.performer;
        const userId = perf?.id || 'N/A';
        const userName = perf ? `"${perf.firstName || ''} ${perf.lastName || ''}"`.trim() || perf.email : 'System';
        const idCreationDate = perf?.createdAt || 'N/A';
        const idCreatedBy = perf?.createdById || 'System';
        const roles = perf?.role?.name || 'N/A';
        const disabledDate = perf?.lockedAt || '';
        const lastLogin = perf?.lastLoginAt || '';
        const lastPwdChange = perf?.lastPasswordChangedAt || '';
        const status = perf?.accountStatus || 'N/A';
        
        const details = JSON.stringify(log.details).replace(/"/g, '""');
        
        return `${log.id},${log.createdAt},${userId},${userName},${idCreationDate},${idCreatedBy},"${roles}",${disabledDate},${lastLogin},${lastPwdChange},${status},${log.entityType},${log.action},"${details}"`;
      }).join('\n');

      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', 'attachment; filename="audit-trails.csv"');
      return header + rows;

    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Export failed: ' + err.message));
    }
  });

  // Export User Account Logs
  fastify.get('/admin/logs/user-accounts/export', {
    schema: {
      tags: ['Logs'],
      response: {
        200: { type: 'string' },
        403: {
          type: 'object',
          properties: {
             status: { type: 'string' },
             success: { type: 'boolean' },
             message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
             status: { type: 'string' },
             success: { type: 'boolean' },
             message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: any, reply) => {
    try {
      if (request.user?.role !== 'SUPER_ADMIN') {
        return reply.status(403).send(createErrorResponse('Access denied.'));
      }

      const users = await (fastify.prisma as any).user.findMany({
        orderBy: { createdAt: 'desc' },
        include: { role: true }
      });

      const header = 'User ID,Email,User Name,ID Creation Date,Roles / Groups Assigned,Account Status,Last Login Date,Last Password Changed Date,ID Disabled / Locked / Blocked Date,ID Created By\n';
      const rows = users.map((u: any) => {
        const name = `"${u.firstName || ''} ${u.lastName || ''}"`;
        const role = u.role?.name || 'N/A';
        const createdBy = u.createdById || 'System'; // Ideally we'd join this but simple ID for now as requested "ID Created By"
        return `${u.id},${u.email},${name},${u.createdAt},${role},${u.accountStatus},${u.lastLoginAt || ''},${u.lastPasswordChangedAt || ''},${u.lockedAt || ''},${createdBy}`;
      }).join('\n');

      reply.header('Content-Type', 'text/csv');
      reply.header('Content-Disposition', 'attachment; filename="user-account-logs.csv"');
      return header + rows;
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse('Export failed: ' + err.message));
    }
  });

}
