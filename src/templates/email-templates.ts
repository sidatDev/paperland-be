/**
 * Email Templates for Paperland E-commerce
 * Optimized for Paperland brand guidelines (Red #E31E24, Yellow #FDB714)
 */

const LOGO_URL = 'cid:paperland-logo';
const SOCIAL_FB = 'cid:social-fb';
const SOCIAL_IG = 'cid:social-ig';
const SOCIAL_WA = 'cid:social-wa';
const SOCIAL_LI = 'cid:social-li';
const WEBSITE_URL = process.env.FRONTEND_URL || 'https://paperland.com.pk';
const PHONE = '+92 321 1234567';
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
    <html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="x-apple-disable-message-reformatting">
        <title>Paperland</title>
        <!--[if mso]>
        <noscript>
            <xml>
                <o:OfficeDocumentSettings>
                    <o:PixelsPerInch>96</o:PixelsPerInch>
                </o:OfficeDocumentSettings>
            </xml>
        </noscript>
        <![endif]-->
        <style>
            body { margin: 0; padding: 0; background-color: #f6f9fc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased; }
            table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
            img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
            .content-table { max-width: 600px !important; width: 100% !important; margin: 20px auto; background-color: #ffffff; border-radius: 12px; }
            .body-padding { padding: 15px 30px 40px 30px; }
            .footer { background-color: #f1f3f5; padding: 30px 20px; text-align: center; color: #6b7280; font-size: 13px; }
            .btn { display: inline-block; padding: 14px 28px; background-color: #FDB714; color: #000000 !important; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; mso-padding-alt: 0; }
            h1 { color: #111827; margin-top: 0; font-size: 24px; line-height: 1.3; mso-line-height-rule: exactly; }
            p { color: #4b5563; line-height: 1.6; margin: 16px 0; mso-line-height-rule: exactly; }
            .divider { border-top: 1px solid #e5e7eb; margin: 20px 0; }
            @media screen and (max-width: 480px) {
                .body-padding { padding: 15px 20px 30px 20px !important; }
                .content-table { border-radius: 0 !important; margin: 0 auto !important; }
            }
        </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f6f9fc;">
        <div style="display: none; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; line-height: 0; overflow: hidden; mso-hide: all;">
            ${preheader}
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f6f9fc;">
            <tr>
                <td align="center" style="padding: 20px 10px;">
                    <!--[if mso]>
                    <table align="center" border="0" cellspacing="0" cellpadding="0" width="600" style="width:600px;">
                    <tr>
                    <td align="center" valign="top" width="600">
                    <![endif]-->
                    <table class="content-table" cellpadding="0" cellspacing="0" border="0" align="center" style="width: 100%; max-width: 600px; background-color: #ffffff; border-collapse: separate; border-radius: 12px;">
                        <!-- Header with Logo -->
                        <tr>
                            <td align="center" style="padding: 30px 20px 10px 20px;">
                                <a href="${WEBSITE_URL}" target="_blank">
                                    <img src="${LOGO_URL}" alt="Paperland" width="180" border="0" style="width: 180px; height: auto; display: block; margin: 0 auto;">
                                </a>
                            </td>
                        </tr>

                        <!-- Main Content -->
                        <tr>
                            <td class="body-padding" align="left" style="padding: 20px 30px 40px 30px;">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                        <td>
                                            ${content}
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td class="footer" style="background-color: #f1f3f5; padding: 40px 20px; border-top: 1px solid #e5e7eb;">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                        <td align="center" style="padding-bottom: 25px;">
                                            <table cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td style="padding: 0 10px;">
                                                        <a href="${SOCIALS.facebook}" target="_blank"><img src="${SOCIAL_FB}" width="28" height="28" alt="Facebook" style="display: block; width: 28px; height: 28px;"></a>
                                                    </td>
                                                    <td style="padding: 0 10px;">
                                                        <a href="${SOCIALS.instagram}" target="_blank"><img src="${SOCIAL_IG}" width="28" height="28" alt="Instagram" style="display: block; width: 28px; height: 28px;"></a>
                                                    </td>
                                                    <td style="padding: 0 10px;">
                                                        <a href="${SOCIALS.twitter}" target="_blank"><img src="${SOCIAL_WA}" width="28" height="28" alt="WhatsApp" style="display: block; width: 28px; height: 28px;"></a>
                                                    </td>
                                                    <td style="padding: 0 10px;">
                                                        <a href="${SOCIALS.linkedin}" target="_blank"><img src="${SOCIAL_LI}" width="28" height="28" alt="LinkedIn" style="display: block; width: 28px; height: 28px;"></a>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="color: #111827; font-weight: bold; font-size: 15px; padding-bottom: 5px;">
                                            Paperland E-Commerce Portal
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="color: #6b7280; font-size: 13px; padding-bottom: 5px;">
                                            Lahore, Pakistan
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="color: #6b7280; font-size: 13px; padding-bottom: 20px;">
                                            Phone: ${PHONE} | Email: ${EMAIL}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="padding-bottom: 20px;">
                                            <div style="width: 80%; border-top: 1px solid #d1d5db;"></div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td align="center" style="color: #9ca3af; font-size: 11px; line-height: 1.4;">
                                            You are receiving this email because you registered on our website or subscribed to our newsletter.
                                            <br>
                                            &copy; ${new Date().getFullYear()} • PaperLand Designed & Developed By Sidat Technologies
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                    <!--[if mso]>
                    </td>
                    </tr>
                    </table>
                    <![endif]-->
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
        
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 35px 0;">
            <tr>
                <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6; border: 2px dashed #E31E24; border-radius: 8px;">
                        <tr>
                            <td style="padding: 20px 40px; font-size: 32px; font-weight: bold; color: #E31E24; letter-spacing: 6px; font-family: monospace;">
                                ${otpCode}
                            </td>
                        </tr>
                    </table>
                    <p style="font-size: 13px; color: #9ca3af; margin-top: 10px;">This code will expire in 10 minutes.</p>
                </td>
            </tr>
        </table>

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
        
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
            <tr>
                <td align="center">
                    <a href="${WEBSITE_URL}/en/products" style="display: inline-block; padding: 14px 28px; background-color: #FDB714; color: #000000 !important; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Explore Our Catalog</a>
                </td>
            </tr>
        </table>

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
        
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #FDB714; margin: 25px 0;">
            <tr>
                <td style="padding: 20px;">
                    <p style="margin: 0; font-weight: bold; color: #1f2937;">What Happens Next?</p>
                    <p style="margin: 10px 0 0 0; font-size: 14px; color: #4b5563; line-height: 1.5;">Our support team is reviewing your message and will get back to you within <strong>24 business hours</strong>.</p>
                </td>
            </tr>
        </table>

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
        let imgUrl = item.product?.imageUrl || item.product?.image_url || 'https://via.placeholder.com/100';
        if (imgUrl && !imgUrl.startsWith('http')) {
            imgUrl = `https://pl-s3.sidattech.com/paperland-bucket/${imgUrl.startsWith('/') ? imgUrl.slice(1) : imgUrl}`;
        }

        return `
        <tr>
            <td style="padding: 15px 0; border-bottom: 1px solid #f3f4f6;" width="90" valign="top">
                <img src="${imgUrl}" alt="${item.product?.name || 'Product'}" width="80" height="80" style="width: 80px; height: 80px; border-radius: 8px; border: 1px solid #eeeeee; display: block;">
            </td>
            <td style="padding: 15px 10px; border-bottom: 1px solid #f3f4f6;" valign="top">
                <p style="margin: 0; font-weight: bold; color: #111827; font-size: 14px;">${item.product?.name || 'Item'}</p>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #6b7280;">Qty: ${item.quantity}</p>
            </td>
            <td style="padding: 15px 0; border-bottom: 1px solid #f3f4f6; text-align: right; valign: top; font-weight: bold; color: #111827;" width="100">
                Rs. ${(item.price * item.quantity).toLocaleString()}
            </td>
        </tr>
    `}).join('');

    const content = `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px;">
            <tr>
                <td align="center">
                    <h1 style="color: #059669; font-size: 28px; margin-bottom: 10px; margin-top: 0;">Your order is placed!</h1>
                    <p style="font-size: 16px; color: #6b7280; margin: 0;">Order #${order.orderNumber}</p>
                </td>
            </tr>
        </table>

        <p>Hi <strong>${order.user?.firstName || 'Customer'}</strong>,</p>
        <p>Thank you for shopping with Paperland! We've received your order and are getting it ready for shipment. We'll notify you as soon as it's on its way.</p>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
            <tr>
                <td align="center">
                    <a href="${WEBSITE_URL}/en/order-tracking?orderId=${order.orderNumber}" style="display: inline-block; padding: 14px 28px; background-color: #FDB714; color: #000000 !important; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Track Order Status</a>
                </td>
            </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border-radius: 12px; margin: 30px 0;">
            <tr>
                <td style="padding: 25px;">
                    <h3 style="margin-top: 0; color: #111827; font-size: 18px; border-bottom: 2px solid #E31E24; padding-bottom: 8px; display: inline-block;">Delivery Details</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 15px; font-size: 14px; line-height: 1.6; color: #4b5563;">
                        <tr><td><strong>Name:</strong> ${order.user?.firstName} ${order.user?.lastName}</td></tr>
                        <tr><td><strong>Address:</strong> ${order.shippingAddress || 'N/A'}</td></tr>
                        <tr><td><strong>Phone:</strong> ${order.user?.phoneNumber || 'N/A'}</td></tr>
                        <tr><td><strong>Email:</strong> ${order.user?.email}</td></tr>
                    </table>
                </td>
            </tr>
        </table>

        <div style="margin: 30px 0;">
            <h3 style="margin-top: 0; color: #111827; font-size: 18px; border-bottom: 2px solid #E31E24; padding-bottom: 8px; display: inline-block;">Order Items</h3>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 10px;">
                ${itemsHtml}
            </table>
        </div>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border-radius: 12px; margin-top: 30px;">
            <tr>
                <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 14px; line-height: 2;">
                        <tr>
                            <td style="color: #6b7280;">Subtotal</td>
                            <td style="text-align: right; font-weight: bold; color: #111827;">Rs. ${Number(order.subtotal || 0).toLocaleString()}</td>
                        </tr>
                        <tr>
                            <td style="color: #6b7280;">Delivery Fee</td>
                            <td style="text-align: right; font-weight: bold; color: #111827;">Rs. ${Number(order.shippingFee || 0).toLocaleString()}</td>
                        </tr>
                        ${order.discountAmount > 0 ? `
                        <tr>
                            <td style="color: #6b7280;">Discount</td>
                            <td style="text-align: right; font-weight: bold; color: #dc2626;">-Rs. ${Number(order.discountAmount).toLocaleString()}</td>
                        </tr>` : ''}
                        <tr>
                            <td colspan="2" style="padding-top: 10px; border-top: 1px solid #e5e7eb;">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                        <td style="font-weight: bold; color: #111827; font-size: 18px;">Total</td>
                                        <td style="text-align: right; font-weight: 900; color: #E31E24; font-size: 20px;">Rs. ${Number(order.totalAmount).toLocaleString()}</td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                    <p style="margin-top: 15px; font-size: 12px; color: #6b7280; text-align: right;">Paid via: <strong>${order.paymentMethod || 'Credit/Debit Card'}</strong></p>
                </td>
            </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
            <tr>
                <td align="center">
                    <p style="font-weight: bold; margin-bottom: 5px; color: #111827;">Need Help?</p>
                    <p style="font-size: 13px; margin-top: 0; color: #6b7280; line-height: 1.5;">If you have any questions, visit our <a href="${WEBSITE_URL}/en/contact-us" style="color: #E31E24; text-decoration: none; font-weight: bold;">Help Center</a> or call us at ${PHONE}.</p>
                </td>
            </tr>
        </table>
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
    const isCancelled = newStatus.toUpperCase() === 'CANCELLED';

    const content = `
        <div style="text-align: center; margin-bottom: 30px;">
            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin-bottom: 15px;">
                <tr>
                    <td style="background-color: ${bannerColor}; color: #ffffff; padding: 8px 25px; border-radius: 50px; font-weight: bold; font-size: 13px; text-transform: uppercase;">
                        ORDER STATUS UPDATE
                    </td>
                </tr>
            </table>
            <h1 style="color: #111827; margin-bottom: 5px;">Your order is now ${statusLabel.toLowerCase()}</h1>
            <p style="font-size: 16px;">Order #${order.orderNumber}</p>
        </div>

        <p>Hi <strong>${order.user?.firstName || 'Customer'}</strong>,</p>
        <p>${statusMessage}</p>

        ${(newStatus.toUpperCase() === 'SHIPPED' && order.trackingNumber) ? `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0f7ff; border: 1px solid #bfdbfe; border-radius: 12px; border-left: 5px solid #2563eb; margin: 25px 0;">
            <tr>
                <td style="padding: 20px;">
                    <p style="margin-top: 0; font-weight: bold; color: #1e40af;">Tracking Details</p>
                    <p style="margin-bottom: 20px; font-size: 14px; color: #1e40af;">Carrier: <strong>${order.courierPartner || 'TCS'}</strong><br/>
                       Tracking Number: <strong>${order.trackingNumber}</strong></p>
                    <a href="${WEBSITE_URL}/en/order-tracking?orderId=${order.orderNumber}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
                        Track Your Order
                    </a>
                </td>
            </tr>
        </table>
        ` : ''}

        ${(newStatus.toUpperCase() === 'DELIVERED') ? `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 40px 0; background-color: #f0fdf4; border: 1px solid #dcfce7; border-radius: 16px;">
            <tr>
                <td align="center" style="padding: 35px 25px;">
                    <p style="margin-top: 0; font-weight: bold; color: #166534; font-size: 18px;">How was your experience?</p>
                    <p style="margin-bottom: 25px; color: #15803d; font-size: 14px;">Your feedback helps us grow and assists other customers in making informed choices!</p>
                    <a href="${WEBSITE_URL}/en/dashboard/orders/${order.id}" style="display: inline-block; background-color: #E31E24; color: #ffffff; padding: 16px 35px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px;">
                        Add a Review & Feedback
                    </a>
                </td>
            </tr>
        </table>
        ` : ''}

        ${isCancelled ? `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
            <tr>
                <td align="center">
                    <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">If you'd like to browse our latest products, feel free to visit our shop again.</p>
                    <a href="${WEBSITE_URL}/en/products" style="display: inline-block; background-color: #E31E24; color: #ffffff !important; padding: 15px 35px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 16px;">
                        Continue Shopping
                    </a>
                </td>
            </tr>
        </table>
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
        
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 35px 0;">
            <tr>
                <td align="center">
                    <a href="${WEBSITE_URL}/en/products" style="display: inline-block; padding: 14px 28px; background-color: #FDB714; color: #000000 !important; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Start Shopping Now</a>
                </td>
            </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; margin: 25px 0;">
            <tr>
                <td style="padding: 20px;">
                    <p style="margin: 0; font-weight: bold; color: #92400e; font-size: 16px;">Quick Tip</p>
                    <p style="margin: 10px 0 0 0; font-size: 14px; color: #b45309; line-height: 1.5;">You can track your orders, manage your addresses, and view your purchase history directly from your <a href="${WEBSITE_URL}/en/dashboard" style="color: #E31E24; font-weight: bold; text-decoration: none;">Account Dashboard</a>.</p>
                </td>
            </tr>
        </table>

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
        
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border-radius: 12px; border-left: 5px solid #FDB714; margin: 30px 0;">
            <tr>
                <td style="padding: 25px;">
                    <h3 style="margin-top: 0; color: #111827; font-size: 18px;">What's Next?</h3>
                    <p style="margin: 10px 0; font-size: 15px; color: #4b5563; line-height: 1.6;">Our dedicated B2B team is currently reviewing your documentation. This process usually takes <strong>24 to 48 business hours</strong>.</p>
                    <p style="margin: 10px 0 0 0; font-size: 15px; color: #4b5563; line-height: 1.6;">Once your account is approved, you will receive another email and gain access to our <strong>exclusive B2B pricing</strong> and bulk ordering features.</p>
                </td>
            </tr>
        </table>

        <p>If we require any additional information, one of our account managers will reach out to you directly.</p>
        
        <p>We look forward to a successful partnership!</p>
    `;
    return getEmailLayout(content, "B2B Application Received - Paperland Business");
}
