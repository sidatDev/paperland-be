const { Client } = require("pg");
require("dotenv").config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function checkPermissions() {
  try {
    await client.connect();
    console.log("Connected to database");

    const res = await client.query(`
      SELECT id, title, key FROM permissions ORDER BY key ASC
    `);
    console.log("All Permissions:");
    res.rows.forEach(p => {
        console.log(`- ${p.title} (${p.key})`);
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.end();
  }
}

checkPermissions();
