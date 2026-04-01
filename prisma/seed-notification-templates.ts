import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Notification Templates...');

  const templates = [
    {
      name: 'OTP_VERIFICATION',
      subject: 'Your Paperland Verification Code',
      description: 'Triggered when a user requests an OTP for verification.',
      body: `
        <h1>Email Verification Code</h1>
        <p>Hello <strong>{{userName}}</strong>,</p>
        <p>Thank you for choosing Paperland! To complete your registration and secure your account, please use the following one-time password (OTP):</p>
        
        <div style="text-align: center; margin: 35px 0;">
            <div style="display: inline-block; background-color: #f3f4f6; padding: 20px 40px; border: 2px dashed #E31E24; border-radius: 8px; font-size: 32px; font-weight: bold; color: #E31E24; letter-spacing: 6px;">
                {{otpCode}}
            </div>
            <p style="font-size: 13px; color: #9ca3af; margin-top: 10px;">This code will expire in 10 minutes.</p>
        </div>

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
            <h1>Welcome to Paperland, {{userName}}!</h1>
            <p>We're thrilled to have you join our community of stationery lovers. Your account has been successfully created and is ready for use.</p>
            
            <p>At Paperland, we believe that the right tools can inspire great things. Whether you're looking for premium notebooks, elegant pens, or essential office supplies, we've got you covered.</p>
            
            <div style="text-align: center; margin: 35px 0;">
                <a href="https://pl-portal.sidattech.com/en/products" style="display: inline-block; padding: 14px 28px; background-color: #FDB714; color: #000000 !important; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Start Shopping Now</a>
            </div>
    
            <div style="background-color: #fffbeb; border: 1px solid #fef3c7; padding: 20px; border-radius: 12px; margin: 25px 0;">
                <p style="margin: 0; font-weight: bold; color: #92400e;">Quick Tip</p>
                <p style="margin: 10px 0 0 0; font-size: 14px; color: #b45309;">You can track your orders, manage your addresses, and view your purchase history directly from your Account Dashboard.</p>
            </div>
    
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
            <h1>Application Received - {{companyName}}</h1>
            <p>Hello <strong>{{userName}}</strong>,</p>
            <p>Thank you for choosing Paperland as your business partner. We've successfully received your B2B account application and company details for <strong>{{companyName}}</strong>.</p>
            
            <div style="background-color: #f9fafb; padding: 25px; border-radius: 12px; border-left: 5px solid #FDB714; margin: 30px 0;">
                <h3 style="margin-top: 0; color: #111827; font-size: 18px;">What's Next?</h3>
                <p style="margin: 10px 0; font-size: 15px;">Our dedicated B2B team is currently reviewing your documentation. This process usually takes <strong>24 to 48 business hours</strong>.</p>
                <p style="margin: 10px 0 0 0; font-size: 15px;">Once your account is approved, you will receive another email and gain access to our <strong>exclusive B2B pricing</strong> and bulk ordering features.</p>
            </div>
    
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
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #111827; margin-bottom: 10px;">Your order is placed!</h1>
            <p style="color: #6b7280; font-size: 16px;">Order ID: <strong style="color: #E31E24;">#{{orderNumber}}</strong></p>
        </div>

        <p>Hi {{userName}},</p>
        <p>Thank you for shopping with Paperland! We've received your order and are getting it ready for you. You'll receive another email once your package has shipped.</p>

        <div style="text-align: center; margin: 30px 0;">
            <a href="{{trackingUrl}}" class="btn">Track Your Order</a>
        </div>

        <div class="divider"></div>

        <div style="margin-bottom: 25px;">
            <h3 style="color: #111827; margin-bottom: 15px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800;">Delivery Details</h3>
            {{deliveryDetails}}
        </div>

        <div class="divider"></div>

        <div style="margin-bottom: 25px;">
            <h3 style="color: #111827; margin-bottom: 15px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800;">Order Items</h3>
            <table width="100%" cellpadding="0" cellspacing="0">
                {{orderItems}}
            </table>
        </div>

        <div class="divider"></div>

        <div style="margin-bottom: 10px;">
            <h3 style="color: #111827; margin-bottom: 15px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800;">Order Summary</h3>
            {{orderSummary}}
        </div>
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
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #111827; margin-bottom: 10px;">Your order is being processed!</h1>
            <p style="color: #6b7280; font-size: 16px;">Order ID: <strong style="color: #E31E24;">#{{orderNumber}}</strong></p>
        </div>

        <p>Hi {{userName}},</p>
        <p>Good news! Your order is now being processed by our team. We are carefully packing your items to ensure they reach you in perfect condition.</p>

        <div style="text-align: center; margin: 30px 0;">
            <a href="{{trackingUrl}}" class="btn">Track Order Status</a>
        </div>

        <div class="divider"></div>
        <div style="margin-bottom: 25px;">
            <h3 style="color: #111827; margin-bottom: 15px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800;">Delivery Details</h3>
            {{deliveryDetails}}
        </div>
        <div class="divider"></div>
        <div style="margin-bottom: 25px;">
            <h3 style="color: #111827; margin-bottom: 15px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800;">Order Items</h3>
            <table width="100%" cellpadding="0" cellspacing="0">{{orderItems}}</table>
        </div>
        <div class="divider"></div>
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
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #111827; margin-bottom: 10px;">Your order has shipped!</h1>
            <p style="color: #6b7280; font-size: 16px;">Order ID: <strong style="color: #E31E24;">#{{orderNumber}}</strong></p>
        </div>

        <p>Hi {{userName}},</p>
        <p>Exciting news! Your order has been handed over to our courier partner and is on its way to you.</p>

        <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; margin: 25px 0; border: 1px solid #e5e7eb;">
            <p style="margin: 0 0 5px 0; font-size: 13px; color: #6b7280;">Courier Partner</p>
            <p style="margin: 0 0 15px 0; font-weight: bold; color: #111827;">{{courierPartner}}</p>
            <p style="margin: 0 0 5px 0; font-size: 13px; color: #6b7280;">Tracking Number</p>
            <p style="margin: 0; font-weight: bold; color: #E31E24; font-size: 18px;">{{trackingNumber}}</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
            <a href="{{trackingUrl}}" class="btn">Track Shipment</a>
        </div>

        <div class="divider"></div>
        <div style="margin-bottom: 25px;">
            <h3 style="color: #111827; margin-bottom: 15px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800;">Order Items</h3>
            <table width="100%" cellpadding="0" cellspacing="0">{{orderItems}}</table>
        </div>
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
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #111827; margin-bottom: 10px;">Your order has been delivered!</h1>
            <p style="color: #6b7280; font-size: 16px;">Order ID: <strong style="color: #E31E24;">#{{orderNumber}}</strong></p>
        </div>

        <p>Hi {{userName}},</p>
        <p>Your order has been successfully delivered. We hope you love your new Paperland products!</p>
        <p>We would really appreciate it if you could take a moment to share your feedback with us. It helps us improve and helps other customers too!</p>

        <div style="text-align: center; margin: 40px 0;">
            <a href="{{reviewUrl}}" class="btn" style="background-color: #E31E24; color: #ffffff !important; padding: 16px 32px; font-size: 18px; border-radius: 12px; box-shadow: 0 4px 12px rgba(227, 30, 36, 0.2);">Add a Review & Feedback</a>
        </div>

        <div class="divider"></div>
        <div style="margin-bottom: 25px;">
            <h3 style="color: #111827; margin-bottom: 15px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800;">Items Delivered</h3>
            <table width="100%" cellpadding="0" cellspacing="0">{{orderItems}}</table>
        </div>

        <div style="background-color: #fff8f8; padding: 20px; border-radius: 12px; border: 1px solid #fee2e2; margin-top: 30px; text-align: center;">
            <p style="margin: 0; color: #b91c1c; font-weight: bold;">Any issues with your delivery?</p>
            <p style="margin: 5px 0 0 0; color: #dc2626; font-size: 13px;">Please contact our support team at info@paperland.com.pk</p>
        </div>
      `,
      variables: ['userName', 'orderNumber', 'orderItems', 'reviewUrl'],
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
