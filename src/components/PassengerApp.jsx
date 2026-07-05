import React, { useState, useEffect, useRef } from 'react';
import { useSimulator, KOLKATA_LOCATIONS, calculateDistance } from '../context/SimulatorContext';
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
    mapStyle,
    setMapStyle
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

  // Location inputs
  const [pickupKey, setPickupKey] = useState('PARK_STREET');
  const [dropoffKey, setDropoffKey] = useState('AIRPORT');
  const [vehicleType, setVehicleType] = useState('car_ac'); 
  const [paymentMethod, setPaymentMethod] = useState('wallet'); 

  // Dispute forms UI
  const [activeDisputeFormId, setActiveDisputeFormId] = useState(null);
  const [complaintText, setComplaintText] = useState('');

  // Top Up Modal State
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(500);
  const [topUpStep, setTopUpStep] = useState('select'); 

  // Chat Drawer state
  const [showChat, setShowChat] = useState(false);
  const [chatInputText, setChatInputText] = useState('');
  const chatEndRef = useRef(null);

  // Razorpay payment sheet state
  const [selectedPayment, setSelectedPayment] = useState('upi');
  const [starRating, setStarRating] = useState(5);
  const [paymentStep, setPaymentStep] = useState('select'); 
  const [selectedTip, setSelectedTip] = useState(0); 
  const [customTip, setCustomTip] = useState(''); 

  // Promo code states
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [discount, setDiscount] = useState(0);
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState('');
  const [showPromoDrawer, setShowPromoDrawer] = useState(false);

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
    if (markersRef.current.driver) map.removeLayer(markersRef.current.driver);
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
      html: `<div class="marker-pin pin-driver ${activeRide?.vehicleType === 'bike' ? 'bike' : 'car'}">
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
          markersRef.current.driver = L.marker([assignedDriver.location.lat, assignedDriver.location.lng], { icon: activeDriverIcon }).addTo(map);
          map.panTo([assignedDriver.location.lat, assignedDriver.location.lng]);
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

      if (pickupLoc) {
        markersRef.current.pickup = L.marker([pickupLoc.lat, pickupLoc.lng], { icon: pickupIcon }).addTo(map);
      }
      if (dropoffLoc) {
        markersRef.current.dropoff = L.marker([dropoffLoc.lat, dropoffLoc.lng], { icon: dropoffIcon }).addTo(map);
      }

      if (pickupLoc && dropoffLoc) {
        map.fitBounds([
          [pickupLoc.lat, pickupLoc.lng],
          [dropoffLoc.lat, dropoffLoc.lng],
        ], { padding: [40, 40] });
      }

      drivers.forEach(d => {
        if (d.status === 'online' && d.verificationStatus === 'verified') {
          const otherDrvIcon = L.divIcon({
            className: 'custom-map-marker other-driver-marker',
            html: `<div class="marker-pin-mini ${d.vehicleType === 'bike' ? 'bike' : 'car'}"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          const m = L.marker([d.location.lat, d.location.lng], { icon: otherDrvIcon }).addTo(map);
          markersRef.current.otherDrivers.push(m);
        }
      });
    }
  }, [activeRide, drivers, pickupKey, dropoffKey, tab, congestionZones, geofencingZones]);

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
    const res = await loginPassenger(phoneInput, otpInput);
    if (res.success) {
      setTab('home');
      setIsOtpSent(false);
      setPhoneInput('');
      setOtpInput('');
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

  const executeWalletTopUp = () => {
    setTopUpStep('processing');
    setTimeout(() => {
      topUpPassengerWallet(topUpAmount);
      setTopUpStep('success');
      setTimeout(() => {
        setShowTopUpModal(false);
        setTopUpStep('select');
      }, 1000);
    }, 1200);
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInputText.trim()) return;
    sendChatMessage('passenger', chatInputText.trim());
    setChatInputText('');
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
    
    const dist = calculateDistance(pick.lat, pick.lng, drop.lat, drop.lng);
    return {
      distance: dist,
      ...calculateDetailedFare(dist, vType, pick, drop)
    };
  };

  const metrics = getPreviewMetrics();
  const acMetrics = getPreviewMetrics('car_ac');
  const nonAcMetrics = getPreviewMetrics('car_non_ac');
  const bikeMetrics = getPreviewMetrics('bike');

  const renderPanelOverlay = () => {
    if (!activeRide) {
      return (
        <div className="passenger-booking-panel card-glow animate-slide-up" style={{ maxHeight: '520px', overflowY: 'auto' }}>
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
                <select value={pickupKey} onChange={(e) => setPickupKey(e.target.value)}>
                  {Object.entries(KOLKATA_LOCATIONS).map(([key, loc]) => (
                    <option key={key} value={key}>{loc.name} ({loc.zone})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="picker-line"></div>

            <div className="picker-row">
              <div className="picker-dot red"></div>
              <div className="picker-field">
                <label>Dropoff Location</label>
                <select value={dropoffKey} onChange={(e) => setDropoffKey(e.target.value)}>
                  {Object.entries(KOLKATA_LOCATIONS).map(([key, loc]) => (
                    <option key={key} value={key}>{loc.name} ({loc.zone})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="divider-h mt-3"></div>

          {/* Vehicle Selection Cards */}
          <div className="vehicle-selector">
            <button 
              className={`vehicle-card ${vehicleType === 'car_ac' ? 'selected' : ''}`}
              onClick={() => setVehicleType('car_ac')}
            >
              <div className="vehicle-icon-bg car-bg">
                <Car className="vh-icon" />
              </div>
              <div className="vehicle-info">
                <span className="vh-name">JoldiGo AC Car</span>
                <span className="vh-eta">Premium Air-Conditioned sedan</span>
              </div>
              <span className="vh-price">₹{acMetrics.totalFare}</span>
            </button>
 
            <button 
              className={`vehicle-card ${vehicleType === 'car_non_ac' ? 'selected' : ''}`}
              onClick={() => setVehicleType('car_non_ac')}
            >
              <div className="vehicle-icon-bg car-bg" style={{ backgroundColor: 'rgba(255,160,0,0.1)', color: '#ff9c00' }}>
                <Car className="vh-icon" />
              </div>
              <div className="vehicle-info">
                <span className="vh-name">JoldiGo Non-AC Car</span>
                <span className="vh-eta">Standard budget transport</span>
              </div>
              <span className="vh-price">₹{nonAcMetrics.totalFare}</span>
            </button>
 
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
                <span className="vh-name">JoldiGo Bike</span>
                <span className="vh-eta">{bikeMetrics.totalFare === 0 ? 'Safety Suspended (Flooding)' : 'Fast & nimble bike commute'}</span>
              </div>
              <span className="vh-price">{bikeMetrics.totalFare === 0 ? 'Suspended' : `₹${bikeMetrics.totalFare}`}</span>
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
                  setTopUpAmount(Math.ceil((Math.max(20, metrics.totalFare - discount) - passengerWalletBalance) / 100) * 100);
                  setShowTopUpModal(true);
                }}
              >
                Top Up Wallet
              </button>
            </div>
          )}

          <button 
            className="btn-primary full-width mt-4 animate-pulse-btn" 
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

              <a href={`tel:${matchedDriver?.phone}`} className="circle-btn-phone">
                <Phone size={16} />
              </a>
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
                      setTopUpAmount(Math.ceil((activeRide.totalFare - passengerWalletBalance) / 100) * 100);
                      setShowTopUpModal(true);
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
                  setPaymentStep('processing');
                  setTimeout(() => {
                    setPaymentStep('feedback');
                  }, 1200);
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
                  completePaymentAndRate(starRating, finalTip);
                  setPaymentStep('select');
                  setSelectedTip(0);
                  setCustomTip('');
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
                  <p className="auth-card-desc">Enter your mobile number to get started booking rides in Kolkata.</p>
                  
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
                    setTopUpAmount(500);
                    setShowTopUpModal(true);
                  }}
                  title="Top Up Wallet"
                >
                  <Wallet size={12} />
                  <span>₹{passengerWalletBalance.toFixed(0)}</span>
                  <span className="text-[10px] text-emerald-500 font-extrabold">+</span>
                </button>

                <div className="flex gap-1">
                  <button className="header-icon-btn" onClick={() => setTab('history')} title="Ride History">
                    <History size={14} />
                  </button>
                  <button className="header-icon-btn logout" onClick={logoutPassenger} title="Logout">
                    <LogOut size={14} />
                  </button>
                </div>
              </div>
            </div>

            <div style={{ position: 'relative', width: '100%', height: 'calc(100% - 44px)' }}>
              <div ref={mapContainerRef} className="map-view-container" style={{ height: '100%' }}></div>
              
              <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 999, display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => setMapStyle('dark_navigation')}
                  style={{
                    padding: '3px 6px',
                    fontSize: '8px',
                    fontWeight: 'extrabold',
                    borderRadius: '4px',
                    backgroundColor: mapStyle === 'dark_navigation' ? '#ffdd00' : 'rgba(0,0,0,0.6)',
                    color: mapStyle === 'dark_navigation' ? '#000' : '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer'
                  }}
                >
                  ⚡ Ola/Uber Dark
                </button>
                <button
                  onClick={() => setMapStyle('google_roadmap')}
                  style={{
                    padding: '3px 6px',
                    fontSize: '8px',
                    fontWeight: 'extrabold',
                    borderRadius: '4px',
                    backgroundColor: mapStyle === 'google_roadmap' ? '#ffdd00' : 'rgba(0,0,0,0.6)',
                    color: mapStyle === 'google_roadmap' ? '#000' : '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer'
                  }}
                >
                  🗺️ Google Roadmap
                </button>
                <button
                  onClick={() => setMapStyle('google_satellite')}
                  style={{
                    padding: '3px 6px',
                    fontSize: '8px',
                    fontWeight: 'extrabold',
                    borderRadius: '4px',
                    backgroundColor: mapStyle === 'google_satellite' ? '#ffdd00' : 'rgba(0,0,0,0.6)',
                    color: mapStyle === 'google_satellite' ? '#000' : '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer'
                  }}
                >
                  🛰️ Google Sat
                </button>
                <button
                  onClick={() => setMapStyle('voyager')}
                  style={{
                    padding: '3px 6px',
                    fontSize: '8px',
                    fontWeight: 'extrabold',
                    borderRadius: '4px',
                    backgroundColor: mapStyle === 'voyager' ? '#ffdd00' : 'rgba(0,0,0,0.6)',
                    color: mapStyle === 'voyager' ? '#000' : '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer'
                  }}
                >
                  🎨 Classic
                </button>
              </div>
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
                        className="btn-pay-rzp mt-4 w-full py-2 bg-amber-500 text-black hover:bg-amber-600 font-bold rounded-lg text-xs"
                        onClick={executeWalletTopUp}
                      >
                        Authorize Top Up ₹{topUpAmount}
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
                            <button 
                              className="btn-text-only text-[10px] text-red-400 hover:text-red-300 font-semibold"
                              onClick={() => {
                                setActiveDisputeFormId(ride.id);
                                setComplaintText('');
                              }}
                            >
                              ⚠️ Dispute Ride Payout
                            </button>
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

      <div className="phone-home-bar"></div>
    </div>
  );
}
