import { PrismaClient } from '@prisma/client';
import { initializeEmailService } from '../services/email.service';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const prisma = new PrismaClient();
const emailService = initializeEmailService(prisma);

const TEST_EMAIL = process.env.TEST_RECEIVER_EMAIL || 'test@example.com';

async function runTests() {
  console.log('🚀 Starting Email Service Tests...');
  console.log(`📧 Target Email: ${TEST_EMAIL}`);

  try {
    // 1. Test B2C Welcome Email
    console.log('\n--- 1. Testing B2C Welcome Email ---');
    await emailService.sendIndividualWelcomeEmail(TEST_EMAIL, 'Test Individual User');

    // 2. Test B2B Review Confirmation Email
    console.log('\n--- 2. Testing B2B Review Confirmation Email ---');
    await emailService.sendB2BReviewConfirmationEmail(TEST_EMAIL, 'Test Business User', 'Paperland Corporate Ltd');

    // 3. Test Order Confirmation Email
    console.log('\n--- 3. Testing Order Confirmation Email ---');
    const mockOrder = {
      orderNumber: 'ORD-TEST-123',
      totalAmount: 15450,
      subtotal: 15000,
      shippingFee: 450,
      discountAmount: 0,
      paymentMethod: 'Cash on Delivery',
      shippingAddress: '123 Test Street, Karachi, Pakistan',
      user: {
        firstName: 'Test',
        lastName: 'Customer',
        email: TEST_EMAIL,
        phoneNumber: '+92 300 1234567'
      },
      items: [
        {
          quantity: 2,
          price: 7500,
          product: {
            name: 'Premium Leather Journal',
            imageUrl: 'https://via.placeholder.com/150'
          }
        }
      ]
    };
    await emailService.sendOrderConfirmationEmail(TEST_EMAIL, mockOrder);

    // 4. Test Order Status Update (SHIPPED)
    console.log('\n--- 4. Testing Order Status Update (SHIPPED) ---');
    await emailService.sendOrderStatusUpdateEmail(TEST_EMAIL, mockOrder, 'SHIPPED');

    console.log('\n✅ All test emails triggered successfully!');
    console.log('Please check your inbox (and console logs for SMTP activity).');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
