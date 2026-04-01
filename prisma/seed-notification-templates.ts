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
        <div style="text-align: center; padding: 20px; background-color: #ffffff; border-bottom: 2px solid #f3f4f6; margin-bottom: 20px;">
            <img src="https://pl-portal.sidattech.com/images/logo/Paperland%20logo.png" alt="Paperland Logo" style="width: 180px; height: auto; outline: none; text-decoration: none; border: none; display: inline-block;" />
        </div>
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
            <div style="text-align: center; padding: 20px; background-color: #ffffff; border-bottom: 2px solid #f3f4f6; margin-bottom: 20px;">
                <img src="https://pl-portal.sidattech.com/images/logo/Paperland%20logo.png" alt="Paperland" style="width: 180px; height: auto;" />
            </div>
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
            <div style="text-align: center; padding: 20px; background-color: #ffffff; border-bottom: 2px solid #f3f4f6; margin-bottom: 20px;">
                <img src="https://pl-portal.sidattech.com/images/logo/Paperland%20logo.png" alt="Paperland Logo" style="width: 180px; height: auto;" />
            </div>
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
    }
  ];

  for (const template of templates) {
    await prisma.notificationTemplate.upsert({
      where: { name: template.name },
      update: template,
      create: template,
    });
    console.log(`✅ Templated upserted: ${template.name}`);
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
