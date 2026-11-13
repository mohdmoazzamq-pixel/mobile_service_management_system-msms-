const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

async function seedData() {
  console.log('[SeedData] Seeding demo services, technicians, customers, devices, and inventory...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const defaultPassword = 'Password123!';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(defaultPassword, salt);

    // 1. Admin
    await client.query(`
      INSERT INTO users (name, email, phone, password_hash, role, is_active)
      VALUES ('System Administrator', 'admin@msms.local', '9876543210', $1, 'admin', true)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true
    `, [passwordHash]);

    // 2. Technicians
    const techUsers = [
      { name: 'Alex Rivera', email: 'tech.alex@msms.local', phone: '9876543211', spec: 'Display & Glass Replacement', exp: 5 },
      { name: 'Sarah Chen', email: 'tech.sarah@msms.local', phone: '9876543212', spec: 'Logic Board, Audio & Battery', exp: 4 }
    ];

    for (const t of techUsers) {
      const uRes = await client.query(`
        INSERT INTO users (name, email, phone, password_hash, role, is_active)
        VALUES ($1, $2, $3, $4, 'technician', true)
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true
        RETURNING id
      `, [t.name, t.email, t.phone, passwordHash]);

      const userId = uRes.rows[0].id;
      await client.query(`
        INSERT INTO technicians (user_id, specialization, experience_years, availability)
        VALUES ($1, $2, $3, 'AVAILABLE')
        ON CONFLICT (user_id) DO UPDATE SET specialization = EXCLUDED.specialization, experience_years = EXCLUDED.experience_years
      `, [userId, t.spec, t.exp]);
    }

    // 3. Customers
    const customerUsers = [
      { name: 'John Doe', email: 'john.customer@msms.local', phone: '9876543213', addr: '123 Tech Park Ave', city: 'Metro City' },
      { name: 'Emily Watson', email: 'emily.customer@msms.local', phone: '9876543214', addr: '456 Skyline Boulevard', city: 'North Haven' }
    ];

    const customerIds = [];
    for (const c of customerUsers) {
      const uRes = await client.query(`
        INSERT INTO users (name, email, phone, password_hash, role, is_active)
        VALUES ($1, $2, $3, $4, 'customer', true)
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true
        RETURNING id
      `, [c.name, c.email, c.phone, passwordHash]);

      const userId = uRes.rows[0].id;
      const cRes = await client.query(`
        INSERT INTO customers (user_id, address, city)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET address = EXCLUDED.address, city = EXCLUDED.city
        RETURNING id
      `, [userId, c.addr, c.city]);

      customerIds.push({ customerId: cRes.rows[0].id, email: c.email });
    }

    // 4. Devices
    const johnCustId = customerIds.find(c => c.email === 'john.customer@msms.local')?.customerId;
    if (johnCustId) {
      await client.query(`
        INSERT INTO devices (customer_id, brand, model, imei, serial_number)
        VALUES 
          ($1, 'Apple', 'iPhone 14 Pro', '359284102938475', 'DNPVG987MD6R'),
          ($1, 'Samsung', 'Galaxy S23 Ultra', '864920048192048', 'R5CT208XKLP')
        ON CONFLICT (imei) DO NOTHING
      `, [johnCustId]);
    }

    const emilyCustId = customerIds.find(c => c.email === 'emily.customer@msms.local')?.customerId;
    if (emilyCustId) {
      await client.query(`
        INSERT INTO devices (customer_id, brand, model, imei, serial_number)
        VALUES ($1, 'Google', 'Pixel 8', '352948190284719', '8A019D203491')
        ON CONFLICT (imei) DO NOTHING
      `, [emilyCustId]);
    }

    // 5. Services
    const services = [
      { name: 'Screen Replacement', desc: 'Mobile display inspection and complete panel replacement', price: 49.99 },
      { name: 'Battery Replacement', desc: 'Degraded battery diagnosis and OEM battery replacement', price: 29.99 },
      { name: 'Charging Port Repair', desc: 'Cleaning, re-soldering, or charging port flex replacement', price: 24.99 },
      { name: 'Software Troubleshooting', desc: 'OS reinstallation, boot loop fix, and firmware restore', price: 19.99 },
      { name: 'Water Damage Assessment & Ultrasonic Clean', desc: 'Ultrasonic chemical bath, drying and corrosion inspection', price: 39.99 }
    ];

    for (const s of services) {
      await client.query(`
        INSERT INTO services (service_name, description, base_price, is_active)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (service_name) DO UPDATE SET base_price = EXCLUDED.base_price, is_active = true, description = EXCLUDED.description
      `, [s.name, s.desc, s.price]);
    }

    // 6. Spare Parts
    const parts = [
      { name: 'iPhone 14 Pro OLED Display Assembly', code: 'DISP-IP14P-01', brand: 'Apple OEM', purchase: 140.00, sell: 220.00, qty: 15, min: 3 },
      { name: 'iPhone 14 Battery Pack (3200mAh)', code: 'BATT-IP14-01', brand: 'Apple OEM', purchase: 25.00, sell: 55.00, qty: 25, min: 5 },
      { name: 'Samsung S23 Ultra AMOLED Display Assembly', code: 'DISP-SS23U-01', brand: 'Samsung OEM', purchase: 160.00, sell: 250.00, qty: 10, min: 2 },
      { name: 'Samsung S23 Ultra Battery (5000mAh)', code: 'BATT-SS23U-01', brand: 'Samsung OEM', purchase: 28.00, sell: 60.00, qty: 18, min: 4 },
      { name: 'Universal USB-C Flex Port Type 3', code: 'PORT-USBC-03', brand: 'Generic OEM', purchase: 8.50, sell: 25.00, qty: 40, min: 10 },
      { name: 'Pixel 8 Tempered Outer Glass Cover', code: 'GLAS-PX8-01', brand: 'Google OEM', purchase: 15.00, sell: 35.00, qty: 12, min: 3 },
      { name: 'Thermal Heat Pad & Copper Shield Kit', code: 'THRM-GEN-01', brand: 'Generic', purchase: 3.00, sell: 10.00, qty: 50, min: 10 }
    ];

    for (const p of parts) {
      const pRes = await client.query(`
        INSERT INTO spare_parts (part_name, part_code, brand, purchase_price, selling_price, stock_quantity, minimum_stock, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        ON CONFLICT (part_code) DO UPDATE SET stock_quantity = EXCLUDED.stock_quantity
        RETURNING id
      `, [p.name, p.code, p.brand, p.purchase, p.sell, p.qty, p.min]);

      const partId = pRes.rows[0].id;
      // Record initial stock transaction if none exists
      const existingTx = await client.query('SELECT id FROM stock_transactions WHERE part_id = $1 LIMIT 1', [partId]);
      if (existingTx.rowCount === 0) {
        await client.query(`
          INSERT INTO stock_transactions (part_id, transaction_type, quantity, remarks)
          VALUES ($1, 'IN', $2, 'Initial stock entry from seed')
        `, [partId, p.qty]);
      }
    }

    await client.query('COMMIT');
    console.log('[SeedData] Seeding completed successfully!');
    console.log('Test Accounts available (all default password: Password123!):');
    console.log('  Admin:      admin@msms.local');
    console.log('  Technician: tech.alex@msms.local');
    console.log('  Technician: tech.sarah@msms.local');
    console.log('  Customer:   john.customer@msms.local');
    console.log('  Customer:   emily.customer@msms.local');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[SeedData] Error during seed:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedData();
