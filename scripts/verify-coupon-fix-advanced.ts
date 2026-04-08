import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const couponCode = 'PLND-3A7AJA';
  
  // Test case 1: No limit (maxDiscount is 0)
  {
      const subtotal = 1000;
      let eligibleSubtotal = subtotal;
      let couponDiscount = 0;
      const discountVal = 20; 
      const maxDiscount = 0;

      if (eligibleSubtotal * (discountVal / 100) > maxDiscount && maxDiscount > 0) {
          couponDiscount = maxDiscount;
      } else {
          couponDiscount = eligibleSubtotal * (discountVal / 100);
      }
      console.log(`Test 1 (No Limit): Calculated ${couponDiscount}. Expected 200.`);
      if (couponDiscount !== 200) throw new Error("Test 1 failed");
  }

  // Test case 2: With limit (maxDiscount is 50)
  {
      const subtotal = 1000;
      let eligibleSubtotal = subtotal;
      let couponDiscount = 0;
      const discountVal = 20; 
      const maxDiscount = 50;

      // Actual code logic:
      couponDiscount = eligibleSubtotal * (discountVal / 100);
      if (maxDiscount > 0 && couponDiscount > maxDiscount) {
          couponDiscount = maxDiscount;
      }
      
      console.log(`Test 2 (Limit 50): Calculated ${couponDiscount}. Expected 50.`);
      if (couponDiscount !== 50) throw new Error("Test 2 failed");
  }

  console.log("ALL TESTS PASSED");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
