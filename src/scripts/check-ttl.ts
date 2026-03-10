
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl);

async function checkTTL() {
  console.log('--- Checking Redis TTL ---');
  
  const keys = ['shop:home', 'shop:categories:hierarchy'];
  
  // Add listing keys (they are dynamic, so we find them via pattern first)
  const listingKeys = await redis.keys('shop:products:*');
  keys.push(...listingKeys);
  
  for (const key of keys) {
    const ttl = await redis.ttl(key);
    if (ttl === -2) {
      console.log(`❌ Key '${key}' does not exist (Expired or never set)`);
    } else if (ttl === -1) {
      console.log(`⚠️ Key '${key}' exists but has NO expiration (Infinite)`);
    } else {
      console.log(`✅ Key '${key}' TTL: ${ttl} seconds remaining`);
    }
  }

  // Check a sample product key if known, or list pattern
  const productKeys = await redis.keys('product:*');
  if (productKeys.length > 0) {
    const pKey = productKeys[0];
    const pTtl = await redis.ttl(pKey);
    console.log(`📦 Sample Product '${pKey}' TTL: ${pTtl} seconds remaining`);
  } else {
    console.log('ℹ️ No product keys found in cache yet.');
  }

  redis.disconnect();
}

checkTTL().catch(console.error);
