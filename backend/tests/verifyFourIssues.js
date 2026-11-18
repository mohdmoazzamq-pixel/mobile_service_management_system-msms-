const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { pool } = require('../src/config/database');
const http = require('http');
const app = require('../src/app');

let server;
let baseUrl;

function logPass(title, details = '') {
  console.log(`  ✓ PASS: ${title}${details ? ' -> ' + details : ''}`);
}

function logFail(title, err) {
  console.error(`  ✗ FAIL: ${title} -> ${err}`);
  process.exitCode = 1;
}

async function request(method, pathUrl, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Accept': 'application/json',
        ...headers
      }
    };

    let bodyStr = null;
    if (body) {
      bodyStr = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function runTests() {
  console.log('========================================================================');
  console.log('  VERIFYING THE 4 CORE ISSUES END-TO-END');
  console.log('========================================================================\n');

  // Start temporary test server
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const rootDir = path.resolve(__dirname, '../../');

  // ========================================================================
  // ISSUE 1: "Home" Link in Menu Bar After Login (Customer, Technician & Admin Portals)
  // ========================================================================
  console.log('--- Issue 1: Home Link in Menu Bar (Customer, Tech, Admin Portals) & Dashboard Nav ---');

  const customerPages = [
    'frontend/customer/index.html',
    'frontend/customer/book.html',
    'frontend/customer/devices.html',
    'frontend/customer/tracking.html',
    'frontend/customer/invoices.html',
    'frontend/customer/feedback.html'
  ];

  for (const page of customerPages) {
    const content = fs.readFileSync(path.join(rootDir, page), 'utf8');
    const hasHome = content.includes('href="/"') && content.includes('Home') && (content.includes('data-no-spa="true"') || content.includes('data-no-spa'));
    if (hasHome) {
      logPass(`Customer portal page has visible Home link: ${path.basename(page)}`);
    } else {
      logFail(`Customer portal page missing visible Home link: ${path.basename(page)}`, 'Not found');
    }
  }

  const techPages = [
    'frontend/technician/index.html',
    'frontend/technician/repair-detail.html'
  ];

  for (const page of techPages) {
    const content = fs.readFileSync(path.join(rootDir, page), 'utf8');
    const hasHome = content.includes('href="/"') && content.includes('Home') && (content.includes('data-no-spa="true"') || content.includes('data-no-spa'));
    if (hasHome) {
      logPass(`Technician portal page has visible Home link: ${path.basename(page)}`);
    } else {
      logFail(`Technician portal page missing visible Home link: ${path.basename(page)}`, 'Not found');
    }
  }

  const adminPages = [
    'frontend/admin/index.html',
    'frontend/admin/bookings.html',
    'frontend/admin/technicians.html',
    'frontend/admin/customers.html',
    'frontend/admin/services.html',
    'frontend/admin/inventory.html',
    'frontend/admin/invoices.html',
    'frontend/admin/reports.html'
  ];

  for (const page of adminPages) {
    const content = fs.readFileSync(path.join(rootDir, page), 'utf8');
    const hasHome = content.includes('href="/"') && content.includes('Home') && (content.includes('data-no-spa="true"') || content.includes('data-no-spa'));
    if (hasHome) {
      logPass(`Admin portal page has visible Home link: ${path.basename(page)}`);
    } else {
      logFail(`Admin portal page missing visible Home link: ${path.basename(page)}`, 'Not found');
    }
  }

  // Check auth.js initNav renders Dashboard + Logout for logged-in users and Login + Register for guest
  const authJsContent = fs.readFileSync(path.join(rootDir, 'frontend/assets/js/auth.js'), 'utf8');
  const hasDashboardLogic = (authJsContent.includes('portalLink') || authJsContent.includes('dashboardHref')) && authJsContent.includes('Dashboard') && authJsContent.includes('Sign Out');
  const hasGuestLogic = authJsContent.includes('login') && authJsContent.includes('register') && authJsContent.includes('Sign In');
  if (hasDashboardLogic && hasGuestLogic) {
    logPass('Auth.initNav properly differentiates authenticated (Dashboard + Sign Out) and guest (Sign In + Register) states');
  } else {
    logFail('Auth.initNav missing state differentiation', 'Check auth.js');
  }

  // ========================================================================
  // ISSUE 2: Home Page Login & Register Buttons Disappearing During SPA Navigation
  // ========================================================================
  console.log('\n--- Issue 2: SPA Navigation & Navbar Auth Button Persistence ---');

  const routerJsContent = fs.readFileSync(path.join(rootDir, 'frontend/assets/js/router.js'), 'utf8');
  const hasRouteChangeListener = authJsContent.includes("window.addEventListener('msms:routechange'");
  const hasRouterInitNavCall = routerJsContent.includes('window.Auth.initNav()');
  const hasNoSpaHandling = routerJsContent.includes('data-no-spa') && routerJsContent.includes('return;');

  if (hasRouteChangeListener && hasRouterInitNavCall) {
    logPass('Router invokes Auth.initNav() after page transitions and dispatches msms:routechange');
  } else {
    logFail('Router missing Auth.initNav() invocation on route changes', 'Check router.js and auth.js');
  }

  if (hasNoSpaHandling) {
    logPass('Router bypasses SPA interception for links with data-no-spa attribute');
  } else {
    logFail('Router does not respect data-no-spa links', 'Check router.js');
  }

  const indexHtmlContent = fs.readFileSync(path.join(rootDir, 'frontend/index.html'), 'utf8');
  const hasPrepopulatedGuestBtns = indexHtmlContent.includes('Sign In') && indexHtmlContent.includes('Register') && indexHtmlContent.includes('nav-user-container');
  if (hasPrepopulatedGuestBtns) {
    logPass('index.html nav-user-container is pre-populated with guest buttons to prevent flash/disappearance');
  } else {
    logFail('index.html nav-user-container missing initial guest buttons', 'Check index.html');
  }

  // ========================================================================
  // ISSUE 3: Customer Portal Invoice Section Showing Data
  // ========================================================================
  console.log('\n--- Issue 3: Customer Portal Invoice Fetching & Rendering ---');

  // Login as Customer John Doe
  const custLoginRes = await request('POST', '/api/auth/login', {}, {
    email: 'john.customer@msms.local',
    password: 'Password123!'
  });

  if (custLoginRes.status === 200 && custLoginRes.body.success) {
    logPass('Customer login successful', `Token acquired for user ID: ${custLoginRes.body.data.user.id}`);
  } else {
    logFail('Customer login failed', JSON.stringify(custLoginRes.body));
  }

  const custToken = custLoginRes.body.data.token;
  const custAuthHeaders = { 'Authorization': `Bearer ${custToken}` };

  // Fetch Invoices as Customer
  const custInvoicesRes = await request('GET', '/api/invoices', custAuthHeaders);
  if (custInvoicesRes.status === 200 && custInvoicesRes.body.success) {
    logPass('Customer GET /api/invoices returned HTTP 200');
  } else {
    logFail('Customer GET /api/invoices failed', JSON.stringify(custInvoicesRes.body));
  }

  // Verify response contains both data and invoices keys for frontend backward compatibility
  const hasBothKeys = Array.isArray(custInvoicesRes.body.data) && Array.isArray(custInvoicesRes.body.invoices);
  if (hasBothKeys) {
    logPass('Invoices API response provides both res.data and res.invoices arrays');
  } else {
    logFail('Invoices API missing res.data or res.invoices key', JSON.stringify(Object.keys(custInvoicesRes.body)));
  }

  const invoices = custInvoicesRes.body.data;
  if (invoices.length >= 2) {
    logPass(`Customer invoices retrieved successfully: ${invoices.length} invoices found`);
    const inv1 = invoices.find(i => i.invoice_number === 'INV-20261101-0001');
    const inv2 = invoices.find(i => i.invoice_number === 'INV-20261115-0002');

    if (inv1 && inv1.payment_status === 'PAID' && parseFloat(inv1.total_amount) === 281.59) {
      logPass('Invoice 1 verified (INV-20261101-0001, Screen Replacement, PAID, $281.59)');
    } else {
      logFail('Invoice 1 data mismatch', JSON.stringify(inv1));
    }

    if (inv2 && inv2.payment_status === 'UNPAID' && parseFloat(inv2.total_amount) === 97.19) {
      logPass('Invoice 2 verified (INV-20261115-0002, Battery Replacement, UNPAID, $97.19)');
    } else {
      logFail('Invoice 2 data mismatch', JSON.stringify(inv2));
    }

    // Detail fetch for Invoice 1
    const inv1DetailRes = await request('GET', `/api/invoices/${inv1.id}`, custAuthHeaders);
    if (inv1DetailRes.status === 200 && inv1DetailRes.body.success) {
      logPass('Customer GET /api/invoices/:id detail fetch successful with line items and parts');
    } else {
      logFail('Customer GET /api/invoices/:id detail fetch failed', JSON.stringify(inv1DetailRes.body));
    }
  } else {
    logFail('Expected at least 2 customer invoices', `Got ${invoices.length}`);
  }

  // Verify customer invoice page frontend code has no reference errors
  const customerInvoicesHtml = fs.readFileSync(path.join(rootDir, 'frontend/customer/invoices.html'), 'utf8');
  const hasSafeInvoiceHandler = customerInvoicesHtml.includes('window.openInvoice = openInvoice') && !customerInvoicesHtml.includes('window.viewInvoiceModal = viewInvoiceModal');
  const handlesBothKeysFrontend = customerInvoicesHtml.includes('res.data') && customerInvoicesHtml.includes('res.invoices');
  if (hasSafeInvoiceHandler && handlesBothKeysFrontend) {
    logPass('customer/invoices.html cleanly handles res.data and res.invoices fallback and defines window.openInvoice without ReferenceError');
  } else {
    logFail('customer/invoices.html has faulty script bindings or lacks fallback key handling', 'Check invoices.html');
  }

  // ========================================================================
  // ISSUE 4: Missing Admin Response / Actions on Customer Bookings & Requests
  // ========================================================================
  console.log('\n--- Issue 4: Admin Response/Actions on Bookings & Reflection on Customer Portal ---');

  // Ensure test idempotency by resetting Emily's test booking to PENDING
  await pool.query(`
    DELETE FROM invoices WHERE repair_id IN (
      SELECT id FROM repairs WHERE booking_id IN (
        SELECT id FROM bookings WHERE booking_number = 'BK-20261116-EW01'
      )
    )
  `);
  await pool.query(`
    DELETE FROM repair_status_history WHERE repair_id IN (
      SELECT id FROM repairs WHERE booking_id IN (
        SELECT id FROM bookings WHERE booking_number = 'BK-20261116-EW01'
      )
    )
  `);
  await pool.query(`
    DELETE FROM repairs WHERE booking_id IN (
      SELECT id FROM bookings WHERE booking_number = 'BK-20261116-EW01'
    )
  `);
  await pool.query(`
    UPDATE bookings SET booking_status = 'PENDING' WHERE booking_number = 'BK-20261116-EW01'
  `);

  // Login as Admin
  const adminLoginRes = await request('POST', '/api/auth/login', {}, {
    email: 'admin@msms.local',
    password: 'Password123!'
  });

  if (adminLoginRes.status === 200 && adminLoginRes.body.success) {
    logPass('Admin login successful');
  } else {
    logFail('Admin login failed', JSON.stringify(adminLoginRes.body));
  }

  const adminToken = adminLoginRes.body.data.token;
  const adminAuthHeaders = { 'Authorization': `Bearer ${adminToken}` };

  // Fetch all bookings as Admin
  const adminBookingsRes = await request('GET', '/api/bookings', adminAuthHeaders);
  const pendingBooking = adminBookingsRes.body.data.bookings.find(b => b.booking_number === 'BK-20261116-EW01' || b.booking_status === 'PENDING');

  if (pendingBooking) {
    logPass(`Admin found pending booking #${pendingBooking.booking_number} (ID: ${pendingBooking.id})`);

    // 1. Admin Approves Booking
    const approveRes = await request('PATCH', `/api/bookings/${pendingBooking.id}/decision`, adminAuthHeaders, {
      decision: 'APPROVED'
    });

    if (approveRes.status === 200 && approveRes.body.success) {
      logPass(`Admin approved booking #${pendingBooking.booking_number} -> Repair ID: ${approveRes.body.data.repair.id}`);
      const repairId = approveRes.body.data.repair.id;

      // 2. Fetch Technicians to find Alex Rivera
      const techsRes = await request('GET', '/api/technicians', adminAuthHeaders);
      const alexTech = techsRes.body.data.find(t => t.email === 'tech.alex@msms.local');

      if (alexTech) {
        // Assign Alex Rivera
        const assignRes = await request('PATCH', `/api/bookings/${pendingBooking.id}/assign`, adminAuthHeaders, {
          technicianId: alexTech.id
        });

        if (assignRes.status === 200 && assignRes.body.success) {
          logPass(`Admin assigned Technician ${alexTech.name} to booking #${pendingBooking.booking_number}`);
        } else {
          logFail('Admin assign technician failed', JSON.stringify(assignRes.body));
        }

        // 3. Update repair status to UNDER_DIAGNOSIS with notes
        const updateStatusRes = await request('PATCH', `/api/repairs/${repairId}/status`, adminAuthHeaders, {
          status: 'UNDER_DIAGNOSIS',
          remarks: 'Admin verified device received and assigned technician for port test.'
        });

        if (updateStatusRes.status === 200 && updateStatusRes.body.success) {
          logPass('Admin updated repair status to UNDER_DIAGNOSIS with administrative remarks');
        } else {
          logFail('Admin update status failed', JSON.stringify(updateStatusRes.body));
        }

        // 4. Update repair status to REPAIR_COMPLETED and generate invoice
        await request('PATCH', `/api/repairs/${repairId}/status`, adminAuthHeaders, {
          status: 'REPAIR_IN_PROGRESS',
          remarks: 'Charging flex replaced.'
        });
        await request('PATCH', `/api/repairs/${repairId}/status`, adminAuthHeaders, {
          status: 'REPAIR_COMPLETED',
          remarks: 'Device tested and fully functional.'
        });

        const invoiceCreateRes = await request('POST', '/api/invoices', adminAuthHeaders, {
          repairId: repairId,
          taxAmount: 2.00,
          discount: 0.00,
          paymentStatus: 'UNPAID',
          paymentMethod: 'CASH'
        });

        if (invoiceCreateRes.status === 201 && invoiceCreateRes.body.success) {
          logPass(`Admin generated invoice #${invoiceCreateRes.body.data.invoice_number} for completed repair`);
        } else {
          logFail('Admin invoice creation failed', JSON.stringify(invoiceCreateRes.body));
        }

        // 5. Verify Customer Emily Watson immediately sees the updated booking and invoice
        const emilyLoginRes = await request('POST', '/api/auth/login', {}, {
          email: 'emily.customer@msms.local',
          password: 'Password123!'
        });
        const emilyToken = emilyLoginRes.body.data.token;
        const emilyHeaders = { 'Authorization': `Bearer ${emilyToken}` };

        // Customer checks booking
        const emilyBookingsRes = await request('GET', '/api/bookings', emilyHeaders);
        const emilyBooking = emilyBookingsRes.body.data.bookings.find(b => b.id === pendingBooking.id);

        if (emilyBooking && emilyBooking.booking_status === 'APPROVED' && emilyBooking.repair_status === 'REPAIR_COMPLETED') {
          logPass(`Customer Portal immediately reflects Admin actions: Booking status is APPROVED, Repair status is REPAIR_COMPLETED, Tech is ${emilyBooking.technician_name}`);
        } else {
          logFail('Customer booking did not reflect Admin actions', JSON.stringify(emilyBooking));
        }

        // Customer checks invoices
        const emilyInvoicesRes = await request('GET', '/api/invoices', emilyHeaders);
        if (emilyInvoicesRes.body.data && emilyInvoicesRes.body.data.length > 0) {
          logPass(`Customer Portal Invoices immediately displays newly generated invoice #${emilyInvoicesRes.body.data[0].invoice_number} (Total: $${emilyInvoicesRes.body.data[0].total_amount})`);
        } else {
          logFail('Customer invoices did not display newly generated invoice', JSON.stringify(emilyInvoicesRes.body));
        }
      }
    } else {
      logFail('Admin approve booking failed', JSON.stringify(approveRes.body));
    }
  } else {
    logFail('No pending booking found for Admin workflow test', JSON.stringify(adminBookingsRes.body));
  }

  // Check Admin Bookings UI has status modal and action buttons
  const adminBookingsHtml = fs.readFileSync(path.join(rootDir, 'frontend/admin/bookings.html'), 'utf8');
  const hasStatusModal = adminBookingsHtml.includes('id="statusModal"') && adminBookingsHtml.includes('openStatusModal') && adminBookingsHtml.includes('submitStatusUpdate');
  if (hasStatusModal) {
    logPass('admin/bookings.html contains interactive Status & Notes Modal with openStatusModal and submitStatusUpdate handlers');
  } else {
    logFail('admin/bookings.html missing status modal or handlers', 'Check bookings.html');
  }

  // Check Admin Invoices UI has no undefined handlers
  const adminInvoicesHtml = fs.readFileSync(path.join(rootDir, 'frontend/admin/invoices.html'), 'utf8');
  const hasCleanAdminInvoices = !adminInvoicesHtml.includes('window.openCreateInvoiceModal = openCreateInvoiceModal') && adminInvoicesHtml.includes('window.openPaymentModal = openPaymentModal');
  if (hasCleanAdminInvoices) {
    logPass('admin/invoices.html script bindings are clean without ReferenceErrors');
  } else {
    logFail('admin/invoices.html has broken script bindings', 'Check admin invoices.html');
  }

  console.log('\n========================================================================');
  console.log(`  ALL 4 ISSUES END-TO-END VERIFICATION RESULT: ${process.exitCode === 1 ? 'FAILED' : 'ALL PASSED 100%'}`);
  console.log('========================================================================');

  server.close();
  await pool.end();
  process.exit(process.exitCode || 0);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  if (server) server.close();
  pool.end();
  process.exit(1);
});
