import { FastifyInstance } from 'fastify';
import { logActivity } from '../utils/audit';
import { emailService } from '../services/email.service';
import { PricingEngine } from '../utils/pricing.engine';
import { LogisticsEngine } from '../services/logistics-engine.service';
import { PromotionService } from '../services/promotion.service';
import { generateOrderNumber } from '../utils/order-utils';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createErrorResponse } from '../utils/response-wrapper';

/**
 * Guest Checkout Routes
 * Handles checkout flow for non-authenticated users
 */
export default async function guestCheckoutRoutes(fastify: FastifyInstance) {

    /**
     * Helper: Create or find hidden user account for guest
     * Creates a temporary user account linked to guest email/phone
     */
    const getOrCreateGuestUser = async (email: string, phone: string, firstName: string, lastName: string) => {
        // Try to find existing user by email
        let user = await fastify.prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (!user) {
            // Create hidden guest user account
            const randomPassword = crypto.randomBytes(16).toString('hex');
            const passwordHash = await bcrypt.hash(randomPassword, 10);
            
            // Get default CUSTOMER role
            const customerRole = await fastify.prisma.role.findFirst({
                where: { name: 'CUSTOMER' }
            });
            
            if (!customerRole) {
                throw new Error('Customer role not found');
            }

            user = await fastify.prisma.user.create({
                data: {
                    email: email.toLowerCase(),
                    passwordHash,
                    firstName,
                    lastName,
                    phoneNumber: phone,
                    roleId: customerRole.id,
                    isActive: true,
                    accountStatus: 'ACTIVE',
                    // Mark as guest account - can be upgraded later
                    preferences: { isGuestAccount: true, autoCreated: true }
                }
            });
        }

        return user;
    };

    /**
     * Helper: Get cart by guest token
     */
    const getGuestCart = async (guestToken: string) => {
        return await fastify.prisma.cart.findFirst({
            where: { 
                guestToken,
                status: 'ACTIVE'
            },
            include: { 
                items: { 
                    include: { 
                        product: {
                            include: { prices: { where: { isActive: true }, include: { currency: true } } }
                        } 
                    } 
                } 
            }
        });
    };

    const formatGuestOrder = (order: any) => {
        if (!order) return null;
        const items = (order.items || []).map((item: any) => {
            const pkr = item.product?.prices?.find((pr: any) => pr.currency?.code === 'PKR');
            return {
                id: item.id,
                productId: item.productId,
                title: item.product?.name || 'Unknown Product',
                price: Number(item.price || pkr?.priceRetail || item.product?.price || 0),
                quantity: item.quantity,
                image: item.product?.imageUrl || (item.product?.images ? (item.product.images as string[])[0] : null),
                sku: item.product?.sku || item.sku,
                partNumber: item.product?.sku || item.sku
            };
        });

        return {
            ...order,
            items
        };
    };

    /**
     * Helper: Validate guest coupon
     */
    const validateGuestCoupon = async (couponCode: string, subtotal: number, items: any[]) => {
        if (!couponCode) return { valid: false, couponDiscount: 0, couponId: null };

        const coupon = await (fastify.prisma as any).coupon.findUnique({
            where: { code: couponCode.toUpperCase(), isActive: true, deletedAt: null },
            include: { products: true, categories: true }
        });

        if (!coupon) return { valid: false, couponDiscount: 0, couponId: null };

        const now = new Date();
        if (now < coupon.startDate || now > coupon.endDate) {
            return { valid: false, couponDiscount: 0, couponId: null, error: 'Coupon expired' };
        }

        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            return { valid: false, couponDiscount: 0, couponId: null, error: 'Coupon usage limit reached' };
        }

        // Check customer type eligibility
        if (coupon.customerType === 'B2B_ONLY') {
            return { valid: false, couponDiscount: 0, couponId: null, error: 'Coupon not available for guest users' };
        }
        
        // If coupon is specifically for registered members only (we don't have this enum yet, but good to think about)
        // For now: ALL, NEW_CUSTOMERS, and GUEST are valid for guest checkout
        if (coupon.customerType !== 'ALL' && coupon.customerType !== 'NEW_CUSTOMERS' && coupon.customerType !== 'GUEST') {
             return { valid: false, couponDiscount: 0, couponId: null, error: 'Coupon not valid for guest checkout' };
        }

        // Calculate eligible items
        let eligibleSubtotal = 0;
        items.forEach((item: any) => {
            let isEligible = false;
            if (coupon.applicationType === 'ALL') {
                isEligible = true;
            } else if (coupon.applicationType === 'SPECIFIC_PRODUCTS') {
                isEligible = coupon.products.some((p: any) => p.productId === item.productId);
            } else if (coupon.applicationType === 'SPECIFIC_CATEGORIES') {
                isEligible = item.product?.categoryId ? 
                    coupon.categories.some((c: any) => c.categoryId === item.product.categoryId) : false;
            }

            if (isEligible) {
                const pkr = item.product.prices?.find((pr: any) => pr.currency?.code === 'PKR');
                const price = pkr ? Number(pkr.priceRetail) : Number(item.price || item.product.price || 0);
                eligibleSubtotal += (price * item.quantity);
            }
        });

        if (eligibleSubtotal < Number(coupon.minOrderAmount || 0)) {
            return { 
                valid: false, 
                couponDiscount: 0, 
                couponId: null, 
                error: `Minimum order amount for this coupon is PKR ${coupon.minOrderAmount}` 
            };
        }

        let couponDiscount = 0;
        const discountVal = Number(coupon.discountValue || 0);
        const maxDiscount = Number(coupon.maxDiscountAmount || 0);

        if (coupon.discountType === 'PERCENTAGE') {
            couponDiscount = eligibleSubtotal * (discountVal / 100);
            if (maxDiscount > 0 && couponDiscount > maxDiscount) {
                couponDiscount = maxDiscount;
            }
        } else {
            couponDiscount = Math.min(discountVal, eligibleSubtotal);
        }

        return { 
            valid: true, 
            couponDiscount, 
            couponId: coupon.id,
            couponCode: coupon.code
        };
    };

    // POST /guest-checkout/init
    // Initialize guest checkout session
    fastify.post('/guest-checkout/init', {
        schema: {
            description: 'Initialize guest checkout session',
            tags: ['Guest Checkout'],
            body: {
                type: 'object',
                required: ['guestToken'],
                properties: {
                    guestToken: { type: 'string' },
                    couponCode: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { guestToken, couponCode } = request.body as any;

            // 1. Get Guest Cart
            const cart = await getGuestCart(guestToken);

            if (!cart || cart.items.length === 0) {
                return reply.code(400).send({ message: 'Cart is empty' });
            }

            // 2. Calculate prices with PricingEngine (Authoritative)
            const pricedItems = await PricingEngine.calculateBulkPrices(
                fastify.prisma as any,
                cart.items.map(item => ({
                    productId: item.productId,
                    basePrice: Number(item.product.price),
                    sku: item.product.sku,
                    quantity: item.quantity
                }))
            );

            const items = pricedItems.map((pi, idx) => ({
                id: cart.items[idx].id,
                productId: pi.productId,
                title: cart.items[idx].product.name,
                price: pi.finalPrice,
                quantity: cart.items[idx].quantity,
                image: cart.items[idx].product.imageUrl,
                sku: pi.sku
            }));

            const subtotal = items.reduce((acc: number, item: any) => 
                acc + (item.price * item.quantity), 0);

            // 3. Validate coupon if provided
            let couponResult: any = { valid: false, couponDiscount: 0, couponId: null };
            if (couponCode) {
                couponResult = await validateGuestCoupon(couponCode, subtotal, cart.items);
            }

            return {
                items,
                subtotal,
                currency: 'PKR',
                taxRate: 0.15,
                couponDiscount: couponResult.couponDiscount || 0,
                appliedCoupon: couponResult.valid ? {
                    code: couponResult.couponCode as string,
                    discount: couponResult.couponDiscount
                } : null
            };
        } catch (err: any) {
            fastify.log.error(err);
            return reply.code(500).send({ message: 'Failed to initialize guest checkout' });
        }
    });

    // POST /guest-checkout/verify-address
    // Validates address and creates DRAFT order for guest
    fastify.post('/guest-checkout/verify-address', {
        schema: {
            description: 'Verify guest address and create draft order',
            tags: ['Guest Checkout'],
            body: {
                type: 'object',
                required: ['guestToken', 'firstName', 'lastName', 'address', 'city', 'country', 'phone', 'zipCode', 'shippingMethodId', 'email'],
                properties: {
                    guestToken: { type: 'string' },
                    firstName: { type: 'string', minLength: 2 },
                    lastName: { type: 'string', minLength: 2 },
                    email: { type: 'string', format: 'email' },
                    address: { type: 'string', minLength: 5 },
                    city: { type: 'string' },
                    province: { type: 'string' },
                    country: { type: 'string' },
                    phone: { type: 'string', pattern: '^\\+?[0-9\\s-]{7,20}$' },
                    zipCode: { type: 'string' },
                    companyName: { type: 'string' },
                    shippingMethodId: { type: 'string' },
                    couponCode: { type: 'string' },
                    billingSameAsShipping: { type: 'boolean' },
                    billingFirstName: { type: 'string' },
                    billingLastName: { type: 'string' },
                    billingCompanyName: { type: 'string' },
                    billingStreetAddress: { type: 'string' },
                    billingCity: { type: 'string' },
                    billingProvince: { type: 'string' },
                    billingZip: { type: 'string' },
                    billingCountry: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const payload = request.body as any;
            const { 
                guestToken, firstName, lastName, email, 
                address, city, country, province, phone, zipCode, 
                companyName, shippingMethodId, couponCode 
            } = payload;

            // 1. Get Guest Cart
            const cart = await getGuestCart(guestToken);

            if (!cart || cart.items.length === 0) {
                return reply.code(400).send({ message: 'Cart is empty' });
            }

            // 2. Create or get hidden user account
            const guestUser = await getOrCreateGuestUser(email, phone, firstName, lastName);

            // 3. Calculate prices with PricingEngine
            const pricedItems = await PricingEngine.calculateBulkPrices(
                fastify.prisma as any,
                cart.items.map(item => ({
                    productId: item.productId,
                    basePrice: Number(item.product.price),
                    sku: item.product.sku,
                    quantity: item.quantity
                }))
            );

            const items = pricedItems.map((pi, idx) => ({
                id: cart.items[idx].id,
                productId: pi.productId,
                title: cart.items[idx].product.name,
                price: pi.finalPrice,
                quantity: cart.items[idx].quantity,
                image: cart.items[idx].product.imageUrl,
                sku: pi.sku,
                pricingSnapshot: {
                    basePrice: pi.basePrice,
                    finalPrice: pi.finalPrice,
                    discountType: pi.discountType,
                    promotionId: pi.promotionId
                }
            }));

            const subtotal = items.reduce((acc: number, item: any) => 
                acc + (item.price * item.quantity), 0);

            // 4. Shipping calculation
            let shippingCost = 0;
            switch (shippingMethodId) {
                case 'express': shippingCost = 500; break;
                case 'overnight': shippingCost = 1000; break;
                default: shippingCost = 250;
            }

            // 5. Coupon validation
            let couponDiscount = 0;
            let couponId = null;
            let finalCouponCode = null;

            if (couponCode) {
                const couponResult = await validateGuestCoupon(couponCode, subtotal, cart.items);
                if (couponResult.valid) {
                    couponDiscount = couponResult.couponDiscount;
                    couponId = couponResult.couponId;
                    finalCouponCode = couponResult.couponCode;
                }
            }

            const campaignSavings = pricedItems.reduce((acc, item) => {
                const cartItem = cart.items.find(i => i.productId === item.productId);
                const qty = cartItem?.quantity || 0;
                return acc + ((item.basePrice - item.finalPrice) * qty);
            }, 0);

            const tax = (subtotal - couponDiscount) * 0.15;
            const total = (subtotal - couponDiscount) + shippingCost + tax;

            // 6. Get currency
            const currency = await fastify.prisma.currency.findUnique({ where: { code: 'PKR' } });
            if (!currency) return reply.code(500).send({ message: 'System currency (PKR) not found' });

            // 7. Get country
            const countryRec = await fastify.prisma.country.findFirst({ where: { code: 'PK' } });
            const countryId = countryRec?.id || (await fastify.prisma.country.findFirst())?.id || '';

            // 8. Create guest address (not linked to user for privacy, but stored)
            const guestAddress = await (fastify.prisma as any).address.create({
                data: {
                    type: 'SHIPPING',
                    firstName,
                    lastName,
                    street1: address,
                    city,
                    state: province,
                    zipCode,
                    phone,
                    countryId,
                    isDefault: false
                }
            });

            // 9. Cleanup previous guest drafts
            const previousDrafts = await (fastify.prisma as any).order.findMany({
                where: { 
                    guestToken, 
                    status: 'DRAFT',
                    isGuestOrder: true
                },
                select: { id: true }
            });

            if (previousDrafts.length > 0) {
                const draftIds = previousDrafts.map((d: any) => d.id);
                await (fastify.prisma as any).orderItem.deleteMany({
                    where: { orderId: { in: draftIds } }
                });
                await (fastify.prisma as any).order.deleteMany({
                    where: { id: { in: draftIds } }
                });
            }

            // 9.5 Fetch Product details to get cost prices
            const productIds = items.map((i: any) => i.productId);
            const products = await fastify.prisma.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, costPrice: true }
            });

            const totalCost = items.reduce((sum: number, item: any) => {
                const product = products.find((p: any) => p.id === item.productId);
                return sum + (Number(item.quantity) * Number(product?.costPrice || 0));
            }, 0);

            // 10. Create DRAFT Order for guest
            const order = await (fastify.prisma as any).order.create({
                data: {
                    orderNumber: `DRAFT-${Date.now().toString().slice(-6)}`,
                    ...(guestUser?.id ? { user: { connect: { id: guestUser.id } } } : {}), // Link to hidden guest user via Prisma relations
                    status: 'DRAFT',
                    totalAmount: total,
                    totalCost: totalCost,
                    taxAmount: tax,
                    shippingAmount: shippingCost,
                    currency: { connect: { id: currency.id } },
                    address: { connect: { id: guestAddress.id } },
                    ...(couponId ? { coupon: { connect: { id: couponId } } } : {}),
                    paymentMethod: 'PENDING',
                    
                    // Guest-specific fields
                    isGuestOrder: true,
                    guestToken,
                    guestEmail: email,
                    guestPhone: phone,

                    shippingDetails: {
                        address, city, country, province, zipCode, phone, 
                        firstName, lastName, companyName, shippingMethodId, 
                        couponCode: finalCouponCode,
                        email,
                        billingSameAsShipping: payload.billingSameAsShipping,
                        billingFirstName: payload.billingFirstName,
                        billingLastName: payload.billingLastName,
                        billingCompanyName: payload.billingCompanyName,
                        billingStreetAddress: payload.billingStreetAddress,
                        billingCity: payload.billingCity,
                        billingProvince: payload.billingProvince,
                        billingZip: payload.billingZip,
                        billingCountry: payload.billingCountry
                    },
                    shippingSnapshot: {
                        firstName,
                        lastName,
                        fullName: `${firstName} ${lastName}`,
                        companyName,
                        streetAddress: address,
                        city,
                        province,
                        country,
                        zipCode,
                        phone,
                        email
                    },
                    billingSnapshot: payload.billingSameAsShipping ? {
                        firstName,
                        lastName,
                        fullName: `${firstName} ${lastName}`,
                        companyName,
                        streetAddress: address,
                        city,
                        province,
                        country,
                        zipCode,
                        phone,
                        email
                    } : {
                        firstName: payload.billingFirstName,
                        lastName: payload.billingLastName,
                        fullName: `${payload.billingFirstName} ${payload.billingLastName}`,
                        companyName: payload.billingCompanyName,
                        streetAddress: payload.billingStreetAddress,
                        city: payload.billingCity,
                        province: payload.billingProvince,
                        country: payload.billingCountry,
                        zipCode: payload.billingZip,
                        phone: phone, // Using same phone for billing
                        email: email
                    },
                    pricingSummary: { subtotal, originalSubtotal: subtotal + campaignSavings, campaignSavings, shippingCost, tax, couponDiscount, total },

                    items: {
                        create: items.map((item: any) => {
                            const product = products.find((p: any) => p.id === item.productId);
                            return {
                                product: { connect: { id: item.productId } },
                                quantity: item.quantity,
                                price: item.price,
                                unitCost: product?.costPrice || 0,
                                sku: item.sku,
                                pricingSnapshot: item.pricingSnapshot
                            };
                        })
                    }
                } as any
            });

            return { 
                success: true, 
                orderId: order.id, 
                message: 'Guest checkout draft created',
                isGuestOrder: true
            };

        } catch (err: any) {
            fastify.log.error(err);
            return reply.code(500).send({ 
                message: err.message || 'Failed to verify guest address' 
            });
        }
    });

    // GET /guest-checkout/draft/:id
    // Get guest draft order details
    fastify.get('/guest-checkout/draft/:id', {
        schema: {
            description: 'Get guest draft order details',
            tags: ['Guest Checkout'],
            querystring: {
                type: 'object',
                required: ['guestToken'],
                properties: {
                    guestToken: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { id } = request.params as any;
            const { guestToken } = request.query as any;

            const order = await (fastify.prisma as any).order.findFirst({
                where: { 
                    id, 
                    guestToken, 
                    status: 'DRAFT',
                    isGuestOrder: true
                },
                include: { 
                    items: { 
                        include: { 
                            product: {
                                include: { prices: { where: { isActive: true }, include: { currency: true } } }
                            } 
                        } 
                    },
                    coupon: true
                }
            });

            if (!order) {
                return reply.code(404).send({ message: 'Draft order not found' });
            }

            return formatGuestOrder(order);
        } catch (err: any) {
            fastify.log.error(err);
            return reply.code(500).send({ message: 'Failed to load draft order' });
        }
    });

    // PATCH /guest-checkout/draft/:id/apply-coupon
    fastify.patch('/guest-checkout/draft/:id/apply-coupon', {
        schema: {
            description: 'Apply coupon to guest draft order',
            tags: ['Guest Checkout'],
            querystring: {
                type: 'object',
                required: ['guestToken'],
                properties: {
                    guestToken: { type: 'string' }
                }
            },
            body: {
                type: 'object',
                required: ['couponCode'],
                properties: {
                    couponCode: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { id } = request.params as any;
            const { guestToken } = request.query as any;
            const { couponCode } = request.body as any;

            const order = await (fastify.prisma as any).order.findFirst({
                where: { id, guestToken, status: 'DRAFT', isGuestOrder: true },
                include: { 
                    items: { 
                        include: { 
                            product: {
                                include: { prices: { where: { isActive: true }, include: { currency: true } } }
                            } 
                        } 
                    } 
                }
            });

            if (!order) return reply.code(404).send({ message: 'Draft order not found' });

            // Calculate subtotal - Robust fallback to product price if item.price is 0
            const subtotal = (order as any).items.reduce((acc: number, item: any) => {
                const pkr = item.product.prices?.find((pr: any) => pr.currency?.code === 'PKR');
                const priceValue = Number(item.price || pkr?.priceRetail || item.product.price || 0);
                return acc + (priceValue * item.quantity);
            }, 0);

            // Validate coupon for guest
            const couponResult = await validateGuestCoupon(couponCode, subtotal, (order as any).items);
            
            if (!couponResult.valid) {
                return reply.code(400).send({ 
                    message: couponResult.error || 'Invalid coupon code' 
                });
            }

            // Update order with coupon
            const pricingSummary: any = typeof order.pricingSummary === 'string' 
                ? JSON.parse(order.pricingSummary as string) 
                : (order.pricingSummary || {});

            const shippingCost = pricingSummary?.shippingCost || Number(order.shippingAmount) || 0;
            const couponDiscount = couponResult.couponDiscount;
            const tax = Math.max(0, (subtotal - couponDiscount) * 0.15);
            const total = Math.max(0, (subtotal - couponDiscount) + shippingCost + tax);

            const updatedPricingSummary = {
                ...pricingSummary,
                subtotal,
                couponDiscount,
                tax,
                total
            };

            const updatedOrder = await fastify.prisma.order.update({
                where: { id },
                data: {
                    totalAmount: total,
                    couponId: couponResult.couponId,
                    pricingSummary: updatedPricingSummary,
                    updatedAt: new Date()
                },
                include: { 
                    items: { 
                        include: { 
                            product: {
                                include: { prices: { where: { isActive: true }, include: { currency: true } } }
                            } 
                        } 
                    },
                    coupon: true
                }
            });

            return {
                ...formatGuestOrder(updatedOrder),
                pricingSummary: updatedPricingSummary,
                couponDiscount
            };

        } catch (err: any) {
            fastify.log.error(err);
            return reply.code(500).send({ message: 'Failed to apply coupon' });
        }
    });

    // PATCH /guest-checkout/draft/:id/remove-coupon
    fastify.patch('/guest-checkout/draft/:id/remove-coupon', {
        schema: {
            description: 'Remove coupon from guest draft order',
            tags: ['Guest Checkout'],
            querystring: {
                type: 'object',
                required: ['guestToken'],
                properties: {
                    guestToken: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { id } = request.params as any;
            const { guestToken } = request.query as any;

            const order = await (fastify.prisma as any).order.findFirst({
                where: { id, guestToken, status: 'DRAFT', isGuestOrder: true },
                include: { 
                    items: { 
                        include: { 
                            product: {
                                include: { prices: { where: { isActive: true }, include: { currency: true } } }
                            } 
                        } 
                    } 
                }
            });

            if (!order) return reply.code(404).send({ message: 'Draft order not found' });
            if (!order.couponId) return reply.send({ message: 'No coupon applied' });

            let pricingSummary: any = typeof order.pricingSummary === 'string' 
                ? JSON.parse(order.pricingSummary as string) 
                : (order.pricingSummary || {});

            const subtotal = pricingSummary?.subtotal || 
                (order as any).items.reduce((acc: number, item: any) => 
                    acc + (Number(item.price) * item.quantity), 0);
            
            const shippingCost = pricingSummary?.shippingCost || Number(order.shippingAmount) || 0;
            const tax = subtotal * 0.15;
            const total = subtotal + shippingCost + tax;

            pricingSummary = {
                ...pricingSummary,
                couponDiscount: 0,
                tax,
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
                    items: { 
                        include: { 
                            product: {
                                include: { prices: { where: { isActive: true }, include: { currency: true } } }
                            } 
                        } 
                    },
                    coupon: true
                }
            });

            return { 
                ...formatGuestOrder(updatedOrder), 
                pricingSummary,
                message: 'Coupon removed successfully' 
            };

        } catch (err: any) {
            fastify.log.error(err);
            return reply.code(500).send({ message: 'Failed to remove coupon' });
        }
    });

    // POST /guest-checkout/submit
    // Finalize guest order
    fastify.post('/guest-checkout/submit', {
        schema: {
            description: 'Submit guest order',
            tags: ['Guest Checkout'],
            body: {
                type: 'object',
                required: ['orderId', 'guestToken'],
                properties: {
                    orderId: { type: 'string' },
                    guestToken: { type: 'string' },
                    paymentMethod: { type: 'string' },
                    paymentMetadata: { type: 'object' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { orderId, guestToken, paymentMethod, paymentMetadata } = request.body as any;

            // Find draft order (Idempotency check)
            const order = await (fastify.prisma as any).order.findFirst({
                where: { id: orderId, guestToken, isGuestOrder: true },
                include: { items: { include: { product: true } } }
            }) as any;

            if (!order) {
                return reply.code(404).send({ message: 'Order not found' });
            }

            if (order.status !== 'DRAFT') {
                return {
                    success: true,
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    message: 'Order already processed',
                    isGuestOrder: true
                };
            }

            // Stripe: Verify PaymentIntent server-side before accepting
            let stripeVerifiedIntentId: string | null = null;
            if (paymentMethod === 'STRIPE') {
                const stripePaymentIntentId = paymentMetadata?.stripePaymentIntentId;
                if (!stripePaymentIntentId) {
                    return reply.code(400).send({ message: 'Stripe PaymentIntent ID is required' });
                }
                const stripeGw = await (fastify.prisma as any).paymentGateway.findFirst({
                    where: { identifier: 'stripe', isActive: true }
                });
                if (!stripeGw) {
                    return reply.code(400).send({ message: 'Stripe gateway is not active' });
                }
                const stripeCfg = (stripeGw.config as any) || {};
                const secretKey: string = stripeCfg.secretKey || '';
                if (!secretKey || secretKey.includes('*')) {
                    return reply.code(500).send({ message: 'Stripe is not properly configured' });
                }
                try {
                    const { retrievePaymentIntent } = await import('../services/stripe.service');
                    const intent = await retrievePaymentIntent(secretKey, stripePaymentIntentId);
                    if (intent.status !== 'succeeded') {
                        return reply.code(400).send({ message: `Payment not completed. Stripe status: ${intent.status}` });
                    }
                    if (intent.metadata?.orderId && intent.metadata.orderId !== orderId) {
                        return reply.code(400).send({ message: 'Payment does not match this order' });
                    }
                    stripeVerifiedIntentId = intent.id;
                    fastify.log.info(`[Stripe/Guest] Verified PaymentIntent ${intent.id} for order ${orderId}`);
                } catch (stripeErr: any) {
                    fastify.log.error(stripeErr, '[Stripe/Guest] PaymentIntent verification failed');
                    return reply.code(400).send({ message: 'Failed to verify Stripe payment: ' + stripeErr.message });
                }
            }

            // Finalize order within Transaction for atomicity
            const finalOrder = await (fastify.prisma as any).$transaction(async (tx: any) => {
                // Atomic Stock Reservation and Promotion Usage Check
                for (const item of order.items) {
                    // Increment Promotion Usage if applicable
                    if (item.pricingSnapshot && (item.pricingSnapshot as any).promotionId) {
                        const success = await PromotionService.incrementPromotionUsage(tx, (item.pricingSnapshot as any).promotionId, Number(item.quantity));
                        if (!success) {
                            throw new Error(`Promotion limit reached for item: ${item.product?.name || item.productId}`);
                        }
                    }

                    // Atomic Stock check and reservation
                    const stock = await tx.stock.findFirst({
                       where: { productId: item.productId },
                       orderBy: { qty: 'desc' }
                    });

                    if (!stock || (stock.qty - stock.reservedQty) < Number(item.quantity)) {
                        throw new Error(`Insufficient stock for item: ${item.product?.name || item.productId}`);
                    }

                    await tx.stock.update({
                        where: { id: stock.id },
                        data: { reservedQty: { increment: Number(item.quantity) } }
                    });
                }

                return await tx.order.update({
                    where: { id: orderId },
                    data: {
                        status: 'PENDING',
                        orderNumber: generateOrderNumber(),
                        paymentMethod: paymentMethod || 'COD',
                        paymentDetails: {
                            ...(paymentMetadata || {}),
                            ...(stripeVerifiedIntentId ? { stripePaymentIntentId: stripeVerifiedIntentId } : {})
                        },
                        paymentStatus: stripeVerifiedIntentId ? 'PAID' : (paymentMethod === 'BANK_TRANSFER' ? 'AWAITING_CONFIRMATION' : 'UNPAID'),
                        ...(stripeVerifiedIntentId ? { transactionRef: stripeVerifiedIntentId } : {}),
                        updatedAt: new Date()
                    }
                });
            });

            // Update coupon usage
            if (order.couponId) {
                try {
                    const pricing = typeof order.pricingSummary === 'string' 
                        ? JSON.parse(order.pricingSummary as string) 
                        : (order.pricingSummary || {});
                    const discount = Number(pricing.couponDiscount || 0);

                    await (fastify.prisma as any).coupon.update({
                        where: { id: order.couponId },
                        data: {
                            usedCount: { increment: 1 },
                            totalDiscountGiven: { increment: discount }
                        }
                    });
                } catch (couponErr) {
                    fastify.log.error(couponErr, 'Failed to update coupon usage');
                }
            }

            // Create transaction record
            await (fastify.prisma as any).transaction.create({
                data: {
                    orderId: finalOrder.id,
                    userId: order.userId, // Link to hidden guest user
                    amount: finalOrder.totalAmount,
                    status: 'PENDING',
                    type: 'PAYMENT',
                    method: paymentMethod || 'COD',
                    currencyId: finalOrder.currencyId,
                    metadata: paymentMetadata || {}
                }
            });

            // Clear guest cart
            const cart = await fastify.prisma.cart.findFirst({ 
                where: { guestToken: order.guestToken, status: 'ACTIVE' } 
            });
            if (cart) {
                await fastify.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
            }

            // Auto-Assign Logistics
            try {
                await LogisticsEngine.autoAssignLogistics(finalOrder.id, fastify.prisma as any);
            } catch (logErr) {
                fastify.log.error(logErr, 'Logistics assignment failed');
            }

            // Invalidate Promotion Caches (Crucial for high traffic stability)
            try {
                const segments = ['ALL', 'B2B', 'RETAIL', 'GUEST'];
                for (const segment of segments) {
                    await (fastify as any).cache.del(`shop:promotions:storefront:v3:${segment}`);
                }
            } catch (cacheErr) {
                fastify.log.error(cacheErr, 'Cache invalidation failed');
            }

            // Sync product status label with inventory
            for (const item of order.items) {
                try {
                    const { syncProductStockStatus } = require('../utils/product-status-sync');
                    await syncProductStockStatus(fastify.prisma, item.productId);
                } catch (syncErr) {
                    fastify.log.error(syncErr, 'Stock status sync failed');
                }
            }

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
                const emailToSend = fullOrder?.guestEmail || fullOrder?.user?.email || (fullOrder?.shippingDetails as any)?.email;
                if (fullOrder && emailToSend) {
                    await emailService.sendOrderConfirmationEmail(emailToSend, fullOrder);
                }
            } catch (emailErr) {
                fastify.log.error(emailErr, 'Failed to send guest order confirmation email');
            }

            return {
                success: true,
                orderId: finalOrder.id,
                orderNumber: finalOrder.orderNumber,
                message: 'Order placed successfully',
                isGuestOrder: true
            };

        } catch (err: any) {
            fastify.log.error(err);
            return reply.code(500).send({ message: err.message || 'Failed to submit order' });
        }
    });

    // POST /guest-checkout/validate-coupon
    // Public endpoint to validate coupon for guest
    fastify.post('/guest-checkout/validate-coupon', {
        schema: {
            description: 'Validate coupon for guest checkout',
            tags: ['Guest Checkout'],
            body: {
                type: 'object',
                required: ['couponCode', 'guestToken'],
                properties: {
                    couponCode: { type: 'string' },
                    guestToken: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { couponCode, guestToken } = request.body as any;

            // Get cart for subtotal calculation
            const cart = await getGuestCart(guestToken);
            if (!cart) {
                return reply.code(400).send({ message: 'Cart not found' });
            }

            // Calculate subtotal
            const items = cart.items.map((item: any) => {
                const pkr = item.product.prices?.find((pr: any) => pr.currency?.code === 'PKR');
                return {
                    productId: item.productId,
                    quantity: item.quantity,
                    price: pkr ? Number(pkr.priceRetail) : Number(item.product.price || 0),
                    product: item.product
                };
            });

            const subtotal = items.reduce((acc: number, item: any) => 
                acc + (item.price * item.quantity), 0);

            // Validate coupon
            const result = await validateGuestCoupon(couponCode, subtotal, cart.items);

            if (!result.valid) {
                return reply.code(400).send({
                    valid: false,
                    message: result.error || 'Invalid coupon'
                });
            }

            return {
                valid: true,
                discount: result.couponDiscount,
                code: result.couponCode
            };

        } catch (err: any) {
            fastify.log.error(err);
            return reply.code(500).send({ message: 'Failed to validate coupon' });
        }
    });

    /**
     * POST /auth/activate-guest
     * Triggers account activation for a guest user
     */
    fastify.post('/auth/activate-guest', {
        schema: {
            description: 'Activate guest account',
            tags: ['Guest Checkout'],
            body: {
                type: 'object',
                required: ['email'],
                properties: {
                    email: { type: 'string', format: 'email' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { email } = request.body as any;

            // Find guest user
            const user = await fastify.prisma.user.findUnique({
                where: { email: email.toLowerCase() }
            });

            if (!user) {
                return reply.code(404).send({ message: 'Guest account not found' });
            }

            const prefs = user.preferences as any;
            if (prefs && !prefs.isGuestAccount) {
                return reply.code(400).send({ message: 'Account is already active' });
            }

            const frontendUrl = process.env.FRONTEND_URL || 'https://paperland.com.pk';
            // Link to Step 1 (Email) with pre-filled email
            const activationLink = `${frontendUrl}/en/signup?email=${encodeURIComponent(user.email)}`;

            // Send activation email
            await emailService.sendGuestActivationEmail(user.email, user.firstName || 'Customer', activationLink);

            return { 
                success: true, 
                message: 'Activation email sent successfully' 
            };
        } catch (err: any) {
            fastify.log.error(err);
            return reply.code(500).send({ message: 'Failed to trigger activation' });
        }
    });

    /**
     * POST /auth/activate-finalize
     * Finalizes account activation by setting password and clearing guest flags
     */
    fastify.post('/auth/activate-finalize', {
        schema: {
            description: 'Finalize guest activation',
            tags: ['Guest Checkout'],
            body: {
                type: 'object',
                required: ['token', 'newPassword'],
                properties: {
                    token: { type: 'string' },
                    newPassword: { 
                        type: 'string', 
                        minLength: 8,
                        pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()_+])[A-Za-z\\d!@#$%^&*()_+]{8,}$'
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { token, newPassword } = request.body as any;

            // Verify token
            const decoded = fastify.jwt.verify(token) as any;
            if (!decoded || decoded.action !== 'activate_account') {
                return reply.code(400).send({ message: 'Invalid or expired activation link' });
            }

            const user = await fastify.prisma.user.findUnique({
                where: { id: decoded.id }
            });

            if (!user) {
                return reply.code(404).send({ message: 'User not found' });
            }

            // Update password and clear guest flags
            const passwordHash = await bcrypt.hash(newPassword, 10);
            const prefs = (user.preferences as any) || {};
            
            await fastify.prisma.user.update({
                where: { id: user.id },
                data: {
                    passwordHash,
                    isActive: true,
                    accountStatus: 'ACTIVE',
                    preferences: {
                        ...prefs,
                        isGuestAccount: false,
                        activatedAt: new Date()
                    }
                }
            });

            return { success: true, message: 'Account activated successfully! You can now log in.' };
        } catch (err: any) {
            fastify.log.error(err);
            return reply.code(400).send({ message: 'Invalid or expired activation link' });
        }
    });
}
