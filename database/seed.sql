-- =====================================================================
-- MOBILE SERVICE MANAGEMENT SYSTEM (MSMS)
-- Database Seed Data (Users, Technicians, Customers, Devices, Services, Parts)
-- Default test password for all seed accounts: Password123!
-- Bcrypt hash generated with salt rounds = 10:
-- $2b$10$n2vu6ZCJfVSk5GhAcGtct.gMmcwqNHAMKf5nzmQleNhA8u3mV2xWC
-- =====================================================================

-- 1. Starter Admin, Technician, Customer Users
INSERT INTO users (name, email, phone, password_hash, role, is_active) VALUES
('System Administrator', 'admin@msms.local', '9876543210', '$2b$10$n2vu6ZCJfVSk5GhAcGtct.gMmcwqNHAMKf5nzmQleNhA8u3mV2xWC', 'admin', true),
('Alex Rivera (Technician)', 'tech.alex@msms.local', '9876543211', '$2b$10$n2vu6ZCJfVSk5GhAcGtct.gMmcwqNHAMKf5nzmQleNhA8u3mV2xWC', 'technician', true),
('Sarah Chen (Technician)', 'tech.sarah@msms.local', '9876543212', '$2b$10$n2vu6ZCJfVSk5GhAcGtct.gMmcwqNHAMKf5nzmQleNhA8u3mV2xWC', 'technician', true),
('John Doe (Customer)', 'john.customer@msms.local', '9876543213', '$2b$10$n2vu6ZCJfVSk5GhAcGtct.gMmcwqNHAMKf5nzmQleNhA8u3mV2xWC', 'customer', true),
('Emily Watson (Customer)', 'emily.customer@msms.local', '9876543214', '$2b$10$n2vu6ZCJfVSk5GhAcGtct.gMmcwqNHAMKf5nzmQleNhA8u3mV2xWC', 'customer', true)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_active = true;

-- 2. Customer Profiles
INSERT INTO customers (user_id, address, city)
SELECT id, '123 Tech Park Ave', 'Metro City'
FROM users WHERE email = 'john.customer@msms.local'
ON CONFLICT (user_id) DO UPDATE SET address = EXCLUDED.address, city = EXCLUDED.city;

INSERT INTO customers (user_id, address, city)
SELECT id, '456 Skyline Boulevard', 'North Haven'
FROM users WHERE email = 'emily.customer@msms.local'
ON CONFLICT (user_id) DO UPDATE SET address = EXCLUDED.address, city = EXCLUDED.city;

-- 3. Technician Profiles
INSERT INTO technicians (user_id, specialization, experience_years, joining_date, availability)
SELECT id, 'Screen & Display Replacement, Water Damage', 5, '2024-01-15', 'AVAILABLE'
FROM users WHERE email = 'tech.alex@msms.local'
ON CONFLICT (user_id) DO UPDATE SET specialization = EXCLUDED.specialization, experience_years = EXCLUDED.experience_years;

INSERT INTO technicians (user_id, specialization, experience_years, joining_date, availability)
SELECT id, 'Micro-soldering, Logic Board & Battery Diagnostics', 4, '2024-03-01', 'AVAILABLE'
FROM users WHERE email = 'tech.sarah@msms.local'
ON CONFLICT (user_id) DO UPDATE SET specialization = EXCLUDED.specialization, experience_years = EXCLUDED.experience_years;

-- 4. Customer Devices
INSERT INTO devices (customer_id, brand, model, imei, serial_number)
SELECT c.id, 'Apple', 'iPhone 14 Pro', '359284102938475', 'DNPVG987MD6R'
FROM customers c
JOIN users u ON c.user_id = u.id
WHERE u.email = 'john.customer@msms.local'
ON CONFLICT (imei) DO NOTHING;

INSERT INTO devices (customer_id, brand, model, imei, serial_number)
SELECT c.id, 'Samsung', 'Galaxy S23 Ultra', '864920048192048', 'R5CT208XKLP'
FROM customers c
JOIN users u ON c.user_id = u.id
WHERE u.email = 'john.customer@msms.local'
ON CONFLICT (imei) DO NOTHING;

INSERT INTO devices (customer_id, brand, model, imei, serial_number)
SELECT c.id, 'Google', 'Pixel 8', '352948190284719', '8A019D203491'
FROM customers c
JOIN users u ON c.user_id = u.id
WHERE u.email = 'emily.customer@msms.local'
ON CONFLICT (imei) DO NOTHING;

-- 5. Services Catalog
INSERT INTO services (service_name, description, base_price, is_active) VALUES
('Screen Replacement', 'Mobile display inspection and complete panel replacement', 49.99, true),
('Battery Replacement', 'Degraded battery diagnosis and OEM battery replacement', 29.99, true),
('Charging Port Repair', 'Cleaning, re-soldering, or charging port flex replacement', 24.99, true),
('Software Troubleshooting', 'OS reinstallation, boot loop fix, and firmware restore', 19.99, true),
('Water Damage Assessment & Ultrasonic Clean', 'Ultrasonic chemical bath, drying and corrosion inspection', 39.99, true)
ON CONFLICT (service_name) DO UPDATE SET base_price = EXCLUDED.base_price, is_active = true, description = EXCLUDED.description;

-- 6. Spare Parts Catalog
INSERT INTO spare_parts (part_name, part_code, brand, purchase_price, selling_price, stock_quantity, minimum_stock, is_active) VALUES
('iPhone 14 Pro OLED Display Assembly', 'DISP-IP14P-01', 'Apple OEM', 140.00, 220.00, 15, 3, true),
('iPhone 14 Battery Pack (3200mAh)', 'BATT-IP14-01', 'Apple OEM', 25.00, 55.00, 25, 5, true),
('Samsung S23 Ultra AMOLED Display Assembly', 'DISP-SS23U-01', 'Samsung OEM', 160.00, 250.00, 10, 2, true),
('Samsung S23 Ultra Battery (5000mAh)', 'BATT-SS23U-01', 'Samsung OEM', 28.00, 60.00, 18, 4, true),
('Universal USB-C Flex Port Type 3', 'PORT-USBC-03', 'Generic OEM', 8.50, 25.00, 40, 10, true),
('Pixel 8 Tempered Outer Glass Cover', 'GLAS-PX8-01', 'Google OEM', 15.00, 35.00, 12, 3, true),
('Thermal Heat Pad & Copper Shield Kit', 'THRM-GEN-01', 'Generic', 3.00, 10.00, 50, 10, true)
ON CONFLICT (part_code) DO UPDATE SET stock_quantity = EXCLUDED.stock_quantity;

-- 7. Initial Stock Transactions
INSERT INTO stock_transactions (part_id, transaction_type, quantity, remarks)
SELECT id, 'IN', stock_quantity, 'Initial inventory count'
FROM spare_parts sp
WHERE NOT EXISTS (SELECT 1 FROM stock_transactions st WHERE st.part_id = sp.id);
