import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const couponCode = 'PLND-3A7AJA';
  const subtotal = 1000;
  
  const coupon = await (prisma as any).coupon.findUnique({
      where: { code: couponCode.toUpperCase(), isActive: true, deletedAt: null },
      include: { products: true, categories: true }
  });

  if (!coupon) {
      console.error("Coupon not found in DB");
      process.exit(1);
  }

  // Logic from validateGuestCoupon
  let eligibleSubtotal = subtotal; // Assume all items are eligible for this test
  let couponDiscount = 0;
  const discountVal = Number(coupon.discountValue || 0);
  const maxDiscount = Number(coupon.maxDiscountAmount || 0);

  if (coupon.discountType === 'PERCENTAGE') {
      couponDiscount = eligibleSubtotal * (discountVal / 100);
      if (maxDiscount > 0 && couponDiscount > maxDiscount) {
          couponDiscount = maxDiscount;
      }
  } else {
      couponDiscount = Math.min(discountVal, eligibleSubtotal);
  }

  console.log("Subtotal:", subtotal);
  console.log("Discount Type:", coupon.discountType);
  console.log("Discount Value:", discountVal);
  console.log("Max Discount Amount:", maxDiscount);
  console.log("Calculated Discount:", couponDiscount);

  if (couponDiscount === 200) {
      console.log("SUCCESS: Discount correctly calculated as 200 (20% of 1000)");
  } else {
      console.error("FAILURE: Discount should be 200 but got", couponDiscount);
      process.exit(1);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
