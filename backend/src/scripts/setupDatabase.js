/**
 * MSMS Automated Database Setup Utility
 * Executes Section 7.3 Core Schema & Section 7.4 Starter Data into PostgreSQL
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { pool } = require('../config/database');

async function setupDatabase() {
  const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');
  console.log('====================================================');
  console.log('  MSMS Database Setup Runner (Section 7.3)');
  console.log(`  Connecting to: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  console.log(`  Schema file:   ${schemaPath}`);
  console.log('====================================================\n');

  try {
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing Core Schema against database...');
    await pool.query(schemaSql);
    console.log('✓ Section 7.3 Core Schema executed successfully!');

    // Check tables in information_schema (Section 7.5)
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('\nVerified tables created in mobile_service_management:');
    tablesRes.rows.forEach(r => console.log(`  - ${r.table_name}`));

    console.log('\n====================================================');
    console.log('  Database setup completed successfully!');
    console.log('  You can now seed data using: npm run seed:data');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n✗ Database setup failed:');
    console.error(`  Error: ${err.message}`);
    console.error('\nPlease verify that:');
    console.error('  1. PostgreSQL service is running.');
    console.error(`  2. Database "${process.env.DB_NAME}" exists (create using: CREATE DATABASE ${process.env.DB_NAME};).`);
    console.error('  3. DB_USER and DB_PASSWORD in backend/.env are correct.\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();
