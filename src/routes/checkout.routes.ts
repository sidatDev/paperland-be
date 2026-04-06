import { FastifyInstance } from 'fastify';
import { logActivity } from '../utils/audit';
import { emailService } from '../services/email.service';
import { PricingEngine } from '../utils/pricing.engine';

export default async function checkoutRoutes(fastify: FastifyInstance) {

    // GET /checkout/summary
    fastify.get('/checkout/summary', {
        preHandler: [fastify.authenticate],
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    couponCode: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const userId = (request.user as any)?.id;
        const { couponCode } = request.query as any;
        
        // 1. Get Active Cart
        const cart = await fastify.prisma.cart.findFirst({
            where: { userId, status: 'ACTIVE' },
            include: { 
                items: { include: { product: true } }
            }
        });

        if (!cart || cart.items.length === 0) {
            return { items: [], subtotal: 0, currency: 'PKR' };
        }

        // 2. Fetch Default Address
        const user = await fastify.prisma.user.findUnique({
            where: { id: userId },
            include: {
                addresses: { where: { isDefault: true, deletedAt: null }, include: { country: true }, take: 1 }
            }
        });
        const defaultAddress = user?.addresses?.[0] || null;

        // 3. Calculate Subtotal with B2B Pricing
        const pricedItems = await PricingEngine.calculateBulkPrices(
            fastify.prisma as any,
            cart.items.map(item => ({
                productId: item.productId,
                basePrice: Number(item.product.price),
                sku: item.product.sku
            })),
            userId
        );

        const items = pricedItems.map((pricedItem, idx) => ({
            id: cart.items[idx].id,
            productId: pricedItem.productId,
            title: cart.items[idx].product.name,
            price: pricedItem.finalPrice,
            quantity: cart.items[idx].quantity,
            image: cart.items[idx].product.images ? (cart.items[idx].product.images as string[])[0] : null,
            partNumber: pricedItem.sku
        }));

        const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

        // 4. Coupon Validation (NEW)
        let couponDiscount = 0;
        let appliedCoupon = null;

        if (couponCode) {
            const coupon = await (fastify.prisma as any).coupon.findUnique({
                where: { code: (couponCode as string).toUpperCase(), isActive: true, deletedAt: null }
            });

            if (coupon && new Date() >= coupon.startDate && new Date() <= coupon.endDate) {
                if (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit) {
                    if (subtotal >= Number(coupon.minOrderAmount)) {
                        if (coupon.discountType === 'PERCENTAGE') {
                            couponDiscount = subtotal * (Number(coupon.discountValue) / 100);
                            if (coupon.maxDiscountAmount && couponDiscount > Number(coupon.maxDiscountAmount)) {
                                couponDiscount = Number(coupon.maxDiscountAmount);
                            }
                        } else {
                            couponDiscount = Number(coupon.discountValue);
                        }
                        appliedCoupon = {
                            id: coupon.id,
                            code: coupon.code,
                            discount: Number(couponDiscount.toFixed(2))
                        };
                    }
                }
            }
        }

        return {
            items,
            subtotal,
            couponDiscount: Number(couponDiscount.toFixed(2)),
            appliedCoupon,
            total: Number((subtotal - couponDiscount).toFixed(2)),
            currency: 'PKR',
            defaultAddress
        };
    });

    // POST /checkout/init
    // Initializes a checkout session, re-fetches prices, and "locks" the cart
    fastify.post('/checkout/init', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const userId = (request.user as any)?.id;

        // 1. Get Cart
        const cart = await fastify.prisma.cart.findFirst({
            where: { userId, status: 'ACTIVE' },
            include: { items: { include: { product: true } } }
        });

        if (!cart || cart.items.length === 0) {
            return reply.code(400).send({ message: 'Cart is empty' });
        }

        // 2. Re-verify prices with B2B Pricing (Server Authoritative)
        const pricedItems = await PricingEngine.calculateBulkPrices(
            fastify.prisma as any,
            cart.items.map(item => ({
                productId: item.productId,
                basePrice: Number(item.product.price),
                sku: item.product.sku
            })),
            userId
        );

        const items = pricedItems.map((pricedItem, idx) => ({
            id: cart.items[idx].id,
            productId: pricedItem.productId,
            title: cart.items[idx].product.name,
            price: pricedItem.finalPrice,
            quantity: cart.items[idx].quantity,
            image: cart.items[idx].product.images ? (cart.items[idx].product.images as string[])[0] : null,
            sku: pricedItem.sku
        }));

        const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

        // 3. User bound default address
        const user = await fastify.prisma.user.findUnique({
            where: { id: userId },
            include: {
                addresses: { where: { isDefault: true, deletedAt: null }, include: { country: true }, take: 1 }
            }
        });
        const defaultAddress = user?.addresses?.[0] || null;

        // Note: For a true session lock, we could update cart status to 'CHECKOUT'
        // But for simplicity, we return the verified summary.
        return {
            items,
            subtotal,
            currency: 'PKR',
            defaultAddress,
            taxRate: 0.18 // Standard 18% VAT
        };
    });

    // POST /checkout/verify-address
    // Validates address and contact info and creates a DRAFT order record
    fastify.post('/checkout/verify-address', {
        preHandler: [fastify.authenticate],
        schema: {
            body: {
                type: 'object',
                required: ['firstName', 'lastName', 'address', 'city', 'country', 'phone', 'zipCode', 'shippingMethodId'],
                properties: {
                    firstName: { type: 'string', minLength: 2 },
                    lastName: { type: 'string', minLength: 2 },
                    address: { type: 'string', minLength: 5 },
                    city: { type: 'string' },
                    province: { type: 'string' },
                    country: { type: 'string' },
                    phone: { type: 'string', pattern: '^\\+?[0-9\\s-]{7,20}$' }, // Updated pattern for better compatibility
                    zipCode: { type: 'string' },
                    shippingMethodId: { type: 'string' },
                    couponCode: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const userId = (request.user as any)?.id;
        const payload = request.body as any;
        const { firstName, lastName, address, city, country, province, phone, zipCode, shippingMethodId, couponCode } = payload;

        // 1. Get Cart
        const cart = await fastify.prisma.cart.findFirst({
            where: { userId, status: 'ACTIVE' },
            include: { items: { include: { product: true } } }
        });

        if (!cart || cart.items.length === 0) {
            return reply.code(400).send({ message: 'Cart is empty' });
        }

        // 2. Re-calculate EVERYTHING server-side with B2B Pricing
        const pricedItems = await PricingEngine.calculateBulkPrices(
            fastify.prisma as any,
            cart.items.map(item => ({
                productId: item.productId,
                basePrice: Number(item.product.price),
                sku: item.product.sku
            })),
            userId
        );

        const subtotal = pricedItems.reduce((acc, item) => acc + (item.finalPrice * cart.items.find(i => i.productId === item.productId)!.quantity), 0);
        
        // Shipping Logic (Server Authority)
        let shippingCost = 0;
        switch (shippingMethodId) {
            case 'express': shippingCost = 500; break;
            case 'overnight': shippingCost = 1000; break;
            default: shippingCost = (city?.toLowerCase() === 'karachi' ? 150 : 250);
        }

        // 2.5 Coupon Calculation (NEW)
        let couponDiscount = 0;
        let couponId = null;

        if (couponCode) {
            const coupon = await (fastify.prisma as any).coupon.findUnique({
                where: { code: (couponCode as string).toUpperCase(), isActive: true, deletedAt: null }
            });

            if (coupon && new Date() >= coupon.startDate && new Date() <= coupon.endDate) {
                if (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit) {
                    if (subtotal >= Number(coupon.minOrderAmount)) {
                        couponId = coupon.id;
                        if (coupon.discountType === 'PERCENTAGE') {
                            couponDiscount = subtotal * (Number(coupon.discountValue) / 100);
                            if (coupon.maxDiscountAmount && couponDiscount > Number(coupon.maxDiscountAmount)) {
                                couponDiscount = Number(coupon.maxDiscountAmount);
                            }
                        } else {
                            couponDiscount = Number(coupon.discountValue);
                        }
                    }
                }
            }
        }

        const tax = (subtotal - couponDiscount) * 0.15;
        const total = (subtotal - couponDiscount) + shippingCost + tax;

        // 3. Currency (Locked to PKR)
        const currency = await fastify.prisma.currency.findUnique({ where: { code: 'PKR' } });
        if (!currency) return reply.code(500).send({ message: 'System currency (PKR) not found' });

        // 4. Address handling - Prevent duplicates
        const countryRec = await fastify.prisma.country.findFirst({ where: { code: 'PK' } });
        const countryId = countryRec?.id || (await fastify.prisma.country.findFirst())?.id || '';
        
        // Try to find existing non-deleted address for this user with same details
        let addr = await fastify.prisma.address.findFirst({
            where: {
                userId,
                street1: address,
                city,
                zipCode,
                deletedAt: null
            }
        });

        if (addr) {
            // Update the existing address with latest details if needed
            addr = await fastify.prisma.address.update({
                where: { id: addr.id },
                data: {
                    firstName,
                    lastName,
                    state: province,
                    phone,
                    isDefault: true
                }
            });
            
            // Ensure other addresses are not default
            await fastify.prisma.address.updateMany({
                where: { userId, id: { not: addr.id }, isDefault: true },
                data: { isDefault: false }
            });
        } else {
            // Unset current defaults
            await fastify.prisma.address.updateMany({
                where: { userId, isDefault: true },
                data: { isDefault: false }
            });

            addr = await fastify.prisma.address.create({
                data: {
                    userId,
                    type: 'SHIPPING',
                    firstName,
                    lastName,
                    street1: address,
                    city,
                    state: province,
                    zipCode,
                    phone,
                    countryId,
                    isDefault: true
                }
            });
        }

        // 5. Cleanup previous drafts to avoid clutter (Delete items first due to FK constraints)
        const previousDrafts = await fastify.prisma.order.findMany({
            where: { userId, status: 'DRAFT' },
            select: { id: true }
        });
        
        if (previousDrafts.length > 0) {
            const draftIds = previousDrafts.map(d => d.id);
            await fastify.prisma.orderItem.deleteMany({
                where: { orderId: { in: draftIds } }
            });
            await fastify.prisma.order.deleteMany({
                where: { id: { in: draftIds } }
            });
        }

        // 6. Create DRAFT Order
        const order = await fastify.prisma.order.create({
            data: {
                orderNumber: `DRAFT-${Date.now().toString().slice(-6)}`,
                user: { connect: { id: userId } },
                status: 'DRAFT',
                totalAmount: total,      
                taxAmount: tax,          
                shippingAmount: shippingCost, 
                currency: { connect: { id: currency.id } },
                address: { connect: { id: addr.id } }, 
                ...(couponId ? { coupon: { connect: { id: couponId } } } : {}),
                paymentMethod: 'PENDING',

                shippingDetails: {
                    address, city, country, province, zipCode, phone, firstName, lastName, shippingMethodId, couponCode
                },
                shippingSnapshot: {
                    firstName,
                    lastName,
                    fullName: `${firstName} ${lastName}`,
                    streetAddress: address,
                    city,
                    province,
                    country,
                    zipCode,
                    phone
                },
                pricingSummary: { subtotal, shippingCost, tax, couponDiscount, total },
                
                items: {
                    create: pricedItems.map(item => ({
                        product: { connect: { id: item.productId } },
                        quantity: cart.items.find(i => i.productId === item.productId)!.quantity,
                        price: item.finalPrice,
                        sku: item.sku,
                        pricingSnapshot: {
                            basePrice: item.basePrice,
                            finalPrice: item.finalPrice,
                            discountType: item.discountType,
                            tierName: item.tierName
                        }
                    }))
                }
            }
        });

        return { success: true, orderId: order.id, message: 'Checkout draft created' };
    });

    // GET /checkout/draft/:id
    // Retrieves authoritative draft details for the payment page
    fastify.get('/checkout/draft/:id', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const userId = (request.user as any)?.id;
        const { id } = request.params as any;

        const order = await fastify.prisma.order.findUnique({
            where: { id, userId, status: 'DRAFT' },
            include: { 
                items: { 
                    include: { 
                        product: true 
                    } 
                },
                coupon: true
            }
        });

        if (!order) {
            return reply.code(404).send({ message: 'Draft order not found' });
        }

        // Map items to include originalPrice from pricingSnapshot if available
        const mappedItems = order.items.map((item: any) => ({
            id: item.id,
            productId: item.productId,
            title: item.product.name,
            price: item.price,
            originalPrice: item.pricingSnapshot?.basePrice || undefined,
            quantity: item.quantity,
            image: item.product.imageUrl,
            partNumber: item.product.sku,
            pricingSnapshot: item.pricingSnapshot
        }));

        return {
            ...order,
            items: mappedItems
        };
    });

    // PATCH /checkout/draft/:id/apply-coupon
    fastify.patch('/checkout/draft/:id/apply-coupon', {
        preHandler: [fastify.authenticate],
        schema: {
            body: {
                type: 'object',
                required: ['couponCode'],
                properties: {
                    couponCode: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const userId = (request.user as any)?.id;
        const { id } = request.params as any;
        const { couponCode } = request.body as any;

        // 1. Get Draft Order
        const order = await fastify.prisma.order.findUnique({
            where: { id, userId, status: 'DRAFT' },
            include: { items: true }
        });

        if (!order) return reply.code(404).send({ message: 'Draft order not found' });

        // 2. Validate Coupon
        const coupon = await (fastify.prisma as any).coupon.findUnique({
            where: { code: couponCode.toUpperCase(), isActive: true, deletedAt: null }
        });

        if (!coupon || new Date() < coupon.startDate || new Date() > coupon.endDate) {
            return reply.code(400).send({ message: 'Invalid or expired coupon' });
        }

        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            return reply.code(400).send({ message: 'Coupon usage limit reached' });
        }

        if (coupon.usageLimitPerCustomer && userId) {
            const userUsageCount = await (fastify.prisma as any).order.count({
                where: { couponId: coupon.id, userId, deletedAt: null }
            });
            if (userUsageCount >= coupon.usageLimitPerCustomer) {
                return reply.code(400).send({ message: 'You have reached the usage limit for this coupon' });
            }
        }

        // 3. Recalculate
        let pricingSummary = typeof order.pricingSummary === 'string' ? JSON.parse(order.pricingSummary as string) : (order.pricingSummary || {});
        const subtotal = pricingSummary?.subtotal || Number(order.totalAmount);
        
        if (subtotal < Number(coupon.minOrderAmount)) {
            return reply.code(400).send({ message: `Minimum order amount for this coupon is PKR ${coupon.minOrderAmount}` });
        }

        let couponDiscount = 0;
        if (coupon.discountType === 'PERCENTAGE') {
            couponDiscount = subtotal * (Number(coupon.discountValue) / 100);
            if (coupon.maxDiscountAmount !== null && Number(coupon.maxDiscountAmount) > 0 && couponDiscount > Number(coupon.maxDiscountAmount)) {
                couponDiscount = Number(coupon.maxDiscountAmount);
            }
        } else {
            couponDiscount = Number(coupon.discountValue);
        }

        const shippingCost = pricingSummary?.shippingCost || Number(order.shippingAmount) || 0;
        const tax = (subtotal - couponDiscount) * 0.15; // Recalculate tax with discount
        const total = (subtotal - couponDiscount) + shippingCost + tax;

        pricingSummary = {
            ...pricingSummary,
            couponDiscount,
            total
        };

        // 4. Update Draft
        const updatedOrder = await fastify.prisma.order.update({
            where: { id },
            data: {
                totalAmount: total,
                couponId: coupon.id,
                pricingSummary,
                updatedAt: new Date()
            },
            include: { 
                items: { include: { product: true } },
                coupon: true
            }
        });

        const mappedItems = updatedOrder.items.map((item: any) => ({
            id: item.id,
            productId: item.productId,
            title: item.product.name,
            price: item.price,
            originalPrice: item.pricingSnapshot?.basePrice || undefined,
            quantity: item.quantity,
            image: item.product.imageUrl,
            partNumber: item.product.sku,
            pricingSnapshot: item.pricingSnapshot
        }));

        return { ...updatedOrder, items: mappedItems };
    });

    // PATCH /checkout/draft/:id/remove-coupon
    fastify.patch('/checkout/draft/:id/remove-coupon', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const userId = (request.user as any)?.id;
        const { id } = request.params as any;

        const order = await fastify.prisma.order.findUnique({
            where: { id, userId, status: 'DRAFT' }
        });

        if (!order) return reply.code(404).send({ message: 'Draft order not found' });

        if (!order.couponId) return reply.send({ message: 'No coupon applied to this order' });

        let pricingSummary = order.pricingSummary as any;
        const subtotal = pricingSummary?.subtotal || Number(order.totalAmount);
        const shippingCost = pricingSummary?.shippingCost || Number(order.shippingAmount) || 0;
        const tax = subtotal * 0.15; // Restored tax without discount
        const total = subtotal + shippingCost + tax;

        pricingSummary = {
            ...pricingSummary,
            couponDiscount: 0,
            total
        };

        const updatedOrder = await fastify.prisma.order.update({
            where: { id },
            data: {
                totalAmount: total,
                coupon: { disconnect: true },
                pricingSummary,
                updatedAt: new Date()
            },
            include: { 
                items: { include: { product: true } },
                coupon: true
            }
        });

        const mappedItems = updatedOrder.items.map((item: any) => ({
            id: item.id,
            productId: item.productId,
            title: item.product.name,
            price: item.price,
            originalPrice: item.pricingSnapshot?.basePrice || undefined,
            quantity: item.quantity,
            image: item.product.imageUrl,
            partNumber: item.product.sku,
            pricingSnapshot: item.pricingSnapshot
        }));

        return { ...updatedOrder, items: mappedItems };
    });

    // POST /checkout/validate-shipping
    fastify.post('/checkout/validate-shipping', {
        preHandler: [fastify.authenticate],
        schema: {
            body: {
                type: 'object',
                required: ['country', 'city'],
                properties: {
                    country: { type: 'string' },
                    city: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const { country, city } = request.body as any;
        
        // Server-side calculation
        let standardCost = 250; 
        if (city?.toLowerCase() === 'karachi') standardCost = 150;
        
        return {
            methods: [
                { id: 'standard', title: 'Standard Shipping', cost: standardCost, duration: '2-4 business days' },
                { id: 'express', title: 'Express Shipping', cost: 500, duration: '1-2 business days' },
                { id: 'overnight', title: 'Overnight Shipping', cost: 1000, duration: 'Next day' }
            ]
        };
    });

    // GET /checkout/payment-gateways
    fastify.get('/checkout/payment-gateways', async (request, reply) => {
        const gateways = await (fastify.prisma as any).paymentGateway.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            select: {
                id: true,
                name: true,
                identifier: true,
                type: true,
                instructions: true,
                feePercentage: true,
                feeFixed: true
            }
        });
        
        const settings = await (fastify.prisma as any).globalSettings.findFirst();
        
        const mappedGateways = gateways.map((g: any) => {
            let inst = g.instructions || "";
            if (g.identifier === 'bank_transfer' && settings) {
                inst = inst.replace('{bankAccountName}', settings.bankAccountName || '')
                           .replace('{bankAccountNumber}', settings.bankAccountNumber || '')
                           .replace('{bankName}', settings.bankName || '')
                           .replace('{bankIban}', settings.bankIban || '')
                           .replace('{bankSwiftCode}', settings.bankSwiftCode || '');
            }
            return { ...g, instructions: inst };
        });

        return mappedGateways;
    });

    // POST /checkout/submit
    fastify.post('/checkout/submit', {
        preHandler: [fastify.authenticate]
    }, async (request, reply) => {
        const userId = (request.user as any)?.id;
        const payload = request.body as any;
        const { orderId, paymentMethod, paymentMetadata } = payload;

        if (!orderId) {
            return reply.code(400).send({ message: 'Order ID is required' });
        }

        // 1. Find Draft Order
        const order = await fastify.prisma.order.findUnique({
            where: { id: orderId, userId, status: 'DRAFT' },
            include: { items: true }
        });

        if (!order) {
            return reply.code(400).send({ message: 'Draft order not found or already processed' });
        }

        // 2. Finalize Order (Move from DRAFT to PENDING)
        const finalOrder = await fastify.prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'PENDING',
                orderNumber: `ORD-${Date.now().toString().slice(-6)}`, // Assign real order number
                paymentMethod: paymentMethod || 'COD',
                paymentDetails: paymentMetadata || {},
                paymentStatus: 'UNPAID', // Default for these methods until verified
                updatedAt: new Date()
            }
        });

        // Update Coupon Usage Tracking
        if (order.couponId) {
            try {
                const pricing = typeof order.pricingSummary === 'string' ? JSON.parse(order.pricingSummary as string) : (order.pricingSummary || {});
                const discount = Number(pricing.couponDiscount || 0);
                
                await (fastify.prisma as any).coupon.update({
                    where: { id: order.couponId },
                    data: {
                        usedCount: { increment: 1 },
                        totalDiscountGiven: { increment: discount }
                    }
                });
            } catch (couponErr) {
                fastify.log.error(couponErr, 'Failed to update coupon usage on checkout submit');
                // We DON'T fail the order if coupon stats update fails
            }
        }

        // 3. Create Transaction Record
        await (fastify.prisma as any).transaction.create({
            data: {
                orderId: finalOrder.id,
                userId: userId,
                amount: finalOrder.totalAmount,
                status: 'PENDING',
                type: 'PAYMENT',
                method: paymentMethod || 'COD',
                currencyId: finalOrder.currencyId,
                metadata: paymentMetadata || {}
            }
        });

        // 3. Clear Cart (Only on successful submission)
        const cart = await fastify.prisma.cart.findFirst({ where: { userId, status: 'ACTIVE' } });
        if (cart) {
            await fastify.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
        }
        
        // Reserve Stock for the ordered items
        for (const item of order.items) {
            const stock = await (fastify.prisma as any).stock.findFirst({ 
                where: { 
                    productId: item.productId,
                    qty: { gte: Number(item.quantity) }
                },
                orderBy: { qty: 'desc' }
            });
            
            const targetStock = stock || await (fastify.prisma as any).stock.findFirst({
                where: { productId: item.productId },
                orderBy: { qty: 'desc' }
            });

            if (targetStock) {
                await (fastify.prisma as any).stock.update({
                    where: { id: targetStock.id },
                    data: { reservedQty: { increment: Number(item.quantity) } }
                });
            }
        }

        // Invalidate Cache
        try {
            await (fastify.cache as any).del('shop:home');
            await (fastify.cache as any).clearPattern('shop:products:*');
            for (const item of order.items) {
                if (item.productId) {
                    const p = await (fastify.prisma as any).product.findUnique({ where: { id: item.productId }, select: { slug: true } });
                    if (p) {
                        await (fastify.cache as any).del(`product:${item.productId}`);
                        if (p.slug) await (fastify.cache as any).del(`product:${p.slug}`);
                    }
                }
            }
        } catch (cacheErr) {
            fastify.log.error(cacheErr, 'Failed to invalidate cache on checkout submit');
        }
        
        // 4. Audit Log
        await logActivity(fastify, {
            entityType: 'ORDER',
            entityId: finalOrder.id,
            action: 'CONFIRM_ORDER',
            performedBy: userId,
            details: { total: Number(finalOrder.totalAmount), method: paymentMethod },
            ip: request.ip,
            userAgent: request.headers['user-agent']
        });

        // 5. Send Order Confirmation Email
        try {
            const fullOrder = await fastify.prisma.order.findUnique({
                where: { id: finalOrder.id },
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
                await emailService.sendOrderConfirmationEmail(fullOrder.user.email, fullOrder);
            }
        } catch (emailErr) {
            fastify.log.error(emailErr, 'Failed to send order confirmation email');
        }

        return { 
            orderId: finalOrder.id, 
            orderNumber: finalOrder.orderNumber,
            total: finalOrder.totalAmount,
            message: 'Order placed successfully' 
        };
    });
}
