import React, { useState, useEffect, useRef } from 'react';
import { useSimulator, KOLKATA_LOCATIONS, calculateDistance } from '../context/SimulatorContext';
import TariffGuideModal from './TariffGuideModal';
import TutorialTour from './TutorialTour';
import { 
  MapPin, 
  Car, 
  Bike, 
  History, 
  Star, 
  LogOut, 
  Navigation, 
  Check, 
  Shield, 
  Phone, 
  PhoneOff,
  AlertTriangle, 
  CreditCard,
  PlusCircle,
  Wallet,
  MessageSquare,
  Send,
  Volume2
} from 'lucide-react';
import L from 'leaflet';

const RainOverlay = ({ weather }) => {
  if (!weather || weather === 'clear') return null;
  const isSevere = weather === 'waterlogged' || weather === 'flooding';
  const dropCount = isSevere ? 45 : 20;
  const drops = Array.from({ length: dropCount }).map((_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 0.5 + Math.random() * 0.7
  }));

  return (
    <div className={`rain-overlay ${isSevere ? 'waterlogged' : ''}`}>
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
      {isSevere && <div className="waterlogging-flood-bar"></div>}
    </div>
  );
};

export default function PassengerApp({ isStandalone }) {
  const {
    drivers,
    geofence,
    geofencingZones,
    activeRide,
    settings,
    passenger,
    isNightMode,
    passengerWalletBalance,
    topUpPassengerWallet,
    chatMessages,
    sendChatMessage,
    loginPassenger,
    logoutPassenger,
    bookRide,
    completePaymentAndRate,
    cancelRide,
    fileDispute,
    calculateDetailedFare,
    getFuelSurchargePercentage,
    congestionZones,
    activeSmsToast,
    triggerSmsToast,
    connectPassengerSocket,
    sendOtpRequest,
    triggerPassengerSOS,
    sosAlerts,
    mapStyle,
    setMapStyle,
    simulationSpeed,
    addLog,
    playSound,
    callState,
    callFrom,
    callPartner,
    callDuration,
    initiateCall,
    acceptCall,
    endCall
  } = useSimulator();

  const speakText = (text, langCode) => {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode || 'en-US';

      // Load natural neural system voices dynamically
      const voices = window.speechSynthesis.getVoices();
      let selectedVoice = null;

      if (voices && voices.length > 0) {
        const langPrefix = (langCode || 'en').split('-')[0].toLowerCase();
        const matchingLanguageVoices = voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));

        if (matchingLanguageVoices.length > 0) {
          // Prioritize high-quality natural sounding neural voices
          selectedVoice = matchingLanguageVoices.find(v => 
            v.name.toLowerCase().includes('google') || 
            v.name.toLowerCase().includes('natural') || 
            v.name.toLowerCase().includes('premium') || 
            v.name.toLowerCase().includes('enhanced') || 
            v.name.toLowerCase().includes('siri')
          );

          // Fallbacks for macOS
          if (!selectedVoice) {
            selectedVoice = matchingLanguageVoices.find(v => 
              v.name.includes('Samantha') || 
              v.name.includes('Daniel') || 
              v.name.includes('Alex')
            );
          }

          // Fallback to first matching language voice
          if (!selectedVoice) {
            selectedVoice = matchingLanguageVoices[0];
          }
        }
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log(`[TTS Speech Passenger] Selected Voice: ${selectedVoice.name}`);
      }

      // Calm, clear cadence adjustments
      utterance.rate = 0.95; 
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      console.log(`[TTS Speech] Speaking: "${text}" in ${utterance.lang}`);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Text-to-speech failed:", e);
    }
  };

  const handleDownloadReceipt = (ride) => {
    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) return alert("Please allow popups to download your receipt.");
    
    printWindow.document.write(`
      <html>
        <head>
          <title>JoldiGo Ride Receipt - ${ride.id}</title>
          <style>
            body { font-family: sans-serif; padding: 30px; color: #111; line-height: 1.4; }
            .header { text-align: center; border-bottom: 2px dashed #ccc; padding-bottom: 15px; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; color: #ffaa00; margin: 0; }
            .subtitle { font-size: 12px; color: #666; margin-top: 5px; }
            .details-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .details-table td { padding: 8px 0; font-size: 14px; }
            .details-table .lbl { color: #555; }
            .details-table .val { text-align: right; font-weight: bold; }
            .divider { border-top: 1px solid #eee; margin: 10px 0; }
            .total-row { font-size: 18px; font-weight: bold; border-top: 2px dashed #ccc; padding-top: 10px; margin-top: 15px; display: flex; justify-content: space-between; }
            .footer { text-align: center; font-size: 11px; color: #888; margin-top: 40px; border-top: 1px solid #eee; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">JoldiGo Receipt</div>
            <div class="subtitle">Kolkata Ride-Hailing Simulation Network</div>
            <div class="subtitle">Receipt ID: ${ride.id} | Date: ${new Date().toLocaleDateString()}</div>
          </div>
          
          <table class="details-table">
            <tr>
              <td class="lbl">Passenger Phone</td>
              <td class="val">${ride.passengerPhone}</td>
            </tr>
            <tr>
              <td class="lbl">Pickup Location</td>
              <td class="val">${ride.pickupName}</td>
            </tr>
            <tr>
              <td class="lbl">Dropoff Location</td>
              <td class="val">${ride.dropoffName}</td>
            </tr>
            <tr>
              <td class="lbl">Ride Distance</td>
              <td class="val">${ride.distance.toFixed(2)} km</td>
            </tr>
            <tr>
              <td class="lbl">Payment Method</td>
              <td class="val" style="text-transform: uppercase;">${ride.paymentMethod}</td>
            </tr>
          </table>
          
          <div class="divider"></div>
          
          <table class="details-table">
            <tr>
              <td class="lbl">Base Ride Fare</td>
              <td class="val">₹${ride.grossBaseRideFare.toFixed(2)}</td>
            </tr>
            <tr>
              <td class="lbl">Passenger GST (5%)</td>
              <td class="val">+₹${ride.gstAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <td class="lbl">Toll / Bridge Fees</td>
              <td class="val">₹${ride.tollEstimate || 0}</td>
            </tr>
            <tr>
              <td class="lbl">Safety Insurance Premium</td>
              <td class="val">+₹2.00</td>
            </tr>
            ${ride.discountApplied > 0 ? `
            <tr style="color: #22c55e;">
              <td class="lbl">Promo Code Discount (${ride.promoCode || 'Applied'})</td>
              <td class="val">-₹${ride.discountApplied.toFixed(2)}</td>
            </tr>
            ` : ''}
          </table>
          
          <div class="total-row">
            <span>Net Amount Paid</span>
            <span style="color: #ffaa00;">₹${ride.totalFare.toFixed(2)}</span>
          </div>
          
          <div style="font-size: 9px; font-family: monospace; color: #888; margin-top: 20px; text-align: center; word-break: break-all;">
            Contract Cryptographic Proof:<br/>
            ${ride.contractHash}
          </div>
          
          <div class="footer">
            Thank you for riding with JoldiGo!<br/>
            Kolkata Operations Control Board.
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  useEffect(() => {
    if (passenger.isLoggedIn && passenger.phone) {
      connectPassengerSocket(passenger.phone);
    }
  }, [passenger.isLoggedIn, passenger.phone]);

  // Navigation & Tabs
  const [tab, setTab] = useState('home'); 
  const [phoneInput, setPhoneInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [selectedRideForInvoice, setSelectedRideForInvoice] = useState(null);

  // Location inputs
  const [pickupKey, setPickupKey] = useState('PARK_STREET');
  const [dropoffKey, setDropoffKey] = useState('AIRPORT');
  const [waypointKey, setWaypointKey] = useState('');
  const [vehicleType, setVehicleType] = useState('car_ac'); 
  const [paymentMethod, setPaymentMethod] = useState('wallet'); 

  // Dispute forms UI
  const [activeDisputeFormId, setActiveDisputeFormId] = useState(null);
  const [complaintText, setComplaintText] = useState('');

  // Top Up Modal State
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(500);
  const [topUpStep, setTopUpStep] = useState('select'); 
  const [showTariffGuide, setShowTariffGuide] = useState(false); 
  const [showTutorial, setShowTutorial] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('joldigo_tutorial_completed') !== 'true';
      } catch (e) {
        console.warn("Storage access blocked:", e);
        return false;
      }
    }
    return false;
  }); 
  const [topUpCardNumber, setTopUpCardNumber] = useState('');
  const [topUpCardExpiry, setTopUpCardExpiry] = useState('');
  const [topUpCardCvv, setTopUpCardCvv] = useState('');
  const [topUpCardName, setTopUpCardName] = useState('');
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [referralInput, setReferralInput] = useState('');
  const [isReferralClaimed, setIsReferralClaimed] = useState(false);
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const [speechListeningTarget, setSpeechListeningTarget] = useState(null);
  const [speechListeningPrompt, setSpeechListeningPrompt] = useState('');

  // Chat Drawer state
  const [showChat, setShowChat] = useState(false);
  const [chatInputText, setChatInputText] = useState('');
  const chatEndRef = useRef(null);
  
  // AI Support chatbot states
  const [showAiSupport, setShowAiSupport] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState([
    { id: '1', sender: 'ai', text: 'Hello! I am your JoldiGo AI Safety & Care Assistant. 🤖 How can I help you today?\n\n- Type "fare" to query your last ride details.\n- Type "yes" after querying to file a formal dispute.\n- Type "lost" if you left an item in your captain\'s vehicle.\n\n(Ami Bangla, Hindi o English e sohaayota korte pari!)' }
  ]);
  const [aiInputText, setAiInputText] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const aiChatEndRef = useRef(null);

  // Razorpay payment sheet state
  const [selectedPayment, setSelectedPayment] = useState('upi');
  const [starRating, setStarRating] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [paymentStep, setPaymentStep] = useState('select'); 
  const [selectedTip, setSelectedTip] = useState(0); 
  const [customTip, setCustomTip] = useState(''); 

  // Razorpay Sandbox Overlay States
  const [showRazorpaySheet, setShowRazorpaySheet] = useState(false);
  const [rzpMethod, setRzpMethod] = useState('upi'); // 'upi', 'card', 'netbanking'
  const [rzpCardNumber, setRzpCardNumber] = useState('');
  const [rzpCardExpiry, setRzpCardExpiry] = useState('');
  const [rzpCardCvv, setRzpCardCvv] = useState('');
  const [rzpUpiOption, setRzpUpiOption] = useState('gpay'); // 'gpay', 'phonepe', 'paytm'
  const [rzpSelectedBank, setRzpSelectedBank] = useState('SBI');
  const [rzpPaymentStatus, setRzpPaymentStatus] = useState('idle'); // 'idle', 'authorizing', 'otp', 'success'
  const [rzpOtpInput, setRzpOtpInput] = useState('');

  // Promo code states
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [discount, setDiscount] = useState(0);
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');
  const [showPromoDrawer, setShowPromoDrawer] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  const applySpecificPromoCode = (code) => {
    setPromoError('');
    setPromoSuccess('');
    const codeVal = code.toUpperCase();
    
    if (codeVal === 'JOLDIGO50') {
      setAppliedPromo('JOLDIGO50');
      setDiscount(50);
      setPromoSuccess('🎉 Promo applied: ₹50 discount matched!');
    } else if (codeVal === 'MONSOONFREE') {
      if (settings.weather === 'rain' || settings.weather === 'waterlogged' || settings.weather === 'flooding') {
        setAppliedPromo('MONSOONFREE');
        setDiscount(100);
        setPromoSuccess('🌧️ Monsoon Promo applied: ₹100 safety discount matched!');
      } else {
        setPromoError('❌ Valid only during active monsoon/flooding alerts.');
      }
    } else if (codeVal === 'JOLDISAVE') {
      setAppliedPromo('JOLDISAVE');
      setDiscount(25);
      setPromoSuccess('🎉 JoldiSave applied: ₹25 discount matched!');
    } else if (codeVal === 'FIRSTGO') {
      setAppliedPromo('FIRSTGO');
      setDiscount(75);
      setPromoSuccess('🚀 FIRSTGO applied: ₹75 discount matched!');
    } else {
      setPromoError('❌ Invalid promo code.');
    }
  };

  const handleApplyPromo = (e) => {
    if (e) e.preventDefault();
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    applySpecificPromoCode(code);
  };

  // Map elements
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersRef = useRef({
    pickup: null,
    dropoff: null,
    driver: null,
    geofencePolygon: null,
    geofencePolygons: [],
    trafficCircles: [], 
    otherDrivers: [],
  });

  // Handle auto login for demo convenience
  useEffect(() => {
    if (!passenger.isLoggedIn && tab === 'home') {
      setTab('auth');
    }
  }, [passenger.isLoggedIn]);

  // Scroll chat drawer to bottom on new messages
  useEffect(() => {
    if (showChat && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

  // Scroll AI chat drawer to bottom on new messages
  useEffect(() => {
    if (showAiSupport && aiChatEndRef.current) {
      aiChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiChatMessages, showAiSupport]);

  const handleSendAiMessage = async (e, textOverride) => {
    if (e) e.preventDefault();
    const queryText = textOverride || aiInputText;
    if (!queryText.trim()) return;

    const userMessage = {
      id: Math.random().toString(),
      sender: 'user',
      text: queryText
    };

    setAiChatMessages(prev => [...prev, userMessage]);
    const messageToSend = queryText;
    setAiInputText('');
    setIsAiTyping(true);

    try {
      const { api } = getServerEndpoints();
      const res = await fetch(`${api}/api/passenger/ai-support`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: passenger.phone,
          message: messageToSend
        })
      });
      const data = await res.json();
      
      setIsAiTyping(false);
      if (data.success) {
        setAiChatMessages(prev => [...prev, {
          id: Math.random().toString(),
          sender: 'ai',
          text: data.reply
        }]);
      } else {
        setAiChatMessages(prev => [...prev, {
          id: Math.random().toString(),
          sender: 'ai',
          text: 'Sorry, I encountered an issue processing your request. Please try again.'
        }]);
      }
    } catch (err) {
      const { api } = getServerEndpoints();
      console.error("AI Support fetch error details:", err);
      setIsAiTyping(false);
      setAiChatMessages(prev => [...prev, {
        id: Math.random().toString(),
        sender: 'ai',
        text: `Connection error. Please check your internet connection.\n\n[Requested URL]: ${api}/api/passenger/ai-support\n[Error Details]: ${err.message}`
      }]);
    }
  };

  const handleQuickAction = (text) => {
    handleSendAiMessage({ preventDefault: () => {} }, text);
  };

  // Close chat when ride resets
  useEffect(() => {
    if (!activeRide) {
      setShowChat(false);
    }
  }, [activeRide]);

  // Fallback vehicle selection if weather changes to waterlogged
  useEffect(() => {
    if (settings.weather === 'waterlogged' && vehicleType === 'bike') {
      setVehicleType('car_ac');
    }
  }, [settings.weather, vehicleType]);

  // Leaflet Map Initialization
  useEffect(() => {
    if (tab !== 'home' || !passenger.isLoggedIn || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
    }).setView([22.5726, 88.3639], 12);

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

    const geofenceCoords = geofence.map(c => [c.lat, c.lng]);
    const geofencePolygon = L.polygon(geofenceCoords, {
      color: '#ffdd00',
      weight: 1.5,
      fillColor: '#ffdd00',
      fillOpacity: 0.03,
      dashArray: '5, 8',
    }).addTo(map);
    markersRef.current.geofencePolygon = geofencePolygon;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [tab, passenger.isLoggedIn, geofence]);

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

  // Update Map Markers (including traffic circles)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old layers
    if (markersRef.current.pickup) map.removeLayer(markersRef.current.pickup);
    if (markersRef.current.dropoff) map.removeLayer(markersRef.current.dropoff);
    
    const hasActiveDriver = activeRide && activeRide.status !== 'searching' && drivers.some(d => d.id === activeRide.driverId);
    if (!hasActiveDriver && markersRef.current.driver) {
      map.removeLayer(markersRef.current.driver);
      markersRef.current.driver = null;
    }
    if (markersRef.current.police) {
      map.removeLayer(markersRef.current.police);
      markersRef.current.police = null;
    }
    if (markersRef.current.policePolyline) {
      map.removeLayer(markersRef.current.policePolyline);
      markersRef.current.policePolyline = null;
    }
    if (markersRef.current.geofencePolygons) {
      markersRef.current.geofencePolygons.forEach(p => map.removeLayer(p));
    }
    markersRef.current.geofencePolygons = [];
    if (markersRef.current.traveledPolyline) {
      map.removeLayer(markersRef.current.traveledPolyline);
      markersRef.current.traveledPolyline = null;
    }
    if (markersRef.current.remainingPolyline) {
      map.removeLayer(markersRef.current.remainingPolyline);
      markersRef.current.remainingPolyline = null;
    }
    markersRef.current.otherDrivers.forEach(m => map.removeLayer(m));
    markersRef.current.otherDrivers = [];

    if (markersRef.current.trafficCircles) {
      markersRef.current.trafficCircles.forEach(c => map.removeLayer(c));
    }
    markersRef.current.trafficCircles = [];

    // Draw Traffic Geofence Circles
    const zones = [
      { key: 'HOWRAH_BRIDGE', name: 'Howrah Bridge', lat: 22.5851, lng: 88.3468 },
      { key: 'PARK_STREET', name: 'Park Street Core', lat: 22.5530, lng: 88.3524 },
      { key: 'SALT_LAKE_SEC5', name: 'Sector V Tech Hub', lat: 22.5735, lng: 88.4331 },
    ];
    zones.forEach(z => {
      const status = congestionZones[z.key] || 'clear';
      let color = '#22c55e'; 
      if (status === 'heavy') color = '#ef4444'; 
      else if (status === 'medium') color = '#f97316'; 

      const circle = L.circle([z.lat, z.lng], {
        color: color,
        fillColor: color,
        fillOpacity: 0.1,
        radius: 600,
        weight: 1.5,
        dashArray: '4, 4'
      }).addTo(map).bindPopup(`<b>${z.name}</b><br/>Congestion: ${status.toUpperCase()}`);

      markersRef.current.trafficCircles.push(circle);
    });

    // Draw active geofencing zones
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

    const pickupIcon = L.divIcon({
      className: 'custom-map-marker pickup-marker',
      html: `<div class="marker-pin pin-pickup"><span class="pin-dot"></span></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const dropoffIcon = L.divIcon({
      className: 'custom-map-marker dropoff-marker',
      html: `<div class="marker-pin pin-dropoff"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const activeDriverIcon = L.divIcon({
      className: 'custom-map-marker active-driver-marker',
      html: `<div class="marker-pin pin-driver ${activeRide?.vehicleType}">
               <span class="pulse-ring"></span>
             </div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    if (activeRide) {
      markersRef.current.pickup = L.marker([activeRide.pickup.lat, activeRide.pickup.lng], { icon: pickupIcon }).addTo(map);
      markersRef.current.dropoff = L.marker([activeRide.dropoff.lat, activeRide.dropoff.lng], { icon: dropoffIcon }).addTo(map);

      // Draw route polylines (split trail: traveled green vs remaining yellow)
      if (activeRide.route) {
        const idx = activeRide.routeIndex || 0;
        const traveledCoords = activeRide.route.slice(0, idx + 1).map(p => [p.lat, p.lng]);
        const remainingCoords = activeRide.route.slice(idx).map(p => [p.lat, p.lng]);

        if (traveledCoords.length > 1) {
          markersRef.current.traveledPolyline = L.polyline(traveledCoords, {
            color: '#00ff66',
            weight: 5,
            opacity: 0.9,
            className: 'glowing-green-trail'
          }).addTo(map);
        }

        if (remainingCoords.length > 0) {
          markersRef.current.remainingPolyline = L.polyline(remainingCoords, {
            color: '#ffdd00',
            weight: 5,
            opacity: 0.8,
            className: 'animated-route-path'
          }).addTo(map);
        }
      }

      if (activeRide.status !== 'searching') {
        const assignedDriver = drivers.find(d => d.id === activeRide.driverId);
        if (assignedDriver) {
          const targetLatLng = L.latLng(assignedDriver.location.lat, assignedDriver.location.lng);
          
          if (!markersRef.current.driver) {
            markersRef.current.driver = L.marker(targetLatLng, { icon: activeDriverIcon }).addTo(map);
            map.panTo(targetLatLng);
          } else {
            const startLatLng = markersRef.current.driver.getLatLng();
            if (startLatLng.lat !== targetLatLng.lat || startLatLng.lng !== targetLatLng.lng) {
              const animStart = performance.now();
              const animDuration = Math.max(200, simulationSpeed - 20);
              
              const step = (timestamp) => {
                const elapsed = timestamp - animStart;
                const progress = Math.min(elapsed / animDuration, 1);
                
                const currLat = startLatLng.lat + (targetLatLng.lat - startLatLng.lat) * progress;
                const currLng = startLatLng.lng + (targetLatLng.lng - startLatLng.lng) * progress;
                
                if (markersRef.current.driver) {
                  markersRef.current.driver.setLatLng([currLat, currLng]);
                  if (activeRide.status === 'in_progress' || activeRide.status === 'arrived') {
                    map.panTo([currLat, currLng]);
                  }
                }
                
                if (progress < 1) {
                  requestAnimationFrame(step);
                }
              };
              
              requestAnimationFrame(step);
            }
          }
        }
      } else {
        map.fitBounds([
          [activeRide.pickup.lat, activeRide.pickup.lng],
          [activeRide.dropoff.lat, activeRide.dropoff.lng],
        ], { padding: [40, 40] });
      }
    } else {
      const pickupLoc = KOLKATA_LOCATIONS[pickupKey];
      const dropoffLoc = KOLKATA_LOCATIONS[dropoffKey];
      const waypointLoc = waypointKey ? KOLKATA_LOCATIONS[waypointKey] : null;

      if (pickupLoc) {
        markersRef.current.pickup = L.marker([pickupLoc.lat, pickupLoc.lng], { icon: pickupIcon }).addTo(map);
      }
      if (waypointLoc) {
        const stopIcon = L.divIcon({
          className: 'custom-map-marker stopover-marker',
          html: `<div class="marker-pin stopover" style="background-color: #ecc94b; border: 2px solid #fff; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #000; box-shadow: 0 0 10px rgba(236,201,75,0.6)">📍</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        markersRef.current.waypoint = L.marker([waypointLoc.lat, waypointLoc.lng], { icon: stopIcon }).addTo(map);
      }
      if (dropoffLoc) {
        markersRef.current.dropoff = L.marker([dropoffLoc.lat, dropoffLoc.lng], { icon: dropoffIcon }).addTo(map);
      }

      if (pickupLoc && dropoffLoc) {
        const bounds = [
          [pickupLoc.lat, pickupLoc.lng],
          [dropoffLoc.lat, dropoffLoc.lng]
        ];
        if (waypointLoc) bounds.push([waypointLoc.lat, waypointLoc.lng]);
        map.fitBounds(bounds, { padding: [40, 40] });
      }

      // Draw active SOS dispatch on map
      const activeSos = activeRide ? sosAlerts.find(alert => alert.driverId === activeRide.driverId) : null;
      if (activeSos) {
        const policeIcon = L.divIcon({
          className: 'custom-map-marker police-marker',
          html: `<div class="marker-pin pin-police animate-pulse" style="font-size: 16px; background-color: #ef4444; border: 2px solid #fff; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px rgba(239,68,68,0.9)">🚓</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });
        markersRef.current.police = L.marker([activeSos.policeLocation.lat, activeSos.policeLocation.lng], { icon: policeIcon }).addTo(map);
        
        if (activeSos.policeRoute) {
          const remainingPoliceCoords = activeSos.policeRoute.slice(activeSos.policeRouteIndex).map(p => [p.lat, p.lng]);
          if (remainingPoliceCoords.length > 0) {
            markersRef.current.policePolyline = L.polyline(remainingPoliceCoords, {
              color: '#ef4444',
              weight: 3,
              opacity: 0.8,
              dashArray: '4, 6'
            }).addTo(map);
          }
        }
      }

      drivers.forEach(d => {
        if (d.status === 'online' && d.verificationStatus === 'verified') {
          const otherDrvIcon = L.divIcon({
            className: 'custom-map-marker other-driver-marker',
            html: `<div class="marker-pin-mini ${d.vehicleType}"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          const m = L.marker([d.location.lat, d.location.lng], { icon: otherDrvIcon }).addTo(map);
          markersRef.current.otherDrivers.push(m);
        }
      });
    }
  }, [activeRide, drivers, pickupKey, dropoffKey, waypointKey, tab, congestionZones, geofencingZones, sosAlerts]);

  // Login handlers
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phoneInput || phoneInput.length < 10) {
      setOtpError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setOtpError('');
    setIsOtpSent(true);
    await sendOtpRequest(phoneInput);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const res = await loginPassenger(phoneInput, otpInput, nameInput);
    if (res.success) {
      setTab('home');
      setIsOtpSent(false);
      setPhoneInput('');
      setOtpInput('');
      setNameInput('');
    } else {
      setOtpError(res.error || 'Incorrect OTP. Try "1234" for testing.');
    }
  };

  // Booking Flow
  const handleBook = () => {
    const pickupLoc = KOLKATA_LOCATIONS[pickupKey];
    const dropoffLoc = KOLKATA_LOCATIONS[dropoffKey];
    if (pickupLoc === dropoffLoc) {
      alert("Pickup and Drop-off locations cannot be the same!");
      return;
    }

    // Safety check: block bike request booking under flooding conditions
    if (vehicleType === 'bike' && (settings.weather === 'waterlogged' || settings.weather === 'flooding')) {
      alert("❌ SAFETY RESTRICTION: Bike dispatch is suspended due to severe flooding/waterlogging! Please request an AC or Non-AC Car instead.");
      return;
    }
    
    bookRide(pickupLoc, dropoffLoc, vehicleType, paymentMethod, appliedPromo, discount);
    
    // Clear promo codes on booking
    setPromoInput('');
    setAppliedPromo('');
    setDiscount(0);
    setPromoSuccess('');
    setPromoError('');
  };

  const handleCancelWithFeeWarning = () => {
    if (activeRide && (activeRide.status === 'accepted' || activeRide.status === 'arrived' || activeRide.status === 'in_progress')) {
      const penaltyAmount = Math.min(100, activeRide.totalFare * 0.10).toFixed(0);
      const confirmCancel = window.confirm(
        `⚠️ CANCELLATION PENALTY WARNING:\n\nCancelling this active trip will incur a compliant fee of ₹${penaltyAmount} (10% of fare capped at ₹100) deducted from your Wallet.\n\nAre you sure you want to proceed?`
      );
      if (confirmCancel) {
        cancelRide();
      }
    } else {
      cancelRide();
    }
  };

  const openTopUpModal = (amount = 500) => {
    setTopUpAmount(amount);
    setTopUpCardNumber('');
    setTopUpCardExpiry('');
    setTopUpCardCvv('');
    setTopUpCardName('');
    setIsCardFlipped(false);
    setTopUpStep('select');
    setShowTopUpModal(true);
  };

  const executeWalletTopUp = () => {
    if (rzpOtpInput !== '123456') {
      alert("Invalid OTP code! Please use 123456.");
      return;
    }
    setTopUpStep('processing');
    setTimeout(async () => {
      try {
        const { api } = getServerEndpoints();
        const verifyRes = await fetch(`${api}/api/passenger/wallet/topup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: passenger.phone, amount: topUpAmount })
        });
        const verifyData = await verifyRes.json();
        if (verifyData.success) {
          setPassengerWalletBalance(parseFloat(verifyData.wallet_balance || 0));
          setTopUpStep('success');
          setRzpOtpInput('');
          setTimeout(() => {
            setShowTopUpModal(false);
            setTopUpStep('select');
          }, 1500);
        } else {
          alert("Top-up request failed!");
          setTopUpStep('verify');
        }
      } catch (err) {
        console.error(err);
        // Local fallback
        setPassengerWalletBalance(prev => prev + topUpAmount);
        setTopUpStep('success');
        setRzpOtpInput('');
        setTimeout(() => {
          setShowTopUpModal(false);
          setTopUpStep('select');
        }, 1500);
      }
    }, 1200);
  };

  const handleCardNumberChange = (e) => {
    let value = e.target.value.replace(/\D/g, '').slice(0, 16);
    let formatted = value.match(/.{1,4}/g)?.join(' ') || '';
    setTopUpCardNumber(formatted);
  };

  const handleCardExpiryChange = (e) => {
    let value = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (value.length > 2) {
      value = value.slice(0, 2) + '/' + value.slice(2);
    }
    setTopUpCardExpiry(value);
  };

  const handleCardCvvChange = (e) => {
    let value = e.target.value.replace(/\D/g, '').slice(0, 3);
    setTopUpCardCvv(value);
  };
  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInputText.trim()) return;
    sendChatMessage('passenger', chatInputText.trim());
    setChatInputText('');
  };

  const handleClaimReferral = async (e) => {
    if (e) e.preventDefault();
    const code = referralInput.trim().toUpperCase();
    if (!code) return;
    
    if (isReferralClaimed) {
      alert("❌ You have already claimed a referral bonus in this session!");
      return;
    }
    
    if (code === `JOLDIPASS${passenger.phone.slice(-5)}`) {
      alert("❌ You cannot claim your own referral code!");
      return;
    }
    
    if (code.startsWith('JOLDI') || code.startsWith('FRIEND') || code.length >= 6) {
      setIsReferralClaimed(true);
      setReferralInput('');
      
      try {
        const { api } = getServerEndpoints();
        const res = await fetch(`${api}/api/passenger/wallet/topup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: passenger.phone, amount: 50 })
        });
        const data = await res.json();
        if (data.success) {
          setPassengerWalletBalance(parseFloat(data.wallet_balance || 0));
        } else {
          setPassengerWalletBalance(prev => prev + 50);
        }
      } catch (err) {
        setPassengerWalletBalance(prev => prev + 50);
      }
      
      if (playSound) playSound();
      if (addLog) {
        addLog(`🎁 Referral Bonus Claimed: Passenger ${passenger.name} applied code ${code}. ₹50 credited!`, 'success');
      }
      
      alert(`🎉 Success! Applied code ${code}. ₹50 Referral Bonus has been credited to your wallet!`);
    } else {
      alert("❌ Invalid referral invite code format! Use FRIEND50 or JOLDIxxx.");
    }
  };

  const startVoiceListening = (target) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech Recognition not supported in this browser. Please use Chrome or Safari.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    
    recognition.onstart = () => {
      setIsListeningSpeech(true);
      setSpeechListeningTarget(target);
      setSpeechListeningPrompt(`Listening for ${target} location in Kolkata...`);
    };
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      console.log("Voice transcript received:", transcript);
      
      // Check emergency SOS commands
      if (transcript.includes('emergency') || transcript.includes('help') || transcript.includes('sos') || transcript.includes('police')) {
        alert(`🚨 Voice Command Activated: Triggering Passenger SOS!`);
        triggerPassengerSOS(passenger.phone);
        setIsListeningSpeech(false);
        return;
      }
      
      // Match against Kolkata locations
      let matchedKey = null;
      
      Object.entries(KOLKATA_LOCATIONS).forEach(([key, loc]) => {
        const nameLower = loc.name.toLowerCase();
        
        if (transcript.includes(nameLower) || nameLower.includes(transcript)) {
          matchedKey = key;
        } else {
          const keywords = nameLower.split(' ');
          keywords.forEach(word => {
            if (word.length > 3 && transcript.includes(word)) {
              matchedKey = key;
            }
          });
        }
      });
      
      if (matchedKey) {
        if (target === 'pickup') {
          setPickupKey(matchedKey);
        } else if (target === 'dropoff') {
          setDropoffKey(matchedKey);
        } else if (target === 'waypoint') {
          setWaypointKey(matchedKey);
        }
        
        if (playSound) playSound();
        alert(`🎙️ Spoken: "${event.results[0][0].transcript}"\nMatched location: ${KOLKATA_LOCATIONS[matchedKey].name}`);
      } else {
        alert(`🎙️ Spoken: "${event.results[0][0].transcript}"\nCould not match to any Kolkata operational locations. Please speak clearly.`);
      }
    };
    
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListeningSpeech(false);
    };
    
    recognition.onend = () => {
      setIsListeningSpeech(false);
    };
    
    recognition.start();
  };

  const PASSENGER_QUICK_REPLIES = [
    "Where are you?",
    "Please wait, I'm coming.",
    "I'm at the main gate.",
    "Are you carrying change?",
    "Coming in 2 minutes."
  ];

  const getPreviewMetrics = (vType = vehicleType) => {
    const pick = KOLKATA_LOCATIONS[pickupKey];
    const drop = KOLKATA_LOCATIONS[dropoffKey];
    if (!pick || !drop) return { distance: 0, totalFare: 0, contractHash: '', baseFare: 0, fuelSurcharge: 0, grossBaseRideFare: 0, gstAmount: 0, tollEstimate: 0, commission: 0, takeHome: 0, insurancePremium: 0, surgeMultiplier: 1.0, trafficMultiplier: 1.0, trafficZoneName: null };
    
    let dist = 0;
    if (waypointKey && KOLKATA_LOCATIONS[waypointKey]) {
      const stop = KOLKATA_LOCATIONS[waypointKey];
      dist = calculateDistance(pick.lat, pick.lng, stop.lat, stop.lng) + calculateDistance(stop.lat, stop.lng, drop.lat, drop.lng);
    } else {
      dist = calculateDistance(pick.lat, pick.lng, drop.lat, drop.lng);
    }
    
    const calculated = calculateDetailedFare(dist, vType === 'auto' ? 'bike' : vType, pick, drop);
    if (vType === 'auto') {
      calculated.totalFare = Math.round(calculated.totalFare * 1.35);
      calculated.grossBaseRideFare = calculated.grossBaseRideFare * 1.35;
      calculated.gstAmount = calculated.gstAmount * 1.35;
    }
    return {
      distance: dist,
      ...calculated
    };
  };

  const metrics = getPreviewMetrics();
  const acMetrics = getPreviewMetrics('car_ac');
  const nonAcMetrics = getPreviewMetrics('car_non_ac');
  const bikeMetrics = getPreviewMetrics('bike');
  const autoMetrics = getPreviewMetrics('auto');

  const renderPanelOverlay = () => {
    if (!activeRide) {
      return (
        <div className="passenger-booking-panel card-glow animate-slide-up" style={{ maxHeight: '82vh', display: 'flex', flexDirection: 'column', paddingBottom: '16px' }}>
          <div className="panel-handle"></div>
          
          <h3 className="panel-title">Where to?</h3>

          {settings.weather !== 'clear' && (
            <div className={`weather-banner-msg mb-3 p-2 rounded-lg text-[10px] flex items-center gap-2 border ${
              settings.weather === 'rain' 
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' 
                : 'bg-red-500/10 border-red-500/20 text-red-300'
            }`}>
              <span className="text-xs">{settings.weather === 'rain' ? '🌧️' : '🌊'}</span>
              <span>
                {settings.weather === 'rain' 
                  ? 'Monsoon Rain Alert: Dynamic 1.15x surge applied on standard ride fares.'
                  : 'Severe Waterlogging: 1.25x surge active. Bike bookings suspended for safety compliance.'}
              </span>
            </div>
          )}

          {/* Location Selector */}
          <div className="location-picker-group">
            <div className="picker-row">
              <div className="picker-dot green"></div>
              <div className="picker-field">
                <label>Pickup Location</label>
                <div className="flex gap-1.5 items-center w-full">
                  <select value={pickupKey} onChange={(e) => setPickupKey(e.target.value)} className="flex-1 min-w-0">
                    {Object.entries(KOLKATA_LOCATIONS).map(([key, loc]) => (
                      <option key={key} value={key}>{loc.name} ({loc.zone})</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => startVoiceListening('pickup')}
                    className="p-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 flex items-center justify-center cursor-pointer transition-all duration-200"
                    title="Speak Pickup Location"
                    style={{ flexShrink: 0, width: '24px', height: '24px', fontSize: '10px' }}
                  >
                    🎙️
                  </button>
                </div>
              </div>
            </div>

            <div className="picker-line"></div>

            {/* OPTIONAL INTERMEDIATE STOPOVER WAYPOINT */}
            <div className="picker-row" style={{ opacity: waypointKey ? 1.0 : 0.65 }}>
              <div className="picker-dot yellow animate-pulse" style={{ backgroundColor: '#ecc94b' }}></div>
              <div className="picker-field">
                <div className="flex justify-between items-center pr-2">
                  <label className="text-yellow-400">Add Stopover (Optional)</label>
                  {waypointKey && (
                    <button 
                      type="button" 
                      onClick={() => setWaypointKey('')} 
                      className="text-[9px] text-red-400 hover:text-red-300 font-bold border border-red-500/20 px-1 py-0.5 rounded bg-red-950/20"
                    >
                      Clear Stop
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5 items-center w-full">
                  <select value={waypointKey} onChange={(e) => setWaypointKey(e.target.value)} className="flex-1 min-w-0">
                    <option value="">-- No Stopover --</option>
                    {Object.entries(KOLKATA_LOCATIONS).map(([key, loc]) => (
                      <option key={key} value={key} disabled={key === pickupKey || key === dropoffKey}>{loc.name} ({loc.zone})</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => startVoiceListening('waypoint')}
                    className="p-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 flex items-center justify-center cursor-pointer transition-all duration-200"
                    title="Speak Stopover"
                    style={{ flexShrink: 0, width: '24px', height: '24px', fontSize: '10px' }}
                  >
                    🎙️
                  </button>
                </div>
              </div>
            </div>

            <div className="picker-line"></div>

            <div className="picker-row">
              <div className="picker-dot red"></div>
              <div className="picker-field">
                <label>Dropoff Location</label>
                <div className="flex gap-1.5 items-center w-full">
                  <select value={dropoffKey} onChange={(e) => setDropoffKey(e.target.value)} className="flex-1 min-w-0">
                    {Object.entries(KOLKATA_LOCATIONS).map(([key, loc]) => (
                      <option key={key} value={key}>{loc.name} ({loc.zone})</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => startVoiceListening('dropoff')}
                    className="p-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center justify-center cursor-pointer transition-all duration-200"
                    title="Speak Dropoff Location"
                    style={{ flexShrink: 0, width: '24px', height: '24px', fontSize: '10px' }}
                  >
                    🎙️
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="divider-h mt-3"></div>

          {/* Start Scrollable middle body container */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '2px', marginTop: '4px', WebkitOverflowScrolling: 'touch' }} className="custom-scroll">
            
            {/* Vehicle Selection Cards */}
            <div className="vehicle-selector">
            {/* 1. Bike */}
            <button 
              className={`vehicle-card ${vehicleType === 'bike' ? 'selected' : ''} ${bikeMetrics.totalFare === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
              onClick={() => bikeMetrics.totalFare > 0 && setVehicleType('bike')}
              disabled={bikeMetrics.totalFare === 0}
              title={bikeMetrics.totalFare === 0 ? 'Bikes suspended due to heavy flooding/waterlogging' : 'Select Bike'}
            >
              <div className="vehicle-icon-bg bike-bg">
                <Bike className="vh-icon" />
              </div>
              <div className="vehicle-info">
                <div className="flex items-center gap-1.5">
                  <span className="vh-name">JoldiGo Bike</span>
                  {bikeMetrics.surgeMultiplier > 1 && (
                    <span className="bg-amber-500/20 text-amber-400 text-[8px] font-bold px-1.5 py-0.2 rounded font-mono">
                      {bikeMetrics.surgeMultiplier}x Surge
                    </span>
                  )}
                </div>
                <span className="vh-eta">{bikeMetrics.totalFare === 0 ? 'Safety Suspended (Flooding)' : `ETA: 2 mins • Fast & nimble`}</span>
              </div>
              <span className="vh-price">{bikeMetrics.totalFare === 0 ? 'Suspended' : `₹${bikeMetrics.totalFare.toFixed(0)}`}</span>
            </button>

            {/* 2. Auto */}
            <button 
              className={`vehicle-card ${vehicleType === 'auto' ? 'selected' : ''}`}
              onClick={() => setVehicleType('auto')}
            >
              <div className="vehicle-icon-bg auto-bg" style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                <Car className="vh-icon" />
              </div>
              <div className="vehicle-info">
                <div className="flex items-center gap-1.5">
                  <span className="vh-name">JoldiGo Auto</span>
                  {bikeMetrics.surgeMultiplier > 1 && (
                    <span className="bg-amber-500/20 text-amber-400 text-[8px] font-bold px-1.5 py-0.2 rounded font-mono">
                      {bikeMetrics.surgeMultiplier}x Surge
                    </span>
                  )}
                </div>
                <span className="vh-eta">ETA: 3 mins • Open-air local ride</span>
              </div>
              <span className="vh-price">₹{autoMetrics.totalFare.toFixed(0)}</span>
            </button>

            {/* 3. Non-AC Car */}
            <button 
              className={`vehicle-card ${vehicleType === 'car_non_ac' ? 'selected' : ''}`}
              onClick={() => setVehicleType('car_non_ac')}
            >
              <div className="vehicle-icon-bg car-bg" style={{ backgroundColor: 'rgba(255,160,0,0.1)', color: '#ff9c00' }}>
                <Car className="vh-icon" />
              </div>
              <div className="vehicle-info">
                <div className="flex items-center gap-1.5">
                  <span className="vh-name">JoldiGo Non-AC Car</span>
                  {nonAcMetrics.surgeMultiplier > 1 && (
                    <span className="bg-amber-500/20 text-amber-400 text-[8px] font-bold px-1.5 py-0.2 rounded font-mono">
                      {nonAcMetrics.surgeMultiplier}x Surge
                    </span>
                  )}
                </div>
                <span className="vh-eta">ETA: 5 mins • Standard budget transport</span>
              </div>
              <span className="vh-price">₹{nonAcMetrics.totalFare.toFixed(0)}</span>
            </button>

            {/* 4. AC Car */}
            <button 
              className={`vehicle-card ${vehicleType === 'car_ac' ? 'selected' : ''}`}
              onClick={() => setVehicleType('car_ac')}
            >
              <div className="vehicle-icon-bg car-bg">
                <Car className="vh-icon" />
              </div>
              <div className="vehicle-info">
                <div className="flex items-center gap-1.5">
                  <span className="vh-name">JoldiGo AC Car</span>
                  {acMetrics.surgeMultiplier > 1 && (
                    <span className="bg-amber-500/20 text-amber-400 text-[8px] font-bold px-1.5 py-0.2 rounded font-mono">
                      {acMetrics.surgeMultiplier}x Surge
                    </span>
                  )}
                </div>
                <span className="vh-eta">ETA: 4 mins • Premium AC Sedan</span>
              </div>
              <span className="vh-price">₹{acMetrics.totalFare.toFixed(0)}</span>
            </button>
          </div>

          {/* Payment Method Selector */}
          <div className="payment-upfront-selector mt-3">
            <span className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Pre-Flight Payment Method</span>
            <div className="flex gap-2">
              <button 
                className={`btn-secondary flex-1 py-1.5 text-xs justify-center ${paymentMethod === 'wallet' ? 'border-amber-400 bg-amber-500/10 text-amber-300' : ''}`}
                onClick={() => setPaymentMethod('wallet')}
              >
                UPI/Wallet Pay
              </button>
              <button 
                className={`btn-secondary flex-1 py-1.5 text-xs justify-center ${paymentMethod === 'cash' ? 'border-amber-400 bg-amber-500/10 text-amber-300' : ''}`}
                onClick={() => setPaymentMethod('cash')}
              >
                Cash to Partner
              </button>
            </div>
          </div>

          {/* Promo Code Selector */}
          <div className="promo-code-selector mt-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-gray-500 font-bold uppercase">Apply Coupon Code</span>
              <button
                type="button"
                onClick={() => setShowPromoDrawer(true)}
                className="text-[9px] text-amber-400 hover:text-amber-300 font-bold underline bg-transparent border-none p-0 cursor-pointer"
              >
                🎟️ View Offers
              </button>
            </div>
            <form onSubmit={handleApplyPromo} className="flex gap-2">
              <input 
                type="text" 
                placeholder="e.g. JOLDIGO50" 
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                disabled={appliedPromo !== ''}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white flex-1 outline-none uppercase"
              />
              {appliedPromo ? (
                <button 
                  type="button"
                  onClick={() => {
                    setAppliedPromo('');
                    setDiscount(0);
                    setPromoSuccess('');
                  }}
                  className="px-2 py-1 bg-red-950/40 border border-red-500/20 text-red-400 rounded text-xs"
                >
                  Remove
                </button>
              ) : (
                <button 
                  type="submit"
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded text-xs transition-all"
                >
                  Apply
                </button>
              )}
            </form>
            {promoError && <span className="text-[9px] text-red-400 block mt-1">{promoError}</span>}
            {promoSuccess && <span className="text-[9px] text-green-400 block mt-1">{promoSuccess}</span>}
          </div>

          {/* Pricing splits Invoice */}
          <div className="trust-fare-breakdown-box mt-3 p-3 bg-black/40 border border-white/5 rounded-lg text-xs">
            <div className="flex justify-between text-gray-400">
              <span>Ride Base Fare:</span>
              <span className="font-semibold text-white">₹{metrics.grossBaseRideFare.toFixed(2)}</span>
            </div>
            
            {metrics.fuelSurcharge > 0 && (
              <div className="flex justify-between text-gray-400 mt-1">
                <span>⛽ Fuel Index Surcharge ({metrics.fuelType}):</span>
                <span className="text-gray-300 font-semibold">+₹{metrics.fuelSurcharge.toFixed(2)}</span>
              </div>
            )}
            
            {/* TRAFFIC SURCHARGE LINE */}
            {metrics.trafficMultiplier > 1.0 && (
              <div className="flex justify-between text-orange-400 mt-1">
                <span>Congestion Fee ({metrics.trafficZoneName}):</span>
                <span className="font-semibold">+{((metrics.trafficMultiplier - 1.0) * 100).toFixed(0)}% ({metrics.trafficMultiplier}x)</span>
              </div>
            )}

            <div className="flex justify-between text-gray-400 mt-1">
              <span>Govt Tax (5% GST):</span>
              <span className="text-gray-300 font-semibold">+₹{metrics.gstAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-400 mt-1">
              <span>Mandated Driver Insurance:</span>
              <span className="text-gray-300 font-semibold">+₹{metrics.insurancePremium.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-400 mt-1">
              <span>Estimated Tolls:</span>
              <span className="text-gray-300 font-semibold">+₹{metrics.tollEstimate}</span>
            </div>

            {discount > 0 && (
              <div className="flex justify-between text-green-400 mt-1">
                <span>Promo Discount ({appliedPromo}):</span>
                <span className="font-semibold">-₹{discount.toFixed(2)}</span>
              </div>
            )}

            <div className="border-t border-white/5 my-2 pt-2 flex justify-between text-[11px] text-gray-400">
              <span>Aggregator Net Cut (Commission - Discount):</span>
              <span>-₹{(metrics.commission - discount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-emerald-400 font-semibold">
              <span>Driver Payout Split (95% - Kept Whole):</span>
              <span>₹{metrics.takeHome.toFixed(2)}</span>
            </div>
            <div className="border-t border-white/10 mt-2 pt-2 flex justify-between items-center text-xs font-bold text-white">
              <span>Estimated Commuter Pay:</span>
              <span className="text-amber-500 text-sm">₹{Math.max(20, metrics.totalFare - discount).toFixed(2)}</span>
            </div>
            <div className="border-t border-white/5 mt-2 pt-1.5 flex justify-between items-center text-[9px] text-gray-500 font-mono">
              <span>Compliant Contract Hash:</span>
              <span className="text-amber-500 font-bold">{metrics.contractHash.substr(0, 16)}</span>
            </div>
          </div>

          {/* TRAFFIC CONGESTION ZONE WARNING BADGE */}
          {metrics.trafficMultiplier > 1.0 && (
            <div className="surge-warning-badge mt-2" style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)', borderColor: 'rgba(249, 115, 22, 0.2)', color: '#fdba74' }}>
              <AlertTriangle size={14} className="warn-icon" />
              <span>⚠️ Proximity Congestion: Surcharge applied near {metrics.trafficZoneName}.</span>
            </div>
          )}

          {isNightMode && (
            <div className="surge-warning-badge mt-2" style={{ backgroundColor: 'rgba(129, 140, 248, 0.1)', borderColor: 'rgba(129, 140, 248, 0.2)', color: '#a5b4fc' }}>
              <AlertTriangle size={14} className="warn-icon" />
              <span>⚡ Night Surcharge: 1.2x multiplier applied (10 PM - 6 AM).</span>
            </div>
          )}

          {settings.surgeMultiplier > 1.0 && !isNightMode && (
            <div className="surge-warning-badge mt-2">
              <AlertTriangle size={14} className="warn-icon" />
              <span>Surge Pricing Active: Fares scaled by {settings.surgeMultiplier}x.</span>
            </div>
          )}

          {paymentMethod === 'wallet' && passengerWalletBalance < Math.max(20, metrics.totalFare - discount) && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded-lg text-xs mt-3 flex justify-between items-center">
              <span>⚠️ Insufficient Balance for booking!</span>
              <button 
                className="bg-red-900/60 border border-red-500/30 text-red-200 px-2 py-0.5 rounded text-[10px] font-bold"
                onClick={() => {
                  const amt = Math.ceil((Math.max(20, metrics.totalFare - discount) - passengerWalletBalance) / 100) * 100;
                  openTopUpModal(amt);
                }}
              >
                Top Up Wallet
              </button>
            </div>
          )}
          </div>
          {/* End Scrollable middle body container */}

          <button 
            className="btn-primary full-width mt-3 animate-pulse-btn" 
            onClick={handleBook}
            disabled={paymentMethod === 'wallet' && passengerWalletBalance < Math.max(20, metrics.totalFare - discount)}
            style={{ opacity: (paymentMethod === 'wallet' && passengerWalletBalance < Math.max(20, metrics.totalFare - discount)) ? 0.5 : 1 }}
          >
            Book JoldiGo {vehicleType === 'car_ac' ? 'AC Car' : (vehicleType === 'car_non_ac' ? 'Non-AC Car' : 'Bike')}
          </button>
        </div>
      );
    }

    if (activeRide.status === 'searching') {
      return (
        <div className="passenger-booking-panel card-glow animate-slide-up text-center">
          <div className="searching-container">
            <div className="searching-pulse">
              <div className="radar-circle c1"></div>
              <div className="radar-circle c2"></div>
              <div className="radar-circle c3"></div>
              {activeRide.vehicleType.startsWith('car') ? <Car size={32} className="radar-center-icon" /> : <Bike size={32} className="radar-center-icon" />}
            </div>
            
            <h3 className="searching-status mt-4">Finding your JoldiGo partner</h3>
            <p className="searching-desc">Broadcasting transparent dispatch payload...</p>
            
            <div className="countdown-timer-pill">
              ⏱️ {activeRide.timer} seconds remaining
            </div>

            <button className="btn-secondary full-width mt-5" onClick={cancelRide}>
              Cancel Request
            </button>
          </div>
        </div>
      );
    }

    const matchedDriver = drivers.find(d => d.id === activeRide.driverId);

    if (activeRide.status === 'accepted' || activeRide.status === 'arrived' || activeRide.status === 'in_progress') {
      return (
        <div className="passenger-booking-panel card-glow animate-slide-up">
          <div className="panel-handle"></div>
          
          <div className="ride-status-header">
            <div className="status-badge green">
              <span className="pulse-dot"></span>
              {activeRide.status === 'accepted' && 'Driver Heading to Pickup'}
              {activeRide.status === 'arrived' && 'Driver Arrived at Pickup'}
              {activeRide.status === 'in_progress' && 'Ride in Progress'}
            </div>
            <span className="eta-text">
              {activeRide.status === 'accepted' && 'ETA ~3 mins'}
              {activeRide.status === 'arrived' && 'Ready for Boarding'}
              {activeRide.status === 'in_progress' && 'ETA ~8 mins'}
            </span>
          </div>

          <div className="divider-h mt-2 mb-3"></div>

          {/* Active Police Dispatch Banner */}
          {(() => {
            const activeSos = sosAlerts.find(alert => alert.driverId === activeRide.driverId);
            if (!activeSos) return null;
            return (
              <div 
                className="p-3 rounded-lg text-white mb-3 text-left border flex flex-col gap-1 transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(30, 64, 175, 0.95))',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  boxShadow: '0 0 15px rgba(239, 68, 68, 0.5)',
                  animation: 'pulse 1.5s infinite alternate'
                }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black tracking-wider uppercase flex items-center gap-1">
                    🚨🚔 Police Dispatch Active
                  </span>
                  <span className="text-[8px] bg-white/20 px-1.5 py-0.5 rounded font-mono uppercase font-black">
                    {activeSos.status}
                  </span>
                </div>
                <p className="text-[10px] font-bold mt-1 text-white">
                  {activeSos.status === 'dispatch' 
                    ? `Patrol interceptor is en-route to intercept vehicle. ETA: ${activeSos.eta} seconds.`
                    : `Patrol interceptor secured. Officers have arrived at vehicle location.`}
                </p>
                <span className="text-[8px] text-white/70 italic mt-0.5">
                  Secure satellite connection established with control room. Stay calm.
                </span>
              </div>
            );
          })()}

          {/* Driver Card Info */}
          <div className="driver-card-compact">
            <div className="drv-avatar-large">
              {matchedDriver?.avatar || 'D'}
            </div>
            
            <div className="drv-details-middle">
              <div className="drv-row-top">
                <span className="drv-name-large">{matchedDriver?.name}</span>
                <span className="drv-rating-badge">
                  <Star size={12} fill="#ffdd00" color="#ffdd00" />
                  <span>{matchedDriver?.rating}</span>
                </span>
              </div>
              <span className="drv-vehicle-details">{matchedDriver?.vehicleName}</span>
              <span className="drv-vehicle-number">{matchedDriver?.vehicleNumber}</span>
            </div>

            <div className="drv-contact-btn flex gap-2">
              <button 
                className={`circle-btn-phone ${showChat ? 'bg-amber-500 text-black' : 'bg-black/50 text-white border border-white/10'}`} 
                onClick={() => setShowChat(!showChat)}
                title="Bilingual Chat"
              >
                <MessageSquare size={16} />
              </button>

              <button 
                onClick={() => initiateCall('driver', matchedDriver?.id, passenger?.phone || 'Passenger Rider')} 
                className="circle-btn-phone"
                title="VoIP Secure Call"
              >
                <Phone size={16} />
              </button>
            </div>
          </div>

          <div className="mt-3 p-2 bg-black/40 border border-white/5 rounded text-[10px] font-mono text-gray-500 flex justify-between items-center">
            <span>Contract Sign Hash:</span>
            <span className="text-yellow-400 font-bold">{activeRide.contractHash.substr(0,18)}...</span>
          </div>

          <div className="trip-safety-indicator mt-3">
            <Shield size={16} className="safety-icon" />
            <span>Secured with JoldiGo SafeTrip GPS tracking.</span>
          </div>

          <button className="btn-secondary full-width mt-4" onClick={handleCancelWithFeeWarning}>
            Cancel Ride
          </button>

          {/* PASSENGER BILINGUAL SLIDE CHAT DRAWER */}
          {showChat && (
            <div className="chat-slide-drawer card-glow animate-slide-up">
              <div className="chat-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="text-emerald-400 font-bold">•</span>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>Chat with {matchedDriver?.name}</span>
                </div>
                <button style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }} onClick={() => setShowChat(false)}>×</button>
              </div>

              <div style={{ backgroundColor: 'rgba(16,185,129,0.08)', borderBottom: '1px solid rgba(16,185,129,0.12)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', color: '#10b981', fontFamily: 'Outfit, sans-serif' }}>
                <span className="animate-pulse" style={{ fontSize: '10px' }}>🛡️</span>
                <span><b>Safe Driving Mode:</b> One-tap quick replies are recommended. Auto-translates to driver's Bengali.</span>
              </div>

              {/* Message bubbles */}
              <div className="chat-messages-container" style={{ height: '180px' }}>
                {chatMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', fontSize: '10px', color: '#555', marginTop: '32px', fontStyle: 'italic' }}>
                    Tap a quick reply or type to begin bilingual translation chat.
                  </div>
                ) : (
                  chatMessages.map(msg => {
                    const isSelf = msg.sender === 'passenger';
                    return (
                      <div key={msg.id} className={`chat-row ${isSelf ? 'self' : 'peer'}`}>
                        <div className={`chat-bubble ${isSelf ? 'chat-bubble-self' : 'chat-bubble-peer'} flex items-center justify-between gap-1.5`}>
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

              {/* English Passenger Quick-Replies Grid */}
              <div className="chat-quick-replies-grid">
                {PASSENGER_QUICK_REPLIES.map((reply, idx) => (
                  <button 
                    key={idx}
                    className="quick-reply-btn"
                    onClick={() => sendChatMessage('passenger', reply)}
                  >
                    {reply}
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <form onSubmit={handleSendChat} className="chat-input-form">
                <input 
                  type="text" 
                  placeholder="Type message in English..." 
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
      );
    }

    if (activeRide.status === 'completed') {
      return (
        <div className="razorpay-sheet card-glow animate-slide-up">
          <div className="razorpay-header flex justify-between items-center">
            <div className="rzp-title">
              <span className="badge-rzp">RAZORPAY Secure</span>
              <h4>JoldiGo Technologies</h4>
            </div>
            <div className="rzp-amount">₹{activeRide.totalFare}</div>
          </div>

          {paymentStep === 'select' && (
            <div className="payment-body">
              <p className="payment-instructions">Pay via selected option to complete your trip contract:</p>
              
              <div className="payment-methods">
                <label className={`payment-method-row ${selectedPayment === 'upi' ? 'active' : ''}`}>
                  <input 
                    type="radio" 
                    name="payOption" 
                    value="upi"
                    checked={selectedPayment === 'upi'}
                    onChange={() => setSelectedPayment('upi')} 
                  />
                  <div className="pm-label">
                    <span className="pm-title">JoldiGo Wallet Pay (Balance: ₹{passengerWalletBalance.toFixed(2)})</span>
                    <span className="pm-subtitle">Deduct instantly from your top-up balance</span>
                  </div>
                </label>

                <label className={`payment-method-row ${selectedPayment === 'card' ? 'active' : ''}`}>
                  <input 
                    type="radio" 
                    name="pmOption" 
                    value="card" 
                    checked={selectedPayment === 'card'}
                    onChange={() => setSelectedPayment('card')} 
                  />
                  <div className="pm-label">
                    <span className="pm-title">Credit or Debit Card</span>
                    <span className="pm-subtitle">Secure card authorization gateway</span>
                  </div>
                </label>

                <label className={`payment-method-row ${selectedPayment === 'cash' ? 'active' : ''}`}>
                  <input 
                    type="radio" 
                    name="pmOption" 
                    value="cash" 
                    checked={selectedPayment === 'cash'}
                    onChange={() => setSelectedPayment('cash')} 
                  />
                  <div className="pm-label">
                    <span className="pm-title">Pay via Cash (Pre-Flight: {activeRide.paymentMethod.toUpperCase()})</span>
                    <span className="pm-subtitle">Handover to driver upon completion</span>
                  </div>
                </label>
              </div>

              {selectedPayment === 'upi' && passengerWalletBalance < activeRide.totalFare && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2.5 rounded-lg text-xs mt-3 flex justify-between items-center">
                  <span>⚠️ Insufficient Wallet Balance!</span>
                  <button 
                    className="bg-red-900/60 border border-red-500/30 text-red-200 px-3 py-1 rounded text-[10px] font-bold"
                    onClick={() => {
                      const amt = Math.ceil((activeRide.totalFare - passengerWalletBalance) / 100) * 100;
                      openTopUpModal(amt);
                    }}
                  >
                    Top Up ₹{Math.ceil((activeRide.totalFare - passengerWalletBalance) / 100) * 100}
                  </button>
                </div>
              )}

              <div className="my-3 p-2 bg-black/40 border border-white/5 rounded text-[10px] font-mono text-gray-500 flex justify-between">
                <span>Verification Contract Hash:</span>
                <span className="text-amber-500 font-semibold">{activeRide.contractHash.substr(0,18)}</span>
              </div>

              <button 
                className="btn-pay-rzp mt-2" 
                disabled={selectedPayment === 'upi' && passengerWalletBalance < activeRide.totalFare}
                style={{ opacity: (selectedPayment === 'upi' && passengerWalletBalance < activeRide.totalFare) ? 0.5 : 1 }}
                onClick={() => {
                  setShowRazorpaySheet(true);
                  setRzpPaymentStatus('idle');
                }}
              >
                Proceed to Pay ₹{activeRide.totalFare}
              </button>
            </div>
          )}

          {paymentStep === 'processing' && (
            <div className="payment-body text-center py-6">
              <div className="spinner-rzp"></div>
              <p className="mt-3 font-medium text-amber-500">Contacting Payment Gateway...</p>
              <p className="text-xs text-gray-400 font-mono">Verify Hash: {activeRide.contractHash.substr(0,12)}...</p>
            </div>
          )}

          {paymentStep === 'feedback' && (
            <div className="payment-body text-center">
              <div className="success-icon-container">
                <div className="success-circle">
                  <Check size={32} color="#00ff66" />
                </div>
              </div>

              <h4 className="payment-success-title mt-3">Payment Successful!</h4>
              <p className="payment-success-desc font-semibold">₹{activeRide.totalFare} paid (Includes ₹{activeRide.gstAmount} GST & ₹2 Insur)</p>
 
              {/* RIDE INVOICE RECEIPT CARD */}
              <div className="bg-black/40 border border-white/5 rounded-xl p-3 my-3 text-left flex flex-col gap-1.5 text-xs">
                <span className="text-[10px] text-amber-500 font-extrabold uppercase tracking-wider block">🧾 Official Ride Receipt</span>
                
                <div className="flex justify-between">
                  <span className="text-gray-400">Pickup Location:</span>
                  <span className="font-semibold text-white truncate max-w-[170px]">{activeRide.pickupName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Dropoff Location:</span>
                  <span className="font-semibold text-white truncate max-w-[170px]">{activeRide.dropoffName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Distance:</span>
                  <span className="font-semibold text-white">{activeRide.distance.toFixed(2)} km</span>
                </div>
                
                <div className="h-[1px] bg-white/5 my-1"></div>
 
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400">Base Ride Fare:</span>
                  <span className="text-gray-200">₹{activeRide.grossBaseRideFare.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400">Passenger GST (5%):</span>
                  <span className="text-gray-200">+₹{activeRide.gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400">Toll / Bridge Fees:</span>
                  <span className="text-gray-200">₹{activeRide.tollEstimate || 0}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400">Safety Insurance Cover:</span>
                  <span className="text-gray-200">+₹2.00</span>
                </div>
                
                {activeRide.discountApplied > 0 && (
                  <div className="flex justify-between text-[11px] text-green-400 font-semibold">
                    <span>Promo Discount:</span>
                    <span>-₹{activeRide.discountApplied.toFixed(2)}</span>
                  </div>
                )}
 
                <div className="h-[1px] bg-white/10 my-1"></div>
 
                <div className="flex justify-between text-sm font-bold text-white">
                  <span>Net Charged:</span>
                  <span className="text-amber-400">₹{activeRide.totalFare.toFixed(2)}</span>
                </div>
                
                <div className="text-[8px] font-mono text-gray-500 mt-1 truncate font-mono">
                  Contract Receipt: {activeRide.contractHash}
                </div>
 
                <button 
                  type="button"
                  onClick={() => handleDownloadReceipt(activeRide)}
                  style={{
                    backgroundColor: 'rgba(255,221,0,0.1)',
                    border: '1px solid rgba(255,221,0,0.3)',
                    color: 'var(--color-primary)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    marginTop: '8px',
                    textAlign: 'center',
                    transition: 'all 0.2s'
                  }}
                  className="hover:bg-amber-400 hover:text-black flex items-center justify-center gap-1.5"
                >
                  📥 Download PDF Receipt
                </button>
              </div>
 
              <div className="divider-h my-3"></div>

              <p className="rating-instructions">Rate your trip with {matchedDriver?.name}:</p>
              
              <div className="rating-stars-row mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                    key={star} 
                    type="button" 
                    onClick={() => setStarRating(star)}
                    className="star-btn"
                  >
                    <Star 
                      size={28} 
                      fill={star <= starRating ? "#ffdd00" : "none"} 
                      color={star <= starRating ? "#ffdd00" : "#555"} 
                    />
                  </button>
                ))}
              </div>

              {/* FEEDBACK COMMENT INPUT */}
              <div className="mt-3 flex flex-col gap-1 w-full px-2 text-left">
                <label className="text-[9px] uppercase tracking-wider text-gray-400 font-extrabold block">Feedback Comment</label>
                <input 
                  type="text"
                  placeholder="e.g. Clean Car, Safe Driving!"
                  value={ratingComment}
                  onChange={e => setRatingComment(e.target.value)}
                  style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                />
              </div>

              {/* HAPPY RIDE TIPS WIDGET */}
              <div className="happy-ride-tips-container mt-3 p-3 bg-black/40 border border-white/5 rounded-xl text-center">
                <span className="text-[11px] font-extrabold text-amber-500 uppercase tracking-wider block mb-1">🎁 Happy Ride Tips</span>
                <p className="text-[9px] text-gray-400 mb-3">100% of your tip goes directly to {matchedDriver?.name} to appreciate their service.</p>
                
                <div className="flex gap-2 justify-center mb-2">
                  {[20, 50, 100].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setSelectedTip(amt);
                        setCustomTip('');
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        borderRadius: '8px',
                        border: selectedTip === amt ? '1px solid #ffba08' : '1px solid rgba(255,255,255,0.1)',
                        backgroundColor: selectedTip === amt ? 'rgba(255,186,8,0.15)' : 'rgba(0,0,0,0.3)',
                        color: selectedTip === amt ? '#ffba08' : '#aaa',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      +₹{amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTip('custom');
                    }}
                    style={{
                      padding: '6px 12px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      borderRadius: '8px',
                      border: selectedTip === 'custom' ? '1px solid #ffba08' : '1px solid rgba(255,255,255,0.1)',
                      backgroundColor: selectedTip === 'custom' ? 'rgba(255,186,8,0.15)' : 'rgba(0,0,0,0.3)',
                      color: selectedTip === 'custom' ? '#ffba08' : '#aaa',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Custom
                  </button>
                </div>

                {selectedTip === 'custom' && (
                  <input
                    type="number"
                    placeholder="Enter tip amount in ₹"
                    value={customTip}
                    onChange={(e) => setCustomTip(Math.max(1, parseInt(e.target.value) || ''))}
                    style={{
                      width: '80%',
                      margin: '6px auto 0 auto',
                      textAlign: 'center',
                      fontSize: '11px',
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      padding: '4px'
                    }}
                    className="font-mono"
                  />
                )}

                {selectedTip !== 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTip(0);
                      setCustomTip('');
                    }}
                    className="text-[9px] text-red-400 font-bold underline bg-transparent border-none mt-2 cursor-pointer"
                  >
                    Remove Tip
                  </button>
                )}
              </div>

              <button 
                className="btn-primary full-width mt-4" 
                onClick={() => {
                  const finalTip = selectedTip === 'custom' ? (parseInt(customTip) || 0) : selectedTip;
                  completePaymentAndRate(starRating, ratingComment, finalTip);
                  setPaymentStep('select');
                  setSelectedTip(0);
                  setCustomTip('');
                  setRatingComment('');
                }}
              >
                Submit & Book Again
              </button>
            </div>
          )}
        </div>
      );
    }
  };

  const renderCallOverlay = () => {
    if (callState === 'idle') return null;

    const isInvolved = (callFrom === 'passenger') || 
                       (callFrom === 'driver' && callPartner?.role === 'passenger' && callPartner?.id === passenger.phone);
                       
    if (!isInvolved) return null;

    const partnerName = callPartner?.name || 'Driver Partner';
    const partnerRoleLabel = callPartner?.role === 'driver' ? 'Jaldi Go Driver' : 'Jaldi Go Rider';

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
              👨‍✈️
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          {callState === 'dialing' && (
            <div style={{ fontSize: '14px', color: '#a0aec0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="animate-pulse">●</span> Dialing driver...
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
                onClick={() => endCall('driver', callPartner.id)}
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
                onClick={() => acceptCall('driver', callPartner.id)}
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
                onClick={() => endCall('driver', callPartner?.id || matchedDriver?.id)}
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

  return (
    <div className="mobile-phone-frame">
      {!isStandalone && <div className="phone-notch"></div>}
      
      {!isStandalone && (
        <div className="phone-status-bar">
          <span className="phone-time">08:18</span>
          <div className="phone-icons">
            <span className="signal">📶</span>
            <span className="wifi">📶</span>
            <span className="battery">🔋 94%</span>
          </div>
        </div>
      )}

      <div className="phone-screen-content">
        <RainOverlay weather={settings.weather} />

        {/* AI SAFETY & CARE CHATBOT DRAWER */}
        {showAiSupport && (
          <div 
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.98)',
              backdropFilter: 'blur(16px)',
              borderTop: '2px solid rgba(245, 158, 11, 0.4)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              zIndex: 9999,
              padding: '18px 16px 16px 16px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -12px 40px rgba(0, 0, 0, 0.95)',
              height: '430px',
            }}
            className="animate-slide-up text-left"
          >
            <div className="flex justify-between items-center pb-3 border-b border-white/10 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="relative w-8 h-8 flex items-center justify-center bg-amber-500/10 border border-amber-500/30 rounded-full">
                  <span className="text-base">🤖</span>
                  <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-slate-900 rounded-full animate-pulse"></span>
                </div>
                <div>
                  <h4 className="text-[11px] font-black uppercase text-amber-400 tracking-wider">JoldiGo Support Bot</h4>
                  <span className="text-[9px] text-gray-500 font-black block uppercase tracking-tight">Active Online • Safety & Care Agent</span>
                </div>
              </div>
              <button 
                className="w-6 h-6 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full border border-white/10 text-gray-400 hover:text-white transition"
                onClick={() => setShowAiSupport(false)}
              >
                ✕
              </button>
            </div>

            {/* Message Body */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin scrollbar-thumb-white/10 mb-2.5 text-[11px]">
              {aiChatMessages.map(msg => (
                <div key={msg.id} className={`flex gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.sender !== 'user' && (
                    <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[10px] shrink-0">
                      🤖
                    </div>
                  )}
                  <div 
                    className={`max-w-[78%] rounded-xl px-3 py-2 leading-relaxed whitespace-pre-line shadow-md border ${
                      msg.sender === 'user' 
                        ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black border-amber-500/30 font-bold rounded-tr-none' 
                        : 'bg-white/5 border-white/10 text-slate-100 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.sender === 'user' && (
                    <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] shrink-0">
                      👤
                    </div>
                  )}
                </div>
              ))}
              {isAiTyping && (
                <div className="flex gap-2 justify-start">
                  <div className="w-5 h-5 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[10px] shrink-0">
                    🤖
                  </div>
                  <div className="bg-white/5 border border-white/10 text-gray-400 rounded-xl rounded-tl-none px-3 py-2 italic flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-duration:0.8s]"></span>
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.4s]"></span>
                  </div>
                </div>
              )}
              <div ref={aiChatEndRef} />
            </div>

            {/* Quick Action Suggestion Row */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-none shrink-0">
              <button 
                type="button"
                onClick={() => handleQuickAction('check last fare')}
                className="px-2.5 py-1 bg-white/5 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 rounded-full text-[9px] text-gray-400 hover:text-amber-400 font-bold tracking-wide transition shrink-0 uppercase cursor-pointer"
              >
                📄 Check Last Fare
              </button>
              <button 
                type="button"
                onClick={() => handleQuickAction('yes')}
                className="px-2.5 py-1 bg-white/5 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 rounded-full text-[9px] text-gray-400 hover:text-amber-400 font-bold tracking-wide transition shrink-0 uppercase cursor-pointer"
              >
                ⚖️ File Dispute
              </button>
              <button 
                type="button"
                onClick={() => handleQuickAction('lost item')}
                className="px-2.5 py-1 bg-white/5 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 rounded-full text-[9px] text-gray-400 hover:text-amber-400 font-bold tracking-wide transition shrink-0 uppercase cursor-pointer"
              >
                🎒 Lost Item
              </button>
            </div>

            {/* Input Footer */}
            <form onSubmit={handleSendAiMessage} className="flex gap-2 border-t border-white/5 pt-3 shrink-0">
              <input 
                type="text" 
                placeholder="Ask about last fare, lost item..." 
                value={aiInputText}
                onChange={(e) => setAiInputText(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-xs text-white flex-1 outline-none focus:border-amber-400 transition"
              />
              <button 
                type="submit" 
                className="w-9 h-9 flex items-center justify-center bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        )}

        {/* PROMO CODES SLIDING DRAWER */}
        {showPromoDrawer && (
          <div 
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'rgba(10, 10, 10, 0.98)',
              borderTop: '1px solid rgba(255, 255, 255, 0.15)',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              zIndex: 9999,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.8)',
              maxHeight: '380px',
              overflowY: 'auto'
            }}
            className="animate-slide-up text-left"
          >
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <span className="text-xs font-black uppercase text-amber-500 tracking-wider">🎟️ Available Promo Codes</span>
              <button
                type="button"
                onClick={() => setShowPromoDrawer(false)}
                className="text-[10px] text-gray-400 hover:text-white font-bold bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded cursor-pointer border-none"
              >
                Close
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { code: 'JOLDIGO50', value: '₹50 Off', desc: 'Flat discount on any booking.', restriction: 'None' },
                { code: 'FIRSTGO', value: '₹75 Off', desc: 'Commence your first JoldiGo ride.', restriction: 'First time user' },
                { code: 'JOLDISAVE', value: '₹25 Off', desc: 'Save on standard commuter fares.', restriction: 'None' },
                { code: 'MONSOONFREE', value: '₹100 Off', desc: 'Active safety surcharge relief cover.', restriction: 'Valid only during Rain/Floods' }
              ].map((promo) => {
                const isMonsoonAlert = settings.weather === 'rain' || settings.weather === 'waterlogged' || settings.weather === 'flooding';
                const isPromoBlocked = promo.code === 'MONSOONFREE' && !isMonsoonAlert;

                return (
                  <div 
                    key={promo.code}
                    className={`p-3 rounded-lg border text-left flex justify-between items-center transition-all ${
                      isPromoBlocked 
                        ? 'border-white/5 bg-white/2 opacity-40 cursor-not-allowed' 
                        : 'border-white/10 bg-black/40 hover:border-amber-400/50 cursor-pointer'
                    }`}
                    onClick={() => {
                      if (!isPromoBlocked) {
                        applySpecificPromoCode(promo.code);
                        setPromoInput(promo.code);
                        setShowPromoDrawer(false);
                      }
                    }}
                  >
                    <div className="flex-1 flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-extrabold text-white font-mono bg-white/10 px-1.5 py-0.5 rounded">{promo.code}</span>
                        <span className="text-[10px] font-black text-amber-400">{promo.value}</span>
                      </div>
                      <p className="text-[9px] text-gray-400 mt-1">{promo.desc}</p>
                      <span className="text-[8px] text-gray-600 font-semibold uppercase">Condition: {promo.restriction}</span>
                    </div>

                    <button
                      type="button"
                      disabled={isPromoBlocked}
                      style={{
                        padding: '4px 8px',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        borderRadius: '4px',
                        backgroundColor: isPromoBlocked ? 'rgba(255,255,255,0.05)' : 'rgba(255,221,0,0.1)',
                        border: isPromoBlocked ? '1px solid transparent' : '1px solid rgba(255,221,0,0.3)',
                        color: isPromoBlocked ? '#555' : 'var(--color-primary)',
                        cursor: isPromoBlocked ? 'default' : 'pointer'
                      }}
                      className={isPromoBlocked ? '' : 'hover:bg-amber-400 hover:text-black'}
                    >
                      {isPromoBlocked ? 'Locked' : 'Apply'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* APPEARANCE THEME SETTINGS DRAWER */}
        {showSettingsDrawer && (
          <div 
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'var(--bg-panel)',
              borderTop: '1px solid var(--border-light)',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              zIndex: 9999,
              padding: '20px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 -4px 30px rgba(0, 0, 0, 0.7)',
            }}
            className="animate-slide-up text-left"
          >
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <span className="text-xs font-black uppercase text-amber-500 tracking-wider">⚙️ Appearance Settings</span>
              <button
                type="button"
                onClick={() => setShowSettingsDrawer(false)}
                className="text-[10px] text-gray-400 hover:text-white font-bold bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded cursor-pointer border-none"
              >
                Close
              </button>
            </div>

            {/* Side-by-side Light/Dark Selector */}
            <div className="flex gap-4 justify-center py-2">
              
              {/* Light Mode Selector Card */}
              <button 
                type="button"
                className="flex-1 flex flex-col items-center gap-3 bg-transparent border-none cursor-pointer outline-none focus:outline-none"
                onClick={() => setIsNightMode(false)}
              >
                {/* Visual Card graphic representing Light Mode */}
                <div 
                  className={`w-[110px] h-[70px] rounded-xl p-2 flex flex-col gap-1 transition-all ${
                    !isNightMode 
                      ? 'bg-slate-200 border-2 border-amber-400 shadow-md shadow-amber-400/20' 
                      : 'bg-slate-300 opacity-60 hover:opacity-100 border-2 border-transparent'
                  }`}
                  style={{ boxSizing: 'border-box' }}
                >
                  <div className="w-full bg-white/90 rounded p-1 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <div className="h-1 w-10 bg-slate-300 rounded-sm"></div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <div className="h-1 w-10 bg-slate-300 rounded-sm"></div>
                    </div>
                  </div>
                </div>
                
                {/* Text Label */}
                <span className={`text-[11px] font-extrabold transition-all ${!isNightMode ? 'text-amber-400' : 'text-gray-400'}`}>
                  Light Mode
                </span>
                
                {/* Radio Circle */}
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                  !isNightMode ? 'border-amber-400 bg-amber-400/10' : 'border-gray-600'
                }`}>
                  {!isNightMode && <div className="w-2 h-2 rounded-full bg-amber-400"></div>}
                </div>
              </button>

              {/* Dark Mode Selector Card */}
              <button 
                type="button"
                className="flex-1 flex flex-col items-center gap-3 bg-transparent border-none cursor-pointer outline-none focus:outline-none"
                onClick={() => setIsNightMode(true)}
              >
                {/* Visual Card graphic representing Dark Mode */}
                <div 
                  className={`w-[110px] h-[70px] rounded-xl p-2 flex flex-col gap-1 transition-all ${
                    isNightMode 
                      ? 'bg-slate-800 border-2 border-amber-400 shadow-md shadow-amber-400/20' 
                      : 'bg-slate-900 opacity-60 hover:opacity-100 border-2 border-transparent'
                  }`}
                  style={{ boxSizing: 'border-box' }}
                >
                  <div className="w-full bg-slate-950/80 rounded p-1 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                      <div className="h-1 w-10 bg-slate-800 rounded-sm"></div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                      <div className="h-1 w-10 bg-slate-800 rounded-sm"></div>
                    </div>
                  </div>
                </div>
                
                {/* Text Label */}
                <span className={`text-[11px] font-extrabold transition-all ${isNightMode ? 'text-amber-400' : 'text-gray-400'}`}>
                  Dark Mode
                </span>
                
                {/* Radio Circle */}
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                  isNightMode ? 'border-amber-400 bg-amber-400/10' : 'border-gray-600'
                }`}>
                  {isNightMode && <div className="w-2 h-2 rounded-full bg-amber-400"></div>}
                </div>
              </button>

            </div>

            {/* Promo & Referral Hub */}
            <div className="border-t border-white/5 pt-3 mt-1 flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider">🎁 Promo & Referral Hub</span>
              
              <div className="flex gap-2 items-center">
                <input 
                  type="text" 
                  placeholder="Enter Invite Code (e.g. FRIEND50)"
                  value={referralInput}
                  onChange={(e) => setReferralInput(e.target.value)}
                  className="flex-1 bg-black/40 border border-white/10 rounded px-2.5 py-1 text-xs text-white font-mono uppercase outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleClaimReferral}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[10px] px-3 py-1 rounded cursor-pointer border-none uppercase transition-colors"
                >
                  Claim ₹50
                </button>
              </div>

              <div className="bg-black/30 border border-white/5 rounded-lg p-2.5 flex justify-between items-center mt-1">
                <div className="flex flex-col text-left">
                  <span className="text-[8px] text-gray-500 uppercase font-bold">Your Share Code:</span>
                  <span className="text-xs font-mono font-bold text-white tracking-wider">JOLDIPASS{passenger?.phone ? passenger.phone.slice(-5) : 'XXXXX'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const code = `JOLDIPASS${passenger?.phone ? passenger.phone.slice(-5) : 'XXXXX'}`;
                    navigator.clipboard.writeText(code);
                    alert(`📋 Share code ${code} copied to clipboard! Share it with friends to earn ₹50 wallet cash.`);
                  }}
                  className="bg-white/5 hover:bg-white/10 text-white font-semibold text-[9px] px-2.5 py-1 rounded cursor-pointer border border-white/10"
                >
                  🔗 Share Invite
                </button>
              </div>
            </div>

            <div className="border-t border-white/5 pt-3 mt-1 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowTutorial(true);
                  setShowSettingsDrawer(false);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10px] py-2 rounded-lg cursor-pointer border-none uppercase transition-colors"
              >
                🎓 Replay Onboarding Tour
              </button>
            </div>

          </div>
        )}
        
        {/* SPEECH RECOGNITION LISTENING OVERLAY */}
        {isListeningSpeech && (
          <div className="admin-modal-overlay flex items-center justify-center p-4" style={{ zIndex: 11000 }}>
            <div className="card-glow animate-bounce-in w-full max-w-[260px] rounded-2xl bg-[#0c0e12] border border-white/10 p-5 text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center text-lg animate-pulse border border-amber-500/30">
                🎙️
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Listening...</h4>
              <p className="text-[10px] text-gray-400 leading-snug">{speechListeningPrompt}</p>
              <span className="text-[8px] text-gray-600 font-mono italic">Tip: Speak the location name or say "emergency"</span>
            </div>
          </div>
        )}
        
        {/* Floating SMS Gateway Toast Alert */}
        {activeSmsToast && (
          <div className="floating-sms-toast-overlay card-glow animate-slide-down">
            <div className="flex gap-2">
              <div className="sms-icon-avatar bg-amber-500/20 text-amber-400 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                💬
              </div>
              <div className="flex-1 text-left">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">{activeSmsToast.sender}</span>
                  <span className="text-[8px] text-gray-500">now</span>
                </div>
                <p className="text-[11px] text-gray-300 mt-0.5 leading-snug">{activeSmsToast.message}</p>
              </div>
            </div>
            {/* Animated progress bar */}
            <div className="sms-progress-bar-container">
              <div className="sms-progress-fill"></div>
            </div>
          </div>
        )}

        {/* Auth / Login Page */}
        {tab === 'auth' && (
          <div className="app-screen-layout auth-screen">
            <div className="auth-logo-section text-center">
              <div className="brand-logo-pill">JoldiGo</div>
              <h2 className="auth-tagline">Joldi Book, Joldi Reach!</h2>
            </div>

            <div className="auth-card card-glow">
              {!isOtpSent ? (
                <form onSubmit={handleSendOtp}>
                  <h3 className="auth-card-title">Welcome to JoldiGo</h3>
                  <p className="auth-card-desc">Enter your name and mobile number to get started booking rides in Kolkata.</p>
                  
                  <div className="input-group" style={{ marginBottom: '12px' }}>
                    <input 
                      type="text" 
                      placeholder="Enter Full Name" 
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      style={{ paddingLeft: '12px' }}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <span className="input-prefix">+91</span>
                    <input 
                      type="tel" 
                      placeholder="Enter mobile number" 
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      maxLength={10}
                      required
                    />
                  </div>

                  {otpError && <p className="error-text"><AlertTriangle size={14} /> {otpError}</p>}

                  <button type="submit" className="btn-primary full-width mt-4">
                    Send OTP Verification
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp}>
                  <h3 className="auth-card-title">Verification Code</h3>
                  <p className="auth-card-desc">Enter the 4-digit code sent to +91 ******{phoneInput.slice(-4)}</p>

                  <div className="input-group">
                    <input 
                      type="text" 
                      placeholder="Enter OTP (Use 1234)" 
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      maxLength={4}
                      style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '20px' }}
                      required
                    />
                  </div>

                  {otpError && <p className="error-text"><AlertTriangle size={14} /> {otpError}</p>}

                  <div className="otp-helper">For testing, type <b>1234</b> or check SMS preview.</div>

                  <button type="submit" className="btn-primary full-width mt-4">
                    Verify & Register
                  </button>
                  <button type="button" className="btn-text-only mt-2" onClick={() => setIsOtpSent(false)}>
                    Back
                  </button>
                </form>
              )}
            </div>

            <div className="auth-footer">
              <Shield size={14} /> Securely encrypted via SMS One-Time OTP
            </div>
          </div>
        )}

        {/* Home Map / Active Booking screen */}
        {tab === 'home' && passenger.isLoggedIn && (
          <div className="app-screen-layout relative flex flex-col justify-between">
            <div className="phone-header-overlay flex items-center justify-between">
              <div className="header-pill brand">JoldiGo</div>
              
              <div className="flex items-center gap-1.5">
                <button 
                  className="header-icon-btn wallet-badge-btn flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full"
                  onClick={() => {
                    openTopUpModal(500);
                  }}
                  title="Top Up Wallet"
                >
                  <Wallet size={12} />
                  <span>₹{passengerWalletBalance.toFixed(0)}</span>
                  <span className="text-[10px] text-emerald-500 font-extrabold">+</span>
                </button>

                <div className="flex gap-1">
                  <button 
                    className="header-icon-btn" 
                    onClick={() => setShowTariffGuide(true)} 
                    title="Tariff & Transparency Guide"
                    style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}
                  >
                    <span style={{ fontSize: '11px' }}>📜</span>
                  </button>
                  <button 
                    className="header-icon-btn" 
                    onClick={() => setShowAiSupport(true)} 
                    title="AI Support Assistant"
                    style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}
                  >
                    <MessageSquare size={14} />
                  </button>
                  <button className="header-icon-btn" onClick={() => setTab('history')} title="Ride History">
                    <History size={14} />
                  </button>
                  <button className="header-icon-btn" onClick={() => setShowSettingsDrawer(true)} title="Settings">
                    <span style={{ fontSize: '11px' }}>⚙️</span>
                  </button>
                  <button className="header-icon-btn logout" onClick={logoutPassenger} title="Logout">
                    <LogOut size={14} />
                  </button>
                </div>
              </div>
            </div>
            <div style={{ position: 'relative', width: '100%', height: 'calc(100% - 44px)' }}>
              <div ref={mapContainerRef} className="map-view-container" style={{ height: '100%' }}></div>
            </div>
            {renderPanelOverlay()}

            {activeRide && (activeRide.status === 'accepted' || activeRide.status === 'arrived' || activeRide.status === 'in_progress') && (
              <button 
                className="btn-sos-floating pulse-sos"
                onClick={() => triggerPassengerSOS(passenger.phone)}
              >
                SOS
              </button>
            )}

            {/* RAZORPAY SECURE TOP UP DIALOG */}
            {showTopUpModal && (
              <div className="admin-modal-overlay flex items-center justify-center p-4" style={{ zIndex: 1000 }}>
                <div className="razorpay-sheet card-glow animate-bounce-in w-full max-w-[290px] rounded-2xl bg-[#0c0e12] border border-white/5 relative p-4">
                  <div className="razorpay-header border-b border-white/5 pb-2 flex justify-between items-center">
                    <div className="rzp-title">
                      <span className="badge-rzp text-[9px] bg-indigo-950 text-indigo-400 px-2 py-0.5 rounded font-mono font-bold">RAZORPAY Secure</span>
                      <h4 className="text-xs font-bold text-white mt-1">Wallet Top-Up</h4>
                    </div>
                    <button className="text-gray-500 hover:text-white text-lg font-bold" onClick={() => setShowTopUpModal(false)}>×</button>
                  </div>

                  {topUpStep === 'select' && (
                    <div className="payment-body mt-3">
                      <label className="text-[10px] text-gray-500 font-bold block uppercase mb-1">Enter deposit amount (₹):</label>
                      <input 
                        type="number"
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-white font-mono text-center font-bold text-lg outline-none focus:border-amber-400"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(Math.max(0, parseInt(e.target.value) || 0))}
                      />

                      <div className="flex gap-2 mt-3">
                        <button className="btn-secondary py-1 text-xs justify-center flex-1" onClick={() => setTopUpAmount(100)}>₹100</button>
                        <button className="btn-secondary py-1 text-xs justify-center flex-1" onClick={() => setTopUpAmount(500)}>₹500</button>
                        <button className="btn-secondary py-1 text-xs justify-center flex-1" onClick={() => setTopUpAmount(1000)}>₹1000</button>
                      </div>

                      <button 
                        className="btn-pay-rzp mt-4 w-full py-2 bg-amber-500 text-black hover:bg-amber-600 font-bold rounded-lg text-xs cursor-pointer"
                        onClick={() => setTopUpStep('card')}
                      >
                        Authorize Top Up ₹{topUpAmount}
                      </button>
                    </div>
                  )}

                  {topUpStep === 'card' && (
                    <div className="payment-body mt-3 flex flex-col gap-3 text-left">
                      {/* Credit Card Graphic Preview */}
                      <div 
                        className="w-full h-[115px] rounded-xl p-3 relative overflow-hidden transition-all duration-500 select-none flex flex-col justify-between"
                        style={{
                          background: isCardFlipped 
                            ? 'linear-gradient(135deg, #1e293b, #0f172a)' 
                            : 'linear-gradient(135deg, #ffdd00, #d97706)',
                          color: isCardFlipped ? '#94a3b8' : '#fff',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}
                      >
                        {!isCardFlipped ? (
                          <>
                            {/* Card Front */}
                            <div className="flex justify-between items-start">
                              <div className="flex flex-col">
                                <span className="text-[8px] opacity-75 uppercase font-bold tracking-wider">JoldiGo Pay</span>
                                <div className="w-5 h-3.5 bg-white/20 rounded-sm mt-1"></div> {/* Chip */}
                              </div>
                              <span className="text-[10px] font-black italic text-black font-mono">VISA</span>
                            </div>

                            <div className="text-center font-mono text-sm font-bold tracking-widest text-black/85 mt-2">
                              {topUpCardNumber || '•••• •••• •••• ••••'}
                            </div>

                            <div className="flex justify-between items-end mt-1 text-black/75">
                              <div className="flex flex-col max-w-[130px] truncate">
                                <span className="text-[7px] uppercase opacity-75 font-semibold">Cardholder</span>
                                <span className="text-[9px] font-bold font-mono tracking-wide truncate">{topUpCardName.toUpperCase() || 'NAME SURNAME'}</span>
                              </div>
                              <div className="flex flex-col text-right">
                                <span className="text-[7px] uppercase opacity-75 font-semibold">Expires</span>
                                <span className="text-[9px] font-bold font-mono">{topUpCardExpiry || 'MM/YY'}</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Card Back */}
                            <div className="w-full h-3.5 bg-black absolute left-0 top-3"></div>
                            <div className="mt-8 flex justify-between items-center px-1">
                              <div className="h-6 w-32 bg-slate-700/80 rounded flex items-center justify-end px-2">
                                <span className="text-[8px] font-mono tracking-widest text-slate-400 font-bold">XXX XXX</span>
                              </div>
                              <div className="bg-white text-black font-mono font-bold text-[9px] px-2 py-0.5 rounded border border-red-500 shadow-md">
                                CVV: {topUpCardCvv || '•••'}
                              </div>
                            </div>
                            <span className="text-[6px] opacity-50 block mt-2 font-mono">AUTHORIZED SIGNATURE ONLY</span>
                          </>
                        )}
                      </div>

                      {/* Card input form fields */}
                      <div className="flex flex-col gap-2">
                        <div>
                          <label className="text-[9px] text-gray-500 font-bold uppercase block mb-0.5">Card Number</label>
                          <input 
                            type="text"
                            placeholder="4111 1111 1111 1111"
                            value={topUpCardNumber}
                            onChange={handleCardNumberChange}
                            className="w-full bg-black/40 border border-white/10 rounded px-2.5 py-1 text-xs text-white font-mono outline-none focus:border-amber-400"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] text-gray-500 font-bold uppercase block mb-0.5">Cardholder Name</label>
                          <input 
                            type="text"
                            placeholder="John Doe"
                            value={topUpCardName}
                            onChange={(e) => setTopUpCardName(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded px-2.5 py-1 text-xs text-white outline-none focus:border-amber-400 font-mono"
                          />
                        </div>

                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="text-[9px] text-gray-500 font-bold uppercase block mb-0.5">Expiration</label>
                            <input 
                              type="text"
                              placeholder="MM/YY"
                              value={topUpCardExpiry}
                              onChange={handleCardExpiryChange}
                              className="w-full bg-black/40 border border-white/10 rounded px-2.5 py-1 text-xs text-white font-mono outline-none focus:border-amber-400"
                            />
                          </div>

                          <div className="w-[80px]">
                            <label className="text-[9px] text-gray-500 font-bold uppercase block mb-0.5">CVV</label>
                            <input 
                              type="password"
                              placeholder="***"
                              value={topUpCardCvv}
                              onChange={handleCardCvvChange}
                              onFocus={() => setIsCardFlipped(true)}
                              onBlur={() => setIsCardFlipped(false)}
                              className="w-full bg-black/40 border border-white/10 rounded px-2.5 py-1 text-xs text-white font-mono outline-none focus:border-amber-400 text-center"
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (topUpCardNumber.replace(/\s/g, '').length < 15) {
                            alert("Please enter a valid card number.");
                            return;
                          }
                          if (!topUpCardName.trim()) {
                            alert("Please enter cardholder name.");
                            return;
                          }
                          if (topUpCardExpiry.length < 5) {
                            alert("Please enter expiry MM/YY.");
                            return;
                          }
                          if (topUpCardCvv.length < 3) {
                            alert("Please enter CVV.");
                            return;
                          }
                          setTopUpStep('verify');
                        }}
                        className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-xs cursor-pointer transition-colors mt-1"
                      >
                        🔒 Securely Pay ₹{topUpAmount}
                      </button>
                    </div>
                  )}

                  {topUpStep === 'verify' && (
                    <div className="payment-body mt-3 text-center flex flex-col gap-2">
                      <div className="text-left mb-2">
                        <label className="text-[10px] text-gray-400 font-bold uppercase">Enter Mock OTP Code:</label>
                        <p className="text-[9px] text-gray-500 mt-0.5">Input 123456 to approve mock wallet deposit.</p>
                      </div>
                      <input 
                        type="text"
                        placeholder="Enter 6-digit OTP"
                        value={rzpOtpInput}
                        onChange={e => setRzpOtpInput(e.target.value)}
                        style={{ width: '100%', backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '8px', color: '#fff', outline: 'none', textAlign: 'center', fontSize: '14px', fontFamily: 'monospace' }}
                        maxLength={6}
                      />
                      <button
                        type="button"
                        onClick={executeWalletTopUp}
                        className="py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-lg cursor-pointer transition-all mt-2"
                      >
                        Verify & Complete Deposit
                      </button>
                    </div>
                  )}

                  {topUpStep === 'processing' && (
                    <div className="payment-body text-center py-6 mt-3">
                      <div className="spinner-rzp mx-auto"></div>
                      <p className="mt-3 text-xs font-medium text-amber-500">Contacting Razorpay Gateway...</p>
                      <p className="text-[10px] text-gray-500 font-mono">Deduction authorization...</p>
                    </div>
                  )}

                  {topUpStep === 'success' && (
                    <div className="payment-body text-center py-4 mt-3">
                      <div className="success-circle mx-auto bg-green-500/20 border border-green-500/30 rounded-full w-10 h-10 flex items-center justify-center">
                        <Check size={20} color="#00ff66" />
                      </div>
                      <h4 className="text-xs font-bold text-green-400 mt-3">Top-Up Successful!</h4>
                      <p className="text-[10px] text-gray-400 mt-1">₹{topUpAmount} added to JoldiGo Wallet.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {tab === 'history' && passenger.isLoggedIn && (
          <div className="app-screen-layout history-screen">
            <div className="history-header">
              <button className="btn-icon-back" onClick={() => setTab('home')}>←</button>
              <h3>Your Trips</h3>
            </div>

            <div className="history-list">
              {passenger.rideHistory.length === 0 ? (
                <div className="empty-state">
                  <History size={48} className="empty-icon" />
                  <p>No rides completed yet.</p>
                </div>
              ) : (
                passenger.rideHistory.map((ride) => (
                  <div key={ride.id} className="history-item-card card-glow" style={{ flexDirection: 'column' }}>
                    <div className="flex w-full gap-2">
                      <div className="hist-icon-col">
                        <div className={`hist-icon-bg ${ride.vehicleType === 'bike' ? 'bike' : 'car'}`}>
                          {ride.vehicleType === 'bike' ? <Bike size={18} /> : <Car size={18} />}
                        </div>
                      </div>
                      <div className="hist-details">
                        <div className="hist-top-line">
                          <span className="hist-vehicle">JoldiGo {ride.vehicleType.toUpperCase().replace('_', ' ')}</span>
                          <span className="hist-fare">₹{ride.fare.toFixed(2)}</span>
                        </div>
                        <span className="hist-date">{ride.date} • Pay Method: {ride.paymentMethod.toUpperCase()}</span>
                        
                        <div className="hist-routes">
                          <div className="hist-route-point">
                            <span className="pt-dot green"></span>
                            <span className="pt-name">{ride.pickupName}</span>
                          </div>
                          <div className="hist-route-point mt-1">
                            <span className="pt-dot red"></span>
                            <span className="pt-name">{ride.dropoffName}</span>
                          </div>
                        </div>

                        <div className="hist-footer mt-2">
                          <span className="hist-driver">Driver: {ride.driverName}</span>
                          <div className="stars-rating-compact">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star 
                                key={s} 
                                size={12} 
                                fill={s <= ride.rating ? "#ffdd00" : "none"} 
                                color={s <= ride.rating ? "#ffdd00" : "#555"} 
                              />
                            ))}
                          </div>
                        </div>

                        <div className="mt-2 text-[9px] font-mono text-gray-500">
                          ID Hash: {ride.contractHash}
                        </div>
                      </div>
                    </div>

                    <div className="dispute-history-integration mt-3 border-t border-white/5 pt-2">
                      {ride.disputed ? (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-2 rounded text-[10px] font-semibold flex justify-between items-center">
                          <span>⚠️ Dispute Active: Payout Suspended</span>
                          <span className="font-mono text-[8px] uppercase tracking-wide bg-red-950 px-2 py-0.5 rounded">24h review</span>
                        </div>
                      ) : (
                        <div>
                          {activeDisputeFormId === ride.id ? (
                            <div className="dispute-form-block mt-2">
                              <textarea 
                                placeholder="Describe problem (e.g. driver forced cash, incorrect toll, bad behavior)..."
                                className="w-full text-[11px] bg-black/40 border border-white/10 rounded p-2 text-white placeholder-gray-600 outline-none focus:border-red-500"
                                rows={2}
                                value={complaintText}
                                onChange={(e) => setComplaintText(e.target.value)}
                              />
                              <div className="flex justify-end gap-2 mt-1">
                                <button className="btn-text-only text-[10px]" onClick={() => setActiveDisputeFormId(null)}>Cancel</button>
                                <button 
                                  className="btn-primary text-[10px] py-1 px-3 bg-red-600 hover:bg-red-700 w-auto"
                                  onClick={() => {
                                    if (!complaintText) return;
                                    fileDispute(ride.id, complaintText);
                                    setComplaintText('');
                                    setActiveDisputeFormId(null);
                                  }}
                                >
                                  Submit Dispute
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center w-full mt-1">
                              <button 
                                className="btn-text-only text-[10px] text-red-400 hover:text-red-300 font-semibold p-0"
                                onClick={() => {
                                  setActiveDisputeFormId(ride.id);
                                  setComplaintText('');
                                }}
                              >
                                ⚠️ Dispute Ride Payout
                              </button>
                              <button 
                                className="btn-text-only text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 p-0"
                                onClick={() => setSelectedRideForInvoice(ride)}
                              >
                                📄 Get PDF Invoice
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>

      {/* Dynamic Calling Simulator Overlay */}
      {renderCallOverlay()}

      {/* Razorpay Sandbox Payment Sheet Overlay */}
      {showRazorpaySheet && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div className="bg-[#0e1b2f] border-t border-white/10 rounded-t-2xl p-4 flex flex-col gap-3 text-left text-xs" style={{ maxHeight: '90%', overflowY: 'auto' }}>
            
            {/* Razorpay branding header */}
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[#3395FF] font-black text-sm tracking-wider">Razorpay</span>
                <span className="bg-[#3395FF]/10 text-[#3395FF] border border-[#3395FF]/20 px-1 py-0.2 rounded text-[7px] font-bold">SECURED</span>
              </div>
              <button 
                type="button" 
                onClick={() => setShowRazorpaySheet(false)}
                className="text-gray-400 hover:text-white font-extrabold text-base bg-transparent border-none cursor-pointer"
              >
                ×
              </button>
            </div>

            {rzpPaymentStatus === 'idle' && (
              <>
                {/* Amount details */}
                <div className="flex justify-between items-center bg-black/40 border border-white/5 p-3 rounded-lg">
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase tracking-wide">ORDER ID</span>
                    <span className="font-mono text-white font-semibold text-[10px]">order_joldi_${activeRide?.id?.substr(4,6)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block uppercase tracking-wide">AMOUNT</span>
                    <span className="text-yellow-400 font-extrabold text-sm">₹{activeRide?.totalFare}</span>
                  </div>
                </div>

                {/* Method selector tabs */}
                <div className="flex gap-1 border-b border-white/5">
                  {[
                    { key: 'upi', label: 'UPI' },
                    { key: 'card', label: 'Card' },
                    { key: 'netbanking', label: 'NetBanking' }
                  ].map(m => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setRzpMethod(m.key)}
                      style={{
                        flex: 1,
                        padding: '6px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        color: rzpMethod === m.key ? '#3395FF' : '#718096',
                        borderBottom: rzpMethod === m.key ? '2px solid #3395FF' : 'none',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Method rendering */}
                {rzpMethod === 'upi' && (
                  <div className="flex flex-col gap-2.5 py-1">
                    <span className="text-[9px] uppercase tracking-wider text-gray-500 font-extrabold">Select your UPI App</span>
                    <div className="flex gap-2">
                      {[
                        { key: 'gpay', label: 'GPay', emoji: '📱' },
                        { key: 'phonepe', label: 'PhonePe', emoji: '🪙' },
                        { key: 'paytm', label: 'Paytm', emoji: '💳' }
                      ].map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setRzpUpiOption(opt.key)}
                          className={`flex-1 p-2 rounded border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                            rzpUpiOption === opt.key 
                              ? 'bg-[#3395FF]/10 text-white border-[#3395FF]' 
                              : 'bg-black/20 text-gray-400 border-white/5'
                          }`}
                        >
                          <span className="text-base">{opt.emoji}</span>
                          <span className="text-[9px] font-bold">{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {rzpMethod === 'card' && (
                  <div className="flex flex-col gap-2 py-1">
                    <span className="text-[9px] uppercase tracking-wider text-gray-500 font-extrabold">Card Details (Sandbox Mode)</span>
                    <input 
                      type="text"
                      placeholder="Card Number (e.g. 4111 2222 3333 4444)"
                      value={rzpCardNumber}
                      onChange={e => setRzpCardNumber(e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim())}
                      style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#fff', outline: 'none' }}
                      maxLength={19}
                    />
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="MM/YY"
                        value={rzpCardExpiry}
                        onChange={e => setRzpCardExpiry(e.target.value)}
                        style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#fff', outline: 'none', flex: 1 }}
                        maxLength={5}
                      />
                      <input 
                        type="password"
                        placeholder="CVV"
                        value={rzpCardCvv}
                        onChange={e => setRzpCardCvv(e.target.value)}
                        style={{ backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', fontSize: '11px', color: '#fff', outline: 'none', flex: 1 }}
                        maxLength={3}
                      />
                    </div>
                  </div>
                )}

                {rzpMethod === 'netbanking' && (
                  <div className="flex flex-col gap-2 py-1">
                    <span className="text-[9px] uppercase tracking-wider text-gray-500 font-extrabold">Popular Banks</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['SBI', 'HDFC', 'ICICI', 'AXIS'].map(bank => (
                        <button
                          key={bank}
                          type="button"
                          onClick={() => setRzpSelectedBank(bank)}
                          className={`p-2 rounded border text-left font-bold text-[9px] cursor-pointer transition-all ${
                            rzpSelectedBank === bank 
                              ? 'bg-[#3395FF]/10 text-white border-[#3395FF]' 
                              : 'bg-black/20 text-gray-400 border-white/5'
                          }`}
                        >
                          🏦 {bank} Bank
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="button"
                  onClick={() => {
                    setRzpPaymentStatus('authorizing');
                    setTimeout(() => {
                      setRzpPaymentStatus('otp');
                    }, 1200);
                  }}
                  className="py-2.5 bg-[#3395FF] hover:bg-[#1d82f5] text-white font-bold text-xs rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  🔒 Securely Pay ₹{activeRide?.totalFare}
                </button>
              </>
            )}

            {rzpPaymentStatus === 'authorizing' && (
              <div className="text-center py-6 flex flex-col items-center justify-center gap-2">
                <div className="spinner-rzp animate-spin rounded-full h-8 w-8 border-b-2 border-[#3395FF] border-t-transparent" style={{ border: '2px solid transparent', borderTopColor: '#3395FF', borderLeftColor: '#3395FF', borderRadius: '50%', width: '28px', height: '28px', animation: 'spin 1s linear infinite' }}></div>
                <p className="font-semibold text-white mt-2 text-[11px]">Authorizing Sandbox Transaction...</p>
                <p className="text-[9px] text-gray-500">Contacting Razorpay Secure Nodes</p>
              </div>
            )}

            {rzpPaymentStatus === 'otp' && (
              <div className="flex flex-col gap-3 py-4 text-center">
                <span className="text-2xl">⚡</span>
                <div>
                  <h4 className="text-xs font-bold text-white">Enter 3D Secure OTP</h4>
                  <p className="text-[9px] text-gray-400 mt-0.5">Enter mock code to authorize billing.</p>
                </div>
                <input 
                  type="text"
                  placeholder="Enter 6-digit OTP (e.g. 123456)"
                  value={rzpOtpInput}
                  onChange={e => setRzpOtpInput(e.target.value)}
                  style={{ width: '80%', margin: '0 auto', backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '6px', color: '#fff', outline: 'none', textAlign: 'center', fontSize: '12px' }}
                  maxLength={6}
                />
                <button
                  type="button"
                  onClick={() => {
                    setRzpPaymentStatus('success');
                    setTimeout(() => {
                      setShowRazorpaySheet(false);
                      setPaymentStep('feedback');
                      // complete the payment on the context!
                      const finalTip = selectedTip === 'custom' ? (parseInt(customTip) || 0) : selectedTip;
                      completePaymentAndRate(starRating, ratingComment, finalTip);
                    }, 1200);
                  }}
                  className="py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-lg cursor-pointer transition-all mt-2"
                >
                  Verify & Complete Payment
                </button>
              </div>
            )}

            {rzpPaymentStatus === 'success' && (
              <div className="text-center py-6 flex flex-col items-center justify-center gap-2">
                <span className="text-3xl animate-bounce">✅</span>
                <p className="font-bold text-emerald-400 mt-2 text-xs">Transaction Approved!</p>
                <p className="text-[9px] text-gray-400">Ledger details synchronized successfully.</p>
              </div>
            )}

          </div>
        </div>
      )}

      {selectedRideForInvoice && (
        <div className="admin-modal-overlay" style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifycontent: 'center', backgroundColor: 'rgba(0,0,0,0.85)', position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}>
          <div className="admin-modal-card card-glow" style={{ width: '92%', maxWidth: '340px', backgroundColor: '#ffffff', color: '#111111', borderRadius: '16px', padding: '16px', position: 'relative', fontFamily: 'Outfit, sans-serif', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', margin: 'auto' }}>
            
            {/* Header info */}
            <div className="flex justify-between items-start border-b border-gray-200 pb-2">
              <div className="text-left">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '16px' }}>⚡</span>
                  <h4 style={{ margin: 0, fontWeight: '900', fontSize: '13px', color: '#005043', letterSpacing: '-0.3px' }}>JaldiGo TAX INVOICE</h4>
                </div>
                <p style={{ margin: '2px 0 0 0', fontSize: '7px', color: '#666' }}>Salt Lake IT Core Sector V, Kolkata</p>
              </div>
              <button 
                onClick={() => setSelectedRideForInvoice(null)}
                style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', padding: '0 4px' }}
              >
                ×
              </button>
            </div>

            {/* Invoice Details */}
            <div className="text-left" style={{ marginTop: '10px', fontSize: '9px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
              <div>
                <span style={{ color: '#888', display: 'block', fontSize: '7px', textTransform: 'uppercase' }}>Invoice No</span>
                <span className="font-mono font-semibold" style={{ color: '#000' }}>JG-INV-{selectedRideForInvoice.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div>
                <span style={{ color: '#888', display: 'block', fontSize: '7px', textTransform: 'uppercase' }}>Date & Time</span>
                <span className="font-semibold" style={{ color: '#000' }}>{selectedRideForInvoice.date}</span>
              </div>
              <div>
                <span style={{ color: '#888', display: 'block', fontSize: '7px', textTransform: 'uppercase' }}>Passenger Phone</span>
                <span className="font-semibold" style={{ color: '#000' }}>+91 ******{passenger.phone.slice(-4)}</span>
              </div>
              <div>
                <span style={{ color: '#888', display: 'block', fontSize: '7px', textTransform: 'uppercase' }}>Driver Partner</span>
                <span className="font-semibold" style={{ color: '#000' }}>{selectedRideForInvoice.driverName}</span>
              </div>
            </div>

            {/* Travel Path */}
            <div className="text-left" style={{ marginTop: '10px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
              <span style={{ color: '#888', display: 'block', fontSize: '7px', textTransform: 'uppercase', marginBottom: '4px' }}>Ride Summary</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '9px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#22c55e', fontSize: '8px' }}>●</span>
                  <span className="truncate" style={{ fontWeight: '500', color: '#000' }}>{selectedRideForInvoice.pickupName}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#ef4444', fontSize: '8px' }}>●</span>
                  <span className="truncate" style={{ fontWeight: '500', color: '#000' }}>{selectedRideForInvoice.dropoffName}</span>
                </div>
              </div>
            </div>

            {/* Payout Breakdown */}
            <div className="text-left" style={{ marginTop: '10px', paddingBottom: '10px', borderBottom: '1px solid #eee', fontSize: '9px' }}>
              <span style={{ color: '#888', display: 'block', fontSize: '7px', textTransform: 'uppercase', marginBottom: '4px' }}>Fare Details</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div className="flex justify-between text-gray-700">
                  <span>Base Ride Fare:</span>
                  <span>₹{(selectedRideForInvoice.fare / (selectedRideForInvoice.surgeMultiplier || 1)).toFixed(2)}</span>
                </div>
                {selectedRideForInvoice.surgeMultiplier > 1 && (
                  <div className="flex justify-between text-amber-600 font-medium">
                    <span>Surge Surcharge ({selectedRideForInvoice.surgeMultiplier}x):</span>
                    <span>+₹{(selectedRideForInvoice.fare - (selectedRideForInvoice.fare / selectedRideForInvoice.surgeMultiplier)).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-700">
                  <span>GST Transport Levy (5%):</span>
                  <span>₹{(selectedRideForInvoice.fare * 0.05).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-700 border-t border-dashed border-gray-200 pt-1.5 mt-1 font-bold text-xs" style={{ color: '#000' }}>
                  <span>Total Amount Paid:</span>
                  <span style={{ color: '#005043' }}>₹{(selectedRideForInvoice.fare * 1.05).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Razorpay Ledger metadata */}
            <div style={{ marginTop: '10px', backgroundColor: '#f8fafc', padding: '6px 10px', borderRadius: '6px', border: '1px dashed #e2e8f0', fontSize: '7px', color: '#64748b' }} className="text-left font-mono">
              <div>RAZORPAY ID: pay_{selectedRideForInvoice.id.slice(2, 14)}</div>
              <div style={{ marginTop: '2px' }}>LEDGER HASH: {selectedRideForInvoice.contractHash?.slice(0, 24)}...</div>
              <div style={{ marginTop: '2px' }}>STATUS: SETTLED (COMMISSION SPLIT: 20%)</div>
            </div>

            {/* Print trigger */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => window.print()}
                style={{ flex: 1, backgroundColor: '#005043', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              >
                🖨️ Print Receipt
              </button>
              <button
                onClick={() => setSelectedRideForInvoice(null)}
                style={{ flex: 1, backgroundColor: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '6px', padding: '8px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {showTariffGuide && (
        <TariffGuideModal onClose={() => setShowTariffGuide(false)} />
      )}

      {showTutorial && (
        <TutorialTour onClose={() => setShowTutorial(false)} />
      )}

      <div className="phone-home-bar"></div>
    </div>
  );
}
