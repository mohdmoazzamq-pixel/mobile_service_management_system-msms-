-- =====================================================================
-- MOBILE SERVICE MANAGEMENT SYSTEM (MSMS)
-- Database: mobile_service_management
-- Section 7.3 Complete Core Schema & Section 7.4 Starter Data
-- =====================================================================

-- Clean up existing tables in reverse dependency order if needed
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS stock_transactions CASCADE;
DROP TABLE IF EXISTS repair_parts CASCADE;
DROP TABLE IF EXISTS spare_parts CASCADE;
DROP TABLE IF EXISTS repair_status_history CASCADE;
DROP TABLE IF EXISTS repairs CASCADE;
DROP TABLE IF EXISTS booking_images CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS technicians CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS password_resets CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users Table
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin','customer','technician')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Customers Table
CREATE TABLE customers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    address TEXT,
    city VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Technicians Table
CREATE TABLE technicians (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    specialization VARCHAR(100),
    experience_years INTEGER NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
    joining_date DATE,
    availability VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
        CHECK (availability IN ('AVAILABLE','BUSY','INACTIVE'))
);

-- 4. Devices Table
CREATE TABLE devices (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    imei VARCHAR(30) UNIQUE,
    serial_number VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (imei IS NULL OR length(imei) BETWEEN 8 AND 30)
);
CREATE INDEX idx_devices_customer ON devices(customer_id);

-- 5. Services Table
CREATE TABLE services (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    service_name VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    base_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (base_price >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Bookings Table
CREATE TABLE bookings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_number VARCHAR(32) NOT NULL UNIQUE,
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
    service_id BIGINT REFERENCES services(id) ON DELETE SET NULL,
    problem_category VARCHAR(100) NOT NULL,
    problem_description TEXT NOT NULL,
    preferred_date DATE,
    booking_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (booking_status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (length(problem_description) >= 5)
);

-- 7. Booking Images Table
CREATE TABLE booking_images (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    image_path VARCHAR(500) NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Repairs Table
CREATE TABLE repairs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_id BIGINT NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
    technician_id BIGINT REFERENCES technicians(id) ON DELETE SET NULL,
    diagnosis TEXT,
    estimated_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (estimated_cost >= 0),
    final_cost NUMERIC(12,2) CHECK (final_cost IS NULL OR final_cost >= 0),
    estimated_completion TIMESTAMPTZ,
    actual_completion TIMESTAMPTZ,
    repair_status VARCHAR(40) NOT NULL DEFAULT 'DEVICE_RECEIVED'
        CHECK (repair_status IN (
            'DEVICE_RECEIVED','UNDER_DIAGNOSIS','REPAIR_IN_PROGRESS',
            'WAITING_FOR_SPARE_PARTS','REPAIR_COMPLETED','DELIVERED'
        )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Repair Status History Table
CREATE TABLE repair_status_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    repair_id BIGINT NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
    old_status VARCHAR(40),
    new_status VARCHAR(40) NOT NULL,
    updated_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. Spare Parts Table
CREATE TABLE spare_parts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    part_name VARCHAR(150) NOT NULL,
    part_code VARCHAR(50) NOT NULL UNIQUE,
    brand VARCHAR(100),
    purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
    selling_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    minimum_stock INTEGER NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. Repair Parts Table
CREATE TABLE repair_parts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    repair_id BIGINT NOT NULL REFERENCES repairs(id) ON DELETE RESTRICT,
    part_id BIGINT NOT NULL REFERENCES spare_parts(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    used_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    used_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. Stock Transactions Table
CREATE TABLE stock_transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    part_id BIGINT NOT NULL REFERENCES spare_parts(id) ON DELETE RESTRICT,
    transaction_type VARCHAR(20) NOT NULL
        CHECK (transaction_type IN ('IN','OUT','ADJUSTMENT')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    reference_id BIGINT,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. Invoices Table
CREATE TABLE invoices (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_number VARCHAR(32) NOT NULL UNIQUE,
    repair_id BIGINT NOT NULL UNIQUE REFERENCES repairs(id) ON DELETE RESTRICT,
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
    total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID'
        CHECK (payment_status IN ('UNPAID','PARTIAL','PAID','REFUNDED')),
    payment_method VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (total_amount = subtotal + tax_amount - discount)
);

-- 14. Feedback Table
CREATE TABLE feedback (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    repair_id BIGINT NOT NULL UNIQUE REFERENCES repairs(id) ON DELETE RESTRICT,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comments TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 15. Password Resets Table
CREATE TABLE password_resets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(150) NOT NULL,
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX idx_bookings_customer_created ON bookings(customer_id, created_at DESC);
CREATE INDEX idx_bookings_status ON bookings(booking_status);
CREATE INDEX idx_repairs_technician_status ON repairs(technician_id, repair_status);
CREATE INDEX idx_repairs_status ON repairs(repair_status);
CREATE INDEX idx_history_repair_created ON repair_status_history(repair_id, created_at);
CREATE INDEX idx_stock_part_created ON stock_transactions(part_id, created_at DESC);
CREATE INDEX idx_invoices_customer_created ON invoices(customer_id, created_at DESC);
CREATE INDEX idx_password_resets_token ON password_resets(token);
CREATE INDEX idx_password_resets_user ON password_resets(user_id);

-- Section 7.4 Starter Service Records
INSERT INTO services (service_name, description, base_price) VALUES
('Screen Replacement', 'Mobile display inspection and replacement', 49.99),
('Battery Replacement', 'Battery inspection and replacement', 29.99),
('Charging Port Repair', 'Charging connector inspection and repair', 24.99),
('Software Troubleshooting', 'Operating system and software troubleshooting', 19.99),
('Water Damage Inspection', 'Inspection and cleaning assessment', 39.99)
ON CONFLICT (service_name) DO NOTHING;
