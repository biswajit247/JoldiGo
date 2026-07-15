import pool from './db.js';
import twilio from 'twilio';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

async function runTests() {
  console.log('--- STARTING SANITY CHECKS ---');
  
  // 1. Database connection check
  console.log('[Database] Checking connection pool...');
  try {
    const res = await pool.query('SELECT NOW() as current_time');
    console.log(`[Database] SUCCESS: Connected. Server time: ${res.rows[0].current_time}`);
  } catch (dbErr) {
    console.error('[Database] FAILURE: Cannot connect to PostgreSQL database.', dbErr);
  }

  // 2. Twilio setup check
  console.log('[Twilio] Checking environment variables...');
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

  console.log(`[Twilio] Account SID: ${twilioSid ? 'PRESENT (Masked: ' + twilioSid.substring(0, 5) + '...)' : 'MISSING'}`);
  console.log(`[Twilio] Auth Token: ${twilioAuthToken ? 'PRESENT (Masked: ' + twilioAuthToken.substring(0, 5) + '...)' : 'MISSING'}`);
  console.log(`[Twilio] Phone Number: ${twilioPhoneNumber || 'MISSING'}`);

  if (twilioSid && twilioAuthToken && twilioPhoneNumber) {
    try {
      const client = twilio(twilioSid, twilioAuthToken);
      // Try to fetch account details to verify authenticity without sending a message
      const account = await client.api.v2010.accounts(twilioSid).fetch();
      console.log(`[Twilio] SUCCESS: Connected successfully to Twilio Account: "${account.friendlyName}" (Status: ${account.status})`);
    } catch (twilioErr) {
      console.error('[Twilio] FAILURE: Connection failed or credentials invalid.', twilioErr.message);
    }
  } else {
    console.warn('[Twilio] WARNING: Twilio credentials are not fully configured. SMS functionality will use mock gateway.');
  }

  console.log('--- SANITY CHECKS COMPLETE ---');
  
  // Close database pool connection so node process terminates
  await pool.end();
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
