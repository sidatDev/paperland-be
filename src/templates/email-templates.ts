/**
 * Email Templates for Paperland E-commerce
 * Optimized for Paperland brand guidelines (Red #E31E24, Yellow #FDB714)
 */

const LOGO_URL = 'https://pl-portal.sidattech.com/images/logo/Paperland%20logo.png';
const WEBSITE_URL = 'https://pl-portal.sidattech.com';
const PHONE = '+92 300 1234567';
const EMAIL = 'info@paperland.com.pk';

// Social Links
const SOCIALS = {
    facebook: 'https://facebook.com/paperland',
    instagram: 'https://instagram.com/paperland',
    twitter: 'https://twitter.com/paperland',
    linkedin: 'https://linkedin.com/company/paperland'
};

/**
 * Base Email Layout (Wrapper)
 */
export function getEmailLayout(content: string, preheader: string = "Paperland Update"): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>Paperland</title>
        <style>
            body { margin: 0; padding: 0; background-color: #f6f9fc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased; }
            table { border-collapse: collapse; }
            .content-table { max-width: 600px; width: 100%; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .header { background-color: #E31E24; padding: 30px 20px; text-align: center; }
            .logo { width: 120px; height: auto; }
            .body-padding { padding: 40px 30px; }
            .footer { background-color: #f1f3f5; padding: 30px 20px; text-align: center; color: #6b7280; font-size: 13px; }
            .social-icon { display: inline-block; margin: 0 8px; width: 32px; height: 32px; }
            .btn { display: inline-block; padding: 14px 28px; background-color: #FDB714; color: #000000 !important; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; transition: transform 0.2s; }
            h1 { color: #111827; margin-top: 0; font-size: 24px; }
            p { color: #4b5563; line-height: 1.6; margin: 16px 0; }
            .divider { border-top: 1px solid #e5e7eb; margin: 20px 0; }
            @media screen and (max-width: 480px) {
                .body-padding { padding: 30px 20px; }
            }
        </style>
    </head>
    <body>
        <div style="display: none; font-size: 1px; color: #f6f9fc; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
            ${preheader}
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
                <td align="center">
                    <table class="content-table" cellpadding="0" cellspacing="0" border="0">
                        <!-- Red Header with Logo -->
                        <tr>
                            <td class="header" align="center" style="text-align: center; background-color: #ffffff; padding: 20px;">
                                <a href="${WEBSITE_URL}">
                                    <img src="${LOGO_URL}" alt="Paperland Logo" class="logo" style="width: 180px; height: auto; border:0; outline:none; text-decoration:none; display:block; margin: 0 auto; max-width:100%;">
                                </a>
                            </td>
                        </tr>

                        <!-- Main Content -->
                        <tr>
                            <td class="body-padding">
                                ${content}
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td class="footer">
                                <div style="margin-bottom: 20px;">
                                    <a href="${SOCIALS.facebook}" style="text-decoration: none;"><img src="https://cdn-icons-png.flaticon.com/32/733/733547.png" width="24" alt="FB" style="margin: 0 5px;"></a>
                                    <a href="${SOCIALS.instagram}" style="text-decoration: none;"><img src="https://cdn-icons-png.flaticon.com/32/2111/2111463.png" width="24" alt="IG" style="margin: 0 5px;"></a>
                                    <a href="${SOCIALS.twitter}" style="text-decoration: none;"><img src="https://cdn-icons-png.flaticon.com/32/3256/3256013.png" width="24" alt="TW" style="margin: 0 5px;"></a>
                                    <a href="${SOCIALS.linkedin}" style="text-decoration: none;"><img src="https://cdn-icons-png.flaticon.com/32/145/145807.png" width="24" alt="LI" style="margin: 0 5px;"></a>
                                </div>
                                <p style="margin-bottom: 5px;"><strong>Paperland E-Commerce Portal</strong></p>
                                <p style="margin: 5px 0;">Lahore, Pakistan</p>
                                <p style="margin: 5px 0;">Phone: ${PHONE} | Email: ${EMAIL}</p>
                                <div class="divider"></div>
                                <p style="font-size: 11px;">You are receiving this email because you registered on our website or subscribed to our newsletter. If you wish to unsubscribe, please contact us.</p>
                                <p style="font-size: 11px; margin-top: 10px;">&copy; ${new Date().getFullYear()} Paperland. All rights reserved.</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
}

/**
 * OTP Verification Template
 */
export function getOTPEmailTemplate(otpCode: string, userName?: string): string {
    const name = userName || 'Customer';
    const content = `
        <h1>Email Verification Code</h1>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Thank you for choosing Paperland! To complete your registration and secure your account, please use the following one-time password (OTP):</p>
        
        <div style="text-align: center; margin: 35px 0;">
            <div style="display: inline-block; background-color: #f3f4f6; padding: 20px 40px; border: 2px dashed #E31E24; border-radius: 8px; font-size: 32px; font-weight: bold; color: #E31E24; letter-spacing: 6px;">
                ${otpCode}
            </div>
            <p style="font-size: 13px; color: #9ca3af; margin-top: 10px;">This code will expire in 10 minutes.</p>
        </div>

        <p>If you did not request this verification, please ignore this email or contact our support if you have concerns.</p>
        <p>Welcome to the Paperland family!</p>
    `;
    return getEmailLayout(content, "Your Paperland Verification Code");
}

/**
 * Newsletter Subscription Welcome Template
 */
export function getNewsletterWelcomeTemplate(): string {
    const content = `
        <h1>Welcome to Paperland!</h1>
        <p>Thank you for subscribing to our newsletter! We're excited to have you on board.</p>
        <p>You'll now be the first to know about:</p>
        <ul style="color: #4b5563; line-height: 1.8;">
            <li>Exclusive new collection launches</li>
            <li>Limited-time flash sales and discounts</li>
            <li>Stationery trends and creative tips</li>
        </ul>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="${WEBSITE_URL}/en/products" class="btn">Explore Our Catalog</a>
        </div>

        <p>Welcome to the world of premium stationery!</p>
    `;
    return getEmailLayout(content, "Welcome to the Paperland Newsletter");
}

/**
 * Contact Us Confirmation (User Receipt) Template
 */
export function getContactUsConfirmationTemplate(name: string, subject: string): string {
    const content = `
        <h1>We've Received Your Message!</h1>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Thank you for contacting Paperland. This is a confirmation that we've successfully received your inquiry regarding <strong>"${subject}"</strong>.</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #FDB714; margin: 25px 0;">
            <p style="margin: 0; font-weight: bold; color: #1f2937;">What Happens Next?</p>
            <p style="margin: 10px 0 0 0; font-size: 14px;">Our support team is reviewing your message and will get back to you within <strong>24 business hours</strong>.</p>
        </div>

        <p>In the meantime, feel free to browse our <a href="${WEBSITE_URL}/en/products" style="color: #E31E24; font-weight: bold;">latest products</a> or check out our <a href="${WEBSITE_URL}/en/faq" style="color: #E31E24; font-weight: bold;">FAQs</a> for quick answers.</p>
        
        <p>Talk to you soon!</p>
    `;
    return getEmailLayout(content, "We've received your inquiry - Paperland");
}

/**
 * Order Confirmation Template (Daraz Inspired)
 */
export function getOrderConfirmationTemplate(order: any): string {
    const itemsHtml = order.items.map((item: any) => {
        // Ensure absolute URL for product image
        let imgUrl = item.product.imageUrl || item.product.image_url || 'https://via.placeholder.com/100';
        if (imgUrl && !imgUrl.startsWith('http')) {
            imgUrl = `https://data-fe.sidattech.com/public-bucket/${imgUrl.startsWith('/') ? imgUrl.slice(1) : imgUrl}`;
        }

        return `
        <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 15px 0; vertical-align: top;">
                <img src="${imgUrl}" alt="${item.product.name}" style="width: 80px; height: 80px; object-fit: contain; border-radius: 8px; border: 1px solid #eee;">
            </td>
            <td style="padding: 15px 10px; vertical-align: top;">
                <p style="margin: 0; font-weight: bold; color: #111827; font-size: 14px;">${item.product.name}</p>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #6b7280;">Qty: ${item.quantity}</p>
            </td>
            <td style="padding: 15px 0; text-align: right; vertical-align: top; font-weight: bold; color: #111827;">
                Rs. ${(item.price * item.quantity).toLocaleString()}
            </td>
        </tr>
    `}).join('');

    const content = `
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #059669; font-size: 28px; margin-bottom: 10px;">Your order is placed!</h1>
            <p style="font-size: 16px;">Order #${order.orderNumber}</p>
        </div>

        <p>Hi <strong>${order.user?.firstName || 'Customer'}</strong>,</p>
        <p>Thank you for shopping with Paperland! We've received your order and are getting it ready for shipment. We'll notify you as soon as it's on its way.</p>

        <div style="text-align: center; margin: 30px 0;">
            <a href="${WEBSITE_URL}/en/order-tracking?orderId=${order.orderNumber}" class="btn">Track Order Status</a>
        </div>

        <div style="background-color: #f9fafb; padding: 25px; border-radius: 12px; margin: 30px 0;">
            <h3 style="margin-top: 0; color: #111827; font-size: 18px; border-bottom: 2px solid #E31E24; padding-bottom: 8px; display: inline-block;">Delivery Details</h3>
            <div style="margin-top: 15px; font-size: 14px; line-height: 1.6;">
                <p style="margin: 3px 0;"><strong>Name:</strong> ${order.user?.firstName} ${order.user?.lastName}</p>
                <p style="margin: 3px 0;"><strong>Address:</strong> ${order.shippingAddress || 'N/A'}</p>
                <p style="margin: 3px 0;"><strong>Phone:</strong> ${order.user?.phoneNumber || 'N/A'}</p>
                <p style="margin: 3px 0;"><strong>Email:</strong> ${order.user?.email}</p>
            </div>
        </div>

        <div style="margin: 30px 0;">
            <h3 style="margin-top: 0; color: #111827; font-size: 18px; border-bottom: 2px solid #E31E24; padding-bottom: 8px; display: inline-block;">Order Items</h3>
            <table width="100%" style="margin-top: 10px;">
                ${itemsHtml}
            </table>
        </div>

        <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; margin-top: 30px;">
            <table width="100%" style="font-size: 14px; line-height: 2;">
                <tr>
                    <td style="color: #6b7280;">Subtotal</td>
                    <td style="text-align: right; font-weight: bold;">Rs. ${Number(order.subtotal || 0).toLocaleString()}</td>
                </tr>
                <tr>
                    <td style="color: #6b7280;">Delivery Fee</td>
                    <td style="text-align: right; font-weight: bold;">Rs. ${Number(order.shippingFee || 0).toLocaleString()}</td>
                </tr>
                ${order.discountAmount > 0 ? `
                <tr>
                    <td style="color: #6b7280;">Discount</td>
                    <td style="text-align: right; font-weight: bold; color: #dc2626;">-Rs. ${Number(order.discountAmount).toLocaleString()}</td>
                </tr>` : ''}
                <tr style="font-size: 18px; border-top: 1px solid #e5e7eb;">
                    <td style="padding-top: 10px; font-weight: bold; color: #111827;">Total</td>
                    <td style="padding-top: 10px; text-align: right; font-weight: 900; color: #E31E24;">Rs. ${Number(order.totalAmount).toLocaleString()}</td>
                </tr>
            </table>
            <p style="margin-top: 15px; font-size: 12px; color: #6b7280; text-align: right;">Paid via: <strong>${order.paymentMethod || 'Credit/Debit Card'}</strong></p>
        </div>

        <div style="margin-top: 40px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
            <p style="font-weight: bold; margin-bottom: 5px;">Need Help?</p>
            <p style="font-size: 13px; margin-top: 0;">If you have any questions, visit our <a href="${WEBSITE_URL}/en/contact-us" style="color: #E31E24;">Help Center</a> or call us at ${PHONE}.</p>
        </div>
    `;
    return getEmailLayout(content, `Order Placed! #${order.orderNumber} - Paperland`);
}

/**
 * Order Status Update Template
 */
export function getOrderStatusUpdateTemplate(order: any, newStatus: string): string {
    const statusColors: any = {
        'SHIPPED': '#2563eb',
        'DELIVERED': '#059669',
        'CANCELLED': '#dc2626',
        'PROCESSING': '#FDB714',
        'RETURNED': '#7c3aed'
    };
    
    const statusLabels: any = {
        'SHIPPED': 'Shipped',
        'DELIVERED': 'Delivered',
        'CANCELLED': 'Cancelled',
        'PROCESSING': 'Processing',
        'RETURNED': 'Returned',
        'PENDING': 'Pending'
    };

    const statusMessages: any = {
        'SHIPPED': 'Great news! Your order has been shipped and is on its way to you.',
        'DELIVERED': 'Great news! Your order has been delivered successfully.',
        'CANCELLED': 'We are writing to inform you that your order has been cancelled.',
        'PROCESSING': 'We are currently preparing your order for dispatch.',
        'RETURNED': 'Your order has been marked as returned.',
        'PENDING': 'Your order is currently pending.'
    };

    const bannerColor = statusColors[newStatus.toUpperCase()] || '#E31E24';
    const statusLabel = statusLabels[newStatus.toUpperCase()] || newStatus;
    const statusMessage = statusMessages[newStatus.toUpperCase()] || `Your order status has been updated to ${statusLabel}.`;
    
    // Determine if it's a "positive" update or neutral (avoiding "Great news" for cancellations)
    const isCancelled = newStatus.toUpperCase() === 'CANCELLED';

    const content = `
        <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; background-color: ${bannerColor}; color: #ffffff; padding: 10px 25px; border-radius: 50px; font-weight: bold; font-size: 14px; margin-bottom: 15px;">
                ORDER STATUS UPDATE
            </div>
            <h1 style="color: #111827; margin-bottom: 5px;">Your order is now ${statusLabel.toLowerCase()}</h1>
            <p style="font-size: 16px;">Order #${order.orderNumber}</p>
        </div>

        <p>Hi <strong>${order.user?.firstName || 'Customer'}</strong>,</p>
        <p>${statusMessage}</p>

        ${(newStatus.toUpperCase() === 'SHIPPED' && order.trackingNumber) ? `
        <div style="background-color: #f0f7ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 12px; border-left: 5px solid #2563eb; margin: 25px 0;">
            <p style="margin-top: 0; font-weight: bold; color: #1e40af;">Tracking Details</p>
            <p style="margin-bottom: 15px; font-size: 14px;">Carrier: <strong>${order.courierPartner || 'TCS'}</strong><br/>
               Tracking Number: <strong>${order.trackingNumber}</strong></p>
            <a href="${WEBSITE_URL}/en/order-tracking?orderId=${order.orderNumber}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
                Track Your Order
            </a>
        </div>
        ` : ''}

        ${isCancelled ? `
        <div style="text-align: center; margin: 30px 0;">
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">If you'd like to browse our latest products, feel free to visit our shop again.</p>
            <a href="${WEBSITE_URL}/en/products" style="display: inline-block; background-color: #E31E24; color: #ffffff; padding: 15px 35px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(227, 30, 36, 0.2);">
                Continue Shopping
            </a>
        </div>
        ` : ''}

        <p>If you have any questions regarding this update, please don't hesitate to reach out to our team.</p>
    `;
    return getEmailLayout(content, `Status Update for Order #${order.orderNumber} - Paperland`);
}

/**
 * Individual Welcome Template (B2C)
 */
export function getIndividualWelcomeTemplate(name: string): string {
    const content = `
        <h1>Welcome to Paperland, ${name}!</h1>
        <p>We're thrilled to have you join our community of stationery lovers. Your account has been successfully created and is ready for use.</p>
        
        <p>At Paperland, we believe that the right tools can inspire great things. Whether you're looking for premium notebooks, elegant pens, or essential office supplies, we've got you covered.</p>
        
        <div style="text-align: center; margin: 35px 0;">
            <a href="${WEBSITE_URL}/en/products" class="btn">Start Shopping Now</a>
        </div>

        <div style="background-color: #fffbeb; border: 1px solid #fef3c7; padding: 20px; border-radius: 12px; margin: 25px 0;">
            <p style="margin: 0; font-weight: bold; color: #92400e;">Quick Tip</p>
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #b45309;">You can track your orders, manage your addresses, and view your purchase history directly from your <a href="${WEBSITE_URL}/en/dashboard" style="color: #E31E24; font-weight: bold;">Account Dashboard</a>.</p>
        </div>

        <p>Happy writing!</p>
    `;
    return getEmailLayout(content, "Welcome to Paperland - Your account is ready!");
}

/**
 * B2B Review Confirmation Template
 */
export function getB2BReviewConfirmationTemplate(name: string, companyName: string): string {
    const content = `
        <h1>Application Received - ${companyName}</h1>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Thank you for choosing Paperland as your business partner. We've successfully received your B2B account application and company details for <strong>${companyName}</strong>.</p>
        
        <div style="background-color: #f9fafb; padding: 25px; border-radius: 12px; border-left: 5px solid #FDB714; margin: 30px 0;">
            <h3 style="margin-top: 0; color: #111827; font-size: 18px;">What's Next?</h3>
            <p style="margin: 10px 0; font-size: 15px;">Our dedicated B2B team is currently reviewing your documentation. This process usually takes <strong>24 to 48 business hours</strong>.</p>
            <p style="margin: 10px 0 0 0; font-size: 15px;">Once your account is approved, you will receive another email and gain access to our <strong>exclusive B2B pricing</strong> and bulk ordering features.</p>
        </div>

        <p>If we require any additional information, one of our account managers will reach out to you directly.</p>
        
        <p>We look forward to a successful partnership!</p>
    `;
    return getEmailLayout(content, "B2B Application Received - Paperland Business");
}
