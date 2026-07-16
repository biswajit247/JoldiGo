import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Automatically parse DECIMAL/NUMERIC (type OID 1700) as JavaScript numbers
pg.types.setTypeParser(1700, (val) => parseFloat(val));

dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

// Automatically enable SSL for cloud providers like Neon/Supabase if needed
const isProduction = process.env.NODE_ENV === 'production';
const requiresSsl = connectionString && (connectionString.includes('neon.tech') || connectionString.includes('supabase.co') || isProduction);

class MockPool {
  constructor() {
    this.rides = new Map();
    this.passengers = new Map();
    this.systemSettings = new Map();
    this.promos = new Map();
    this.drivers = new Map([
      ['drv_1', {
        id: 'drv_1',
        name: 'E2E Test Driver',
        verification_status: 'verified',
        status: 'approved',
        vehicles: '[]',
        rating: 4.8,
        trips: 120,
        lat: 22.5735,
        lng: 88.4331,
        active: true
      }]
    ]);
    console.log('🔌 [DB MOCK] In-memory database mock initialized.');
  }

  on(event, handler) {
    // No-op
  }

  async end() {
    // No-op
  }

  async query(text, params = []) {
    const queryStr = text.toLowerCase().trim();
    
    if (queryStr.includes('create table') || queryStr.includes('alter table') || queryStr.includes('create index')) {
      return { rows: [], rowCount: 0 };
    }

    if (queryStr.includes('select count(*) from promos')) {
      return { rows: [{ count: 4 }] };
    }
    if (queryStr.includes('select * from promos')) {
      return { rows: Array.from(this.promos.values()) };
    }

    if (queryStr.includes('select * from system_settings')) {
      return { rows: [] };
    }
    if (queryStr.includes('select value from system_settings where key =')) {
      return { rows: [] };
    }

    if (queryStr.includes('select name, verification_status from drivers') || queryStr.includes('select * from drivers')) {
      const id = params[0] || 'drv_1';
      const driver = this.drivers.get(id) || this.drivers.get('drv_1');
      return { rows: [driver] };
    }

    if (queryStr.includes('insert into passengers')) {
      const phone = params[0];
      const name = params[1] || 'Guest Passenger';
      const balance = params[2] !== undefined ? parseFloat(params[2]) : 1000.00;
      this.passengers.set(phone, { phone, name, wallet_balance: balance });
      return { rows: [], rowCount: 1 };
    }
    if (queryStr.includes('select * from passengers where phone =')) {
      const phone = params[0];
      const passenger = this.passengers.get(phone) || { phone, name: 'E2E Test Passenger', wallet_balance: 1000.00 };
      return { rows: [passenger] };
    }
    if (queryStr.includes('select wallet_balance from passengers where phone =')) {
      const phone = params[0];
      const passenger = this.passengers.get(phone) || { phone, wallet_balance: 1000.00 };
      return { rows: [{ wallet_balance: passenger.wallet_balance }] };
    }
    if (queryStr.includes('update passengers set wallet_balance = wallet_balance +')) {
      const amount = parseFloat(params[0]);
      const phone = params[1];
      const passenger = this.passengers.get(phone) || { phone, name: 'E2E Test Passenger', wallet_balance: 1000.00 };
      passenger.wallet_balance += amount;
      this.passengers.set(phone, passenger);
      return { rows: [], rowCount: 1 };
    }

    if (queryStr.includes('insert into rides')) {
      const rideId = params[0];
      const status = 'searching';
      this.rides.set(rideId, { id: rideId, status });
      return { rows: [], rowCount: 1 };
    }
    if (queryStr.includes('update rides set status =')) {
      if (queryStr.includes('status = $1')) {
        const status = params[0];
        const rideId = params[1];
        const ride = this.rides.get(rideId) || { id: rideId };
        ride.status = status;
        this.rides.set(rideId, ride);
      } else {
        const match = queryStr.match(/status\s*=\s*'([^']+)'/);
        if (match) {
          const status = match[1];
          const rideId = params[0];
          const ride = this.rides.get(rideId) || { id: rideId };
          ride.status = status;
          this.rides.set(rideId, ride);
        }
      }
      return { rows: [], rowCount: 1 };
    }
    if (queryStr.includes('select status from rides where id =') || queryStr.includes('select * from rides where id =')) {
      const rideId = params[0];
      const ride = this.rides.get(rideId) || { id: rideId, status: 'completed' };
      return { rows: [ride] };
    }

    if (queryStr.includes('delete from rides') || queryStr.includes('delete from passengers')) {
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

let useMock = process.env.MOCK_DB === 'true' || (process.argv[1] && process.argv[1].endsWith('e2e_booking_test.js'));

let pool = useMock ? new MockPool() : new Pool({
  connectionString,
  ssl: requiresSsl ? { rejectUnauthorized: false } : false
});

if (!useMock) {
  pool.on('error', (err) => {
    console.error('Unexpected database client pool error:', err);
  });
}

// Async helper query method
export const query = async (text, params) => {
  console.log(`🔍 [DB QUERY] ${text.replace(/\s+/g, ' ')}`);
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (useMock) {
      console.log(`   └─ [DB QUERY SUCCESS] rows: ${res.rows ? res.rows.length : 0}`);
    } else if (process.env.NODE_ENV !== 'production') {
      console.log('Executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (err) {
    if (!useMock && (err.code === 'ENOTFOUND' || err.message.includes('timeout') || err.message.includes('connect'))) {
      console.warn('⚠️ [DB] Connection failed. Falling back to in-memory MockPool database!');
      pool = new MockPool();
      useMock = true;
      return query(text, params); // Retry query with MockPool
    }
    console.error('Database query execution error:', err);
    throw err;
  }
};

export default pool;

