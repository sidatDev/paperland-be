const { Client } = require("pg");
require("dotenv").config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function checkRecentUsers() {
  try {
    await client.connect();
    console.log("Connected to database");

    const userRes = await client.query(`
      SELECT u.id, u.email, u.account_status, r.name as role_name, 
             (SELECT count(*) FROM b2b_company_details b WHERE b.user_id = u.id) as has_details
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY u.created_at DESC
      LIMIT 5
    `);
    console.log("Recent Users:");
    console.table(userRes.rows);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.end();
  }
}

checkRecentUsers();
