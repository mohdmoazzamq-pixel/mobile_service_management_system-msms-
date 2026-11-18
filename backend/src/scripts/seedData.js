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

    // 7. Seed Demo Bookings, Repairs, and Invoices for Demo Customers
    const adminUserRes = await client.query("SELECT id FROM users WHERE email = 'admin@msms.local'");
    const adminUserId = adminUserRes.rows[0]?.id;

    const alexTechRes = await client.query("SELECT t.id, t.user_id FROM technicians t JOIN users u ON t.user_id = u.id WHERE u.email = 'tech.alex@msms.local'");
    const alexTechId = alexTechRes.rows[0]?.id;
    const alexUserId = alexTechRes.rows[0]?.user_id;

    const sarahTechRes = await client.query("SELECT t.id, t.user_id FROM technicians t JOIN users u ON t.user_id = u.id WHERE u.email = 'tech.sarah@msms.local'");
    const sarahTechId = sarahTechRes.rows[0]?.id;
    const sarahUserId = sarahTechRes.rows[0]?.user_id;

    const screenSvcRes = await client.query("SELECT id FROM services WHERE service_name = 'Screen Replacement'");
    const screenSvcId = screenSvcRes.rows[0]?.id;

    const battSvcRes = await client.query("SELECT id FROM services WHERE service_name = 'Battery Replacement'");
    const battSvcId = battSvcRes.rows[0]?.id;

    const portSvcRes = await client.query("SELECT id FROM services WHERE service_name = 'Charging Port Repair'");
    const portSvcId = portSvcRes.rows[0]?.id;

    const dispPartRes = await client.query("SELECT id FROM spare_parts WHERE part_code = 'DISP-IP14P-01'");
    const dispPartId = dispPartRes.rows[0]?.id;

    const battPartRes = await client.query("SELECT id FROM spare_parts WHERE part_code = 'BATT-SS23U-01'");
    const battPartId = battPartRes.rows[0]?.id;

    if (johnCustId) {
      const iphoneRes = await client.query("SELECT id FROM devices WHERE customer_id = $1 AND model = 'iPhone 14 Pro'", [johnCustId]);
      const iphoneId = iphoneRes.rows[0]?.id;

      const s23Res = await client.query("SELECT id FROM devices WHERE customer_id = $1 AND model = 'Galaxy S23 Ultra'", [johnCustId]);
      const s23Id = s23Res.rows[0]?.id;

      // Booking 1: Screen repair for iPhone 14 Pro (Completed & Invoiced)
      if (iphoneId && screenSvcId) {
        const b1Res = await client.query(`
          INSERT INTO bookings (booking_number, customer_id, device_id, service_id, problem_category, problem_description, preferred_date, booking_status)
          VALUES ('BK-20261101-JD01', $1, $2, $3, 'Display & Screen', 'Front screen cracked after dropping; touch is unresponsive in lower half.', '2026-11-01', 'APPROVED')
          ON CONFLICT (booking_number) DO UPDATE SET booking_status = 'APPROVED'
          RETURNING id
        `, [johnCustId, iphoneId, screenSvcId]);

        const b1Id = b1Res.rows[0].id;
        const rep1Res = await client.query(`
          INSERT INTO repairs (booking_id, technician_id, diagnosis, estimated_cost, final_cost, repair_status, actual_completion)
          VALUES ($1, $2, 'OLED digitizer shattered. Internal logic board tested fine.', 269.99, 269.99, 'REPAIR_COMPLETED', CURRENT_TIMESTAMP)
          ON CONFLICT (booking_id) DO UPDATE SET repair_status = 'REPAIR_COMPLETED', technician_id = EXCLUDED.technician_id, final_cost = 269.99
          RETURNING id
        `, [b1Id, alexTechId]);

        const rep1Id = rep1Res.rows[0].id;

        // History
        await client.query(`
          INSERT INTO repair_status_history (repair_id, old_status, new_status, updated_by, remarks)
          VALUES 
            ($1, NULL, 'DEVICE_RECEIVED', $2, 'Device received at repair center.'),
            ($1, 'DEVICE_RECEIVED', 'UNDER_DIAGNOSIS', $2, 'Screen diagnostic run, OEM panel ordered.'),
            ($1, 'UNDER_DIAGNOSIS', 'REPAIR_IN_PROGRESS', $2, 'Display assembly replaced and sealed.'),
            ($1, 'REPAIR_IN_PROGRESS', 'REPAIR_COMPLETED', $2, 'Display calibration successful. Ready for pickup.')
          ON CONFLICT DO NOTHING
        `, [rep1Id, adminUserId]);

        // Repair part
        if (dispPartId && alexUserId) {
          const exPart = await client.query('SELECT id FROM repair_parts WHERE repair_id = $1 AND part_id = $2', [rep1Id, dispPartId]);
          if (exPart.rowCount === 0) {
            await client.query(`
              INSERT INTO repair_parts (repair_id, part_id, quantity, unit_price, used_by)
              VALUES ($1, $2, 1, 220.00, $3)
            `, [rep1Id, dispPartId, alexUserId]);
          }
        }

        // Invoice 1
        await client.query(`
          INSERT INTO invoices (invoice_number, repair_id, customer_id, subtotal, tax_amount, discount, total_amount, payment_status, payment_method)
          VALUES ('INV-20261101-0001', $1, $2, 269.99, 21.60, 10.00, 281.59, 'PAID', 'CREDIT_CARD')
          ON CONFLICT (invoice_number) DO UPDATE SET payment_status = 'PAID', total_amount = 281.59
        `, [rep1Id, johnCustId]);
      }

      // Booking 2: Battery replacement for Galaxy S23 Ultra (In Progress & Invoiced)
      if (s23Id && battSvcId) {
        const b2Res = await client.query(`
          INSERT INTO bookings (booking_number, customer_id, device_id, service_id, problem_category, problem_description, preferred_date, booking_status)
          VALUES ('BK-20261115-JD02', $1, $2, $3, 'Battery & Power', 'Battery drains rapidly from 100% to 15% within 2 hours.', '2026-11-15', 'APPROVED')
          ON CONFLICT (booking_number) DO UPDATE SET booking_status = 'APPROVED'
          RETURNING id
        `, [johnCustId, s23Id, battSvcId]);

        const b2Id = b2Res.rows[0].id;
        const rep2Res = await client.query(`
          INSERT INTO repairs (booking_id, technician_id, diagnosis, estimated_cost, final_cost, repair_status)
          VALUES ($1, $2, 'Battery health degraded to 64%. Swelling detected.', 89.99, NULL, 'REPAIR_IN_PROGRESS')
          ON CONFLICT (booking_id) DO UPDATE SET repair_status = 'REPAIR_IN_PROGRESS', technician_id = EXCLUDED.technician_id
          RETURNING id
        `, [b2Id, sarahTechId]);

        const rep2Id = rep2Res.rows[0].id;

        // History
        await client.query(`
          INSERT INTO repair_status_history (repair_id, old_status, new_status, updated_by, remarks)
          VALUES 
            ($1, NULL, 'DEVICE_RECEIVED', $2, 'Device received at front desk.'),
            ($1, 'DEVICE_RECEIVED', 'UNDER_DIAGNOSIS', $2, 'Technician Sarah ran battery charge cycle test.'),
            ($1, 'UNDER_DIAGNOSIS', 'REPAIR_IN_PROGRESS', $2, 'New OEM battery installed, adhesive curing.')
          ON CONFLICT DO NOTHING
        `, [rep2Id, adminUserId]);

        // Repair part
        if (battPartId && sarahUserId) {
          const exPart2 = await client.query('SELECT id FROM repair_parts WHERE repair_id = $1 AND part_id = $2', [rep2Id, battPartId]);
          if (exPart2.rowCount === 0) {
            await client.query(`
              INSERT INTO repair_parts (repair_id, part_id, quantity, unit_price, used_by)
              VALUES ($1, $2, 1, 60.00, $3)
            `, [rep2Id, battPartId, sarahUserId]);
          }
        }

        // Invoice 2
        await client.query(`
          INSERT INTO invoices (invoice_number, repair_id, customer_id, subtotal, tax_amount, discount, total_amount, payment_status, payment_method)
          VALUES ('INV-20261115-0002', $1, $2, 89.99, 7.20, 0.00, 97.19, 'UNPAID', 'CASH')
          ON CONFLICT (invoice_number) DO UPDATE SET payment_status = 'UNPAID', total_amount = 97.19
        `, [rep2Id, johnCustId]);
      }
    }

    if (emilyCustId) {
      const pixelRes = await client.query("SELECT id FROM devices WHERE customer_id = $1 AND model = 'Pixel 8'", [emilyCustId]);
      const pixelId = pixelRes.rows[0]?.id;

      if (pixelId && portSvcId) {
        await client.query(`
          INSERT INTO bookings (booking_number, customer_id, device_id, service_id, problem_category, problem_description, preferred_date, booking_status)
          VALUES ('BK-20261116-EW01', $1, $2, $3, 'Charging & Port', 'Device does not charge unless cable is held at an upward angle.', '2026-11-16', 'PENDING')
          ON CONFLICT (booking_number) DO NOTHING
        `, [emilyCustId, pixelId, portSvcId]);
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
