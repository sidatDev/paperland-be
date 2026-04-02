import { FastifyInstance } from 'fastify';

export default async function couponRoutes(fastify: FastifyInstance) {

  // GET all coupons (Admin) — with pagination
  fastify.get('/admin/coupons', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_view')],
    schema: {
      tags: ['Admin Coupons'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page = 1, limit = 20, search } = request.query as any;
      const skip = (page - 1) * limit;

      const where: any = { deletedAt: null };
      if (search) {
        where.OR = [
          { code: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [coupons, totalCount] = await Promise.all([
        (fastify.prisma as any).coupon.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            products: { include: { product: { select: { id: true, name: true, sku: true, imageUrl: true } } } },
            categories: { include: { category: { select: { id: true, name: true } } } },
            _count: { select: { orders: true } }
          }
        }),
        (fastify.prisma as any).coupon.count({ where })
      ]);

      return reply.send({
        data: coupons,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch coupons' });
    }
  });

  // GET products for coupon scope selector
  fastify.get('/admin/coupons/products', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_view')],
    schema: {
      tags: ['Admin Coupons'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 20 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { search, limit = 20 } = request.query as any;
      const where: any = { deletedAt: null, isActive: true };
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } }
        ];
      }
      const products = await (fastify.prisma as any).product.findMany({
        where,
        select: { id: true, name: true, sku: true, imageUrl: true },
        take: limit,
        orderBy: { name: 'asc' }
      });
      return reply.send(products);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch products' });
    }
  });

  // GET categories for coupon scope selector
  fastify.get('/admin/coupons/categories', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_view')],
    schema: {
      tags: ['Admin Coupons'],
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const categories = await (fastify.prisma as any).category.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, name: true, parentId: true },
        orderBy: { name: 'asc' }
      });
      return reply.send(categories);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch categories' });
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
          title: { type: 'string' },
          description: { type: 'string' },
          discountType: { type: 'string', enum: ['PERCENTAGE', 'FIXED'] },
          discountValue: { type: 'number', minimum: 0 },
          minOrderAmount: { type: 'number', minimum: 0 },
          maxDiscountAmount: { type: 'number', minimum: 0 },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          usageLimit: { type: 'number', minimum: 1 },
          usageLimitPerCustomer: { type: 'number', minimum: 1 },
          budgetCap: { type: 'number', minimum: 0 },
          applicationType: { type: 'string', enum: ['ALL', 'SPECIFIC_PRODUCTS', 'SPECIFIC_CATEGORIES'] },
          customerType: { type: 'string', enum: ['ALL', 'NEW_CUSTOMERS', 'B2B_ONLY'] },
          visibility: { type: 'string', enum: ['PUBLIC', 'PRIVATE'] },
          isStackable: { type: 'boolean' },
          isActive: { type: 'boolean', default: true },
          productIds: { type: 'array', items: { type: 'string' } },
          categoryIds: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const {
        code, title, description, discountType, discountValue,
        minOrderAmount, maxDiscountAmount, startDate, endDate,
        usageLimit, usageLimitPerCustomer, budgetCap,
        applicationType, customerType, visibility, isStackable, isActive,
        productIds, categoryIds
      } = request.body as any;

      const existing = await (fastify.prisma as any).coupon.findUnique({
        where: { code: code.toUpperCase() }
      });

      if (existing && !existing.deletedAt) {
        return reply.status(400).send({ message: 'A coupon with this code already exists' });
      }

      const coupon = await (fastify.prisma as any).$transaction(async (tx: any) => {
        const created = await tx.coupon.create({
          data: {
            code: code.toUpperCase(),
            title: title || null,
            description: description || null,
            discountType,
            discountValue,
            minOrderAmount: minOrderAmount || null,
            maxDiscountAmount: maxDiscountAmount || null,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            usageLimit: usageLimit || null,
            usageLimitPerCustomer: usageLimitPerCustomer || null,
            budgetCap: budgetCap || null,
            applicationType: applicationType || 'ALL',
            customerType: customerType || 'ALL',
            visibility: visibility || 'PRIVATE',
            isStackable: isStackable || false,
            isActive: isActive !== undefined ? isActive : true
          }
        });

        // Create product associations if applicable
        if (applicationType === 'SPECIFIC_PRODUCTS' && productIds?.length) {
          await tx.couponProduct.createMany({
            data: productIds.map((productId: string) => ({
              couponId: created.id,
              productId
            }))
          });
        }

        // Create category associations if applicable
        if (applicationType === 'SPECIFIC_CATEGORIES' && categoryIds?.length) {
          await tx.couponCategory.createMany({
            data: categoryIds.map((categoryId: string) => ({
              couponId: created.id,
              categoryId
            }))
          });
        }

        // Return with relations
        return tx.coupon.findUnique({
          where: { id: created.id },
          include: {
            products: { include: { product: { select: { id: true, name: true, sku: true, imageUrl: true } } } },
            categories: { include: { category: { select: { id: true, name: true } } } }
          }
        });
      });

      return reply.status(201).send(coupon);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to create coupon' });
    }
  });

  // GET a single coupon (Admin)
  fastify.get('/admin/coupons/:id', {
    preHandler: [fastify.authenticate, fastify.hasPermission('product_view')],
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
      const coupon = await (fastify.prisma as any).coupon.findUnique({
        where: { id },
        include: {
          products: { include: { product: { select: { id: true, name: true, sku: true, imageUrl: true } } } },
          categories: { include: { category: { select: { id: true, name: true } } } }
        }
      });
      
      if (!coupon || coupon.deletedAt) {
        return reply.status(404).send({ message: 'Coupon not found' });
      }
      
      return reply.send(coupon);
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to fetch coupon' });
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
          title: { type: 'string' },
          description: { type: 'string' },
          discountType: { type: 'string', enum: ['PERCENTAGE', 'FIXED'] },
          discountValue: { type: 'number', minimum: 0 },
          minOrderAmount: { type: 'number', minimum: 0 },
          maxDiscountAmount: { type: 'number', minimum: 0 },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          usageLimit: { type: 'number', minimum: 1 },
          usageLimitPerCustomer: { type: 'number', minimum: 1 },
          budgetCap: { type: 'number', minimum: 0 },
          applicationType: { type: 'string', enum: ['ALL', 'SPECIFIC_PRODUCTS', 'SPECIFIC_CATEGORIES'] },
          customerType: { type: 'string', enum: ['ALL', 'NEW_CUSTOMERS', 'B2B_ONLY'] },
          visibility: { type: 'string', enum: ['PUBLIC', 'PRIVATE'] },
          isStackable: { type: 'boolean' },
          isActive: { type: 'boolean' },
          productIds: { type: 'array', items: { type: 'string' } },
          categoryIds: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const {
        productIds, categoryIds, applicationType, ...data
      } = request.body as any;

      const coupon = await (fastify.prisma as any).coupon.findUnique({ where: { id } });
      if (!coupon || coupon.deletedAt) return reply.status(404).send({ message: 'Coupon not found' });

      if (data.code && data.code.toUpperCase() !== coupon.code) {
        const existing = await (fastify.prisma as any).coupon.findUnique({ where: { code: data.code.toUpperCase() } });
        if (existing && !existing.deletedAt) {
          return reply.status(400).send({ message: 'A coupon with this code already exists' });
        }
      }

      const updated = await (fastify.prisma as any).$transaction(async (tx: any) => {
        const updateData: any = {
          ...data,
          code: data.code ? data.code.toUpperCase() : undefined,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined
        };

        if (applicationType !== undefined) {
          updateData.applicationType = applicationType;
        }

        await tx.coupon.update({
          where: { id },
          data: updateData
        });

        // Update product associations
        const appType = applicationType ?? coupon.applicationType;
        if (appType === 'SPECIFIC_PRODUCTS' && productIds !== undefined) {
          await tx.couponProduct.deleteMany({ where: { couponId: id } });
          if (productIds.length) {
            await tx.couponProduct.createMany({
              data: productIds.map((productId: string) => ({
                couponId: id,
                productId
              }))
            });
          }
        } else if (appType !== 'SPECIFIC_PRODUCTS') {
          // Clean up if scope changed away from products
          await tx.couponProduct.deleteMany({ where: { couponId: id } });
        }

        // Update category associations
        if (appType === 'SPECIFIC_CATEGORIES' && categoryIds !== undefined) {
          await tx.couponCategory.deleteMany({ where: { couponId: id } });
          if (categoryIds.length) {
            await tx.couponCategory.createMany({
              data: categoryIds.map((categoryId: string) => ({
                couponId: id,
                categoryId
              }))
            });
          }
        } else if (appType !== 'SPECIFIC_CATEGORIES') {
          // Clean up if scope changed away from categories
          await tx.couponCategory.deleteMany({ where: { couponId: id } });
        }

        return tx.coupon.findUnique({
          where: { id },
          include: {
            products: { include: { product: { select: { id: true, name: true, sku: true, imageUrl: true } } } },
            categories: { include: { category: { select: { id: true, name: true } } } }
          }
        });
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

  // GET /coupons/validate/:code (Public — enhanced validation)
  fastify.get('/coupons/validate/:code', async (request, reply) => {
    try {
      const { code } = request.params as any;
      const { amount, userId } = request.query as any;

      const coupon = await (fastify.prisma as any).coupon.findUnique({
        where: { code: code.toUpperCase() },
        include: {
          products: { select: { productId: true } },
          categories: { select: { categoryId: true } }
        }
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

      // Per-customer usage limit check
      if (coupon.usageLimitPerCustomer && userId) {
        const userUsageCount = await (fastify.prisma as any).order.count({
          where: {
            couponId: coupon.id,
            userId,
            deletedAt: null
          }
        });
        if (userUsageCount >= coupon.usageLimitPerCustomer) {
          return reply.status(400).send({ valid: false, message: 'You have reached the usage limit for this coupon' });
        }
      }

      // Budget cap check
      if (coupon.budgetCap && Number(coupon.totalDiscountGiven) >= Number(coupon.budgetCap)) {
        return reply.status(400).send({ valid: false, message: 'Coupon budget has been exhausted' });
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
        maxDiscountAmount: coupon.maxDiscountAmount,
        applicationType: coupon.applicationType,
        productIds: coupon.products.map((p: any) => p.productId),
        categoryIds: coupon.categories.map((c: any) => c.categoryId),
        isStackable: coupon.isStackable
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({ message: 'Failed to validate coupon' });
    }
  });

}
