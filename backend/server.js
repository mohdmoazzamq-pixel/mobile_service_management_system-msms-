const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config(); // Fallback to cwd .env if present
const app = require('./src/app');
const { pool } = require('./src/config/database');

const port = Number(process.env.PORT || 5000);

async function start() {
  try {
    console.log(`[MSMS] Connecting to PostgreSQL on ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'mobile_service_management'}...`);
    await pool.query('SELECT 1');
    console.log('[MSMS] Connected successfully to local PostgreSQL database.');

    app.listen(port, () => {
      console.log('====================================================');
      console.log(`[MSMS] API Server running at: http://localhost:${port}`);
      console.log(`[MSMS] Health check:         http://localhost:${port}/api/health`);
      console.log(`[MSMS] Environment:          ${process.env.NODE_ENV || 'development'}`);
      console.log('====================================================');
    });
  } catch (error) {
    console.error('====================================================');
    console.error('[MSMS] STARTUP ERROR: Cannot connect to PostgreSQL database.');
    console.error(`Reason: ${error.message}`);
    console.error('Please check:');
    console.error('  1. PostgreSQL service is running.');
    console.error('  2. Database "mobile_service_management" exists.');
    console.error('  3. DB credentials in backend/.env match your local PostgreSQL.');
    console.error('====================================================');
    // TC-16: Server reports startup failure clearly and does not claim healthy status
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[MSMS] Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

start();
