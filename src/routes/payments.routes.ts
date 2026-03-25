import { FastifyInstance } from 'fastify';
import { createResponse, createErrorResponse } from '../utils/response-wrapper';
import { logActivity } from '../utils/audit';
import { z } from 'zod';
import { emailService } from '../services/email.service';

export default async function paymentsRoutes(fastify: FastifyInstance) {

  // GET /admin/payments/pending - List transactions awaiting manual verification
  fastify.get('/admin/payments/pending', {
    preHandler: [fastify.authenticate, fastify.hasPermission('order_manage')],
    schema: {
        description: 'Get pending manual payments (Bank Transfer, EasyPaisa, JazzCash)',
        tags: ['Payments'],
        querystring: {
            type: 'object',
            properties: {
                page: { type: 'integer', default: 1 },
                limit: { type: 'integer', default: 10 },
                status: { type: 'string', default: 'PENDING' }
            }
        }
    }
  }, async (request: any, reply) => {
      try {
          const { page = 1, limit = 10, status } = request.query;
          const skip = (Number(page) - 1) * Number(limit);

          const where: any = {
              status: status,
              method: {
                  in: ['Bank Transfer', 'EasyPaisa', 'JazzCash', 'Direct Transaction', 'bank_transfer', 'easypaisa', 'jazzcash']
              }
          };

          const [transactions, total] = await Promise.all([
              (fastify.prisma as any).transaction.findMany({
                  where,
                  include: {
                      order: {
                          select: {
                              orderNumber: true,
                              totalAmount: true,
                              status: true,
                              createdAt: true
                          }
                      },
                      user: {
                          select: {
                              firstName: true,
                              lastName: true,
                              email: true,
                              phoneNumber: true
                          }
                      },
                      currency: {
                          select: {
                              code: true
                          }
                      }
                  },
                  orderBy: { createdAt: 'desc' },
                  skip,
                  take: Number(limit)
              }),
              (fastify.prisma as any).transaction.count({ where })
          ]);

          return createResponse(transactions, "Pending payments retrieved", { page: Number(page), limit: Number(limit), total });
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse(err.message));
      }
  });

  // PATCH /admin/payments/:id/verify - Approve or Reject a manual payment
  fastify.patch('/admin/payments/:id/verify', {
      preHandler: [fastify.authenticate, fastify.hasPermission('order_manage')],
      schema: {
          description: 'Verify (Approve/Reject) a manual payment receipt',
          tags: ['Payments'],
          params: { type: 'object', properties: { id: { type: 'string' } } },
          body: {
              type: 'object',
              required: ['action'],
              properties: {
                  action: { type: 'string', enum: ['APPROVE', 'REJECT'] },
                  note: { type: 'string' }
              }
          }
      }
  }, async (request: any, reply) => {
      const { id } = request.params;
      const { action, note } = request.body;
      const prisma = (fastify.prisma as any);

      try {
          const transaction = await prisma.transaction.findUnique({
              where: { id },
              include: { order: true, user: true }
          });

          if (!transaction) return reply.status(404).send(createErrorResponse("Transaction not found"));
          if (transaction.status !== 'PENDING') return reply.status(400).send(createErrorResponse(`Transaction is already ${transaction.status}`));

          let newTxStatus = 'COMPLETED';
          let orderPaymentStatus = 'PAID';
          let orderStatus = transaction.order.status;

          if (action === 'REJECT') {
              newTxStatus = 'FAILED';
              orderPaymentStatus = 'FAILED';
          } else {
              // If approved and order is still new/pending, move to processing
              if (orderStatus === 'PENDING') {
                  orderStatus = 'PROCESSING';
              }
          }

          // Use transaction to ensure both records are updated atomically
          const result = await prisma.$transaction(async (tx: any) => {
              const updatedTx = await tx.transaction.update({
                  where: { id },
                  data: {
                      status: newTxStatus,
                      updatedAt: new Date()
                  }
              });

              // Add a note to the order
              const orderNotes = (transaction.order.notes as any) || {};
              const internalLog = Array.isArray(orderNotes.internalLog) ? orderNotes.internalLog : [];
              internalLog.push({
                  id: new Date().getTime().toString(),
                  message: `Payment ${action === 'APPROVE' ? 'Approved' : 'Rejected'}. Reciept ID: ${transaction.id}. Note: ${note || 'None'}.`,
                  author: request.user?.firstName ? `${request.user.firstName} ${request.user.lastName}` : "Admin",
                  role: "ADMIN",
                  timestamp: new Date().toISOString()
              });

              const updatedOrder = await tx.order.update({
                  where: { id: transaction.orderId },
                  data: {
                      paymentStatus: orderPaymentStatus,
                      status: orderStatus,
                      notes: { ...orderNotes, internalLog },
                      processingDate: action === 'APPROVE' && !transaction.order.processingDate ? new Date() : transaction.order.processingDate
                  }
              });

              return { updatedTx, updatedOrder };
          });

          // Send Email Notification
          if (action === 'APPROVE') {
              try {
                  // emailService.sendOrderConfirmation(...) // To be implemented in email.service.ts
                  fastify.log.info(`Payment approved for Order ${transaction.order.orderNumber}. Email notification triggered.`);
              } catch (e) {
                  fastify.log.error(e, "Failed to send payment approval email");
              }
          } else {
              // Send rejection email (implement template if exists, or simple text)
              fastify.log.info(`Payment rejected for Order ${transaction.order.orderNumber}. Email notification should be sent.`);
          }

          // Audit Log
          await logActivity(fastify, {
              entityType: 'TRANSACTION',
              entityId: id,
              action: `PAYMENT_${action}`,
              performedBy: request.user?.id || 'unknown',
              details: { note, orderNumber: transaction.order.orderNumber },
              ip: request.ip,
              userAgent: request.headers['user-agent']
          });

          return createResponse(result.updatedTx, `Payment ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully`);
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse(err.message));
      }
  });

  // POST /orders/:id/payment-receipt - For Customers to upload their receipt (Front-facing API)
  fastify.post('/orders/:id/payment-receipt', {
      preHandler: [fastify.authenticate],
      schema: {
          description: 'Attach a payment receipt URL to a pending manual payment',
          tags: ['Orders', 'Payments'],
          params: { type: 'object', properties: { id: { type: 'string' } } },
          body: {
              type: 'object',
              required: ['receiptUrl'],
              properties: {
                  receiptUrl: { type: 'string' },
                  referenceNumber: { type: 'string' },
                  transactionDate: { type: 'string' }
              }
          }
      }
  }, async (request: any, reply) => {
      const { id } = request.params;
      const { receiptUrl, referenceNumber, transactionDate } = request.body;
      const userId = request.user?.id;
      const prisma = (fastify.prisma as any);

      try {
          const order = await prisma.order.findFirst({
              where: {
                  OR: [{ id: id }, { orderNumber: id }],
                  userId
              },
              include: { transactions: true }
          });

          if (!order) return reply.status(404).send(createErrorResponse("Order not found or unauthorized"));

          // Find the pending transaction
          let transaction = order.transactions.find((t: any) => t.status === 'PENDING' && t.type === 'PAYMENT');
          
          if (!transaction) {
              // If no pending transaction exists, maybe it was created without one? Fallback.
              return reply.status(400).send(createErrorResponse("No pending manual payment transaction found for this order."));
          }

          const existingMetadata = (transaction.metadata as any) || {};

          transaction = await prisma.transaction.update({
              where: { id: transaction.id },
              data: {
                  providerTransactionId: referenceNumber || null,
                  metadata: {
                      ...existingMetadata,
                      receiptUrl,
                      referenceNumber,
                      transactionDate,
                      submittedAt: new Date().toISOString()
                  }
              }
          });

          await logActivity(fastify, {
              entityType: 'TRANSACTION',
              entityId: transaction.id,
              action: 'SUBMIT_RECEIPT',
              performedBy: userId,
              details: { referenceNumber },
              ip: request.ip,
              userAgent: request.headers['user-agent']
          });

          return createResponse(transaction, "Payment receipt submitted successfully");
      } catch (err: any) {
          fastify.log.error(err);
          return reply.status(500).send(createErrorResponse(err.message));
      }
  });

}
