import Fastify from 'fastify';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend root
dotenv.config();

async function testRedis() {
  const fastify = Fastify({ logger: false });

  try {
    console.log('--- Redis Verification Started ---');
    
    // Register Plugin
    console.log('Registering Redis plugin...');
    await fastify.register(import('../plugins/redis'));
    
    // Register Cache Service
    console.log('Registering Cache service...');
    await fastify.register(import('../services/cache.service'));

    await fastify.ready();
    console.log('Fastify ready.');

    if (!fastify.redis) {
        throw new Error('Redis decorator missing on fastify instance');
    }

    if (!fastify.cache) {
        throw new Error('Cache decorator missing on fastify instance');
    }

    // Test Set/Get
    const testKey = 'test:antigravity:' + Date.now();
    const testValue = { message: 'Hello from verification script', timestamp: new Date() };

    console.log(`Setting key: ${testKey}`);
    await fastify.cache.set(testKey, testValue, 60);

    console.log(`Getting key: ${testKey}`);
    const retrieved = await fastify.cache.get(testKey);

    console.log('Retrieved value:', retrieved);

    if (JSON.stringify(retrieved) === JSON.stringify(testValue)) {
        console.log('✅ Basic Set/Get verified!');
    } else {
        throw new Error('Verification failed: Data mismatch');
    }

    // Test Wrap
    console.log('Testing cache.wrap...');
    let callCount = 0;
    const fetchFn = async () => {
        callCount++;
        return { data: 'some complex data', count: callCount };
    };

    const wrapKey = 'test:wrap:' + Date.now();
    
    console.log('First call (should fetch)...');
    const res1 = await fastify.cache.wrap(wrapKey, fetchFn, 60);
    console.log('Res 1:', res1);

    console.log('Second call (should hit cache)...');
    const res2 = await fastify.cache.wrap(wrapKey, fetchFn, 60);
    console.log('Res 2:', res2);

    if (res1.count === 1 && res2.count === 1) {
        console.log('✅ Cache wrap verified (fetchFn called only once)!');
    } else {
        throw new Error(`Verification failed: fetchFn called ${callCount} times instead of 1`);
    }

    // Cleanup
    await fastify.redis.del(testKey);
    await fastify.redis.del(wrapKey);
    console.log('Test keys cleaned up.');

    console.log('--- Redis Verification Successful ✅ ---');
    
  } catch (err) {
    console.error('❌ Redis Verification Failed:');
    console.error(err);
  } finally {
    await fastify.close();
  }
}

testRedis();
