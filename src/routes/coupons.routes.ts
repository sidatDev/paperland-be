import { FastifyInstance } from 'fastify';

export default async function couponRoutes(fastify: FastifyInstance) {

  // GET all coupons (Admin)
  fastify.get('/admin/coupons', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_view')],
    schema: {
      tags: ['Admin Coupons'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const coupons = await (fastify.prisma as any).coupon.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' }
      });
      return reply.send(coupons);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch coupons' });
    }
  });

  // POST create a new coupon
  fastify.post('/admin/coupons', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
    schema: {
      tags: ['Admin Coupons'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['code', 'discountType', 'discountValue', 'startDate', 'endDate'],
        properties: {
          code: { type: 'string', minLength: 3 },
          discountType: { type: 'string', enum: ['PERCENTAGE', 'FIXED'] },
          discountValue: { type: 'number', minimum: 0 },
          minOrderAmount: { type: 'number', minimum: 0 },
          maxDiscountAmount: { type: 'number', minimum: 0 },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          usageLimit: { type: 'number', minimum: 1 },
          isActive: { type: 'boolean', default: true }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { code, discountType, discountValue, minOrderAmount, maxDiscountAmount, startDate, endDate, usageLimit, isActive } = request.body as any;

      const existing = await (fastify.prisma as any).coupon.findUnique({
        where: { code }
      });

      if (existing && !existing.deletedAt) {
        return reply.status(400).send({ message: 'A coupon with this code already exists' });
      }

      const coupon = await (fastify.prisma as any).coupon.create({
        data: {
          code: code.toUpperCase(),
          discountType,
          discountValue,
          minOrderAmount: minOrderAmount || 0,
          maxDiscountAmount: maxDiscountAmount || 0,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          usageLimit: usageLimit || null,
          isActive: isActive !== undefined ? isActive : true
        }
      });

      return reply.status(201).send(coupon);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to create coupon' });
    }
  });

  // PUT update a coupon
  fastify.put('/admin/coupons/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
    schema: {
      tags: ['Admin Coupons'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } }
      },
      body: {
        type: 'object',
        properties: {
          code: { type: 'string', minLength: 3 },
          discountType: { type: 'string', enum: ['PERCENTAGE', 'FIXED'] },
          discountValue: { type: 'number', minimum: 0 },
          minOrderAmount: { type: 'number', minimum: 0 },
          maxDiscountAmount: { type: 'number', minimum: 0 },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          usageLimit: { type: 'number', minimum: 1 },
          isActive: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const data = request.body as any;

      const coupon = await (fastify.prisma as any).coupon.findUnique({ where: { id } });
      if (!coupon || coupon.deletedAt) return reply.status(404).send({ message: 'Coupon not found' });

      if (data.code && data.code.toUpperCase() !== coupon.code) {
        const existing = await (fastify.prisma as any).coupon.findUnique({ where: { code: data.code.toUpperCase() } });
        if (existing && !existing.deletedAt) {
          return reply.status(400).send({ message: 'A coupon with this code already exists' });
        }
      }

      const updated = await (fastify.prisma as any).coupon.update({
        where: { id },
        data: {
          ...data,
          code: data.code ? data.code.toUpperCase() : undefined,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined
        }
      });

      return reply.send(updated);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to update coupon' });
    }
  });

  // DELETE a coupon (Soft Delete)
  fastify.delete('/admin/coupons/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_manage')],
    schema: {
      tags: ['Admin Coupons'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      await (fastify.prisma as any).coupon.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false }
      });
      return reply.send({ success: true, message: 'Coupon deleted successfully' });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to delete coupon' });
    }
  });

  // GET /coupons/validate/:code (Public)
  fastify.get('/coupons/validate/:code', async (request, reply) => {
    try {
      const { code } = request.params as any;
      const { amount } = request.query as any; // Optional check for minOrderAmount

      const coupon = await (fastify.prisma as any).coupon.findUnique({
        where: { code: code.toUpperCase() }
      });

      if (!coupon || !coupon.isActive || coupon.deletedAt) {
        return reply.status(404).send({ valid: false, message: 'Invalid or inactive coupon code' });
      }

      const now = new Date();
      if (now < coupon.startDate) {
        return reply.status(400).send({ valid: false, message: 'Coupon promotion has not started yet' });
      }
      if (now > coupon.endDate) {
        return reply.status(400).send({ valid: false, message: 'Coupon has expired' });
      }

      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return reply.status(400).send({ valid: false, message: 'Coupon usage limit reached' });
      }

      if (amount && Number(amount) < Number(coupon.minOrderAmount)) {
        return reply.status(400).send({ 
          valid: false, 
          message: `Minimum order amount for this coupon is PKR ${coupon.minOrderAmount}` 
        });
      }

      return reply.send({
        valid: true,
        couponId: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscountAmount: coupon.maxDiscountAmount
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to validate coupon' });
    }
  });

}
