import React, { useState, useEffect, useRef } from 'react';
import { useSimulator, calculateDistance, getServerEndpoints } from '../context/SimulatorContext';
import { 
  ShieldAlert, 
  MapPin, 
  Navigation, 
  Coins, 
  AlertOctagon, 
  UserCheck, 
  Upload, 
  ToggleLeft, 
  ToggleRight, 
  Phone,
  PhoneOff,
  Power,
  Camera,
  Volume2,
  FileSpreadsheet,
  MessageSquare,
  Send
} from 'lucide-react';
import L from 'leaflet';

const RainOverlay = ({ weather }) => {
  if (!weather || weather === 'clear') return null;
  const dropCount = weather === 'waterlogged' ? 40 : 20;
  const drops = Array.from({ length: dropCount }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 0.5 + Math.random() * 0.7
  }));

  return (
    <div className={`rain-overlay ${weather === 'waterlogged' ? 'waterlogged' : ''}`}>
      {drops.map(d => (
        <div 
          key={d.id} 
          className="rain-drop" 
          style={{ 
            left: `${d.left}%`, 
            animationDelay: `${d.delay}s`, 
            animationDuration: `${d.duration}s` 
          }} 
        />
      ))}
      {weather === 'waterlogged' && <div className="waterlogging-flood-bar"></div>}
    </div>
  );
};

export default function DriverApp({ isStandalone }) {
  const {
    drivers,
    settings,
    activeRide,
    logs,
    disputes,
    chatMessages,
    sendChatMessage,
    toggleDriverStatus,
    uploadDriverDocs,
    acceptRide,
    rejectRide,
    startRide,
    triggerSOS,
    uploadDisputeEvidence,
    safetyClaims,
    fileSafetyClaim,
    insuranceReservePool,
    connectDriverSocket,
    startGpsTracking,
    stopGpsTracking,
    isGpsActive,
    demandHotspots,
    mapStyle,
    setMapStyle,
    callState,
    callFrom,
    callPartner,
    callDuration,
    initiateCall,
    acceptCall,
    endCall,
    enrollDriver
  } = useSimulator();

  const speakText = (text, langCode) => {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode || 'en-US';
      console.log(`[TTS Speech] Speaking: "${text}" in ${utterance.lang}`);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Text-to-speech failed:", e);
    }
  };

  // Active Simulated Driver
  const [selectedDriverId, setSelectedDriverId] = useState('drv_1');
  const [tab, setTab] = useState('dashboard');

  useEffect(() => {
    const currentDrv = drivers.find(d => d.id === selectedDriverId);
    if (currentDrv && currentDrv.status === 'online') {
      connectDriverSocket(selectedDriverId);
    }
  }, [selectedDriverId, drivers]);
  
  // Onboarding Inputs
  const [licenseInput, setLicenseInput] = useState('');
  const [aadharInput, setAadharInput] = useState('');
  const [rcInput, setRcInput] = useState('');

  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollForm, setEnrollForm] = useState({
    name: '',
    phone: '',
    vehicleType: 'car_ac',
    vehicleName: '',
    vehicleNumber: '',
    licenseNumber: '',
    aadharNumber: '',
    rcNumber: ''
  });

  const handleEnrollSubmit = async (e) => {
    e.preventDefault();
    if (!enrollForm.name || !enrollForm.phone || !enrollForm.vehicleName || !enrollForm.vehicleNumber || !enrollForm.licenseNumber || !enrollForm.aadharNumber || !enrollForm.rcNumber) {
      alert('Please fill out all enrollment fields.');
      return;
    }
    const newDrv = await enrollDriver(enrollForm);
    if (newDrv) {
      setSelectedDriverId(newDrv.id);
      setIsEnrolling(false);
      setEnrollForm({
        name: '',
        phone: '',
        vehicleType: 'car_ac',
        vehicleName: '',
        vehicleNumber: '',
        licenseNumber: '',
        aadharNumber: '',
        rcNumber: ''
      });
    }
  };

  const currentDriver = drivers.find((d) => d.id === selectedDriverId) || drivers[0];

  // Chat Panel State
  const [showChat, setShowChat] = useState(false);
  const [chatInputText, setChatInputText] = useState('');
  const [simulatedSpeed, setSimulatedSpeed] = useState(0);

  const isNavActive = activeRide && activeRide.driverId === currentDriver.id && (activeRide.status === 'accepted' || activeRide.status === 'arrived' || activeRide.status === 'in_progress');

  useEffect(() => {
    if (!isNavActive || activeRide?.status === 'arrived') {
      setSimulatedSpeed(0);
      return;
    }
    setSimulatedSpeed(Math.floor(35 + Math.random() * 10));
    const interval = setInterval(() => {
      setSimulatedSpeed(Math.floor(38 + Math.random() * 12));
    }, 1500);
    return () => clearInterval(interval);
  }, [isNavActive, activeRide?.status]);
  const chatEndRef = useRef(null);

  // Safety Pool Claim forms UI
  const [claimType, setClaimType] = useState('health');
  const [claimAmount, setClaimAmount] = useState(150);
  const [claimDesc, setClaimDesc] = useState('');

  // Completed Ride History State
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Heatmap Toggle State
  const [showHeatmap, setShowHeatmap] = useState(true);

  // Driver Subscription states
  const [subTier, setSubTier] = useState('free');
  const [subExpires, setSubExpires] = useState(null);
  const [loadingSub, setLoadingSub] = useState(false);

  const fetchSubscription = async () => {
    if (!selectedDriverId) return;
    setLoadingSub(true);
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/driver/subscription?driverId=${selectedDriverId}`);
      const data = await res.json();
      if (data.success) {
        setSubTier(data.tier);
        setSubExpires(data.expiresAt);
      }
    } catch (err) {
      console.error("Failed to load driver subscription details:", err);
    } finally {
      setLoadingSub(false);
    }
  };

  useEffect(() => {
    if (selectedDriverId) {
      fetchSubscription();
    }
  }, [tab, selectedDriverId]);

  const handleUpgradeSubscription = async (tierVal) => {
    setLoadingSub(true);
    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/driver/subscription/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: selectedDriverId, tier: tierVal })
      });
      const data = await res.json();
      if (data.success) {
        setSubTier(data.tier);
        setSubExpires(data.expiresAt);
        alert(`🎉 Successfully upgraded driver subscription to ${tierVal.toUpperCase()} tier!`);
      }
    } catch (err) {
      console.error("Failed to upgrade driver subscription:", err);
    } finally {
      setLoadingSub(false);
    }
  };

  useEffect(() => {
    if (tab !== 'history' || !selectedDriverId) return;
    
    let active = true;
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const { api } = getServerEndpoints();
        const res = await fetch(`${api}/api/driver/history?driverId=${selectedDriverId}`);
        const data = await res.json();
        if (data.success && active) {
          setHistory(data.history);
        }
      } catch (err) {
        console.error("Failed to load driver history:", err);
      } finally {
        if (active) setLoadingHistory(false);
      }
    };
    
    fetchHistory();
    return () => { active = false; };
  }, [tab, selectedDriverId, activeRide?.status]);

  // Map elements
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersRef = useRef({
    driver: null,
    pickup: null,
    dropoff: null,
    routeLine: null,
    heatmapCircles: []
  });

  // Scroll chat drawer to bottom on new messages
  useEffect(() => {
    if (showChat && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

  // Close chat when ride finishes
  useEffect(() => {
    if (!activeRide) {
      setShowChat(false);
    }
  }, [activeRide]);

  // Leaflet Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current || !currentDriver) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([currentDriver.location.lat, currentDriver.location.lng], 13);

    const MAP_TILE_URLS = {
      google_roadmap: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      google_satellite: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      voyager: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      dark_navigation: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    };

    const tileLayer = L.tileLayer(MAP_TILE_URLS[mapStyle] || MAP_TILE_URLS.dark_navigation, {
      maxZoom: 19,
      attribution: mapStyle.startsWith('google') ? '&copy; Google Maps' : '&copy; CartoDB/Mapbox'
    }).addTo(map);

    tileLayerRef.current = tileLayer;
    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [selectedDriverId, currentDriver?.verificationStatus, currentDriver?.status]);

  useEffect(() => {
    if (tileLayerRef.current) {
      const MAP_TILE_URLS = {
        google_roadmap: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        google_satellite: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        voyager: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        dark_navigation: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      };
      tileLayerRef.current.setUrl(MAP_TILE_URLS[mapStyle]);
    }
  }, [mapStyle]);

  // Update map markers reactively
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentDriver) return;

    if (markersRef.current.driver) map.removeLayer(markersRef.current.driver);
    if (markersRef.current.pickup) map.removeLayer(markersRef.current.pickup);
    if (markersRef.current.dropoff) map.removeLayer(markersRef.current.dropoff);
    if (markersRef.current.traveledPolyline) {
      map.removeLayer(markersRef.current.traveledPolyline);
      markersRef.current.traveledPolyline = null;
    }
    if (markersRef.current.remainingPolyline) {
      map.removeLayer(markersRef.current.remainingPolyline);
      markersRef.current.remainingPolyline = null;
    }

    if (markersRef.current.heatmapCircles) {
      markersRef.current.heatmapCircles.forEach(c => map.removeLayer(c));
      markersRef.current.heatmapCircles = [];
    }

    if (showHeatmap && demandHotspots) {
      markersRef.current.heatmapCircles = demandHotspots.map(spot => {
        return L.circle([spot.lat, spot.lng], {
          color: '#ff3333',
          fillColor: '#ff3333',
          fillOpacity: 0.15,
          radius: spot.weight * 300,
          weight: 1.5,
          dashArray: '3, 6'
        }).addTo(map);
      });
    }

    const driverIcon = L.divIcon({
      className: 'custom-map-marker driver-self-marker-pulsing',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
          <div style="position: absolute; width: 32px; height: 32px; background-color: rgba(37, 99, 235, 0.25); border-radius: 50%; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: absolute; width: 20px; height: 20px; background-color: #2563eb; border: 2px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">
            <span style="font-size: 8px; color: #ffffff; transform: rotate(0deg); display: inline-block;">▲</span>
          </div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    const pickupIcon = L.divIcon({
      className: 'custom-map-marker',
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div style="background-color: #16a34a; color: #ffffff; font-size: 7px; font-weight: 900; padding: 2px 4px; border-radius: 4px; border: 1px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.3); text-transform: uppercase; margin-bottom: 2px; font-family: sans-serif;">PICKUP</div>
          <div style="width: 12px; height: 12px; background-color: #16a34a; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
            <div style="width: 4px; height: 4px; background-color: #ffffff; border-radius: 50%;"></div>
          </div>
        </div>
      `,
      iconSize: [50, 30],
      iconAnchor: [25, 25]
    });

    const dropoffIcon = L.divIcon({
      className: 'custom-map-marker',
      html: `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div style="background-color: #dc2626; color: #ffffff; font-size: 7px; font-weight: 900; padding: 2px 4px; border-radius: 4px; border: 1px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.3); text-transform: uppercase; margin-bottom: 2px; font-family: sans-serif;">DROP</div>
          <div style="width: 12px; height: 12px; background-color: #dc2626; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
            <div style="width: 4px; height: 4px; background-color: #ffffff; border-radius: 50%;"></div>
          </div>
        </div>
      `,
      iconSize: [50, 30],
      iconAnchor: [25, 25]
    });

    markersRef.current.driver = L.marker([currentDriver.location.lat, currentDriver.location.lng], { icon: driverIcon }).addTo(map);
    map.panTo([currentDriver.location.lat, currentDriver.location.lng]);

    const isThisDriverAssigned = activeRide && activeRide.driverId === currentDriver.id;
    if (isThisDriverAssigned && activeRide.status !== 'searching') {
      markersRef.current.pickup = L.marker([activeRide.pickup.lat, activeRide.pickup.lng], { icon: pickupIcon }).addTo(map);
      markersRef.current.dropoff = L.marker([activeRide.dropoff.lat, activeRide.dropoff.lng], { icon: dropoffIcon }).addTo(map);

      // Draw route polylines (split trail: traveled grey vs remaining royal blue)
      if (activeRide.route) {
        const idx = activeRide.routeIndex || 0;
        const traveledCoords = activeRide.route.slice(0, idx + 1).map(p => [p.lat, p.lng]);
        const remainingCoords = activeRide.route.slice(idx).map(p => [p.lat, p.lng]);

        if (traveledCoords.length > 1) {
          markersRef.current.traveledPolyline = L.polyline(traveledCoords, {
            color: '#64748b',
            weight: 4,
            opacity: 0.5,
            dashArray: '5, 8'
          }).addTo(map);
        }

        if (remainingCoords.length > 0) {
          markersRef.current.remainingPolyline = L.polyline(remainingCoords, {
            color: '#2563eb',
            weight: 6,
            opacity: 0.95,
            lineJoin: 'round',
            lineCap: 'round',
            className: 'glowing-blue-route'
          }).addTo(map);
        }
      }
    }
  }, [activeRide, currentDriver, selectedDriverId, showHeatmap, demandHotspots]);

  // Handle doc upload form
  const handleOnboardingSubmit = (e) => {
    e.preventDefault();
    if (!licenseInput || !aadharInput || !rcInput || !currentDriver) {
      alert('Please fill out all document fields.');
      return;
    }
    uploadDriverDocs(currentDriver.id, {
      license: licenseInput,
      aadhar: aadharInput,
      rc: rcInput,
    });
    setLicenseInput('');
    setAadharInput('');
    setRcInput('');
  };

  // Chat message send handler
  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInputText.trim()) return;
    sendChatMessage('driver', chatInputText.trim());
    setChatInputText('');
  };

  // Driver Bengali quick replies templates
  const DRIVER_QUICK_REPLIES = [
    "আমি লোকেশনে পৌঁছে গেছি", // I have arrived at the location
    "ভীষণ জ্যাম আছে, একটু দেরি হবে", // Traffic is heavy, will be late
    "আমি আসছি", // I am coming
    "কোন রুট দিয়ে যাব?", // Which route should I take?
    "আমার কাছে খুচরো আছে", // I have cash change
    "আপনার ওটিপি টা বলুন" // Please tell me your OTP
  ];

  // Determine current active navigation details
  const getNavText = () => {
    if (!activeRide || !currentDriver || activeRide.driverId !== currentDriver.id) return '';
    if (activeRide.status === 'accepted') {
      return `Navigate to Pickup: ${activeRide.pickup.name}`;
    }
    if (activeRide.status === 'arrived') {
      return `Waiting for passenger at pickup point.`;
    }
    if (activeRide.status === 'in_progress') {
      return `Navigate to Destination: ${activeRide.dropoff.name}`;
    }
    if (activeRide.status === 'completed') {
      return `Trip Completed! Awaiting Passenger payment...`;
    }
    return '';
  };

  // Get disputes specific to this simulated driver
  const driverDisputes = disputes.filter(d => d.driverId === currentDriver?.id);

  const getVehicleLabel = (type) => {
    if (type === 'car_ac') return '4-Wheeler AC';
    if (type === 'car_non_ac') return '4-Wheeler Non-AC';
    return 'App Bike';
  };

  // Check if passenger sent a message recently while driver chat is closed
  const hasUnreadMessages = chatMessages.some(m => m.sender === 'passenger') && !showChat;

  if (!currentDriver) {
    return (
      <div className="driver-dashboard" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', backgroundColor: '#0d0d0d', color: '#888', padding: '24px', textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #ffdd00', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
        <h4 style={{ color: '#fff', margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>📡 Connecting to JoldiGo Backend Services</h4>
        <p style={{ margin: '0 0 16px 0', fontSize: '11px', lineHeight: '1.5' }}>
          Waiting for active driver profile. Make sure your local Express server is running on port 5001 or set the correct address in the Cockpit header.
        </p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const renderCallOverlay = () => {
    if (callState === 'idle') return null;

    const isInvolved = (callPartner?.role === 'passenger' && callFrom === 'driver') || 
                       (callPartner?.role === 'driver' && callPartner?.id === currentDriver.id);
                       
    if (!isInvolved) return null;

    const partnerName = callPartner?.name || 'Passenger Rider';
    const partnerRoleLabel = callPartner?.role === 'passenger' ? 'Jaldi Go Rider' : 'Jaldi Go Driver';

    const formatDuration = (sec) => {
      const m = String(Math.floor(sec / 60)).padStart(2, '0');
      const s = String(sec % 60).padStart(2, '0');
      return `${m}:${s}`;
    };

    return (
      <div 
        className="calling-screen-overlay"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle, #1a2235 0%, #080c14 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '40px 24px',
          color: '#fff',
          zIndex: 9999,
          fontFamily: 'Inter, system-ui, sans-serif'
        }}
      >
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px', color: '#ffdd00', fontWeight: 'bold', marginBottom: '8px' }}>
            📱 Jaldi Go Secure Call
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff' }}>{partnerName}</div>
          <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>{partnerRoleLabel}</div>
        </div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '40px 0' }}>
          <div 
            className="pulse-circle animate-pulse"
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 221, 0, 0.05)',
              border: '2px solid rgba(255, 221, 0, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div 
              style={{
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 221, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px'
              }}
            >
              👤
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          {callState === 'dialing' && (
            <div style={{ fontSize: '14px', color: '#a0aec0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="animate-pulse">●</span> Dialing rider...
            </div>
          )}
          {callState === 'ringing' && (
            <div style={{ fontSize: '14px', color: '#ffdd00', fontWeight: 'bold' }}>
              Incoming VoIP Call...
            </div>
          )}
          {callState === 'connected' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: '1px', color: '#00ff66' }}>
                {formatDuration(callDuration)}
              </div>
              <div style={{ fontSize: '10px', color: '#48bb78', textTransform: 'uppercase', letterSpacing: '1px' }}>
                ● Connected
              </div>
            </div>
          )}
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          {callState === 'ringing' ? (
            <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%', maxWidth: '240px' }}>
              <button 
                onClick={() => endCall('passenger', callPartner.id)}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#e53e3e',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(229, 62, 62, 0.4)'
                }}
              >
                <PhoneOff size={22} color="#fff" />
              </button>
              <button 
                onClick={() => acceptCall('passenger', callPartner.id)}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#48bb78',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(72, 187, 120, 0.4)'
                }}
              >
                <Phone size={22} color="#fff" />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '200px', opacity: 0.6 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '9px', gap: '4px' }}>
                  <button style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justify: 'center' }}>🎤</button>
                  Mute
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '9px', gap: '4px' }}>
                  <button style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justify: 'center' }}>🔢</button>
                  Keypad
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '9px', gap: '4px' }}>
                  <button style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justify: 'center' }}>🔊</button>
                  Speaker
                </div>
              </div>

              <button 
                onClick={() => endCall('passenger', callPartner?.id || activeRide?.passengerPhone)}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#e53e3e',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(229, 62, 62, 0.4)'
                }}
              >
                <PhoneOff size={22} color="#fff" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isEnrolling) {
    return (
      <div className="mobile-phone-frame driver-theme" style={{ position: 'relative' }}>
        {!isStandalone && <div className="phone-notch"></div>}
        
        <div className="phone-status-bar">
          <span className="phone-time">08:18</span>
          <div className="phone-icons">
            <span className="signal">📶</span>
            <span className="battery">🔋 87%</span>
          </div>
        </div>

        <div className="phone-screen-content app-screen-layout onboarding-screen" style={{ overflowY: 'auto', padding: '16px', boxSizing: 'border-box', height: 'calc(100% - 60px)', display: 'flex', flexDirection: 'column' }}>
          <div className="onboarding-header text-center mt-2 mb-4">
            <UserCheck size={36} className="text-yellow-400 mx-auto" />
            <h3 className="text-base font-bold text-white mt-1.5">Driver Partner Enrollment</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">Submit details to join Jaldi Go</p>
          </div>

          <form className="onboarding-form card-glow flex flex-col gap-3" onSubmit={handleEnrollSubmit} style={{ padding: '12px', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.2)' }}>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold">Full Name</label>
              <input 
                type="text" 
                placeholder="e.g. Subir Ganguly"
                value={enrollForm.name}
                onChange={e => setEnrollForm(prev => ({ ...prev, name: e.target.value }))}
                style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#fff', outline: 'none' }}
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold">Phone Number</label>
              <input 
                type="text" 
                placeholder="e.g. +91 98765 43210"
                value={enrollForm.phone}
                onChange={e => setEnrollForm(prev => ({ ...prev, phone: e.target.value }))}
                style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#fff', outline: 'none' }}
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold">Vehicle Type</label>
              <select 
                value={enrollForm.vehicleType}
                onChange={e => setEnrollForm(prev => ({ ...prev, vehicleType: e.target.value }))}
                style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#fff', outline: 'none', cursor: 'pointer' }}
              >
                <option value="car_ac">Car (Air Conditioned)</option>
                <option value="car_non_ac">Car (Non-AC)</option>
                <option value="bike">Motorcycle / Bike</option>
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold">Vehicle Model</label>
                <input 
                  type="text" 
                  placeholder="e.g. Maruti WagonR"
                  value={enrollForm.vehicleName}
                  onChange={e => setEnrollForm(prev => ({ ...prev, vehicleName: e.target.value }))}
                  style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  required
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold">Vehicle Plate No.</label>
                <input 
                  type="text" 
                  placeholder="e.g. WB-02-AB-1234"
                  value={enrollForm.vehicleNumber}
                  onChange={e => setEnrollForm(prev => ({ ...prev, vehicleNumber: e.target.value }))}
                  style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  required
                />
              </div>
            </div>

            <div className="border-t border-white/5 my-1 pt-2 flex flex-col gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold">Driving License (DL)</label>
                <input 
                  type="text" 
                  placeholder="e.g. DL-WESTBENGAL-9932"
                  value={enrollForm.licenseNumber}
                  onChange={e => setEnrollForm(prev => ({ ...prev, licenseNumber: e.target.value }))}
                  style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#fff', outline: 'none' }}
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold">Aadhar Card Number</label>
                <input 
                  type="text" 
                  placeholder="e.g. 5566 7788 9900"
                  value={enrollForm.aadharNumber}
                  onChange={e => setEnrollForm(prev => ({ ...prev, aadharNumber: e.target.value }))}
                  style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#fff', outline: 'none' }}
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold">Vehicle RC Number</label>
                <input 
                  type="text" 
                  placeholder="e.g. RC-WB02AB1234"
                  value={enrollForm.rcNumber}
                  onChange={e => setEnrollForm(prev => ({ ...prev, rcNumber: e.target.value }))}
                  style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#fff', outline: 'none' }}
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              style={{ backgroundColor: '#ffdd00', border: 'none', color: '#000', fontWeight: 'bold', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}
            >
              Enroll Driver Partner
            </button>
            <button 
              type="button"
              onClick={() => setIsEnrolling(false)}
              style={{ backgroundColor: 'transparent', border: 'none', color: '#888', fontWeight: 'bold', padding: '4px', cursor: 'pointer', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}
            >
              Cancel
            </button>
          </form>
        </div>
        <div className="phone-home-bar"></div>
      </div>
    );
  }

  return (
    <>
      {/* Simulator Switcher Controls (hidden in standalone native mode) */}
      {!isStandalone && (
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            maxWidth: '360px',
            backgroundColor: '#11141a',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '11px',
            color: '#a0aec0',
            marginBottom: '4px',
            zIndex: 10,
            boxSizing: 'border-box'
          }}
        >
          <span style={{ fontWeight: 'bold' }}>👤 Simulate Driver Profile:</span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <select 
              value={selectedDriverId} 
              onChange={(e) => {
                setSelectedDriverId(e.target.value);
                setTab('dashboard');
              }}
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: '4px',
                outline: 'none',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({getVehicleLabel(d.vehicleType)} - {d.verificationStatus})
                </option>
              ))}
            </select>
            <button 
              onClick={() => setIsEnrolling(true)}
              style={{
                backgroundColor: '#ffdd00',
                border: 'none',
                color: '#000',
                fontWeight: 'extrabold',
                padding: '2px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '10px',
                marginLeft: '6px'
              }}
              title="Register a new driver partner profile"
            >
              ➕ Register
            </button>
          </div>
        </div>
      )}
      <div className="mobile-phone-frame driver-theme">
        {!isStandalone && <div className="phone-notch"></div>}
        
        {!isStandalone && (
          <div className="phone-status-bar">
            <span className="phone-time">08:18</span>
            <div className="phone-icons">
              <span className="signal">📶</span>
              <span className="battery">🔋 87%</span>
            </div>
          </div>
        )}

        <div className="phone-screen-content">
        <RainOverlay weather={settings.weather} />

        {/* 1. Unverified Onboarding Portal */}
        {currentDriver.verificationStatus !== 'verified' && (
          <div className="app-screen-layout onboarding-screen">
            <div className="onboarding-header text-center">
              <AlertOctagon size={48} className="text-amber-500 mx-auto" />
              <h3>Verification Required</h3>
              <p>You must complete onboarding before you can receive ride alerts.</p>
            </div>

            {currentDriver.verificationStatus === 'pending' ? (
              <div className="onboarding-card card-glow text-center">
                <div className="verify-pending-pulse"></div>
                <h4 className="mt-3 font-semibold text-yellow-400">Documents Under Review</h4>
                <p className="text-sm mt-2 text-gray-300">
                  Your Driving License, Aadhar Card, and Vehicle RC are currently being reviewed by JoldiGo Admin.
                </p>
                <div className="alert alert-warning mt-4 text-xs">
                  💡 <b>Demo Tip:</b> Head over to the <b>Admin Panel</b> to verify this driver!
                </div>
              </div>
            ) : (
              <form className="onboarding-form card-glow" onSubmit={handleOnboardingSubmit}>
                <h4>Submit Partner Documents</h4>
                
                <div className="form-input-stacked mt-3">
                  <label>Driving License No.</label>
                  <input 
                    type="text" 
                    placeholder="e.g. DL-14201800" 
                    value={licenseInput}
                    onChange={(e) => setLicenseInput(e.target.value)}
                    required
                  />
                </div>

                <div className="form-input-stacked mt-2">
                  <label>Aadhar Card No. (12 Digit)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 5421 8892 0123" 
                    value={aadharInput}
                    onChange={(e) => setAadharInput(e.target.value)}
                    required
                  />
                </div>

                <div className="form-input-stacked mt-2">
                  <label>Vehicle RC Certificate Number</label>
                  <input 
                    type="text" 
                    placeholder="e.g. RC-WB02A8842" 
                    value={rcInput}
                    onChange={(e) => setRcInput(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn-primary full-width mt-4">
                  <Upload size={16} /> Submit Documents
                </button>
              </form>
            )}
          </div>
        )}

        {/* 2. Verified Driver Main Portal */}
        {currentDriver.verificationStatus === 'verified' && (
          <div className="app-screen-layout relative flex flex-col justify-between">
            
            {!isNavActive && (
              <div className="driver-app-header card-glow">
                <div className="driver-identity">
                  <span className="drv-avatar-mini">{currentDriver.avatar}</span>
                  <div className="drv-text-block">
                    <span className="drv-name-mini">{currentDriver.name}</span>
                    <span className="drv-vehicle-mini">{currentDriver.vehicleNumber}</span>
                  </div>
                </div>

                <div className="online-switch-row">
                  <span className={`status-pill ${currentDriver.status === 'online' ? 'online' : 'offline'}`}>
                    {currentDriver.status.toUpperCase()}
                  </span>
                  <button 
                    className="btn-status-toggle"
                    onClick={() => toggleDriverStatus(currentDriver.id)}
                    title="Toggle Status"
                  >
                    <Power size={18} color={currentDriver.status === 'online' ? '#00ff66' : '#999'} />
                  </button>
                </div>
              </div>
            )}

            {tab === 'dashboard' && (
              <div style={{ position: 'relative', flex: 1, minHeight: '0', display: 'flex', flexDirection: 'column' }}>
                <div ref={mapContainerRef} className="map-view-container driver-map"></div>

                {/* GOOGLE MAPS NAVIGATION TOP HUD BAR */}
                {isNavActive && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      right: '12px',
                      zIndex: 999,
                      backgroundColor: '#005043',
                      borderRadius: '12px',
                      padding: '12px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      border: '1px solid rgba(255,255,255,0.08)',
                      fontFamily: 'Outfit, sans-serif'
                    }}
                    className="animate-slide-down"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <div 
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(255,255,255,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {activeRide.status === 'accepted' && (
                          <span style={{ fontSize: '24px', fontWeight: 'bold' }}>↑</span>
                        )}
                        {activeRide.status === 'arrived' && (
                          <span style={{ fontSize: '24px', fontWeight: 'bold' }}>⟳</span>
                        )}
                        {activeRide.status === 'in_progress' && (
                          <span style={{ fontSize: '24px', fontWeight: 'bold' }}>↱</span>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '800', letterSpacing: '-0.3px', color: '#fff' }}>
                          {activeRide.status === 'accepted' && 'Head northwest toward pickup'}
                          {activeRide.status === 'arrived' && 'Awaiting passenger boarding'}
                          {activeRide.status === 'in_progress' && 'Proceed to destination'}
                        </span>
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>
                          {activeRide.status === 'accepted' && 'Then ↱ Arrive at target location'}
                          {activeRide.status === 'arrived' && 'Confirm customer coordinates'}
                          {activeRide.status === 'in_progress' && 'Then ↱ Complete ride session'}
                        </span>
                      </div>
                    </div>
                    
                    <button 
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255,255,255,0.15)',
                        border: 'none',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      title="Google Voice Input"
                    >
                      🎙️
                    </button>
                  </div>
                )}

                {/* GOOGLE MAPS NAVIGATION BOTTOM SPEEDOMETER (BOTTOM LEFT) */}
                {isNavActive && (
                  <div 
                    style={{
                      position: 'absolute',
                      bottom: '80px',
                      left: '12px',
                      zIndex: 999,
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      border: '2px solid rgba(0,0,0,0.1)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      fontFamily: 'Outfit, sans-serif'
                    }}
                    className="animate-scale-in"
                  >
                    <span style={{ fontSize: '14px', fontWeight: '800', lineHeight: '1' }}>{simulatedSpeed}</span>
                    <span style={{ fontSize: '7px', fontWeight: 'bold', color: '#666', transform: 'scale(0.85)' }}>km/h</span>
                  </div>
                )}

                {/* GOOGLE MAPS FLOATING CONTROLS (BOTTOM RIGHT) */}
                {isNavActive && (
                  <div 
                    style={{
                      position: 'absolute',
                      bottom: '80px',
                      right: '12px',
                      zIndex: 999,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'end',
                      gap: '8px',
                      fontFamily: 'Outfit, sans-serif'
                    }}
                    className="animate-fade-in"
                  >
                    {/* Compass Needle */}
                    <div 
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        border: '1px solid rgba(0,0,0,0.08)',
                        cursor: 'pointer'
                      }}
                    >
                      🧭
                    </div>

                    {/* Search */}
                    <div 
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        border: '1px solid rgba(0,0,0,0.08)',
                        cursor: 'pointer'
                      }}
                    >
                      🔍
                    </div>

                    {/* Speaker */}
                    <div 
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        border: '1px solid rgba(0,0,0,0.08)',
                        cursor: 'pointer'
                      }}
                    >
                      🔊
                    </div>

                    {/* Report Button */}
                    <div 
                      style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        backgroundColor: '#ffffff',
                        color: '#000',
                        fontSize: '8px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        border: '1px solid rgba(0,0,0,0.08)',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ color: '#d97706', fontSize: '9px' }}>⚠️</span>
                      Report
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'dashboard' && currentDriver.status === 'online' && (
              <button 
                className="btn-sos-floating pulse-sos"
                onClick={() => triggerSOS(currentDriver.id)}
              >
                SOS
              </button>
            )}

            {/* Disputes Tab */}
            {tab === 'disputes' && (
              <div className="history-screen" style={{ padding: '90px 20px 20px 20px' }}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-red-400">🛡️ Dispute Gateway</h3>
                  <span className="text-xs text-gray-500">24h Evidence Window</span>
                </div>

                {driverDisputes.length === 0 ? (
                  <div className="empty-state">
                    <UserCheck size={36} className="text-gray-600 mb-2 mx-auto" />
                    <p className="text-xs">Perfect Rating! No active disputes filed against your account.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {driverDisputes.map(disp => (
                      <div key={disp.id} className="history-item-card card-glow p-3" style={{ flexDirection: 'column' }}>
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-red-400 uppercase text-[9px] tracking-wide bg-red-950/40 p-1 rounded">Payout Suspended</span>
                          <span className="font-mono text-[9px] text-gray-500">SLA: {disp.expiresIn}s</span>
                        </div>
                        <div className="mt-2 text-xs text-gray-300">
                          <b>Issue:</b> {disp.riderComplaint}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1 font-mono">
                          Suspended Amount: ₹{disp.suspendedPayout} • Ride ID: {disp.rideId.substr(0,12)}
                        </div>

                        <div className="dispute-evidence-uploader-widget mt-3 pt-2 border-t border-white/5">
                          {disp.status === 'awaiting_evidence' ? (
                            <div>
                              <span className="text-[9px] text-gray-500 font-bold block uppercase mb-1">Submit Proof:</span>
                              <div className="flex gap-2">
                                <button 
                                  className="btn-secondary py-1 text-[10px] flex-1 justify-center bg-indigo-500/10 border-indigo-500/20"
                                  onClick={() => uploadDisputeEvidence(disp.id, 'video', 'dashcam_rear_1922.mp4')}
                                >
                                  <Camera size={10} /> Dashcam Clip
                                </button>
                                <button 
                                  className="btn-secondary py-1 text-[10px] flex-1 justify-center bg-indigo-500/10 border-indigo-500/20"
                                  onClick={() => uploadDisputeEvidence(disp.id, 'audio', 'cabin_voice_recording.wav')}
                                >
                                  <Volume2 size={10} /> Cabin Audio
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 p-2 rounded text-[10px] flex justify-between items-center">
                              <span>✓ Proof Uploaded: <i>{disp.evidenceMedia}</i></span>
                              <span className="text-[8px] uppercase tracking-wider bg-indigo-950 px-2 py-0.5 rounded font-mono">under review</span>
                            </div>
                          )}
                        </div>

                        {disp.status.startsWith('resolved') && (
                          <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-right font-bold">
                            {disp.status === 'resolved_driver' ? (
                              <span className="text-green-400">✓ Resolved in Driver Favor (Payout Restored)</span>
                            ) : (
                              <span className="text-red-500">✗ Resolved in Rider Favor (Refund Processed)</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bottom Overlay: Dashboard / Earnings tabs */}
            <div 
              className="driver-bottom-overlay card-glow"
              style={isNavActive ? {
                backgroundColor: '#ffffff',
                color: '#000000',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
                borderTop: '1px solid rgba(0,0,0,0.1)',
                padding: '16px',
                boxShadow: '0 -4px 16px rgba(0,0,0,0.15)',
                bottom: '0px'
              } : {}}
            >
              {activeRide && activeRide.driverId === currentDriver.id ? (
                // Active Job Flow UI
                <div className="active-job-details relative">
                  {isNavActive ? (
                    <div style={{ fontFamily: 'Outfit, sans-serif' }}>
                      <div className="flex justify-between items-center mb-2">
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '18px', fontWeight: '800', color: '#16a34a', lineHeight: '1.2', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {activeRide.status === 'accepted' ? '4 min' : '8 min'}
                            <span style={{ fontSize: '12px' }}>🌱</span>
                          </span>
                          <span style={{ fontSize: '10px', color: '#555', fontWeight: '600' }}>
                            {activeRide.status === 'accepted' ? '1.5 km' : '4.2 km'} • {new Date(Date.now() + (activeRide.status === 'accepted' ? 4 : 8)*60000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>

                        {/* Control buttons (Chat, Call) */}
                        <div className="flex gap-2">
                          <button 
                            className={`circle-btn-phone relative`} 
                            onClick={() => setShowChat(!showChat)}
                            style={{
                              backgroundColor: showChat ? '#005043' : 'rgba(0,0,0,0.05)',
                              color: showChat ? '#fff' : '#000',
                              border: '1px solid rgba(0,0,0,0.1)',
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <MessageSquare size={13} />
                            {hasUnreadMessages && (
                              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse"></span>
                            )}
                          </button>
                          
                          <button 
                            onClick={() => initiateCall('passenger', activeRide.passengerPhone, currentDriver.name)}
                            className="circle-btn-phone cursor-pointer"
                            style={{
                              backgroundColor: 'rgba(0,0,0,0.05)',
                              color: '#000',
                              border: '1px solid rgba(0,0,0,0.1)',
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="VoIP Secure Call"
                          >
                            <Phone size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Nav Text Details */}
                      <div style={{ fontSize: '10px', color: '#444', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }} className="mb-2">
                        <span>📍</span>
                        <span className="truncate max-w-[210px]">{getNavText()}</span>
                      </div>

                      {/* Action buttons */}
                      {activeRide.status === 'accepted' && (
                        <div style={{ backgroundColor: 'rgba(22,163,74,0.08)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.2)', borderRadius: '8px', padding: '6px', fontSize: '10px', fontWeight: 'bold', textAlign: 'center' }}>
                          🚘 Driving towards passenger pickup (Active)
                        </div>
                      )}

                      {activeRide.status === 'arrived' && (
                        <button className="btn-primary full-width text-xs py-2 font-bold cursor-pointer" onClick={startRide} style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none' }}>
                          Passenger Boarded - Start Ride
                        </button>
                      )}

                      {activeRide.status === 'in_progress' && (
                        <div style={{ backgroundColor: 'rgba(22,163,74,0.08)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.2)', borderRadius: '8px', padding: '6px', fontSize: '10px', fontWeight: 'bold', textAlign: 'center' }}>
                          🛣️ Navigating to drop-off point (Active)
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <div className="job-stage-pill flex-1 mr-2">
                          <Navigation size={12} className="nav-arrow-animated" />
                          <span className="truncate max-w-[150px]">{getNavText()}</span>
                        </div>

                        {/* DRIVER CHAT TRIGGER WITH NOTIFICATION BADGES */}
                        <div className="flex gap-2">
                          <button 
                            className={`circle-btn-phone relative ${showChat ? 'bg-amber-500 text-black' : 'bg-black/50 text-white border border-white/10'}`} 
                            onClick={() => setShowChat(!showChat)}
                            title="Bilingual Chat"
                          >
                            <MessageSquare size={14} />
                            {hasUnreadMessages && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#0c0e12] animate-pulse"></span>
                            )}
                          </button>

                          <button 
                            onClick={() => initiateCall('passenger', activeRide.passengerPhone, currentDriver.name)}
                            className="circle-btn-phone cursor-pointer"
                            title="VoIP Secure Call"
                          >
                            <Phone size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="job-passenger-card mt-3">
                        <div className="pass-avatar">P</div>
                        <div className="pass-info">
                          <span className="pass-name">Passenger ({activeRide.paymentMethod.toUpperCase()})</span>
                          <span className="pass-trip-meta">{activeRide.distance} km • Net Share: ₹{activeRide.takeHome}</span>
                        </div>
                      </div>

                      {activeRide.status === 'accepted' && (
                        <div className="alert alert-success mt-2 text-xs py-1.5 text-center text-green-400">
                          🚘 Driving towards pickup coordinates (Animated)
                        </div>
                      )}

                      {activeRide.status === 'arrived' && (
                        <button className="btn-primary full-width mt-3 text-xs py-2" onClick={startRide}>
                          Passenger Boarded - Start Ride
                        </button>
                      )}

                      {activeRide.status === 'in_progress' && (
                        <div className="alert alert-success mt-2 text-xs py-1.5 text-center text-green-400">
                          🛣️ Driving to drop-off destination (Animated)
                        </div>
                      )}

                      {activeRide.status === 'completed' && (
                        <div className="completed-waiting-payout mt-3 py-1.5 text-center text-yellow-400 text-xs font-medium">
                          ⌛ Awaiting payment split authorization...
                        </div>
                      )}
                    </>
                  )}

                  {/* DRIVER BILINGUAL SLIDE CHAT DRAWER */}
                  {showChat && (
                    <div className="chat-slide-drawer card-glow animate-slide-up" style={{ bottom: '100%', top: 'auto', maxHeight: '310px' }}>
                      <div className="chat-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="text-amber-500 font-bold">•</span>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>Chat with Passenger</span>
                        </div>
                        <button style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }} onClick={() => setShowChat(false)}>×</button>
                      </div>

                      {/* Messages list */}
                      <div className="chat-messages-container" style={{ height: '120px' }}>
                        {chatMessages.length === 0 ? (
                          <div style={{ textAlign: 'center', fontSize: '10px', color: '#555', marginTop: '24px', fontStyle: 'italic' }}>
                            Tap a quick reply or type to begin bilingual translation chat.
                          </div>
                        ) : (
                          chatMessages.map(msg => {
                            const isSelf = msg.sender === 'driver';
                            return (
                              <div key={msg.id} className={`chat-row ${isSelf ? 'self' : 'peer'}`}>
                                <div className={`chat-bubble ${isSelf ? 'chat-bubble-self-driver' : 'chat-bubble-peer'} flex items-center justify-between gap-1.5`}>
                                  <span>{msg.text}</span>
                                  <button 
                                    onClick={() => speakText(msg.text, msg.originalLang || 'en-US')}
                                    className="tts-play-btn cursor-pointer p-0.5 opacity-60 hover:opacity-100 transition-all"
                                    title="Speak original text out loud"
                                    style={{ background: 'none', border: 'none' }}
                                  >
                                    <Volume2 size={11} className="text-indigo-400" />
                                  </button>
                                </div>
                                <div className="chat-meta flex items-center gap-1">
                                  <span>🌐</span>
                                  <span className="italic">{msg.translation}</span>
                                  <button 
                                    onClick={() => speakText(msg.translation, msg.translationLang || 'bn-IN')}
                                    className="tts-play-btn cursor-pointer p-0.5 opacity-60 hover:opacity-100 transition-all"
                                    title="Speak translation out loud"
                                    style={{ background: 'none', border: 'none' }}
                                  >
                                    <Volume2 size={10} className="text-emerald-400" />
                                  </button>
                                  <span>• {msg.time}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                        <div ref={chatEndRef} />
                      </div>

                      {/* Bengali Driver Quick-Replies Grid */}
                      <div className="chat-quick-replies-grid">
                        {DRIVER_QUICK_REPLIES.map((reply, idx) => (
                          <button 
                            key={idx}
                            className="quick-reply-btn"
                            onClick={() => sendChatMessage('driver', reply)}
                          >
                            {reply}
                          </button>
                        ))}
                      </div>

                      {/* Custom input Form */}
                      <form onSubmit={handleSendChat} className="chat-input-form">
                        <input 
                          type="text" 
                          placeholder="বাংলা বা ইংরেজিতে লিখুন..." 
                          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', color: '#fff', outline: 'none' }}
                          value={chatInputText}
                          onChange={(e) => setChatInputText(e.target.value)}
                        />
                        <button type="submit" style={{ border: 'none', borderRadius: '8px', backgroundColor: 'var(--color-primary)', color: '#000', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Send size={12} fill="#000" />
                        </button>
                      </form>
                    </div>
                  )}

                </div>
              ) : (
                <div className="standby-earnings-preview">
                  <div className="tab-buttons">
                    <button 
                      className={`tab-btn-compact ${tab === 'dashboard' ? 'active' : ''}`}
                      onClick={() => setTab('dashboard')}
                    >
                      Navigation
                    </button>
                    <button 
                      className={`tab-btn-compact ${tab === 'earnings' ? 'active' : ''}`}
                      onClick={() => setTab('earnings')}
                    >
                      Earnings
                    </button>
                    <button 
                      className={`tab-btn-compact ${tab === 'disputes' ? 'active' : ''}`}
                      onClick={() => setTab('disputes')}
                    >
                      Disputes {driverDisputes.filter(d => !d.status.startsWith('resolved')).length > 0 && (
                        <span className="bg-red-500 text-white rounded-full px-1 text-[8px] font-bold">
                          {driverDisputes.filter(d => !d.status.startsWith('resolved')).length}
                        </span>
                      )}
                    </button>
                    <button 
                      className={`tab-btn-compact ${tab === 'garage' ? 'active' : ''}`}
                      onClick={() => setTab('garage')}
                    >
                      Garage
                    </button>
                    <button 
                      className={`tab-btn-compact ${tab === 'history' ? 'active' : ''}`}
                      onClick={() => setTab('history')}
                    >
                      History
                    </button>
                    <button 
                      className={`tab-btn-compact ${tab === 'subscription' ? 'active' : ''}`}
                      onClick={() => setTab('subscription')}
                    >
                      Premium
                    </button>
                  </div>

                  {tab === 'dashboard' && (
                    <div className="standby-dashboard-text py-2 flex flex-col items-center justify-center gap-2">
                      {currentDriver.status === 'online' ? (
                        <>
                          <p className="status-tip text-green-400">👋 Online ({getVehicleLabel(currentDriver.vehicleType)}) & searching rides...</p>
                          <button
                            type="button"
                            onClick={() => isGpsActive ? stopGpsTracking() : startGpsTracking(currentDriver.id)}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase transition-all duration-300 flex items-center gap-1.5 ${isGpsActive ? 'bg-[#00ff66] text-black shadow-[0_0_10px_rgba(0,255,102,0.4)]' : 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10'}`}
                          >
                            <span>🛰️</span>
                            {isGpsActive ? 'Active GPS Tracking' : 'Use Real Device GPS'}
                          </button>
                        </>
                      ) : (
                        <p className="status-tip text-gray-400">💤 Go Online to start receiving ride alerts.</p>
                      )}
                    </div>
                  )}

                  {tab === 'earnings' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className="earnings-quick-stats">
                        <div className="stat-box">
                          <span className="stat-label">Daily Net</span>
                          <span className="stat-value">₹{currentDriver.earnings.daily.toFixed(0)}</span>
                        </div>
                        <div className="stat-box">
                          <span className="stat-label">Weekly Net</span>
                          <span className="stat-value">₹{currentDriver.earnings.weekly.toFixed(0)}</span>
                        </div>
                        <div className="stat-box">
                          <span className="stat-label">Comm (5%)</span>
                          <span className="stat-value text-red-400">₹{currentDriver.earnings.commission.toFixed(0)}</span>
                        </div>
                      </div>

                      {/* Gig Worker Safety Claims Panel */}
                      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }} className="border-t border-white/5 pt-3 text-left">
                        <span className="text-[10px] text-gray-500 font-extrabold uppercase block tracking-wider">🛡️ Gig Worker Safety Pool Claims</span>
                        
                        <div className="flex justify-between items-center bg-emerald-950/20 border border-emerald-500/20 p-2 rounded-lg text-[11px] text-emerald-400">
                          <span>Total Safety Pool Balance:</span>
                          <span className="font-bold">₹{insuranceReservePool.toFixed(2)}</span>
                        </div>

                        {/* Claim Form */}
                        <div className="p-2.5 bg-black/40 rounded-lg border border-white/5 flex flex-col gap-2 mt-1">
                          <span className="text-[10px] font-bold text-gray-300">File Outpatient/Medical Cover Claim</span>
                          
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-[9px] text-gray-500 block mb-0.5">Claim Cover Type</label>
                              <select 
                                style={{ width: '100%', fontSize: '10px', padding: '4px', background: '#111', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', outline: 'none' }}
                                value={claimType}
                                onChange={(e) => setClaimType(e.target.value)}
                              >
                                <option value="health">Outpatient Health</option>
                                <option value="term">Term Cover Claim</option>
                              </select>
                            </div>

                            <div className="w-[80px]">
                              <label className="text-[9px] text-gray-500 block mb-0.5">Amount (₹)</label>
                              <input 
                                type="number" 
                                style={{ width: '100%', fontSize: '10px', padding: '4px', background: '#111', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', outline: 'none' }}
                                value={claimAmount}
                                onChange={(e) => setClaimAmount(parseInt(e.target.value) || 0)}
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[9px] text-gray-500 block mb-0.5">Claim Details / Clinic bill reason</label>
                            <input 
                              type="text" 
                              placeholder="e.g. fever clinic checkup, medicine bills..."
                              style={{ width: '100%', fontSize: '10px', padding: '4px 8px', background: '#111', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', outline: 'none' }}
                              value={claimDesc}
                              onChange={(e) => setClaimDesc(e.target.value)}
                            />
                          </div>

                          <button 
                            className="btn-primary py-1 text-[10px] font-bold mt-1"
                            style={{ padding: '6px' }}
                            onClick={() => {
                              if (!claimDesc.trim()) return alert("Please specify claim details.");
                              fileSafetyClaim(currentDriver.id, claimType, claimAmount, claimDesc.trim());
                              setClaimDesc('');
                            }}
                          >
                            Submit Claim Payout Request
                          </button>
                        </div>

                        {/* Claims History List */}
                        <div className="mt-2" style={{ maxHeight: '120px', overflowY: 'auto' }}>
                          <span className="text-[9px] text-gray-500 font-extrabold block mb-1">Your Safety Claims Log</span>
                          {safetyClaims.filter(c => c.driverId === currentDriver.id).length === 0 ? (
                            <div className="text-[9px] text-gray-500 italic mt-1 text-center">No safety claims logs found.</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {safetyClaims.filter(c => c.driverId === currentDriver.id).map(claim => (
                                <div key={claim.id} className="p-2 bg-black/25 rounded border border-white/5 text-[10px] flex justify-between items-start">
                                  <div className="text-left">
                                    <div className="flex gap-1.5 items-center">
                                      <span className="font-bold text-white uppercase text-[8px] tracking-wide bg-indigo-950/65 px-1.5 py-0.5 rounded">{claim.claimType}</span>
                                      <span className="text-gray-300 font-semibold">₹{claim.amount}</span>
                                    </div>
                                    <p className="text-gray-400 mt-1 text-[9px] leading-tight">{claim.description}</p>
                                    <span className="text-[8px] text-gray-600 block mt-0.5">{claim.createdAt}</span>
                                  </div>
                                  <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded font-mono ${
                                    claim.status === 'approved' ? 'bg-green-500/10 text-green-400' : (claim.status === 'rejected' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400')
                                  }`}>
                                    {claim.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
 
                  {tab === 'garage' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="text-left mt-2">
                      <span className="text-[10px] text-gray-500 font-extrabold uppercase block tracking-wider">🚗 Garage & Active Vehicle</span>
                      
                      <div className="flex flex-col gap-2">
                        {currentDriver.vehicles && currentDriver.vehicles.map(veh => (
                          <div 
                            key={veh.id} 
                            onClick={async () => {
                              try {
                                const { api } = getServerEndpoints();
                                const res = await fetch(`${api}/api/driver/vehicles/select`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ driverId: currentDriver.id, vehicleId: veh.id })
                                });
                                const data = await res.json();
                                if (data.success) {
                                  // Server broadcast will trigger websocket update
                                }
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                            className={`p-2.5 rounded-lg border transition-all flex justify-between items-center cursor-pointer ${
                              veh.active 
                                ? 'bg-indigo-600/10 border-indigo-400 text-white shadow-[0_0_10px_rgba(99,102,241,0.15)]' 
                                : 'bg-black/30 border-white/5 text-gray-400 hover:bg-white/5'
                            }`}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-[11px]">{veh.name}</span>
                              <span className="text-[9px] font-mono text-gray-500">{veh.number}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-black/40 text-gray-300">
                                {getVehicleLabel(veh.type)}
                              </span>
                              {veh.active && <span className="text-[9px] text-green-400">● Active</span>}
                            </div>
                          </div>
                        ))}
                      </div>
 
                      {/* Register New Vehicle Form */}
                      <form 
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const name = e.target.vehName.value.trim();
                          const number = e.target.vehNumber.value.trim();
                          const type = e.target.vehType.value;
                          if (!name || !number) return;
 
                          try {
                            const { api } = getServerEndpoints();
                            const res = await fetch(`${api}/api/driver/vehicles/add`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ driverId: currentDriver.id, name, number, type })
                            });
                            const data = await res.json();
                            if (data.success) {
                              e.target.reset();
                              // Reload initial data to fetch new vehicle lists
                              const drvsRes = await fetch(`${api}/api/drivers`);
                              const drvsData = await drvsRes.json();
                              if (drvsData.success) {
                                // WebSocket update will dispatch
                              }
                            }
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="p-2.5 bg-black/40 rounded-lg border border-white/5 flex flex-col gap-2 mt-1"
                      >
                        <span className="text-[10px] font-bold text-gray-300">Register New Vehicle</span>
                        
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[9px] text-gray-500 block mb-0.5">Model Name</label>
                            <input name="vehName" type="text" placeholder="e.g. TVS Apache Bike" style={{ width: '100%', fontSize: '10px', padding: '4px 6px', background: '#111', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', outline: 'none' }} required />
                          </div>
                          <div className="w-[100px]">
                            <label className="text-[9px] text-gray-500 block mb-0.5">License Plate</label>
                            <input name="vehNumber" type="text" placeholder="e.g. WB-02-1234" style={{ width: '100%', fontSize: '10px', padding: '4px 6px', background: '#111', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', outline: 'none' }} required />
                          </div>
                        </div>
 
                        <div>
                          <label className="text-[9px] text-gray-500 block mb-0.5">Category Dispatch Pool</label>
                          <select 
                            name="vehType"
                            style={{ width: '100%', fontSize: '10px', padding: '4px', background: '#111', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', outline: 'none' }}
                          >
                            <option value="car_ac">4-Wheeler AC Car Fares</option>
                            <option value="car_nonac">4-Wheeler Non-AC Car Fares</option>
                            <option value="bike">App Bike Fares</option>
                          </select>
                        </div>
 
                        <button type="submit" className="btn-primary py-1 text-[10px] font-bold mt-1" style={{ padding: '6px' }}>
                          Add to Garage
                        </button>
                      </form>
                    </div>
                  )}

                  {tab === 'history' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="text-left mt-2">
                      <span className="text-[10px] text-gray-500 font-extrabold uppercase block tracking-wider">📜 Completed Rides History</span>
                      
                      {loadingHistory ? (
                        <div className="text-center py-4 text-xs text-gray-500">Loading history logs...</div>
                      ) : history.length === 0 ? (
                        <div className="text-center py-6 text-xs text-gray-500 italic">No completed rides logged for this partner.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                          {history.map(item => (
                            <div key={item.id} className="p-3 bg-black/40 border border-white/5 rounded-lg flex flex-col gap-1.5 text-xs">
                              <div className="flex justify-between items-center font-bold">
                                <span className="text-green-400">₹{item.takeHome.toFixed(2)} Take-Home</span>
                                <span className="text-gray-500 font-mono text-[9px]">{new Date(item.createdAt).toLocaleDateString()}</span>
                              </div>
                              <div className="text-gray-400 leading-tight">
                                <div><span className="text-amber-500 font-bold">A:</span> {item.pickupName}</div>
                                <div className="mt-0.5"><span className="text-amber-500 font-bold">B:</span> {item.dropoffName}</div>
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-gray-500 border-t border-white/5 pt-1.5 mt-0.5">
                                <span>Distance: {item.distance.toFixed(2)} km</span>
                                <span className="text-gray-400">Fare: ₹{item.totalFare.toFixed(2)}</span>
                              </div>
                              {item.rating && (
                                <div className="bg-amber-950/20 border border-amber-500/10 p-2 rounded flex flex-col gap-1 mt-0.5">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-amber-400 font-bold">Rating:</span>
                                    <div className="flex text-amber-400 font-bold text-[10px]">
                                      {Array.from({ length: item.rating }).map((_, i) => '★').join('')}
                                    </div>
                                  </div>
                                  {item.comment && (
                                    <p className="text-[10px] text-gray-400 italic">"{item.comment}"</p>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {tab === 'subscription' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="text-left mt-2">
                      <span className="text-[10px] text-gray-500 font-extrabold uppercase block tracking-wider">🌟 Premium Subscriptions</span>

                      <div className="p-3 bg-black/40 border border-white/5 rounded-lg flex flex-col gap-1 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400">Current active tier:</span>
                          <span className="font-black text-amber-500 uppercase tracking-widest text-[11px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            🛡️ {subTier}
                          </span>
                        </div>
                        {subExpires && (
                          <span className="text-[8px] text-gray-500 block mt-1">
                            Expires on: {new Date(subExpires).toLocaleDateString()} (Auto-Renews)
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                        {[
                          { key: 'free', name: 'Free Partner Standard', fee: '₹0 / mo', commission: '5.0% commission cut', desc: 'Standard JoldiGo platform fee indexing.' },
                          { key: 'silver', name: 'Premium Silver Tier', fee: '₹299 / mo', commission: '2.5% commission cut', desc: 'Halves standard per-ride platform fees + standard dispatch priority.' },
                          { key: 'gold', name: 'Premium Gold Tier', fee: '₹599 / mo', commission: '1.0% commission cut', desc: 'Waives base fees to just 1% commission + maximum booking matching dispatch priority.' }
                        ].map(tier => {
                          const isCurrent = subTier === tier.key;

                          return (
                            <div 
                              key={tier.key}
                              className={`p-3 rounded-lg border text-left flex justify-between items-center transition-all ${
                                isCurrent 
                                  ? 'border-amber-400 bg-amber-500/5' 
                                  : 'border-white/5 bg-black/30 hover:border-white/10'
                              }`}
                            >
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[11px] font-black text-white">{tier.name}</span>
                                <span className="text-[10px] font-extrabold text-green-400 mt-0.5">{tier.commission} ({tier.fee})</span>
                                <p className="text-[9.5px] text-gray-400 mt-1 leading-snug">{tier.desc}</p>
                              </div>

                              <button
                                type="button"
                                disabled={isCurrent || loadingSub}
                                onClick={() => handleUpgradeSubscription(tier.key)}
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '9px',
                                  fontWeight: 'bold',
                                  borderRadius: '4px',
                                  backgroundColor: isCurrent ? 'rgba(255,255,255,0.05)' : 'var(--color-primary)',
                                  border: isCurrent ? '1px solid transparent' : '1px solid transparent',
                                  color: isCurrent ? '#666' : '#000',
                                  cursor: isCurrent ? 'default' : 'pointer',
                                  marginLeft: '8px',
                                  flexShrink: 0
                                }}
                                className={isCurrent ? '' : 'hover:bg-amber-400'}
                              >
                                {isCurrent ? 'Active' : 'Upgrade'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* TIMER DIALOG OFFER INCOMING */}
            {activeRide && activeRide.driverId === currentDriver.id && activeRide.status === 'searching' && (() => {
              const driverToPickupDist = (currentDriver && activeRide.pickup)
                ? calculateDistance(currentDriver.location.lat, currentDriver.location.lng, activeRide.pickup.lat, activeRide.pickup.lng)
                : 0;
              return (
                <div className="incoming-request-modal card-glow animate-bounce-in" style={{ top: '65px' }}>
                  <div className="incoming-header">
                    <span className="pulse-dot red"></span>
                    <h4>UPFRONT DISPATCH OFFER</h4>
                  </div>

                  <div className="incoming-timer-arc">
                    <div className="timer-number">{activeRide.timer}s</div>
                  </div>

                  <div className="incoming-details-table">
                    <div className="row font-bold text-[14px]">
                      <span className="lbl text-green-400">Net Take-Home:</span>
                      <span className="val text-green-400">₹{activeRide.takeHome.toFixed(2)}</span>
                    </div>
                    <div className="row mt-1 text-[11px]">
                      <span className="lbl text-yellow-400">Pickup Zone:</span>
                      <span className="val text-white font-semibold">{activeRide.pickupName || 'Current Zone'}</span>
                    </div>
                    <div className="row text-[11px]">
                      <span className="lbl text-yellow-400">Dropoff Zone:</span>
                      <span className="val text-white font-semibold">{activeRide.dropoffName || activeRide.destinationZone}</span>
                    </div>
                    <div className="row text-[10px] text-indigo-200">
                      <span className="lbl">Pickup Distance:</span>
                      <span className="val font-semibold">{driverToPickupDist.toFixed(2)} km</span>
                    </div>
                    <div className="row text-[10px] text-indigo-200">
                      <span className="lbl">Ride Distance:</span>
                      <span className="val font-semibold">{activeRide.distance.toFixed(2)} km</span>
                    </div>

                    {/* COLLAPSIBLE DETAILS DROPDOWN */}
                    <details className="mt-2 text-left bg-black/45 border border-white/10 rounded-lg p-2 transition-all">
                      <summary className="text-[10px] text-indigo-300 font-bold cursor-pointer select-none outline-none flex justify-between items-center">
                        <span>📋 Fare Breakdown Details</span>
                        <span className="text-[8px]">▼ Click to toggle</span>
                      </summary>
                      <div className="mt-2 flex flex-col gap-1 text-[9px] text-gray-400">
                        <div className="flex justify-between">
                          <span>Vehicle Type:</span>
                          <span className="text-white">{getVehicleLabel(activeRide.vehicleType)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Payment Method:</span>
                          <span className="text-white uppercase">{activeRide.paymentMethod}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Traffic Friction:</span>
                          <span className="text-white">{activeRide.estimatedRouteFriction}</span>
                        </div>
                        <div className="h-[1px] bg-white/5 my-1"></div>
                        <div className="flex justify-between">
                          <span>Base Ride Fare:</span>
                          <span>₹{activeRide.grossBaseRideFare.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Passenger GST (5%):</span>
                          <span className="text-indigo-400">+₹{activeRide.gstAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Toll Estimate:</span>
                          <span>₹{activeRide.tollEstimate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Platform Commission (5%):</span>
                          <span className="text-red-400">-₹{activeRide.commission.toFixed(2)}</span>
                        </div>
                        <div className="text-[8px] font-mono text-gray-600 mt-1 truncate">
                          Contract: {activeRide.contractHash}
                        </div>
                      </div>
                    </details>
                  </div>

                  <div className="incoming-actions mt-3">
                    <button className="btn-secondary flex-1 mr-2 py-1.5" onClick={rejectRide}>
                      Decline
                    </button>
                    <button className="btn-primary flex-1 ml-2 py-1.5 text-xs" onClick={() => acceptRide(currentDriver.id)}>
                      Accept Offer
                    </button>
                  </div>
                </div>
              );
            })()}

          </div>
        )}

      </div>

      {/* Dynamic Calling Simulator Overlay */}
      {renderCallOverlay()}

      <div className="phone-home-bar"></div>
    </div>
    </>
  );
}
