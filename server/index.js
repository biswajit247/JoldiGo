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

// Initialize client references
let twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
let twilioClient = null;
let razorpay = null;

const initClients = () => {
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (twilioSid && twilioAuthToken) {
    twilioClient = twilio(twilioSid, twilioAuthToken);
    console.log("[Clients Init] Twilio client initialized successfully.");
  } else {
    twilioClient = null;
  }

  const rzpId = process.env.RAZORPAY_KEY_ID;
  const rzpSecret = process.env.RAZORPAY_KEY_SECRET;
  if (rzpId && rzpSecret) {
    razorpay = new Razorpay({
      key_id: rzpId,
      key_secret: rzpSecret
    });
    console.log("[Clients Init] Razorpay client initialized successfully.");
  } else {
    razorpay = null;
  }
};

// Load persisted settings from database and initialize clients
const loadPersistedSettings = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT
      )
    `);

    await query("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicles TEXT DEFAULT '[]'");
    await query("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free'");
    await query("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP DEFAULT NULL");
    await query("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS driver_photo TEXT DEFAULT NULL");
    await query("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_photo TEXT DEFAULT NULL");
    await query("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS age INTEGER DEFAULT NULL");
    await query("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS city VARCHAR(255) DEFAULT NULL");
    await query("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_insurance_photo TEXT DEFAULT NULL");
    await query("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_puc_photo TEXT DEFAULT NULL");
    await query("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS identity_card_photo TEXT DEFAULT NULL");
    await query("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(255) DEFAULT NULL");
    await query("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS bank_ifsc_code VARCHAR(255) DEFAULT NULL");
    await query("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS bank_holder_name VARCHAR(255) DEFAULT NULL");
    await query("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS dl_status VARCHAR(50) DEFAULT 'pending'");
    await query("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS rc_status VARCHAR(50) DEFAULT 'pending'");
    await query("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS insurance_status VARCHAR(50) DEFAULT 'pending'");
    await query("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS puc_status VARCHAR(50) DEFAULT 'pending'");
    await query("ALTER TABLE drivers ADD COLUMN IF NOT EXISTS identity_status VARCHAR(50) DEFAULT 'pending'");
    await query("ALTER TABLE rides ADD COLUMN IF NOT EXISTS passenger_rating INTEGER DEFAULT NULL");
    await query("ALTER TABLE rides ADD COLUMN IF NOT EXISTS passenger_comment TEXT DEFAULT NULL");
    await query("ALTER TABLE passengers ADD COLUMN IF NOT EXISTS name VARCHAR(100) DEFAULT NULL");

    const res = await query("SELECT * FROM system_settings");
    res.rows.forEach(row => {
      if (row.value) {
        process.env[row.key] = row.value;
      }
    });
    console.log("[Settings Loader] Loaded persisted configurations from database.");
  } catch (err) {
    console.warn("[Settings Loader] Could not load persisted configurations from database:", err.message);
  }
  initClients();
};

loadPersistedSettings().then(() => evaluateSurgeSchedules());

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
  surgeMultiplier: 1.0,
  weather: 'clear'
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

let currentActiveScheduledSurge = null;

const evaluateSurgeSchedules = async (schedulesList = null) => {
  try {
    let list = schedulesList;
    if (!list) {
      const dbRes = await query("SELECT value FROM system_settings WHERE key = 'SURGE_SCHEDULES'");
      if (dbRes.rows.length > 0 && dbRes.rows[0].value) {
        list = JSON.parse(dbRes.rows[0].value);
      }
    }
    if (!list || !Array.isArray(list)) return;

    // Get Kolkata HH:MM
    const now = new Date();
    const str = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const localDate = new Date(str);
    const hh = String(localDate.getHours()).padStart(2, '0');
    const mm = String(localDate.getMinutes()).padStart(2, '0');
    const timeStr = `${hh}:${mm}`;

    let maxMultiplier = 1.0;
    let activeSched = null;

    list.forEach(sched => {
      if (!sched.active) return;
      
      let inRange = false;
      if (sched.start <= sched.end) {
        inRange = timeStr >= sched.start && timeStr <= sched.end;
      } else {
        inRange = timeStr >= sched.start || timeStr <= sched.end;
      }

      if (inRange && sched.multiplier > maxMultiplier) {
        maxMultiplier = sched.multiplier;
        activeSched = sched;
      }
    });

    const hasChanged = !currentActiveScheduledSurge || 
                       !activeSched || 
                       currentActiveScheduledSurge.id !== activeSched.id || 
                       currentActiveScheduledSurge.multiplier !== maxMultiplier;

    const wentToDefault = currentActiveScheduledSurge && !activeSched;

    if (hasChanged || wentToDefault) {
      currentActiveScheduledSurge = activeSched ? { ...activeSched, multiplier: maxMultiplier } : null;
      globalSettings.surgeMultiplier = maxMultiplier;

      console.log(`[Surge Scheduler] Active multiplier updated to ${maxMultiplier}x (Active: ${activeSched ? activeSched.name : 'None'})`);
      
      broadcastToAll({
        type: 'settings_updated',
        settings: globalSettings,
        fuelPrices: globalFuelPrices,
        congestionZones: globalCongestionZones,
        activeScheduledSurge: currentActiveScheduledSurge
      });
    }
  } catch (err) {
    console.error("[Surge Scheduler Error]", err);
  }
};

// Start ticker
setInterval(() => {
  evaluateSurgeSchedules();
}, 10000);

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
  const { phone, otp, name } = req.body;
  if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP are required.' });

  const cachedOtp = otpCache.get(phone);
  
  // Backdoor developer code: always allow 1234
  if (otp === '1234' || otp === cachedOtp) {
    try {
      let passengerRes = await query('SELECT * FROM passengers WHERE phone = $1', [phone]);
      
      if (passengerRes.rows.length === 0) {
        await query('INSERT INTO passengers (phone, wallet_balance, name) VALUES ($1, 500.00, $2)', [phone, name || 'Guest Passenger']);
        passengerRes = await query('SELECT * FROM passengers WHERE phone = $1', [phone]);
      } else if (name) {
        await query('UPDATE passengers SET name = $2 WHERE phone = $1', [phone, name]);
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
  const { phone, name } = req.body;
  try {
    let passengerRes = await query('SELECT * FROM passengers WHERE phone = $1', [phone]);
    if (passengerRes.rows.length === 0) {
      await query('INSERT INTO passengers (phone, wallet_balance, name) VALUES ($1, 500.00, $2)', [phone, name || 'Guest Passenger']);
      passengerRes = await query('SELECT * FROM passengers WHERE phone = $1', [phone]);
    } else if (name) {
      await query('UPDATE passengers SET name = $2 WHERE phone = $1', [phone, name]);
      passengerRes = await query('SELECT * FROM passengers WHERE phone = $1', [phone]);
    }
    res.json({ success: true, passenger: passengerRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Login failed.', details: err.message });
  }
});

// Recharge Passenger Wallet
app.post('/api/passenger/recharge', async (req, res) => {
  const { phone, amount } = req.body;
  try {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ error: 'Invalid recharge amount.' });
    }
    
    // Increment wallet balance
    const updateRes = await query(
      'UPDATE passengers SET wallet_balance = wallet_balance + $1 WHERE phone = $2 RETURNING *',
      [amt, phone]
    );
    
    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Passenger profile not found.' });
    }
    
    res.json({ success: true, passenger: updateRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Recharge failed.', details: err.message });
  }
});

// Get All Passengers (Admin Panel)
app.get('/api/admin/passengers', async (req, res) => {
  try {
    const passengersRes = await query('SELECT * FROM passengers ORDER BY created_at DESC');
    res.json({ success: true, passengers: passengersRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch passengers.', details: err.message });
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

// POST /api/passenger/ai-support
app.post('/api/passenger/ai-support', async (req, res) => {
  const { phone, message, chatHistory } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'Phone and message are required.' });

  try {
    // 1. Fetch last completed ride details
    const lastRides = await query(
      `SELECT r.*, d.name as driver_name, d.phone as driver_phone, d.vehicle_number
       FROM rides r 
       LEFT JOIN drivers d ON r.driver_id = d.id 
       WHERE r.passenger_phone = $1 
       ORDER BY r.created_at DESC LIMIT 1`,
      [phone]
    );
    const lastRide = lastRides.rows[0];

    const msg = message.toLowerCase().trim();
    let reply = '';
    let category = 'general';
    let disputeCreated = false;
    let registeredTicketId = null;

    // Detect language of the input message (English, Bengali, Hindi)
    const isBengali = /কত|টাকা|ভাড়া|হারিয়ে|ফেলেছি|সাহায্য|হ্যালো|নমস্কার|অভিযোগ/.test(message);
    const isHindi = /kitna|paisa|bhada|kho|gaya|madad|hello|namaste|shikayat/.test(message);

    // AI Keyword routing & NLP simulation
    if (msg.includes('fare') || msg.includes('charge') || msg.includes('price') || msg.includes('money') || msg.includes('cost') || msg.includes('ভাড়া') || msg.includes('টাকা') || msg.includes('किराया') || msg.includes('पैसा')) {
      category = 'fare';
      if (lastRide) {
        const dateStr = new Date(lastRide.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (isBengali) {
          reply = `আমি দেখতে পাচ্ছি আপনার শেষ ট্রিপটি ছিল ${dateStr} তারিখে ${lastRide.pickup_name} থেকে ${lastRide.dropoff_name} পর্যন্ত। মোট ভাড়া ছিল ₹${parseFloat(lastRide.total_fare).toFixed(2)}। আপনি কি এই ভাড়ার বিরুদ্ধে কোনো আপত্তি (dispute) নথিভুক্ত করতে চান? (হ্যাঁ/না বলুন)`;
        } else if (isHindi) {
          reply = `मुझे आपका आखिरी सफर ${dateStr} को ${lastRide.pickup_name} से ${lastRide.dropoff_name} तक मिला। कुल किराया ₹${parseFloat(lastRide.total_fare).toFixed(2)} था। क्या आप इस किराए के खिलाफ शिकायत दर्ज करना चाहते हैं? (हाँ/ना लिखें)`;
        } else {
          reply = `I see your last trip was on ${dateStr} from ${lastRide.pickup_name} to ${lastRide.dropoff_name} with a total fare of ₹${parseFloat(lastRide.total_fare).toFixed(2)}. Would you like to file a formal dispute for this ride? (Reply "yes" to file)`;
        }
      } else {
        reply = isBengali 
          ? "আপনার কোনো পূর্ববর্তী ট্রিপের রেকর্ড খুঁজে পাওয়া যায়নি।" 
          : (isHindi ? "आपका कोई पुराना सफर नहीं मिला।" : "I couldn't find any completed trip history for your number.");
      }
    } else if (msg === 'yes' || msg === 'yes please' || msg === 'হ্যাঁ' || msg === 'হ্যা' || msg === 'haan' || msg === 'han' || msg === 'file dispute' || msg.includes('dispute') || msg.includes('অভিযোগ') || msg.includes('शिकायत')) {
      category = 'fare';
      if (lastRide) {
        // Check if dispute already exists for this ride
        const existing = await query('SELECT id FROM disputes WHERE ride_id = $1', [lastRide.id]);
        if (existing.rows.length > 0) {
          registeredTicketId = existing.rows[0].id;
          reply = isBengali
            ? `এই ট্রিপের জন্য ইতিমধ্যে একটি অভিযোগ (ID: ${registeredTicketId}) দায়ের করা হয়েছে। আমাদের নিরাপত্তা টিম এটি খতিये দেখছে।`
            : (isHindi ? `इस सफर के लिए पहले से ही एक शिकायत (ID: ${registeredTicketId}) दर्ज है। हमारी टीम इसकी जांच कर रही है।` : `A dispute (ID: ${registeredTicketId}) is already active for this ride. Our safety team is investigating the telemetry.`);
        } else {
          registeredTicketId = 'dsp_' + Math.random().toString(36).substr(2, 9);
          await query(
            `INSERT INTO disputes (id, ride_id, passenger_phone, driver_id, reason, status, payout_target, expires_in)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [registeredTicketId, lastRide.id, phone, lastRide.driver_id, 'Automated AI dispute for fare mismatch', 'awaiting_evidence', 'none', 86400]
          );
          disputeCreated = true;
          broadcastToRole('admin', { type: 'dispute_update' });

          reply = isBengali
            ? `আপনার অভিযোগ সফলভাবে নথিভুক্ত করা হয়েছে! টিকিট আইডি: ${registeredTicketId}। ভাড়ার অসঙ্গতি মূল্যায়নের জন্য আমাদের টিম আপনার সাথে যোগাযোগ করবে।`
            : (isHindi ? `आपकी शिकायत दर्ज कर ली गई है! टिकट आईडी: ${registeredTicketId}। हमारी टीम जल्द ही आपसे संपर्क करेगी।` : `Dispute registered successfully! Ticket ID: ${registeredTicketId}. Our compliance team is pulling the GPS telemetry to evaluate the fare difference.`);
        }
      } else {
        reply = "No active ride found to dispute.";
      }
    } else if (msg.includes('lost') || msg.includes('phone') || msg.includes('bag') || msg.includes('left') || msg.includes('forgot') || msg.includes('হারিয়ে') || msg.includes('ফেলেছি') || msg.includes('खो') || msg.includes('छूट')) {
      category = 'lost_item';
      if (lastRide) {
        registeredTicketId = 'lost_' + Math.random().toString(36).substr(2, 9);
        if (isBengali) {
          reply = `চিন্তা করবেন না! আপনার শেষ ট্রিপের চালক ছিলেন ${lastRide.driver_name}। আমি চালকের সাথে যোগাযোগ করে হারিয়ে যাওয়া জিনিসটি পুনরুদ্ধারের জন্য একটি টিকিট (ID: ${registeredTicketId}) তৈরি করেছি। চালক আপনার সাথে যোগাযোগ করবেন।`;
        } else if (isHindi) {
          reply = `चिंता न करें! आपके आखरी सफर के ड्राइवर ${lastRide.driver_name} थे। मैंने उन्हें सूचित कर दिया है और एक टिकट (ID: ${registeredTicketId}) बना दिया है। वह जल्द ही आपसे बात करेंगे।`;
        } else {
          reply = `Don't worry! Your last captain was ${lastRide.driver_name} (${lastRide.vehicle_number}). I have dispatched an alert to the driver and registered a safety tracking ticket (ID: ${registeredTicketId}) to recover your item.`;
        }
      } else {
        reply = "I couldn't find your last captain to check for lost items.";
      }
    } else {
      // General greeting/help
      if (isBengali) {
        reply = `হ্যালো! আমি জলদিগো এআই সাপোর্ট অ্যাসিস্ট্যান্ট। 🤖 আমি আপনাকে কীভাবে সাহায্য করতে পারি?
1. শেষ ট্রিপের ভাড়া পরীক্ষা করতে "ভাড়া" লিখুন।
2. ভাড়ার অসঙ্গতির জন্য "dispute" লিখুন।
3. গাড়িতে কিছু ফেলে গেলে "হারিয়ে ফেলেছি" লিখুন।`;
      } else if (isHindi) {
        reply = `नमस्ते! मैं जल्दीगो एआई सहायक हूँ। 🤖 मैं आपकी क्या मदद कर सकता हूँ?
1. आखरी किराए की जांच के लिए "kiraya" लिखें।
2. किराए की शिकायत के लिए "dispute" लिखें।
3. गाड़ी में सामान छूट जाने पर "kho gaya" लिखें।`;
      } else {
        reply = `Hello! I am your JoldiGo AI Safety & Care Assistant. 🤖 How can I help you today?
- Type **"fare"** to check your last ride details.
- Type **"yes"** after checking to file a formal dispute.
- Type **"lost"** if you left a bag or phone in the driver's vehicle.`;
      }
    }

    res.json({
      success: true,
      reply,
      category,
      disputeCreated,
      ticketId: registeredTicketId
    });
  } catch (err) {
    res.status(500).json({ error: 'AI processing failed.', details: err.message });
  }
});

// 2. DRIVER ROUTES

const formatDriverRecord = (drv) => ({
  id: drv.id,
  name: drv.name,
  phone: drv.phone,
  vehicleType: drv.vehicle_type,
  vehicleName: drv.vehicle_name,
  vehicleNumber: drv.vehicle_number,
  status: drv.status,
  verificationStatus: drv.verification_status,
  rating: parseFloat(drv.rating || 5),
  location: { lat: parseFloat(drv.location_lat || 22.5726), lng: parseFloat(drv.location_lng || 88.3639) },
  documents: { license: drv.license_number, aadhar: drv.aadhar_number, rc: drv.rc_number },
  earnings: { daily: parseFloat(drv.earnings_daily || 0), weekly: parseFloat(drv.earnings_weekly || 0), commission: parseFloat(drv.commission_owed || 0) },
  vehicles: JSON.parse(drv.vehicles || '[]'),
  subscriptionTier: drv.subscription_tier || 'free',
  subscriptionExpiresAt: drv.subscription_expires_at,
  driverPhoto: drv.driver_photo || null,
  vehiclePhoto: drv.vehicle_photo || null,
  age: drv.age || null,
  city: drv.city || null,
  vehicleInsurancePhoto: drv.vehicle_insurance_photo || null,
  vehiclePucPhoto: drv.vehicle_puc_photo || null,
  identityCardPhoto: drv.identity_card_photo || null,
  bankDetails: {
    accountNumber: drv.bank_account_number || '',
    ifscCode: drv.bank_ifsc_code || '',
    holderName: drv.bank_holder_name || ''
  },
  documentStatuses: {
    dl: drv.dl_status || 'pending',
    rc: drv.rc_status || 'pending',
    insurance: drv.insurance_status || 'pending',
    puc: drv.puc_status || 'pending',
    identity: drv.identity_status || 'pending'
  }
});

// Get All Drivers
app.get('/api/drivers', async (req, res) => {
  try {
    const driversRes = await query('SELECT * FROM drivers');
    const formattedDrivers = driversRes.rows.map(drv => formatDriverRecord(drv));
    res.json({ success: true, drivers: formattedDrivers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve drivers list.' });
  }
});

// Get active vehicles for driver
app.get('/api/driver/vehicles', async (req, res) => {
  const { driverId } = req.query;
  if (!driverId) return res.status(400).json({ error: 'Driver ID is required.' });
  try {
    const dbRes = await query("SELECT vehicles FROM drivers WHERE id = $1", [driverId]);
    if (dbRes.rows.length > 0) {
      return res.json({ success: true, vehicles: JSON.parse(dbRes.rows[0].vehicles || '[]') });
    }
    res.json({ success: true, vehicles: [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve garage vehicles.', details: err.message });
  }
});

// Rate ride and process tips
app.post('/api/ride/rate', async (req, res) => {
  const { rideId, rating, comment, tipAmount } = req.body;
  const parsedRating = parseFloat(rating || 5);
  const parsedTip = parseFloat(tipAmount || 0);
  
  try {
    const rideRes = await query('SELECT passenger_phone, driver_id FROM rides WHERE id = $1', [rideId]);
    if (rideRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ride not found.' });
    }
    const ride = rideRes.rows[0];

    // Update ride rating and passenger comments
    await query('UPDATE rides SET rating = $1, passenger_rating = $1, passenger_comment = $2 WHERE id = $3', [parsedRating, comment || '', rideId]);

    // Recalculate average rating for driver
    const avgRes = await query('SELECT AVG(rating) as avg_rating FROM rides WHERE driver_id = $1 AND rating IS NOT NULL', [ride.driver_id]);
    if (avgRes.rows.length > 0 && avgRes.rows[0].avg_rating) {
      const newAvg = parseFloat(avgRes.rows[0].avg_rating);
      await query('UPDATE drivers SET rating = $1 WHERE id = $2', [newAvg, ride.driver_id]);
    }

    // Process tipping transaction
    if (parsedTip > 0) {
      // Deduct from passenger wallet
      await query('UPDATE passengers SET wallet_balance = wallet_balance - $1 WHERE phone = $2', [parsedTip, ride.passenger_phone]);
      
      // Credit 100% of the tip amount to driver's earnings
      await query('UPDATE drivers SET earnings_daily = earnings_daily + $1, earnings_weekly = earnings_weekly + $1 WHERE id = $2', [parsedTip, ride.driver_id]);
      
      console.log(`🎁 Tip of ₹${parsedTip} processed for Driver ${ride.driver_id} from Passenger ${ride.passenger_phone}`);
    }

    broadcastToRole('admin', { type: 'ledger_update' });
    broadcastDriversUpdate();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to rate and tip driver.', details: err.message });
  }
});

// Switch active vehicle
app.post('/api/driver/vehicles/select', async (req, res) => {
  const { driverId, vehicleId } = req.body;
  if (!driverId || !vehicleId) return res.status(400).json({ error: 'Driver ID and Vehicle ID required.' });
  try {
    const dbRes = await query("SELECT vehicles FROM drivers WHERE id = $1", [driverId]);
    if (dbRes.rows.length === 0) return res.status(404).json({ error: 'Driver not found.' });

    let list = JSON.parse(dbRes.rows[0].vehicles || '[]');
    let selectedVeh = null;

    list = list.map(v => {
      if (v.id === vehicleId) {
        v.active = true;
        selectedVeh = v;
      } else {
        v.active = false;
      }
      return v;
    });

    if (!selectedVeh) return res.status(400).json({ error: 'Vehicle not registered.' });

    await query(
      `UPDATE drivers 
       SET vehicle_type = $1, vehicle_name = $2, vehicle_number = $3, vehicles = $4 
       WHERE id = $5`,
      [selectedVeh.type, selectedVeh.name, selectedVeh.number, JSON.stringify(list), driverId]
    );

    await broadcastDriversUpdate();

    res.json({ success: true, vehicles: list });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update active vehicle.', details: err.message });
  }
});

// Register new vehicle
app.post('/api/driver/vehicles/add', async (req, res) => {
  const { driverId, type, name, number } = req.body;
  if (!driverId || !type || !name || !number) {
    return res.status(400).json({ error: 'All vehicle specifications required.' });
  }
  try {
    const dbRes = await query("SELECT vehicles FROM drivers WHERE id = $1", [driverId]);
    if (dbRes.rows.length === 0) return res.status(404).json({ error: 'Driver not found.' });

    const list = JSON.parse(dbRes.rows[0].vehicles || '[]');
    const newVeh = {
      id: 'v_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type,
      name,
      number,
      active: false
    };

    list.push(newVeh);

    await query("UPDATE drivers SET vehicles = $1 WHERE id = $2", [JSON.stringify(list), driverId]);

    res.json({ success: true, vehicles: list });
  } catch (err) {
    res.status(500).json({ error: 'Failed to register new vehicle.', details: err.message });
  }
});

// Get driver completed ride history logs
app.get('/api/driver/history', async (req, res) => {
  const { driverId } = req.query;
  if (!driverId) return res.status(400).json({ error: 'Driver ID is required.' });
  try {
    const ridesRes = await query(
      `SELECT id, pickup_name, dropoff_name, distance, total_fare, driver_take_home, created_at, passenger_rating, passenger_comment
       FROM rides 
       WHERE driver_id = $1 AND status = 'completed'
       ORDER BY created_at DESC`,
      [driverId]
    );
    res.json({ success: true, history: ridesRes.rows.map(r => ({
      id: r.id,
      pickupName: r.pickup_name,
      dropoffName: r.dropoff_name,
      distance: parseFloat(r.distance || 0),
      totalFare: parseFloat(r.total_fare || 0),
      takeHome: parseFloat(r.driver_take_home || 0),
      createdAt: r.created_at,
      rating: r.passenger_rating ? parseInt(r.passenger_rating) : null,
      comment: r.passenger_comment || ''
    })) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve completed rides history.', details: err.message });
  }
});

// Enroll a brand new real driver
app.post('/api/driver/enroll', async (req, res) => {
  const { 
    name, phone, vehicleType, vehicleName, vehicleNumber, licenseNumber, aadharNumber, rcNumber, 
    driverPhoto, vehiclePhoto, age, city, vehicleInsurancePhoto, vehiclePucPhoto, identityCardPhoto,
    bankAccountNumber, bankIfscCode, bankHolderName
  } = req.body;
  
  if (!name || !phone || !vehicleType || !vehicleName || !vehicleNumber || !licenseNumber || !aadharNumber || !rcNumber) {
    return res.status(400).json({ success: false, error: 'All primary fields are required.' });
  }

  try {
    // Generate new driver ID dynamically
    const countRes = await query("SELECT COUNT(*) FROM drivers");
    const nextNum = parseInt(countRes.rows[0].count) + 1;
    const newDriverId = `drv_${nextNum}`;

    // Insert new driver record into PostgreSQL database with pending verification
    await query(
      `INSERT INTO drivers (
        id, name, phone, vehicle_type, vehicle_name, vehicle_number, 
        status, verification_status, rating, location_lat, location_lng, 
        license_number, aadhar_number, rc_number, driver_photo, vehicle_photo,
        age, city, vehicle_insurance_photo, vehicle_puc_photo, identity_card_photo,
        bank_account_number, bank_ifsc_code, bank_holder_name,
        dl_status, rc_status, insurance_status, puc_status, identity_status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 'offline', 'pending', 5.00, 22.5600, 88.3600, 
        $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
        'pending', 'pending', 'pending', 'pending', 'pending'
      )`,
      [
        newDriverId, name, phone, vehicleType, vehicleName, vehicleNumber, 
        licenseNumber, aadharNumber, rcNumber, driverPhoto, vehiclePhoto,
        age ? parseInt(age) : null, city || null, vehicleInsurancePhoto || null, vehiclePucPhoto || null, identityCardPhoto || null,
        bankAccountNumber || null, bankIfscCode || null, bankHolderName || null
      ]
    );

    // Fetch and format updated drivers list
    const allDrvRes = await query('SELECT * FROM drivers ORDER BY id ASC');
    const formattedDrivers = allDrvRes.rows.map(d => formatDriverRecord(d));
    
    // Broadcast updated driver records array to all active maps/admin views
    broadcastToAll({ type: 'drivers_updated', drivers: formattedDrivers });

    res.json({ success: true, driver: formattedDrivers.find(d => d.id === newDriverId) });
  } catch (err) {
    console.error('Error during driver enrollment:', err);
    res.status(500).json({ success: false, error: 'Database enrollment error: ' + err.message });
  }
});

// Get driver subscription details
app.get('/api/driver/subscription', async (req, res) => {
  const { driverId } = req.query;
  if (!driverId) return res.status(400).json({ error: 'Driver ID is required.' });
  try {
    const dbRes = await query(
      "SELECT subscription_tier, subscription_expires_at FROM drivers WHERE id = $1",
      [driverId]
    );
    if (dbRes.rows.length === 0) return res.status(404).json({ error: 'Driver not found.' });
    
    res.json({
      success: true,
      tier: dbRes.rows[0].subscription_tier || 'free',
      expiresAt: dbRes.rows[0].subscription_expires_at
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load driver subscription details.', details: err.message });
  }
});

// Upgrade driver subscription tier
app.post('/api/driver/subscription/upgrade', async (req, res) => {
  const { driverId, tier } = req.body;
  if (!driverId || !tier) {
    return res.status(400).json({ error: 'Driver ID and target tier are required.' });
  }
  if (!['free', 'silver', 'gold'].includes(tier)) {
    return res.status(400).json({ error: 'Invalid subscription tier.' });
  }
  try {
    const expiry = tier === 'free' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await query(
      "UPDATE drivers SET subscription_tier = $1, subscription_expires_at = $2 WHERE id = $3",
      [tier, expiry, driverId]
    );
    
    await broadcastDriversUpdate();

    res.json({ success: true, tier, expiresAt: expiry });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upgrade subscription.', details: err.message });
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
    razorpayKeySecret: mask(process.env.RAZORPAY_KEY_SECRET),
    googleMapsKeyWeb: mask(process.env.GOOGLE_MAPS_API_KEY_WEB),
    googleMapsKeyAndroid: mask(process.env.GOOGLE_MAPS_API_KEY_ANDROID),
    googleMapsKeyIos: mask(process.env.GOOGLE_MAPS_API_KEY_IOS),
    pricingEngineUrl: process.env.PRICING_ENGINE_API_URL || '',
    pricingEngineApiKey: mask(process.env.PRICING_ENGINE_API_KEY)
  });
});

// Update environment variables dynamically
app.post('/api/admin/env/update', async (req, res) => {
  const { 
    databaseUrl, 
    twilioSid, 
    twilioAuthToken, 
    twilioPhoneNumber, 
    razorpayKeyId, 
    razorpayKeySecret,
    googleMapsKeyWeb,
    googleMapsKeyAndroid,
    googleMapsKeyIos,
    pricingEngineUrl,
    pricingEngineApiKey
  } = req.body;
  
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
    const nextGoogleWeb = googleMapsKeyWeb && !googleMapsKeyWeb.includes('****') ? googleMapsKeyWeb : process.env.GOOGLE_MAPS_API_KEY_WEB;
    const nextGoogleAndroid = googleMapsKeyAndroid && !googleMapsKeyAndroid.includes('****') ? googleMapsKeyAndroid : process.env.GOOGLE_MAPS_API_KEY_ANDROID;
    const nextGoogleIos = googleMapsKeyIos && !googleMapsKeyIos.includes('****') ? googleMapsKeyIos : process.env.GOOGLE_MAPS_API_KEY_IOS;
    const nextPricingUrl = pricingEngineUrl ? pricingEngineUrl : process.env.PRICING_ENGINE_API_URL;
    const nextPricingKey = pricingEngineApiKey && !pricingEngineApiKey.includes('****') ? pricingEngineApiKey : process.env.PRICING_ENGINE_API_KEY;

    if (nextDb) envLines.push(`DATABASE_URL=${nextDb}`);
    if (nextTwilioSid) envLines.push(`TWILIO_ACCOUNT_SID=${nextTwilioSid}`);
    if (nextTwilioAuthToken) envLines.push(`TWILIO_AUTH_TOKEN=${nextTwilioAuthToken}`);
    if (nextTwilioPhone) envLines.push(`TWILIO_PHONE_NUMBER=${nextTwilioPhone}`);
    if (nextRzpId) envLines.push(`RAZORPAY_KEY_ID=${nextRzpId}`);
    if (nextRzpSecret) envLines.push(`RAZORPAY_KEY_SECRET=${nextRzpSecret}`);
    if (nextGoogleWeb) envLines.push(`GOOGLE_MAPS_API_KEY_WEB=${nextGoogleWeb}`);
    if (nextGoogleAndroid) envLines.push(`GOOGLE_MAPS_API_KEY_ANDROID=${nextGoogleAndroid}`);
    if (nextGoogleIos) envLines.push(`GOOGLE_MAPS_API_KEY_IOS=${nextGoogleIos}`);
    if (nextPricingUrl) envLines.push(`PRICING_ENGINE_API_URL=${nextPricingUrl}`);
    if (nextPricingKey) envLines.push(`PRICING_ENGINE_API_KEY=${nextPricingKey}`);
    
    fs.writeFileSync(envPath, envLines.join('\n'), 'utf-8');

    // Save to Postgres settings table for persistence across restarts
    const saveKey = async (k, v) => {
      if (v) {
        await query(
          "INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
          [k, v]
        );
      }
    };
    await saveKey('DATABASE_URL', nextDb);
    await saveKey('TWILIO_ACCOUNT_SID', nextTwilioSid);
    await saveKey('TWILIO_AUTH_TOKEN', nextTwilioAuthToken);
    await saveKey('TWILIO_PHONE_NUMBER', nextTwilioPhone);
    await saveKey('RAZORPAY_KEY_ID', nextRzpId);
    await saveKey('RAZORPAY_KEY_SECRET', nextRzpSecret);
    await saveKey('GOOGLE_MAPS_API_KEY_WEB', nextGoogleWeb);
    await saveKey('GOOGLE_MAPS_API_KEY_ANDROID', nextGoogleAndroid);
    await saveKey('GOOGLE_MAPS_API_KEY_IOS', nextGoogleIos);
    await saveKey('PRICING_ENGINE_API_URL', nextPricingUrl);
    await saveKey('PRICING_ENGINE_API_KEY', nextPricingKey);
    
    // Explicitly overwrite process.env variables in-memory (dotenv.config does not overwrite already loaded keys)
    if (nextDb) process.env.DATABASE_URL = nextDb;
    if (nextTwilioSid) process.env.TWILIO_ACCOUNT_SID = nextTwilioSid;
    if (nextTwilioAuthToken) process.env.TWILIO_AUTH_TOKEN = nextTwilioAuthToken;
    if (nextTwilioPhone) process.env.TWILIO_PHONE_NUMBER = nextTwilioPhone;
    if (nextRzpId) process.env.RAZORPAY_KEY_ID = nextRzpId;
    if (nextRzpSecret) process.env.RAZORPAY_KEY_SECRET = nextRzpSecret;
    if (nextGoogleWeb) process.env.GOOGLE_MAPS_API_KEY_WEB = nextGoogleWeb;
    if (nextGoogleAndroid) process.env.GOOGLE_MAPS_API_KEY_ANDROID = nextGoogleAndroid;
    if (nextGoogleIos) process.env.GOOGLE_MAPS_API_KEY_IOS = nextGoogleIos;
    if (nextPricingUrl) process.env.PRICING_ENGINE_API_URL = nextPricingUrl;
    if (nextPricingKey) process.env.PRICING_ENGINE_API_KEY = nextPricingKey;
    
    // Re-initialize clients in-memory with new keys
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER; // update local twilioPhoneNumber variable
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

// Get active geofencing zones
app.get('/api/geofence/zones', async (req, res) => {
  try {
    const dbRes = await query("SELECT value FROM system_settings WHERE key = 'GEOFENCING_ZONES'");
    if (dbRes.rows.length > 0 && dbRes.rows[0].value) {
      return res.json(JSON.parse(dbRes.rows[0].value));
    }

    // Default seeded zones
    const defaultZones = [
      { id: 'zone_airport', name: 'Kolkata CCU Airport Zone', points: [ [22.63, 88.42], [22.66, 88.45], [22.65, 88.47], [22.61, 88.43] ], type: 'surge', multiplier: 1.5, active: true },
      { id: 'zone_howrah', name: 'Howrah Bridge VIP Restriction Zone', points: [ [22.58, 88.33], [22.59, 88.35], [22.57, 88.36], [22.56, 88.34] ], type: 'ban', multiplier: 1.0, active: false },
      { id: 'zone_saltlake', name: 'Salt Lake IT Core Surge Zone', points: [ [22.56, 88.41], [22.58, 88.44], [22.56, 88.46], [22.54, 88.42] ], type: 'surge', multiplier: 1.3, active: true }
    ];

    // Persist default zones
    await query(
      "INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
      ['GEOFENCING_ZONES', JSON.stringify(defaultZones)]
    );

    res.json(defaultZones);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve geofence zones.', details: err.message });
  }
});

// Update geofencing zones properties
app.post('/api/admin/geofence/update', async (req, res) => {
  const { zones } = req.body;
  if (!zones) return res.status(400).json({ error: 'Zones configuration required.' });

  try {
    await query(
      "INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
      ['GEOFENCING_ZONES', JSON.stringify(zones)]
    );

    // Broadcast update to all connected maps and passengers
    broadcastToAll({ type: 'geofence_zones_updated', zones });

    res.json({ success: true, zones });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update geofence zones.', details: err.message });
  }
});

// Get active fraud alerts
app.get('/api/admin/fraud/alerts', async (req, res) => {
  try {
    const alertsRes = await query("SELECT * FROM fraud_alerts ORDER BY created_at DESC");
    res.json({ success: true, alerts: alertsRes.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve fraud alerts.', details: err.message });
  }
});

// Resolve fraud alert (Suspend driver or dismiss)
app.post('/api/admin/fraud/resolve', async (req, res) => {
  const { alertId, action } = req.body;
  if (!alertId || !action) return res.status(400).json({ error: 'Alert ID and Action required.' });

  try {
    if (action === 'suspend') {
      const alertRes = await query("SELECT driver_id FROM fraud_alerts WHERE id = $1", [alertId]);
      if (alertRes.rows.length > 0) {
        const driverId = alertRes.rows[0].driver_id;
        await query("UPDATE drivers SET verification_status = 'suspended', status = 'offline' WHERE id = $1", [driverId]);
        
        // Notify driver of suspension
        const driverWs = findWsClient('driver', driverId);
        if (driverWs) {
          driverWs.send(JSON.stringify({ type: 'verification_updated', status: 'suspended' }));
        }
      }
      await query("UPDATE fraud_alerts SET status = 'resolved_suspended' WHERE id = $1", [alertId]);
    } else if (action === 'dismiss') {
      await query("UPDATE fraud_alerts SET status = 'dismissed' WHERE id = $1", [alertId]);
    }

    const updatedAlerts = await query("SELECT * FROM fraud_alerts ORDER BY created_at DESC");
    broadcastToAll({ type: 'fraud_alerts_updated', alerts: updatedAlerts.rows });

    res.json({ success: true, alerts: updatedAlerts.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve fraud alert.', details: err.message });
  }
});

// Get active surge schedules
app.get('/api/admin/surge/schedules', async (req, res) => {
  try {
    const dbRes = await query("SELECT value FROM system_settings WHERE key = 'SURGE_SCHEDULES'");
    if (dbRes.rows.length > 0 && dbRes.rows[0].value) {
      return res.json(JSON.parse(dbRes.rows[0].value));
    }

    const defaultSchedules = [
      { id: 'morning_rush', name: 'Morning Rush Hours', start: '09:00', end: '11:00', multiplier: 1.4, active: true },
      { id: 'evening_rush', name: 'Evening Peak Hours', start: '18:00', end: '21:00', multiplier: 1.5, active: true },
      { id: 'night_peak', name: 'Late Night Surge', start: '23:00', end: '03:00', multiplier: 1.3, active: true }
    ];

    await query(
      "INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
      ['SURGE_SCHEDULES', JSON.stringify(defaultSchedules)]
    );

    res.json(defaultSchedules);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve surge schedules.', details: err.message });
  }
});

// Update surge schedules
app.post('/api/admin/surge/schedules/update', async (req, res) => {
  const { schedules } = req.body;
  if (!schedules) return res.status(400).json({ error: 'Schedules array required.' });

  try {
    await query(
      "INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
      ['SURGE_SCHEDULES', JSON.stringify(schedules)]
    );

    await evaluateSurgeSchedules(schedules);

    res.json({ success: true, schedules });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update surge schedules.', details: err.message });
  }
});

let globalCustomHotspots = [];

// Get passenger demand hotspots
app.get('/api/admin/demand/hotspots', async (req, res) => {
  try {
    const ridesRes = await query(`
      SELECT pickup_lat as lat, pickup_lng as lng, 1.0 as weight 
      FROM rides 
      ORDER BY created_at DESC 
      LIMIT 40
    `);
    
    // Seed standard base hot locations to ensure there's always a beautiful pattern
    const mockHotspots = [
      { lat: 22.5485, lng: 88.3532, weight: 0.8 }, // Park Street
      { lat: 22.5831, lng: 88.3412, weight: 0.95 }, // Howrah Bridge Area
      { lat: 22.5692, lng: 88.4321, weight: 0.75 }, // Salt Lake Sector V
      { lat: 22.6421, lng: 88.4411, weight: 0.65 }, // Kolkata Airport (CCU)
      { lat: 22.5181, lng: 88.3832, weight: 0.55 }, // Gariahat Market
      { lat: 22.5726, lng: 88.3639, weight: 0.82 }  // College Street
    ];

    // Jitter function for realism
    const result = [
      ...ridesRes.rows.map(r => ({ lat: parseFloat(r.lat), lng: parseFloat(r.lng), weight: 1.0 })),
      ...mockHotspots.map(h => ({
        lat: h.lat + (Math.random() - 0.5) * 0.006,
        lng: h.lng + (Math.random() - 0.5) * 0.006,
        weight: h.weight
      })),
      ...globalCustomHotspots
    ];

    res.json({ success: true, hotspots: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve demand hotspots.', details: err.message });
  }
});

// Add a custom passenger demand hotspot
app.post('/api/admin/demand/hotspots', (req, res) => {
  const { hotspot } = req.body;
  if (!hotspot || !hotspot.lat || !hotspot.lng) {
    return res.status(400).json({ error: 'Invalid hotspot payload.' });
  }
  
  const newHotspot = {
    lat: parseFloat(hotspot.lat),
    lng: parseFloat(hotspot.lng),
    weight: parseFloat(hotspot.weight || 0.8)
  };
  globalCustomHotspots.push(newHotspot);
  
  broadcastToAll({
    type: 'settings_updated',
    settings: globalSettings,
    fuelPrices: globalFuelPrices,
    congestionZones: globalCongestionZones
  });
  
  res.json({ success: true, hotspots: globalCustomHotspots });
});

// Reset JoldiGo Simulator and database transactions
app.post('/api/admin/reset', async (req, res) => {
  try {
    // 1. Clear active ride and reset driver status
    await query("UPDATE drivers SET status = 'offline', verification_status = 'verified', earnings_daily = 0, earnings_weekly = 0, commission_owed = 0, subscription_tier = 'free', subscription_expires_at = NULL");
    
    // 2. Clear rides table, disputes, and safety claims
    await query("TRUNCATE TABLE disputes CASCADE");
    await query("TRUNCATE TABLE rides CASCADE");
    await query("TRUNCATE TABLE safety_claims CASCADE");
    
    // 3. Reset settings
    globalSettings = {
      baseFareCarAC: 50, perKmCarAC: 20,
      baseFareCarNonAC: 30, perKmCarNonAC: 15,
      baseFareBike: 20, perKmBike: 7,
      surgeMultiplier: 1.0,
      weather: 'clear'
    };
    globalFuelPrices = { cng: 95.5, petrol: 104.5, diesel: 92.75 };
    globalCongestionZones = { HOWRAH_BRIDGE: 'clear', PARK_STREET: 'clear', SALT_LAKE_SEC5: 'clear' };
    globalCustomHotspots = [];
    
    // Broadcast setting changes
    broadcastToAll({ 
      type: 'settings_updated', 
      settings: globalSettings, 
      fuelPrices: globalFuelPrices, 
      congestionZones: globalCongestionZones 
    });
    
    // Broadcast reset completed reload signal to client
    broadcastToAll({ type: 'reset_completed' });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset simulator state.', details: err.message });
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

    // Gross fare from completed rides
    const fareRes = await query("SELECT SUM(total_fare) as total_fare_sum FROM rides WHERE status = 'completed'");
    const grossBookings = parseFloat(fareRes.rows[0].total_fare_sum || 0);

    // Driver payouts from completed rides
    const takeHomeRes = await query("SELECT SUM(driver_take_home) as total_take_home FROM rides WHERE status = 'completed'");
    const driverPayouts = parseFloat(takeHomeRes.rows[0].total_take_home || 0);

    // GST Tax liabilities from completed rides
    const gstRes = await query("SELECT SUM(gst_amount) as total_gst FROM rides WHERE status = 'completed'");
    const accumulatedGstTotal = parseFloat(gstRes.rows[0].total_gst || 0);

    // Sum of driver tier subscriptions
    const tiersRes = await query("SELECT subscription_tier, COUNT(*) as count FROM drivers GROUP BY subscription_tier");
    let silverCount = 0;
    let goldCount = 0;
    let freeCount = 0;
    tiersRes.rows.forEach(r => {
      if (r.subscription_tier === 'silver') silverCount = parseInt(r.count || 0);
      else if (r.subscription_tier === 'gold') goldCount = parseInt(r.count || 0);
      else freeCount = parseInt(r.count || 0);
    });
    const subscriptionEarnings = (silverCount * 299) + (goldCount * 599);

    res.json({
      success: true,
      stats: {
        totalCommission,
        safetyPoolBalance,
        activeTrips,
        commissionBalance: totalCommission,
        grossBookings,
        driverPayouts,
        accumulatedGstTotal,
        silverCount,
        goldCount,
        freeCount,
        subscriptionEarnings
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

    broadcastToAll({ type: 'ledger_update' });

    res.json({ success: true, driverId, status: nextStatus });
  } catch (err) {
    res.status(500).json({ error: 'Driver verification update failed.', details: err.message });
  }
});

// Verify/Reject specific KYC document card
app.post('/api/admin/driver/verify-doc', async (req, res) => {
  const { driverId, documentType, approve } = req.body;
  if (!driverId || !documentType) return res.status(400).json({ error: 'Driver ID and Document Type are required.' });

  const columnMap = {
    dl: 'dl_status',
    rc: 'rc_status',
    insurance: 'insurance_status',
    puc: 'puc_status',
    identity: 'identity_status'
  };

  const col = columnMap[documentType];
  if (!col) return res.status(400).json({ error: 'Invalid documentType.' });

  const docStatus = approve ? 'verified' : 'rejected';

  try {
    await query(`UPDATE drivers SET ${col} = $1 WHERE id = $2`, [docStatus, driverId]);

    // Check overall verification status
    const driverRes = await query("SELECT dl_status, rc_status, insurance_status, puc_status, identity_status FROM drivers WHERE id = $1", [driverId]);
    if (driverRes.rows.length > 0) {
      const d = driverRes.rows[0];
      let nextOverallStatus = 'pending';
      
      if (d.dl_status === 'verified' && d.rc_status === 'verified' && d.insurance_status === 'verified' && d.puc_status === 'verified' && d.identity_status === 'verified') {
        nextOverallStatus = 'verified'; // fully verified!
      } else if (d.dl_status === 'rejected' || d.rc_status === 'rejected' || d.insurance_status === 'rejected' || d.puc_status === 'rejected' || d.identity_status === 'rejected') {
        nextOverallStatus = 'rejected'; // rejected
      }

      await query('UPDATE drivers SET verification_status = $1 WHERE id = $2', [nextOverallStatus, driverId]);

      // Broadcast back to driver
      const targetDriverWs = findWsClient('driver', driverId);
      if (targetDriverWs) {
        targetDriverWs.send(JSON.stringify({ type: 'verification_updated', status: nextOverallStatus }));
      }
    }

    await broadcastDriversUpdate();
    broadcastToAll({ type: 'ledger_update' });

    res.json({ success: true, driverId, documentType, status: docStatus });
  } catch (err) {
    res.status(500).json({ error: 'Document verification update failed.', details: err.message });
  }
});

// Execute batch driver weekly payout
app.post('/api/admin/driver/payout', async (req, res) => {
  const { driverId } = req.body;
  if (!driverId) return res.status(400).json({ error: 'Driver ID is required.' });

  try {
    const driverRes = await query('SELECT earnings_weekly, name FROM drivers WHERE id = $1', [driverId]);
    if (driverRes.rows.length === 0) return res.status(404).json({ error: 'Driver not found.' });

    const payoutAmount = parseFloat(driverRes.rows[0].earnings_weekly);
    
    // Reset weekly earnings and commission owed to zero as payout completes
    await query('UPDATE drivers SET earnings_weekly = 0, commission_owed = 0 WHERE id = $1', [driverId]);

    // Log payout activity in server console
    console.log(`[PAYOUT COMPLETED] Transferred net ₹${payoutAmount} weekly earnings to partner ${driverRes.rows[0].name}.`);

    broadcastToAll({ type: 'ledger_update' });

    res.json({ success: true, driverId, payoutAmount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process driver payout.', details: err.message });
  }
});

// Broadcast custom SMS/Push alert to all active simulators
app.post('/api/admin/broadcast-notification', (req, res) => {
  const { target, message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message content is required.' });

  broadcastToAll({
    type: 'system_broadcast',
    target: target || 'all',
    message,
    timestamp: new Date().toLocaleTimeString()
  });

  console.log(`[BROADCAST DEPLOYED] Sent system-wide alert to ${target || 'all'}: "${message}"`);
  res.json({ success: true, target, message });
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

// Update global weather status
app.post('/api/admin/weather', (req, res) => {
  const { weather } = req.body;
  if (!['clear', 'rain', 'flooding'].includes(weather)) {
    return res.status(400).json({ error: 'Invalid weather condition.' });
  }
  globalSettings.weather = weather;

  broadcastToAll({ 
    type: 'settings_updated', 
    settings: globalSettings, 
    fuelPrices: globalFuelPrices, 
    congestionZones: globalCongestionZones 
  });

  res.json({ success: true, weather: globalSettings.weather });
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
        case 'initiate_call':
          // Route call invitation to target client
          socketClients.forEach((meta, clientWs) => {
            if (meta.role === data.payload.targetRole && meta.id === data.payload.targetId && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'incoming_call',
                fromRole: clientMeta.role,
                fromId: clientMeta.id,
                fromName: data.payload.fromName
              }));
            }
          });
          break;

        case 'accept_call':
          // Notify the initiator that call is accepted
          socketClients.forEach((meta, clientWs) => {
            if (meta.role === data.payload.targetRole && meta.id === data.payload.targetId && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'call_accepted',
                fromRole: clientMeta.role,
                fromId: clientMeta.id
              }));
            }
          });
          break;

        case 'end_call':
          // Notify both parties that the call has ended
          socketClients.forEach((meta, clientWs) => {
            if (meta.role === data.payload.targetRole && meta.id === data.payload.targetId && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: 'call_ended',
                fromRole: clientMeta.role,
                fromId: clientMeta.id
              }));
            }
          });
          break;

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
          // Automated Fraud Monitor Collision & Frequency checks
          try {
            const drvInfoRes = await query("SELECT location_lat, location_lng FROM drivers WHERE id = $1", [data.ride.driverId]);
            if (drvInfoRes.rows.length > 0) {
              const drvLat = parseFloat(drvInfoRes.rows[0].location_lat);
              const drvLng = parseFloat(drvInfoRes.rows[0].location_lng);
              const passLat = parseFloat(data.ride.pickup.lat);
              const passLng = parseFloat(data.ride.pickup.lng);
              
              // Haversine formula for distance in meters
              const R = 6371000;
              const dLat = (passLat - drvLat) * Math.PI / 180;
              const dLng = (passLng - drvLng) * Math.PI / 180;
              const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                        Math.cos(drvLat * Math.PI / 180) * Math.cos(passLat * Math.PI / 180) *
                        Math.sin(dLng/2) * Math.sin(dLng/2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
              const colocationDistance = R * c;

              // Co-location check: less than 50 meters
              if (colocationDistance < 50) {
                const alertId = 'alert_' + Date.now();
                await query(
                  "INSERT INTO fraud_alerts (id, passenger_phone, driver_id, alert_type, severity, status) VALUES ($1, $2, $3, $4, $5, $6)",
                  [alertId, data.ride.passengerPhone, data.ride.driverId, 'co_location', 'high', 'pending']
                );
                const allAlerts = await query("SELECT * FROM fraud_alerts ORDER BY created_at DESC");
                broadcastToRole('admin', { type: 'fraud_alerts_updated', alerts: allAlerts.rows });
                console.log(`[Fraud Monitor] Flagged co-location collusion alert ${alertId} (Distance: ${colocationDistance.toFixed(2)}m)`);
              }
            }

            // Frequency check: 2+ bookings in last 1 hour
            const frequencyCheck = await query(
              "SELECT COUNT(*) FROM rides WHERE passenger_phone = $1 AND driver_id = $2 AND created_at > NOW() - INTERVAL '1 hour'",
              [data.ride.passengerPhone, data.ride.driverId]
            );
            const recentTripsCount = parseInt(frequencyCheck.rows[0].count || 0);
            if (recentTripsCount >= 2) {
              const alertId = 'alert_freq_' + Date.now();
              await query(
                "INSERT INTO fraud_alerts (id, passenger_phone, driver_id, alert_type, severity, status) VALUES ($1, $2, $3, $4, $5, $6)",
                [alertId, data.ride.passengerPhone, data.ride.driverId, 'frequency_abuse', 'medium', 'pending']
              );
              const allAlerts = await query("SELECT * FROM fraud_alerts ORDER BY created_at DESC");
              broadcastToRole('admin', { type: 'fraud_alerts_updated', alerts: allAlerts.rows });
              console.log(`[Fraud Monitor] Flagged frequency abuse alert ${alertId} (Count: ${recentTripsCount})`);
            }
          } catch (fraudErr) {
            console.error("[Fraud Monitor Error]", fraudErr);
          }

          // Retrieve driver subscription tier to apply matching platform commission
          let finalCommission = parseFloat(data.ride.commission || 0);
          let finalTakeHome = parseFloat(data.ride.takeHome || 0);
          try {
            const drvSubRes = await query("SELECT subscription_tier FROM drivers WHERE id = $1", [data.ride.driverId]);
            if (drvSubRes.rows.length > 0) {
              const tier = drvSubRes.rows[0].subscription_tier || 'free';
              const baseFareAmt = parseFloat(data.ride.grossBaseRideFare || (data.ride.totalFare * 0.90));
              let rate = 0.05; // 5%
              if (tier === 'silver') rate = 0.025; // 2.5%
              else if (tier === 'gold') rate = 0.01; // 1%
              
              finalCommission = parseFloat((baseFareAmt * rate).toFixed(2));
              finalTakeHome = parseFloat((baseFareAmt - finalCommission).toFixed(2));
              data.ride.commission = finalCommission;
              data.ride.takeHome = finalTakeHome;
            }
          } catch (subErr) {
            console.error("[Subscription Override Error]", subErr);
          }

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

          // Broadcast demand update to admins
          broadcastToRole('admin', { type: 'demand_updated' });

          // Find targeted driver client
          const targetDriverWs = findWsClient('driver', data.ride.driverId);
          if (targetDriverWs && targetDriverWs.readyState === WebSocket.OPEN) {
            targetDriverWs.send(JSON.stringify({ type: 'ride_offer', ride: data.ride }));
            console.log(`Dispatched ride contract ${data.ride.id} to Driver ID ${data.ride.driverId}`);
          } else {
            console.log(`Target driver ID ${data.ride.driverId} is offline. Simulating Auto-Accept & trip progression for device testing...`);
            
            // 1. Update ride status in database to 'accepted'
            await query("UPDATE rides SET status = 'accepted' WHERE id = $1", [data.ride.id]);
            
            // 2. Notify passenger immediately of acceptance
            ws.send(JSON.stringify({ type: 'ride_accepted', rideId: data.ride.id, driverId: data.ride.driverId }));
            
            // 3. Setup auto-progress timer simulation to let passenger test native flow
            setTimeout(async () => {
              // Arrived at pickup
              await query("UPDATE rides SET status = 'arrived' WHERE id = $1", [data.ride.id]);
              ws.send(JSON.stringify({ type: 'ride_status_broadcast', rideId: data.ride.id, status: 'arrived' }));
              
              setTimeout(async () => {
                // Started trip (in_progress)
                await query("UPDATE rides SET status = 'in_progress' WHERE id = $1", [data.ride.id]);
                ws.send(JSON.stringify({ type: 'ride_status_broadcast', rideId: data.ride.id, status: 'in_progress' }));
                
                setTimeout(async () => {
                  // Completed trip
                  await query("UPDATE rides SET status = 'completed' WHERE id = $1", [data.ride.id]);
                  
                  // Run wallet deduction & driver payouts calculations
                  const fare = parseFloat(data.ride.totalFare);
                  const commission = parseFloat(data.ride.commission);
                  const takeHome = parseFloat(data.ride.driverTakeHome);
                  
                  await query('UPDATE passengers SET wallet_balance = wallet_balance - $1 WHERE phone = $2', [fare, data.ride.passengerPhone]);
                  await query(
                    `UPDATE drivers 
                     SET earnings_daily = earnings_daily + $1, earnings_weekly = earnings_weekly + $1, commission_owed = commission_owed + $2 
                     WHERE id = $3`,
                    [takeHome, commission, data.ride.driverId]
                  );
                  
                  ws.send(JSON.stringify({ type: 'ride_status_broadcast', rideId: data.ride.id, status: 'completed' }));
                  broadcastToRole('admin', { type: 'ledger_update' });
                }, 5000); // 5s trip duration
              }, 4000); // 4s wait at pickup
            }, 3000); // 3s driver arrival
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
                originalLang: data.originalLang || 'en-US',
                translationLang: data.translationLang || 'bn-IN',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            }));
          }
          break;

        case 'sos_alert':
          // Log SOS alert locally and notify admins
          const isPassenger = clientMeta.role === 'passenger';
          const triggerLabel = isPassenger ? 'Passenger' : 'Driver';
          broadcastToRole('admin', { 
            type: 'sos_broadcast', 
            driverId: isPassenger ? (data.driverId || '') : clientMeta.id, 
            rideId: data.rideId, 
            location: data.location || { lat: 22.5726, lng: 88.3639 } 
          });
          console.log(`🚨 SOS Panic Alarm triggered by ${triggerLabel} ${clientMeta.id} during Ride ${data.rideId}`);
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

// Helper: Broadcast all formatted drivers to all connected clients
const broadcastDriversUpdate = async () => {
  try {
    const driversRes = await query('SELECT * FROM drivers');
    const formattedDrivers = driversRes.rows.map(drv => formatDriverRecord(drv));

    broadcastToAll({ type: 'drivers_updated', drivers: formattedDrivers });
  } catch (err) {
    console.error("[Broadcast Drivers Update Error]", err);
  }
};

// Start the integrated HTTP and WebSockets backend server
server.listen(port, '0.0.0.0', () => {
  console.log(`JoldiGo Full-Stack Backend Server running on http://localhost:${port}`);
  console.log(`WebSocket Service Listening on ws://localhost:${port}`);
});
