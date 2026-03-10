const { Client } = require("pg");
require("dotenv").config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

const newPermissions = [
  // CMS Management
  { title: 'View CMS Pages', key: 'cms_view' },
  { title: 'Manage CMS Content', key: 'cms_manage' },

  // Blog Management
  { title: 'View Blog Posts', key: 'blog_view' },
  { title: 'Manage Blog Posts', key: 'blog_manage' },

  // Analytics
  { title: 'View Reports', key: 'analytics_view' },
  { title: 'Export Analytics', key: 'analytics_export' },

  // SEO Management
  { title: 'View SEO Settings', key: 'seo_view' },
  { title: 'Manage SEO Settings', key: 'seo_manage' },

  // Homepage Management
  { title: 'View Homepage Design', key: 'homepage_view' },
  { title: 'Manage Homepage Design', key: 'homepage_manage' },

  // Customer Management
  { title: 'View Customer Data', key: 'customer_view' },
  { title: 'Manage Customers', key: 'customer_manage' },
];

async function insertPermissions() {
  try {
    await client.connect();
    console.log("Connected to database");

    for (const p of newPermissions) {
      // We provide timestamps manually since we are using raw pg and not Prisma here
      await client.query(`
        INSERT INTO permissions (id, title, key, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
        ON CONFLICT (key) DO UPDATE SET title = $1, updated_at = NOW()
      `, [p.title, p.key]);
      console.log(`- Inserted/Updated: ${p.title} (${p.key})`);
    }
    console.log("All missing permissions have been added successfully.");
  } catch (error) {
    console.error("Error inserting permissions:", error);
  } finally {
    await client.end();
  }
}

insertPermissions();
