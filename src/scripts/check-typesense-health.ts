import dotenv from 'dotenv';
import { Client } from 'typesense';

dotenv.config();

const rawHost = process.env.TYPESENSE_HOST || 'localhost';
const protocol = process.env.TYPESENSE_PROTOCOL || 'http';
const port = parseInt(process.env.TYPESENSE_PORT || '80');

const host = rawHost
  .replace('http://', '')
  .replace('https://', '')
  .replace(/\/$/, '')
  .split(':')[0];

const typesense = new Client({
  nodes: [
    {
      host: host,
      port: port,
      protocol: protocol,
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY || 'xyz',
  connectionTimeoutSeconds: 10,
});

async function checkHealth() {
  const candidates = [
    process.env.TYPESENSE_HOST || 'typesense-yuczhopl59kom4nks0ly23ld',
    'typesense',
    'typesense-1',
    'localhost',
  ];

  console.log('🔍 Discovering Typesense Host...');

  for (const hostCandidate of candidates) {
    const cleanedHost = hostCandidate
      .replace('http://', '')
      .replace('https://', '')
      .replace(/\/$/, '')
      .split(':')[0];

    console.log(`📡 Trying host: ${cleanedHost}...`);

    const client = new Client({
      nodes: [
        {
          host: cleanedHost,
          port: parseInt(process.env.TYPESENSE_PORT || '8108'),
          protocol: process.env.TYPESENSE_PROTOCOL || 'http',
        },
      ],
      apiKey: process.env.TYPESENSE_API_KEY || 'xyz',
      connectionTimeoutSeconds: 3,
    });

    try {
      const health = await client.health.retrieve();
      console.log(`✅ SUCCESS! Found healthy node at: ${cleanedHost}`);
      console.log('Health:', health);
      
      const collections = await client.collections().retrieve();
      console.log(`✅ Found ${collections.length} collections.`);
      return; // Stop if found
    } catch (error: any) {
      console.log(`❌ Failed: ${cleanedHost} (${error.message || 'Timeout'})`);
    }
  }

  console.log('❌ Discovery Failed! Could not find Typesense on any of these hosts.');
  console.log('💡 TIP: Check if Backend and Typesense are on the same Docker network in Coolify.');
  process.exit(1);
}

checkHealth();
