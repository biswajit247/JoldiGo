import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const SimulatorContext = createContext();

// Mock Locations in Kolkata
export const KOLKATA_LOCATIONS = {
  HOWRAH_BRIDGE: { name: 'Howrah Bridge', lat: 22.5851, lng: 88.3468, zone: 'Howrah Hub', friction: 'Toll Bridge & High Congestion' },
  VICTORIA_MEMORIAL: { name: 'Victoria Memorial', lat: 22.5448, lng: 88.3426, zone: 'Heritage Central', friction: 'Normal Traffic' },
  PARK_STREET: { name: 'Park Street Metro', lat: 22.5530, lng: 88.3524, zone: 'Park Street Core', friction: 'Medium Congestion' },
  SALT_LAKE_SEC5: { name: 'Salt Lake Sector V', lat: 22.5735, lng: 88.4331, zone: 'Tech Sector V', friction: 'High Traffic at Peak Hours' },
  AIRPORT: { name: 'Kolkata Airport (CCU)', lat: 22.6547, lng: 88.4467, zone: 'Airport Zone', friction: 'Toll Road & Heavy Volume' },
  SCIENCE_CITY: { name: 'Science City', lat: 22.5401, lng: 88.3971, zone: 'Science City East', friction: 'Normal Traffic' },
  KALIGHAT: { name: 'Kalighat Temple', lat: 22.5201, lng: 88.3473, zone: 'South Kalighat', friction: 'Medium Congestion' },
  NEW_MARKET: { name: 'New Market', lat: 22.5601, lng: 88.3512, zone: 'Central Market', friction: 'High Density Pedestrian Friction' },
  ECO_PARK: { name: 'Eco Park', lat: 22.6030, lng: 88.4673, zone: 'Rajarhat Ext', friction: 'Low Friction Transit' },
};

// Initial Geofence Boundary (Polygon surrounding central Kolkata)
const INITIAL_GEOFENCE = [
  { lat: 22.6600, lng: 88.3200 }, 
  { lat: 22.6600, lng: 88.4800 }, 
  { lat: 22.4900, lng: 88.4800 }, 
  { lat: 22.4900, lng: 88.3200 }, 
];

const INITIAL_DRIVERS = [
  {
    id: 'drv_1',
    name: 'Rajesh Kumar',
    phone: '+91 98300 12345',
    vehicleType: 'car_ac',
    vehicleName: 'Hyundai i10 AC Blue',
    vehicleNumber: 'WB-02-A-8842',
    avatar: 'RK',
    status: 'online',
    verificationStatus: 'verified',
    rating: 4.8,
    location: { lat: 22.5600, lng: 88.3600 }, 
    documents: {
      license: 'DL-WESTBENGAL-2018892',
      aadhar: '5421 8892 0123',
      rc: 'RC-WB02A8842',
    },
    earnings: { daily: 1250, weekly: 8400, commission: 440 },
  },
  {
    id: 'drv_2',
    name: 'Amit Singh',
    phone: '+91 90070 98765',
    vehicleType: 'bike',
    vehicleName: 'TVS Apache Black',
    vehicleNumber: 'WB-24-H-1994',
    avatar: 'AS',
    status: 'online',
    verificationStatus: 'verified',
    rating: 4.9,
    location: { lat: 22.5450, lng: 88.3800 }, 
    documents: {
      license: 'DL-WESTBENGAL-2020432',
      aadhar: '8876 1234 9901',
      rc: 'RC-WB24H1994',
    },
    earnings: { daily: 720, weekly: 5100, commission: 268 },
  },
  {
    id: 'drv_3',
    name: 'Subhash Dutta',
    phone: '+91 98830 55443',
    vehicleType: 'car_non_ac',
    vehicleName: 'Maruti Suzuki Dzire Non-AC',
    vehicleNumber: 'WB-06-B-2311',
    avatar: 'SD',
    status: 'offline',
    verificationStatus: 'verified',
    rating: 4.6,
    location: { lat: 22.5800, lng: 88.4200 }, 
    documents: {
      license: 'DL-WESTBENGAL-2015091',
      aadhar: '1122 3344 5566',
      rc: 'RC-WB06B2311',
    },
    earnings: { daily: 0, weekly: 6800, commission: 350 },
  },
  {
    id: 'drv_4',
    name: 'Priyanka Sen',
    phone: '+91 91630 11223',
    vehicleType: 'bike',
    vehicleName: 'Honda Activa Red',
    vehicleNumber: 'WB-12-C-4556',
    avatar: 'PS',
    status: 'online',
    verificationStatus: 'pending', 
    rating: 5.0,
    location: { lat: 22.5200, lng: 88.3500 }, 
    documents: {
      license: 'DL-WESTBENGAL-2022001',
      aadhar: '9900 8877 6655',
      rc: 'RC-WB12C4556',
    },
    earnings: { daily: 0, weekly: 0, commission: 0 },
  },
];

// Translation Mapping Directory (Bilingual Kolkata Commutes)
const CHAT_TRANSLATIONS = {
  // Passenger (English) -> Driver (Bengali)
  "Where are you?": "আপনি কোথায়?",
  "Please wait, I'm coming.": "দয়া করে অপেক্ষা করুন, আমি আসছি।",
  "I'm at the main gate.": "আমি মেইন গেটে আছি।",
  "Is there any toll?": "কোনো টোল ট্যাক্স আছে কি?",
  "Are you carrying change?": "আপনার কাছে খুচরো টাকা আছে?",
  "Coming in 2 minutes.": "২ মিনিটের মধ্যে আসছি।",

  // Driver (Bengali) -> Passenger (English)
  "আমি লোকেশনে পৌঁছে গেছি": "I have arrived at the location.",
  "ভীষণ জ্যাম আছে, একটু দেরি হবে": "Traffic is heavy, will be late.",
  "আমি আসছি": "I am coming.",
  "কোন রুট দিয়ে যাব?": "Which route should I take?",
  "আমার কাছে খুচরো আছে": "I have cash change.",
  "আপনার ওটিপি টা বলুন": "Please tell me your OTP."
};

// Helper to calculate distance
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
};

// Check geofence ray-casting
export const isPointInPolygon = (point, polygon) => {
  const x = point.lat, y = point.lng;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

// Generate route coords
const generateRoutePoints = (start, end, steps = 30) => {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = start.lat + (end.lat - start.lat) * t;
    const lng = start.lng + (end.lng - start.lng) * t;
    points.push({ lat, lng });
  }
  return points;
};

export const SimulatorProvider = ({ children }) => {
  const [drivers, setDrivers] = useState(INITIAL_DRIVERS);
  const [geofence, setGeofence] = useState(INITIAL_GEOFENCE);
  const [activeRide, setActiveRide] = useState(null);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [disputes, setDisputes] = useState([]);
  
  // Shared Bilingual Chat state
  const [chatMessages, setChatMessages] = useState([]);

  // Compliance, Pricing, and Wallet States
  const [fuelPrices, setFuelPrices] = useState({
    cng: 95.50,
    petrol: 104.50,
    diesel: 92.75
  });
  const [insuranceReservePool, setInsuranceReservePool] = useState(348.00); 
  const [isNightMode, setIsNightMode] = useState(false); 
  
  // Passenger Wallet System
  const [passengerWalletBalance, setPassengerWalletBalance] = useState(500.00); 

  // Interactive Traffic Congestion State
  const [congestionZones, setCongestionZones] = useState({
    HOWRAH_BRIDGE: 'heavy',
    PARK_STREET: 'medium',
    SALT_LAKE_SEC5: 'medium',
  });

  // SMS Gateway state
  const [activeSmsToast, setActiveSmsToast] = useState(null);

  // Safety Pool Claims state
  const [safetyClaims, setSafetyClaims] = useState([
    {
      id: 'claim_init_1',
      driverId: 'drv_1',
      driverName: 'Rajesh Kumar',
      vehicleType: 'car_ac',
      claimType: 'health',
      amount: 150,
      description: 'Outpatient medical checkup cover for seasonal fever at local clinic.',
      status: 'approved',
      createdAt: 'Jun 28, 2026'
    }
  ]);

  // Settings State: Legal compliant 3-category pricing
  const [settings, setSettings] = useState({
    baseFareCarAC: 50,
    perKmCarAC: 20,
    baseFareCarNonAC: 30,
    perKmCarNonAC: 15,
    baseFareBike: 20,
    perKmBike: 7,
    surgeMultiplier: 1.0, 
  });

  // Passenger Authenticated State
  const [passenger, setPassenger] = useState({
    phone: '',
    isLoggedIn: false,
    rideHistory: [
      {
        id: 'hist_1',
        pickupName: 'Park Street Metro',
        dropoffName: 'Kolkata Airport (CCU)',
        date: 'June 27, 2026',
        vehicleType: 'car_ac',
        fare: 220.50,
        rating: 5,
        driverName: 'Rajesh Kumar',
        paymentMethod: 'wallet',
        contractHash: 'jld_hash_77ea410f',
        disputed: false,
      },
      {
        id: 'hist_2',
        pickupName: 'Victoria Memorial',
        dropoffName: 'Howrah Bridge',
        date: 'June 25, 2026',
        vehicleType: 'bike',
        fare: 79.80,
        rating: 4,
        driverName: 'Amit Singh',
        paymentMethod: 'cash',
        contractHash: 'jld_hash_1ac49e22',
        disputed: false,
      }
    ],
  });

  const timerRef = useRef(null);
  const simulationIntervalRef = useRef(null);

  // Procedural Web Audio Synthesizer
  const playSound = (type) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (type === 'sos') {
        // High-pitched siren sweeps
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sawtooth';
        osc2.type = 'square';
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc1.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.3);
        osc1.frequency.linearRampToValueAtTime(440, ctx.currentTime + 0.6);
        osc1.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.9);
        osc1.frequency.linearRampToValueAtTime(440, ctx.currentTime + 1.2);

        osc2.frequency.setValueAtTime(450, ctx.currentTime);
        osc2.frequency.linearRampToValueAtTime(890, ctx.currentTime + 0.3);
        osc2.frequency.linearRampToValueAtTime(450, ctx.currentTime + 0.6);
        osc2.frequency.linearRampToValueAtTime(890, ctx.currentTime + 0.9);
        osc2.frequency.linearRampToValueAtTime(450, ctx.currentTime + 1.2);

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);

        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 1.5);
        osc2.stop(ctx.currentTime + 1.5);
      } else if (type === 'match') {
        // Double ping (electronic chime)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.setValueAtTime(900, ctx.currentTime + 0.12);

        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else if (type === 'chat') {
        // Chat notification chime (low triangle wave)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.setValueAtTime(700, ctx.currentTime);

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'sms') {
        // High electronic ding for SMS Toasts
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.07, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn("AudioContext failed to play sound cue:", e);
    }
  };

  // SLA dispute count down handler
  useEffect(() => {
    const interval = setInterval(() => {
      setDisputes(prevDisputes => {
        let isChanged = false;
        const next = prevDisputes.map(disp => {
          if (disp.status === 'awaiting_evidence' || disp.status === 'under_review') {
            if (disp.expiresIn > 0) {
              isChanged = true;
              const nextExpires = disp.expiresIn - 1;
              if (nextExpires === 0) {
                setTimeout(() => {
                  resolveDispute(disp.id, 'driver', true);
                }, 0);
              }
              return { ...disp, expiresIn: nextExpires };
            }
          }
          return disp;
        });
        return isChanged ? next : prevDisputes;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [drivers]);

  // Add system logging utility
  const addLog = (message, type = 'info') => {
    setLogs((prev) => [
      { id: Date.now() + Math.random().toString(), time: new Date().toLocaleTimeString(), message, type },
      ...prev.slice(0, 49),
    ]);
  };

  // Passenger Login
  const loginPassenger = (phone) => {
    setPassenger((prev) => ({ ...prev, phone, isLoggedIn: true }));
    addLog(`Passenger logged in with phone: ${phone}`, 'success');
  };

  const logoutPassenger = () => {
    setPassenger((prev) => ({ ...prev, isLoggedIn: false, phone: '' }));
    addLog(`Passenger logged out`, 'info');
  };

  // Trigger SMS Gateway Toast & Sound
  const triggerSmsToast = (message) => {
    playSound('sms');
    setActiveSmsToast({
      id: Date.now(),
      sender: 'JoldiGo OTP Gateway',
      message
    });
    
    // Auto-clear SMS card after 6 seconds
    setTimeout(() => {
      setActiveSmsToast(null);
    }, 6000);
  };

  // Wallet Top-up
  const topUpPassengerWallet = (amount) => {
    setPassengerWalletBalance(prev => parseFloat((prev + amount).toFixed(2)));
    addLog(`Passenger topped up Wallet by ₹${amount} via Razorpay authorization sheet.`, 'success');
  };

  // Bilingual Chat message delivery with auto-translations (English ⇄ Bengali)
  const sendChatMessage = (sender, text) => {
    let translation = "Translation unavailable";

    if (CHAT_TRANSLATIONS[text]) {
      translation = CHAT_TRANSLATIONS[text];
    } else {
      if (sender === 'passenger') {
        translation = `[অনুবাদ]: ${text} (Simulated translation)`;
      } else {
        translation = `[Translated]: ${text} (সিমুলেটেড অনুবাদ)`;
      }
    }

    const newMsg = {
      id: 'msg_' + Date.now() + Math.random().toString(36).substr(2, 4),
      sender, 
      text,
      translation,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, newMsg]);
    playSound('chat');
    addLog(`[Chat] ${sender === 'passenger' ? 'Passenger' : 'Driver'} sent: "${text}" (Translated: "${translation}")`, 'info');
  };

  // Driver Status Toggle
  const toggleDriverStatus = (driverId) => {
    setDrivers((prev) =>
      prev.map((d) => (d.id === driverId ? { ...d, status: d.status === 'online' ? 'offline' : 'online' } : d))
    );
    const drv = drivers.find((d) => d.id === driverId);
    if (drv) {
      addLog(`Driver ${drv.name} is now ${drv.status === 'online' ? 'OFFLINE' : 'ONLINE'}`, 'info');
    }
  };

  // Driver Docs Onboarding
  const uploadDriverDocs = (driverId, documents) => {
    setDrivers((prev) =>
      prev.map((d) => (d.id === driverId ? { ...d, documents, verificationStatus: 'pending' } : d))
    );
    addLog(`Driver ${driverId} uploaded documents for verification`, 'warning');
  };

  // Admin Approve Driver
  const verifyDriverStatus = (driverId, verified) => {
    setDrivers((prev) =>
      prev.map((d) =>
        d.id === driverId
          ? { ...d, verificationStatus: verified ? 'verified' : 'rejected' }
          : d
      )
    );
    const drv = drivers.find((d) => d.id === driverId);
    addLog(`Admin ${verified ? 'APPROVED' : 'REJECTED'} verification for ${drv?.name || driverId}`, verified ? 'success' : 'error');
  };

  // Toggle Live Congestion Zone state
  const toggleCongestionZone = (zoneKey, nextLevel) => {
    setCongestionZones(prev => ({
      ...prev,
      [zoneKey]: nextLevel
    }));
    addLog(`[Traffic] ${zoneKey.replace('_', ' ')} flow rate adjusted to ${nextLevel.toUpperCase()} by Admin.`, 'warning');
  };

  // Admin Settings Update
  const updateSettings = (newSettings) => {
    const cappedSurge = newSettings.surgeMultiplier !== undefined
      ? Math.min(1.50, parseFloat(newSettings.surgeMultiplier))
      : settings.surgeMultiplier;
    
    setSettings((prev) => ({ 
      ...prev, 
      ...newSettings,
      surgeMultiplier: cappedSurge
    }));
    
    addLog(`Admin updated settings (Surge Cap enforced at 1.5x limit)`, 'warning');
  };

  // Geofence Update
  const updateGeofence = (newGeofence) => {
    setGeofence(newGeofence);
    addLog(`Admin redefined operational geofence`, 'warning');
  };

  // Proximity check helper to calculate congestion multiplier near hubs
  const getCongestionMultiplier = (pickup, dropoff) => {
    if (!pickup || !dropoff) return { multiplier: 1.0, zoneName: null };
    
    let maxMultiplier = 1.0;
    let activeZoneName = null;

    const zones = [
      { key: 'HOWRAH_BRIDGE', name: 'Howrah Bridge', lat: 22.5851, lng: 88.3468 },
      { key: 'PARK_STREET', name: 'Park Street Core', lat: 22.5530, lng: 88.3524 },
      { key: 'SALT_LAKE_SEC5', name: 'Sector V Tech Hub', lat: 22.5735, lng: 88.4331 },
    ];

    zones.forEach(z => {
      const distToPickup = calculateDistance(pickup.lat, pickup.lng, z.lat, z.lng);
      const distToDropoff = calculateDistance(dropoff.lat, dropoff.lng, z.lat, z.lng);

      // Within 1.2km proximity of the landmark
      if (distToPickup <= 1.2 || distToDropoff <= 1.2) {
        const state = congestionZones[z.key] || 'clear';
        let mult = 1.0;
        if (state === 'heavy') mult = 1.15;
        else if (state === 'medium') mult = 1.08;

        if (mult > maxMultiplier) {
          maxMultiplier = mult;
          activeZoneName = z.name;
        }
      }
    });

    return { multiplier: maxMultiplier, zoneName: activeZoneName };
  };

  // Pricing calculations
  const calculateDetailedFare = (distance, vehicleType, pickup = null, dropoff = null) => {
    const isCarAC = vehicleType === 'car_ac';
    const isCarNonAC = vehicleType === 'car_non_ac';
    
    const standardBase = isCarAC 
      ? settings.baseFareCarAC 
      : (isCarNonAC ? settings.baseFareCarNonAC : settings.baseFareBike);
      
    const perKm = isCarAC 
      ? settings.perKmCarAC 
      : (isCarNonAC ? settings.perKmCarNonAC : settings.perKmBike);
    
    // Dynamic Fuel Indexing
    let fuelDeltaPrice = 0;
    let activeFuelType = 'CNG';
    if (isCarAC) {
      fuelDeltaPrice = Math.max(0, (fuelPrices.petrol - 100.00) * 0.8);
      activeFuelType = 'Petrol';
    } else if (isCarNonAC) {
      fuelDeltaPrice = Math.max(0, (fuelPrices.diesel - 90.00) * 0.6);
      activeFuelType = 'Diesel';
    } else {
      fuelDeltaPrice = Math.max(0, (fuelPrices.cng - 95.00) * 0.3);
      activeFuelType = 'CNG';
    }
    const indexedBase = standardBase + fuelDeltaPrice;

    // Distance charges (base covers first 2km)
    const distanceChargeable = Math.max(0, distance - 2);
    const baseRideFareBeforeSurge = indexedBase + distanceChargeable * perKm;
    
    // Proximity Congestion Surcharges
    const congestion = getCongestionMultiplier(pickup, dropoff);
    const trafficMultiplier = congestion.multiplier;

    // Night hours surge logic
    const baseSurge = isNightMode ? 1.20 : 1.00;
    const rawSurgeMultiplier = Math.max(baseSurge, settings.surgeMultiplier);
    
    // Merge surge and traffic multipliers, cap final at 1.5x (West Bengal limits)
    const finalSurgeMultiplier = parseFloat(Math.min(1.50, rawSurgeMultiplier * trafficMultiplier).toFixed(2));
    
    const grossBaseRideFare = parseFloat((baseRideFareBeforeSurge * finalSurgeMultiplier).toFixed(2));
    
    // Splits
    const gstAmount = parseFloat((grossBaseRideFare * 0.05).toFixed(2));
    const commission = parseFloat((grossBaseRideFare * 0.05).toFixed(2));
    const driverPayout = parseFloat((grossBaseRideFare * 0.95).toFixed(2));

    const tollEstimate = distance > 8 ? 35 : 0;
    const insurancePremium = 2.00; 

    // Total Passenger payment
    const totalFare = parseFloat((grossBaseRideFare + gstAmount + tollEstimate + insurancePremium).toFixed(2));

    // Cryptographic Hash Contract
    const hashSeed = `${vehicleType}-${distance}-${totalFare}-${fuelPrices.petrol}-${fuelPrices.diesel}-${fuelPrices.cng}-${finalSurgeMultiplier}`;
    let charCodeSum = 0;
    for (let i = 0; i < hashSeed.length; i++) {
      charCodeSum = (charCodeSum << 5) - charCodeSum + hashSeed.charCodeAt(i);
      charCodeSum |= 0;
    }
    const contractHash = 'jld_hash_' + Math.abs(charCodeSum).toString(16).padStart(8, '0');

    return {
      baseFare: parseFloat(indexedBase.toFixed(2)),
      fuelSurcharge: parseFloat(fuelDeltaPrice.toFixed(2)),
      fuelType: activeFuelType,
      surgeMultiplier: finalSurgeMultiplier,
      trafficMultiplier,
      trafficZoneName: congestion.zoneName,
      grossBaseRideFare,
      gstAmount,
      tollEstimate,
      insurancePremium,
      totalFare,
      commission,
      takeHome: driverPayout, 
      contractHash,
      isNightChargeApplied: isNightMode && rawSurgeMultiplier === baseSurge,
    };
  };

  // Book a Ride from Passenger App
  const bookRide = (pickup, dropoff, vehicleType, paymentMethod = 'wallet') => {
    if (activeRide) {
      addLog(`Cannot book: an active ride session already exists.`, 'error');
      return;
    }

    const isPickupOk = isPointInPolygon(pickup, geofence);
    const isDropoffOk = isPointInPolygon(dropoff, geofence);

    if (!isPickupOk || !isDropoffOk) {
      addLog(`Booking rejected: pickup or drop-off is outside JoldiGo service geofence.`, 'error');
      alert(`Service Unavailable: JoldiGo is currently limited to specific zones in Kolkata.`);
      return;
    }

    const dist = calculateDistance(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
    const fareDetails = calculateDetailedFare(dist, vehicleType, pickup, dropoff);

    // If using Wallet pay, validate balance upfront
    if (paymentMethod === 'wallet' && passengerWalletBalance < fareDetails.totalFare) {
      addLog(`Booking rejected: Insufficient wallet balance (Fare: ₹${fareDetails.totalFare}, Wallet: ₹${passengerWalletBalance}).`, 'error');
      alert(`Insufficient Balance: You need ₹${fareDetails.totalFare} to book this ride. Please top up your JoldiGo Wallet first.`);
      return;
    }

    // Find the closest online and verified driver
    const availableDrivers = drivers.filter(
      (d) => d.status === 'online' && d.verificationStatus === 'verified' && d.vehicleType === vehicleType
    );

    if (availableDrivers.length === 0) {
      addLog(`No available online drivers matching vehicle type "${vehicleType}"`, 'error');
      alert(`No drivers available nearby for JoldiGo ${vehicleType.replace('_', ' ').toUpperCase()}. Try again in a moment!`);
      return;
    }

    // Find closest
    let closestDriver = availableDrivers[0];
    let minDistance = calculateDistance(pickup.lat, pickup.lng, closestDriver.location.lat, closestDriver.location.lng);

    for (let i = 1; i < availableDrivers.length; i++) {
      const d = calculateDistance(pickup.lat, pickup.lng, availableDrivers[i].location.lat, availableDrivers[i].location.lng);
      if (d < minDistance) {
        minDistance = d;
        closestDriver = availableDrivers[i];
      }
    }

    // Reset Chat logs for new ride matches
    setChatMessages([]);

    addLog(`Passenger requested a ${vehicleType}. Passenger pays: ₹${fareDetails.totalFare} (incl. 5% GST). Searching drivers...`, 'info');
    playSound('match');

    // Create Active Ride
    const newRide = {
      id: 'ride_' + Math.random().toString(36).substr(2, 9),
      pickup,
      dropoff,
      destinationZone: dropoff.zone || 'Kolkata Zone',
      paymentMethod,
      estimatedRouteFriction: dropoff.friction || 'Normal Traffic',
      vehicleType,
      distance: dist,
      
      // Pricing splits
      baseFare: fareDetails.baseFare,
      fuelSurcharge: fareDetails.fuelSurcharge,
      grossBaseRideFare: fareDetails.grossBaseRideFare,
      gstAmount: fareDetails.gstAmount,
      tollEstimate: fareDetails.tollEstimate,
      insurancePremium: fareDetails.insurancePremium,
      totalFare: fareDetails.totalFare,
      commission: fareDetails.commission,
      takeHome: fareDetails.takeHome,
      contractHash: fareDetails.contractHash,
      surgeMultiplier: fareDetails.surgeMultiplier,
      trafficMultiplier: fareDetails.trafficMultiplier,
      trafficZoneName: fareDetails.trafficZoneName,
      
      status: 'searching',
      driverId: closestDriver.id,
      timer: 15,
    };

    setActiveRide(newRide);

    // Start 15s driver accept countdown timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveRide((prev) => {
        if (!prev || prev.status !== 'searching') {
          clearInterval(timerRef.current);
          return prev;
        }
        if (prev.timer <= 1) {
          clearInterval(timerRef.current);
          addLog(`Ride request expired: Driver did not accept within 15 seconds.`, 'error');
          return null;
        }
        return { ...prev, timer: prev.timer - 1 };
      });
    }, 1000);
  };

  // Reject / Timeout request (from Driver side)
  const rejectRide = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveRide(null);
    setChatMessages([]);
    addLog(`Driver rejected the incoming ride request.`, 'warning');
  };

  // Driver accepts the ride
  const acceptRide = (driverId) => {
    if (timerRef.current) clearInterval(timerRef.current);

    setActiveRide((prev) => {
      if (!prev) return null;
      
      const driver = drivers.find((d) => d.id === driverId);
      addLog(`Driver ${driver?.name} accepted ride contract. Driving to pickup...`, 'success');
      playSound('match');

      // Generate simulation route: Driver current location -> Pickup
      const pickupRoute = generateRoutePoints(driver.location, prev.pickup, 20);

      // Start driving animation to pickup
      animateDriverMovement(driverId, pickupRoute, 'pickup');

      return {
        ...prev,
        status: 'accepted',
        driverId,
        route: pickupRoute,
        routeIndex: 0,
      };
    });
  };

  // Helper to simulate driving
  const animateDriverMovement = (driverId, pathCoords, stage) => {
    if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);

    let idx = 0;
    simulationIntervalRef.current = setInterval(() => {
      idx++;
      if (idx >= pathCoords.length) {
        clearInterval(simulationIntervalRef.current);
        
        // Update driver location to final point in path
        setDrivers((prevDrvs) =>
          prevDrvs.map((d) => (d.id === driverId ? { ...d, location: pathCoords[pathCoords.length - 1] } : d))
        );

        if (stage === 'pickup') {
          // Driver arrived at pickup location
          setActiveRide((prevRide) => {
            if (!prevRide) return null;
            addLog(`Driver arrived at pickup location. Waiting for passenger.`, 'success');
            return { ...prevRide, status: 'arrived', location: pathCoords[pathCoords.length - 1] };
          });
        } else if (stage === 'trip') {
          // Driver arrived at dropoff destination
          setActiveRide((prevRide) => {
            if (!prevRide) return null;
            addLog(`Driver and passenger arrived at destination. Awaiting payment.`, 'success');
            return { ...prevRide, status: 'completed', location: pathCoords[pathCoords.length - 1] };
          });
        }
      } else {
        const nextLoc = pathCoords[idx];
        
        // Update driver marker location
        setDrivers((prevDrvs) =>
          prevDrvs.map((d) => (d.id === driverId ? { ...d, location: nextLoc } : d))
        );

        // Update active ride's dynamic location tracker
        setActiveRide((prevRide) => {
          if (!prevRide) return null;
          return { ...prevRide, routeIndex: idx, location: nextLoc };
        });
      }
    }, 400); 
  };

  // Driver starts the ride (pickup -> dropoff)
  const startRide = () => {
    setActiveRide((prev) => {
      if (!prev || prev.status !== 'arrived') return prev;

      addLog(`Passenger boarded. Ride started, heading to destination...`, 'info');
      
      const tripRoute = generateRoutePoints(prev.pickup, prev.dropoff, 30);
      animateDriverMovement(prev.driverId, tripRoute, 'trip');

      return {
        ...prev,
        status: 'in_progress',
        route: tripRoute,
        routeIndex: 0,
      };
    });
  };

  // Complete ride payment & rating (from Passenger side)
  const completePaymentAndRate = (rating) => {
    if (!activeRide || activeRide.status !== 'completed') return;

    const driver = drivers.find((d) => d.id === activeRide.driverId);
    const takeHome = activeRide.takeHome;
    const commission = activeRide.commission;

    // Validate and Deduct from wallet if wallet payment method chosen
    if (activeRide.paymentMethod === 'wallet') {
      if (passengerWalletBalance < activeRide.totalFare) {
        alert("Insufficient balance in Wallet! Please top up before completing payment.");
        return;
      }
      setPassengerWalletBalance(prev => parseFloat((prev - activeRide.totalFare).toFixed(2)));
    }

    // Update driver rating & earnings ledger
    setDrivers((prevDrvs) =>
      prevDrvs.map((d) => {
        if (d.id === activeRide.driverId) {
          const newRating = parseFloat(((d.rating * 5 + rating) / 6).toFixed(1));
          return {
            ...d,
            rating: newRating,
            earnings: {
              daily: d.earnings.daily + takeHome,
              weekly: d.earnings.weekly + takeHome,
              commission: d.earnings.commission + commission,
            },
          };
        }
        return d;
      })
    );

    // Save to ride history
    const historyItem = {
      id: activeRide.id,
      pickupName: activeRide.pickup.name,
      dropoffName: activeRide.dropoff.name,
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      vehicleType: activeRide.vehicleType,
      fare: activeRide.totalFare,
      rating: rating,
      driverName: driver?.name || 'Partner',
      paymentMethod: activeRide.paymentMethod,
      contractHash: activeRide.contractHash,
      disputed: false,
    };

    setPassenger((prevPass) => ({
      ...prevPass,
      rideHistory: [historyItem, ...prevPass.rideHistory],
    }));

    setInsuranceReservePool(prev => prev + 2.00);
    setChatMessages([]); 

    addLog(`Payment of ₹${activeRide.totalFare} via ${activeRide.paymentMethod.toUpperCase()} processed. Wallet deducted. Driver net: ₹${takeHome}, Platform: ₹${commission}, GST: ₹${activeRide.gstAmount}, Insurance: ₹2.`, 'success');
    
    // Reset active ride
    setActiveRide(null);
  };

  // Cancellation Penalty logic
  const cancelRide = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);

    if (activeRide && (activeRide.status === 'accepted' || activeRide.status === 'arrived' || activeRide.status === 'in_progress')) {
      const cancellationFee = parseFloat(Math.min(100, activeRide.totalFare * 0.10).toFixed(2));
      const platformComm = parseFloat((cancellationFee * 0.05).toFixed(2));
      const driverShare = parseFloat((cancellationFee * 0.95).toFixed(2));

      // Deduct cancellation fee from passenger's wallet
      setPassengerWalletBalance(prev => parseFloat(Math.max(0, prev - cancellationFee).toFixed(2)));

      // Credit driver
      setDrivers(prev => prev.map(d => {
        if (d.id === activeRide.driverId) {
          return {
            ...d,
            earnings: {
              ...d.earnings,
              daily: d.earnings.daily + driverShare,
              weekly: d.earnings.weekly + driverShare,
              commission: d.earnings.commission + platformComm,
            }
          };
        }
        return d;
      }));

      // Log event
      addLog(`Passenger cancelled active ride. Capped cancellation fee of ₹${cancellationFee} deducted from passenger wallet. Driver split: ₹${driverShare}.`, 'warning');
      alert(`Cancellation Penalty Applied: Under legal aggregator guidelines, a compliant fee of ₹${cancellationFee} has been deducted from your JoldiGo Wallet balance.`);
    } else {
      addLog(`Ride request cancelled by passenger before driver match.`, 'info');
    }

    setChatMessages([]);
    setActiveRide(null);
  };

  // SOS emergency dispatch animator
  const triggerSOS = (driverId) => {
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver) return;

    const policeStationLoc = { 
      lat: driver.location.lat + 0.015, 
      lng: driver.location.lng - 0.018 
    };

    const policeRoute = generateRoutePoints(policeStationLoc, driver.location, 15);

    const newAlert = {
      id: 'sos_' + Date.now(),
      driverId,
      driverName: driver.name,
      vehicleNumber: driver.vehicleNumber,
      location: driver.location,
      time: new Date().toLocaleTimeString(),
      status: 'dispatch', 
      policeLocation: policeStationLoc,
      policeRoute,
      policeRouteIndex: 0,
      eta: 15, 
    };

    setSosAlerts((prev) => [newAlert, ...prev]);
    playSound('sos');
    addLog(`⚠️ EMERGENCY SOS: Driver ${driver.name} triggered panic alarm! IT Control Room dispatching Police interceptor...`, 'error');

    let idx = 0;
    const dispatchInterval = setInterval(() => {
      idx++;
      setSosAlerts(prevAlerts => {
        const nextAlerts = prevAlerts.map(alert => {
          if (alert.id === newAlert.id) {
            if (idx >= policeRoute.length) {
              clearInterval(dispatchInterval);
              addLog(`👮 Patrol Arrived: Police Interceptor reached Driver ${driver.name}. Area Secured.`, 'success');
              return {
                ...alert,
                policeLocation: policeRoute[policeRoute.length - 1],
                policeRouteIndex: policeRoute.length - 1,
                status: 'secured',
                eta: 0
              };
            } else {
              return {
                ...alert,
                policeLocation: policeRoute[idx],
                policeRouteIndex: idx,
                eta: policeRoute.length - idx
              };
            }
          }
          return alert;
        });
        return nextAlerts;
      });
    }, 800);
  };

  // Resolve SOS Emergency
  const resolveSOS = (sosId) => {
    setSosAlerts((prev) => prev.map((alert) => (alert.id === sosId ? { ...alert, status: 'resolved' } : alert)));
    addLog(`SOS Alert archived by Admin control room.`, 'success');
  };

  // File Dispute
  const fileDispute = (rideId, complaint) => {
    const ride = passenger.rideHistory.find(h => h.id === rideId);
    if (!ride || ride.disputed) return;

    setPassenger(prev => ({
      ...prev,
      rideHistory: prev.rideHistory.map(h => h.id === rideId ? { ...h, disputed: true } : h)
    }));

    const driver = drivers.find(d => d.name === ride.driverName);
    if (!driver) return;

    const approximateGrossBase = parseFloat((ride.fare / 1.05).toFixed(2));
    const suspendedPayout = parseFloat((approximateGrossBase * 0.95).toFixed(2));
    const commission = parseFloat((approximateGrossBase * 0.05).toFixed(2));

    setDrivers(prev => prev.map(d => {
      if (d.id === driver.id) {
        return {
          ...d,
          earnings: {
            ...d.earnings,
            daily: Math.max(0, d.earnings.daily - suspendedPayout),
            weekly: Math.max(0, d.earnings.weekly - suspendedPayout),
            commission: Math.max(0, d.earnings.commission - commission),
          }
        };
      }
      return d;
    }));

    const newDispute = {
      id: 'disp_' + Math.random().toString(36).substr(2, 9),
      rideId,
      driverId: driver.id,
      driverName: driver.name,
      pickupName: ride.pickupName,
      dropoffName: ride.dropoffName,
      amount: ride.fare,
      suspendedPayout,
      commission,
      riderComplaint: complaint,
      status: 'awaiting_evidence',
      evidenceMedia: null,
      evidenceType: null,
      createdAt: new Date().toLocaleTimeString(),
      expiresIn: 45, 
    };

    setDisputes(prev => [newDispute, ...prev]);
    addLog(`Dispute filed: Payout of ₹${suspendedPayout} suspended for Driver ${driver.name}.`, 'warning');
  };

  // Upload Evidence
  const uploadDisputeEvidence = (disputeId, evidenceType, fileName) => {
    setDisputes(prev => prev.map(d => {
      if (d.id === disputeId) {
        addLog(`Driver ${d.driverName} uploaded dispute evidence: ${fileName} (${evidenceType.toUpperCase()})`, 'info');
        return {
          ...d,
          status: 'under_review',
          evidenceType,
          evidenceMedia: fileName
        };
      }
      return d;
    }));
  };

  // Resolve Dispute
  const resolveDispute = (disputeId, outcome, isAutoSla = false) => {
    setDisputes(prevDisputes => {
      const targetDispute = prevDisputes.find(d => d.id === disputeId);
      if (!targetDispute || targetDispute.status === 'resolved_driver' || targetDispute.status === 'resolved_rider') {
        return prevDisputes;
      }

      if (outcome === 'driver') {
        // Driver won
        setDrivers(prevDrvs => prevDrvs.map(d => {
          if (d.id === targetDispute.driverId) {
            return {
              ...d,
              earnings: {
                ...d.earnings,
                daily: d.earnings.daily + targetDispute.suspendedPayout,
                weekly: d.earnings.weekly + targetDispute.suspendedPayout,
                commission: d.earnings.commission + targetDispute.commission
              }
            };
          }
          return d;
        }));
        
        addLog(`Dispute resolved in favor of Driver ${targetDispute.driverName} ${isAutoSla ? '(SLA Auto-Approval)' : '(Admin Decision)'}. Payout restored.`, 'success');
      } else {
        // Rider won
        setPassengerWalletBalance(prev => parseFloat((prev + targetDispute.amount).toFixed(2)));
        addLog(`Dispute resolved in favor of Rider ${isAutoSla ? '(SLA Refund)' : '(Admin Decision)'}. Refund of ₹${targetDispute.amount} credited back to Passenger Wallet instantly.`, 'success');
      }

      return prevDisputes.map(d => {
        if (d.id === disputeId) {
          return {
            ...d,
            status: outcome === 'driver' ? 'resolved_driver' : 'resolved_rider',
            expiresIn: 0
          };
        }
        return d;
      });
    });
  };

  // Fast forward dispute
  const fastForwardDisputeSla = (disputeId) => {
    setDisputes(prev => prev.map(d => {
      if (d.id === disputeId && (d.status === 'awaiting_evidence' || d.status === 'under_review')) {
        addLog(`Admin fast-forwarded 48-hour SLA timeline for dispute ${disputeId}.`, 'warning');
        return { ...d, expiresIn: 1 };
      }
      return d;
    }));
  };

  // File Outpatient Safety Claim (Driver)
  const fileSafetyClaim = (driverId, claimType, amount, description) => {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return;

    if (amount > insuranceReservePool) {
      alert(`Claim Rejected: Requested cover of ₹${amount} exceeds current Safety Pool Balance (₹${insuranceReservePool.toFixed(2)}).`);
      return;
    }

    const newClaim = {
      id: 'claim_' + Math.random().toString(36).substr(2, 9),
      driverId,
      driverName: driver.name,
      vehicleType: driver.vehicleType,
      claimType, // 'health' or 'term'
      amount,
      description,
      status: 'pending',
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };

    setSafetyClaims(prev => [newClaim, ...prev]);
    addLog(`[Insurance] Partner ${driver.name} submitted safety pool claim of ₹${amount} for ${claimType.toUpperCase()} cover.`, 'warning');
  };

  // Resolve Safety Claim (Admin)
  const resolveSafetyClaim = (claimId, outcome) => {
    setSafetyClaims(prevClaims => {
      const claim = prevClaims.find(c => c.id === claimId);
      if (!claim || claim.status !== 'pending') return prevClaims;

      if (outcome === 'approved') {
        if (claim.amount > insuranceReservePool) {
          addLog(`[Insurance] Failed to approve claim ${claimId}: amount exceeds pool.`, 'error');
          return prevClaims;
        }

        // Deduct from pool balance
        setInsuranceReservePool(prev => parseFloat((prev - claim.amount).toFixed(2)));

        // Credit to driver's payout ledger
        setDrivers(prevDrvs => prevDrvs.map(d => {
          if (d.id === claim.driverId) {
            return {
              ...d,
              earnings: {
                ...d.earnings,
                weekly: d.earnings.weekly + claim.amount,
                daily: d.earnings.daily + claim.amount,
              }
            };
          }
          return d;
        }));

        addLog(`[Insurance] Admin APPROVED safety claim of ₹${claim.amount} for Driver ${claim.driverName}. Reserve pool updated.`, 'success');
      } else {
        addLog(`[Insurance] Admin REJECTED safety claim of ₹${claim.amount} for Driver ${claim.driverName}.`, 'error');
      }

      return prevClaims.map(c => c.id === claimId ? { ...c, status: outcome } : c);
    });
  };

  return (
    <SimulatorContext.Provider
      value={{
        drivers,
        geofence,
        activeRide,
        sosAlerts,
        settings,
        passenger,
        logs,
        disputes,
        chatMessages,
        fuelPrices,
        setFuelPrices,
        insuranceReservePool,
        setInsuranceReservePool,
        isNightMode,
        setIsNightMode,
        passengerWalletBalance,
        topUpPassengerWallet,
        sendChatMessage,
        loginPassenger,
        logoutPassenger,
        toggleDriverStatus,
        uploadDriverDocs,
        verifyDriverStatus,
        updateSettings,
        updateGeofence,
        bookRide,
        rejectRide,
        acceptRide,
        startRide,
        completePaymentAndRate,
        cancelRide,
        triggerSOS,
        resolveSOS,
        fileDispute,
        uploadDisputeEvidence,
        resolveDispute,
        fastForwardDisputeSla,
        calculateDetailedFare,
        congestionZones,
        toggleCongestionZone,
        activeSmsToast,
        setActiveSmsToast,
        triggerSmsToast,
        safetyClaims,
        fileSafetyClaim,
        resolveSafetyClaim,
        playSound,
      }}
    >
      {children}
    </SimulatorContext.Provider>
  );
};

export const useSimulator = () => {
  const context = useContext(SimulatorContext);
  if (!context) {
    throw new Error('useSimulator must be used within a SimulatorProvider');
  }
  return context;
};
