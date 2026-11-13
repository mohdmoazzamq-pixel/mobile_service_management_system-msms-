/**
 * MSMS Routing, Navigation & Password Reset Flow Verification Test Suite
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const app = require('../src/app');
const { generateToken } = require('../src/utils/jwt');
const { pool } = require('../src/config/database');

async function runTests() {
  console.log('========================================================================');
  console.log('  MSMS VERIFICATION SUITE: ROUTING, NAVIGATION & FORGOT PASSWORD FLOW');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message, testId = '') {
    total++;
    const prefix = testId ? `[${testId}] ` : '';
    if (condition) {
      console.log(`  ✓ PASS: ${prefix}${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${prefix}${message}`);
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 1: Static Files, Pages & Links Audit
  // -------------------------------------------------------------------------
  console.log('--- 1. Frontend Structure, Templates & Router Integration ---');

  const frontendDir = path.resolve(__dirname, '../../frontend');
  const requiredFiles = [
    'index.html',
    'login.html',
    'register.html',
    'forgot-password.html',
    'reset-password.html',
    '404.html',
    'assets/js/api.js',
    'assets/js/auth.js',
    'assets/js/router.js',
    'assets/css/style.css',
    'customer/index.html',
    'customer/book.html',
    'customer/devices.html',
    'customer/tracking.html',
    'customer/invoices.html',
    'customer/feedback.html',
    'admin/index.html',
    'admin/bookings.html',
    'admin/technicians.html',
    'admin/customers.html',
    'admin/services.html',
    'admin/inventory.html',
    'admin/invoices.html',
    'admin/reports.html',
    'technician/index.html',
    'technician/repair-detail.html'
  ];

  requiredFiles.forEach(rf => {
    const full = path.join(frontendDir, rf);
    assert(fs.existsSync(full), `Required file exists: ${rf}`, 'FILE-01');
  });

  // Verify router.js inclusion across HTML files
  const htmlFiles = requiredFiles.filter(f => f.endsWith('.html'));
  let allHaveRouter = true;
  htmlFiles.forEach(hf => {
    const content = fs.readFileSync(path.join(frontendDir, hf), 'utf8');
    if (!content.includes('router.js')) {
      allHaveRouter = false;
      console.error(`    Missing router.js script in: ${hf}`);
    }
  });
  assert(allHaveRouter, 'All frontend HTML templates include assets/js/router.js', 'ROUTER-01');

  // Verify login.html has Forgot Password link
  const loginHtml = fs.readFileSync(path.join(frontendDir, 'login.html'), 'utf8');
  assert(
    loginHtml.includes('Forgot Password?') && loginHtml.includes('/forgot-password'),
    'login.html contains visible "Forgot Password?" link targeting /forgot-password',
    'AUTH-UI-01'
  );

  // Verify forgot-password.html has form and inputs
  const forgotHtml = fs.readFileSync(path.join(frontendDir, 'forgot-password.html'), 'utf8');
  assert(
    forgotHtml.includes('type="email"') && forgotHtml.includes('/auth/forgot-password'),
    'forgot-password.html includes email input and connects to /auth/forgot-password endpoint',
    'AUTH-UI-02'
  );

  // Verify reset-password.html has password inputs and token support
  const resetHtml = fs.readFileSync(path.join(frontendDir, 'reset-password.html'), 'utf8');
  assert(
    resetHtml.includes('token') && resetHtml.includes('newPassword') && resetHtml.includes('/auth/reset-password'),
    'reset-password.html includes token detection, new password fields, and connects to /auth/reset-password',
    'AUTH-UI-03'
  );

  // -------------------------------------------------------------------------
  // SECTION 2: Server Routing & Endpoints
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Express Server Web Routing & Clean URLs ---');

  // Start internal test server
  let server, port;
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      port = server.address().port;
      resolve();
    });
  });

  function fetchUrl(pathname, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
      const headers = {};
      if (body) headers['Content-Type'] = 'application/json';

      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: pathname,
          method,
          headers
        },
        (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            let json = null;
            try { json = JSON.parse(data); } catch (e) { json = null; }
            resolve({ status: res.statusCode, headers: res.headers, text: data, json });
          });
        }
      );

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  // Test root and homepage
  const rootRes = await fetchUrl('/');
  assert(rootRes.status === 200 && rootRes.text.includes('MSMS'), 'GET / smoothly serves application entrypoint', 'SRV-01');

  // Test clean URLs without .html
  const cleanRoutes = [
    { url: '/login', expectText: 'Sign in to your account' },
    { url: '/register', expectText: 'Create Customer Account' },
    { url: '/forgot-password', expectText: 'Reset your password' },
    { url: '/reset-password', expectText: 'Create new password' },
    { url: '/customer/book', expectText: 'Submit a Repair Request' },
    { url: '/customer/devices', expectText: 'My Registered Devices' },
    { url: '/admin/bookings', expectText: 'Repair Bookings Management' },
    { url: '/technician', expectText: 'Technician Jobs Queue' }
  ];

  for (const cr of cleanRoutes) {
    const res = await fetchUrl(cr.url);
    assert(
      res.status === 200 && res.text.includes(cr.expectText),
      `Clean URL route "${cr.url}" resolves cleanly without .html extension (HTTP 200)`,
      'ROUTE-CLEAN'
    );
  }

  // Test .html URLs
  const htmlRoutes = [
    { url: '/login.html', expectText: 'Sign in to your account' },
    { url: '/forgot-password.html', expectText: 'Reset your password' },
    { url: '/customer/index.html', expectText: 'Customer Portal' }
  ];

  for (const hr of htmlRoutes) {
    const res = await fetchUrl(hr.url);
    assert(
      res.status === 200 && res.text.includes(hr.expectText),
      `Direct file route "${hr.url}" serves successfully (HTTP 200)`,
      'ROUTE-HTML'
    );
  }

  // Test 404 Fallback
  const notFoundRes = await fetchUrl('/non-existent-random-route-987');
  assert(
    notFoundRes.status === 404 && notFoundRes.text.includes('Page Not Found'),
    'Unknown web route returns HTTP 404 and serves customized 404.html template',
    'ROUTE-404'
  );

  const apiNotFoundRes = await fetchUrl('/api/non-existent-endpoint');
  assert(
    apiNotFoundRes.status === 404 && apiNotFoundRes.json && apiNotFoundRes.json.success === false,
    'Unknown API endpoint returns JSON error format with HTTP 404',
    'API-404'
  );

  // -------------------------------------------------------------------------
  // SECTION 3: Password Reset API End-to-End
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Password Reset API Controller & Validator Contracts ---');

  // Test forgot-password with missing email
  const emptyForgot = await fetchUrl('/api/auth/forgot-password', 'POST', {});
  assert(
    (emptyForgot.status === 400 || emptyForgot.status === 422) && (emptyForgot.json?.errors?.length > 0 || emptyForgot.json?.message),
    'POST /api/auth/forgot-password validates email requirement (HTTP 422/400)',
    'API-FP-01'
  );

  // Test forgot-password with malformed email
  const invalidForgot = await fetchUrl('/api/auth/forgot-password', 'POST', { email: 'not-an-email' });
  assert(
    invalidForgot.status === 400 || invalidForgot.status === 422,
    'POST /api/auth/forgot-password validates email format (HTTP 422/400)',
    'API-FP-02'
  );

  // Generate a mock reset token for end-to-end testing of reset-password endpoint
  const testEmail = 'reset.test.user@msms.local';
  try {
    await pool.query(
      "INSERT INTO users (name, email, phone, password_hash, role, is_active) VALUES ('Reset Tester', $1, '9999999999', 'fakehash', 'customer', true) ON CONFLICT (email) DO NOTHING",
      [testEmail]
    );
  } catch (e) {}
  const testUserRes = await pool.query('SELECT id FROM users WHERE email = $1', [testEmail]).catch(() => ({ rows: [{ id: 1 }] }));
  const testUserId = testUserRes.rows && testUserRes.rows[0] ? testUserRes.rows[0].id : 1;
  const testPayload = { id: testUserId, email: testEmail, type: 'password_reset' };
  const validResetToken = generateToken(testPayload);

  // Test reset-password with missing token
  const emptyReset = await fetchUrl('/api/auth/reset-password', 'POST', { newPassword: 'NewPassword123!' });
  assert(
    emptyReset.status === 400 || emptyReset.status === 422,
    'POST /api/auth/reset-password requires valid reset token (HTTP 422/400)',
    'API-RP-01'
  );

  // Test reset-password with short password (< 6 chars)
  const shortReset = await fetchUrl('/api/auth/reset-password', 'POST', {
    token: validResetToken,
    newPassword: '123'
  });
  assert(
    shortReset.status === 400 || shortReset.status === 422,
    'POST /api/auth/reset-password rejects passwords under 6 characters (HTTP 422/400)',
    'API-RP-02'
  );

  // Test reset-password with valid token and valid password
  const successfulReset = await fetchUrl('/api/auth/reset-password', 'POST', {
    token: validResetToken,
    newPassword: 'UpdatedSecurePassword2026!'
  });
  assert(
    successfulReset.status === 200 && successfulReset.json && successfulReset.json.success === true,
    'POST /api/auth/reset-password resets password successfully with valid credentials (HTTP 200)',
    'API-RP-03'
  );

  // Test reset-password token reuse prevention
  const reusedReset = await fetchUrl('/api/auth/reset-password', 'POST', {
    token: validResetToken,
    newPassword: 'AnotherPassword2026!'
  });
  assert(
    reusedReset.status === 400,
    'POST /api/auth/reset-password prevents reuse of already consumed reset token (HTTP 400)',
    'API-RP-04'
  );

  // Clean up server & db pool
  await new Promise(resolve => server.close(resolve));
  await pool.end().catch(() => {});

  console.log('\n========================================================================');
  console.log(`  Verification Completed: ${passed} / ${total} tests passed.`);
  console.log('========================================================================\n');

  if (passed !== total) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
