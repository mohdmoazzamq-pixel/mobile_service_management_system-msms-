# Mobile Service Management System (MSMS)
**Full SDLC, Technical Design & Complete Production-Ready Implementation**

> **Technology Stack:** HTML5 • CSS3 • JavaScript • Bootstrap 5 • Node.js • Express.js • PostgreSQL (Local)  
> **Document Reference:** `Mobile_Service_Management_System_Full_Executable_Documentation.docx`  
> **Target Audience:** Administrator, Customer, Technician  
> **Specification Compliance:** 100% (All 16 SRS Functional Requirements & Acceptance Tests TC-01 to TC-16 Verified)

---

## 1. Project Overview & Architecture

The **Mobile Service Management System (MSMS)** is an end-to-end responsive web application engineered for mobile phone repair centers. It centralizes:
- **Customer Registration & Mobile Device Catalog:** Customers add and manage smartphones (brand, model, IMEI, serial).
- **Repair Requests & Collision-Resistant Bookings:** Unique `BK-YYYYMMDD-XXXX` tracking references.
- **Administrative Control:** Review, approve/reject bookings, assign technicians, manage services & spare parts catalog.
- **Technician Workbench:** Interactive diagnostic documentation, repair stage advancement with audit remarks, and atomic spare parts consumption.
- **Inventory & Atomic Stock Ledger:** Prevents negative stock, records `IN`, `OUT`, and `ADJUSTMENT` transactions.
- **Server-Calculated Invoicing:** Computes labor + parts line items, generates `INV-YYYYMMDD-XXXX`, tracks cash/card/UPI payments.
- **Live Visual Tracking:** Real-time progress stepper and immutable audit log for customers (including public unauthenticated lookup).
- **Quality Feedback:** 5-star ratings and reviews on completed jobs.

---

## 2. Complete Directory Structure

```text
mobile-service-management/
├── database/
│   ├── schema.sql              # Section 7.3 Core Schema & Section 7.4 Starter Data
│   ├── seed.sql                # Complete seed data for demo accounts and inventory
│   ├── scripts/
│   │   ├── backup.ps1          # PowerShell automated database backup utility
│   │   ├── restore.ps1         # PowerShell database restore utility
│   │   ├── backup.bat          # Windows Command Prompt backup script
│   │   └── restore.bat         # Windows Command Prompt restore script
│   └── backups/                # Local directory for .dump database archives
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js     # PostgreSQL connection pool with transaction helper
│   │   ├── controllers/
│   │   │   ├── adminController.js
│   │   │   ├── authController.js       # Register, login, profile updates (FR-02)
│   │   │   ├── bookingController.js    # Create, review, assign, cancel (FR-07), public track
│   │   │   ├── customerController.js
│   │   │   ├── deviceController.js     # Add, list, edit, delete device (FR-03)
│   │   │   ├── feedbackController.js   # 5-star rating & review submission (FR-15)
│   │   │   ├── inventoryController.js  # Catalog, low stock alerts, stock ledger (FR-11)
│   │   │   ├── invoiceController.js    # Server-calculated invoices & payment states (FR-13)
│   │   │   ├── repairController.js     # Diagnosis, lifecycle stepper, atomic parts issue (FR-12)
│   │   │   ├── reportController.js     # Operational analytics & revenue summaries (FR-16)
│   │   │   ├── servicesController.js   # Service catalog CRUD & active toggle (FR-04)
│   │   │   └── technicianController.js # Roster, availability, job queues, active toggle
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js       # JWT extraction & active user verification
│   │   │   ├── roleMiddleware.js       # Strict RBAC (admin, customer, technician)
│   │   │   ├── validatorMiddleware.js  # Express-validator response formatter
│   │   │   ├── uploadMiddleware.js     # Multer (JPEG/PNG/WebP, 5MB limit)
│   │   │   └── errorHandler.js         # Centralized error handler
│   │   ├── routes/                     # Modular REST API endpoints
│   │   ├── utils/                      # ID generators, response helpers, JWT
│   │   ├── validators/                 # Input validation rules
│   │   ├── scripts/
│   │   │   ├── setupDatabase.js        # Automated DB schema runner (npm run db:setup)
│   │   │   ├── seedAdmin.js            # Initial administrator provisioning script
│   │   │   └── seedData.js             # Demo data seeding script
│   │   └── app.js                      # Express app, Helmet, CORS, Rate limiting, Static Web Serving
│   ├── tests/
│   │   ├── verifyAllFlows.js           # Quick system verification suite
│   │   └── automatedTests.js           # Comprehensive Acceptance Test Suite (TC-01 - TC-16)
│   ├── uploads/                        # Local file storage for defect photos
│   ├── server.js                       # Server entry point with DB health check
│   ├── package.json                    # Node dependencies and scripts
│   ├── ecosystem.config.js             # PM2 cluster configuration for production
│   ├── .env                            # Active environment configuration
│   └── .env.production                 # Production deployment template
├── frontend/
│   ├── index.html                      # Public landing page with instant tracking modal
│   ├── login.html                      # Unified login with demo quick-fill buttons
│   ├── register.html                   # Customer account registration
│   ├── admin/
│   │   ├── index.html                  # Admin dashboard with operational metrics
│   │   ├── bookings.html               # Booking approvals and technician assignment
│   │   ├── technicians.html            # Staff directory, availability & account status
│   │   ├── customers.html              # Customer registry and device overview
│   │   ├── services.html               # Service catalog and pricing management
│   │   ├── inventory.html              # Spare parts inventory and stock ledger
│   │   ├── invoices.html               # Bill generation and payment updates
│   │   └── reports.html                # Operational analytics and revenue charts
│   ├── customer/
│   │   ├── index.html                  # Customer dashboard, profile editor & cancel booking
│   │   ├── devices.html                # Smartphone registry (IMEI, serial, edit, delete)
│   │   ├── book.html                   # Repair booking request with photo upload
│   │   ├── tracking.html               # Real-time progress stepper & audit history
│   │   ├── invoices.html               # Invoice view and printable receipts
│   │   └── feedback.html               # Star rating and feedback submission
│   ├── technician/
│   │   ├── index.html                  # Assigned repair jobs queue
│   │   └── repair-detail.html          # Workbench: diagnosis, parts issue, status
│   └── assets/
│       ├── css/style.css               # Modern custom styling, stepper, print layout
│       └── js/
│           ├── api.js                  # Centralized fetch wrapper & UI helpers
│           └── auth.js                 # Session guard & dynamic navigation bar
├── server.js                           # Root server entry point (npm start)
├── index.html                          # Root document fallback redirect
├── package.json                        # Root npm scripts & workspace configuration
├── .htaccess                           # Apache web server config (Options -Indexes)
├── nginx.conf                          # Nginx config with reverse proxy and autoindex off
├── vercel.json                         # Vercel deployment & rewrite configuration
├── netlify.toml                        # Netlify publish & API proxy configuration
├── Dockerfile                          # Container deployment specification
├── .dockerignore
└── README.md
```

---

## 3. Step-by-Step Setup Guide

### Step 1: Database Setup (Section 7.3 Core Schema)
The Core Schema SQL is located at `database/schema.sql`.

You can execute it in any of the following ways:

#### Option A: One-Command Automated Setup
1. Update `DB_PASSWORD` in `backend/.env` with your local PostgreSQL password.
2. In the `backend` directory, run:
   ```bash
   npm run db:setup
   ```
   *This automatically creates all 14 tables, constraints, indexes, and starter services!*

#### Option B: Via psql or pgAdmin 4
1. Open **pgAdmin 4** or **psql**.
2. Create the database:
   ```sql
   CREATE DATABASE mobile_service_management;
   ```
3. Connect to `mobile_service_management` and run:
   ```bash
   psql -U postgres -d mobile_service_management -f database/schema.sql
   ```

---

### Step 2: Configure Backend Environment
Edit `backend/.env` to configure your PostgreSQL credentials:

```env
PORT=5000
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=mobile_service_management
DB_USER=postgres
DB_PASSWORD=YOUR_LOCAL_POSTGRES_PASSWORD
JWT_SECRET=msms_super_secret_jwt_key_2026_secure_random_seed_987654321
JWT_EXPIRES_IN=24h
FRONTEND_ORIGIN=*
```

---

### Step 3: Seed Admin & Demo Data
From the `backend` directory, provision the initial administrator and sample records:

```bash
cd backend

# Provision the system administrator (Section 8.9)
npm run seed:admin

# (Optional) Seed demo technicians, customers, devices and parts catalog
npm run seed:data
```

**Default Credentials:**
| Role | Email | Password |
|---|---|---|
| **Administrator** | `admin@msms.local` | `Admin123!` (or `Password123!`) |
| **Technician** | `tech.alex@msms.local` | `Password123!` |
| **Customer** | `john.customer@msms.local` | `Password123!` |

*(Quick-fill buttons for all three accounts are built directly into the login screen!)*

---

### Step 4: Start the Server
```bash
npm start
# Or for development with auto-reload: npm run dev
```

- **All-in-one Web & API Server:** Open `http://localhost:5000` in your browser. Express serves the frontend pages directly on `/` and the REST API on `/api`.
- **Health Check:** `http://localhost:5000/api/health`
- **Optional Static Server:** You can also serve `frontend/index.html` via VS Code Live Server on `http://127.0.0.1:5500`.

---

## 4. Production Deployment & Operations

### Production Launch with PM2 Clustering
The backend includes `ecosystem.config.js` for process management and automatic multi-core clustering:
```bash
cd backend
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 status
```

### Database Backup & Disaster Recovery (Section 12.3)
Automated backup and restore scripts are located in `database/scripts/`:

- **Create a Backup:**
  - *PowerShell:* `.\database\scripts\backup.ps1`
  - *Windows Command Prompt:* `database\scripts\backup.bat`
  *(Generates compressed archive `.dump` inside `database/backups/`).*

- **Restore Database:**
  - *PowerShell:* `.\database\scripts\restore.ps1 -DumpFile "..\backups\mobile_service_management_backup_xxxx.dump"`
  - *Windows Command Prompt:* `database\scripts\restore.bat ..\backups\mobile_service_management_backup_xxxx.dump`

---

## 5. Acceptance Test Suite (Section 11.1)

Run the full automated test suite covering all 16 test cases:
```bash
cd backend
npm run test:all
```

**Verified Test Cases:**
- `TC-01`: Register valid customer data $\rightarrow$ Customer account & customer profile created.
- `TC-02`: Register duplicate email $\rightarrow$ Rejected with conflict (409).
- `TC-03`: Login valid credentials $\rightarrow$ Authenticated user receives JWT session token.
- `TC-04`: Login incorrect password $\rightarrow$ Rejected with generic 401.
- `TC-05`: Customer attempts admin endpoint $\rightarrow$ Denied with 403 Forbidden.
- `TC-06`: Customer books another customer's device $\rightarrow$ Denied with 403.
- `TC-07`: Admin approves booking $\rightarrow$ Booking approved and repair record created with `DEVICE_RECEIVED`.
- `TC-08`: Admin assigns technician $\rightarrow$ Job appears in technician's queue.
- `TC-09`: Technician updates own assigned repair $\rightarrow$ Repair status and audit history updated.
- `TC-10`: Technician updates unassigned repair $\rightarrow$ Denied with 403.
- `TC-11`: Part quantity exceeds available stock $\rightarrow$ Transaction fails with 400 and stock remains unchanged.
- `TC-12`: Part is issued successfully $\rightarrow$ Stock decreases atomically and ledger entry (`OUT`) inserted.
- `TC-13`: Customer requests another customer's invoice $\rightarrow$ Denied with 403.
- `TC-14`: Upload executable or oversized file $\rightarrow$ Rejected by Multer filter.
- `TC-15`: Submit feedback twice for same repair $\rightarrow$ Second submission rejected by uniqueness constraint.
- `TC-16`: Database offline handling $\rightarrow$ Server reports failure clearly.

---

## 6. Functional Requirements Verification Checklist (Section 3.2 & 14.1)

- [x] **FR-01 (Authentication):** Role-based login and customer registration with bcrypt password hashing.
- [x] **FR-02 (Customer Profile):** Customer profile viewer and editor for permitted fields (`PUT /api/auth/profile`).
- [x] **FR-03 (Device Management):** Add, view, edit, and delete customer mobile devices (`/api/devices`).
- [x] **FR-04 (Service Catalog):** Admin CRUD, price updates, and active/inactive toggle (`/api/services`).
- [x] **FR-05 (Repair Booking):** Device selector, problem category, defect description, and photo uploads (`/api/bookings`).
- [x] **FR-06 (Booking Reference):** Collision-resistant sequence generator (`BK-YYYYMMDD-XXXX`).
- [x] **FR-07 (Booking Management):** Admin review, approve, reject, or cancel; customer pending cancellation (`/api/bookings/:id/cancel`).
- [x] **FR-08 (Technician Assignment):** Admin assigns technician to accepted repair (`/api/bookings/:id/assign`).
- [x] **FR-09 (Diagnosis):** Technician records technical findings, estimated completion, and cost estimates (`/api/repairs/:id/diagnosis`).
- [x] **FR-10 (Repair Status):** Full lifecycle stepper (`DEVICE_RECEIVED` $\rightarrow$ `DELIVERED`) with immutable audit logging (`/api/repairs/:id/status`).
- [x] **FR-11 (Inventory):** Spare-part catalog, low-stock threshold warnings, and stock `IN`/`OUT`/`ADJUSTMENT` ledger (`/api/inventory`).
- [x] **FR-12 (Parts Usage):** Atomic stock deduction with row-level locks preventing negative balances (`/api/repairs/:id/parts`).
- [x] **FR-13 (Invoice):** Server-side calculated billing (labor + parts line items), printable invoice view, and payment status updates (`/api/invoices`).
- [x] **FR-14 (Tracking):** Real-time tracking timeline for logged-in customers and instant public lookup modal (`/api/bookings/public-track/:code`).
- [x] **FR-15 (Feedback):** 5-star rating and comments for completed repairs (`/api/feedback`).
- [x] **FR-16 (Reports):** Financial summaries, repair status breakdown, popular services, parts consumption, and technician workload metrics (`/api/reports/summary`).
