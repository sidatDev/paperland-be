import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Force updating ORDER_CANCELLED template...');

  const template = {
      name: 'ORDER_CANCELLED',
      subject: 'Order #{{orderNumber}} has been Cancelled - Paperland',
      description: 'Sent when an order status changes to Cancelled.',
      body: `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px;">
            <tr>
                <td align="center">
                    <h1 style="color: #ef4444; margin-bottom: 10px; font-size: 24px;">Your order has been cancelled</h1>
                    <p style="color: #6b7280; font-size: 16px; margin: 0;">Order ID: <strong style="color: #E31E24;">#{{orderNumber}}</strong></p>
                </td>
            </tr>
        </table>

        <p>Hi {{userName}},</p>
        <p>We're writing to let you know that your order <strong>#{{orderNumber}}</strong> has been cancelled. If you have already been charged, a refund will be processed according to our refund policy.</p>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 12px; margin: 25px 0;">
            <tr>
                <td style="padding: 20px;">
                    <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.5;">
                        <strong>Cancellation Note:</strong> If you did not request this cancellation or have any questions regarding your refund status, please reply to this email or contact our support team immediately.
                    </p>
                </td>
            </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
            <tr>
                <td>
                    <h3 style="color: #111827; margin-bottom: 15px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; border-bottom: 2px solid #E31E24; padding-bottom: 5px; display: inline-block;">Items in Cancelled Order</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">{{orderItems}}</table>
                </td>
            </tr>
        </table>
        
        <p style="color: #6b7280; font-size: 14px;">We apologize for any inconvenience caused. We hope to serve you better in the future.</p>
      `,
      variables: ['userName', 'orderNumber', 'orderItems'],
      type: 'EMAIL',
      isActive: true,
  };

  await prisma.notificationTemplate.upsert({
    where: { name: template.name },
    update: {
      subject: template.subject,
      body: template.body,
      description: template.description,
      variables: template.variables,
      isActive: true
    },
    create: template,
  });

  console.log('✅ ORDER_CANCELLED template updated successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
