
import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { logActivity } from '../utils/audit';
import { z } from 'zod';

// Order Validation Schema
const OrderItemSchema = z.object({
  productId: z.string(),
  variantId: z.string().optional(),
  sku: z.string(),
  quantity: z.number().min(1),
  pricing: z.object({
    unitPrice: z.number(),
    discountAmount: z.number().default(0),
    taxAmount: z.number().default(0),
    totalPrice: z.number(),
  }),
  inventory: z.object({
    warehouseId: z.string().optional(),
    locationCode: z.string().optional(),
    availableQuantityAtOrderTime: z.number().optional(),
  }).optional()
});

const CreateOrderSchema = z.object({
  customer: z.object({
    customerId: z.string().optional(),
    email: z.string().email(),
    name: z.string().optional(), // Added for guest
    phone: z.string().optional()
  }),
  billingAddress: z.object({
    addressId: z.string().optional(),
    snapshot: z.any() // Full address object
  }),
  shippingAddress: z.object({
    addressId: z.string().optional(),
    snapshot: z.any() // Full address object
  }),
  payment: z.object({
    paymentMethod: z.string(), // CARD, WALLET, etc.
    paymentProvider: z.string().optional(),
    currency: z.string(),
    amountExpected: z.number(),
    metadata: z.any().optional()
  }),
  shipping: z.object({
    shippingMethod: z.string(),
    shippingCost: z.number(),
    estimatedDeliveryDate: z.string().optional()
  }),
  orderItems: z.array(OrderItemSchema),
  pricingSummary: z.object({
    currency: z.string(),
    subTotal: z.number(),
    totalDiscount: z.number(),
    totalTax: z.number(),
    shippingFee: z.number(),
    grandTotal: z.number(),
  }),
  orderContext: z.object({
    source: z.string(),
    countryCode: z.string(),
    priceListId: z.string().optional()
  }).optional(),
  notes: z.object({
    customerNote: z.string().optional(),
    internalNote: z.string().optional()
  }).optional()
});

export default async function orderRoutes(fastify: FastifyInstance) {

  // Create New Order (Manual)
  fastify.post('/admin/orders/new', {
      preHandler: [fastify.authenticate, fastify.hasPermission('order_manage')],
      schema: {
          description: 'Create a new Manual Order',
          tags: ['Orders'],
      }
  }, async (request: any, reply) => {
      const data = request.body as any;
      const prisma = fastify.prisma as any;
      
      try {
          const items = data.items || [];
          const totalAmount = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
          
          // 1. Create/Find User
          const email = data.customer.email || `guest-${Date.now()}@example.com`;
          let user = await prisma.user.findUnique({ where: { email } });
          
          if (!user) {
              user = await prisma.user.create({
                 data: {
                     firstName: data.customer.name?.split(' ')[0] || 'Guest',
                     lastName: data.customer.name?.split(' ').slice(1).join(' ') || '',
                     email: email,
                     phoneNumber: data.customer.phone,
                     passwordHash: 'manual_created_placeholder',
                     role: { connect: { name: 'CUSTOMER' } },
                     licenseNumber: data.customer.licenseNumber, // handle if passed
                     companyName: data.customerType === 'Business' ? data.customer.companyName : undefined
                 } as any
              });
          }
 
          // 2. Find Country & Currency
          const countryCode = data.region || 'KSA';
          const country = await prisma.country.findUnique({ 
              where: { code: countryCode },
              include: { currency: true }
          });
          
          if (!country) throw new Error(`Country ${countryCode} not found in database.`);

          // 3. Ensure Address exists
          let address = await prisma.address.findFirst({
              where: { userId: user.id, street1: data.shippingAddress }
          });
          
          if (!address) {
              address = await prisma.address.create({
                  data: {
                      userId: user.id,
                      firstName: user.firstName || 'Guest',
                      lastName: user.lastName || '',
                      street1: data.shippingAddress || 'Manual Order Entry',
                      city: "Riyadh",
                      zipCode: "10000",
                      countryId: country.id,
                      phone: data.customer.phone || user.phoneNumber || '',
                      type: 'SHIPPING'
                  }
              });
          }

          // 4. Create Order
          const newOrder = await prisma.order.create({
              data: {
                  orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
                  user: { connect: { id: user.id } },
                  address: { connect: { id: address.id } },
                  currency: { connect: { id: country.currencyId } },
                  status: 'PENDING',
                  totalAmount,
                  taxAmount: 0,
                  shippingAmount: 0,
                  paymentMethod: data.paymentMethod || 'Direct',
                  paymentStatus: 'PENDING',
                  deliveryMethod: 'Standard Delivery',
                  estimatedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                  items: {
                      create: items.map((item: any) => ({
                          productId: item.productId,
                          sku: item.sku || 'N/A',
                          quantity: Number(item.quantity),
                          price: Number(item.unitPrice),
                      }))
                  },
                  billingSnapshot: {
                      name: data.customer.name,
                      email: data.customer.email,
                      phone: data.customer.phone,
                      addressLine1: data.shippingAddress,
                      city: "Riyadh",
                      countryCode: country.code
                  },
                  shippingSnapshot: {
                       addressLine1: data.shippingAddress,
                       countryCode: country.code
                  }
              } as any
          });

          // 3. Update Inventory
          for (const item of items) {
              if (item.productId) {
                  // Find main stock
                  const stock = await prisma.stock.findFirst({ where: { productId: item.productId } });
                  if (stock) {
                      await prisma.stock.update({
                          where: { id: stock.id },
                          data: { qty: { decrement: Number(item.quantity) } }
                      });
                  }
              }
          }

          // 4. Audit Log
          await logActivity(fastify, {
              entityType: 'ORDER',
              entityId: newOrder.id,
              action: 'CREATE',
              performedBy: (request.user as any)?.id || user.id, // Should indicate Admin created it
              details: { manual: true, amount: totalAmount },
              ip: request.ip,
              userAgent: request.headers['user-agent']
          });

          return createResponse({ id: newOrder.id, orderNumber: newOrder.orderNumber }, "Order Created Successfully");

      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse("Order Creation Failed: " + err.message));
      }
  });

  // GET /admin/orders (Dashboard List)
  fastify.get('/admin/orders', {
    schema: {
        description: 'Get List of Orders for Admin Dashboard with Filters',
        tags: ['Orders'],
        querystring: {
            type: 'object',
            properties: {
                page: { type: 'integer', default: 1 },
                limit: { type: 'integer', default: 10 },
                status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'all'] },
                search: { type: 'string', description: 'Search by Order Number, ERP ID or Customer Email' },
                startDate: { type: 'string', format: 'date' },
                endDate: { type: 'string', format: 'date' },
                currency: { type: 'string', description: 'Filter by Currency Code (e.g. SAR, PKR)' }
            }
        }
    }
  }, async (request: any, reply) => {
    try {
        const { page = 1, limit = 10, status, search, startDate, endDate, currency: currencyFilter } = request.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = {};
        
        // Status Filter
        if (status && status !== 'all') where.status = status;

        // Currency Filter
        if (currencyFilter && currencyFilter !== 'all') {
            where.currency = {
                code: {
                    equals: currencyFilter,
                    mode: 'insensitive'
                }
            };
        }

        // Date Range Filter
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
        }

        // Search Filter
        if (search) {
            where.OR = [
                { orderNumber: { contains: search, mode: 'insensitive' } },
                { erpOrderId: { contains: search, mode: 'insensitive' } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
                { items: { some: { product: { name: { contains: search, mode: 'insensitive' } } } } }
            ];
        }

        const [orders, total] = await Promise.all([
            (fastify.prisma as any).order.findMany({
                where,
                include: { user: true, currency: true },
                skip,
                take: Number(limit),
                orderBy: { createdAt: 'desc' }
            }),
            (fastify.prisma as any).order.count({ where })
        ]);

        return createResponse(orders, "Orders Retrieved", { page, limit, total });
    } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  // Helper to normalize erpSyncLog to array format (backward compatibility)
  function normalizeErpSyncLog(log: any): any[] {
    if (!log) return [];
    if (Array.isArray(log)) return log;
    // Convert old single-object format to array
    return [log];
  }

  // POST /admin/orders/:id/sync (Enhanced with sync attempt history and strict checking)
  fastify.post('/admin/orders/:id/sync', {
      preHandler: [fastify.authenticate, fastify.hasPermission('order_manage')],
      schema: {
          description: 'Trigger manual ERP Sync for an Order with attempt history tracking',
          tags: ['Orders'],
          params: { type: 'object', properties: { id: { type: 'string' } } }
      }
  }, async (request: any, reply) => {
      const { id } = request.params;
      try {
          const order = await (fastify.prisma as any).order.findUnique({ where: { id } });
          if (!order) return reply.status(404).send(createErrorResponse("Order Not Found"));

          // 1. Check if already synced (prevent overwriting unless force param is used - not implemented yet for simplicity)
          // If ERP ID Key exists and is valid format, maybe skip? For now, we allow retry but we must ensuring UNIQUENESS.
          
          // Get existing log and normalize to array
          const existingLog = normalizeErpSyncLog(order.erpSyncLog);

          // Simulate Sync Process
          const isSuccess = Math.random() > 0.2; // 80% Success Rate of "Connection"
          
          // Generate a potential ERP ID (Deterministic based on Order ID to avoid changing it on retries if it was already assigned elsewhere)
          // OR create a new one. Let's say ERP system assigns `ERP-{orderNumber}`.
          const candidateErpId = `ERP-${order.orderNumber}`;

          // Create new sync attempt entry
          const newAttempt: any = {
              attemptedAt: new Date().toISOString(),
              status: isSuccess ? 'SUCCESS' : 'FAILED',
              message: isSuccess ? 'Synced successfully with ERP' : 'Connection timeout with ERP gateway',
              code: isSuccess ? 200 : 504
          };

          let finalErpOrderId = order.erpOrderId;
          
          if (isSuccess) {
              // STRICT DUPLICATE CHECK
              // Check if this Candidate ERP ID is already used by ANY other order
              const duplicateCheck = await (fastify.prisma as any).order.findFirst({ 
                where: { 
                  erpOrderId: candidateErpId,
                  id: { not: id } // Exclude current order
                } 
              });
              
              if (duplicateCheck) {
                  // CRITICAL: Duplicate found on another order. This is a data integrity issue or external system conflict.
                  newAttempt.status = 'FAILED';
                  newAttempt.message = `ERP ID Conflict: ${candidateErpId} is already assigned to Order ${duplicateCheck.orderNumber}`;
                  newAttempt.code = 409;
                  fastify.log.warn(`[ERP Sync] Conflict detected for Order ${order.orderNumber}. ERP ID ${candidateErpId} exists on ${duplicateCheck.orderNumber}`);
              } else {
                  // Safe to assign
                  newAttempt.erpOrderId = candidateErpId;
                  finalErpOrderId = candidateErpId;
                  
                  // Update message
                  newAttempt.message = `Synced successfully. Assigned ERP ID: ${candidateErpId}`;
              }
          }

          // Append new attempt to history
          const updatedLog = [newAttempt, ...existingLog]; // Newest first

          const updateData: any = {
              erpSyncStatus: newAttempt.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED', // Update main status
              erpSyncLog: updatedLog,
              erpOrderId: finalErpOrderId
          };

          const updatedOrder = await (fastify.prisma as any).order.update({
              where: { id },
              data: updateData
          });

          // Audit Log
          await logActivity(fastify, {
             entityType: 'ORDER',
             entityId: id,
             action: 'SYNC_ERP',
             performedBy: (request.user as any)?.id || 'unknown',
             details: { status: newAttempt.status, code: newAttempt.code, erpId: finalErpOrderId },
             ip: request.ip,
             userAgent: request.headers['user-agent']
          });

          return createResponse(
            updatedOrder, 
            newAttempt.status === 'SUCCESS' ? "Order Synced Successfully" : "Order Sync Failed"
          );

      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse(err.message));
      }
  });

  // GET /admin/orders/:id (Detail View with Logs)
  fastify.get('/admin/orders/:id', {
    schema: {
        description: 'Get Order Details by ID or Order Number with Attributes and Logs',
        tags: ['Orders'],
        params: {
            type: 'object',
            properties: {
                id: { type: 'string', description: 'Order ID or Order Number' }
            }
        }
    }
  }, async (request: any, reply) => {
      const { id } = request.params;
      try {
          const prisma = (fastify.prisma as any);
          
          // Fetch Order (Consolidated lookup with includes)
          const order = await prisma.order.findFirst({
              where: {
                  OR: [
                      { id },
                      { orderNumber: id }
                  ]
              },
              include: { 
                  items: { include: { product: true } }, 
                  user: true, 
                  currency: true,
                  address: { include: { country: true } } // Include country details
              }
          });

          if (!order) return reply.status(404).send(createErrorResponse("Order Not Found"));

          // Fetch Related Activity Logs
          const activityLogs = await prisma.auditLog.findMany({
              where: {
                  entityType: 'ORDER',
                  entityId: order.id
              },
              orderBy: { createdAt: 'desc' },
              include: { performer: { select: { firstName: true, lastName: true, email: true } } }
          });
          
          // If we need user names for logs, we might need to fetch them if performedBy matches user IDs.
          // For now, let's attach the logs as is.

          return createResponse({ ...order, activityLogs }, "Order Details Retrieved");
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse(err.message));
      }
  });

  // Bulk Status Update
  fastify.patch('/admin/orders/bulk/status', {
      preHandler: [fastify.authenticate, fastify.hasPermission('order_manage')],
      schema: {
          description: 'Bulk update order status',
          tags: ['Orders'],
          body: {
              type: 'object',
              required: ['ids', 'status'],
              properties: {
                  ids: { type: 'array', items: { type: 'string' } },
                  status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] }
              }
          }
      }
  }, async (request: any, reply) => {
      const { ids, status } = request.body;
      try {
          const userId = (request.user as any)?.id || 'unknown';
          let successCount = 0;

          // Update each order to handle stock logic correctly
          for (const orderId of ids) {
              await (fastify.prisma as any).$transaction(async (tx: any) => {
                  const order = await tx.order.findFirst({
                      where: { OR: [{ id: orderId }, { orderNumber: orderId }] },
                      include: { items: true }
                  });

                  if (order && order.status !== status) {
                       if (status === 'DELIVERED') {
                           for (const item of order.items) {
                               if (item.productId) {
                                   const stock = await tx.stock.findFirst({ 
                                       where: { 
                                           productId: item.productId,
                                           reservedQty: { gte: Number(item.quantity) }
                                       },
                                       orderBy: { qty: 'desc' }
                                   }) || await tx.stock.findFirst({ 
                                       where: { productId: item.productId },
                                       orderBy: { reservedQty: 'desc' }
                                   });

                                   if (stock) {
                                       await tx.stock.update({
                                           where: { id: stock.id },
                                           data: { 
                                               qty: { decrement: Number(item.quantity) },
                                               reservedQty: { decrement: Math.min(Number(item.quantity), stock.reservedQty) }
                                           }
                                       });
                                   }
                               }
                           }
                       } else if (status === 'CANCELLED' && order.status !== 'DELIVERED') {
                           for (const item of order.items) {
                               if (item.productId) {
                                   const stock = await tx.stock.findFirst({ 
                                       where: { 
                                           productId: item.productId,
                                           reservedQty: { gte: Number(item.quantity) }
                                       },
                                       orderBy: { qty: 'desc' }
                                   }) || await tx.stock.findFirst({ 
                                       where: { productId: item.productId },
                                       orderBy: { reservedQty: 'desc' }
                                   });

                                   if (stock) {
                                       await tx.stock.update({
                                           where: { id: stock.id },
                                           data: { reservedQty: { decrement: Math.min(Number(item.quantity), stock.reservedQty) } }
                                       });
                                   }
                               }
                           }
                       }

                      await tx.order.update({
                          where: { id: order.id },
                          data: { status }
                      });
                      successCount++;
                  }
              });
          }


           // Invalidate Cache after bulk update
           try {
               await (fastify as any).cache.del('shop:home');
               await (fastify as any).cache.clearPattern('shop:products:*');
           } catch (cacheErr) {
               fastify.log.error(cacheErr, 'Failed to invalidate cache on bulk status update');
           }
          // Log activities for each order 
          await Promise.all(ids.map((id: string) => 
               logActivity(fastify, {
                  entityType: 'ORDER',
                  entityId: id,
                  action: 'UPDATE_STATUS',
                  performedBy: userId,
                  details: { oldStatus: 'Bulk', newStatus: status, bulk: true }
               })
          ));

          return createResponse({ count: successCount }, "Bulk Status Updated");
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse(err.message));
      }
  });

  // PATCH /admin/orders/:id/status
  fastify.patch('/admin/orders/:id/status', {
      preHandler: [fastify.authenticate, fastify.hasPermission('order_manage')],
      schema: {
          description: 'Update Order Status',
          tags: ['Orders'],
          params: { type: 'object', properties: { id: { type: 'string' } } },
          body: {
              type: 'object',
              required: ['status'],
              properties: {
                  status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'REFUNDED'] },
                  note: { type: 'string' } // Optional note
              }
          }
      }
  }, async (request: any, reply) => {
      const { id } = request.params;
      const { status, note } = request.body;
      
      try {
          // Enhanced logging
          fastify.log.info(`Status update requested for order: ${id}, new status: ${status}`);
          
          // Fetch Order (support UUID or OrderNumber)
          const order = await (fastify.prisma as any).order.findFirst({
              where: {
                  OR: [
                      { id },
                      { orderNumber: id }
                  ]
              },
              include: {
                  items: true // Need items for stock update
              }
          });
          
          if (!order) {
              fastify.log.error(`Order not found with ID/Number: ${id}`);
              return reply.status(404).send(createErrorResponse("Order Not Found"));
          }

          const updateData: any = { status };
          
          // Update timestamps based on status
          if (status === 'PROCESSING' && !order.processingDate) updateData.processingDate = new Date();
          if (status === 'SHIPPED' && !order.shippedDate) updateData.shippedDate = new Date();
          if (status === 'DELIVERED' && !order.deliveredDate) updateData.deliveredDate = new Date();

          // Use transaction for safer stock decrement
          const updatedOrder = await (fastify.prisma as any).$transaction(async (tx: any) => {
              // Only update inventory if status actually changed
              if (order.status !== status) {
                  if (status === 'DELIVERED') {
                      // Deduct physical qty and remove reservation
                      for (const item of order.items) {
                          if (item.productId) {
                              const stock = await tx.stock.findFirst({ 
                                  where: { 
                                      productId: item.productId,
                                      reservedQty: { gte: Number(item.quantity) }
                                  },
                                  orderBy: { qty: 'desc' }
                              }) || await tx.stock.findFirst({ 
                                  where: { productId: item.productId },
                                  orderBy: { reservedQty: 'desc' }
                              });

                              if (stock) {
                                  await tx.stock.update({
                                      where: { id: stock.id },
                                      data: { 
                                          qty: { decrement: Number(item.quantity) },
                                          reservedQty: { decrement: Math.min(Number(item.quantity), stock.reservedQty) }
                                      }
                                  });
                              }
                          }
                      }
                  } else if (status === 'CANCELLED' && order.status !== 'DELIVERED') {
                      // Release reservation
                      for (const item of order.items) {
                          if (item.productId) {
                              const stock = await tx.stock.findFirst({ 
                                  where: { 
                                      productId: item.productId,
                                      reservedQty: { gte: Number(item.quantity) }
                                  },
                                  orderBy: { qty: 'desc' }
                              }) || await tx.stock.findFirst({ 
                                  where: { productId: item.productId },
                                  orderBy: { reservedQty: 'desc' }
                              });

                              if (stock) {
                                  await tx.stock.update({
                                      where: { id: stock.id },
                                      data: { 
                                          reservedQty: { decrement: Math.min(Number(item.quantity), stock.reservedQty) }
                                      }
                                  });
                              }
                          }
                      }
                  }
              }

              return await tx.order.update({
                  where: { id: order.id },
                  data: updateData
              });
          });

          // Audit Log
          await logActivity(fastify, {
             entityType: 'ORDER',
             entityId: order.id,
             action: 'UPDATE_STATUS',
             performedBy: (request.user as any)?.id || 'unknown',
             details: { oldStatus: order.status, newStatus: status, note },
             ip: request.ip,
             userAgent: request.headers['user-agent']
          });

          fastify.log.info(`Order ${id} status updated from ${order.status} to ${status}`);

           // Invalidate Cache
           try {
               await (fastify as any).cache.del('shop:home');
               await (fastify as any).cache.clearPattern('shop:products:*');
               if (updatedOrder && updatedOrder.items) {
                   for (const item of updatedOrder.items) {
                       if (item.productId) {
                           const p = await (fastify as any).prisma.product.findUnique({ where: { id: item.productId }, select: { slug: true } });
                           if (p) {
                                await (fastify as any).cache.del("product:" + item.productId);
                                if (p.slug) await (fastify as any).cache.del("product:" + p.slug);
                           }
                       }
                   }
               }
           } catch (cacheErr) {
               fastify.log.error(cacheErr, 'Failed to invalidate cache on status update');
           }
          return createResponse(updatedOrder, "Order Status Updated");
      } catch (err: any) {
          fastify.log.error(`Error updating order ${id} status:`, err);
          return reply.status(500).send(createErrorResponse(err.message));
      }
  });
  
  // PATCH /admin/orders/:id/notes
  fastify.patch('/admin/orders/:id/notes', {
      preHandler: [fastify.authenticate, fastify.hasPermission('order_manage')],
      schema: {
          description: 'Update Order Notes (Internal/Customer)',
          tags: ['Orders'],
          params: { type: 'object', properties: { id: { type: 'string' } } },
          body: {
              type: 'object',
              properties: {
                  internalNote: { type: 'string' }, // Legacy simple note
                  customerNote: { type: 'string' },
                  // New: Append to log
                  appendLog: { 
                      type: 'object',
                      properties: {
                          message: { type: 'string' },
                          author: { type: 'string' } // Optional, defaults to user
                      },
                      required: ['message']
                  }
              }
          }
      }
  }, async (request: any, reply) => {
      const { id } = request.params;
      const { internalNote, customerNote, appendLog } = request.body;
      
      try {
          const order = await (fastify.prisma as any).order.findUnique({ where: { id } });
          if (!order) return reply.status(404).send(createErrorResponse("Order Not Found"));

          // Merge with existing notes
          const currentNotes = (order.notes as any) || {};
          let updatedNotes = {
              ...currentNotes,
              ...(internalNote !== undefined && { internalNote }),
              ...(customerNote !== undefined && { customerNote })
          };

          // Handle Log Appending
          if (appendLog) {
              const currentLogs = Array.isArray(currentNotes.internalLog) ? currentNotes.internalLog : [];
              const newEntry = {
                  id: new Date().getTime().toString(),
                  message: appendLog.message,
                  author: appendLog.author || (request.user?.firstName ? `${request.user.firstName} ${request.user.lastName}` : "Admin"),
                  role: "ADMIN", // assumed for now
                  timestamp: new Date().toISOString()
              };
              updatedNotes.internalLog = [...currentLogs, newEntry];
          }

          const updatedOrder = await (fastify.prisma as any).order.update({
              where: { id },
              data: { notes: updatedNotes }
          });

          // Audit Log
          await logActivity(fastify, {
             entityType: 'ORDER',
             entityId: id,
             action: 'UPDATE_NOTES',
             performedBy: (request.user as any)?.id || 'unknown',
             details: { internalNote, customerNote, appendLog },
             ip: request.ip,
             userAgent: request.headers['user-agent']
          });

          return createResponse(updatedOrder, "Order Notes Updated");
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse(err.message));
      }
  });


  // POST /orders (Create Order with Snapshots)
  fastify.post('/orders', {
    schema: {
        description: 'Create a new Order with immutable data snapshots',
        tags: ['Orders'],
        body: {
            type: 'object',
            required: ['customer', 'billingAddress', 'shippingAddress', 'payment', 'shipping', 'orderItems', 'pricingSummary'],
            properties: {
                customer: {
                    type: 'object',
                    properties: {
                        customerId: { type: 'string' },
                        email: { type: 'string' },
                        phone: { type: 'string' }
                    }
                },
                billingAddress: {
                    type: 'object',
                    properties: {
                        addressId: { type: 'string' },
                        snapshot: { type: 'object' }
                    }
                },
                shippingAddress: {
                    type: 'object',
                    properties: {
                        addressId: { type: 'string' },
                        snapshot: { type: 'object' }
                    }
                },
                payment: {
                    type: 'object',
                    properties: {
                        paymentMethod: { type: 'string' },
                        currency: { type: 'string' },
                        amountExpected: { type: 'number' },
                        metadata: { type: 'object' }
                    }
                },
                shipping: {
                    type: 'object',
                    properties: {
                        shippingMethod: { type: 'string' },
                        shippingCost: { type: 'number' },
                        estimatedDeliveryDate: { type: 'string' }
                    }
                },
                orderItems: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            productId: { type: 'string' },
                            sku: { type: 'string' },
                            quantity: { type: 'number' },
                            pricing: {
                                type: 'object',
                                properties: {
                                    unitPrice: { type: 'number' },
                                    totalPrice: { type: 'number' }
                                }
                            }
                        }
                    }
                },
                pricingSummary: {
                    type: 'object',
                    properties: {
                        currency: { type: 'string' },
                        grandTotal: { type: 'number' },
                        subTotal: { type: 'number' },
                        totalTax: { type: 'number' },
                        shippingFee: { type: 'number' }
                    }
                },
                orderContext: { type: 'object' },
                notes: { type: 'object' }
            }
        }
    }
  }, async (request: any, reply) => {
    try {
        const body = CreateOrderSchema.parse(request.body);
        
        // Transaction to ensure atomicity
        const result = await (fastify.prisma as any).$transaction(async (prisma: any) => {
            
            // 0. Resolve or Create User (Customer)
            let resolvedUserId = body.customer.customerId;
            if (!resolvedUserId) {
                let user = await prisma.user.findUnique({ where: { email: body.customer.email } });
                if (!user) {
                    user = await prisma.user.create({
                        data: {
                            email: body.customer.email,
                            firstName: body.customer.name?.split(' ')[0] || 'Guest',
                            lastName: body.customer.name?.split(' ').slice(1).join(' ') || '',
                            phoneNumber: body.customer.phone,
                            passwordHash: 'guest_checkout_placeholder', // Dummy hash for guest users
                            isActive: true,
                            role: { connect: { name: 'CUSTOMER' } } // B2C Role
                        }
                    });
                }
                resolvedUserId = user.id;
            }

            // 1. Resolve Currency
            let currency = await prisma.currency.findUnique({ where: { code: body.pricingSummary.currency } });
            if (!currency) {
                // Determine if we should fail or fallback. For now, fail.
                throw new Error(`Currency ${body.pricingSummary.currency} not found`);
            }

            // 2. Resolve or Create Shipping Address & Snapshot
            let resolvedAddressId = body.shippingAddress.addressId;
            let finalShippingSnapshot = body.shippingAddress.snapshot;

            if (resolvedAddressId) {
                // If we have an ID but no snapshot, fetch the address to create one
                if (!finalShippingSnapshot) {
                    const existingAddr = await prisma.address.findUnique({
                        where: { id: resolvedAddressId },
                        include: { country: true }
                    });
                    if (existingAddr) {
                        finalShippingSnapshot = {
                            firstName: existingAddr.firstName,
                            lastName: existingAddr.lastName,
                            fullName: `${existingAddr.firstName} ${existingAddr.lastName}`,
                            streetAddress: existingAddr.street1,
                            city: existingAddr.city,
                            province: existingAddr.state,
                            country: existingAddr.country?.name,
                            zipCode: existingAddr.zipCode,
                            phone: existingAddr.phone
                        };
                    }
                }
            } else {
                const s = body.shippingAddress.snapshot;
                if (!s) throw new Error("Shipping address ID or snapshot is required");

                // Try to find country by code or name from snapshot, or use orderContext as fallback
                let country = await prisma.country.findFirst({
                    where: { OR: [
                        { code: { equals: s.country, mode: 'insensitive' } }, 
                        { name: { equals: s.country, mode: 'insensitive' } }
                    ] }
                });

                if (!country && body.orderContext?.countryCode) {
                    country = await prisma.country.findFirst({
                        where: { OR: [
                            { code: { equals: body.orderContext.countryCode, mode: 'insensitive' } },
                            { code: body.orderContext.countryCode === 'SA' ? 'KSA' : body.orderContext.countryCode }
                        ]}
                    });
                }

                if (!country) {
                    country = await prisma.country.findFirst({ where: { code: { in: ['KSA', 'SA'] } } });
                }

                if (!country) country = await prisma.country.findFirst();
                if (!country) throw new Error("Country not found and no fallback available.");

                const address = await prisma.address.create({
                    data: {
                        user: { connect: { id: resolvedUserId } },
                        firstName: s.fullName?.split(' ')[0] || 'Guest',
                        lastName: s.fullName?.split(' ').slice(1).join(' ') || '',
                        street1: s.streetAddress,
                        city: s.city,
                        zipCode: s.zip || '00000',
                        state: s.province,
                        country: { connect: { id: country.id } },
                        phone: s.phone || body.customer.phone || '',
                        type: 'SHIPPING'
                    }
                });
                resolvedAddressId = address.id;
                finalShippingSnapshot = s; // Use provided snapshot
            }

            // 3. Generate Order Number
            const count = await prisma.order.count();
            const orderNumber = `ORD-${new Date().getFullYear()}-${1000 + count + 1}`;

            // 4. Create Order Header
            const order = await prisma.order.create({
                data: {
                    orderNumber,
                    user: { connect: { id: resolvedUserId } },
                    status: 'PENDING',
                    currency: { connect: { id: currency.id } },
                    address: { connect: { id: resolvedAddressId } }, 
                    
                    // --- SNAPSHOTS ---
                    billingSnapshot: body.billingAddress.snapshot || {},
                    shippingSnapshot: finalShippingSnapshot || {},
                    paymentDetails: body.payment,
                    shippingDetails: body.shipping,
                    pricingSummary: body.pricingSummary,
                    orderContext: body.orderContext || {},
                    notes: body.notes || {},

                    totalAmount: body.pricingSummary.grandTotal,
                    taxAmount: body.pricingSummary.totalTax,
                    shippingAmount: body.pricingSummary.shippingFee,

                    paymentStatus: 'UNPAID',
                    paymentMethod: body.payment.paymentMethod
                }
            });

            // 5. Create Order Items
            for (const item of body.orderItems) {
                await prisma.orderItem.create({
                    data: {
                        orderId: order.id,
                        productId: item.productId,
                        quantity: item.quantity,
                        price: item.pricing.unitPrice,
                        sku: item.sku,
                        
                        // Item Snapshots
                        pricingSnapshot: item.pricing,
                        inventorySnapshot: item.inventory
                    }
                });

                // Incremently decrement inventory logic
                const stock = await prisma.stock.findFirst({ where: { productId: item.productId } });
                if (stock) {
                    await prisma.stock.update({
                        where: { id: stock.id },
                        data: { reservedQty: { increment: Number(item.quantity) } }
                    });
                }
            }

            // 6. Convert/Clear Cart
            // Instead of updating status which causes unique constraint issues, we'll clear the cart
            await prisma.cartItem.deleteMany({
                where: {
                    cart: {
                        userId: resolvedUserId,
                        status: 'ACTIVE'
                    }
                }
            });
            
            await prisma.cart.deleteMany({
                where: {
                    userId: resolvedUserId,
                    status: 'ACTIVE'
                }
            });

            return order;
        }, { timeout: 30000 });

        // Audit Log
        if (result && result.id) {
             // We can't await inside the response easily without making the function slower, but here we can just fire and forget or await.
             // But 'logActivity' is async.
             await logActivity(fastify, {
                 entityType: 'ORDER',
                 entityId: result.id,
                 action: 'CREATE',
                 performedBy: body.customer?.customerId || 'unknown',
                 details: { orderNumber: result.orderNumber, amount: result.totalAmount },
                 ip: request.ip,
                 userAgent: request.headers['user-agent']
             });
        }

        return createResponse(result, "Order Created Successfully");
    
    } catch (err: any) {
        if (err instanceof z.ZodError) {
             return reply.status(400).send(createErrorResponse("Validation Error: " + JSON.stringify(err.issues)));
        }
        fastify.log.error(err);
        return reply.status(500).send(createErrorResponse("Order Creation Failed: " + err.message));
    }
  });

  // PATCH /admin/orders/:id (General Update)
  fastify.patch('/admin/orders/:id', {
      schema: {
          description: 'General Update order details (supports full wizard data)',
          tags: ['Orders'],
          params: { type: 'object', properties: { id: { type: 'string' } } },
      }
  }, async (request: any, reply) => {
      const { id } = request.params;
      const data = request.body as any;
      const prisma = (fastify.prisma as any);

      try {
          const order = await prisma.order.findFirst({
              where: { OR: [{ id }, { orderNumber: id }] },
              include: { items: true }
          });

          if (!order) return reply.status(404).send(createErrorResponse("Order Not Found"));

          // Use transaction for consistency
          const result = await prisma.$transaction(async (tx: any) => {
              
              const updateData: any = {};
              
              // 1. Handle Basic Fields
              if (data.status) updateData.status = data.status;
              if (data.paymentStatus) updateData.paymentStatus = data.paymentStatus;
              if (data.paymentMethod) updateData.paymentMethod = data.paymentMethod;
              if (data.deliveryMethod) updateData.deliveryMethod = data.deliveryMethod;
              if (data.trackingNumber) updateData.trackingNumber = data.trackingNumber;
              if (data.courierPartner) updateData.courierPartner = data.courierPartner;
              
              // 2. Handle Address/Snapshot
              if (data.shippingAddress) {
                  const currentSnapshot = (order.shippingSnapshot as any) || {};
                  updateData.shippingSnapshot = {
                      ...currentSnapshot,
                      addressLine1: data.shippingAddress
                  };
              }

              // 3. Handle Items & Inventory
              if (data.items && Array.isArray(data.items)) {
                  // A. Restore current stock
                  for (const oldItem of order.items) {
                      if (oldItem.productId) {
                          const stock = await tx.stock.findFirst({ where: { productId: oldItem.productId } });
                          if (stock) {
                              await tx.stock.update({
                                  where: { id: stock.id },
                                  data: { qty: { increment: Number(oldItem.quantity) } }
                              });
                          }
                      }
                  }

                  // B. Remove old items
                  await tx.orderItem.deleteMany({ where: { orderId: order.id } });

                  // C. Create new items & decrement stock
                  const newItemsData = [];
                  let newTotal = 0;
                  for (const item of data.items) {
                      newTotal += Number(item.quantity) * Number(item.unitPrice);
                      newItemsData.push({
                          orderId: order.id,
                          productId: item.productId,
                          sku: item.sku || 'N/A',
                          quantity: Number(item.quantity),
                          price: Number(item.unitPrice),
                      });

                      if (item.productId) {
                          const stock = await tx.stock.findFirst({ where: { productId: item.productId } });
                          if (stock) {
                              await tx.stock.update({
                                  where: { id: stock.id },
                                  data: { qty: { decrement: Number(item.quantity) } }
                              });
                          }
                      }
                  }
                  
                  await tx.orderItem.createMany({ data: newItemsData });
                  updateData.totalAmount = newTotal;
              }

              // 4. Handle Customer details if changed
              if (data.customer) {
                  const currentBilling = (order.billingSnapshot as any) || {};
                  updateData.billingSnapshot = {
                      ...currentBilling,
                      name: data.customer.name,
                      email: data.customer.email,
                      phone: data.customer.phone
                  };
                  
                  if (order.userId) {
                      await tx.user.update({
                          where: { id: order.userId },
                          data: {
                              firstName: data.customer.name?.split(' ')[0],
                              lastName: data.customer.name?.split(' ').slice(1).join(' '),
                              phoneNumber: data.customer.phone
                          }
                      });
                  }
              }

              return await tx.order.update({
                  where: { id: order.id },
                  data: updateData
              });
          });

          await logActivity(fastify, {
              entityType: 'ORDER',
              entityId: order.id,
              action: 'UPDATE_GENERAL',
              performedBy: (request.user as any)?.id || 'unknown',
              details: { changes: Object.keys(data) },
              ip: request.ip,
              userAgent: request.headers['user-agent']
          });

          return createResponse(result, "Order Updated Successfully");
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse(err.message));
      }
  });

  // =====================================================
  // PUBLIC ORDER TRACKING ENDPOINT (No Auth Required)
  // =====================================================
  
  fastify.get('/orders/track', {
    schema: {
      description: 'Public Order Tracking',
      tags: ['Public Orders'],
      querystring: {
        type: 'object',
        required: ['search'],
        properties: {
          search: { type: 'string', description: 'Order number OR tracking number' },
          region: { type: 'string', enum: ['SA', 'AE', 'PK'] }
        }
      }
    }
  }, async (request: any, reply) => {
    try {
      const { search, region } = request.query;
      const prisma = fastify.prisma as any;

      if (!search || search.trim().length === 0) {
        return reply.status(400).send(createErrorResponse('Search parameter is required'));
      }

      const searchTerm = search.trim();

      // Smart search: try order number or tracking number
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { orderNumber: { equals: searchTerm, mode: 'insensitive' } },
            { trackingNumber: { equals: searchTerm, mode: 'insensitive' } }
          ],
          deletedAt: null
        },
        include: {
          currency: true,
          address: { include: { country: true }}
        }
      });

      if (!order) {
        return reply.status(404).send(createErrorResponse('Order not found'));
      }

      // Detect region
      let detectedRegion = region || order.address?.country?.code || 'SA';

      // Get tracking data
      let timelineData = order.trackingTimeline as any;
      const cacheAge = order.updatedAt ? Date.now() - new Date(order.updatedAt).getTime() : Infinity;

      if (!timelineData || cacheAge > 300000) { // 5 min cache
        const { trackingService } = await import('../services/tracking.service');
        const trackingResponse = await trackingService.track(
          order.trackingNumber || order.orderNumber,
          detectedRegion
        );
        
        if (trackingResponse) {
          timelineData = trackingResponse;
          prisma.order.update({
            where: { id: order.id },
            data: {
              trackingTimeline: trackingResponse,
              shipperRegion: detectedRegion
            }
          }).catch(() => {});
        }
      }

      // Fallback to internal timeline
      if (!timelineData) {
        timelineData = {
          status: order.status,
          carrier: order.courierPartner || 'Standard',
          timeline: [
            { event: 'Order Placed', date: order.createdAt, location: order.address?.city || 'Unknown' }
          ]
        };
      }

      return createResponse({
        orderNumber: order.orderNumber,
        orderDate: order.createdAt,
        estimatedDelivery: order.estimatedDeliveryDate || timelineData.estimatedDelivery,
        status: order.status,
        carrier: timelineData.carrier || order.courierPartner || 'Standard Delivery',
        trackingNumber: order.trackingNumber,
        totalAmount: parseFloat(order.totalAmount.toString()),
        currency: order.currency?.code || 'SAR',
        timeline: timelineData.timeline || []
      });

    } catch (err: any) {
      fastify.log.error('Tracking error:', err);
      return reply.status(500).send(createErrorResponse('Unable to fetch tracking'));
    }
  });

  // =====================================================
  // CUSTOMER DASHBOARD ROUTES (My Orders)
  // =====================================================

  /**
   * GET /api/v1/orders/my-orders
   * Returns list of orders for the authenticated user
   */
  fastify.get('/orders/my-orders', {
    preHandler: [(fastify as any).authenticate],
    schema: {
      description: 'Get Order History for the logged-in customer',
      tags: ['Orders'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 10 },
          status: { type: 'string' },
          search: { type: 'string' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          companyWide: { type: 'boolean', default: false }
        }
      }
    }
  }, async (request: any, reply) => {
    try {
      const user = request.user as any;
      const userId = user?.id;
      if (!userId) return reply.status(401).send(createErrorResponse("Unauthorized"));

      const { page, limit, status, search, startDate, endDate, companyWide } = request.query;
      const skip = (page - 1) * limit;

      const where: any = {
        deletedAt: null
      };

      // Handle Company-wide filtering for B2B admins/buyers
      if (companyWide && user.b2bProfileId) {
          where.user = { b2bProfileId: user.b2bProfileId };
      } else {
          where.userId = userId;
      }

      if (status && status !== 'All') {
        where.status = status;
      }

      if (search) {
        where.OR = [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { trackingNumber: { contains: search, mode: 'insensitive' } },
          { items: { some: { OR: [
            { sku: { contains: search, mode: 'insensitive' } } ,
            { product: { name: { contains: search, mode: 'insensitive' } } }
          ] } } }
        ];
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }

      const [orders, total] = await Promise.all([
        fastify.prisma.order.findMany({
          where,
          include: {
            currency: true,
            user: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                }
            },
            items: { 
                include: { 
                    product: {
                        include: {
                            category: true
                        }
                    } 
                } 
            },
            _count: { select: { items: true } }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        fastify.prisma.order.count({ where })
      ]);

      return createResponse({
        orders,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          current: page,
          limit
        }
      }, "Order History Retrieved");

    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

  /**
   * GET /api/v1/orders/my-orders/:id
   * Returns full details for a specific order owned by the user
   */
  fastify.get('/orders/my-orders/:id', {
    preHandler: [(fastify as any).authenticate],
    schema: {
      description: 'Get Detailed Order info for the logged-in customer',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } }
      }
    }
  }, async (request: any, reply) => {
    try {
      const userId = (request.user as any)?.id;
      const { id } = request.params;

      const order = await fastify.prisma.order.findFirst({
        where: {
          OR: [{ id }, { orderNumber: id }],
          userId,
          deletedAt: null
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  name: true,
                  sku: true,
                  images: true,
                  slug: true,
                  price: true
                }
              }
            }
          },
          currency: true,
          address: {
            include: { country: true }
          }
        }
      });

      if (!order) {
        return reply.status(404).send(createErrorResponse("Order not found or access denied"));
      }

      return createResponse(order, "Order details fetched successfully");

    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send(createErrorResponse(err.message));
    }
  });

}
