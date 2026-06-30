import pool from './db.js';

const setupTablesSql = `
-- Drop tables in order of dependency if they exist (clean slate migration)
DROP TABLE IF EXISTS disputes CASCADE;
DROP TABLE IF EXISTS claims CASCADE;
DROP TABLE IF EXISTS rides CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS passengers CASCADE;

-- 1. Create passengers table
CREATE TABLE passengers (
  phone VARCHAR(50) PRIMARY KEY,
  wallet_balance NUMERIC(10, 2) DEFAULT 500.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create drivers table
CREATE TABLE drivers (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(50) UNIQUE NOT NULL,
  vehicle_type VARCHAR(50) NOT NULL,
  vehicle_name VARCHAR(100) NOT NULL,
  vehicle_number VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'offline',
  verification_status VARCHAR(20) DEFAULT 'pending',
  rating NUMERIC(3, 2) DEFAULT 5.00,
  location_lat NUMERIC(9, 6) NOT NULL,
  location_lng NUMERIC(9, 6) NOT NULL,
  license_number VARCHAR(100) NOT NULL,
  aadhar_number VARCHAR(100) NOT NULL,
  rc_number VARCHAR(100) NOT NULL,
  earnings_daily NUMERIC(10, 2) DEFAULT 0.00,
  earnings_weekly NUMERIC(10, 2) DEFAULT 0.00,
  commission_owed NUMERIC(10, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create rides table
CREATE TABLE rides (
  id VARCHAR(100) PRIMARY KEY,
  passenger_phone VARCHAR(50) REFERENCES passengers(phone) ON DELETE CASCADE,
  driver_id VARCHAR(100) REFERENCES drivers(id) ON DELETE SET NULL,
  pickup_name VARCHAR(255) NOT NULL,
  pickup_lat NUMERIC(9, 6) NOT NULL,
  pickup_lng NUMERIC(9, 6) NOT NULL,
  dropoff_name VARCHAR(255) NOT NULL,
  dropoff_lat NUMERIC(9, 6) NOT NULL,
  dropoff_lng NUMERIC(9, 6) NOT NULL,
  distance NUMERIC(6, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'searching',
  payment_method VARCHAR(50) DEFAULT 'wallet',
  total_fare NUMERIC(10, 2) NOT NULL,
  driver_take_home NUMERIC(10, 2) NOT NULL,
  commission NUMERIC(10, 2) NOT NULL,
  gst_amount NUMERIC(10, 2) NOT NULL,
  insurance_premium NUMERIC(10, 2) NOT NULL,
  contract_hash VARCHAR(100) NOT NULL,
  surge_multiplier NUMERIC(3, 2) DEFAULT 1.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create claims table
CREATE TABLE claims (
  id VARCHAR(100) PRIMARY KEY,
  driver_id VARCHAR(100) REFERENCES drivers(id) ON DELETE CASCADE,
  claim_type VARCHAR(50) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create disputes table
CREATE TABLE disputes (
  id VARCHAR(100) PRIMARY KEY,
  ride_id VARCHAR(100) REFERENCES rides(id) ON DELETE CASCADE,
  passenger_phone VARCHAR(50) REFERENCES passengers(phone) ON DELETE CASCADE,
  driver_id VARCHAR(100) REFERENCES drivers(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'awaiting_evidence',
  payout_target VARCHAR(50) DEFAULT 'none',
  expires_in INTEGER NOT NULL,
  evidence TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const seedDataSql = `
-- Seed Passengers (Pre-authenticate a default test number)
INSERT INTO passengers (phone, wallet_balance) VALUES ('+91 99030 99030', 500.00)
ON CONFLICT (phone) DO NOTHING;

-- Seed Drivers
INSERT INTO drivers (
  id, name, phone, vehicle_type, vehicle_name, vehicle_number, status,
  verification_status, rating, location_lat, location_lng,
  license_number, aadhar_number, rc_number, earnings_daily, earnings_weekly, commission_owed
) VALUES 
(
  'drv_1', 'Rajesh Kumar', '+91 98300 12345', 'car_ac', 'Hyundai i10 AC Blue', 'WB-02-A-8842', 'online',
  'verified', 4.80, 22.5600, 88.3600, 'DL-WESTBENGAL-2018892', '5421 8892 0123', 'RC-WB02A8842', 1250.00, 8400.00, 440.00
),
(
  'drv_2', 'Amit Singh', '+91 90070 98765', 'bike', 'TVS Apache Black', 'WB-24-H-1994', 'online',
  'verified', 4.90, 22.5450, 88.3800, 'DL-WESTBENGAL-2020432', '8876 1234 9901', 'RC-WB24H1994', 720.00, 5100.00, 268.00
),
(
  'drv_3', 'Subhash Dutta', '+91 98830 55443', 'car_non_ac', 'Maruti Suzuki Dzire Non-AC', 'WB-06-B-2311', 'offline',
  'verified', 4.60, 22.5800, 88.4200, 'DL-WESTBENGAL-2015091', '1122 3344 5566', 'RC-WB06B2311', 0.00, 6800.00, 350.00
),
(
  'drv_4', 'Priyanka Sen', '+91 91630 11223', 'bike', 'Honda Activa Red', 'WB-12-C-4556', 'online',
  'pending', 5.00, 22.5200, 88.3500, 'DL-WESTBENGAL-2022001', '9900 8877 6655', 'RC-WB12C4556', 0.00, 0.00, 0.00
)
ON CONFLICT (id) DO NOTHING;

-- Seed Safety Claim Initial Log
INSERT INTO claims (id, driver_id, claim_type, amount, description, status, created_at) VALUES
(
  'claim_init_1', 'drv_1', 'health', 150.00, 'Outpatient medical checkup cover for seasonal fever at local clinic.', 'approved', CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;
`;

const migrate = async () => {
  console.log('Starting full-stack database schema migration...');
  try {
    // 1. Run migrations
    await pool.query(setupTablesSql);
    console.log('✔ Schema tables constructed successfully.');

    // 2. Run seed script
    await pool.query(seedDataSql);
    console.log('✔ Operational seed data populated successfully.');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Database migration failed:', err);
    process.exit(1);
  }
};

migrate();
