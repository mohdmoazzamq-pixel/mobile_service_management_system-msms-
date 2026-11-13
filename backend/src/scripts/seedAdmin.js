const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

async function seedAdmin() {
  const adminName = process.argv[2] || 'System Administrator';
  const adminEmail = process.argv[3] || 'admin@msms.local';
  const adminPassword = process.argv[4] || 'Admin123!';

  console.log(`[SeedAdmin] Initializing Administrator: ${adminEmail}`);

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    const checkRes = await pool.query('SELECT id, role FROM users WHERE email = $1', [adminEmail]);

    if (checkRes.rowCount > 0) {
      console.log(`[SeedAdmin] User with email ${adminEmail} already exists. Updating credentials...`);
      await pool.query(
        'UPDATE users SET password_hash = $1, role = $2, is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [passwordHash, 'admin', checkRes.rows[0].id]
      );
      console.log(`[SeedAdmin] Admin account updated successfully! (ID: ${checkRes.rows[0].id})`);
    } else {
      const insertRes = await pool.query(
        `INSERT INTO users (name, email, phone, password_hash, role, is_active)
         VALUES ($1, $2, '9876543210', $3, 'admin', true)
         RETURNING id, name, email, role`,
        [adminName, adminEmail, passwordHash]
      );
      console.log(`[SeedAdmin] Admin account created successfully! (ID: ${insertRes.rows[0].id})`);
    }

    console.log('===================================================');
    console.log('Default Admin Credentials:');
    console.log(`  Email:    ${adminEmail}`);
    console.log(`  Password: ${adminPassword}`);
    console.log('===================================================');
  } catch (error) {
    console.error('[SeedAdmin] Failed to seed administrator:', error.message);
  } finally {
    await pool.end();
  }
}

seedAdmin();
