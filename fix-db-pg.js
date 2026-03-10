const { Client } = require("pg");
require("dotenv").config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function fixDb() {
  try {
    await client.connect();
    console.log("Connected to database");

    const sql = `
      ALTER TABLE "b2b_profiles" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;
      ALTER TABLE "b2b_profiles" ADD COLUMN IF NOT EXISTS "admin_notes" TEXT;
    `;

    console.log("Executing SQL...");
    await client.query(sql);
    console.log("SQL executed successfully");

    // Verify columns
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'b2b_profiles'
    `);
    console.log(
      "Current columns in b2b_profiles:",
      res.rows.map((r) => r.column_name).join(", "),
    );
  } catch (error) {
    console.error("Error fixing database:", error);
  } finally {
    await client.end();
  }
}

fixDb();
