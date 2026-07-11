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

const compressImage = (dataUrl, maxWidth = 600, quality = 0.6) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
  });
};

export default function DriverApp({ isStandalone }) {
  const {
    drivers,
    settings,
    triggerSmsToast,
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
    geofencingZones,
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
  
  // 6-Step Onboarding Inputs
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollStep, setEnrollStep] = useState(1); // Steps 1 to 6
  
  // Step 1: Mobile Phone & OTP Verification
  const [enrollPhone, setEnrollPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [enrollOtp, setEnrollOtp] = useState('');
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  
  // Step 2: Basic Profile
  const [enrollName, setEnrollName] = useState('');
  const [enrollAge, setEnrollAge] = useState('');
  const [enrollCity, setEnrollCity] = useState('Kolkata');
  const [driverPhoto, setDriverPhoto] = useState(null); // Selfie Profile Photo
  
  // Step 3: Vehicle Type Selection
  const [enrollVehicleType, setEnrollVehicleType] = useState('bike'); // 'bike' (Two-Wheeler) or 'auto' (Three-Wheeler)
  const [enrollVehicleName, setEnrollVehicleName] = useState('');
  const [enrollVehicleNumber, setEnrollVehicleNumber] = useState('');
  
  // Step 4: Documents Upload KYC
  const [enrollLicenseNumber, setEnrollLicenseNumber] = useState('');
  const [licensePhoto, setLicensePhoto] = useState(null);
  
  const [enrollRcNumber, setEnrollRcNumber] = useState('');
  const [rcPhoto, setRcPhoto] = useState(null);
  
  const [insurancePhoto, setInsurancePhoto] = useState(null);
  const [pucPhoto, setPucPhoto] = useState(null);
  
  const [enrollAadharNumber, setEnrollAadharNumber] = useState('');
  const [identityPhoto, setIdentityPhoto] = useState(null);
  
  // Step 5: Bank Details
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfscCode, setBankIfscCode] = useState('');
  const [bankHolderName, setBankHolderName] = useState('');

  // Step 6: Safety Training Video & Quiz
  const [q1Answer, setQ1Answer] = useState('');
  const [q2Answer, setQ2Answer] = useState('');
  const [q3Answer, setQ3Answer] = useState('');
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);

  const [activeCamera, setActiveCamera] = useState(null); // 'driver', 'vehicle', 'insurance', 'puc', 'identity', 'license', 'rc'
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = async (target) => {
    setActiveCamera(target);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error("Camera access failed:", err);
      alert("Webcam access failed or blocked. Please upload a file instead.");
      setActiveCamera(null);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setActiveCamera(null);
  };

  const snapPhoto = async (target) => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      const dataUrl = canvas.toDataURL('image/jpeg');
      
      // Compress snapped image to reduce bandwidth payload
      const compressedUrl = await compressImage(dataUrl, 600, 0.6);
      
      if (target === 'driver') setDriverPhoto(compressedUrl);
      else if (target === 'vehicle') setVehiclePhoto(compressedUrl);
      else if (target === 'insurance') setInsurancePhoto(compressedUrl);
      else if (target === 'puc') setPucPhoto(compressedUrl);
      else if (target === 'identity') setIdentityPhoto(compressedUrl);
      else if (target === 'license') setLicensePhoto(compressedUrl);
      else if (target === 'rc') setRcPhoto(compressedUrl);
      
      stopCamera();
    }
  };

  const handlePhotoUpload = (e, target) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        // Compress uploaded file image
        const compressedUrl = await compressImage(event.target.result, 600, 0.6);
        
        if (target === 'driver') setDriverPhoto(compressedUrl);
        else if (target === 'vehicle') setVehiclePhoto(compressedUrl);
        else if (target === 'insurance') setInsurancePhoto(compressedUrl);
        else if (target === 'puc') setPucPhoto(compressedUrl);
        else if (target === 'identity') setIdentityPhoto(compressedUrl);
        else if (target === 'license') setLicensePhoto(compressedUrl);
        else if (target === 'rc') setRcPhoto(compressedUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const renderCameraView = (target) => {
    return (
      <div className="relative mt-2 rounded overflow-hidden bg-black/90 border border-white/10" style={{ width: '100%', height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          style={{ width: '100%', height: '140px', objectFit: 'cover', transform: 'scaleX(-1)' }}
        />
        <div style={{ display: 'flex', gap: '8px', padding: '6px 0', width: '100%', justifyContent: 'center', backgroundColor: '#0d1117' }}>
          <button 
            type="button" 
            onClick={() => snapPhoto(target)}
            style={{ backgroundColor: '#ffdd00', border: 'none', color: '#000', fontWeight: 'bold', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '9px' }}
          >
            Snap Photo
          </button>
          <button 
            type="button" 
            onClick={stopCamera}
            style={{ backgroundColor: '#e53e3e', border: 'none', color: '#fff', fontWeight: 'bold', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '9px' }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  const handleEnrollSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!enrollName || !enrollPhone || !enrollVehicleName || !enrollVehicleNumber || !enrollLicenseNumber || !enrollAadharNumber || !enrollRcNumber) {
      alert('Please complete all document and profile details first.');
      return;
    }
    const newDrv = await enrollDriver({
      name: enrollName,
      phone: enrollPhone,
      vehicleType: enrollVehicleType,
      vehicleName: enrollVehicleName,
      vehicleNumber: enrollVehicleNumber,
      licenseNumber: enrollLicenseNumber,
      aadharNumber: enrollAadharNumber,
      rcNumber: enrollRcNumber,
      driverPhoto,
      vehiclePhoto: rcPhoto, // mapped to rcPhoto/vehiclePhoto representation
      age: enrollAge,
      city: enrollCity,
      vehicleInsurancePhoto: insurancePhoto,
      vehiclePucPhoto: pucPhoto,
      identityCardPhoto: identityPhoto,
      bankAccountNumber,
      bankIfscCode,
      bankHolderName
    });
    if (newDrv) {
      setSelectedDriverId(newDrv.id);
      setIsEnrolling(false);
      setEnrollStep(1);
      // Reset forms
      setEnrollName('');
      setEnrollPhone('');
      setEnrollAge('');
      setEnrollCity('Kolkata');
      setDriverPhoto(null);
      setEnrollVehicleName('');
      setEnrollVehicleNumber('');
      setEnrollLicenseNumber('');
      setLicensePhoto(null);
      setEnrollRcNumber('');
      setRcPhoto(null);
      setInsurancePhoto(null);
      setPucPhoto(null);
      setEnrollAadharNumber('');
      setIdentityPhoto(null);
      setBankAccountNumber('');
      setBankIfscCode('');
      setBankHolderName('');
      setOtpSent(false);
      setEnrollOtp('');
      setIsOtpVerified(false);
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
    heatmapCircles: [],
    geofencePolygons: []
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

    if (markersRef.current.geofencePolygons) {
      markersRef.current.geofencePolygons.forEach(p => map.removeLayer(p));
      markersRef.current.geofencePolygons = [];
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

    if (geofencingZones) {
      geofencingZones.forEach(zone => {
        if (zone.active) {
          const color = zone.type === 'ban' ? '#ef4444' : '#f59e0b';
          const fillOpacity = zone.type === 'ban' ? 0.15 : 0.08;
          const poly = L.polygon(zone.points, {
            color: color,
            weight: 1.5,
            fillColor: color,
            fillOpacity: fillOpacity,
            dashArray: '3, 5'
          }).addTo(map);

          const label = zone.type === 'ban' 
            ? `<b>⛔ ${zone.name}</b><br/><span style="color:#ef4444;font-weight:bold;">SERVICE TEMPORARILY SUSPENDED</span>`
            : `<b>⚡ ${zone.name}</b><br/><span style="color:#f59e0b;font-weight:bold;">Active Surge: ${zone.multiplier}x Surcharge</span>`;
          poly.bindPopup(label);

          markersRef.current.geofencePolygons.push(poly);
        }
      });
    }

    const emojiMap = { bike: '🏍️', auto: '🛺', car_ac: '🚗', car_non_ac: '🚕' };
    const vehicleEmoji = emojiMap[currentDriver?.vehicleType] || '🚖';

    const driverIcon = L.divIcon({
      className: 'custom-map-marker driver-self-marker-pulsing',
      html: `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
          <div style="position: absolute; width: 32px; height: 32px; background-color: rgba(255, 221, 0, 0.25); border-radius: 50%; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: absolute; width: 24px; height: 24px; background-color: #ffdd00; border: 2px solid #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">
            <span style="font-size: 13px; display: inline-block;">${vehicleEmoji}</span>
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
  }, [activeRide, currentDriver, selectedDriverId, showHeatmap, demandHotspots, geofencingZones]);



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
        
        <button
          onClick={() => {
            const currentUrl = localStorage.getItem('joldigo_server_url') || 'https://joldigo-backend.onrender.com';
            const newUrl = window.prompt("Enter JoldiGo Server URL:", currentUrl);
            if (newUrl !== null) {
              localStorage.setItem('joldigo_server_url', newUrl.trim());
              window.location.reload();
            }
          }}
          style={{
            marginTop: '16px',
            backgroundColor: '#ffdd00',
            color: '#000',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 10px rgba(255, 221, 0, 0.2)'
          }}
        >
          ⚙️ Change Server Address
        </button>

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
    const stepsCount = 6;
    
    // Check if the current step can advance (form validation)
    const isStepValid = () => {
      if (enrollStep === 1) return isOtpVerified;
      if (enrollStep === 2) return enrollName.trim() !== '' && enrollAge.trim() !== '' && driverPhoto !== null;
      if (enrollStep === 3) return enrollVehicleName.trim() !== '' && enrollVehicleNumber.trim() !== '';
      if (enrollStep === 4) {
        return enrollLicenseNumber.trim() !== '' && licensePhoto !== null &&
               enrollRcNumber.trim() !== '' && rcPhoto !== null &&
               insurancePhoto !== null && pucPhoto !== null &&
               enrollAadharNumber.trim() !== '' && identityPhoto !== null;
      }
      if (enrollStep === 5) return bankAccountNumber.trim() !== '' && bankIfscCode.trim() !== '' && bankHolderName.trim() !== '';
      if (enrollStep === 6) return q1Answer === 'B' && q2Answer === 'B' && q3Answer === 'A';
      return true;
    };

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
          
          {/* Top Progress Wizard */}
          {enrollStep <= 6 && (
            <div className="mb-4">
              <div className="flex justify-between items-center text-[9px] uppercase tracking-wider text-gray-400 font-extrabold mb-1.5">
                <span>Step {enrollStep} of {stepsCount}</span>
                <span className="text-yellow-400">
                  {enrollStep === 1 && "OTP VERIFICATION"}
                  {enrollStep === 2 && "BASIC PROFILE"}
                  {enrollStep === 3 && "VEHICLE DETAILS"}
                  {enrollStep === 4 && "KYC UPLOADS"}
                  {enrollStep === 5 && "PAYOUT BANK DETAILS"}
                  {enrollStep === 6 && "SAFETY COMPLIANCE TRAINING"}
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden flex gap-0.5">
                {Array.from({ length: stepsCount }).map((_, idx) => (
                  <div 
                    key={idx} 
                    className="h-full flex-1 transition-all duration-300"
                    style={{
                      backgroundColor: idx + 1 <= enrollStep ? '#ffdd00' : 'rgba(255,255,255,0.08)'
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* STEP 1: MOBILE OTP VERIFICATION */}
          {enrollStep === 1 && (
            <div className="flex flex-col gap-3 flex-1 justify-center py-4">
              <div className="text-center mb-2">
                <Phone size={32} className="text-yellow-400 mx-auto animate-bounce" />
                <h4 className="text-sm font-bold mt-2 text-white">Verify Mobile Number</h4>
                <p className="text-[10px] text-gray-400 mt-1">Enter your mobile number to get a security verification code</p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold">Phone Number</label>
                <input 
                  type="tel"
                  placeholder="e.g. +91 82501 74875"
                  value={enrollPhone}
                  disabled={otpSent}
                  onChange={e => setEnrollPhone(e.target.value)}
                  style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px', fontSize: '11px', color: '#fff', outline: 'none' }}
                />
              </div>

              {!otpSent ? (
                <button
                  type="button"
                  onClick={() => {
                    if (enrollPhone.trim() === '') {
                      alert('Please enter phone number.');
                      return;
                    }
                    setOtpSent(true);
                  }}
                  style={{ backgroundColor: '#ffdd00', border: 'none', color: '#000', fontWeight: 'bold', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', textTransform: 'uppercase' }}
                >
                  Send OTP Code
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold">6-Digit Verification Code</label>
                      <span className="text-[9px] text-yellow-400 font-bold">Hint: 123456</span>
                    </div>
                    <input 
                      type="text"
                      maxLength={6}
                      placeholder="Enter 6-digit OTP"
                      value={enrollOtp}
                      onChange={e => setEnrollOtp(e.target.value)}
                      style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '8px', fontSize: '11px', color: '#fff', outline: 'none', letterSpacing: '4px', textAlign: 'center' }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (enrollOtp === '123456') {
                        setIsOtpVerified(true);
                        setEnrollStep(2);
                      } else {
                        alert('Invalid OTP code. Please enter 123456.');
                      }
                    }}
                    style={{ backgroundColor: '#ffdd00', border: 'none', color: '#000', fontWeight: 'bold', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', textTransform: 'uppercase' }}
                  >
                    Verify OTP & Proceed
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setEnrollOtp('');
                    }}
                    className="text-[10px] text-gray-500 hover:text-white bg-transparent border-none cursor-pointer"
                  >
                    Change Phone Number
                  </button>
                </div>
              )}
              
              <button 
                type="button"
                onClick={() => setIsEnrolling(false)}
                className="text-[10px] text-gray-500 hover:text-white bg-transparent border-none cursor-pointer mt-4"
              >
                Cancel Registration
              </button>
            </div>
          )}

          {/* STEP 2: BASIC PROFILE */}
          {enrollStep === 2 && (
            <div className="flex flex-col gap-3 flex-grow">
              <div className="text-center mb-1">
                <UserCheck size={32} className="text-yellow-400 mx-auto" />
                <h4 className="text-sm font-bold mt-1 text-white">Basic Profile Info</h4>
                <p className="text-[10px] text-gray-400">Fill in your basic information and take a selfie</p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold">Full Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Subir Ganguly"
                  value={enrollName}
                  onChange={e => setEnrollName(e.target.value)}
                  style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#fff', outline: 'none' }}
                />
              </div>

              <div className="flex gap-2">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold">Age</label>
                  <input 
                    type="number"
                    placeholder="e.g. 29"
                    value={enrollAge}
                    onChange={e => setEnrollAge(e.target.value)}
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#fff', outline: 'none' }}
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold">City</label>
                  <select 
                    value={enrollCity}
                    onChange={e => setEnrollCity(e.target.value)}
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#fff', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="Kolkata">Kolkata</option>
                    <option value="Howrah">Howrah</option>
                    <option value="Salt Lake">Salt Lake</option>
                    <option value="Rajarhat">Rajarhat</option>
                  </select>
                </div>
              </div>

              {/* Profile Photo Selfie snap */}
              <div className="flex flex-col gap-1 p-2 bg-black/40 border border-white/5 rounded">
                <label className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold flex justify-between">
                  <span>Profile Photo Selfie</span>
                  <span className={driverPhoto ? "text-green-400" : "text-yellow-400"}>
                    {driverPhoto ? "✅ Captured" : "⚠️ Selfie Required"}
                  </span>
                </label>

                {driverPhoto ? (
                  <div className="relative w-full h-28 rounded overflow-hidden bg-black/80 flex items-center justify-center">
                    <img src={driverPhoto} alt="Selfie" className="w-full h-full object-contain" />
                    <button 
                      type="button" 
                      onClick={() => setDriverPhoto(null)}
                      className="absolute top-1 right-1 bg-red-600 text-white border-none rounded px-2 py-0.5 text-[8px] font-extrabold cursor-pointer"
                    >
                      Retake
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => startCamera('driver')}
                        className="flex-1 bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 rounded py-1 text-[9px] font-bold cursor-pointer"
                      >
                        📷 Webcam snap
                      </button>
                      <label className="flex-1 bg-white/10 text-white border border-white/10 rounded py-1 text-[9px] font-bold cursor-pointer text-center">
                        📤 Upload file
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handlePhotoUpload(e, 'driver')} 
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                    {activeCamera === 'driver' && renderCameraView('driver')}
                  </div>
                )}
              </div>

              <div className="mt-auto pt-3 flex gap-2">
                <button 
                  type="button"
                  onClick={() => setEnrollStep(1)}
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', flex: 1 }}
                >
                  Back
                </button>
                <button 
                  type="button"
                  disabled={!isStepValid()}
                  onClick={() => setEnrollStep(3)}
                  style={{
                    backgroundColor: isStepValid() ? '#ffdd00' : 'rgba(255,255,255,0.05)',
                    color: isStepValid() ? '#000' : '#555',
                    border: 'none',
                    fontWeight: 'bold',
                    padding: '8px',
                    borderRadius: '4px',
                    cursor: isStepValid() ? 'pointer' : 'not-allowed',
                    fontSize: '11px',
                    flex: 1
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: VEHICLE SELECTION */}
          {enrollStep === 3 && (
            <div className="flex flex-col gap-3 flex-grow">
              <div className="text-center mb-1">
                <ShieldAlert size={32} className="text-yellow-400 mx-auto" />
                <h4 className="text-sm font-bold mt-1 text-white">Vehicle Selection</h4>
                <p className="text-[10px] text-gray-400">Select your ride category and input vehicle plate</p>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEnrollVehicleType('bike')}
                  style={{
                    padding: '8px 4px',
                    border: enrollVehicleType === 'bike' ? '2px solid #ffdd00' : '1px solid rgba(255,255,255,0.08)',
                    backgroundColor: enrollVehicleType === 'bike' ? 'rgba(255,221,0,0.06)' : 'rgba(0,0,0,0.3)',
                    borderRadius: '8px',
                    color: '#fff',
                    textAlign: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <span className="text-lg block mb-0.5">🏍️</span>
                  <span className="text-[9px] font-bold block">Bike Taxi</span>
                  <span className="text-[7px] text-gray-400 block">Two-Wheeler</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEnrollVehicleType('auto')}
                  style={{
                    padding: '8px 4px',
                    border: enrollVehicleType === 'auto' ? '2px solid #ffdd00' : '1px solid rgba(255,255,255,0.08)',
                    backgroundColor: enrollVehicleType === 'auto' ? 'rgba(255,221,0,0.06)' : 'rgba(0,0,0,0.3)',
                    borderRadius: '8px',
                    color: '#fff',
                    textAlign: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <span className="text-lg block mb-0.5">🛺</span>
                  <span className="text-[9px] font-bold block">Auto Rickshaw</span>
                  <span className="text-[7px] text-gray-400 block">Three-Wheeler</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEnrollVehicleType('car_ac')}
                  style={{
                    padding: '8px 4px',
                    border: enrollVehicleType === 'car_ac' ? '2px solid #ffdd00' : '1px solid rgba(255,255,255,0.08)',
                    backgroundColor: enrollVehicleType === 'car_ac' ? 'rgba(255,221,0,0.06)' : 'rgba(0,0,0,0.3)',
                    borderRadius: '8px',
                    color: '#fff',
                    textAlign: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <span className="text-lg block mb-0.5">🚗</span>
                  <span className="text-[9px] font-bold block">Car AC</span>
                  <span className="text-[7px] text-gray-400 block">Four-Wheeler AC</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEnrollVehicleType('car_non_ac')}
                  style={{
                    padding: '8px 4px',
                    border: enrollVehicleType === 'car_non_ac' ? '2px solid #ffdd00' : '1px solid rgba(255,255,255,0.08)',
                    backgroundColor: enrollVehicleType === 'car_non_ac' ? 'rgba(255,221,0,0.06)' : 'rgba(0,0,0,0.3)',
                    borderRadius: '8px',
                    color: '#fff',
                    textAlign: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <span className="text-lg block mb-0.5">🚙</span>
                  <span className="text-[9px] font-bold block">Car Non-AC</span>
                  <span className="text-[7px] text-gray-400 block">Four-Wheeler Non-AC</span>
                </button>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold">Vehicle Model</label>
                <input 
                  type="text"
                  placeholder="e.g. Bajaj RE / TVS Sport"
                  value={enrollVehicleName}
                  onChange={e => setEnrollVehicleName(e.target.value)}
                  style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#fff', outline: 'none' }}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold">Vehicle Plate Number</label>
                <input 
                  type="text"
                  placeholder="e.g. WB-20-AJ-2865"
                  value={enrollVehicleNumber}
                  onChange={e => setEnrollVehicleNumber(e.target.value)}
                  style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#fff', outline: 'none' }}
                />
              </div>

              <div className="mt-auto pt-3 flex gap-2">
                <button 
                  type="button"
                  onClick={() => setEnrollStep(2)}
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', flex: 1 }}
                >
                  Back
                </button>
                <button 
                  type="button"
                  disabled={!isStepValid()}
                  onClick={() => setEnrollStep(4)}
                  style={{
                    backgroundColor: isStepValid() ? '#ffdd00' : 'rgba(255,255,255,0.05)',
                    color: isStepValid() ? '#000' : '#555',
                    border: 'none',
                    fontWeight: 'bold',
                    padding: '8px',
                    borderRadius: '4px',
                    cursor: isStepValid() ? 'pointer' : 'not-allowed',
                    fontSize: '11px',
                    flex: 1
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: DOCUMENT KYC UPLOADS */}
          {enrollStep === 4 && (
            <div className="flex flex-col gap-3 flex-grow">
              <div className="text-center mb-1">
                <Upload size={32} className="text-yellow-400 mx-auto" />
                <h4 className="text-sm font-bold mt-1 text-white">KYC Document Uploads</h4>
                <p className="text-[10px] text-gray-400">All 5 documents are required to initiate verification</p>
              </div>

              <div className="flex flex-col gap-2.5 max-h-[320px] overflow-y-auto pr-1" style={{ overflowY: 'auto' }}>
                
                {/* 1. Driving License Card */}
                <div className="p-2 bg-black/40 border border-white/5 rounded flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-white">1. Driving License (DL)</span>
                    <span className="text-[8px] font-bold" style={{ color: (licensePhoto && enrollLicenseNumber.trim()) ? '#10b981' : '#f59e0b' }}>
                      {(licensePhoto && enrollLicenseNumber.trim()) ? "✅ Completed" : "⚠️ Number/Photo Missing"}
                    </span>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Enter DL Card Number"
                    value={enrollLicenseNumber}
                    onChange={e => setEnrollLicenseNumber(e.target.value)}
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 6px', fontSize: '10px', color: '#fff', outline: 'none' }}
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startCamera('license')} className="flex-1 py-1 bg-yellow-400/20 text-yellow-400 border border-yellow-400/20 rounded text-[9px] cursor-pointer">📷 Snap</button>
                    <label className="flex-1 py-1 bg-white/10 text-white border border-white/10 rounded text-[9px] cursor-pointer text-center">
                      📤 Upload
                      <input type="file" accept="image/*" onChange={e => handlePhotoUpload(e, 'license')} style={{ display: 'none' }} />
                    </label>
                  </div>
                  {activeCamera === 'license' && renderCameraView('license')}
                </div>

                {/* 2. Registration Certificate Card */}
                <div className="p-2 bg-black/40 border border-white/5 rounded flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-white">2. Vehicle RC Book</span>
                    <span className="text-[8px] font-bold" style={{ color: (rcPhoto && enrollRcNumber.trim()) ? '#10b981' : '#f59e0b' }}>
                      {(rcPhoto && enrollRcNumber.trim()) ? "✅ Completed" : "⚠️ Number/Photo Missing"}
                    </span>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Enter Vehicle RC Number"
                    value={enrollRcNumber}
                    onChange={e => setEnrollRcNumber(e.target.value)}
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 6px', fontSize: '10px', color: '#fff', outline: 'none' }}
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startCamera('rc')} className="flex-1 py-1 bg-yellow-400/20 text-yellow-400 border border-yellow-400/20 rounded text-[9px] cursor-pointer">📷 Snap</button>
                    <label className="flex-1 py-1 bg-white/10 text-white border border-white/10 rounded text-[9px] cursor-pointer text-center">
                      📤 Upload
                      <input type="file" accept="image/*" onChange={e => handlePhotoUpload(e, 'rc')} style={{ display: 'none' }} />
                    </label>
                  </div>
                  {activeCamera === 'rc' && renderCameraView('rc')}
                </div>

                {/* 3. Vehicle Insurance Card */}
                <div className="p-2 bg-black/40 border border-white/5 rounded flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-white">3. Vehicle Insurance Cover</span>
                    <span className="text-[8px] text-yellow-400 font-bold">{insurancePhoto ? "✅ Uploaded" : "❌ Missing"}</span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startCamera('insurance')} className="flex-1 py-1 bg-yellow-400/20 text-yellow-400 border border-yellow-400/20 rounded text-[9px] cursor-pointer">📷 Snap</button>
                    <label className="flex-1 py-1 bg-white/10 text-white border border-white/10 rounded text-[9px] cursor-pointer text-center">
                      📤 Upload
                      <input type="file" accept="image/*" onChange={e => handlePhotoUpload(e, 'insurance')} style={{ display: 'none' }} />
                    </label>
                  </div>
                  {activeCamera === 'insurance' && renderCameraView('insurance')}
                </div>

                {/* 4. PUC Certificate Card */}
                <div className="p-2 bg-black/40 border border-white/5 rounded flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-white">4. Pollution Under Control (PUC)</span>
                    <span className="text-[8px] text-yellow-400 font-bold">{pucPhoto ? "✅ Uploaded" : "❌ Missing"}</span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startCamera('puc')} className="flex-1 py-1 bg-yellow-400/20 text-yellow-400 border border-yellow-400/20 rounded text-[9px] cursor-pointer">📷 Snap</button>
                    <label className="flex-1 py-1 bg-white/10 text-white border border-white/10 rounded text-[9px] cursor-pointer text-center">
                      📤 Upload
                      <input type="file" accept="image/*" onChange={e => handlePhotoUpload(e, 'puc')} style={{ display: 'none' }} />
                    </label>
                  </div>
                  {activeCamera === 'puc' && renderCameraView('puc')}
                </div>

                {/* 5. PAN / Aadhaar Card */}
                <div className="p-2 bg-black/40 border border-white/5 rounded flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-white">5. National ID (Aadhaar/PAN)</span>
                    <span className="text-[8px] font-bold" style={{ color: (identityPhoto && enrollAadharNumber.trim()) ? '#10b981' : '#f59e0b' }}>
                      {(identityPhoto && enrollAadharNumber.trim()) ? "✅ Completed" : "⚠️ Number/Photo Missing"}
                    </span>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Enter 12-digit Aadhaar Number"
                    value={enrollAadharNumber}
                    onChange={e => setEnrollAadharNumber(e.target.value)}
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 6px', fontSize: '10px', color: '#fff', outline: 'none' }}
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startCamera('identity')} className="flex-1 py-1 bg-yellow-400/20 text-yellow-400 border border-yellow-400/20 rounded text-[9px] cursor-pointer">📷 Snap</button>
                    <label className="flex-1 py-1 bg-white/10 text-white border border-white/10 rounded text-[9px] cursor-pointer text-center">
                      📤 Upload
                      <input type="file" accept="image/*" onChange={e => handlePhotoUpload(e, 'identity')} style={{ display: 'none' }} />
                    </label>
                  </div>
                  {activeCamera === 'identity' && renderCameraView('identity')}
                </div>

              </div>

              <div className="mt-auto pt-3 flex gap-2">
                <button 
                  type="button"
                  onClick={() => setEnrollStep(3)}
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', flex: 1 }}
                >
                  Back
                </button>
                <button 
                  type="button"
                  disabled={!isStepValid()}
                  onClick={() => setEnrollStep(5)}
                  style={{
                    backgroundColor: isStepValid() ? '#ffdd00' : 'rgba(255,255,255,0.05)',
                    color: isStepValid() ? '#000' : '#555',
                    border: 'none',
                    fontWeight: 'bold',
                    padding: '8px',
                    borderRadius: '4px',
                    cursor: isStepValid() ? 'pointer' : 'not-allowed',
                    fontSize: '11px',
                    flex: 1
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: BANK DETAILS */}
          {enrollStep === 5 && (
            <div className="flex flex-col gap-3 flex-grow">
              <div className="text-center mb-1">
                <Coins size={32} className="text-yellow-400 mx-auto" />
                <h4 className="text-sm font-bold mt-1 text-white">Payout Bank Details</h4>
                <p className="text-[10px] text-gray-400">Provide bank credentials to receive Captain payouts</p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold">Account Holder Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Subir Ganguly"
                  value={bankHolderName}
                  onChange={e => setBankHolderName(e.target.value)}
                  style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#fff', outline: 'none' }}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold">Account Number</label>
                <input 
                  type="text"
                  placeholder="e.g. 100344558832"
                  value={bankAccountNumber}
                  onChange={e => setBankAccountNumber(e.target.value)}
                  style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#fff', outline: 'none' }}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold">Bank IFSC Code</label>
                <input 
                  type="text"
                  placeholder="e.g. SBIN0003010"
                  value={bankIfscCode}
                  onChange={e => setBankIfscCode(e.target.value)}
                  style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#fff', outline: 'none' }}
                />
              </div>

              <div className="mt-auto pt-3 flex gap-2">
                <button 
                  type="button"
                  onClick={() => setEnrollStep(4)}
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', flex: 1 }}
                >
                  Back
                </button>
                <button 
                  type="button"
                  disabled={!isStepValid()}
                  onClick={() => setEnrollStep(6)}
                  style={{
                    backgroundColor: isStepValid() ? '#ffdd00' : 'rgba(255,255,255,0.05)',
                    color: isStepValid() ? '#000' : '#555',
                    border: 'none',
                    fontWeight: 'bold',
                    padding: '8px',
                    borderRadius: '4px',
                    cursor: isStepValid() ? 'pointer' : 'not-allowed',
                    fontSize: '11px',
                    flex: 1
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: SAFETY COMPLIANCE TRAINING & QUIZ */}
          {enrollStep === 6 && (
            <div className="flex flex-col gap-3 flex-grow pb-4">
              <div className="text-center mb-1">
                <UserCheck size={32} className="text-yellow-400 mx-auto animate-pulse" />
                <h4 className="text-sm font-bold mt-1 text-white">Step 6: Safety Compliance</h4>
                <p className="text-[10px] text-gray-400">Complete video training & safety quiz to enroll</p>
              </div>

              {/* Mock Safety Video Player */}
              <div className="p-3 bg-black/40 border border-white/5 rounded-lg flex flex-col gap-2">
                <span className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold">Safety Training Video (1 Min)</span>
                
                <div className="w-full h-32 bg-slate-900 rounded-lg relative overflow-hidden flex flex-col justify-between p-2 border border-white/10">
                  {videoProgress < 100 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
                      <span className="text-2xl">🛡️</span>
                      <span className="text-[9px] text-gray-400 text-center px-4">Watch driver safety directives to unlock quiz</span>
                      <button 
                        type="button"
                        onClick={() => {
                          if (isVideoPlaying) return;
                          setIsVideoPlaying(true);
                          const interval = setInterval(() => {
                            setVideoProgress(prev => {
                              if (prev >= 100) {
                                clearInterval(interval);
                                setIsVideoPlaying(false);
                                return 100;
                              }
                              return prev + 25;
                            });
                          }, 1000);
                        }}
                        className="px-4 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-black text-[10px] font-bold rounded-full cursor-pointer transition-all mt-1"
                      >
                        {isVideoPlaying ? `▶️ Playing... ${videoProgress}%` : "▶️ Play Safety Video"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex-grow flex flex-col items-center justify-center gap-1">
                      <span className="text-3xl animate-bounce">✅</span>
                      <span className="text-[10px] text-green-400 font-bold">Video Completed Successfully</span>
                    </div>
                  )}

                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 transition-all duration-300" style={{ width: `${videoProgress}%` }} />
                  </div>
                </div>
              </div>

              {/* Safety Quiz Questions (Only unlocked when video progress is 100) */}
              {videoProgress >= 100 && (
                <div className="flex flex-col gap-3">
                  
                  {/* Q1 */}
                  <div className="flex flex-col gap-1 p-2 bg-black/20 border border-white/5 rounded">
                    <span className="text-[10px] font-bold text-gray-300">Q1: Helmet & Seatbelt compliance policy?</span>
                    <div className="flex flex-col gap-1 mt-1">
                      {[
                        { key: 'A', text: 'Optional for riders' },
                        { key: 'B', text: 'Mandatory at all times' },
                        { key: 'C', text: 'Only on high-speed roads' }
                      ].map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setQ1Answer(opt.key)}
                          className={`text-[9px] text-left p-1.5 rounded border transition-all ${
                            q1Answer === opt.key 
                              ? 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40 font-semibold' 
                              : 'bg-black/40 text-gray-400 border-white/5 hover:text-white'
                          }`}
                        >
                          {opt.key}) {opt.text}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Q2 */}
                  <div className="flex flex-col gap-1 p-2 bg-black/20 border border-white/5 rounded">
                    <span className="text-[10px] font-bold text-gray-300">Q2: How to report route emergencies?</span>
                    <div className="flex flex-col gap-1 mt-1">
                      {[
                        { key: 'A', text: 'Ignore and continue' },
                        { key: 'B', text: 'Trigger the JoldiGo in-app SOS button' },
                        { key: 'C', text: 'Cancel the ride immediately' }
                      ].map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setQ2Answer(opt.key)}
                          className={`text-[9px] text-left p-1.5 rounded border transition-all ${
                            q2Answer === opt.key 
                              ? 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40 font-semibold' 
                              : 'bg-black/40 text-gray-400 border-white/5 hover:text-white'
                          }`}
                        >
                          {opt.key}) {opt.text}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Q3 */}
                  <div className="flex flex-col gap-1 p-2 bg-black/20 border border-white/5 rounded">
                    <span className="text-[10px] font-bold text-gray-300">Q3: When is index surge pricing active?</span>
                    <div className="flex flex-col gap-1 mt-1">
                      {[
                        { key: 'A', text: 'High demand, rain & peak hours' },
                        { key: 'B', text: 'Only during national holidays' },
                        { key: 'C', text: 'Determined at random' }
                      ].map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setQ3Answer(opt.key)}
                          className={`text-[9px] text-left p-1.5 rounded border transition-all ${
                            q3Answer === opt.key 
                              ? 'bg-yellow-400/20 text-yellow-300 border-yellow-400/40 font-semibold' 
                              : 'bg-black/40 text-gray-400 border-white/5 hover:text-white'
                          }`}
                        >
                          {opt.key}) {opt.text}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Compliance status badge */}
                  <div className="p-2 rounded text-[9px] font-semibold text-center border mt-1">
                    {isStepValid() ? (
                      <div className="text-green-400 bg-green-500/10 border-green-500/20">
                        🎉 Quiz Passed! You are safety compliant.
                      </div>
                    ) : (
                      <div className="text-yellow-400 bg-yellow-500/10 border-yellow-500/20">
                        ⚠️ Please watch video & answer all questions correctly.
                      </div>
                    )}
                  </div>

                </div>
              )}

              <div className="mt-auto pt-3 flex gap-2">
                <button 
                  type="button"
                  onClick={() => setEnrollStep(5)}
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', padding: '8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', flex: 1 }}
                >
                  Back
                </button>
                <button 
                  type="button"
                  disabled={!isStepValid()}
                  onClick={() => {
                    handleEnrollSubmit();
                    triggerSmsToast("WhatsApp Alert: Captain profile submitted for review. Documents DL, Aadhar, RC under review.", "WhatsApp Notification");
                  }}
                  style={{
                    backgroundColor: isStepValid() ? '#ffdd00' : 'rgba(255,255,255,0.05)',
                    color: isStepValid() ? '#000' : '#555',
                    border: 'none',
                    fontWeight: 'bold',
                    padding: '8px',
                    borderRadius: '4px',
                    cursor: isStepValid() ? 'pointer' : 'not-allowed',
                    fontSize: '11px',
                    flex: 1
                  }}
                >
                  Submit Application
                </button>
              </div>
            </div>
          )}

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
        {/* 1. Unverified Onboarding Portal */}
        {currentDriver.verificationStatus !== 'verified' && (
          <div className="app-screen-layout onboarding-screen" style={{ padding: '16px', display: 'flex', flexDirection: 'column', overflowY: 'auto', boxSizing: 'border-box' }}>
            <div className="onboarding-header text-center mb-3">
              <AlertOctagon size={40} className={currentDriver.verificationStatus === 'rejected' ? "text-red-500 mx-auto animate-bounce" : "text-amber-500 mx-auto animate-pulse"} />
              <h3 className="text-sm font-bold text-white mt-1">
                {currentDriver.verificationStatus === 'rejected' ? "Verification Rejected" : "Verification Pending"}
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {currentDriver.verificationStatus === 'rejected' 
                  ? "Some uploaded KYC document cards were rejected. Please review statuses below." 
                  : "Your onboarding profile and snaps are under review."}
              </p>
            </div>

            <div className="onboarding-card card-glow flex flex-col gap-2.5 p-3 rounded-lg border border-white/5 bg-black/40">
              <span className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold block border-b border-white/5 pb-1">
                KYC Document Statuses
              </span>
              
              {/* Document rows */}
              {[
                { label: 'Driving License', key: 'dl' },
                { label: 'Registration Certificate (RC)', key: 'rc' },
                { label: 'Vehicle Insurance', key: 'insurance' },
                { label: 'PUC Certificate', key: 'puc' },
                { label: 'Aadhaar / PAN Card', key: 'identity' }
              ].map(item => {
                const status = (currentDriver.documentStatuses && currentDriver.documentStatuses[item.key]) || 'pending';
                return (
                  <div key={item.key} className="flex justify-between items-center bg-black/20 p-2 rounded border border-white/5">
                    <span className="text-[10px] text-gray-300 font-medium">{item.label}</span>
                    <span 
                      className={`text-[8px] uppercase px-1.5 py-0.5 rounded font-extrabold ${
                        status === 'verified' 
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                          : status === 'rejected'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 animate-pulse'
                      }`}
                    >
                      {status === 'verified' && "✅ Verified"}
                      {status === 'rejected' && "❌ Rejected"}
                      {status === 'pending' && "⏳ Pending"}
                    </span>
                  </div>
                );
              })}

              <div className="alert mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 text-[10px] rounded text-yellow-300">
                💡 <b>Demo Admin Tip:</b> Go to the <b>Admin Panel</b>, select this simulated driver profile, and approve/reject individual documents to check state badge sync.
              </div>
            </div>
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
                      bottom: '144px',
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
                borderRadius: '16px',
                border: '1px solid rgba(0,0,0,0.12)',
                padding: '16px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                bottom: '12px',
                left: '12px',
                right: '12px'
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

                      <div style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.12)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', color: '#f59e0b', fontFamily: 'Outfit, sans-serif' }}>
                        <span className="animate-pulse" style={{ fontSize: '10px' }}>🛡️</span>
                        <span><b>নিরাপদ ড্রাইভিং মুড:</b> ওয়ান-ট্যাপ কুইক রিপ্লাই ব্যবহার করুন। এটি স্বয়ংক্রিয়ভাবে ইংরেজিতে অনুবাদ হবে।</span>
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

                      {/* Driver Performance Analytics */}
                      <div className="bg-black/30 border border-white/5 rounded-lg p-2.5 text-xs text-left flex flex-col gap-2">
                        <span className="text-[10px] text-gray-500 font-extrabold uppercase block tracking-wider">📊 Weekly Performance Metrics</span>
                        
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <div className="p-2 bg-black/40 border border-white/5 rounded flex flex-col justify-between">
                            <span className="text-[9px] text-gray-500 block">Weekly Online Hours:</span>
                            <span className="font-semibold text-white font-mono mt-0.5">
                              {currentDriver.status === 'online' ? '42.5 hrs' : '40.0 hrs'}
                            </span>
                          </div>
                          <div className="p-2 bg-black/40 border border-white/5 rounded flex flex-col justify-between">
                            <span className="text-[9px] text-gray-500 block">Ride Acceptance Rate:</span>
                            <span className="font-semibold text-emerald-400 font-mono mt-0.5">97.8%</span>
                          </div>
                        </div>

                        <div className="mt-1 flex flex-col gap-1">
                          <span className="text-[9px] text-gray-500 font-bold block">Top Commendation Tags:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded text-[8px] font-bold">🛡️ Safe Driving (24)</span>
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[8px] font-bold">🧼 Clean Car (18)</span>
                            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded text-[8px] font-bold">⏱️ Punctual (15)</span>
                          </div>
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
