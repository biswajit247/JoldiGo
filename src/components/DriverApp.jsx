import React, { useState, useEffect, useRef } from 'react';
import { useSimulator } from '../context/SimulatorContext';
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
  Power,
  Camera,
  Volume2,
  FileSpreadsheet,
  MessageSquare,
  Send
} from 'lucide-react';
import L from 'leaflet';

export default function DriverApp({ isStandalone }) {
  const {
    drivers,
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
    isGpsActive
  } = useSimulator();

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

  // Chat Panel State
  const [showChat, setShowChat] = useState(false);
  const [chatInputText, setChatInputText] = useState('');
  const chatEndRef = useRef(null);

  // Safety Pool Claim forms UI
  const [claimType, setClaimType] = useState('health');
  const [claimAmount, setClaimAmount] = useState(150);
  const [claimDesc, setClaimDesc] = useState('');

  // Map elements
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({
    driver: null,
    pickup: null,
    dropoff: null,
    routeLine: null,
  });

  const currentDriver = drivers.find((d) => d.id === selectedDriverId) || drivers[0];

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

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [selectedDriverId, currentDriver?.verificationStatus, currentDriver?.status]);

  // Update map markers reactively
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentDriver) return;

    if (markersRef.current.driver) map.removeLayer(markersRef.current.driver);
    if (markersRef.current.pickup) map.removeLayer(markersRef.current.pickup);
    if (markersRef.current.dropoff) map.removeLayer(markersRef.current.dropoff);
    if (markersRef.current.routeLine) map.removeLayer(markersRef.current.routeLine);

    const driverIcon = L.divIcon({
      className: 'custom-map-marker driver-self-marker',
      html: `<div class="marker-pin pin-driver-self ${currentDriver.vehicleType === 'bike' ? 'bike' : 'car'}">
               <span class="navigation-arrow">🛞</span>
             </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const pickupIcon = L.divIcon({
      className: 'custom-map-marker',
      html: `<div class="marker-pin pin-pickup"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const dropoffIcon = L.divIcon({
      className: 'custom-map-marker',
      html: `<div class="marker-pin pin-dropoff"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    markersRef.current.driver = L.marker([currentDriver.location.lat, currentDriver.location.lng], { icon: driverIcon }).addTo(map);
    map.panTo([currentDriver.location.lat, currentDriver.location.lng]);

    const isThisDriverAssigned = activeRide && activeRide.driverId === currentDriver.id;
    if (isThisDriverAssigned && activeRide.status !== 'searching') {
      markersRef.current.pickup = L.marker([activeRide.pickup.lat, activeRide.pickup.lng], { icon: pickupIcon }).addTo(map);
      markersRef.current.dropoff = L.marker([activeRide.dropoff.lat, activeRide.dropoff.lng], { icon: dropoffIcon }).addTo(map);

      if (activeRide.route) {
        const polyCoords = activeRide.route.map(pt => [pt.lat, pt.lng]);
        markersRef.current.routeLine = L.polyline(polyCoords, {
          color: '#00ff66',
          weight: 4,
          opacity: 0.8,
          dashArray: '8, 8',
        }).addTo(map);
      }
    }
  }, [activeRide, currentDriver, selectedDriverId]);

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

  return (
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

      {/* Simulator Switcher Controls (hidden in standalone native mode) */}
      {!isStandalone && (
        <div className="driver-simulator-picker">
          <label>Simulate Driver:</label>
          <select value={selectedDriverId} onChange={(e) => {
            setSelectedDriverId(e.target.value);
            setTab('dashboard');
          }}>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({getVehicleLabel(d.vehicleType)} - {d.verificationStatus})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="phone-screen-content">

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

            {tab === 'dashboard' && (
              <div ref={mapContainerRef} className="map-view-container driver-map"></div>
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
            <div className="driver-bottom-overlay card-glow">
              {activeRide && activeRide.driverId === currentDriver.id ? (
                // Active Job Flow UI
                <div className="active-job-details relative">
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

                      <a href={`tel:+919830000000`} className="circle-btn-phone">
                        <Phone size={14} />
                      </a>
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
                                <div className={`chat-bubble ${isSelf ? 'chat-bubble-self-driver' : 'chat-bubble-peer'}`}>
                                  {msg.text}
                                </div>
                                <div className="chat-meta">
                                  <span>🌐</span>
                                  <span className="italic">{msg.translation}</span>
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
                </div>
              )}
            </div>

            {/* TIMER DIALOG OFFER INCOMING */}
            {activeRide && activeRide.driverId === currentDriver.id && activeRide.status === 'searching' && (
              <div className="incoming-request-modal card-glow animate-bounce-in" style={{ top: '65px' }}>
                <div className="incoming-header">
                  <span className="pulse-dot red"></span>
                  <h4>UPFRONT DISPATCH OFFER</h4>
                </div>

                <div className="incoming-timer-arc">
                  <div className="timer-number">{activeRide.timer}s</div>
                </div>

                <div className="incoming-details-table">
                  <div className="row">
                    <span className="lbl">Vehicle Type:</span>
                    <span className="val bold text-yellow-400">{getVehicleLabel(activeRide.vehicleType)}</span>
                  </div>
                  <div className="row">
                    <span className="lbl">Dest Zone:</span>
                    <span className="val bold text-yellow-400">{activeRide.destinationZone}</span>
                  </div>
                  <div className="row">
                    <span className="lbl">Payment Method:</span>
                    <span className="val bold text-indigo-300 uppercase">{activeRide.paymentMethod}</span>
                  </div>
                  <div className="row font-semibold">
                    <span className="lbl">Traffic Friction:</span>
                    <span className="val text-orange-400">{activeRide.estimatedRouteFriction}</span>
                  </div>
                  
                  <div className="border-t border-white/5 my-1 pt-1"></div>
                  
                  {/* NO-HIDDEN-MATH INVOICE SPLIT */}
                  <div className="row text-[10px]">
                    <span className="lbl">Base Ride Fare:</span>
                    <span className="val">₹{activeRide.grossBaseRideFare.toFixed(2)}</span>
                  </div>
                  <div className="row text-[10px]">
                    <span className="lbl">Passenger GST (5%):</span>
                    <span className="val text-indigo-300">+₹{activeRide.gstAmount.toFixed(2)}</span>
                  </div>
                  <div className="row text-[10px]">
                    <span className="lbl">Toll Charges:</span>
                    <span className="val">₹{activeRide.tollEstimate}</span>
                  </div>
                  <div className="row text-[10px]">
                    <span className="lbl">Platform Cut (5%):</span>
                    <span className="val text-red-400">-₹{activeRide.commission.toFixed(2)}</span>
                  </div>
                  <div className="row border-t border-gray-700 pt-1 mt-1 font-bold text-[13px]">
                    <span className="lbl">Driver Net Share (95%):</span>
                    <span className="val text-green-400">₹{activeRide.takeHome.toFixed(2)}</span>
                  </div>
                  <div className="text-[8px] font-mono text-gray-500 mt-1 truncate">
                    Contract: {activeRide.contractHash}
                  </div>
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
            )}

          </div>
        )}

      </div>

      <div className="phone-home-bar"></div>
    </div>
  );
}
