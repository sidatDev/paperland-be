import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ORDER_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

async function seedAuditableOrders() {
    console.log('Seeding 10 Auditable Orders with detailed snapshots...');

    // 1. Fetch Dependencies
    const users = await prisma.user.findMany({ take: 5, include: { addresses: { include: { country: true } } } });
    if (users.length === 0) {
        console.error('No users found. Run seed-users.ts first.');
        return;
    }

    const products = await prisma.product.findMany({ 
        take: 10,
        include: { prices: { include: { currency: true } }, stocks: true } 
    });
    if (products.length === 0) {
        console.error('No products found. Run seed-products.ts first.');
        return;
    }

    const currency = await prisma.currency.findFirst({ where: { code: 'USD' } }) || await prisma.currency.findFirst();
    if (!currency) {
         console.error('No currency found.');
         return;
    }

    // 2. Generate 10 Orders
    for (let i = 0; i < 10; i++) {
        const user = users[i % users.length];
        
        // Use existing address or fallback mock
        const existingAddress = user.addresses[0];
        let addressId = existingAddress?.id;
        const countryCode = existingAddress?.country?.code || 'US';
        const countryName = existingAddress?.country?.name || 'United States';

        if (!addressId) {
            // Need an address for the mandatory relation
            const country = await prisma.country.findFirst() || await prisma.country.create({
                data: { code: 'XX', name: 'Test Country', currencyId: currency.id }
            });
             const newAddr = await prisma.address.create({
                data: {
                    userId: user.id,
                    firstName: user.firstName || 'Test',
                    lastName: user.lastName || 'User',
                    street1: '123 Seed St',
                    city: 'Seed City',
                    zipCode: '00000',
                    phone: '555-0199',
                    countryId: country.id,
                    type: 'SHIPPING'
                }
            });
            addressId = newAddr.id;
        }

        // Pick 1-3 random products
        const orderItemsData = [];
        let subTotal = 0;
        const numItems = Math.floor(Math.random() * 3) + 1;
        
        for (let j = 0; j < numItems; j++) {
            const product = products[(i + j) % products.length];
            const qty = Math.floor(Math.random() * 5) + 1;
            // Find price for currency or fallback
            const priceRec = product.prices.find(p => p.currencyId === currency.id) || product.prices[0];
            const unitPrice = priceRec ? Number(priceRec.priceRetail) : 100;
            
            const totalPrice = unitPrice * qty;
            subTotal += totalPrice;

            orderItemsData.push({
                product,
                quantity: qty,
                unitPrice,
                totalPrice
            });
        }

        const taxAmount = subTotal * 0.15; // 15% Tax
        const shippingFee = 25.00;
        const grandTotal = subTotal + taxAmount + shippingFee;
        const status = ORDER_STATUSES[i % ORDER_STATUSES.length];

        // 3. Construct the User's Requested JSON Structure parts
        const billingSnapshot = {
            fullName: `${user.firstName} ${user.lastName}`,
            phone: user.phoneNumber || "N/A",
            addressLine1: "123 Billing St",
            addressLine2: "Suite 100",
            city: "Billing City",
            state: "NY",
            postalCode: "10001",
            countryCode: countryCode
        };

        const shippingSnapshot = {
            fullName: `${user.firstName} ${user.lastName}`,
            phone: user.phoneNumber || "N/A",
            addressLine1: "456 Shipping Ln",
            addressLine2: "Apt 5B",
            city: "Shipping City",
            state: "CA",
            postalCode: "90210",
            countryCode: countryCode
        };

        const paymentDetails = {
            paymentMethod: i % 2 === 0 ? "CARD" : "BANK_TRANSFER",
            paymentProvider: "STRIPE",
            currency: currency.code,
            amountExpected: grandTotal,
            metadata: {
                transactionReference: `txn_${Date.now()}_${i}`
            }
        };

        const shippingDetails = {
            shippingMethod: i % 2 === 0 ? "STANDARD" : "EXPRESS",
            shippingCost: shippingFee,
            estimatedDeliveryDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0] // +5 days
        };

        const pricingSummary = {
            currency: currency.code,
            subTotal: subTotal,
            totalDiscount: 0,
            totalTax: taxAmount,
            shippingFee: shippingFee,
            grandTotal: grandTotal
        };

        const orderContext = {
            source: i % 3 === 0 ? "WEB" : "ADMIN",
            countryCode: countryCode,
            priceListId: "standard_retail"
        };
        
        const notes = {
            customerNote: `Please delivery carefully. Order #${i+1}`,
            internalNote: "VIP Customer, handle with care."
        };

        // 4. Create Order in DB
        try {
            const order = await prisma.order.create({
                data: {
                    orderNumber: `ORD-2026-${1000 + i}-${Date.now()}`,
                    userId: user.id,
                    addressId: addressId,
                    currencyId: currency.id,
                    status: status,
                    totalAmount: grandTotal,
                    taxAmount: taxAmount,
                    shippingAmount: shippingFee,
                    
                    // Map Snapshots to Schema JSON fields
                    billingSnapshot: billingSnapshot,
                    shippingSnapshot: shippingSnapshot,
                    paymentDetails: paymentDetails,
                    shippingDetails: shippingDetails,
                    pricingSummary: pricingSummary,
                    orderContext: orderContext,
                    notes: notes,

                    // Basic fields
                    paymentStatus: status === 'COMPLETED' || status === 'SHIPPED' ? 'PAID' : 'UNPAID',
                    paymentMethod: paymentDetails.paymentMethod,
                    
                    items: {
                        create: orderItemsData.map(item => ({
                            productId: item.product.id,
                            quantity: item.quantity,
                            price: item.unitPrice,
                            sku: item.product.sku,
                            
                            // Item Level Snapshots
                            pricingSnapshot: {
                                unitPrice: item.unitPrice,
                                discountAmount: 0,
                                taxAmount: item.unitPrice * 0.15,
                                totalPrice: item.totalPrice
                            },
                            inventorySnapshot: {
                                warehouseId: "WH-MAIN-01",
                                locationCode: "A-01-01",
                                availableQuantityAtOrderTime: 100
                            }
                        }))
                    }
                }
            });

            console.log(`✓ Created Order ${order.orderNumber} [${status}] for ${user.email} - Total: ${grandTotal} ${currency.code}`);
        } catch (err: any) {
            console.error(`✗ Failed to create order ${i}:`, err.message);
        }
    }
}

seedAuditableOrders()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
