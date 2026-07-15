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



// Dynamic URL parser for tunnels / local IP / production hosts
export const getServerEndpoints = () => {
  let api = 'https://joldigo-backend.onrender.com';
  if (typeof window !== 'undefined') {
    try {
      let saved = localStorage.getItem('joldigo_server_url');
      if (saved) {
        api = saved;
      } else {
        const isCapacitor = typeof window !== 'undefined' && (!!window.Capacitor || window.location.protocol === 'capacitor:');
        if (isCapacitor) {
          api = 'https://joldigo-backend.onrender.com';
        } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          api = 'http://localhost:5001';
        }
      }
    } catch (e) {
      console.warn("Storage access blocked:", e);
    }
  }
  
  if (!api || typeof api !== 'string') {
    api = 'https://joldigo-backend.onrender.com';
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

export const isPointInZone = (point, zonePoints) => {
  if (!point || !zonePoints) return false;
  // Convert [lat, lng] array format to [{ lat, lng }] format if needed
  const formattedPolygon = zonePoints.map(pt => {
    if (Array.isArray(pt)) {
      return { lat: pt[0], lng: pt[1] };
    }
    return pt;
  });
  return isPointInPolygon(point, formattedPolygon);
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

const getRouteCoordinates = async (start, end, isWaterlogged = false) => {
  let points = [];
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const coords = data.routes[0].geometry.coordinates;
      points = coords.map(coord => ({ lat: coord[1], lng: coord[0] }));
    }
  } catch (err) {
    console.warn("OSRM routing API failed, falling back to straight-line interpolation.", err);
  }
  if (points.length === 0) {
    points = generateRoutePoints(start, end, 30);
  }
  if (isWaterlogged && points.length > 2) {
    const midIdx = Math.floor(points.length / 2);
    const midPoint = points[midIdx];
    // Detour coordinates: deviating slightly outward to simulate navigating around standing water/floods
    const detourPoint1 = { lat: midPoint.lat + 0.003, lng: midPoint.lng + 0.003 };
    const detourPoint2 = { lat: midPoint.lat + 0.001, lng: midPoint.lng - 0.002 };
    points.splice(midIdx, 1, detourPoint1, detourPoint2);
  }
  return points;
};

const getDetourCoordinates = async (start, end, detourPoint) => {
  let points = [];
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${detourPoint.lng},${detourPoint.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const coords = data.routes[0].geometry.coordinates;
      points = coords.map(coord => ({ lat: coord[1], lng: coord[0] }));
    }
  } catch (err) {
    console.warn("Detour routing API failed, falling back to straight line segments.", err);
  }
  if (points.length === 0) {
    points = [
      ...generateRoutePoints(start, detourPoint, 15),
      ...generateRoutePoints(detourPoint, end, 15)
    ];
  }
  return points;
};

const CHAT_TRANSLATIONS = {
  'en-bn': {
    'i am waiting at the pickup location': 'আমি পিকআপ লোকেশনে অপেক্ষা করছি।',
    'where are you': 'আপনি কোথায় আছেন?',
    'heavy traffic reaching in 5 minutes': 'প্রচুর ট্রাফিক, ৫ মিনিটে পৌঁছাচ্ছি।',
    'please cancel the ride': 'দয়া করে ট্রিপটি বাতিল করুন।',
    'i have arrived': 'আমি এসে গেছি।',
    'hello': 'নমস্কার।',
    'okay understood': 'ঠিক আছে, বুঝতে পেরেছি।',
    'yes': 'হ্যাঁ',
    'no': 'না',
    'ok': 'ঠিক আছে'
  },
  'en-hi': {
    'i am waiting at the pickup location': 'मैं पिकअप लोकेशन पर इंतजार कर रहा हूँ।',
    'where are you': 'आप कहाँ हैं?',
    'heavy traffic reaching in 5 minutes': 'बहुत भारी ट्रैफिक है, ५ मिनट में पहुँच रहा हूँ।',
    'please cancel the ride': 'कृपया राइड कैंसिल कर दीजिए।',
    'i have arrived': 'मैं आ गया हूँ।',
    'hello': 'नमस्ते।',
    'okay understood': 'ठीक है, समझ गया।',
    'yes': 'हाँ',
    'no': 'नहीं',
    'ok': 'ठीक है'
  },
  'bn-en': {
    'আমি পিকআপ লোকেশনে অপেক্ষা করছি।': 'I am waiting at the pickup location.',
    'আপনি কোথায় আছেন?': 'Where are you?',
    'প্রচুর ট্রাফিক, ৫ মিনিটে পৌঁছাচ্ছি।': 'Heavy traffic, reaching in 5 minutes.',
    'দয়া করে ট্রিপটি বাতিল করুন।': 'Please cancel the ride.',
    'আমি এসে গেছি।': 'I have arrived.',
    'নমস্কার।': 'Hello.',
    'ঠিক আছে, বুঝতে পেরেছি।': 'Okay, understood.',
    'হ্যাঁ': 'Yes',
    'না': 'No',
    'ঠিক আছে': 'Ok'
  },
  'bn-hi': {
    'আমি পিকআপ লোকেশনে অপেক্ষা করছি।': 'मैं पिकअप लोकेशन पर इंतजार कर रहा हूँ।',
    'আপনি কোথায় আছেন?': 'आप कहाँ हैं?',
    'প্রচুর ট্রাফিক, ৫ মিনিটে পৌঁছাচ্ছি।': 'बहुत भारी ट्रैफिक है, ५ मिनट में पहुँच रहा हूँ।',
    'দয়া করে ট্রিপটি বাতিল করুন।': 'कृपया राइड कैंसिल कर दीजिए।',
    'আমি এসে গেছি।': 'मैं आ गया हूँ।',
    'নমস্কার।': 'नमस्ते।',
    'ঠিক আছে, বুঝতে পেরেছি।': 'ठीक है, समझ गया।',
    'হ্যাঁ': 'हाँ',
    'না': 'नहीं',
    'ঠিক আছে': 'ठीक है'
  },
  'hi-en': {
    'मैं पिकअप लोकेशन पर इंतजार कर रहा हूँ।': 'I am waiting at the pickup location.',
    'आप कहाँ हैं?': 'Where are you?',
    'बहुत भारी ट्रैफिक है, ५ मिनट में पहुँच रहा हूँ।': 'Heavy traffic, reaching in 5 minutes.',
    'कृपया राइड कैंसिल कर दीजिए।': 'Please cancel the ride.',
    'मैं आ गया हूँ।': 'I have arrived.',
    'नमस्ते।': 'Hello.',
    'ठीक है, समझ गया।': 'Okay, understood.',
    'हाँ': 'Yes',
    'नहीं': 'No',
    'ठीक है': 'Ok'
  },
  'hi-bn': {
    'मैं पिकअप लोकेशन पर इंतजार कर रहा हूँ।': 'আমি পিকআপ লোকেশনে অপেক্ষা করছি।',
    'आप कहाँ हैं?': 'আপনি কোথায় আছেন?',
    'बहुत भारी ट्रैफिक है, ५ मिनट में पहुँच रहा हूँ।': 'প্রচুর ট্রাফিক, ৫ মিনিটে পৌঁছাচ্ছি।',
    'कृपया राइड कैंसिल कर दीजिए।': 'দয়া করে ট্রিপটি বাতিল করুন।',
    'मैं आ गया हूँ।': 'আমি এসে গেছি।',
    'नमस्ते।': 'নমস্কার।',
    'ठीक है, समझ गया।': 'ঠিক আছে, বুঝতে পেরেছি।',
    'हाँ': 'হ্যাঁ',
    'नहीं': 'না',
    'ठीक আছে': 'ঠিক আছে'
  }
};

export const getChatTranslation = (text, sourceLang = 'en', targetLang = 'bn') => {
  if (!text) return '';
  const s = sourceLang.toLowerCase().split('-')[0];
  const t = targetLang.toLowerCase().split('-')[0];
  if (s === t) return text;
  
  const key = `${s}-${t}`;
  const dict = CHAT_TRANSLATIONS[key];
  
  const normalizedText = text.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,"");
  if (dict && dict[normalizedText]) {
    return dict[normalizedText];
  }
  
  // Dynamic fallback translations
  if (t === 'bn') {
    return `[অনূদিত] ${text} (দাদা)`;
  } else if (t === 'hi') {
    return `[अनुवादित] ${text} (भैया)`;
  }
  return `[Translated] ${text}`;
};

export const SimulatorProvider = ({ children }) => {
  const [drivers, setDrivers] = useState([]);
  const [geofence, setGeofence] = useState(INITIAL_GEOFENCE);
  const [geofencingZones, setGeofencingZones] = useState([
    { id: 'zone_airport', name: 'Kolkata CCU Airport Zone', points: [ [22.63, 88.42], [22.66, 88.45], [22.65, 88.47], [22.61, 88.43] ], type: 'surge', multiplier: 1.5, active: true },
    { id: 'zone_howrah', name: 'Howrah Bridge VIP Restriction Zone', points: [ [22.58, 88.33], [22.59, 88.35], [22.57, 88.36], [22.56, 88.34] ], type: 'ban', multiplier: 1.0, active: false },
    { id: 'zone_saltlake', name: 'Salt Lake IT Core Surge Zone', points: [ [22.56, 88.41], [22.58, 88.44], [22.56, 88.46], [22.54, 88.42] ], type: 'surge', multiplier: 1.3, active: true }
  ]);
  const [activeRide, setActiveRide] = useState(null);
  const [sosAlerts, setSosAlerts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [safetyClaims, setSafetyClaims] = useState([]);
  const [fraudAlerts, setFraudAlerts] = useState([]);
  const [surgeSchedules, setSurgeSchedules] = useState([]);
  const [activeScheduledSurge, setActiveScheduledSurge] = useState(null);
  const [demandHotspots, setDemandHotspots] = useState([]);
  const [predictiveGuides, setPredictiveGuides] = useState([]);
  const [passengersList, setPassengersList] = useState([]);
  const [useAiSurgeEngine, setUseAiSurgeEngine] = useState(false);
  const [dynamicSurgeMultiplier, setDynamicSurgeMultiplier] = useState(1.0);
  const [dispatchQueueLog, setDispatchQueueLog] = useState([]);
  const [promos, setPromos] = useState([
    { code: 'JOLDIGO50', discountValue: 50, discountType: 'flat', maxDiscount: 50, weatherRestriction: null, status: 'active' },
    { code: 'MONSOONFREE', discountValue: 100, discountType: 'flat', maxDiscount: 100, weatherRestriction: 'rain', status: 'active' },
    { code: 'JOLDISAVE', discountValue: 25, discountType: 'flat', maxDiscount: 25, weatherRestriction: null, status: 'active' },
    { code: 'FIRSTGO', discountValue: 75, discountType: 'flat', maxDiscount: 75, weatherRestriction: null, status: 'active' }
  ]);
  const [blockages, setBlockages] = useState([
    { id: 'b_default', lat: 22.5485, lng: 88.3585, type: 'accident', radius: 200, description: 'Car pile-up near Park Street intersection' }
  ]);

  // Server state parameters
  const [fuelPrices, setFuelPrices] = useState({ cng: 95.50, petrol: 104.50, diesel: 92.75 });
  const [insuranceReservePool, setInsuranceReservePool] = useState(348.00); 
  const [adminStats, setAdminStats] = useState({
    totalCommission: 0,
    safetyPoolBalance: 348.00,
    activeTrips: 0,
    grossBookings: 0,
    driverPayouts: 0,
    accumulatedGstTotal: 0,
    silverCount: 0,
    goldCount: 0,
    freeCount: 0,
    subscriptionEarnings: 0
  });
  const [isNightMode, setIsNightMode] = useState(true); 
  const [mapStyle, setMapStyle] = useState('openstreetmap');
  const [passengerWalletBalance, setPassengerWalletBalance] = useState(500.00); 
  const [congestionZones, setCongestionZones] = useState({ HOWRAH_BRIDGE: 'heavy', PARK_STREET: 'medium', SALT_LAKE_SEC5: 'medium' });
  const [activeSmsToast, setActiveSmsToast] = useState(null);
  const [smsLogs, setSmsLogs] = useState([]);
  const [simulationSpeed, setSimulationSpeed] = useState(400);

  const [settings, setSettings] = useState({
    baseFareCarAC: 50, perKmCarAC: 20,
    baseFareCarNonAC: 30, perKmCarNonAC: 15,
    baseFareBike: 20, perKmBike: 7,
    surgeMultiplier: 1.0,
    weather: 'clear'
  });

  const [passenger, setPassenger] = useState({ phone: '', isLoggedIn: false, rideHistory: [] });

  // Dynamic VoIP Calling Simulator State
  const [callState, setCallState] = useState('idle'); // 'idle', 'dialing', 'ringing', 'connected'
  const [callFrom, setCallFrom] = useState(null); // 'passenger' or 'driver'
  const [callPartner, setCallPartner] = useState(null); // { id, name, role }
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef(null);

  const startCallTimer = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);

  // Initialize a hidden audio element on boot to play incoming stream
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      remoteAudioRef.current = audio;
    }
    return () => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
    };
  }, []);

  const closeWebrtcConnection = () => {
    console.log('[WebRTC] Closing peer connection.');
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  };

  const cleanupCall = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallState('idle');
    setCallFrom(null);
    setCallPartner(null);
    setCallDuration(0);
    closeWebrtcConnection();
  };

  const sendWebrtcSignal = (targetRole, targetId, signal) => {
    const msg = JSON.stringify({
      type: 'webrtc_signal',
      payload: { targetRole, targetId, signal }
    });
    
    const driverId = activeRide?.driverId;
    if (passengerSocketRef.current && passengerSocketRef.current.readyState === WebSocket.OPEN) {
      passengerSocketRef.current.send(msg);
    } else if (driverId && driverSocketsRef.current[driverId] && driverSocketsRef.current[driverId].readyState === WebSocket.OPEN) {
      driverSocketsRef.current[driverId].send(msg);
    }
  };

  const setupPeerConnection = async (targetRole, targetId, isInitiator) => {
    try {
      console.log(`[WebRTC] Setting up PeerConnection. isInitiator: ${isInitiator}`);
      
      closeWebrtcConnection();

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      peerConnectionRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendWebrtcSignal(targetRole, targetId, {
            type: 'candidate',
            candidate: event.candidate
          });
        }
      };

      pc.ontrack = (event) => {
        console.log('[WebRTC] Received remote track!', event.streams[0]);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(err => {
            console.error('[WebRTC] Failed to play remote audio:', err);
          });
        }
      };

      let localStream;
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = localStream;
        console.log('[WebRTC] Local microphone captured successfully.');
      } catch (micErr) {
        console.warn('[WebRTC] Failed to capture microphone. Continuing in silent mode.', micErr);
        addLog('⚠️ Microphone access denied. Simulated call will be silent.', 'warning');
      }

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });
      }

      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendWebrtcSignal(targetRole, targetId, {
          type: 'offer',
          sdp: pc.localDescription
        });
      }

    } catch (err) {
      console.error('[WebRTC] Error setting up PeerConnection:', err);
    }
  };

  const handleIncomingWebrtcSignal = async (data) => {
    const { signal, fromRole, fromId } = data;
    const pc = peerConnectionRef.current;

    try {
      if (signal.type === 'offer') {
        if (!pc) {
          await setupPeerConnection(fromRole, fromId, false);
        }
        const currentPc = peerConnectionRef.current;
        if (currentPc) {
          await currentPc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await currentPc.createAnswer();
          await currentPc.setLocalDescription(answer);
          sendWebrtcSignal(fromRole, fromId, {
            type: 'answer',
            sdp: currentPc.localDescription
          });
        }
      } else if (signal.type === 'answer') {
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        }
      } else if (signal.type === 'candidate') {
        if (pc && signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      }
    } catch (err) {
      console.error('[WebRTC] Error handling incoming WebRTC signal:', err);
    }
  };

  const initiateCall = (targetRole, targetId, fromName) => {
    setCallState('dialing');
    setCallFrom(targetRole === 'driver' ? 'passenger' : 'driver');
    
    let partnerDisplayName = 'JoldiGo Partner';
    if (targetRole === 'driver') {
      const targetDrv = drivers.find(d => d.id === targetId);
      partnerDisplayName = targetDrv ? `Captain ${targetDrv.name}` : 'JoldiGo Captain';
    } else {
      partnerDisplayName = 'Passenger Rider';
    }

    setCallPartner({ id: targetId, role: targetRole, name: partnerDisplayName });
    setCallDuration(0);

    const msg = JSON.stringify({
      type: 'initiate_call',
      payload: { targetRole, targetId, fromName }
    });

    if (targetRole === 'driver') {
      if (passengerSocketRef.current && passengerSocketRef.current.readyState === WebSocket.OPEN) {
        passengerSocketRef.current.send(msg);
      }
    } else {
      const driverId = activeRide?.driverId;
      const ws = driverSocketsRef.current[driverId];
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  };

  const acceptCall = (targetRole, targetId) => {
    setCallState('connected');
    startCallTimer();
    
    // WebRTC connection: setup peer connection as responder
    setupPeerConnection(targetRole, targetId, false);

    const msg = JSON.stringify({
      type: 'accept_call',
      payload: { targetRole, targetId }
    });

    if (targetRole === 'driver') {
      if (passengerSocketRef.current && passengerSocketRef.current.readyState === WebSocket.OPEN) {
        passengerSocketRef.current.send(msg);
      }
    } else {
      const driverId = activeRide?.driverId;
      const ws = driverSocketsRef.current[driverId];
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  };

  const endCall = (targetRole, targetId) => {
    cleanupCall();

    const msg = JSON.stringify({
      type: 'end_call',
      payload: { targetRole, targetId }
    });

    if (targetRole === 'driver') {
      if (passengerSocketRef.current && passengerSocketRef.current.readyState === WebSocket.OPEN) {
        passengerSocketRef.current.send(msg);
      }
    } else {
      const driverId = activeRide?.driverId;
      const ws = driverSocketsRef.current[driverId];
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  };

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
        setAdminStats(ledgerData.stats);
      }

      // Fetch dynamic geofencing zones
      const geofenceRes = await fetch(`${api}/api/geofence/zones`);
      const geofenceData = await geofenceRes.json();
      if (Array.isArray(geofenceData)) {
        setGeofencingZones(geofenceData);
      }

      // Fetch active fraud alerts
      const fraudRes = await fetch(`${api}/api/admin/fraud/alerts`);
      const fraudData = await fraudRes.json();
      if (fraudData.success) {
        setFraudAlerts(fraudData.alerts);
      }

      // Fetch active surge schedules
      const schedsRes = await fetch(`${api}/api/admin/surge/schedules`);
      const schedsData = await schedsRes.json();
      if (Array.isArray(schedsData)) {
        setSurgeSchedules(schedsData);
      }

      // Fetch demand hotspots
      const hotspotsRes = await fetch(`${api}/api/admin/demand/hotspots`);
      const hotspotsData = await hotspotsRes.json();
      if (hotspotsData.success) {
        setDemandHotspots(hotspotsData.hotspots);
      }

      // Fetch dynamic promo codes
      try {
        const promosRes = await fetch(`${api}/api/promos`);
        const promosData = await promosRes.json();
        if (Array.isArray(promosData)) {
          setPromos(promosData);
        }
      } catch (e) {
        console.warn("Failed to fetch promos list from backend.", e);
      }

      // Fetch dynamic blockages
      try {
        const blockagesRes = await fetch(`${api}/api/blockages`);
        const blockagesData = await blockagesRes.json();
        if (blockagesData.success && Array.isArray(blockagesData.blockages)) {
          setBlockages(blockagesData.blockages);
        }
      } catch (e) {
        console.warn("Failed to fetch blockages list from backend.", e);
      }

      // Fetch persistent SMS logs
      try {
        const smsRes = await fetch(`${api}/api/admin/sms-logs`);
        const smsData = await smsRes.json();
        if (smsData.success && Array.isArray(smsData.logs)) {
          setSmsLogs(smsData.logs);
        }
      } catch (e) {
        console.warn("Failed to fetch sms logs list from backend.", e);
      }
    } catch (err) {
      console.warn("Failed to connect to backend server. Operating in offline simulated mode.", err);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Handle theme toggling (isNightMode = true (Dark Theme), isNightMode = false (Light Theme))
  useEffect(() => {
    if (isNightMode) {
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
    }
  }, [isNightMode]);

  // Poll server state updates periodically for admin ledger
  useEffect(() => {
    const interval = setInterval(() => {
      fetchInitialData();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Dynamic pricing calculation hook (real-time supply/demand indexing)
  useEffect(() => {
    const onlineDrivers = drivers.filter(d => d.status === 'online' && d.verificationStatus === 'verified');
    const idleDriversCount = onlineDrivers.filter(d => {
      const isBusy = activeRide && activeRide.driverId === d.id && activeRide.status !== 'completed' && activeRide.status !== 'cancelled';
      return !isBusy;
    }).length;

    let activeBookingsCount = (activeRide && (activeRide.status === 'searching' || activeRide.status === 'requested')) ? 1.5 : 0;
    let hotspotWeights = demandHotspots.length > 0 ? demandHotspots.reduce((acc, h) => acc + (h.weight || 1), 0) * 0.35 : 0.6;
    
    const calculatedDemand = activeBookingsCount + hotspotWeights;
    const supply = Math.max(1, onlineDrivers.length === 0 ? 3 : idleDriversCount); // fallback default to prevent division by zero or idle mismatch
    const ratio = calculatedDemand / supply;

    let targetSurge = 1.0;
    // Under night mode, there is a shortage of supply, so surge scales up by 1.25x
    const nightFactor = isNightMode ? 1.25 : 1.0;
    const modifiedRatio = ratio * nightFactor;
    if (modifiedRatio > 1.0) {
      targetSurge = parseFloat(Math.min(1.5, 1.0 + (modifiedRatio - 1.0) * 0.35).toFixed(2));
    }
    setDynamicSurgeMultiplier(targetSurge);
  }, [drivers, activeRide, demandHotspots, isNightMode]);

  // Web Audio Synth Cue
  const playSound = (type) => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (type === 'sos') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        const now = ctx.currentTime;
        // Alternating high and low emergency siren warble
        osc.frequency.setValueAtTime(960, now);
        osc.frequency.setValueAtTime(1200, now + 0.15);
        osc.frequency.setValueAtTime(960, now + 0.3);
        osc.frequency.setValueAtTime(1200, now + 0.45);
        osc.frequency.setValueAtTime(960, now + 0.6);
        osc.frequency.setValueAtTime(1200, now + 0.75);
        
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
        
        osc.start();
        osc.stop(now + 1.0);
      } else if (type === 'match') {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc1.type = 'sine';
        osc2.type = 'sine';
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        
        const now = ctx.currentTime;
        // Harmonized pleasant chord double bell chimes (E5/G#5 -> A5/C#6)
        osc1.frequency.setValueAtTime(659.25, now);
        osc2.frequency.setValueAtTime(830.61, now);
        
        osc1.frequency.setValueAtTime(880.00, now + 0.15);
        osc2.frequency.setValueAtTime(1109.73, now + 0.15);
        
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        
        osc1.start();
        osc2.start();
        osc1.stop(now + 0.6);
        osc2.stop(now + 0.6);
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
      } else if (type === 'siren') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        const now = ctx.currentTime;
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.linearRampToValueAtTime(1000, now + 0.35);
        osc.frequency.linearRampToValueAtTime(600, now + 0.7);
        
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.linearRampToValueAtTime(0.06, now + 0.6);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
        
        osc.start();
        osc.stop(now + 0.75);
      } else if (type === 'filter') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        const now = ctx.currentTime;
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.15);
        
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        
        osc.start();
        osc.stop(now + 0.18);
      } else if (type === 'payout') {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc1.type = 'sine';
        osc2.type = 'sine';
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        
        const now = ctx.currentTime;
        osc1.frequency.setValueAtTime(1046.50, now); 
        osc1.frequency.setValueAtTime(1318.51, now + 0.12); 
        
        osc2.frequency.setValueAtTime(1567.98, now + 0.24); 
        
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.setValueAtTime(0.06, now + 0.24);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        
        osc1.start();
        osc2.start();
        osc1.stop(now + 0.5);
        osc2.stop(now + 0.5);
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
    const newLog = {
      id: Date.now(),
      sender,
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setActiveSmsToast(newLog);
    setSmsLogs(prev => [newLog, ...prev].slice(0, 50));
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
        case 'incoming_call':
          setCallState('ringing');
          setCallFrom(data.fromRole);
          setCallPartner({ id: data.fromId, role: data.fromRole, name: data.fromName });
          playSound('match'); // Ring tone simulated sound
          break;
        case 'call_accepted':
          setCallState('connected');
          startCallTimer();
          setupPeerConnection('driver', data.fromId, true);
          break;
        case 'webrtc_signal':
          handleIncomingWebrtcSignal(data);
          break;
        case 'call_ended':
          cleanupCall();
          break;
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
        case 'geofence_zones_updated':
          setGeofencingZones(data.zones);
          break;
        case 'settings_updated':
          setSettings(data.settings);
          setFuelPrices(data.fuelPrices);
          setCongestionZones(data.congestionZones);
          if (data.activeScheduledSurge !== undefined) {
            setActiveScheduledSurge(data.activeScheduledSurge);
          }
          break;
        case 'drivers_updated':
          setDrivers(data.drivers);
          break;
        case 'blockages_updated':
          setBlockages(data.blockages);
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
        case 'incoming_call':
          setCallState('ringing');
          setCallFrom(data.fromRole);
          setCallPartner({ id: data.fromId, role: data.fromRole, name: data.fromName });
          playSound('match');
          break;
        case 'call_accepted':
          setCallState('connected');
          startCallTimer();
          setupPeerConnection('passenger', data.fromId, true);
          break;
        case 'webrtc_signal':
          handleIncomingWebrtcSignal(data);
          break;
        case 'call_ended':
          cleanupCall();
          break;
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
        case 'predictive_dispatch':
          triggerSmsToast(`AI ROUTING PRE-ALLOCATION: Demand is spiking at ${data.hotspotName}. Navigate there to unlock 1.5x surge multipliers!`, '🤖 JoldiGo AI Dispatch');
          addLog(`AI pre-allocation recommendation received: Proceed to ${data.hotspotName} hotspot.`, 'info');
          break;
        case 'system_broadcast':
          triggerSmsToast(data.message, '⚠️ JoldiGo Control Room');
          break;
        case 'geofence_zones_updated':
          setGeofencingZones(data.zones);
          break;
        case 'settings_updated':
          setSettings(data.settings);
          setFuelPrices(data.fuelPrices);
          setCongestionZones(data.congestionZones);
          if (data.activeScheduledSurge !== undefined) {
            setActiveScheduledSurge(data.activeScheduledSurge);
          }
          break;
        case 'drivers_updated':
          setDrivers(data.drivers);
          break;
        case 'blockages_updated':
          setBlockages(data.blockages);
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
        case 'geofence_zones_updated':
          setGeofencingZones(data.zones);
          break;
        case 'fraud_alerts_updated':
          setFraudAlerts(data.alerts);
          playSound('sos');
          break;
        case 'blockages_updated':
          setBlockages(data.blockages);
          break;
        case 'predictive_guide_line':
          setPredictiveGuides(prev => [...prev, {
            driverId: data.driverId,
            hotspotName: data.hotspotName,
            lat: data.lat,
            lng: data.lng,
            timestamp: Date.now()
          }]);
          break;
        case 'demand_updated':
          fetchInitialData();
          break;
        case 'settings_updated':
          setSettings(data.settings);
          setFuelPrices(data.fuelPrices);
          setCongestionZones(data.congestionZones);
          if (data.activeScheduledSurge !== undefined) {
            setActiveScheduledSurge(data.activeScheduledSurge);
          }
          break;
        case 'drivers_updated':
          setDrivers(data.drivers);
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
        setPassenger(prev => ({ ...prev, name: data.passenger.name || prev.name || 'Passenger', rideHistory: data.rideHistory }));
      }
    } catch (err) {
      console.warn("Failed to reload profile.");
    }
  };

  const refreshPassengersList = async () => {
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/admin/passengers`);
      const data = await res.json();
      if (data.success) {
        setPassengersList(data.passengers);
      }
    } catch (err) {
      console.warn("Failed to load passengers list.", err);
    }
  };

  // --- CLIENT ACTIONS BINDINGS ---

  const watchIdRef = useRef(null);
  const [isGpsActive, setIsGpsActive] = useState(false);

  const startGpsTracking = async (driverId) => {
    if (watchIdRef.current) return;
    
    const isCapacitor = typeof window !== 'undefined' && !!window.Capacitor;
    
    if (isCapacitor) {
      try {
        const { Geolocation } = await import('@capacitor/geolocation');
        const perm = await Geolocation.requestPermissions();
        if (perm.location !== 'granted') {
          alert("Location permission denied. Please allow location access in your device Settings.");
          return;
        }
        
        setIsGpsActive(true);
        const watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
          (position, err) => {
            if (err) {
              console.error("Capacitor GPS Error:", err);
              return;
            }
            if (!position) return;
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
          }
        );
        
        watchIdRef.current = watchId;
        addLog(`🛰️ Capacitor GPS watch active for Captain ${driverId}`, 'success');
        return;
      } catch (err) {
        console.error("Capacitor Geolocation error, falling back to browser API...", err);
      }
    }
    
    // Browser Geolocation fallback
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
        console.error("Browser GPS Tracking Error:", err);
      },
      { enableHighAccuracy: true, maximumAge: 0 }
    );
    
    watchIdRef.current = watchId;
    addLog(`🛰️ Browser Geolocation enabled for Captain ${driverId}`, 'success');
  };
 
  const stopGpsTracking = async () => {
    if (watchIdRef.current !== null) {
      const isCapacitor = typeof window !== 'undefined' && !!window.Capacitor;
      if (isCapacitor) {
        try {
          const { Geolocation } = await import('@capacitor/geolocation');
          await Geolocation.clearWatch({ id: watchIdRef.current });
        } catch (err) {
          console.error("Failed to clear Capacitor GPS watch:", err);
        }
      } else {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
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
        if (data.sentRealSms) {
          triggerSmsToast(`SMS OTP sent to +91 ${phone}. Please enter verification code.`, '💬 JoldiGo OTP Gateway');
        } else {
          triggerSmsToast(`JoldiGo Secure OTP: ${data.otpFallback}. Valid for 5 minutes. Do not share this code.`, '💬 JoldiGo OTP Gateway');
        }
        return data.otpFallback;
      }
    } catch (err) {
      console.warn("Offline OTP dispatcher fallback.", err);
      triggerSmsToast(`JoldiGo Secure OTP: 1234. Valid for 5 minutes. (Offline Fallback)`);
      return '1234';
    }
  };

  const loginPassenger = async (phone, otp, name) => {
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, name })
      });
      const data = await res.json();
      if (data.success) {
        setPassenger({ phone, name: data.passenger.name || name || 'Passenger', isLoggedIn: true, rideHistory: [] });
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
        setPassenger({ phone, name: name || 'Passenger', isLoggedIn: true, rideHistory: [] });
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

    let fuelSurchargePct = 0;
    if (isCarAC) {
      const diff = Math.max(0, fuelPrices.petrol - 100.00);
      fuelSurchargePct = Math.round((diff / 5.0) * 3.0 * 10) / 10;
    } else if (isCarNonAC) {
      const diff = Math.max(0, fuelPrices.diesel - 90.00);
      fuelSurchargePct = Math.round((diff / 5.0) * 2.5 * 10) / 10;
    } else {
      const diff = Math.max(0, fuelPrices.cng - 90.00);
      fuelSurchargePct = Math.round((diff / 5.0) * 2.0 * 10) / 10;
    }
    const finalFareBeforeSurge = baseRideFareBeforeSurge * (1 + fuelSurchargePct / 100);
    
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
    else if (settings.weather === 'waterlogged' || settings.weather === 'flooding') weatherMultiplier = 1.25;

    const baseSurge = isNightMode ? 1.20 : 1.00;
    
    // Geofencing Surge Zones checks
    let geofenceSurgeMultiplier = 1.0;
    if (pickup && dropoff) {
      geofencingZones.forEach(zone => {
        if (zone.active && zone.type === 'surge') {
          const isPickupInZone = isPointInZone(pickup, zone.points);
          const isDropoffInZone = isPointInZone(dropoff, zone.points);
          if (isPickupInZone || isDropoffInZone) {
            geofenceSurgeMultiplier = Math.max(geofenceSurgeMultiplier, zone.multiplier);
          }
        }
      });
    }

    const activeAdminSurge = useAiSurgeEngine ? dynamicSurgeMultiplier : settings.surgeMultiplier;
    const finalSurgeMultiplier = parseFloat(Math.min(2.50, Math.max(baseSurge, activeAdminSurge) * trafficMultiplier * weatherMultiplier * geofenceSurgeMultiplier).toFixed(2));
    const grossBaseRideFare = parseFloat((finalFareBeforeSurge * finalSurgeMultiplier).toFixed(2));
    
    const gstAmount = parseFloat((grossBaseRideFare * 0.05).toFixed(2));
    const commission = parseFloat((grossBaseRideFare * 0.05).toFixed(2));
    const driverPayout = parseFloat((grossBaseRideFare * 0.95).toFixed(2));
    const tollEstimate = distance > 8 ? 35 : 0;
    const insurancePremium = 2.00; 
    
    const totalFare = ((settings.weather === 'waterlogged' || settings.weather === 'flooding') && vehicleType === 'bike')
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

    // Geofencing active ban zones check
    if (pickup && dropoff) {
      for (const zone of geofencingZones) {
        if (zone.active && zone.type === 'ban') {
          const isPickupInZone = isPointInZone(pickup, zone.points);
          const isDropoffInZone = isPointInZone(dropoff, zone.points);
          if (isPickupInZone || isDropoffInZone) {
            alert(`Booking Rejected: The location falls inside a restricted security geofence: "${zone.name}". Service is temporarily suspended in this sector.`);
            return;
          }
        }
      }
    }

    const dist = calculateDistance(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
    const fareDetails = calculateDetailedFare(dist, vehicleType, pickup, dropoff);

    const netPassengerFare = Math.max(20, parseFloat((fareDetails.totalFare - discountApplied).toFixed(2)));

    if (paymentMethod === 'wallet' && passengerWalletBalance < netPassengerFare) {
      alert(`Insufficient Balance: You need ₹${netPassengerFare} to book this ride.`);
      return;
    }

    let availableDrivers = drivers.filter(d => d.status === 'online' && d.verificationStatus === 'verified' && d.vehicleType === vehicleType);
    if (availableDrivers.length === 0) {
      console.log(`No active online drivers of type ${vehicleType}. Generating virtual fallback driver...`);
      const virtualDriver = {
        id: 'driver_virtual_' + vehicleType,
        name: vehicleType === 'bike' ? 'Captain Joydev (Bike)' : (vehicleType === 'auto' ? 'Captain Subrata (Auto)' : 'Captain Bikram (Car)'),
        phone: '+91 9830012345',
        vehicleType: vehicleType,
        vehicleNumber: vehicleType === 'bike' ? 'WB-02-B-9988' : (vehicleType === 'auto' ? 'WB-04-A-1122' : 'WB-20-C-5566'),
        rating: 4.8,
        status: 'online',
        verificationStatus: 'verified',
        location: { lat: pickup.lat + 0.005, lng: pickup.lng - 0.004 }
      };
      
      // Update local state temporarily
      setDrivers(prev => [...prev.filter(d => d.id !== virtualDriver.id), virtualDriver]);
      availableDrivers = [virtualDriver];
    }

    // Calculate match scores for all available drivers (Proximity: 40%, Acceptance: 40%, Cancellation: 20%)
    const scoredQueue = availableDrivers.map(drv => {
      const d = calculateDistance(pickup.lat, pickup.lng, drv.location.lat, drv.location.lng);
      const distScore = Math.max(0, 10 - d) / 10;
      const acceptance = drv.acceptanceRate || (drv.id === 'drv_1' ? 98 : (drv.id === 'drv_2' ? 88 : 78));
      const cancellations = drv.cancellationRate || (drv.id === 'drv_1' ? 2 : (drv.id === 'drv_2' ? 5 : 12));
      const accScore = acceptance / 100;
      const cancScore = (100 - cancellations) / 100;
      const matchScore = Math.round((distScore * 0.4 + accScore * 0.4 + cancScore * 0.2) * 100);
      return {
        ...drv,
        distanceToPickup: d,
        matchScore,
        acceptanceRate: acceptance,
        cancellationRate: cancellations
      };
    }).sort((a, b) => b.matchScore - a.matchScore);

    setDispatchQueueLog(scoredQueue);

    let closestDriver = scoredQueue[0];
    let minD = closestDriver.distanceToPickup;

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

    const pickupRoute = await getRouteCoordinates(driver.location, activeRide.pickup, settings.weather === 'waterlogged' || settings.weather === 'flooding');

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
    const encounteredBlockages = new Set();
    simulationIntervalRef.current = setInterval(() => {
      idx++;
      if (idx >= pathCoords.length) {
        clearInterval(simulationIntervalRef.current);
        const finalLoc = pathCoords[pathCoords.length - 1];
        
        // Push final GPS update via WebSockets to synchronize DB
        const ws = driverSocketsRef.current[driverId];
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ 
            type: 'driver_location_update', 
            location: finalLoc,
            speed: 0,
            abruptBraking: false,
            isDeviated: false
          }));
        }

        if (stage === 'pickup') {
          setActiveRide(prev => {
            if (!prev) return null;
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'update_ride_status', rideId: prev.id, status: 'arrived', passengerPhone: prev.passengerPhone }));
            }
            return { ...prev, status: 'arrived', location: finalLoc, speed: 0, abruptBraking: false, isDeviated: false };
          });
        } else if (stage === 'trip') {
          setActiveRide(prev => {
            if (!prev) return null;
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'update_ride_status', rideId: prev.id, status: 'completed', passengerPhone: prev.passengerPhone }));
            }
            return { ...prev, status: 'completed', location: finalLoc, speed: 0, abruptBraking: false, isDeviated: false };
          });
        }
      } else {
        const nextLoc = pathCoords[idx];
        setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, location: nextLoc } : d));
        
        // Check if approaching any active road blockages / hazards
        const activeBlockage = blockages.find(b => {
          if (encounteredBlockages.has(b.id)) return false;
          const distKm = calculateDistance(nextLoc.lat, nextLoc.lng, b.lat, b.lng);
          return distKm * 1000 <= b.radius;
        });

        let blockageBraking = false;
        let blockageDeviated = false;

        if (activeBlockage) {
          encounteredBlockages.add(activeBlockage.id);
          playSound('filter');
          addLog(`⚠️ [Telemetry Alert] Captain Rajesh Kumar encountered a roadblock (${activeBlockage.description || 'Hazard'}) near [${activeBlockage.lat.toFixed(4)}, ${activeBlockage.lng.toFixed(4)}]! Initiating emergency detour recalculation.`, 'warning');
          
          blockageBraking = true;
          blockageDeviated = true;

          // Detour offset: shifts slightly north-east to bypass blockage
          const detourWaypoint = { lat: activeBlockage.lat + 0.0035, lng: activeBlockage.lng + 0.0035 };
          const endLoc = pathCoords[pathCoords.length - 1];
          getDetourCoordinates(nextLoc, endLoc, detourWaypoint).then(newRoute => {
            if (newRoute && newRoute.length > 0) {
              // Replace remaining pathCoords starting from idx + 1
              pathCoords.splice(idx + 1, pathCoords.length - (idx + 1), ...newRoute);
              addLog(`📡 Detour coordinates calculated. Path updated to bypass hazard zone.`, 'success');
            }
          });
        }

        // Calculate telemetry speed (km/h)
        const prevLoc = idx > 0 ? pathCoords[idx - 1] : nextLoc;
        const tickDist = calculateDistance(prevLoc.lat, prevLoc.lng, nextLoc.lat, nextLoc.lng); // in km
        const timeHours = (simulationSpeed / 1000) / 3600; // time in hours
        let currentSpeed = timeHours > 0 ? Math.round(tickDist / timeHours) : 0;
        
        const trafficLvl = congestionZones.SALT_LAKE_SEC5 || 'medium';
        const maxSpeed = trafficLvl === 'heavy' ? 25 : (trafficLvl === 'medium' ? 45 : 68);
        
        if (currentSpeed > maxSpeed) currentSpeed = maxSpeed;
        if (currentSpeed === 0 && idx > 0) {
          currentSpeed = Math.floor(Math.random() * 10) + (trafficLvl === 'heavy' ? 12 : 36);
        }
        
        // Randomly simulate abrupt braking or deviation for testing telemetry
        const normalBraking = idx > 0 && idx % 7 === 0 && currentSpeed > 32;
        const normalDeviated = idx > 8 && idx < 13 && (driverId === 'drv_1');

        const abruptBraking = normalBraking || blockageBraking;
        const isDeviated = normalDeviated || blockageDeviated;

        if (abruptBraking) {
          currentSpeed = Math.max(5, currentSpeed - 24);
        }

        // Push coordinate tick via WebSockets
        const ws = driverSocketsRef.current[driverId];
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ 
            type: 'driver_location_update', 
            location: nextLoc,
            speed: currentSpeed,
            abruptBraking,
            isDeviated
          }));
        }

        setActiveRide(prev => prev ? { 
          ...prev, 
          routeIndex: idx, 
          location: nextLoc,
          speed: currentSpeed,
          abruptBraking,
          isDeviated
        } : null);
      }
    }, simulationSpeed);
  };

  const startRide = async () => {
    if (!activeRide || activeRide.status !== 'arrived') return;

    const ws = driverSocketsRef.current[activeRide.driverId];
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'update_ride_status', rideId: activeRide.id, status: 'in_progress', passengerPhone: activeRide.passengerPhone }));
    }

    const tripRoute = await getRouteCoordinates(activeRide.pickup, activeRide.dropoff, settings.weather === 'waterlogged' || settings.weather === 'flooding');

    setActiveRide(prev => {
      if (!prev) return null;
      animateDriverMovement(prev.driverId, tripRoute, 'trip');
      return { ...prev, status: 'in_progress', route: tripRoute, routeIndex: 0 };
    });
  };

  const completePaymentAndRate = async (rating, comment = '', tipAmount = 0) => {
    if (!activeRide || activeRide.status !== 'completed') return;
    
    try {
      const { api } = getServerEndpoints();
      await fetch(`${api}/api/ride/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideId: activeRide.id,
          rating: parseFloat(rating || 5),
          comment: comment || '',
          tipAmount: parseFloat(tipAmount || 0)
        })
      });
      
      if (tipAmount > 0) {
        addLog(`Payment of ₹${activeRide.totalFare} & ₹${tipAmount} tip completed.`, 'success');
        triggerSmsToast(`JoldiGo Pay: ₹${tipAmount} tip successfully credited to your driver.`, 'JoldiGo Wallet');
      } else {
        addLog(`Payment of ₹${activeRide.totalFare} completed successfully.`, 'success');
      }
    } catch (e) {
      console.error("Failed to rate and tip", e);
    }

    playSound('payout');
    await refreshPassengerProfile(passenger.phone);
    setActiveRide(null);
  };

  const cancelRide = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
    setActiveRide(null);
  };

  const sendChatMessage = (sender, text, sourceLang = 'en', targetLang = 'bn') => {
    const translation = getChatTranslation(text, sourceLang, targetLang);
    const msgId = 'msg_' + Date.now();
    const originalLang = sourceLang === 'bn' ? 'bn-IN' : (sourceLang === 'hi' ? 'hi-IN' : 'en-US');
    const translationLang = targetLang === 'bn' ? 'bn-IN' : (targetLang === 'hi' ? 'hi-IN' : 'en-US');

    const message = {
      id: msgId, 
      sender, 
      text, 
      translation,
      originalLang,
      translationLang,
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
          translation,
          originalLang,
          translationLang
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

  const triggerPassengerSOS = (passengerPhone) => {
    if (!activeRide) return;

    playSound('sos');

    // Notify control room via active passenger socket
    const ws = passengerSocketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'sos_alert',
        rideId: activeRide.id,
        driverId: activeRide.driverId,
        location: activeRide.driverId ? (drivers.find(d => d.id === activeRide.driverId)?.location || { lat: 22.5726, lng: 88.3639 }) : { lat: 22.5726, lng: 88.3639 }
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
    playSound('sos');

    let idx = 0;
    const dispatchInterval = setInterval(() => {
      idx++;
      playSound('siren');
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

  const enrollDriver = async (enrollData) => {
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/driver/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enrollData)
      });
      const data = await res.json();
      if (data.success) {
        addLog(`Driver registration submitted successfully! Awaiting admin verification.`, 'success');
        fetchInitialData();
        return data.driver;
      } else {
        alert(data.error || 'Failed to submit driver enrollment.');
        return null;
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to backend enrollment service.');
      return null;
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

  const verifyDriverDoc = async (driverId, documentType, approve) => {
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/admin/driver/verify-doc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, documentType, approve })
      });
      const data = await res.json();
      if (data.success) {
        addLog(`Document verification updated successfully!`, 'success');
        triggerSmsToast(`WhatsApp Alert: Your document (${documentType.toUpperCase()}) has been ${approve ? 'APPROVED ✅' : 'REJECTED ❌'} by JoldiGo Admin.`, 'WhatsApp Notification');
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

  const updateFuelPrices = async (newFuelPrices) => {
    try {
      const { api } = getServerEndpoints();
      await fetch(`${api}/api/admin/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fuelPrices: newFuelPrices })
      });
      fetchInitialData();
    } catch (err) {
      console.error(err);
    }
  };

  const addCustomHotspot = async (lat, lng, weight = 0.8) => {
    try {
      const { api } = getServerEndpoints();
      await fetch(`${api}/api/admin/demand/hotspots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotspot: { lat, lng, weight } })
      });
      const hotspotsRes = await fetch(`${api}/api/admin/demand/hotspots`);
      const hotspotsData = await hotspotsRes.json();
      if (hotspotsData.success) {
        setDemandHotspots(hotspotsData.hotspots);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resetSimulator = async () => {
    try {
      const { api } = getServerEndpoints();
      await fetch(`${api}/api/admin/reset`, { method: 'POST' });
      fetchInitialData();
      setPassengerWalletBalance(500.00);
      setSmsLogs([]);
      setSimulationSpeed(400);
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
    return { 
      databaseUrl: '', 
      twilioSid: '', 
      twilioAuthToken: '', 
      twilioPhoneNumber: '', 
      razorpayKeyId: '', 
      razorpayKeySecret: '',
      googleMapsKeyWeb: '',
      googleMapsKeyAndroid: '',
      googleMapsKeyIos: '',
      pricingEngineUrl: '',
      pricingEngineApiKey: ''
    };
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

  const updateGeofencingZones = async (updatedZones) => {
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/admin/geofence/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zones: updatedZones })
      });
      const data = await res.json();
      if (data.success) {
        setGeofencingZones(data.zones);
        addLog("Geofencing operational zones updated and synchronized.", "info");
      }
    } catch (err) {
      console.error("Failed to update geofence zones:", err);
    }
  };

  const resolveFraudAlert = async (alertId, action) => {
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/admin/fraud/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action })
      });
      const data = await res.json();
      if (data.success) {
        setFraudAlerts(data.alerts);
        fetchInitialData();
        addLog(`Security Alert resolved: ${action.toUpperCase()}`, 'warning');
      }
    } catch (err) {
      console.error("Failed to resolve fraud alert:", err);
    }
  };

  const updateSurgeSchedules = async (updatedSchedules) => {
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/admin/surge/schedules/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules: updatedSchedules })
      });
      const data = await res.json();
      if (data.success) {
        setSurgeSchedules(data.schedules);
        addLog("Surge schedules updated and recalculated.", "success");
      }
    } catch (err) {
      console.error("Failed to update surge schedules:", err);
    }
  };

  const getFuelSurchargePercentage = (vehicleType) => {
    if (vehicleType === 'car_ac') {
      const diff = Math.max(0, fuelPrices.petrol - 100.00);
      return Math.round((diff / 5.0) * 3.0 * 10) / 10;
    } else if (vehicleType === 'car_non_ac') {
      const diff = Math.max(0, fuelPrices.diesel - 90.00);
      return Math.round((diff / 5.0) * 2.5 * 10) / 10;
    } else {
      const diff = Math.max(0, fuelPrices.cng - 90.00);
      return Math.round((diff / 5.0) * 2.0 * 10) / 10;
    }
  };

  return (
    <SimulatorContext.Provider
      value={{
        drivers,
        geofence,
        geofencingZones,
        updateGeofencingZones,
        fraudAlerts,
        resolveFraudAlert,
        surgeSchedules,
        activeScheduledSurge,
        updateSurgeSchedules,
        demandHotspots,
        predictiveGuides,
        setPredictiveGuides,
        getFuelSurchargePercentage,
        getChatTranslation,
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
        adminStats,
        setAdminStats,
        isNightMode,
        setIsNightMode,
        mapStyle,
        setMapStyle,
        passengerWalletBalance,
        topUpPassengerWallet,
        sendChatMessage,
        loginPassenger,
        logoutPassenger,
        toggleDriverStatus,
        uploadDriverDocs,
        enrollDriver,
        verifyDriverStatus,
        verifyDriverDoc,
        payoutDriver,
        broadcastNotification,
        updateSettings,
        updateFuelPrices,
        updateGeofence: setGeofence,
        bookRide,
        rejectRide,
        acceptRide,
        startRide,
        completePaymentAndRate,
        cancelRide,
        triggerSOS,
        triggerPassengerSOS,
        resolveSOS,
        addLog,
        fileDispute,
        uploadDisputeEvidence,
        resolveDispute,
        fastForwardDisputeSla: () => {},
        calculateDetailedFare,
        congestionZones,
        promos,
        setPromos,
        blockages,
        setBlockages,
        fetchInitialData,
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
        callState,
        callFrom,
        callPartner,
        callDuration,
        initiateCall,
        acceptCall,
        endCall,
        sendOtpRequest,
        startGpsTracking,
        stopGpsTracking,
        isGpsActive,
        fetchEnvKeys,
        updateEnvKeys,
        smsLogs,
        simulationSpeed,
        setSimulationSpeed,
        addCustomHotspot,
        resetSimulator,
        passengersList,
        refreshPassengersList,
        useAiSurgeEngine,
        setUseAiSurgeEngine,
        dynamicSurgeMultiplier,
        dispatchQueueLog,
        setDispatchQueueLog
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
