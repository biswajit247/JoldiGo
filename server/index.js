import express from 'express';
import fs from 'fs';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { query } from './db.js';
import Razorpay from 'razorpay';
import twilio from 'twilio';
import { fileURLToPath } from 'url';

dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

// Initialize Twilio client if keys exist in environment
const twilioSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
let twilioClient = null;
if (twilioSid && twilioAuthToken) {
  twilioClient = twilio(twilioSid, twilioAuthToken);
}

// Initialize Razorpay client if keys exist in environment
const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
let razorpay = null;
if (razorpayKeyId && razorpayKeySecret) {
  razorpay = new Razorpay({
    key_id: razorpayKeyId,
    key_secret: razorpayKeySecret
  });
}

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Global Server In-Memory State for simulator dynamics
let globalSettings = {
  baseFareCarAC: 50,
  perKmCarAC: 20,
  baseFareCarNonAC: 30,
  perKmCarNonAC: 15,
  baseFareBike: 20,
  perKmBike: 7,
  surgeMultiplier: 1.0
};

let globalFuelPrices = {
  cng: 95.50,
  petrol: 104.50,
  diesel: 92.75
};

let globalCongestionZones = {
  HOWRAH_BRIDGE: 'heavy',
  PARK_STREET: 'medium',
  SALT_LAKE_SEC5: 'medium'
};

// WebSocket connection mapping: Key = WebSocket object, Value = { role, id }
const socketClients = new Map();

// --- REST API ENDPOINTS ---

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// 1. PASSENGER ROUTES

const otpCache = new Map();

// Send OTP via Twilio SMS
app.post('/api/otp/send', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number is required.' });

  try {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpCache.set(phone, otp);
    
    let sentRealSms = false;
    if (twilioClient) {
      const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;
      await twilioClient.messages.create({
        body: `Your JoldiGo Secure OTP is: ${otp}. Valid for 5 minutes. Do not share this code.`,
        from: twilioPhoneNumber,
        to: formattedPhone
      });
      sentRealSms = true;
    }
    
    console.log(`[OTP Engine] Generated code ${otp} for phone ${phone}. Sent SMS: ${sentRealSms}`);
    
    res.json({ success: true, sentRealSms, otpFallback: otp });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deliver OTP.', details: err.message });
  }
});

// Verify OTP & Login/Register Passenger
app.post('/api/otp/verify', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP are required.' });

  const cachedOtp = otpCache.get(phone);
  
  // Backdoor developer code: always allow 1234
  if (otp === '1234' || otp === cachedOtp) {
    try {
      let passengerRes = await query('SELECT * FROM passengers WHERE phone = $1', [phone]);
      
      if (passengerRes.rows.length === 0) {
        await query('INSERT INTO passengers (phone, wallet_balance) VALUES ($1, 500.00)', [phone]);
        passengerRes = await query('SELECT * FROM passengers WHERE phone = $1', [phone]);
      }
      
      otpCache.delete(phone); // Clear cache
      
      return res.json({ success: true, passenger: passengerRes.rows[0] });
    } catch (err) {
      return res.status(500).json({ error: 'Database verification failed.', details: err.message });
    }
  }

  res.status(400).json({ error: 'Incorrect OTP code.' });
});

// Keep login route fallback for backwards compatibility
app.post('/api/passenger/login', async (req, res) => {
  const { phone } = req.body;
  try {
    let passengerRes = await query('SELECT * FROM passengers WHERE phone = $1', [phone]);
    if (passengerRes.rows.length === 0) {
      await query('INSERT INTO passengers (phone, wallet_balance) VALUES ($1, 500.00)', [phone]);
      passengerRes = await query('SELECT * FROM passengers WHERE phone = $1', [phone]);
    }
    res.json({ success: true, passenger: passengerRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Login failed.', details: err.message });
  }
});

// Get Passenger Profile + Ride History
app.get('/api/passenger/profile/:phone', async (req, res) => {
  const { phone } = req.params;
  try {
    const passengerRes = await query('SELECT * FROM passengers WHERE phone = $1', [phone]);
    if (passengerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Passenger not found.' });
    }

    const historyRes = await query(
      `SELECT r.*, d.name as driver_name 
       FROM rides r 
       LEFT JOIN drivers d ON r.driver_id = d.id 
       WHERE r.passenger_phone = $1 
       ORDER BY r.created_at DESC LIMIT 20`,
      [phone]
    );

    res.json({ 
      success: true, 
      passenger: passengerRes.rows[0], 
      rideHistory: historyRes.rows.map(row => ({
        id: row.id,
        pickupName: row.pickup_name,
        dropoffName: row.dropoff_name,
        date: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        vehicleType: row.vehicle_type,
        fare: parseFloat(row.total_fare),
        driverName: row.driver_name || 'Rajesh Kumar',
        paymentMethod: row.payment_method,
        contractHash: row.contract_hash,
        status: row.status
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch passenger profile.', details: err.message });
  }
});

// Create Razorpay Order
app.post('/api/payment/create-order', async (req, res) => {
  const { amount, currency = 'INR' } = req.body;
  if (!amount) return res.status(400).json({ error: 'Amount is required.' });

  try {
    const amountInPaise = Math.round(parseFloat(amount) * 100);
    
    // If Razorpay client is initialized, create real order
    if (razorpay) {
      const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency,
        receipt: 'receipt_jld_' + Date.now()
      });
      return res.json({ success: true, useRealRazorpay: true, keyId: razorpayKeyId, order });
    }
    
    // Fallback: Return mock order details for offline test mode
    const mockOrder = {
      id: 'order_mock_' + Math.random().toString(36).substr(2, 9),
      amount: amountInPaise,
      currency,
      receipt: 'receipt_jld_' + Date.now(),
      status: 'created'
    };
    res.json({ success: true, useRealRazorpay: false, order: mockOrder });
  } catch (err) {
    res.status(500).json({ error: 'Payment order creation failed.', details: err.message });
  }
});

// Top-up Passenger Wallet & Verify payment
app.post('/api/passenger/wallet/topup', async (req, res) => {
  const { phone, amount, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
  if (!phone || !amount) return res.status(400).json({ error: 'Phone and amount are required.' });

  try {
    // If real Razorpay and signatures are active, verify the signature!
    if (razorpay && razorpay_signature) {
      const crypto = await import('crypto');
      const text = razorpay_order_id + '|' + razorpay_payment_id;
      const generated_signature = crypto
        .createHmac('sha256', razorpayKeySecret)
        .update(text)
        .digest('hex');

      if (generated_signature !== razorpay_signature) {
        return res.status(400).json({ error: 'Payment signature mismatch. Fraud warning.' });
      }
    }

    await query('UPDATE passengers SET wallet_balance = wallet_balance + $1 WHERE phone = $2', [amount, phone]);
    const balanceRes = await query('SELECT wallet_balance FROM passengers WHERE phone = $1', [phone]);
    
    // Broadcast updated balance to connected clients
    broadcastToRole('admin', { type: 'ledger_update' });

    res.json({ success: true, wallet_balance: parseFloat(balanceRes.rows[0].wallet_balance) });
  } catch (err) {
    res.status(500).json({ error: 'Wallet top-up failed.', details: err.message });
  }
});

// 2. DRIVER ROUTES

// Get All Drivers
app.get('/api/drivers', async (req, res) => {
  try {
    const driversRes = await query('SELECT * FROM drivers');
    const formattedDrivers = driversRes.rows.map(drv => ({
      id: drv.id,
      name: drv.name,
      phone: drv.phone,
      vehicleType: drv.vehicle_type,
      vehicleName: drv.vehicle_name,
      vehicleNumber: drv.vehicle_number,
      status: drv.status,
      verificationStatus: drv.verification_status,
      rating: parseFloat(drv.rating),
      location: { lat: parseFloat(drv.location_lat), lng: parseFloat(drv.location_lng) },
      documents: { license: drv.license_number, aadhar: drv.aadhar_number, rc: drv.rc_number },
      earnings: { daily: parseFloat(drv.earnings_daily), weekly: parseFloat(drv.earnings_weekly), commission: parseFloat(drv.commission_owed) }
    }));
    res.json({ success: true, drivers: formattedDrivers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch drivers list.', details: err.message });
  }
});

// Toggle Driver Online Status
app.post('/api/driver/toggle-status', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Driver ID is required.' });

  try {
    const currentRes = await query('SELECT status FROM drivers WHERE id = $1', [id]);
    if (currentRes.rows.length === 0) return res.status(404).json({ error: 'Driver not found.' });

    const nextStatus = currentRes.rows[0].status === 'online' ? 'offline' : 'online';
    await query('UPDATE drivers SET status = $1 WHERE id = $2', [nextStatus, id]);

    // Broadcast update to all client maps
    broadcastToAll({ type: 'driver_status_changed', driverId: id, status: nextStatus });

    res.json({ success: true, id, status: nextStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle status.', details: err.message });
  }
});

// Upload Driver Documents for Onboarding
app.post('/api/driver/upload-docs', async (req, res) => {
  const { id, license, aadhar, rc } = req.body;
  if (!id || !license || !aadhar || !rc) {
    return res.status(400).json({ error: 'Driver ID and all document details are required.' });
  }

  try {
    await query(
      `UPDATE drivers 
       SET license_number = $1, aadhar_number = $2, rc_number = $3, verification_status = 'pending' 
       WHERE id = $4`,
      [license, aadhar, rc, id]
    );

    broadcastToRole('admin', { type: 'verification_request', driverId: id });

    res.json({ success: true, message: 'Documents submitted successfully. Awaiting approval.' });
  } catch (err) {
    res.status(500).json({ error: 'Documents upload failed.', details: err.message });
  }
});

// Get Driver Claims History
app.get('/api/driver/claims/:driverId', async (req, res) => {
  const { driverId } = req.params;
  try {
    const claimsRes = await query('SELECT * FROM claims WHERE driver_id = $1 ORDER BY created_at DESC', [driverId]);
    res.json({
      success: true,
      claims: claimsRes.rows.map(row => ({
        id: row.id,
        driverId: row.driver_id,
        claimType: row.claim_type,
        amount: parseFloat(row.amount),
        description: row.description,
        status: row.status,
        createdAt: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load safety claims.', details: err.message });
  }
});

// Submit Outpatient/Medical Cover Claim
app.post('/api/driver/claim', async (req, res) => {
  const { driverId, claimType, amount, description } = req.body;
  if (!driverId || !claimType || !amount || !description) {
    return res.status(400).json({ error: 'All claim form details are required.' });
  }

  const claimId = 'claim_' + Math.random().toString(36).substr(2, 9);
  try {
    await query(
      `INSERT INTO claims (id, driver_id, claim_type, amount, description, status) 
       VALUES ($1, $2, $3, $4, $5, 'pending')`,
      [claimId, driverId, claimType, amount, description]
    );

    broadcastToRole('admin', { type: 'claim_filed' });

    res.json({ success: true, message: 'Safety claim filed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Safety claim filing failed.', details: err.message });
  }
});

// 3. ADMIN ROUTES

// Read masked environment configurations
app.get('/api/admin/env/get', (req, res) => {
  const mask = (str) => {
    if (!str) return '';
    if (str.length <= 8) return '****';
    return str.substring(0, 4) + '****' + str.substring(str.length - 4);
  };
  
  res.json({
    success: true,
    databaseUrl: process.env.DATABASE_URL || '',
    twilioSid: mask(process.env.TWILIO_ACCOUNT_SID),
    twilioAuthToken: mask(process.env.TWILIO_AUTH_TOKEN),
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    razorpayKeyId: mask(process.env.RAZORPAY_KEY_ID),
    razorpayKeySecret: mask(process.env.RAZORPAY_KEY_SECRET)
  });
});

// Update environment variables dynamically
app.post('/api/admin/env/update', async (req, res) => {
  const { databaseUrl, twilioSid, twilioAuthToken, twilioPhoneNumber, razorpayKeyId, razorpayKeySecret } = req.body;
  
  try {
    const envPath = fileURLToPath(new URL('./.env', import.meta.url));
    const envLines = [];
    
    envLines.push(`PORT=${port}`);
    envLines.push(`NODE_ENV=${process.env.NODE_ENV || 'development'}`);
    
    const nextDb = databaseUrl && !databaseUrl.includes('****') ? databaseUrl : process.env.DATABASE_URL;
    const nextTwilioSid = twilioSid && !twilioSid.includes('****') ? twilioSid : process.env.TWILIO_ACCOUNT_SID;
    const nextTwilioAuthToken = twilioAuthToken && !twilioAuthToken.includes('****') ? twilioAuthToken : process.env.TWILIO_AUTH_TOKEN;
    const nextTwilioPhone = twilioPhoneNumber ? twilioPhoneNumber : process.env.TWILIO_PHONE_NUMBER;
    const nextRzpId = razorpayKeyId && !razorpayKeyId.includes('****') ? razorpayKeyId : process.env.RAZORPAY_KEY_ID;
    const nextRzpSecret = razorpayKeySecret && !razorpayKeySecret.includes('****') ? razorpayKeySecret : process.env.RAZORPAY_KEY_SECRET;

    if (nextDb) envLines.push(`DATABASE_URL=${nextDb}`);
    if (nextTwilioSid) envLines.push(`TWILIO_ACCOUNT_SID=${nextTwilioSid}`);
    if (nextTwilioAuthToken) envLines.push(`TWILIO_AUTH_TOKEN=${nextTwilioAuthToken}`);
    if (nextTwilioPhone) envLines.push(`TWILIO_PHONE_NUMBER=${nextTwilioPhone}`);
    if (nextRzpId) envLines.push(`RAZORPAY_KEY_ID=${nextRzpId}`);
    if (nextRzpSecret) envLines.push(`RAZORPAY_KEY_SECRET=${nextRzpSecret}`);
    
    fs.writeFileSync(envPath, envLines.join('\n'), 'utf-8');
    
    // Reload dotenv
    dotenv.config({ path: envPath });
    
    // Re-initialize clients in-memory
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    } else {
      twilioClient = null;
    }
    
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      });
    } else {
      razorpay = null;
    }
    
    console.log(`[Env Manager] Environment variables updated & clients reloaded successfully.`);
    res.json({ success: true, message: 'Environment configuration reloaded.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to rewrite env configuration.', details: err.message });
  }
});

// Get operational ledger statistics
app.get('/api/admin/stats', async (req, res) => {
  try {
    // Sum of commissions from completed rides
    const commissionRes = await query("SELECT SUM(commission) as total_comm FROM rides WHERE status = 'completed'");
    const totalCommission = parseFloat(commissionRes.rows[0].total_comm || 0);

    // Sum of insurance premiums collected
    const premiumRes = await query("SELECT SUM(insurance_premium) as total_prem FROM rides WHERE status = 'completed'");
    const totalPremium = parseFloat(premiumRes.rows[0].total_prem || 0);

    // Sum of claims paid out (approved)
    const claimsRes = await query("SELECT SUM(amount) as total_claims FROM claims WHERE status = 'approved'");
    const totalClaimsPaid = parseFloat(claimsRes.rows[0].total_claims || 0);

    // Calculate current safety reserve pool (preseeded with 348.00 base)
    const baseReserve = 348.00;
    const safetyPoolBalance = parseFloat((baseReserve + totalPremium - totalClaimsPaid).toFixed(2));

    const activeTripsRes = await query("SELECT COUNT(*) FROM rides WHERE status IN ('searching', 'accepted', 'arrived', 'in_progress')");
    const activeTrips = parseInt(activeTripsRes.rows[0].count || 0);

    res.json({
      success: true,
      stats: {
        totalCommission,
        safetyPoolBalance,
        activeTrips,
        commissionBalance: totalCommission // Comm earned
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute operations stats.', details: err.message });
  }
});

// Verify/Approve Driver onboarding docs
app.post('/api/admin/driver/verify', async (req, res) => {
  const { driverId, approve } = req.body;
  if (!driverId) return res.status(400).json({ error: 'Driver ID is required.' });

  const nextStatus = approve ? 'verified' : 'rejected';
  try {
    await query('UPDATE drivers SET verification_status = $1 WHERE id = $2', [nextStatus, driverId]);
    
    // Broadcast back to driver
    const targetDriverWs = findWsClient('driver', driverId);
    if (targetDriverWs) {
      targetDriverWs.send(JSON.stringify({ type: 'verification_updated', status: nextStatus }));
    }

    res.json({ success: true, driverId, status: nextStatus });
  } catch (err) {
    res.status(500).json({ error: 'Driver verification update failed.', details: err.message });
  }
});

// Get all claims (Pending & History)
app.get('/api/admin/claims', async (req, res) => {
  try {
    const claimsRes = await query(
      `SELECT c.*, d.name as driver_name, d.vehicle_type 
       FROM claims c 
       JOIN drivers d ON c.driver_id = d.id 
       ORDER BY c.created_at DESC`
    );
    res.json({
      success: true,
      claims: claimsRes.rows.map(row => ({
        id: row.id,
        driverId: row.driver_id,
        driverName: row.driver_name,
        vehicleType: row.vehicle_type,
        claimType: row.claim_type,
        amount: parseFloat(row.amount),
        description: row.description,
        status: row.status,
        createdAt: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve safety claims ledger.', details: err.message });
  }
});

// Approve/Reject Outpatient Out-of-Pocket Claims
app.post('/api/admin/claim/action', async (req, res) => {
  const { claimId, approve } = req.body;
  if (!claimId) return res.status(400).json({ error: 'Claim ID is required.' });

  const nextStatus = approve ? 'approved' : 'rejected';
  try {
    // 1. Update status
    await query('UPDATE claims SET status = $1 WHERE id = $2', [nextStatus, claimId]);

    if (approve) {
      // 2. Query claim details to update driver earnings
      const detailsRes = await query('SELECT driver_id, amount FROM claims WHERE id = $1', [claimId]);
      const { driver_id, amount } = detailsRes.rows[0];

      // Add to driver earnings
      await query(
        `UPDATE drivers 
         SET earnings_daily = earnings_daily + $1, earnings_weekly = earnings_weekly + $1 
         WHERE id = $2`,
        [amount, driver_id]
      );

      // Notify the driver to update UI
      const targetDriverWs = findWsClient('driver', driver_id);
      if (targetDriverWs) {
        targetDriverWs.send(JSON.stringify({ type: 'claim_approved', amount }));
      }
    }

    broadcastToRole('admin', { type: 'ledger_update' });

    res.json({ success: true, claimId, status: nextStatus });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process safety claim.', details: err.message });
  }
});

// Get all disputes
app.get('/api/admin/disputes', async (req, res) => {
  try {
    const disputesRes = await query(
      `SELECT d.*, r.pickup_name, r.dropoff_name, r.total_fare, drv.name as driver_name 
       FROM disputes d 
       JOIN rides r ON d.ride_id = r.id 
       JOIN drivers drv ON d.driver_id = drv.id 
       ORDER BY d.created_at DESC`
    );
    res.json({
      success: true,
      disputes: disputesRes.rows.map(row => ({
        id: row.id,
        rideId: row.ride_id,
        passengerPhone: row.passenger_phone,
        driverId: row.driver_id,
        driverName: row.driver_name,
        reason: row.reason,
        status: row.status,
        payoutTarget: row.payout_target,
        expiresIn: row.expires_in,
        evidence: row.evidence,
        pickupName: row.pickup_name,
        dropoffName: row.dropoff_name,
        totalFare: parseFloat(row.total_fare)
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch disputes ledger.', details: err.message });
  }
});

// Resolve Dispute
app.post('/api/admin/dispute/resolve', async (req, res) => {
  const { disputeId, payoutTarget } = req.body;
  if (!disputeId || !payoutTarget) {
    return res.status(400).json({ error: 'Dispute ID and resolution target are required.' });
  }

  try {
    // 1. Get dispute details to resolve transaction
    const disputeRes = await query(
      'SELECT d.*, r.total_fare, r.driver_take_home FROM disputes d JOIN rides r ON d.ride_id = r.id WHERE d.id = $1',
      [disputeId]
    );
    if (disputeRes.rows.length === 0) return res.status(404).json({ error: 'Dispute not found.' });

    const dispute = disputeRes.rows[0];
    const fare = parseFloat(dispute.total_fare);
    const takeHome = parseFloat(dispute.driver_take_home);

    if (payoutTarget === 'passenger') {
      // Refund passenger wallet
      await query('UPDATE passengers SET wallet_balance = wallet_balance + $1 WHERE phone = $2', [fare, dispute.passenger_phone]);
      
      // Deduct earnings from driver
      await query(
        `UPDATE drivers 
         SET earnings_daily = GREATEST(0, earnings_daily - $1), earnings_weekly = GREATEST(0, earnings_weekly - $1) 
         WHERE id = $2`,
        [takeHome, dispute.driver_id]
      );
    }

    // Update status to resolved
    await query('UPDATE disputes SET status = \'resolved\', payout_target = $1 WHERE id = $2', [payoutTarget, disputeId]);

    // Update operational views
    broadcastToAll({ type: 'dispute_resolved', disputeId, payoutTarget });

    res.json({ success: true, disputeId, status: 'resolved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve dispute contract.', details: err.message });
  }
});

// Get Simulator Configurations State
app.get('/api/settings', (req, res) => {
  res.json({ 
    success: true, 
    settings: globalSettings, 
    fuelPrices: globalFuelPrices, 
    congestionZones: globalCongestionZones 
  });
});

// Update settings via admin panel
app.post('/api/admin/settings', (req, res) => {
  const { settings, fuelPrices, congestionZones } = req.body;
  if (settings) globalSettings = { ...globalSettings, ...settings };
  if (fuelPrices) globalFuelPrices = { ...globalFuelPrices, ...fuelPrices };
  if (congestionZones) globalCongestionZones = { ...globalCongestionZones, ...congestionZones };

  broadcastToAll({ 
    type: 'settings_updated', 
    settings: globalSettings, 
    fuelPrices: globalFuelPrices, 
    congestionZones: globalCongestionZones 
  });

  res.json({ success: true });
});

// --- HTTP SERVER SETUP ---
const server = createServer(app);

// --- WEBSOCKETS LOGIC ---
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('New WebSocket Client connection established.');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'register') {
        socketClients.set(ws, { role: data.role, id: data.id });
        console.log(`Client registered: ${data.role} ID: ${data.id}`);
        
        // Confirm registration success
        ws.send(JSON.stringify({ type: 'registered', status: 'ready' }));
        return;
      }

      // Safeguard check for registered socket client metadata
      const clientMeta = socketClients.get(ws);
      if (!clientMeta) {
        console.warn('Received event message from un-registered socket!');
        return;
      }

      // Handle custom events
      switch (data.type) {
        case 'driver_location_update':
          // Update database driver coordinates
          await query(
            'UPDATE drivers SET location_lat = $1, location_lng = $2 WHERE id = $3',
            [data.location.lat, data.location.lng, clientMeta.id]
          );
          // Broadcast coordinates updates to map views
          broadcastToAll({
            type: 'driver_location_broadcast',
            driverId: clientMeta.id,
            location: data.location
          });
          break;

        case 'book_ride':
          // Create database ride record
          await query(
            `INSERT INTO rides (
              id, passenger_phone, driver_id, pickup_name, pickup_lat, pickup_lng, 
              dropoff_name, dropoff_lat, dropoff_lng, distance, status, payment_method, 
              total_fare, driver_take_home, commission, gst_amount, insurance_premium, 
              contract_hash, surge_multiplier
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
            [
              data.ride.id, data.ride.passengerPhone, data.ride.driverId, data.ride.pickupName, data.ride.pickup.lat, data.ride.pickup.lng,
              data.ride.dropoffName, data.ride.dropoff.lat, data.ride.dropoff.lng, data.ride.distance, 'searching', data.ride.paymentMethod,
              data.ride.totalFare, data.ride.takeHome, data.ride.commission, data.ride.gstAmount, data.ride.insurancePremium,
              data.ride.contractHash, data.ride.surgeMultiplier
            ]
          );

          // Find targeted driver client
          const targetDriverWs = findWsClient('driver', data.ride.driverId);
          if (targetDriverWs && targetDriverWs.readyState === WebSocket.OPEN) {
            targetDriverWs.send(JSON.stringify({ type: 'ride_offer', ride: data.ride }));
            console.log(`Dispatched ride contract ${data.ride.id} to Driver ID ${data.ride.driverId}`);
          } else {
            console.warn(`Target driver ID ${data.ride.driverId} WebSocket is currently unavailable.`);
            // Automatically timeout if driver is not connected
            ws.send(JSON.stringify({ type: 'ride_timeout', rideId: data.ride.id }));
          }
          break;

        case 'driver_accept':
          await query("UPDATE rides SET status = 'accepted' WHERE id = $1", [data.rideId]);
          
          // Notify passenger that the driver accepted
          const passengerWsAccept = findWsClient('passenger', data.passengerPhone);
          if (passengerWsAccept) {
            passengerWsAccept.send(JSON.stringify({ type: 'ride_accepted', rideId: data.rideId, driverId: clientMeta.id }));
          }
          // Notify admin console
          broadcastToRole('admin', { type: 'ledger_update' });
          break;

        case 'driver_reject':
          await query("UPDATE rides SET status = 'cancelled' WHERE id = $1", [data.rideId]);
          
          const passengerWsReject = findWsClient('passenger', data.passengerPhone);
          if (passengerWsReject) {
            passengerWsReject.send(JSON.stringify({ type: 'ride_rejected', rideId: data.rideId }));
          }
          break;

        case 'update_ride_status':
          await query('UPDATE rides SET status = $1 WHERE id = $2', [data.status, data.rideId]);

          // Deduct from wallet on trip completion
          if (data.status === 'completed') {
            const rideRes = await query('SELECT passenger_phone, total_fare, driver_id, driver_take_home, commission FROM rides WHERE id = $1', [data.rideId]);
            if (rideRes.rows.length > 0) {
              const ride = rideRes.rows[0];
              const fare = parseFloat(ride.total_fare);
              const takeHome = parseFloat(ride.driver_take_home);
              const commission = parseFloat(ride.commission);

              // 1. Deduct wallet
              await query('UPDATE passengers SET wallet_balance = wallet_balance - $1 WHERE phone = $2', [fare, ride.passenger_phone]);
              
              // 2. Add driver earnings
              await query(
                `UPDATE drivers 
                 SET earnings_daily = earnings_daily + $1, earnings_weekly = earnings_weekly + $1, commission_owed = commission_owed + $2 
                 WHERE id = $3`,
                [takeHome, commission, ride.driver_id]
              );
            }
          }

          // Broadcast status change to the passenger
          const passengerWsStatus = findWsClient('passenger', data.passengerPhone);
          if (passengerWsStatus) {
            passengerWsStatus.send(JSON.stringify({ type: 'ride_status_broadcast', rideId: data.rideId, status: data.status }));
          }
          
          broadcastToRole('admin', { type: 'ledger_update' });
          break;

        case 'send_chat':
          // Broadcast chat to receiver
          const chatReceiverWs = findWsClient(data.receiverRole, data.receiverId);
          if (chatReceiverWs) {
            chatReceiverWs.send(JSON.stringify({ 
              type: 'chat_receive', 
              message: {
                id: data.msgId,
                sender: clientMeta.role,
                text: data.text,
                translation: data.translation,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            }));
          }
          break;

        case 'sos_alert':
          // Log SOS alert locally and notify admins
          broadcastToRole('admin', { 
            type: 'sos_broadcast', 
            driverId: clientMeta.id, 
            rideId: data.rideId, 
            location: data.location 
          });
          console.log(`🚨 SOS Panic Alarm triggered by Driver ${clientMeta.id} during Ride ${data.rideId}`);
          break;

        case 'file_dispute':
          await query(
            `INSERT INTO disputes (id, ride_id, passenger_phone, driver_id, reason, status, payout_target, expires_in) 
             VALUES ($1, $2, $3, $4, $5, 'awaiting_evidence', 'none', $6)`,
            [data.dispute.id, data.dispute.rideId, data.dispute.passengerPhone, data.dispute.driverId, data.dispute.reason, data.dispute.expiresIn]
          );

          broadcastToRole('admin', { type: 'dispute_filed' });
          break;

        case 'upload_dispute_evidence':
          await query(
            `UPDATE disputes 
             SET status = 'under_review', evidence = $1 
             WHERE id = $2`,
            [data.evidence, data.disputeId]
          );
          
          broadcastToRole('admin', { type: 'dispute_evidence_uploaded', disputeId: data.disputeId });
          break;

        default:
          console.warn(`Unhandled WebSocket message type: ${data.type}`);
      }
    } catch (err) {
      console.error('Failed to process incoming WebSocket event message:', err);
    }
  });

  ws.on('close', () => {
    const meta = socketClients.get(ws);
    if (meta) {
      console.log(`Client disconnected: ${meta.role} ID: ${meta.id}`);
      socketClients.delete(ws);
    }
  });
});

// Helper: Broadcast to all connected clients
const broadcastToAll = (payload) => {
  const json = JSON.stringify(payload);
  socketClients.forEach((meta, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(json);
    }
  });
};

// Helper: Broadcast to specific role (e.g. 'admin')
const broadcastToRole = (role, payload) => {
  const json = JSON.stringify(payload);
  socketClients.forEach((meta, ws) => {
    if (meta.role === role && ws.readyState === WebSocket.OPEN) {
      ws.send(json);
    }
  });
};

// Helper: Find WebSocket of specific client
const findWsClient = (role, id) => {
  for (const [ws, meta] of socketClients.entries()) {
    if (meta.role === role && String(meta.id) === String(id)) {
      return ws;
    }
  }
  return null;
};

// Start the integrated HTTP and WebSockets backend server
server.listen(port, '0.0.0.0', () => {
  console.log(`JoldiGo Full-Stack Backend Server running on http://localhost:${port}`);
  console.log(`WebSocket Service Listening on ws://localhost:${port}`);
});
