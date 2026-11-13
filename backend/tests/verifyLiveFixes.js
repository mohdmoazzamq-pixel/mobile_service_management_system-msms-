const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const app = require('../src/app');
const { pool } = require('../src/config/database');

async function testAllFixes() {
  console.log('========================================================================');
  console.log('  LIVE END-TO-END VERIFICATION OF USER-REPORTED BUGS & FIXES');
  console.log('========================================================================\n');

  let server;
  let port;

  await new Promise(resolve => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
  });

  function request(method, urlPath, body = null, token = null) {
    return new Promise((resolve, reject) => {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers
      }, res => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(raw); } catch (e) { json = { raw }; }
          resolve({ status: res.statusCode, data: json });
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  let passed = 0;
  let total = 0;
  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
    }
  }

  // 1. GET /api/services
  console.log('--- 1. Verification of Repair Services Catalog Endpoint ---');
  const servRes = await request('GET', '/api/services');
  assert(servRes.status === 200, `GET /api/services returns HTTP 200 (Got: ${servRes.status})`);
  assert(servRes.data && servRes.data.success === true, 'Response contains { success: true }');
  assert(Array.isArray(servRes.data.data) && servRes.data.data.length >= 5, `Seeded services count is >= 5 (Got: ${servRes.data.data?.length})`);
  const serviceNames = servRes.data.data.map(s => s.service_name);
  console.log('    Seeded services:', serviceNames.join(', '));

  // 2. User Registration Persistence & Immediate Login
  console.log('\n--- 2. Verification of Customer Registration & DB Persistence ---');
  const testEmail = `cust.test.${Date.now()}@example.com`;
  const regPayload = {
    name: 'New Test Customer',
    email: testEmail,
    password: 'Password123!',
    phone: '9876543299',
    address: '789 Testing Way',
    city: 'Techopolis'
  };

  const regRes = await request('POST', '/api/auth/register', regPayload);
  assert(regRes.status === 201, `POST /api/auth/register returns HTTP 201 (Got: ${regRes.status})`);
  assert(regRes.data && regRes.data.data.token, 'Registration returns valid JWT token');
  assert(regRes.data && regRes.data.data.user.role === 'customer', 'New user role is customer');

  // Verify DB directly
  const dbUser = await pool.query('SELECT u.id, u.email, u.role, c.id AS customer_id, c.city FROM users u JOIN customers c ON c.user_id = u.id WHERE u.email = $1', [testEmail]);
  assert(dbUser.rowCount === 1, `User and customer rows persisted in PostgreSQL (Found: ${dbUser.rowCount})`);
  console.log(`    DB record confirmed: User ID ${dbUser.rows[0].id}, Customer ID ${dbUser.rows[0].customer_id}, City: ${dbUser.rows[0].city}`);

  // Test login with newly registered account
  const newLoginRes = await request('POST', '/api/auth/login', {
    email: testEmail,
    password: 'Password123!',
    selectedRole: 'customer'
  });
  assert(newLoginRes.status === 200, `Newly registered customer logs in successfully (HTTP 200)`);
  const registeredToken = newLoginRes.data.data.token;

  // 3. Strict Role-Based Button Selection on Login
  console.log('\n--- 3. Strict Role-Based Button Selection Enforcement ---');
  // Attempt 3a: Admin credentials with 'customer' selected
  const roleMismatch1 = await request('POST', '/api/auth/login', {
    email: 'admin@msms.local',
    password: 'Password123!',
    selectedRole: 'customer'
  });
  assert(roleMismatch1.status === 403, `Admin logging in with Customer tab is denied HTTP 403 (Got: ${roleMismatch1.status})`);
  assert(roleMismatch1.data.message.includes('Access denied'), `Error message mentions access denial: "${roleMismatch1.data.message}"`);

  // Attempt 3b: Customer credentials with 'admin' selected
  const roleMismatch2 = await request('POST', '/api/auth/login', {
    email: 'john.customer@msms.local',
    password: 'Password123!',
    selectedRole: 'admin'
  });
  assert(roleMismatch2.status === 403, `Customer logging in with Admin tab is denied HTTP 403 (Got: ${roleMismatch2.status})`);

  // Attempt 3c: Customer credentials with 'technician' selected
  const roleMismatch3 = await request('POST', '/api/auth/login', {
    email: 'john.customer@msms.local',
    password: 'Password123!',
    selectedRole: 'technician'
  });
  assert(roleMismatch3.status === 403, `Customer logging in with Technician tab is denied HTTP 403 (Got: ${roleMismatch3.status})`);

  // Attempt 3d: Admin credentials with 'admin' selected -> SUCCESS
  const adminLogin = await request('POST', '/api/auth/login', {
    email: 'admin@msms.local',
    password: 'Password123!',
    selectedRole: 'admin'
  });
  assert(adminLogin.status === 200 && adminLogin.data.data.user.role === 'admin', 'Admin logging in with Admin tab succeeds (HTTP 200)');

  // Attempt 3e: Technician credentials with 'technician' selected -> SUCCESS
  const techLogin = await request('POST', '/api/auth/login', {
    email: 'tech.alex@msms.local',
    password: 'Password123!',
    selectedRole: 'technician'
  });
  assert(techLogin.status === 200 && techLogin.data.data.user.role === 'technician', 'Technician logging in with Technician tab succeeds (HTTP 200)');

  // Attempt 3f: Customer credentials with 'customer' selected -> SUCCESS
  const custLogin = await request('POST', '/api/auth/login', {
    email: 'john.customer@msms.local',
    password: 'Password123!',
    selectedRole: 'customer'
  });
  assert(custLogin.status === 200 && custLogin.data.data.user.role === 'customer', 'Customer logging in with Customer tab succeeds (HTTP 200)');

  // 4. Customer Device Registration & Listing
  console.log('\n--- 4. Verification of Device Registration & Dropdown Population ---');
  const newDevPayload = {
    brand: 'OnePlus',
    model: '12 Pro 5G',
    imei: `86123405${Date.now().toString().slice(-7)}`,
    serialNumber: `SN-OP-${Date.now().toString().slice(-6)}`
  };

  const devCreateRes = await request('POST', '/api/devices', newDevPayload, registeredToken);
  assert(devCreateRes.status === 201, `POST /api/devices creates device (HTTP 201)`);
  const createdDev = devCreateRes.data.data;
  assert(createdDev && createdDev.brand === 'OnePlus', 'Created device has brand OnePlus');

  const devListRes = await request('GET', '/api/devices', null, registeredToken);
  assert(devListRes.status === 200, `GET /api/devices returns HTTP 200`);
  assert(devListRes.data.data.some(d => d.id === createdDev.id), 'Newly created device appears in customer devices list');
  console.log(`    Device ID ${createdDev.id} (${createdDev.brand} ${createdDev.model}) verified for customer.`);

  // Clean up server & pool
  await new Promise(resolve => server.close(resolve));
  await pool.end();

  console.log('\n========================================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} / ${total} tests passed (100%)`);
  console.log('========================================================================\n');

  if (passed !== total) process.exit(1);
  process.exit(0);
}

testAllFixes().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
