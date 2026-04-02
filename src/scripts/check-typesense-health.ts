import dotenv from 'dotenv';
import { Client } from 'typesense';

dotenv.config();

const host = (process.env.TYPESENSE_HOST || 'localhost')
  .replace('http://', '')
  .replace('https://', '')
  .split(':')[0];

const typesense = new Client({
  nodes: [
    {
      host: host,
      port: parseInt(process.env.TYPESENSE_PORT || '80'),
      protocol: process.env.TYPESENSE_PROTOCOL || 'http',
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY || 'xyz',
  connectionTimeoutSeconds: 10,
});

async function checkHealth() {
  console.log('🔍 Checking Typesense Connection...');
  console.log(`Node: ${process.env.TYPESENSE_PROTOCOL}://${host}:${process.env.TYPESENSE_PORT}`);
  
  try {
    const health = await typesense.health.retrieve();
    console.log('✅ Typesense Health:', health);
    
    const collections = await typesense.collections().retrieve();
    console.log(`✅ Connection Successful! Found ${collections.length} collections.`);
    collections.forEach(c => console.log(` - ${c.name} (${c.num_documents} docs)`));
    
  } catch (error: any) {
    console.error('❌ Typesense Connection Failed!');
    console.error('Error:', error.message || error);
    process.exit(1);
  }
}

checkHealth();
