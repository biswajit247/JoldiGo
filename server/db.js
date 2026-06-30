import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

// Automatically enable SSL for cloud providers like Neon/Supabase if needed
const isProduction = process.env.NODE_ENV === 'production';
const requiresSsl = connectionString && (connectionString.includes('neon.tech') || connectionString.includes('supabase.co') || isProduction);

const pool = new Pool({
  connectionString,
  ssl: requiresSsl ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Unexpected database client pool error:', err);
});

// Async helper query method
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log('Executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (err) {
    console.error('Database query execution error:', err);
    throw err;
  }
};

export default pool;
