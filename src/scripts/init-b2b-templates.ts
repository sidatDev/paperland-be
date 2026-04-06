import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Creating B2B Notification Templates...');

  const templates = [
    {
      name: 'B2B_APPROVAL',
      subject: '🎉 Your B2B Account Has Been Approved - Paperland',
      description: 'Sent when a B2B account application is approved by admin.',
      body: `
        <h1>Account Approved!</h1>
        <p>Dear {{userName}},</p>
        
        <p>Congratulations! Your B2B account application for <strong>{{companyName}}</strong> has been <strong>approved</strong>.</p>
        
        <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #166534;">Account Details:</h3>
          <p style="margin: 5px 0;">💳 <strong>Initial Credit Limit:</strong> PKR {{creditLimit}}</p>
          <p style="margin: 5px 0;">🚀 <strong>Status:</strong> Active</p>
        </div>
        
        <h3>What's Next?</h3>
        <ul style="color: #4b5563; line-height: 1.8;">
          <li>You can now <strong>login to your account</strong> using your registered email</li>
          <li>Browse our complete product catalog</li>
          <li>Place orders with your credit limit</li>
          <li>Access exclusive B2B pricing and bulk discounts</li>
        </ul>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://pl-portal.sidattech.com/en/login" style="display: inline-block; padding: 14px 28px; background-color: #FDB714; color: #000000 !important; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Login to Your Account</a>
        </div>
        
        <p>If you have any questions, feel free to contact our support team.</p>
        <p>Best regards,<br><strong>Paperland Team</strong></p>
      `,
      variables: ['userName', 'companyName', 'creditLimit'],
      type: 'EMAIL',
      isActive: true,
    },
    {
      name: 'B2B_REJECTION',
      subject: 'B2B Account Application Update - Paperland',
      description: 'Sent when a B2B account application is rejected.',
      body: `
        <h1>Application Status Update</h1>
        <p>Dear {{userName}},</p>
        
        <p>Thank you for your interest in partnering with Paperland for <strong>{{companyName}}</strong>.</p>
        
        <p>After reviewing your application, we regret to inform you that we cannot approve your B2B account at this time due to: <strong>{{reason}}</strong>.</p>
        
        <div style="background-color: #fff8f8; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #b91c1c;">Next Steps:</h3>
          <p style="margin: 5px 0;">If you believe this is an error or would like to provide additional information, please contact our B2B support team.</p>
        </div>
        
        <p>Email: support@paperland.com.pk<br>Phone: +92 300 1234567</p>
        
        <p>Best regards,<br><strong>Paperland Team</strong></p>
      `,
      variables: ['userName', 'companyName', 'reason'],
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
      },
      create: template,
    });
    console.log(`✅ Template handled: ${template.name}`);
  }

  console.log('🏁 B2B Templates Initialization Finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
