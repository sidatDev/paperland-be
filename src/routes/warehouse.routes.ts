import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { logActivity } from '../utils/audit';

// Shared Validation Schemas
const warehouseSchema = z.object({
  code: z.string().min(2).max(20).toUpperCase().regex(/^(?=.*-)[A-Z0-9\s-]+$/, "Site code must contain at least one hyphen (e.g., JED-01)"),
  name: z.string().min(2).max(100),
  city: z.string().min(2).max(50),
  country: z.string().length(2).default('SA'),
  address: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const stockAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int(), // Allowed to be negative if isIncrement is true
  reorderLevel: z.number().int().min(0).optional(),
  reason: z.string().min(1, "Reason is required for audit logs"),
  isIncrement: z.boolean().optional().default(false),
});

const warehouseRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {

  // GET /admin/warehouses - List all warehouses
  fastify.get('/admin/warehouses', async (request, reply) => {
    try {
      const warehouses = await (fastify.prisma as any).warehouse.findMany({
        where: { deletedAt: null },
        include: {
          _count: {
            select: { stocks: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      return warehouses;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /admin/warehouses/deactivated - List deactivated (soft-deleted) warehouses
  fastify.get('/admin/warehouses/deactivated', async (request, reply) => {
    try {
      const warehouses = await (fastify.prisma as any).warehouse.findMany({
        where: { deletedAt: { not: null } },
        include: {
          _count: {
            select: { stocks: true }
          }
        },
        orderBy: { deletedAt: 'desc' }
      });
      return warehouses;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // DELETE /admin/warehouses/:id/permanent - Permanently delete warehouse from DB
  fastify.delete('/admin/warehouses/:id/permanent', async (request, reply) => {
    const { id } = request.params as any;

    try {
      // Verify warehouse exists and is deactivated
      const warehouse = await (fastify.prisma as any).warehouse.findUnique({
        where: { id }
      });

      if (!warehouse) {
        return reply.code(404).send({ error: 'Warehouse not found' });
      }

      if (!warehouse.deletedAt) {
        return reply.code(400).send({ error: 'Only deactivated warehouses can be permanently deleted. Deactivate the warehouse first.' });
      }

      // Delete all stock records for this warehouse first
      await (fastify.prisma as any).stock.deleteMany({
        where: { warehouseId: id }
      });

      // Permanently delete the warehouse
      await (fastify.prisma as any).warehouse.delete({
        where: { id }
      });

      await logActivity(fastify, {
        entityType: 'WAREHOUSE',
        entityId: id,
        action: 'PERMANENT_DELETE',
        performedBy: (request as any).user?.id,
        details: { warehouseName: warehouse.name, warehouseCode: warehouse.code }
      });

      return { success: true, message: 'Warehouse permanently deleted' };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // POST /admin/warehouses - Create a new warehouse
  fastify.post('/admin/warehouses', async (request, reply) => {
    const validatedBody = warehouseSchema.parse(request.body);
    const { code, name, city, country, address, isDefault } = validatedBody;

    try {
      // Check for unique name (case-insensitive)
      const existingName = await (fastify.prisma as any).warehouse.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null }
      });
      if (existingName) {
        return reply.code(400).send({ error: 'Warehouse name must be unique' });
      }

      if (isDefault) {
        await (fastify.prisma as any).warehouse.updateMany({
          where: { isDefault: true },
          data: { isDefault: false }
        });
      }

      const warehouse = await (fastify.prisma as any).warehouse.create({
        data: {
          code,
          name,
          city,
          country,
          address,
          isDefault: !!isDefault
        }
      });

      await logActivity(fastify, {
        entityType: 'WAREHOUSE',
        entityId: warehouse.id,
        action: 'CREATE',
        performedBy: (request as any).user?.id,
        details: { warehouse }
      });

      return warehouse;
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply.code(400).send({ error: 'Warehouse code must be unique' });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // PUT /admin/warehouses/:id - Update warehouse
  fastify.put('/admin/warehouses/:id', async (request, reply) => {
    const { id } = request.params as any;
    const validatedBody = warehouseSchema.partial().parse(request.body);

    try {
      if (validatedBody.name) {
        const existingName = await (fastify.prisma as any).warehouse.findFirst({
          where: { 
            name: { equals: validatedBody.name, mode: 'insensitive' }, 
            id: { not: id },
            deletedAt: null 
          }
        });
        if (existingName) {
          return reply.code(400).send({ error: 'Warehouse name must be unique' });
        }
      }

      if (validatedBody.isDefault) {
        await (fastify.prisma as any).warehouse.updateMany({
          where: { id: { not: id }, isDefault: true },
          data: { isDefault: false }
        });
      }

      const warehouse = await (fastify.prisma as any).warehouse.update({
        where: { id },
        data: validatedBody
      });

      await logActivity(fastify, {
        entityType: 'WAREHOUSE',
        entityId: warehouse.id,
        action: 'UPDATE',
        performedBy: (request as any).user?.id,
        details: { updatedFields: validatedBody }
      });

      return warehouse;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // DELETE /admin/warehouses/:id - Soft delete warehouse
  fastify.delete('/admin/warehouses/:id', async (request, reply) => {
    const { id } = request.params as any;

    try {
      const warehouse = await (fastify.prisma as any).warehouse.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false }
      });

      await logActivity(fastify, {
        entityType: 'WAREHOUSE',
        entityId: warehouse.id,
        action: 'DELETE',
        performedBy: (request as any).user?.id
      });

      return { success: true };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /admin/warehouses/search-products - Search for products NOT in a warehouse
  fastify.get('/admin/warehouses/:id/search-products', async (request, reply) => {
    const { id: warehouseId } = request.params as any;
    const { q } = request.query as any;

    try {
      const products = await (fastify.prisma as any).product.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { sku: { contains: q, mode: 'insensitive' } }
          ],
          stocks: {
            none: { warehouseId }
          }
        },
        take: 10,
        select: { id: true, name: true, sku: true, imageUrl: true }
      });
      return products;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /admin/warehouses/:id/stock - Get all stock for a specific warehouse
  fastify.get('/admin/warehouses/:id/stock', async (request, reply) => {
    const { id } = request.params as any;
    const { search, page = 1, limit = 10 } = request.query as any;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {
      warehouseId: id,
      product: { deletedAt: null }
    };

    if (search) {
      where.product = {
        ...where.product,
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } }
        ]
      };
    }

    try {
      const [stocks, total] = await Promise.all([
        (fastify.prisma as any).stock.findMany({
          where,
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                price: true,
                imageUrl: true,
                brand: { select: { name: true } }
              }
            }
          },
          skip,
          take,
          orderBy: { updatedAt: 'desc' }
        }),
        (fastify.prisma as any).stock.count({ where })
      ]);

      return { 
        stocks: stocks.map((s: any) => ({
          ...s,
          physicalQty: s.qty,
          reservedQty: s.reservedQty || 0,
          qty: Math.max(0, s.qty - (s.reservedQty || 0))
        })), 
        total, 
        page: Number(page), 
        limit: Number(limit) 
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // PUT /admin/warehouses/:id/stock - Adjust stock for a product in a warehouse
  fastify.put('/admin/warehouses/:id/stock', async (request, reply) => {
    const { id: warehouseId } = request.params as any;
    const validatedBody = stockAdjustmentSchema.parse(request.body);
    const { productId, quantity, reason, reorderLevel, isIncrement } = validatedBody;

    try {
      const updateData: any = {
        reorderLevel: reorderLevel !== undefined ? reorderLevel : undefined,
        updatedAt: new Date()
      };

      if (isIncrement) {
        updateData.qty = { increment: quantity };
        updateData.physicalQty = { increment: quantity };
      } else {
        updateData.qty = quantity;
        updateData.physicalQty = quantity;
      }

      const stock = await (fastify.prisma as any).stock.upsert({
        where: {
          productId_warehouseId: { productId, warehouseId }
        },
        update: updateData,
        create: {
          productId,
          warehouseId,
          qty: quantity,
          physicalQty: quantity,
          reservedQty: 0,
          reorderLevel: reorderLevel || 10,
          locationId: 'MANAGED'
        }
      });

      await logActivity(fastify, {
        entityType: 'STOCK',
        entityId: stock.id,
        action: 'ADJUST',
        performedBy: (request as any).user?.id,
        details: { warehouseId, productId, quantity, reason, reorderLevel }
      });

      // Invalidate Cache
      try {
        await fastify.cache.del('shop:home');
        await fastify.cache.clearPattern('shop:products:*');
        // Also clear specific product cache if it exists (using slug or ID)
        const product = await (fastify.prisma as any).product.findUnique({
          where: { id: productId },
          select: { slug: true }
        });
        if (product) {
          await fastify.cache.del(`product:${product.id}`);
          if (product.slug) await fastify.cache.del(`product:${product.slug}`);
        }
      } catch (cacheErr) {
        fastify.log.error(cacheErr, 'Failed to invalidate cache on stock adjust');
      }

      return stock;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });


  // DELETE /admin/warehouses/:id/stock/:productId - Remove a product from warehouse stock
  fastify.delete('/admin/warehouses/:id/stock/:productId', async (request, reply) => {
    const { id: warehouseId, productId } = request.params as any;

    try {
      // 1. Verify it exists
      const existing = await (fastify.prisma as any).stock.findFirst({
        where: {
          productId,
          warehouseId
        }
      });

      if (!existing) {
        return reply.code(404).send({ error: "Stock record not found" });
      }

      // 2. Delete
      await (fastify.prisma as any).stock.delete({
        where: { id: existing.id }
      });

      // 3. Log
      await logActivity(fastify, {
        entityType: 'STOCK',
        entityId: existing.id,
        action: 'DELETE',
        performedBy: (request as any).user?.id,
        details: { warehouseId, productId, deletedQty: existing.qty }
      });

      return { success: true, message: "Product removed from warehouse" };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // GET /admin/inventory/overview - Dashboard stats
  fastify.get('/admin/inventory/overview', async (request, reply) => {
    try {
      const [totalWarehouses, totalStock, simpleLowStockCount] = await Promise.all([
        (fastify.prisma as any).warehouse.count({ where: { deletedAt: null } }),
        (fastify.prisma as any).stock.aggregate({
          _sum: { qty: true, reservedQty: true }
        }),
        (fastify.prisma as any).stock.count({
          where: {
            qty: { lt: 10 }
          }
        })
      ]);

      return {
        totalWarehouses,
        totalPhysicalStock: totalStock._sum.qty || 0,
        totalReservedStock: totalStock._sum.reservedQty || 0,
        totalStockUnits: totalStock._sum.qty || 0, 
        totalStockUnitsAvailable: (totalStock._sum.qty || 0) - (totalStock._sum.reservedQty || 0),
        lowStockAlerts: simpleLowStockCount
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
};

export default warehouseRoutes;
