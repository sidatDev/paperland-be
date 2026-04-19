import { FastifyInstance } from 'fastify';
import { logActivity } from '../utils/audit';
import * as z from 'zod';

export default async function logisticsRoutes(fastify: FastifyInstance) {
  // ----- COURIERS -----
  fastify.get('/admin/logistics/couriers', {
    preHandler: [fastify.authenticate, fastify.hasPermission('logistics_manage')]
  }, async (request, reply) => {
    const couriers = await (fastify.prisma as any).courierProvider.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return { data: couriers };
  });

  fastify.post('/admin/logistics/couriers', {
    preHandler: [fastify.authenticate, fastify.hasPermission('logistics_manage')]
  }, async (request, reply) => {
    const payload = request.body as any;
    const bodySchema = z.object({
      name: z.string().min(2),
      code: z.string().min(2),
      trackingUrl: z.string().url().optional(),
      isActive: z.boolean().default(true),
    });
    const data = bodySchema.parse(payload);
    
    try {
      // Check for duplicate name or code
      const existing = await (fastify.prisma as any).courierProvider.findFirst({
        where: { OR: [{ name: data.name }, { code: data.code }] }
      });
      if (existing) {
        const field = existing.name === data.name ? 'name' : 'code';
        return reply.status(400).send({ message: `A courier with this ${field} already exists.` });
      }

      const courier = await (fastify.prisma as any).courierProvider.create({
        data: { ...data, region: 'PK' }
      });
      
      await logActivity(fastify, {
          entityType: 'COURIER',
          entityId: courier.id,
          action: 'CREATE',
          performedBy: (request.user as any)?.id,
          details: { courierId: courier.id, name: courier.name },
          ip: request.ip,
          userAgent: request.headers['user-agent']
      });
      return reply.code(201).send({ data: courier });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.status(400).send({ message: 'A courier with this code already exists.' });
      }
      throw err;
    }
  });

  fastify.patch('/admin/logistics/couriers/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('logistics_manage')]
  }, async (request, reply) => {
    const { id } = request.params as any;
    const payload = request.body as any;
    const bodySchema = z.object({
      name: z.string().min(2),
      code: z.string().min(2),
      trackingUrl: z.string().url().optional().nullable(),
      isActive: z.boolean(),
    });
    const data = bodySchema.partial().parse(payload);
    
    try {
      // Check for duplicate name or code (excluding self)
      if (data.name || data.code) {
        const existing = await (fastify.prisma as any).courierProvider.findFirst({
          where: { 
            OR: [
              data.name ? { name: data.name } : {},
              data.code ? { code: data.code } : {}
            ].filter(q => Object.keys(q).length > 0),
            NOT: { id }
          }
        });
        if (existing) {
          const field = existing.name === data.name ? 'name' : 'code';
          return reply.status(400).send({ message: `Another courier with this ${field} already exists.` });
        }
      }

      const courier = await (fastify.prisma as any).courierProvider.update({
        where: { id },
        data
      });
      
      await logActivity(fastify, {
          entityType: 'COURIER',
          entityId: courier.id,
          action: 'UPDATE',
          performedBy: (request.user as any)?.id,
          details: { courierId: courier.id, name: courier.name },
          ip: request.ip,
          userAgent: request.headers['user-agent']
      });
      return reply.send({ data: courier });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.status(400).send({ message: 'Another courier with this code already exists.' });
      }
      throw err;
    }
  });

  fastify.delete('/admin/logistics/couriers/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('logistics_manage')]
  }, async (request, reply) => {
    const { id } = request.params as any;
    await (fastify.prisma as any).courierProvider.delete({ where: { id } });
    await logActivity(fastify, {
        entityType: 'COURIER',
        entityId: id,
        action: 'DELETE',
        performedBy: (request.user as any)?.id,
        details: { courierId: id },
        ip: request.ip,
        userAgent: request.headers['user-agent']
    });
    return reply.code(200).send({ message: 'Deleted' });
  });

  // ----- RIDERS -----
  fastify.get('/admin/logistics/riders', {
    preHandler: [fastify.authenticate, fastify.hasPermission('logistics_manage')]
  }, async (request, reply) => {
    const riders = await (fastify.prisma as any).rider.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return { data: riders };
  });

  fastify.post('/admin/logistics/riders', {
    preHandler: [fastify.authenticate, fastify.hasPermission('logistics_manage')]
  }, async (request, reply) => {
    const payload = request.body as any;
    const bodySchema = z.object({
      name: z.string().min(2),
      phone: z.string().min(5),
      cnic: z.string().optional(),
      city: z.string().optional(),
      vehicleInfo: z.string().optional(),
      isActive: z.boolean().default(true),
    });
    const data = bodySchema.parse(payload);
    
    try {
      // Check for duplicate name, phone or cnic
      const existing = await (fastify.prisma as any).rider.findFirst({
        where: { 
            OR: [
                { name: data.name }, 
                { phone: data.phone },
                data.cnic ? { cnic: data.cnic } : {}
            ].filter(q => Object.keys(q).length > 0)
        }
      });
      if (existing) {
        let field = 'details';
        if (existing.name === data.name) field = 'name';
        else if (existing.phone === data.phone) field = 'phone number';
        else if (existing.cnic === data.cnic) field = 'CNIC';
        return reply.status(400).send({ message: `A rider with this ${field} already exists.` });
      }

      const rider = await (fastify.prisma as any).rider.create({
        data: { ...data, region: 'PK' }
      });
      return reply.code(201).send({ data: rider });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.status(400).send({ message: 'A rider with this CNIC already exists.' });
      }
      throw err;
    }
  });

  fastify.patch('/admin/logistics/riders/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('logistics_manage')]
  }, async (request, reply) => {
    const { id } = request.params as any;
    const payload = request.body as any;
    const bodySchema = z.object({
      name: z.string().min(2),
      phone: z.string().min(5),
      cnic: z.string().optional().nullable(),
      city: z.string().optional().nullable(),
      vehicleInfo: z.string().optional().nullable(),
      isActive: z.boolean(),
      status: z.string().optional(),
    });
    const data = bodySchema.partial().parse(payload);
    
    try {
      // Check for duplicate name, phone or cnic (excluding self)
      const existing = await (fastify.prisma as any).rider.findFirst({
        where: { 
            OR: [
                data.name ? { name: data.name } : {},
                data.phone ? { phone: data.phone } : {},
                data.cnic ? { cnic: data.cnic } : {}
            ].filter(q => Object.keys(q).length > 0),
            NOT: { id }
        }
      });
      if (existing) {
        let field = 'details';
        if (existing.name === data.name) field = 'name';
        else if (existing.phone === data.phone) field = 'phone number';
        else if (existing.cnic === data.cnic) field = 'CNIC';
        return reply.status(400).send({ message: `Another rider with this ${field} already exists.` });
      }

      const rider = await (fastify.prisma as any).rider.update({
        where: { id },
        data
      });
      return reply.send({ data: rider });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.status(400).send({ message: 'Another rider with this CNIC already exists.' });
      }
      throw err;
    }
  });

  fastify.delete('/admin/logistics/riders/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('logistics_manage')]
  }, async (request, reply) => {
    const { id } = request.params as any;
    await (fastify.prisma as any).rider.delete({ where: { id } });
    return reply.code(200).send({ message: 'Deleted' });
  });

  // ----- SHIPPING RULES -----
  fastify.get('/admin/logistics/shipping-rules', {
    preHandler: [fastify.authenticate, fastify.hasPermission('logistics_manage')]
  }, async (request, reply) => {
    const rules = await (fastify.prisma as any).shippingRule.findMany({
      orderBy: { priority: 'desc' },
      include: { courierProvider: true }
    });
    return { data: rules };
  });

  fastify.post('/admin/logistics/shipping-rules', {
    preHandler: [fastify.authenticate, fastify.hasPermission('logistics_manage')]
  }, async (request, reply) => {
    const payload = request.body as any;
    const bodySchema = z.object({
      name: z.string().min(2),
      city: z.string().optional().nullable(),
      logisticsType: z.enum(['THIRD_PARTY', 'SELF_DELIVERY']),
      minOrderValue: z.number().optional().nullable(),
      maxOrderValue: z.number().optional().nullable(),
      courierProviderId: z.string().optional().nullable(),
      warehouseId: z.string().optional().nullable(),
      priority: z.number().default(0),
      isActive: z.boolean().default(true),
    });
    const data = bodySchema.parse(payload);
    
    try {
      const rule = await (fastify.prisma as any).shippingRule.create({
        data: { ...data, region: 'PK' }
      });
      return reply.code(201).send({ data: rule });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.status(400).send({ message: 'A shipping rule with this name already exists.' });
      }
      throw err;
    }
  });

  fastify.patch('/admin/logistics/shipping-rules/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('logistics_manage')]
  }, async (request, reply) => {
    const { id } = request.params as any;
    const payload = request.body as any;
    const bodySchema = z.object({
      name: z.string().min(2),
      city: z.string().optional().nullable(),
      logisticsType: z.enum(['THIRD_PARTY', 'SELF_DELIVERY']),
      minOrderValue: z.number().optional().nullable(),
      maxOrderValue: z.number().optional().nullable(),
      courierProviderId: z.string().optional().nullable(),
      warehouseId: z.string().optional().nullable(),
      priority: z.number(),
      isActive: z.boolean(),
    });
    const data = bodySchema.partial().parse(payload);
    
    try {
      const rule = await (fastify.prisma as any).shippingRule.update({
        where: { id },
        data
      });
      return reply.send({ data: rule });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.status(400).send({ message: 'Another shipping rule with this name already exists.' });
      }
      throw err;
    }
  });

  fastify.delete('/admin/logistics/shipping-rules/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('logistics_manage')]
  }, async (request, reply) => {
    const { id } = request.params as any;
    await (fastify.prisma as any).shippingRule.delete({ where: { id } });
    return reply.code(200).send({ message: 'Deleted' });
  });

}
