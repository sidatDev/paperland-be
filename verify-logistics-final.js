const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const rules = await prisma.shippingRule.findMany({ 
      where: { isActive: true }, 
      orderBy: { priority: 'desc' } 
    });
    
    console.log('Available Rules:', JSON.stringify(rules.map(r => ({ name: r.name, city: r.city, type: r.logisticsType })), null, 2));
    
    const testCities = ['Karachi', 'Lahore', 'Islamabad'];
    testCities.forEach(city => {
      let bestRule = rules.find(r => r.city && r.city.toLowerCase() === city.toLowerCase());
      if (!bestRule) bestRule = rules.find(r => !r.city);
      console.log(`City: ${city} -> Assigned to: ${bestRule ? bestRule.name : 'NONE'} (${bestRule ? bestRule.logisticsType : 'N/A'})`);
    });
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
