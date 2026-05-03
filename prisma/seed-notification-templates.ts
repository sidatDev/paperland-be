import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Notification Templates...');

  const templates = [
      name: 'OTP_VERIFICATION',
      subject: 'Your Paperland Verification Code',
      description: 'Triggered when a user requests an OTP for verification.',
      body: `
        <h1 style="color: #111827; font-size: 24px; margin-top: 0;">Email Verification Code</h1>
        <p>Hello <strong>{{userName}}</strong>,</p>
        <p>Thank you for choosing Paperland! To complete your registration and secure your account, please use the following one-time password (OTP):</p>
        
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 35px 0;">
            <tr>
                <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0" style="background-color: #f3f4f6; border: 2px dashed #E31E24; border-radius: 8px;">
                        <tr>
                            <td style="padding: 20px 40px; font-size: 32px; font-weight: bold; color: #E31E24; letter-spacing: 6px; font-family: monospace;">
                                {{otpCode}}
                            </td>
                        </tr>
                    </table>
                    <p style="font-size: 13px; color: #9ca3af; margin-top: 10px;">This code will expire in 10 minutes.</p>
                </td>
            </tr>
        </table>

        <p>If you did not request this verification, please ignore this email or contact our support if you have concerns.</p>
        <p>Welcome to the Paperland family!</p>
      `,
      variables: ['userName', 'otpCode'],
      type: 'EMAIL',
      isActive: true,
    },
    {
        name: 'INDIVIDUAL_WELCOME',
        subject: 'Welcome to Paperland - Your account is ready!',
        description: 'Sent upon successful account creation.',
        body: `
            <h1 style="color: #111827; font-size: 24px; margin-top: 0;">Welcome to Paperland, {{userName}}!</h1>
            <p>We're thrilled to have you join our community of stationery lovers. Your account has been successfully created and is ready for use.</p>
            
            <p>At Paperland, we believe that the right tools can inspire great things. Whether you're looking for premium notebooks, elegant pens, or essential office supplies, we've got you covered.</p>
            
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 35px 0;">
                <tr>
                    <td align="center">
                        <a href="https://paperland.com.pk/en/products" style="display: inline-block; padding: 14px 28px; background-color: #FDB714; color: #000000 !important; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Start Shopping Now</a>
                    </td>
                </tr>
            </table>
    
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; margin: 25px 0;">
                <tr>
                    <td style="padding: 20px;">
                        <p style="margin: 0; font-weight: bold; color: #92400e; font-size: 16px;">Quick Tip</p>
                        <p style="margin: 10px 0 0 0; font-size: 14px; color: #b45309; line-height: 1.5;">You can track your orders, manage your addresses, and view your purchase history directly from your Account Dashboard.</p>
                    </td>
                </tr>
            </table>
    
            <p>Happy writing!</p>
        `,
        variables: ['userName'],
        type: 'EMAIL',
        isActive: true,
    },
    {
        name: 'B2B_REVIEW_CONFIRMATION',
        subject: 'B2B Application Received - Paperland Business',
        description: 'Sent when a new B2B account application is received.',
        body: `
            <h1 style="color: #111827; font-size: 24px; margin-top: 0;">Application Received - {{companyName}}</h1>
            <p>Hello <strong>{{userName}}</strong>,</p>
            <p>Thank you for choosing Paperland as your business partner. We've successfully received your B2B account application and company details for <strong>{{companyName}}</strong>.</p>
            
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
        `,
        variables: ['userName', 'companyName'],
        type: 'EMAIL',
        isActive: true,
    },
    {
      name: 'ORDER_PLACED',
      subject: 'Your order is placed! #{{orderNumber}} - Paperland',
      description: 'Sent when a new order is successfully placed (Pending status).',
      body: `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px;">
            <tr>
                <td align="center">
                    <h1 style="color: #059669; margin-bottom: 10px; font-size: 28px;">Your order is placed!</h1>
                    <p style="color: #6b7280; font-size: 16px; margin: 0;">Order ID: <strong style="color: #E31E24;">#{{orderNumber}}</strong></p>
                </td>
            </tr>
        </table>

        <p>Hi {{userName}},</p>
        <p>Thank you for shopping with Paperland! We've received your order and are getting it ready for you. You'll receive another email once your package has shipped.</p>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
            <tr>
                <td align="center">
                    <a href="{{trackingUrl}}" style="display: inline-block; padding: 14px 28px; background-color: #FDB714; color: #000000 !important; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Track Your Order</a>
                </td>
            </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
            <tr>
                <td>
                    <h3 style="color: #111827; margin-bottom: 15px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; border-bottom: 2px solid #E31E24; padding-bottom: 5px; display: inline-block;">Delivery Details</h3>
                    {{deliveryDetails}}
                </td>
            </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
            <tr>
                <td>
                    <h3 style="color: #111827; margin-bottom: 15px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; border-bottom: 2px solid #E31E24; padding-bottom: 5px; display: inline-block;">Order Items</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        {{orderItems}}
                    </table>
                </td>
            </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 10px;">
            <tr>
                <td>
                    <h3 style="color: #111827; margin-bottom: 15px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; border-bottom: 2px solid #E31E24; padding-bottom: 5px; display: inline-block;">Order Summary</h3>
                    {{orderSummary}}
                </td>
            </tr>
        </table>
      `,
      variables: ['userName', 'orderNumber', 'orderItems', 'deliveryDetails', 'orderSummary', 'trackingUrl'],
      type: 'EMAIL',
      isActive: true,
    },
    {
      name: 'ORDER_PROCESSING',
      subject: 'Order #{{orderNumber}} is being processed - Paperland',
      description: 'Sent when an order status changes to Processing.',
      body: `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px;">
            <tr>
                <td align="center">
                    <h1 style="color: #111827; margin-bottom: 10px; font-size: 24px;">Your order is being processed!</h1>
                    <p style="color: #6b7280; font-size: 16px; margin: 0;">Order ID: <strong style="color: #E31E24;">#{{orderNumber}}</strong></p>
                </td>
            </tr>
        </table>

        <p>Hi {{userName}},</p>
        <p>Good news! Your order is now being processed by our team. We are carefully packing your items to ensure they reach you in perfect condition.</p>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
            <tr>
                <td align="center">
                    <a href="{{trackingUrl}}" style="display: inline-block; padding: 14px 28px; background-color: #FDB714; color: #000000 !important; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Track Order Status</a>
                </td>
            </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
            <tr>
                <td>
                    <h3 style="color: #111827; margin-bottom: 15px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; border-bottom: 2px solid #E31E24; padding-bottom: 5px; display: inline-block;">Delivery Details</h3>
                    {{deliveryDetails}}
                </td>
            </tr>
        </table>
        
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
            <tr>
                <td>
                    <h3 style="color: #111827; margin-bottom: 15px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; border-bottom: 2px solid #E31E24; padding-bottom: 5px; display: inline-block;">Order Items</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">{{orderItems}}</table>
                </td>
            </tr>
        </table>
        
        {{orderSummary}}
      `,
      variables: ['userName', 'orderNumber', 'orderItems', 'deliveryDetails', 'orderSummary', 'trackingUrl'],
      type: 'EMAIL',
      isActive: true,
    },
    {
      name: 'ORDER_SHIPPED',
      subject: 'Order #{{orderNumber}} has been shipped! - Paperland',
      description: 'Sent when an order status changes to Shipped.',
      body: `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px;">
            <tr>
                <td align="center">
                    <h1 style="color: #2563eb; margin-bottom: 10px; font-size: 24px;">Your order has shipped!</h1>
                    <p style="color: #6b7280; font-size: 16px; margin: 0;">Order ID: <strong style="color: #E31E24;">#{{orderNumber}}</strong></p>
                </td>
            </tr>
        </table>

        <p>Hi {{userName}},</p>
        <p>Exciting news! Your order has been handed over to our courier partner and is on its way to you.</p>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; margin: 25px 0;">
            <tr>
                <td style="padding: 20px;">
                    <p style="margin: 0 0 5px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: bold;">Courier Partner</p>
                    <p style="margin: 0 0 15px 0; font-weight: bold; color: #111827; font-size: 15px;">{{courierPartner}}</p>
                    <p style="margin: 0 0 5px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: bold;">Tracking Number</p>
                    <p style="margin: 0; font-weight: bold; color: #E31E24; font-size: 20px;">{{trackingNumber}}</p>
                </td>
            </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0;">
            <tr>
                <td align="center">
                    <a href="{{trackingUrl}}" style="display: inline-block; padding: 14px 28px; background-color: #2563eb; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Track Shipment</a>
                </td>
            </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
            <tr>
                <td>
                    <h3 style="color: #111827; margin-bottom: 15px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; border-bottom: 2px solid #E31E24; padding-bottom: 5px; display: inline-block;">Order Items</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">{{orderItems}}</table>
                </td>
            </tr>
        </table>
      `,
      variables: ['userName', 'orderNumber', 'orderItems', 'trackingUrl', 'trackingNumber', 'courierPartner'],
      type: 'EMAIL',
      isActive: true,
    },
    {
      name: 'ORDER_DELIVERED',
      subject: 'Order #{{orderNumber}} delivered - We value your feedback!',
      description: 'Sent when an order status changes to Delivered.',
      body: `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px;">
            <tr>
                <td align="center">
                    <h1 style="color: #059669; margin-bottom: 10px; font-size: 24px;">Your order has been delivered!</h1>
                    <p style="color: #6b7280; font-size: 16px; margin: 0;">Order ID: <strong style="color: #E31E24;">#{{orderNumber}}</strong></p>
                </td>
            </tr>
        </table>

        <p>Hi {{userName}},</p>
        <p>Your order has been successfully delivered. We hope you love your new Paperland products!</p>
        <p>We would really appreciate it if you could take a moment to share your feedback with us. It helps us improve and helps other customers too!</p>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 40px 0;">
            <tr>
                <td align="center">
                    <a href="{{reviewUrl}}" style="display: inline-block; padding: 16px 32px; background-color: #E31E24; color: #ffffff !important; font-size: 18px; border-radius: 12px; font-weight: bold; text-decoration: none;">Add a Review & Feedback</a>
                </td>
            </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
            <tr>
                <td>
                    <h3 style="color: #111827; margin-bottom: 15px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; border-bottom: 2px solid #E31E24; padding-bottom: 5px; display: inline-block;">Financial Overview</h3>
                    {{financialOverview}}
                </td>
            </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
            <tr>
                <td>
                    <h3 style="color: #111827; margin-bottom: 15px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; border-bottom: 2px solid #E31E24; padding-bottom: 5px; display: inline-block;">Items Delivered</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">{{orderItems}}</table>
                </td>
            </tr>
        </table>
      `,
      variables: ['userName', 'orderNumber', 'orderItems', 'reviewUrl', 'financialOverview'],
      type: 'EMAIL',
      isActive: true,
    },
    {
        name: 'REVIEW_APPROVED',
        subject: 'Your review for {{productName}} is live! - Paperland',
        description: 'Sent when an admin approves a customer review.',
        body: `
            <h1 style="color: #059669; font-size: 24px; margin-top: 0;">Your Review is Approved!</h1>
            <p>Hello <strong>{{userName}}</strong>,</p>
            <p>Great news! Your review for <strong>{{productName}}</strong> has been approved and is now live on our website.</p>
            
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0fdf4; border: 1px solid #dcfce7; border-radius: 12px; margin: 30px 0;">
                <tr>
                    <td style="padding: 25px;">
                        <p style="margin: 0; font-weight: bold; color: #166534; font-size: 16px;">Thank you for your feedback!</p>
                        <p style="margin: 10px 0 0 0; font-size: 14px; color: #15803d; line-height: 1.5;">Your contribution helps other stationery lovers make informed choices. We value your presence in the Paperland community.</p>
                    </td>
                </tr>
            </table>
    
            <p>Keep sharing your experiences with us!</p>
        `,
        variables: ['userName', 'productName'],
        type: 'EMAIL',
        isActive: true,
    },
    {
        name: 'REVIEW_REJECTED',
        subject: 'Update regarding your review for {{productName}} - Paperland',
        description: 'Sent when an admin rejects a customer review.',
        body: `
            <h1 style="color: #111827; font-size: 24px; margin-top: 0;">Review Update</h1>
            <p>Hello <strong>{{userName}}</strong>,</p>
            <p>Thank you for submitting a review for <strong>{{productName}}</strong>.</p>
            <p>We're writing to inform you that your review didn't pass our standard moderation guidelines at this time and has been removed.</p>
            
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fff8f8; border: 1px solid #fee2e2; border-radius: 12px; margin: 30px 0;">
                <tr>
                    <td style="padding: 25px;">
                        <p style="margin: 0; font-weight: bold; color: #b91c1c; font-size: 16px;">You can submit a new review!</p>
                        <p style="margin: 10px 0 0 0; font-size: 14px; color: #dc2626; line-height: 1.5;">We value your honest feedback. If you'd like, you can try submitting a new review that follows our community guidelines.</p>
                    </td>
                </tr>
            </table>
    
            <p>If you have any questions, feel free to contact our support team.</p>
        `,
        variables: ['userName', 'productName'],
        type: 'EMAIL',
        isActive: true,
    }
  ];

  for (const template of templates) {
    await prisma.notificationTemplate.upsert({
      where: { name: template.name },
      update: {
        description: template.description,
        variables: template.variables,
        // We DO NOT update body or subject here to respect manual edits in Admin Portal
      },
      create: template,
    });
    console.log(`✅ Template handled: ${template.name}`);
  }

  console.log('🏁 Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
