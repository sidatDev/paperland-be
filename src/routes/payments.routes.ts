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
                  // Refetch full order with items and user for the template
                  const fullOrder = await prisma.order.findUnique({
                      where: { id: transaction.orderId },
                      include: {
                          user: true,
                          items: {
                              include: {
                                  product: true
                              }
                          }
                      }
                  });
                  if (fullOrder && fullOrder.user?.email) {
                      await emailService.sendOrderStatusUpdateEmail(fullOrder.user.email, fullOrder, orderStatus);
                  }
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

  // ─────────────────────────────────────────────────────────
  // STRIPE PAYMENT ROUTES
  // ─────────────────────────────────────────────────────────

  /**
   * POST /api/v1/payments/stripe/create-intent
   * Creates a Stripe PaymentIntent for an existing DRAFT order.
   * Supports both authenticated and guest checkout flows.
   * Returns { clientSecret, publishableKey, usdAmount, exchangeRate }
   * The secretKey is NEVER returned to the client.
   */
  fastify.post('/payments/stripe/create-intent', {
      schema: {
          description: 'Create a Stripe PaymentIntent for a DRAFT order',
          tags: ['Payments', 'Stripe'],
          body: {
              type: 'object',
              required: ['orderId'],
              properties: {
                  orderId:    { type: 'string' },
                  guestToken: { type: 'string' }
              }
          }
      }
  }, async (request: any, reply) => {
      const { orderId, guestToken } = request.body;
      const prisma = (fastify.prisma as any);

      try {
          // ── 1. Resolve authenticated or guest order ──
          // Safely try to extract userId from JWT (no side-effects on failure)
          let userId: string | null = null;
          const authHeader = request.headers?.authorization as string | undefined;
          if (authHeader?.startsWith('Bearer ')) {
              try {
                  const decoded = (fastify as any).jwt.verify(authHeader.slice(7)) as any;
                  userId = decoded?.id || decoded?.sub || null;
              } catch {
                  // Token invalid or absent — guest flow
              }
          }

          let order: any;
          if (userId) {
              order = await fastify.prisma.order.findFirst({
                  where: { id: orderId, userId, status: 'DRAFT' }
              });
          } else if (guestToken) {
              order = await prisma.order.findFirst({
                  where: { id: orderId, guestToken, status: 'DRAFT', isGuestOrder: true }
              });
          }

          if (!order) {
              return reply.code(404).send(createErrorResponse('Draft order not found'));
          }

          // ── 2. Load active Stripe gateway config ──
          const gateway = await prisma.paymentGateway.findFirst({
              where: { identifier: 'stripe', isActive: true }
          });

          if (!gateway) {
              return reply.code(400).send(createErrorResponse('Stripe payment gateway is not active'));
          }

          const config = (gateway.config as any) || {};
          const secretKey: string = config.secretKey || '';
          const publishableKey: string = config.publishableKey || '';
          const exchangeRate: number = Number(config.exchangeRatePKR || 278);
          const currency: string = (config.currency || 'usd').toLowerCase();

          if (!secretKey || secretKey.includes('*')) {
              return reply.code(400).send(createErrorResponse('Stripe secret key is not configured'));
          }
          if (!publishableKey) {
              return reply.code(400).send(createErrorResponse('Stripe publishable key is not configured'));
          }

          // ── 3. Idempotency: reuse existing intent if created ──
          const existingDetails = (order.paymentDetails as any) || {};
          if (existingDetails.stripePaymentIntentId) {
              const { retrievePaymentIntent } = await import('../services/stripe.service');
              try {
                  const existingIntent = await retrievePaymentIntent(secretKey, existingDetails.stripePaymentIntentId);
                  if (existingIntent.status === 'requires_payment_method' || existingIntent.status === 'requires_confirmation') {
                      const usdAmount = Math.round(Number(order.totalAmount) / exchangeRate * 100) / 100;
                      return {
                          clientSecret: existingIntent.client_secret,
                          publishableKey,
                          usdAmount,
                          exchangeRate,
                          currency
                      };
                  }
              } catch {
                  // Intent may have expired; create a fresh one below
              }
          }

          // ── 4. Calculate USD amount (PKR ÷ exchangeRate, in cents) ──
          const pkrAmount = Number(order.totalAmount);
          const usdAmount = Math.round(pkrAmount / exchangeRate * 100) / 100;
          const amountInCents = Math.round(usdAmount * 100); // Convert to cents

          if (amountInCents < 50) {
              return reply.code(400).send(createErrorResponse('Order amount is too small for Stripe (minimum ~$0.50 USD)'));
          }

          // ── 5. Create PaymentIntent ──
          const { createPaymentIntent } = await import('../services/stripe.service');
          const intent = await createPaymentIntent(secretKey, amountInCents, currency, orderId, {
              orderNumber: order.orderNumber || '',
              pkrAmount: String(pkrAmount),
              exchangeRate: String(exchangeRate)
          });

          // ── 6. Store intent ID in order.paymentDetails (not the secret) ──
          await fastify.prisma.order.update({
              where: { id: orderId },
              data: {
                  paymentDetails: {
                      ...existingDetails,
                      stripePaymentIntentId: intent.id,
                      stripeMode: config.mode || 'test',
                      usdAmount,
                      exchangeRate
                  }
              }
          });

          fastify.log.info(`[Stripe] Created PaymentIntent ${intent.id} for order ${orderId} — ${amountInCents} cents ${currency.toUpperCase()}`);

          return {
              clientSecret: intent.client_secret,
              publishableKey,
              usdAmount,
              exchangeRate,
              currency
          };

      } catch (err: any) {
          fastify.log.error(err, '[Stripe] create-intent failed');
          return reply.code(500).send(createErrorResponse(err.message || 'Failed to create Stripe PaymentIntent'));
      }
  });

  /**
   * POST /api/v1/webhooks/stripe
   * Stripe webhook handler. Requires raw body for signature verification.
   * Registered in an encapsulated scope that overrides the JSON parser.
   */
  fastify.register(async (webhookScope) => {
      // Override JSON content-type parser to preserve raw body for Stripe signature
      webhookScope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req: any, body: any, done: any) => {
          (req as any).rawBody = body as Buffer;
          try {
              const parsed = body && (body as Buffer).length > 0 ? JSON.parse((body as Buffer).toString()) : {};
              done(null, parsed);
          } catch (e: any) {
              done(e);
          }
      });

      webhookScope.post('/webhooks/stripe', {
          schema: {
              description: 'Stripe webhook handler (signature-verified)',
              tags: ['Payments', 'Stripe']
          }
      }, async (request: any, reply) => {
          const prisma = (fastify.prisma as any);
          const signature = request.headers['stripe-signature'] as string;
          const rawBody = request.rawBody as Buffer;

          if (!signature || !rawBody) {
              return reply.code(400).send({ error: 'Missing Stripe signature or body' });
          }

          try {
              // Load gateway config
              const gateway = await prisma.paymentGateway.findFirst({
                  where: { identifier: 'stripe' }
              });

              const config = (gateway?.config as any) || {};
              const secretKey: string = config.secretKey || '';
              const webhookSecret: string = config.webhookSecret || '';

              if (!secretKey || secretKey.includes('*') || !webhookSecret || webhookSecret.includes('*')) {
                  fastify.log.warn('[Stripe Webhook] Secret keys not configured, skipping verification');
                  return reply.code(400).send({ error: 'Stripe not configured' });
              }

              // Verify webhook signature
              const { constructWebhookEvent } = await import('../services/stripe.service');
              const event = constructWebhookEvent(secretKey, webhookSecret, rawBody, signature);

              const intent = event.data.object as any;
              const orderId = intent?.metadata?.orderId;

              if (!orderId) {
                  fastify.log.warn(`[Stripe Webhook] Event ${event.type} — no orderId in metadata`);
                  return reply.send({ received: true });
              }

              // Handle events
              if (event.type === 'payment_intent.succeeded') {
                  fastify.log.info(`[Stripe Webhook] payment_intent.succeeded — OrderId: ${orderId}, IntentId: ${intent.id}`);

                  const order = await fastify.prisma.order.findUnique({ where: { id: orderId } });
                  if (!order) {
                      fastify.log.warn(`[Stripe Webhook] Order ${orderId} not found`);
                      return reply.send({ received: true });
                  }

                  // Idempotency: skip if already paid
                  if (order.paymentStatus === 'PAID') {
                      fastify.log.info(`[Stripe Webhook] Order ${orderId} already PAID, skipping`);
                      return reply.send({ received: true });
                  }

                  await fastify.prisma.order.update({
                      where: { id: orderId },
                      data: {
                          paymentStatus: 'PAID',
                          transactionRef: intent.id,
                          paymentDetails: {
                              ...(typeof order.paymentDetails === 'object' ? order.paymentDetails as any : {}),
                              stripePaymentIntentId: intent.id,
                              paidAt: new Date().toISOString()
                          },
                          updatedAt: new Date()
                      }
                  });

                  // Update Transaction record if exists
                  await prisma.transaction.updateMany({
                      where: { orderId, status: 'PENDING', method: { in: ['STRIPE', 'stripe'] } },
                      data: { status: 'COMPLETED', providerTransactionId: intent.id }
                  });

                  fastify.log.info(`[Stripe Webhook] Order ${orderId} marked PAID via webhook`);

              } else if (event.type === 'payment_intent.payment_failed') {
                  fastify.log.info(`[Stripe Webhook] payment_intent.payment_failed — OrderId: ${orderId}`);

                  await fastify.prisma.order.update({
                      where: { id: orderId },
                      data: {
                          paymentStatus: 'FAILED',
                          updatedAt: new Date()
                      }
                  });

                  await prisma.transaction.updateMany({
                      where: { orderId, status: 'PENDING', method: { in: ['STRIPE', 'stripe'] } },
                      data: { status: 'FAILED' }
                  });
              }

              return reply.send({ received: true });

          } catch (err: any) {
              fastify.log.error(err, '[Stripe Webhook] Error processing event');
              return reply.code(400).send({ error: 'Webhook processing failed: ' + err.message });
          }
      });
  });

  // ─────────────────────────────────────────────────────────
  // GOPAYFAST PAYMENT ROUTES
  // ─────────────────────────────────────────────────────────

  fastify.post('/payments/gopayfast/create', {
      schema: {
          description: 'Create a GoPayFast payment session for a DRAFT order',
          tags: ['Payments', 'GoPayFast'],
          body: {
              type: 'object',
              required: ['orderId'],
              properties: {
                  orderId:    { type: 'string' },
                  guestToken: { type: 'string' }
              }
          }
      }
  }, async (request: any, reply) => {
      const { orderId, guestToken } = request.body;
      const prisma = (fastify.prisma as any);

      try {
          // Resolve authenticated or guest order
          let userId: string | null = null;
          const authHeader = request.headers?.authorization as string | undefined;
          if (authHeader?.startsWith('Bearer ')) {
              try {
                  const decoded = (fastify as any).jwt.verify(authHeader.slice(7)) as any;
                  userId = decoded?.id || decoded?.sub || null;
              } catch {}
          }

          let order: any;
          if (userId) {
              order = await prisma.order.findFirst({
                  where: { id: orderId, userId, status: 'DRAFT' },
                  include: { user: true }
              });
          } else if (guestToken) {
              order = await prisma.order.findFirst({
                  where: { id: orderId, guestToken, status: 'DRAFT', isGuestOrder: true }
              });
          }

          if (!order) return reply.code(404).send(createErrorResponse('Draft order not found or unauthorized'));

          // Load active gateway config
          const gateway = await prisma.paymentGateway.findFirst({
              where: { identifier: 'gopayfast', isActive: true }
          });

          if (!gateway) return reply.code(400).send(createErrorResponse('GoPayFast payment gateway is not active'));

          const config = (gateway.config as any) || {};
          const secureKey: string = config.secureKey || '';
          const merchantId: string = config.merchantId || '';

          if (!secureKey || secureKey.includes('*')) return reply.code(400).send(createErrorResponse('GoPayFast secure key is not configured'));
          if (!merchantId) return reply.code(400).send(createErrorResponse('GoPayFast merchant ID is not configured'));

          const backendUrl = process.env.BACKEND_URL || `${request.protocol}://${request.hostname}`;
          const gopayfastConfig = {
              merchantId,
              secureKey,
              mode: config.mode || 'sandbox',
              returnUrl: config.returnUrl || '',
              ipnUrl: `${backendUrl}/api/v1/payments/gopayfast/ipn`
          };

          const orderData = {
              id: order.id,
              orderNumber: order.orderNumber,
              totalAmount: Number(order.totalAmount),
              customerName: order.user ? `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim() : 'Customer',
              customerEmail: order.user?.email || '',
              customerPhone: order.user?.phoneNumber || ''
          };

          const { buildGoPayFastSession } = await import('../services/gopayfast.service');
          const session = buildGoPayFastSession(gopayfastConfig, orderData);

          fastify.log.info(`[GoPayFast] Created session for order ${orderId}`);

          return { payment_url: session.paymentUrl, formFields: session.formFields, orderId: orderId };
      } catch (err: any) {
          fastify.log.error(err, '[GoPayFast] create session failed');
          return reply.code(500).send(createErrorResponse(err.message || 'Failed to create GoPayFast session'));
      }
  });

  fastify.post('/payments/gopayfast/ipn', async (request: any, reply) => {
      // Public webhook endpoint
      const prisma = (fastify.prisma as any);
      const payload = request.body || {};
      
      const orderId = payload.order_id;
      const transactionId = payload.transaction_id;
      const amount = payload.amount;
      const status = payload.status;
      const receivedHash = payload.hash;

      if (!orderId || !transactionId || !amount || !status || !receivedHash) {
          return reply.code(400).send({ error: 'Missing required IPN fields' });
      }

      try {
          const gateway = await prisma.paymentGateway.findFirst({
              where: { identifier: 'gopayfast' }
          });

          const config = (gateway?.config as any) || {};
          const secureKey: string = config.secureKey || '';
          const merchantId: string = config.merchantId || '';

          if (!secureKey || secureKey.includes('*')) {
              fastify.log.warn('[GoPayFast IPN] Keys not configured, skipping verification');
              return reply.code(400).send({ error: 'GoPayFast not configured' });
          }

          const { verifyGoPayFastIpn } = await import('../services/gopayfast.service');
          
          const isValid = verifyGoPayFastIpn({
              merchantId,
              orderId,
              amount,
              secureKey,
              receivedHash
          });

          if (!isValid) {
              fastify.log.error(`[GoPayFast IPN] Hash mismatch for order ${orderId}`);
              return reply.code(400).send({ error: 'Invalid hash' });
          }

          const order = await prisma.order.findUnique({ where: { id: orderId } });
          if (!order) {
              fastify.log.warn(`[GoPayFast IPN] Order ${orderId} not found`);
              return reply.send({ received: true });
          }

          // Convert DB string amount and payload amount to floats safely
          const expectedAmount = parseFloat(String(order.totalAmount));
          const receivedAmount = parseFloat(String(amount));
          
          if (Math.abs(expectedAmount - receivedAmount) > 1.0) {
              fastify.log.warn(`[GoPayFast IPN] Amount mismatch for order ${orderId}. Expected ${expectedAmount}, received ${receivedAmount}`);
              return reply.code(400).send({ error: 'Amount mismatch' });
          }

          if (order.paymentStatus === 'PAID') {
              fastify.log.info(`[GoPayFast IPN] Order ${orderId} already PAID, skipping`);
              return reply.send({ received: true });
          }

          if (status.toUpperCase() === 'SUCCESS') {
              await prisma.order.update({
                  where: { id: orderId },
                  data: {
                      paymentStatus: 'PAID',
                      transactionRef: transactionId,
                      paymentMethod: 'GOPAYFAST',
                      paymentDetails: {
                          ...(typeof order.paymentDetails === 'object' ? order.paymentDetails as any : {}),
                          goPayFastTransactionId: transactionId,
                          paidAt: new Date().toISOString()
                      },
                      updatedAt: new Date()
                  }
              });

              // Update any associated PENDING transaction record
              await prisma.transaction.updateMany({
                  where: { orderId, status: 'PENDING', method: { in: ['GOPAYFAST', 'gopayfast'] } },
                  data: { status: 'COMPLETED', providerTransactionId: transactionId }
              });

              fastify.log.info(`[GoPayFast IPN] Order ${orderId} marked PAID via webhook`);
          } else {
              fastify.log.info(`[GoPayFast IPN] Payment failed/status: ${status} for Order ${orderId}`);
              await prisma.order.update({
                  where: { id: orderId },
                  data: {
                      paymentStatus: 'FAILED',
                      updatedAt: new Date()
                  }
              });

              await prisma.transaction.updateMany({
                  where: { orderId, status: 'PENDING', method: { in: ['GOPAYFAST', 'gopayfast'] } },
                  data: { status: 'FAILED' }
              });
          }

          // GoPayFast expects 200 OK so it doesn't retry
          return reply.send({ received: true });

      } catch (err: any) {
          fastify.log.error(err, '[GoPayFast IPN] Error processing event');
          return reply.code(500).send({ error: 'IPN processing failed' });
      }
  });

}
