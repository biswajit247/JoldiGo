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

// operational boundary
const INITIAL_GEOFENCE = [
  { lat: 22.6600, lng: 88.3200 }, 
  { lat: 22.6600, lng: 88.4800 }, 
  { lat: 22.4900, lng: 88.4800 }, 
  { lat: 22.4900, lng: 88.3200 }, 
];

const CHAT_TRANSLATIONS = {
  "Where are you?": "আপনি কোথায়?",
  "Please wait, I'm coming.": "দয়া করে অপেক্ষা করুন, আমি আসছি।",
  "I'm at the main gate.": "আমি মেইন গেটে আছি।",
  "Is there any toll?": "কোনো টোল ট্যাক্স আছে কি?",
  "Are you carrying change?": "আপনার কাছে খুচরো টাকা আছে?",
  "Coming in 2 minutes.": "২ মিনিটের মধ্যে আসছি।",
  "আমি লোকেশনে পৌঁছে গেছি": "I have arrived at the location.",
  "ভীষণ জ্যাম আছে, একটু দেরি হবে": "Traffic is heavy, will be late.",
  "আমি আসছি": "I am coming.",
  "কোন রুট দিয়ে যাব?": "Which route should I take?",
  "আমার কাছে খুচরো আছে": "I have cash change.",
  "আপনার ওটিপি টা বলুন": "Please tell me your OTP."
};

// Dynamic URL parser for tunnels / local IP / production hosts
export const getServerEndpoints = () => {
  let api = 'https://joldigo-backend.onrender.com';
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      api = 'http://localhost:5001';
    } else {
      let saved = localStorage.getItem('joldigo_server_url');
      if (saved) {
        const normalized = saved.trim().replace(/\/$/, '');
        if (normalized === 'http://localhost:5000' || normalized === 'http://localhost:5001' || normalized.includes('loca.lt') || normalized.includes('localhost')) {
          localStorage.setItem('joldigo_server_url', 'https://joldigo-backend.onrender.com');
          saved = 'https://joldigo-backend.onrender.com';
        }
      }
      if (saved) {
        api = saved;
      } else if (window.location.hostname !== 'localhost' && window.location.protocol !== 'file:') {
        api = 'https://joldigo-backend.onrender.com';
      }
    }
  }
  
  api = api.replace(/\/$/, '');
  let ws = api.replace(/^http/, 'ws');
  
  return { api, ws };
};

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

const getRouteCoordinates = async (start, end) => {
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const coords = data.routes[0].geometry.coordinates;
      return coords.map(coord => ({ lat: coord[1], lng: coord[0] }));
    }
  } catch (err) {
    console.warn("OSRM routing API failed, falling back to straight-line interpolation.", err);
  }
  return generateRoutePoints(start, end, 30);
};

export const SimulatorProvider = ({ children }) => {
  const [drivers, setDrivers] = useState([]);
  const [geofence, setGeofence] = useState(INITIAL_GEOFENCE);
  const [activeRide, setActiveRide] = useState(null);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [safetyClaims, setSafetyClaims] = useState([]);

  // Server state parameters
  const [fuelPrices, setFuelPrices] = useState({ cng: 95.50, petrol: 104.50, diesel: 92.75 });
  const [insuranceReservePool, setInsuranceReservePool] = useState(348.00); 
  const [isNightMode, setIsNightMode] = useState(false); 
  const [passengerWalletBalance, setPassengerWalletBalance] = useState(500.00); 
  const [congestionZones, setCongestionZones] = useState({ HOWRAH_BRIDGE: 'heavy', PARK_STREET: 'medium', SALT_LAKE_SEC5: 'medium' });
  const [activeSmsToast, setActiveSmsToast] = useState(null);

  const [settings, setSettings] = useState({
    baseFareCarAC: 50, perKmCarAC: 20,
    baseFareCarNonAC: 30, perKmCarNonAC: 15,
    baseFareBike: 20, perKmBike: 7,
    surgeMultiplier: 1.0,
    weather: 'clear'
  });

  const [passenger, setPassenger] = useState({ phone: '', isLoggedIn: false, rideHistory: [] });

  // WebSockets Connection References
  const passengerSocketRef = useRef(null);
  const driverSocketsRef = useRef({});
  const adminSocketRef = useRef(null);
  
  const timerRef = useRef(null);
  const simulationIntervalRef = useRef(null);

  // Sync Initial State
  const fetchInitialData = async () => {
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/settings`);
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        setFuelPrices(data.fuelPrices);
        setCongestionZones(data.congestionZones);
      }

      const drvRes = await fetch(`${api}/api/drivers`);
      const drvData = await drvRes.json();
      if (drvData.success) {
        setDrivers(drvData.drivers);
      }

      const ledgerRes = await fetch(`${api}/api/admin/stats`);
      const ledgerData = await ledgerRes.json();
      if (ledgerData.success) {
        setInsuranceReservePool(ledgerData.stats.safetyPoolBalance);
      }
    } catch (err) {
      console.warn("Failed to connect to backend server. Operating in offline simulated mode.", err);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Poll server state updates periodically for admin ledger
  useEffect(() => {
    const interval = setInterval(() => {
      fetchInitialData();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Web Audio Synth Cue
  const playSound = (type) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (type === 'sos') {
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
        osc2.frequency.setValueAtTime(450, ctx.currentTime);
        osc2.frequency.linearRampToValueAtTime(890, ctx.currentTime + 0.3);
        osc2.frequency.linearRampToValueAtTime(450, ctx.currentTime + 0.6);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 1.0);
        osc2.stop(ctx.currentTime + 1.0);
      } else if (type === 'match') {
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
      console.warn("AudioContext cue fail:", e);
    }
  };

  const addLog = (message, type = 'info') => {
    setLogs((prev) => [
      { id: Date.now() + Math.random().toString(), time: new Date().toLocaleTimeString(), message, type },
      ...prev.slice(0, 49),
    ]);
  };

  const triggerSmsToast = (message, sender = 'JoldiGo OTP Gateway') => {
    playSound('sms');
    setActiveSmsToast({ id: Date.now(), sender, message });
    setTimeout(() => setActiveSmsToast(null), 6000);
  };

  // --- WEBSOCKET CONNECTION CLIENTS ---

  const connectPassengerSocket = (phone) => {
    if (passengerSocketRef.current) return;
    const { ws: wsUrl } = getServerEndpoints();
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'register', role: 'passenger', id: phone }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'ride_accepted':
          setActiveRide(prev => prev ? { ...prev, status: 'accepted', driverId: data.driverId } : null);
          addLog(`Ride matches! Driver is heading to your pickup.`, 'success');
          break;
        case 'ride_status_broadcast':
          setActiveRide(prev => prev ? { ...prev, status: data.status } : null);
          if (data.status === 'completed') {
            fetchInitialData();
            refreshPassengerProfile(phone);
          }
          break;
        case 'chat_receive':
          setChatMessages(prev => prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message]);
          playSound('chat');
          break;
        case 'driver_location_broadcast':
          setDrivers(prev => prev.map(d => d.id === data.driverId ? { ...d, location: data.location } : d));
          break;
        case 'ride_rejected':
        case 'ride_timeout':
          setActiveRide(null);
          alert('Ride request expired or rejected by the driver.');
          break;
        case 'system_broadcast':
          triggerSmsToast(data.message, '⚠️ JoldiGo Control Room');
          break;
      }
    };
    passengerSocketRef.current = ws;
  };

  const connectDriverSocket = (driverId) => {
    if (driverSocketsRef.current[driverId]) return;
    const { ws: wsUrl } = getServerEndpoints();
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'register', role: 'driver', id: driverId }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'ride_offer':
          setActiveRide(data.ride);
          playSound('match');
          break;
        case 'verification_updated':
          setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, verificationStatus: data.status } : d));
          addLog(`Your verification status has been updated to: ${data.status.toUpperCase()}`, 'warning');
          break;
        case 'claim_approved':
          fetchInitialData();
          addLog(`Safety Claim Approved! Payout of ₹${data.amount} credited.`, 'success');
          break;
        case 'chat_receive':
          setChatMessages(prev => prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message]);
          playSound('chat');
          break;
        case 'system_broadcast':
          triggerSmsToast(data.message, '⚠️ JoldiGo Control Room');
          break;
      }
    };
    driverSocketsRef.current[driverId] = ws;
  };

  const connectAdminSocket = () => {
    if (adminSocketRef.current) return;
    const { ws: wsUrl } = getServerEndpoints();
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'register', role: 'admin', id: 'admin' }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'ledger_update':
        case 'claim_filed':
        case 'dispute_filed':
        case 'verification_request':
          fetchInitialData();
          break;
        case 'sos_broadcast':
          playSound('sos');
          // Handle police sirens locally
          triggerPatrolDispatch(data.driverId, data.location);
          break;
        case 'system_broadcast':
          triggerSmsToast(data.message, '⚠️ Control Room Loopback');
          break;
      }
    };
    adminSocketRef.current = ws;
  };

  const refreshPassengerProfile = async (phone) => {
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/passenger/profile/${phone}`);
      const data = await res.json();
      if (data.success) {
        setPassengerWalletBalance(parseFloat(data.passenger.wallet_balance || 0));
        setPassenger(prev => ({ ...prev, rideHistory: data.rideHistory }));
      }
    } catch (err) {
      console.warn("Failed to reload profile.");
    }
  };

  // --- CLIENT ACTIONS BINDINGS ---

  const watchIdRef = useRef(null);
  const [isGpsActive, setIsGpsActive] = useState(false);

  const startGpsTracking = (driverId) => {
    if (watchIdRef.current) return;
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by this device.");
      return;
    }
    
    setIsGpsActive(true);
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        const nextLoc = { lat, lng };
        
        setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, location: nextLoc } : d));
        
        const ws = driverSocketsRef.current[driverId];
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'driver_location_update', location: nextLoc }));
        }

        setActiveRide(prev => {
          if (prev && prev.driverId === driverId) {
            return { ...prev, location: nextLoc };
          }
          return prev;
        });
      },
      (err) => {
        console.error("GPS Tracking Error:", err);
      },
      { enableHighAccuracy: true, maximumAge: 0 }
    );
    
    watchIdRef.current = watchId;
    addLog(`🛰️ GPS Tracking enabled for Driver Partner ${driverId}`, 'success');
  };

  const stopGpsTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsGpsActive(false);
    addLog(`GPS Tracking disabled. Switched back to OSRM simulator mode.`, 'warning');
  };

  const sendOtpRequest = async (phone) => {
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (data.success) {
        triggerSmsToast(`JoldiGo Secure OTP: ${data.otpFallback}. Valid for 5 minutes. Do not share this code.`);
        return data.otpFallback;
      }
    } catch (err) {
      console.warn("Offline OTP dispatcher fallback.", err);
      triggerSmsToast(`JoldiGo Secure OTP: 1234. Valid for 5 minutes. (Offline Fallback)`);
      return '1234';
    }
  };

  const loginPassenger = async (phone, otp) => {
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp })
      });
      const data = await res.json();
      if (data.success) {
        setPassenger({ phone, isLoggedIn: true, rideHistory: [] });
        await refreshPassengerProfile(phone);
        connectPassengerSocket(phone);
        addLog(`Passenger verified and logged in.`, 'success');
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      console.warn("Offline verification fallback.", err);
      if (otp === '1234' || otp.length === 4) {
        setPassenger({ phone, isLoggedIn: true, rideHistory: [] });
        connectPassengerSocket(phone);
        addLog(`Passenger logged in with phone: ${phone} (Offline verification)`, 'success');
        return { success: true };
      }
      return { success: false, error: 'Incorrect OTP or connection failed.' };
    }
  };

  const logoutPassenger = () => {
    setPassenger({ isLoggedIn: false, phone: '' });
    if (passengerSocketRef.current) {
      passengerSocketRef.current.close();
      passengerSocketRef.current = null;
    }
  };

  const topUpPassengerWallet = async (amount) => {
    try {
      const { api } = getServerEndpoints();
      const orderRes = await fetch(`${api}/api/payment/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      const orderData = await orderRes.json();
      if (!orderData.success) {
        alert("Payment order creation failed!");
        return;
      }
      
      const order = orderData.order;
      
      const options = {
        key: orderData.useRealRazorpay ? orderData.keyId : 'rzp_test_mockKey',
        amount: order.amount,
        currency: order.currency,
        name: 'JoldiGo',
        description: 'Commuter Wallet Top-up',
        order_id: orderData.useRealRazorpay ? order.id : undefined,
        handler: async (response) => {
          const verifyRes = await fetch(`${api}/api/passenger/wallet/topup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: passenger.phone,
              amount,
              razorpay_payment_id: response.razorpay_payment_id || 'pay_mock_' + Math.random().toString(36).substr(2, 9),
              razorpay_order_id: response.razorpay_order_id || order.id,
              razorpay_signature: response.razorpay_signature
            })
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            setPassengerWalletBalance(parseFloat(verifyData.wallet_balance || 0));
            addLog(`Wallet topped up by ₹${amount} via Razorpay Checkout.`, 'success');
          } else {
            alert("Payment signature verification failed!");
          }
        },
        prefill: {
          contact: passenger.phone,
          email: 'commuter@joldigo.in'
        },
        theme: {
          color: '#ffdd00'
        }
      };
      
      if (typeof window.Razorpay !== 'undefined') {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        console.warn("Razorpay script not found. Executing mock topup.");
        const verifyRes = await fetch(`${api}/api/passenger/wallet/topup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: passenger.phone, amount })
        });
        const verifyData = await verifyRes.json();
        if (verifyData.success) {
          setPassengerWalletBalance(parseFloat(verifyData.wallet_balance || 0));
          addLog(`Wallet topped up by ₹${amount} (Mock top-up fallback)`, 'success');
        }
      }
    } catch (err) {
      console.error(err);
      setPassengerWalletBalance(prev => prev + amount);
    }
  };

  const toggleDriverStatus = async (driverId) => {
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/driver/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: driverId })
      });
      const data = await res.json();
      if (data.success) {
        setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, status: data.status } : d));
        if (data.status === 'online') {
          connectDriverSocket(driverId);
        }
      }
    } catch (err) {
      setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, status: d.status === 'online' ? 'offline' : 'online' } : d));
    }
  };

  const uploadDriverDocs = async (driverId, documents) => {
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/driver/upload-docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: driverId, ...documents })
      });
      const data = await res.json();
      if (data.success) {
        setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, verificationStatus: 'pending' } : d));
        addLog(`Driver ${driverId} uploaded onboarding credentials`, 'warning');
      }
    } catch (err) {
      setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, verificationStatus: 'pending' } : d));
    }
  };

  // Pricing calculations (kept local for upfront responsive quote slider previews)
  const calculateDetailedFare = (distance, vehicleType, pickup = null, dropoff = null) => {
    const isCarAC = vehicleType === 'car_ac';
    const isCarNonAC = vehicleType === 'car_non_ac';
    const standardBase = isCarAC ? settings.baseFareCarAC : (isCarNonAC ? settings.baseFareCarNonAC : settings.baseFareBike);
    const perKm = isCarAC ? settings.perKmCarAC : (isCarNonAC ? settings.perKmCarNonAC : settings.perKmBike);
    
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
    const distanceChargeable = Math.max(0, distance - 2);
    const baseRideFareBeforeSurge = indexedBase + distanceChargeable * perKm;
    
    // Proximity Congestion
    let trafficMultiplier = 1.0;
    let trafficZoneName = null;
    const zones = [
      { key: 'HOWRAH_BRIDGE', name: 'Howrah Bridge', lat: 22.5851, lng: 88.3468 },
      { key: 'PARK_STREET', name: 'Park Street Core', lat: 22.5530, lng: 88.3524 },
      { key: 'SALT_LAKE_SEC5', name: 'Sector V Tech Hub', lat: 22.5735, lng: 88.4331 },
    ];
    if (pickup && dropoff) {
      zones.forEach(z => {
        const distToPickup = calculateDistance(pickup.lat, pickup.lng, z.lat, z.lng);
        const distToDropoff = calculateDistance(dropoff.lat, dropoff.lng, z.lat, z.lng);
        if (distToPickup <= 1.2 || distToDropoff <= 1.2) {
          const state = congestionZones[z.key] || 'clear';
          let mult = state === 'heavy' ? 1.15 : (state === 'medium' ? 1.08 : 1.00);
          if (mult > trafficMultiplier) {
            trafficMultiplier = mult;
            trafficZoneName = z.name;
          }
        }
      });
    }

    // Weather surge multiplier & safety controls
    let weatherMultiplier = 1.0;
    if (settings.weather === 'rain') weatherMultiplier = 1.15;
    else if (settings.weather === 'waterlogged') weatherMultiplier = 1.25;

    const baseSurge = isNightMode ? 1.20 : 1.00;
    const finalSurgeMultiplier = parseFloat(Math.min(1.50, Math.max(baseSurge, settings.surgeMultiplier) * trafficMultiplier * weatherMultiplier).toFixed(2));
    const grossBaseRideFare = parseFloat((baseRideFareBeforeSurge * finalSurgeMultiplier).toFixed(2));
    
    const gstAmount = parseFloat((grossBaseRideFare * 0.05).toFixed(2));
    const commission = parseFloat((grossBaseRideFare * 0.05).toFixed(2));
    const driverPayout = parseFloat((grossBaseRideFare * 0.95).toFixed(2));
    const tollEstimate = distance > 8 ? 35 : 0;
    const insurancePremium = 2.00; 
    
    const totalFare = (settings.weather === 'waterlogged' && vehicleType === 'bike')
      ? 0
      : parseFloat((grossBaseRideFare + gstAmount + tollEstimate + insurancePremium).toFixed(2));

    const hashSeed = `${vehicleType}-${distance}-${totalFare}-${fuelPrices.petrol}-${finalSurgeMultiplier}`;
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
      trafficZoneName,
      grossBaseRideFare,
      gstAmount,
      tollEstimate,
      insurancePremium,
      totalFare,
      commission,
      takeHome: driverPayout, 
      contractHash,
      isNightChargeApplied: isNightMode
    };
  };

  const bookRide = (pickup, dropoff, vehicleType, paymentMethod = 'wallet', promoCode = '', discountApplied = 0) => {
    if (activeRide) return;
    if (!isPointInPolygon(pickup, geofence) || !isPointInPolygon(dropoff, geofence)) {
      alert("Service Unavailable: Locations lie outside Operational Geofences.");
      return;
    }

    const dist = calculateDistance(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
    const fareDetails = calculateDetailedFare(dist, vehicleType, pickup, dropoff);

    const netPassengerFare = Math.max(20, parseFloat((fareDetails.totalFare - discountApplied).toFixed(2)));

    if (paymentMethod === 'wallet' && passengerWalletBalance < netPassengerFare) {
      alert(`Insufficient Balance: You need ₹${netPassengerFare} to book this ride.`);
      return;
    }

    const availableDrivers = drivers.filter(d => d.status === 'online' && d.verificationStatus === 'verified' && d.vehicleType === vehicleType);
    if (availableDrivers.length === 0) {
      alert(`No online drivers matching type "${vehicleType.replace('_', ' ').toUpperCase()}" available nearby.`);
      return;
    }

    let closestDriver = availableDrivers[0];
    let minD = calculateDistance(pickup.lat, pickup.lng, closestDriver.location.lat, closestDriver.location.lng);
    for (let i = 1; i < availableDrivers.length; i++) {
      const d = calculateDistance(pickup.lat, pickup.lng, availableDrivers[i].location.lat, availableDrivers[i].location.lng);
      if (d < minD) { minD = d; closestDriver = availableDrivers[i]; }
    }

    setChatMessages([]);
    playSound('match');

    const newRide = {
      id: 'ride_' + Math.random().toString(36).substr(2, 9),
      pickup, dropoff,
      passengerPhone: passenger.phone,
      pickupName: pickup.name,
      dropoffName: dropoff.name,
      paymentMethod, vehicleType, distance: dist,
      totalFare: netPassengerFare, 
      takeHome: fareDetails.takeHome, 
      commission: parseFloat((fareDetails.commission - discountApplied).toFixed(2)),
      discountApplied,
      promoCode,
      gstAmount: fareDetails.gstAmount, insurancePremium: fareDetails.insurancePremium,
      grossBaseRideFare: fareDetails.grossBaseRideFare,
      destinationZone: dropoff.zone,
      estimatedRouteFriction: fareDetails.trafficMultiplier > 1.0 ? 'High (Heavy Traffic)' : 'Normal (Clear Flow)',
      tollEstimate: fareDetails.tollEstimate,
      timer: 15,
      contractHash: fareDetails.contractHash, surgeMultiplier: fareDetails.surgeMultiplier,
      status: 'searching', driverId: closestDriver.id
    };

    setActiveRide(newRide);

    // Dispatch via Passenger WebSockets
    if (passengerSocketRef.current && passengerSocketRef.current.readyState === WebSocket.OPEN) {
      passengerSocketRef.current.send(JSON.stringify({ type: 'book_ride', ride: newRide }));
    }
  };

  const acceptRide = async (driverId) => {
    const ws = driverSocketsRef.current[driverId];
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'driver_accept', rideId: activeRide.id, passengerPhone: activeRide.passengerPhone }));
    }

    const driver = drivers.find(d => d.id === driverId);
    if (!driver || !activeRide) return;

    const pickupRoute = await getRouteCoordinates(driver.location, activeRide.pickup);

    setActiveRide(prev => {
      if (!prev) return null;
      animateDriverMovement(driverId, pickupRoute, 'pickup');
      return { ...prev, status: 'accepted', route: pickupRoute, routeIndex: 0 };
    });
  };

  const rejectRide = (driverId) => {
    const ws = driverSocketsRef.current[driverId];
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'driver_reject', rideId: activeRide.id, passengerPhone: activeRide.passengerPhone }));
    }
    setActiveRide(null);
  };

  const animateDriverMovement = (driverId, pathCoords, stage) => {
    if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
    let idx = 0;
    simulationIntervalRef.current = setInterval(() => {
      idx++;
      if (idx >= pathCoords.length) {
        clearInterval(simulationIntervalRef.current);
        const finalLoc = pathCoords[pathCoords.length - 1];
        
        // Push final GPS update via WebSockets to synchronize DB
        const ws = driverSocketsRef.current[driverId];
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'driver_location_update', location: finalLoc }));
        }

        if (stage === 'pickup') {
          setActiveRide(prev => {
            if (!prev) return null;
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'update_ride_status', rideId: prev.id, status: 'arrived', passengerPhone: prev.passengerPhone }));
            }
            return { ...prev, status: 'arrived', location: finalLoc };
          });
        } else if (stage === 'trip') {
          setActiveRide(prev => {
            if (!prev) return null;
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'update_ride_status', rideId: prev.id, status: 'completed', passengerPhone: prev.passengerPhone }));
            }
            return { ...prev, status: 'completed', location: finalLoc };
          });
        }
      } else {
        const nextLoc = pathCoords[idx];
        setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, location: nextLoc } : d));
        
        // Push coordinate tick via WebSockets
        const ws = driverSocketsRef.current[driverId];
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'driver_location_update', location: nextLoc }));
        }

        setActiveRide(prev => prev ? { ...prev, routeIndex: idx, location: nextLoc } : null);
      }
    }, 400);
  };

  const startRide = async () => {
    if (!activeRide || activeRide.status !== 'arrived') return;

    const ws = driverSocketsRef.current[activeRide.driverId];
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'update_ride_status', rideId: activeRide.id, status: 'in_progress', passengerPhone: activeRide.passengerPhone }));
    }

    const tripRoute = await getRouteCoordinates(activeRide.pickup, activeRide.dropoff);

    setActiveRide(prev => {
      if (!prev) return null;
      animateDriverMovement(prev.driverId, tripRoute, 'trip');
      return { ...prev, status: 'in_progress', route: tripRoute, routeIndex: 0 };
    });
  };

  const completePaymentAndRate = async (rating) => {
    if (!activeRide || activeRide.status !== 'completed') return;
    
    // Refresh local client view and close ride view
    await refreshPassengerProfile(passenger.phone);
    setActiveRide(null);
    addLog(`Payment of ₹${activeRide.totalFare} completed successfully.`, 'success');
  };

  const cancelRide = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
    setActiveRide(null);
  };

  const sendChatMessage = (sender, text) => {
    let translation = "Translation unavailable";
    if (CHAT_TRANSLATIONS[text]) {
      translation = CHAT_TRANSLATIONS[text];
    } else {
      translation = sender === 'passenger' ? `[অনুবাদ]: ${text}` : `[Translated]: ${text}`;
    }

    const msgId = 'msg_' + Date.now();
    const message = {
      id: msgId, sender, text, translation,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, message]);
    playSound('chat');

    // Send through WebSocket to peer receiver
    if (activeRide) {
      const ws = sender === 'passenger' ? passengerSocketRef.current : driverSocketsRef.current[activeRide.driverId];
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'send_chat',
          msgId,
          receiverRole: sender === 'passenger' ? 'driver' : 'passenger',
          receiverId: sender === 'passenger' ? activeRide.driverId : activeRide.passengerPhone,
          text,
          translation
        }));
      }
    }
  };

  const triggerSOS = (driverId) => {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver || !activeRide) return;

    playSound('sos');

    // Notify control room via WebSocket
    const ws = driverSocketsRef.current[driverId];
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'sos_alert',
        rideId: activeRide.id,
        location: driver.location
      }));
    }
  };

  // SOS police interceptor local visual rendering for admin panel
  const triggerPatrolDispatch = async (driverId, location) => {
    const policeStationLoc = { lat: location.lat + 0.015, lng: location.lng - 0.018 };
    const policeRoute = await getRouteCoordinates(policeStationLoc, location);
    const newAlert = {
      id: 'sos_' + Date.now(),
      driverId,
      location,
      time: new Date().toLocaleTimeString(),
      status: 'dispatch',
      policeLocation: policeStationLoc,
      policeRoute,
      policeRouteIndex: 0,
      eta: Math.ceil(policeRoute.length * 0.8)
    };

    setSosAlerts(prev => [newAlert, ...prev]);

    let idx = 0;
    const dispatchInterval = setInterval(() => {
      idx++;
      setSosAlerts(prevAlerts => {
        return prevAlerts.map(alert => {
          if (alert.id === newAlert.id) {
            if (idx >= policeRoute.length) {
              clearInterval(dispatchInterval);
              return { ...alert, policeLocation: policeRoute[policeRoute.length - 1], policeRouteIndex: policeRoute.length - 1, status: 'secured', eta: 0 };
            }
            return { ...alert, policeLocation: policeRoute[idx], policeRouteIndex: idx, eta: policeRoute.length - idx };
          }
          return alert;
        });
      });
    }, 800);
  };

  const resolveSOS = (sosId) => {
    setSosAlerts(prev => prev.map(a => a.id === sosId ? { ...a, status: 'resolved' } : a));
  };

  const fileDispute = async (rideId, complaint) => {
    const ride = passenger.rideHistory.find(h => h.id === rideId);
    if (!ride) return;

    const newDispute = {
      id: 'disp_' + Math.random().toString(36).substr(2, 9),
      rideId,
      passengerPhone: passenger.phone,
      driverId: activeRide?.driverId || 'drv_1',
      reason: complaint,
      expiresIn: 45
    };

    if (passengerSocketRef.current && passengerSocketRef.current.readyState === WebSocket.OPEN) {
      passengerSocketRef.current.send(JSON.stringify({ type: 'file_dispute', dispute: newDispute }));
    }

    setPassenger(prev => ({
      ...prev,
      rideHistory: prev.rideHistory.map(h => h.id === rideId ? { ...h, disputed: true } : h)
    }));

    addLog(`Dispute contract registered on ledger. Awaiting review.`, 'warning');
  };

  const uploadDisputeEvidence = async (disputeId, evidenceType, fileName) => {
    const ws = Object.values(driverSocketsRef.current)[0] || passengerSocketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'upload_dispute_evidence', disputeId, evidence: fileName }));
    }
  };

  const resolveDispute = async (disputeId, outcome) => {
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/admin/dispute/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disputeId, payoutTarget: outcome })
      });
      const data = await res.json();
      if (data.success) {
        addLog(`Dispute ${disputeId} resolved successfully.`, 'success');
        fetchInitialData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const verifyDriverStatus = async (driverId, verified) => {
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/admin/driver/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, approve: verified })
      });
      const data = await res.json();
      if (data.success) {
        fetchInitialData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const payoutDriver = async (driverId) => {
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/admin/driver/payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId })
      });
      const data = await res.json();
      if (data.success) {
        addLog(`Processed net ₹${data.payoutAmount} payout to partner.`, 'success');
        fetchInitialData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const broadcastNotification = async (target, message) => {
    try {
      const { api } = getServerEndpoints();
      await fetch(`${api}/api/admin/broadcast-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, message })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      const { api } = getServerEndpoints();
      await fetch(`${api}/api/admin/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings })
      });
      fetchInitialData();
    } catch (err) {
      console.error(err);
    }
  };

  const fileSafetyClaim = async (driverId, claimType, amount, description) => {
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/driver/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, claimType, amount, description })
      });
      const data = await res.json();
      if (data.success) {
        addLog(`Safety claim submitted for processing.`, 'warning');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resolveSafetyClaim = async (claimId, outcome) => {
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/admin/claim/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimId, approve: outcome === 'approved' })
      });
      const data = await res.json();
      if (data.success) {
        addLog(`Safety claim ${claimId} resolved.`, 'success');
        fetchInitialData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEnvKeys = async () => {
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/admin/env/get`);
      const data = await res.json();
      if (data.success) {
        return data;
      }
    } catch (err) {
      console.error(err);
    }
    return { databaseUrl: '', twilioSid: '', twilioAuthToken: '', twilioPhoneNumber: '', razorpayKeyId: '', razorpayKeySecret: '' };
  };

  const updateEnvKeys = async (keys) => {
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/admin/env/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keys)
      });
      const data = await res.json();
      if (data.success) {
        addLog(`Server API Keys and Secrets updated.`, 'success');
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err) {
      console.error(err);
      return { success: false, error: 'Connection failure.' };
    }
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
        payoutDriver,
        broadcastNotification,
        updateSettings,
        updateGeofence: setGeofence,
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
        fastForwardDisputeSla: () => {},
        calculateDetailedFare,
        congestionZones,
        toggleCongestionZone: (zone, lvl) => {
          setCongestionZones(prev => ({ ...prev, [zone]: lvl }));
        },
        activeSmsToast,
        setActiveSmsToast,
        triggerSmsToast,
        safetyClaims,
        fileSafetyClaim,
        resolveSafetyClaim,
        playSound,
        connectPassengerSocket,
        connectDriverSocket,
        connectAdminSocket,
        sendOtpRequest,
        startGpsTracking,
        stopGpsTracking,
        isGpsActive,
        fetchEnvKeys,
        updateEnvKeys
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
