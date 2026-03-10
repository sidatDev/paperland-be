const { Client } = require("pg");
require("dotenv").config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("Connected to PG");

    console.log("\n--- 1. All B2B Company Details Entries ---");
    const b2bRes = await client.query(
      "SELECT user_id, company_name FROM b2b_company_details LIMIT 5",
    );
    console.table(b2bRes.rows);

    console.log("\n--- 2. Users with B2B details match ---");
    const userRes = await client.query(`
      SELECT u.email, u.account_status, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id IN (SELECT user_id FROM b2b_company_details)
      LIMIT 10
    `);
    console.table(userRes.rows);

    console.log("\n--- 3. Checking for specific account_status values ---");
    const statusRes = await client.query(
      "SELECT account_status, count(*) FROM users GROUP BY account_status",
    );
    console.table(statusRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
