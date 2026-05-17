import * as dotenv from 'dotenv';
dotenv.config();
import { fireN8nEvent } from '../utils/n8n-webhook';

console.log("Starting test script...");
console.log("N8N_WEBHOOK_URL:", process.env.N8N_WEBHOOK_URL);
console.log("N8N_WEBHOOK_SECRET:", process.env.N8N_WEBHOOK_SECRET);

async function runTest() {
  console.log("\nFiring 'order-placed' event...");
  await fireN8nEvent('order-placed', {
    orderId: "test-order-123",
    orderNumber: "ORD-TEST-999",
    totalAmount: 1500,
    paymentMethod: "COD",
    guestEmail: "test-guest@example.com"
  });
  console.log("Event fired asynchronously. Waiting 5 seconds...");
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log("Test finished.");
}

runTest();
