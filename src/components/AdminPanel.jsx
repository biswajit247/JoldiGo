import React, { useState, useEffect, useRef } from 'react';
import { useSimulator } from '../context/SimulatorContext';
import { 
  Activity, 
  Users, 
  Map, 
  Sliders, 
  DollarSign, 
  ShieldAlert, 
  CheckCircle, 
  XCircle, 
  Terminal, 
  Play,
  Building,
  ShieldCheck,
  AlertTriangle,
  Moon,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import L from 'leaflet';

export default function AdminPanel() {
  const {
    drivers,
    geofence,
    activeRide,
    sosAlerts,
    settings,
    logs,
    disputes,
    fuelPrices,
    setFuelPrices,
    insuranceReservePool,
    isNightMode,
    setIsNightMode,
    verifyDriverStatus,
    updateSettings,
    updateGeofence,
    resolveSOS,
    resolveDispute,
    fastForwardDisputeSla,
    congestionZones,
    toggleCongestionZone,
    safetyClaims,
    resolveSafetyClaim,
    connectAdminSocket,
  } = useSimulator();

  useEffect(() => {
    connectAdminSocket();
  }, []);

  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [selectedDriverForDoc, setSelectedDriverForDoc] = useState(null);

  // Form states for settings
  const [baseFareCarAC, setBaseFareCarAC] = useState(settings.baseFareCarAC || 50);
  const [perKmCarAC, setPerKmCarAC] = useState(settings.perKmCarAC || 20);
  const [baseFareCarNonAC, setBaseFareCarNonAC] = useState(settings.baseFareCarNonAC || 30);
  const [perKmCarNonAC, setPerKmCarNonAC] = useState(settings.perKmCarNonAC || 15);
  const [baseFareBike, setBaseFareBike] = useState(settings.baseFareBike || 20);
  const [perKmBike, setPerKmBike] = useState(settings.perKmBike || 7);
  const [surgeMultiplier, setSurgeMultiplier] = useState(settings.surgeMultiplier || 1.0);
  const [localFuelPrices, setLocalFuelPrices] = useState(fuelPrices);

  // Chart interactivity states
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null);

  // Mock playing evidence states
  const [playingMediaId, setPlayingMediaId] = useState(null);

  // Map elements
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({
    drivers: {},
    activeRide: null,
    geofencePolygon: null,
    sosElements: [], 
    trafficCircles: [], // Keep track of traffic overlays
  });

  // Sync settings inputs with global settings changes
  useEffect(() => {
    setBaseFareCarAC(settings.baseFareCarAC || 50);
    setPerKmCarAC(settings.perKmCarAC || 20);
    setBaseFareCarNonAC(settings.baseFareCarNonAC || 30);
    setPerKmCarNonAC(settings.perKmCarNonAC || 15);
    setBaseFareBike(settings.baseFareBike || 20);
    setPerKmBike(settings.perKmBike || 7);
    setSurgeMultiplier(settings.surgeMultiplier || 1.0);
  }, [settings]);

  useEffect(() => {
    setLocalFuelPrices(fuelPrices);
  }, [fuelPrices]);

  // Leaflet Map Initialization
  useEffect(() => {
    if (activeTab !== 'dashboard' || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([22.5726, 88.3639], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    mapRef.current = map;

    // Render Geofence Boundary
    const geofenceCoords = geofence.map(c => [c.lat, c.lng]);
    markersRef.current.geofencePolygon = L.polygon(geofenceCoords, {
      color: '#ff9900',
      weight: 2,
      fillColor: '#ff9900',
      fillOpacity: 0.05,
    }).addTo(map);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [activeTab, geofence]);

  // Update Map Markers (including dynamic SOS police dispatches and congestion zones)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || activeTab !== 'dashboard') return;

    // Clear old driver and ride markers
    Object.values(markersRef.current.drivers).forEach(m => map.removeLayer(m));
    markersRef.current.drivers = {};

    if (markersRef.current.activeRide) {
      map.removeLayer(markersRef.current.activeRide);
      markersRef.current.activeRide = null;
    }

    // Clear old SOS elements
    if (markersRef.current.sosElements) {
      markersRef.current.sosElements.forEach(layer => map.removeLayer(layer));
    }
    markersRef.current.sosElements = [];

    // Clear old Traffic elements
    if (markersRef.current.trafficCircles) {
      markersRef.current.trafficCircles.forEach(c => map.removeLayer(c));
    }
    markersRef.current.trafficCircles = [];

    // Render traffic congestion circles on Admin Map
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
        fillOpacity: 0.08,
        radius: 600,
        weight: 1.5,
        dashArray: '4, 4'
      }).addTo(map).bindPopup(`<b>${z.name}</b><br/>Congestion: ${status.toUpperCase()}`);

      markersRef.current.trafficCircles.push(circle);
    });

    // Render drivers
    drivers.forEach(d => {
      let pinColor = '#999'; 
      let isSOS = sosAlerts.some(alert => alert.driverId === d.id && (alert.status === 'dispatch' || alert.status === 'secured'));

      if (isSOS) {
        pinColor = '#ff3333'; 
      } else if (d.status === 'online') {
        const isRiding = activeRide && activeRide.driverId === d.id && activeRide.status !== 'searching' && activeRide.status !== 'completed';
        pinColor = isRiding ? '#ffaa00' : '#00ff66'; 
      }

      const adminDriverIcon = L.divIcon({
        className: 'admin-driver-marker-div',
        html: `<div class="admin-marker-dot ${isSOS ? 'sos-pulse' : ''}" style="background-color: ${pinColor}">
                 <span class="lbl-init">${d.avatar}</span>
               </div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      const m = L.marker([d.location.lat, d.location.lng], { icon: adminDriverIcon })
        .addTo(map)
        .bindPopup(`<b>${d.name}</b><br/>Status: ${d.status}<br/>Vehicle: ${d.vehicleNumber}`);
      
      markersRef.current.drivers[d.id] = m;
    });

    // Render active ride route lines
    if (activeRide && activeRide.route && activeRide.status !== 'searching') {
      const polyCoords = activeRide.route.map(pt => [pt.lat, pt.lng]);
      markersRef.current.activeRide = L.polyline(polyCoords, {
        color: '#ffaa00',
        weight: 3.5,
        opacity: 0.8,
      }).addTo(map);
    }

    // Render active SOS danger zones & animated police vehicles
    sosAlerts.forEach(alert => {
      if (alert.status === 'dispatch' || alert.status === 'secured') {
        const distressedDriver = drivers.find(d => d.id === alert.driverId);
        if (!distressedDriver) return;

        const threatRing = L.circle([distressedDriver.location.lat, distressedDriver.location.lng], {
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.15,
          radius: 350, 
          weight: 1.5,
          className: 'danger-threat-pulsing-circle'
        }).addTo(map);
        markersRef.current.sosElements.push(threatRing);

        if (alert.policeRoute) {
          const policeLine = L.polyline(alert.policeRoute.map(pt => [pt.lat, pt.lng]), {
            color: '#3b82f6',
            weight: 2,
            dashArray: '6, 6',
            opacity: 0.7
          }).addTo(map);
          markersRef.current.sosElements.push(policeLine);
        }

        if (alert.policeLocation) {
          const policeIcon = L.divIcon({
            className: 'police-interceptor-marker',
            html: `<div class="police-marker-dot flex items-center justify-center text-xs animate-bounce bg-blue-600 border border-white rounded-full w-[26px] h-[26px] shadow-lg">🚔</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          });
          const policeMarker = L.marker([alert.policeLocation.lat, alert.policeLocation.lng], { icon: policeIcon }).addTo(map);
          markersRef.current.sosElements.push(policeMarker);
        }
      }
    });

  }, [drivers, activeRide, sosAlerts, activeTab, congestionZones]);

  // Form handlers
  const handleSaveSettings = (e) => {
    e.preventDefault();
    updateSettings({
      baseFareCarAC: parseFloat(baseFareCarAC),
      perKmCarAC: parseFloat(perKmCarAC),
      baseFareCarNonAC: parseFloat(baseFareCarNonAC),
      perKmCarNonAC: parseFloat(perKmCarNonAC),
      baseFareBike: parseFloat(baseFareBike),
      perKmBike: parseFloat(perKmBike),
      surgeMultiplier: parseFloat(surgeMultiplier),
    });
  };

  const handleUpdateFuelIndex = (e) => {
    e.preventDefault();
    setFuelPrices({
      cng: parseFloat(localFuelPrices.cng),
      petrol: parseFloat(localFuelPrices.petrol),
      diesel: parseFloat(localFuelPrices.diesel)
    });
  };

  const handleGeofencePreset = (presetName) => {
    let newGeofence = [];
    if (presetName === 'strict') {
      newGeofence = [
        { lat: 22.6100, lng: 88.3300 },
        { lat: 22.6100, lng: 88.4200 },
        { lat: 22.5200, lng: 88.4200 },
        { lat: 22.5200, lng: 88.3300 },
      ];
    } else if (presetName === 'expanded') {
      newGeofence = [
        { lat: 22.6800, lng: 88.3000 }, 
        { lat: 22.6800, lng: 88.5200 }, 
        { lat: 22.4600, lng: 88.5200 }, 
        { lat: 22.4600, lng: 88.3000 }, 
      ];
    } else {
      newGeofence = [
        { lat: 22.6600, lng: 88.3200 },
        { lat: 22.6600, lng: 88.4800 },
        { lat: 22.4900, lng: 88.4800 },
        { lat: 22.4900, lng: 88.3200 },
      ];
    }
    updateGeofence(newGeofence);
  };

  // Compute Platform Totals for Finance Tab
  const computeFinancials = () => {
    let platformCommissionTotal = 0;
    let accumulatedGstTotal = 0;
    
    drivers.forEach(d => {
      platformCommissionTotal += d.earnings.commission;
    });

    disputes.forEach(disp => {
      if (disp.status === 'awaiting_evidence' || disp.status === 'under_review') {
        platformCommissionTotal += disp.commission;
      }
    });

    accumulatedGstTotal = platformCommissionTotal;

    const grossBookings = platformCommissionTotal / 0.05; 
    const driverPayouts = grossBookings * 0.95; 
    const gatewayFees = grossBookings * 1.05 * 0.02; 

    const odttaLicenseMonthlyAmortized = 8333; 
    const controlRoomStaffCostMonthly = 60000; 

    const netPlatformProfits = platformCommissionTotal - gatewayFees - (odttaLicenseMonthlyAmortized + controlRoomStaffCostMonthly);

    return {
      grossBookings: parseFloat(grossBookings.toFixed(2)),
      platformCommissionTotal: parseFloat(platformCommissionTotal.toFixed(2)),
      accumulatedGstTotal: parseFloat(accumulatedGstTotal.toFixed(2)),
      gatewayFees: parseFloat(gatewayFees.toFixed(2)),
      driverPayouts: parseFloat(driverPayouts.toFixed(2)),
      netPlatformProfits: parseFloat(netPlatformProfits.toFixed(2)),
      licenseFeeFixed: 500000,
      controlRoomStaff: 60000,
      monthlyAmortizedOverheads: odttaLicenseMonthlyAmortized + controlRoomStaffCostMonthly
    };
  };

  const financials = computeFinancials();

  // Weekly Revenue Trend Chart Dataset (merging today's dynamic totals)
  const WEEKLY_REVENUE_DATA = [
    { day: 'Mon', bookings: 15400, commission: 770, gst: 770 },
    { day: 'Tue', bookings: 18200, commission: 910, gst: 910 },
    { day: 'Wed', bookings: 14500, commission: 725, gst: 725 },
    { day: 'Thu', bookings: 19800, commission: 990, gst: 990 },
    { day: 'Fri', bookings: 24000, commission: 1200, gst: 1200 },
    { day: 'Sat', bookings: 28500, commission: 1425, gst: 1425 },
    { 
      day: 'Sun', 
      bookings: financials.grossBookings || 21160, 
      commission: financials.platformCommissionTotal || 1058, 
      gst: financials.accumulatedGstTotal || 1058 
    }
  ];

  const maxWeeklyBookingValue = Math.max(...WEEKLY_REVENUE_DATA.map(d => d.bookings));

  const getVehicleLabel = (type) => {
    if (type === 'car_ac') return '4-Wheeler AC';
    if (type === 'car_non_ac') return '4-Wheeler Non-AC';
    return 'App Bike';
  };

  return (
    <div className="admin-desktop-layout">
      {/* SOS EMERGENCY BANNER */}
      {sosAlerts.some(alert => alert.status === 'dispatch' || alert.status === 'secured') && (
        <div className="admin-sos-global-banner animate-pulse">
          <div className="sos-banner-content">
            <ShieldAlert size={20} className="banner-icon" />
            <span>
              <b>CRITICAL EMERGENCY (24/7 Control Room Active):</b> {sosAlerts.filter(a => a.status === 'dispatch' || alert.status === 'secured').length} Active SOS Panic Signal(s) triggered! Police interceptor units dispatched.
            </span>
          </div>
          <button className="btn-resolve-banner" onClick={() => setActiveTab('dashboard')}>
            Review Incidents
          </button>
        </div>
      )}

      {/* Main Admin Frame Container */}
      <div className="admin-dashboard-container" style={{ height: '720px' }}>
        
        {/* Left Sidebar Navigation */}
        <aside className="admin-sidebar card-glow">
          <div className="sidebar-brand">
            <div className="logo-indicator"></div>
            <h3>JoldiGo Admin</h3>
            <span className="text-xs text-amber-500 font-semibold tracking-wider uppercase mt-1">Control Center</span>
          </div>

          <nav className="sidebar-nav">
            <button 
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <Activity size={18} />
              <span>Live Operations</span>
            </button>

            <button 
              className={`nav-item ${activeTab === 'drivers' ? 'active' : ''}`}
              onClick={() => setActiveTab('drivers')}
            >
              <Users size={18} />
              <span>Partner Documents</span>
              {drivers.filter(d => d.verificationStatus === 'pending').length > 0 && (
                <span className="pending-badge">{drivers.filter(d => d.verificationStatus === 'pending').length}</span>
              )}
            </button>

            <button 
              className={`nav-item ${activeTab === 'disputes' ? 'active' : ''}`}
              onClick={() => setActiveTab('disputes')}
            >
              <ShieldAlert size={18} />
              <span>Dispute Gateway</span>
              {disputes.filter(d => !d.status.startsWith('resolved')).length > 0 && (
                <span className="pending-badge bg-red-600 text-white">
                  {disputes.filter(d => !d.status.startsWith('resolved')).length}
                </span>
              )}
            </button>

            <button 
              className={`nav-item ${activeTab === 'geofence' ? 'active' : ''}`}
              onClick={() => setActiveTab('geofence')}
            >
              <Map size={18} />
              <span>Geofencing Zones</span>
            </button>

            <button 
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <Sliders size={18} />
              <span>Pricing Engine</span>
            </button>

            <button 
              className={`nav-item ${activeTab === 'finance' ? 'active' : ''}`}
              onClick={() => setActiveTab('finance')}
            >
              <DollarSign size={18} />
              <span>Financial Ledger</span>
            </button>
          </nav>

          <div className="sidebar-footer">
            <div className="system-status">
              <span className="status-dot-green"></span>
              <span>24/7 Control Room: ACTIVE</span>
            </div>
            <span className="version">v2.4.0-prod</span>
          </div>
        </aside>

        {/* Right Content Panels */}
        <main className="admin-content-area">
          
          {/* TAB 1: LIVE OPERATIONS DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="admin-tab-content grid-dashboard" style={{ maxHeight: '100%', overflowY: 'auto' }}>
              
              <div className="kpi-row">
                <div className="kpi-card card-glow">
                  <span className="kpi-label">Active Rides</span>
                  <span className="kpi-value">{activeRide && activeRide.status !== 'completed' ? 1 : 0}</span>
                  <span className="kpi-sub green">On Kolkata Map</span>
                </div>

                <div className="kpi-card card-glow">
                  <span className="kpi-label">Drivers Online</span>
                  <span className="kpi-value">{drivers.filter(d => d.status === 'online').length} / {drivers.length}</span>
                  <span className="kpi-sub text-gray-400">Available: {drivers.filter(d => d.status === 'online' && d.verificationStatus === 'verified' && (!activeRide || activeRide.driverId !== d.id)).length}</span>
                </div>

                <div className="kpi-card card-glow">
                  <span className="kpi-label">Petrol / Diesel / CNG</span>
                  <span className="kpi-value text-indigo-400" style={{ fontSize: '14px', marginTop: '6px' }}>
                    P: ₹{fuelPrices.petrol.toFixed(0)} | D: ₹{fuelPrices.diesel.toFixed(0)} | C: ₹{fuelPrices.cng.toFixed(0)}
                  </span>
                  <span className="kpi-sub text-gray-400">Live API Fuel Feeds</span>
                </div>

                <div className="kpi-card card-glow">
                  <span className="kpi-label">Active SOS alerts</span>
                  <span className={`kpi-value ${sosAlerts.filter(a => a.status === 'dispatch' || a.status === 'secured').length > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {sosAlerts.filter(a => a.status === 'dispatch' || a.status === 'secured').length}
                  </span>
                  <span className="kpi-sub text-gray-400">24/7 Control room log</span>
                </div>
              </div>

              {/* INTERACTIVE TRAFFIC CONGESTION DISPATCH CONTROL PANEL */}
              <div className="fuel-pricing-simulator-box card-glow p-4 bg-indigo-950/5 border border-indigo-500/10 rounded-xl mt-4">
                <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 font-mono uppercase tracking-wider">🚦 Live Traffic & Congestion Dispatch Control Board</h4>
                <p className="text-[11px] text-gray-400 mt-1">Adjust flow rates on major Kolkata transit corridors. Changes instantly update map indicators and ride index surcharges.</p>
                
                <div className="flex gap-4 mt-3">
                  {[
                    { key: 'HOWRAH_BRIDGE', name: 'Howrah Bridge Transit' },
                    { key: 'PARK_STREET', name: 'Park Street Core' },
                    { key: 'SALT_LAKE_SEC5', name: 'Sector V Tech Zone' }
                  ].map(zone => {
                    const current = congestionZones[zone.key] || 'clear';
                    return (
                      <div key={zone.key} className="flex-1 bg-black/45 p-3 border border-white/5 rounded-lg flex flex-col justify-between" style={{ minHeight: '90px' }}>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-white block">{zone.name}</span>
                          <span className={`w-2.5 h-2.5 rounded-full ${current === 'heavy' ? 'bg-red-500' : (current === 'medium' ? 'bg-orange-500' : 'bg-green-500')}`}></span>
                        </div>
                        
                        <div className="flex items-center gap-1.5 mt-3">
                          <button 
                            className={`flex-1 py-1 rounded text-[9px] font-bold border transition ${current === 'clear' ? 'bg-green-500/20 border-green-500 text-green-400 font-extrabold' : 'bg-transparent border-white/5 text-gray-500'}`}
                            onClick={() => toggleCongestionZone(zone.key, 'clear')}
                          >
                            Clear (1.0x)
                          </button>
                          <button 
                            className={`flex-1 py-1 rounded text-[9px] font-bold border transition ${current === 'medium' ? 'bg-orange-500/20 border-orange-500 text-orange-400 font-extrabold' : 'bg-transparent border-white/5 text-gray-500'}`}
                            onClick={() => toggleCongestionZone(zone.key, 'medium')}
                          >
                            Med (1.08x)
                          </button>
                          <button 
                            className={`flex-1 py-1 rounded text-[9px] font-bold border transition ${current === 'heavy' ? 'bg-red-500/20 border-red-500 text-red-400 font-extrabold' : 'bg-transparent border-white/5 text-gray-500'}`}
                            onClick={() => toggleCongestionZone(zone.key, 'heavy')}
                          >
                            Heavy (1.15x)
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Map & Live Log Panel */}
              <div className="dashboard-layout-row mt-4">
                
                <div className="ops-map-card card-glow" style={{ height: '320px' }}>
                  <div className="card-header-flex">
                    <h4>Kolkata Real-time Operations Map</h4>
                    <div className="map-legend">
                      <span className="leg-item"><span className="dot green"></span> Free</span>
                      <span className="leg-item"><span className="dot orange"></span> In Ride</span>
                      <span className="leg-item"><span className="dot red"></span> SOS</span>
                      <span className="leg-item"><span className="dot blue"></span> 🚔 Patrol</span>
                    </div>
                  </div>
                  <div ref={mapContainerRef} className="admin-leaflet-map-container"></div>
                </div>

                <div className="ops-terminal-card card-glow" style={{ height: '320px' }}>
                  <div className="card-header-flex">
                    <h4><Terminal size={16} /> Server Log Console</h4>
                    <span className="status-badge-terminal font-mono">ON_SOCKET</span>
                  </div>
                  <div className="terminal-log-output">
                    {logs.length === 0 ? (
                      <div className="log-line text-gray-500 font-mono">System initialized. Awaiting API endpoints transactions...</div>
                    ) : (
                      logs.map(log => (
                        <div key={log.id} className={`log-line font-mono type-${log.type}`}>
                          <span className="log-time">[{log.time}]</span>
                          <span className="log-msg"> {log.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {sosAlerts.filter(a => a.status !== 'resolved').length > 0 && (
                <div className="sos-incident-section card-glow mt-4">
                  <h4>⚠️ SOS Safety Incidents Logs (24/7 Emergency Dispatcher Board)</h4>
                  
                  <div className="sos-list-table mt-2">
                    <div className="sos-header-row" style={{ gridTemplateColumns: '110px 110px 100px 180px 1fr' }}>
                      <span>Driver Partner</span>
                      <span>Vehicle Reg</span>
                      <span>Triggered At</span>
                      <span>Emergency Dispatch Status</span>
                      <span>Control Room Action</span>
                    </div>

                    {sosAlerts.filter(a => a.status !== 'resolved').map(alert => (
                      <div key={alert.id} className={`sos-body-row status-${alert.status}`} style={{ gridTemplateColumns: '110px 110px 100px 180px 1fr', padding: '10px 12px' }}>
                        <span className="font-semibold text-white">{alert.driverName}</span>
                        <span className="font-mono text-xs">{alert.vehicleNumber}</span>
                        <span>{alert.time}</span>
                        
                        <div>
                          {alert.status === 'dispatch' && (
                            <span className="text-yellow-400 font-semibold text-xs animate-pulse">
                              🚨 Dispatched (ETA: {alert.eta}s)
                            </span>
                          )}
                          {alert.status === 'secured' && (
                            <span className="text-green-400 font-semibold text-xs flex items-center gap-1">
                              🛡️ Secured (Patrol Arrived)
                            </span>
                          )}
                        </div>

                        <div>
                          {alert.status === 'dispatch' ? (
                            <button className="btn-resolve-emergency opacity-60 cursor-not-allowed text-[10px] py-1 px-3" disabled>
                              Awaiting Patrol Arrival...
                            </button>
                          ) : (
                            <button className="btn-resolve-emergency text-[10px] py-1 px-3 bg-green-700 hover:bg-green-800" onClick={() => resolveSOS(alert.id)}>
                              Archive Incident & Clear Alarm
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: USER & DRIVER DOCUMENT VERIFICATION */}
          {activeTab === 'drivers' && (
            <div className="admin-tab-content">
              <div className="section-title-flex">
                <h3>Driver Partner Management</h3>
                <p className="text-gray-400 text-sm">Review onboard documents for legal compliance to authorize rides.</p>
              </div>

              <div className="driver-list-table card-glow mt-3">
                <div className="table-header">
                  <span>Partner Name</span>
                  <span>Vehicle Type</span>
                  <span>Registration (RC)</span>
                  <span>Aadhar Verification</span>
                  <span>License Status</span>
                  <span>Documents Review</span>
                </div>

                {drivers.map(d => (
                  <div key={d.id} className="table-row">
                    <div className="col-partner">
                      <span className="drv-avatar-mini">{d.avatar}</span>
                      <div className="drv-details">
                        <span className="bold">{d.name}</span>
                        <span className="text-xs text-gray-400">{d.phone}</span>
                      </div>
                    </div>
                    <span>{getVehicleLabel(d.vehicleType)} ({d.vehicleName})</span>
                    <span className="font-mono text-xs">{d.documents?.rc || 'Not Uploaded'}</span>
                    <span className="font-mono text-xs">{d.documents?.aadhar || 'Not Uploaded'}</span>
                    <span className="font-mono text-xs">{d.documents?.license || 'Not Uploaded'}</span>
                    
                    <div>
                      {d.verificationStatus === 'verified' && (
                        <span className="badge-status-table verified">Approved ✓</span>
                      )}
                      {d.verificationStatus === 'rejected' && (
                        <span className="badge-status-table rejected">Rejected ✗</span>
                      )}
                      {d.verificationStatus === 'pending' && (
                        <button 
                          className="btn-action-verify animate-pulse-btn"
                          onClick={() => setSelectedDriverForDoc(d)}
                        >
                          Review Docs
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Doc Review Modal */}
              {selectedDriverForDoc && (
                <div className="admin-modal-overlay">
                  <div className="admin-modal-card card-glow animate-bounce-in">
                    <div className="modal-header">
                      <h4>Document Verification Portal</h4>
                      <button className="close-modal-btn" onClick={() => setSelectedDriverForDoc(null)}>×</button>
                    </div>

                    <div className="modal-body-content mt-3">
                      <p className="text-gray-400 text-sm mb-4">
                        Reviewing files for partner applicant: <b>{selectedDriverForDoc.name}</b>
                      </p>

                      <div className="doc-preview-stacked">
                        <div className="doc-item">
                          <label>Driving License (DL)</label>
                          <div className="doc-value-box font-mono">{selectedDriverForDoc.documents?.license}</div>
                        </div>

                        <div className="doc-item mt-2">
                          <label>Aadhar Identity No.</label>
                          <div className="doc-value-box font-mono">{selectedDriverForDoc.documents?.aadhar}</div>
                        </div>

                        <div className="doc-item mt-2">
                          <label>Vehicle Registration Book (RC)</label>
                          <div className="doc-value-box font-mono">{selectedDriverForDoc.documents?.rc}</div>
                        </div>
                      </div>

                      <div className="kyc-disclaimer mt-4 p-3 bg-amber-500/10 border border-amber-500/20 text-xs rounded text-amber-300">
                        🛡️ By approving, you verify that these mock details comply with the West Bengal aggregators guidelines.
                      </div>
                    </div>

                    <div className="modal-footer-actions mt-4">
                      <button 
                        className="btn-modal-reject"
                        onClick={() => {
                          verifyDriverStatus(selectedDriverForDoc.id, false);
                          setSelectedDriverForDoc(null);
                        }}
                      >
                        Reject Documents
                      </button>
                      <button 
                        className="btn-modal-approve"
                        onClick={() => {
                          verifyDriverStatus(selectedDriverForDoc.id, true);
                          setSelectedDriverForDoc(null);
                        }}
                      >
                        Approve Partner Account
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 3: DISPUTE EVIDENCE GATEWAY */}
          {activeTab === 'disputes' && (
            <div className="admin-tab-content">
              <div className="section-title-flex">
                <h3>Evidence-First Dispute Gateway</h3>
                <p className="text-gray-400 text-sm">Review rider complaints, inspect driver evidence, and execute final payouts.</p>
              </div>

              {disputes.length === 0 ? (
                <div className="empty-state text-center card-glow p-8 mt-4 bg-white/2">
                  <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
                  <h4>No Disputes Pending Review</h4>
                  <p className="text-xs text-gray-500 mt-1">All driver payouts are flowing normally. Zero dispute logs filed.</p>
                </div>
              ) : (
                <div className="driver-list-table card-glow mt-3" style={{ overflowY: 'auto' }}>
                  <div className="table-header" style={{ gridTemplateColumns: '120px 180px 140px 140px 140px 1fr' }}>
                    <span>Case Status</span>
                    <span>Rider Complaint</span>
                    <span>Driver Partner</span>
                    <span>Hold Payout</span>
                    <span>Dispute SLA</span>
                    <span>Evidence / Action</span>
                  </div>

                  {disputes.map(disp => {
                    const isClosed = disp.status.startsWith('resolved');
                    return (
                      <div key={disp.id} className="table-row" style={{ gridTemplateColumns: '120px 180px 140px 140px 140px 1fr', padding: '16px 18px' }}>
                        
                        <div>
                          {disp.status === 'awaiting_evidence' && (
                            <span className="badge-status-table rejected font-mono text-[9px] uppercase tracking-wider">Awaiting Proof</span>
                          )}
                          {disp.status === 'under_review' && (
                            <span className="badge-status-table verified font-mono text-[9px] uppercase tracking-wider bg-indigo-500/10 text-indigo-400">Review Ready</span>
                          )}
                          {disp.status === 'resolved_driver' && (
                            <span className="badge-status-table verified font-mono text-[9px] uppercase tracking-wider bg-green-500/10 text-green-400">Driver Won ✓</span>
                          )}
                          {disp.status === 'resolved_rider' && (
                            <span className="badge-status-table rejected font-mono text-[9px] uppercase tracking-wider bg-red-500/10 text-red-400">Rider Won ✗</span>
                          )}
                        </div>

                        <div className="text-xs text-gray-200">
                          {disp.riderComplaint}
                          <div className="text-[9px] text-gray-500 mt-1">Route: {disp.pickupName.substr(0,12)}... → {disp.dropoffName.substr(0,12)}...</div>
                        </div>

                        <span className="font-semibold text-xs">{disp.driverName}</span>
                        <span className="font-semibold text-xs text-yellow-500">₹{disp.suspendedPayout} (Hold)</span>

                        <div>
                          {isClosed ? (
                            <span className="text-xs text-gray-500">Closed Case</span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span className="font-mono text-xs text-red-400 font-bold">{disp.expiresIn}s SLA timer</span>
                              <button 
                                className="btn-secondary text-[8px] py-0.5 px-2 bg-amber-500/10 border-amber-500/20 text-amber-300 w-fit"
                                onClick={() => fastForwardDisputeSla(disp.id)}
                              >
                                Skip 48 Hours
                              </button>
                            </div>
                          )}
                        </div>

                        <div>
                          {isClosed ? (
                            <span className="text-xs text-gray-500">Case resolved.</span>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {disp.status === 'under_review' ? (
                                <div className="p-2 bg-black/40 rounded border border-white/5 text-[10px] flex items-center justify-between">
                                  <span className="font-mono text-indigo-400 truncate max-w-[120px]">📄 {disp.evidenceMedia}</span>
                                  <button 
                                    className="p-1 bg-indigo-500 text-black hover:bg-indigo-600 rounded"
                                    onClick={() => {
                                      setPlayingMediaId(disp.id);
                                      setTimeout(() => setPlayingMediaId(null), 3000);
                                    }}
                                  >
                                    <Play size={10} fill="#000" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-gray-500 italic">No media submitted yet.</span>
                              )}

                              {playingMediaId === disp.id && (
                                <div className="text-[9px] text-indigo-400 font-semibold animate-pulse">
                                  🔊 Playing simulated cabin audio / video clip...
                                </div>
                              )}

                              <div className="flex gap-2">
                                <button 
                                  className="btn-pay-rzp py-1 px-3 text-[10px] bg-green-700 hover:bg-green-800 flex-1"
                                  onClick={() => resolveDispute(disp.id, 'driver')}
                                >
                                  Rule for Driver
                                </button>
                                <button 
                                  className="btn-pay-rzp py-1 px-3 text-[10px] bg-red-700 hover:bg-red-800 flex-1"
                                  onClick={() => resolveDispute(disp.id, 'rider')}
                                >
                                  Rule for Rider
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: GEOFENCING ZONES */}
          {activeTab === 'geofence' && (
            <div className="admin-tab-content">
              <div className="section-title-flex">
                <h3>Geofencing Boundaries Manager</h3>
                <p className="text-gray-400 text-sm">Draw dynamic bounds to toggle operating territories in Kolkata.</p>
              </div>

              <div className="geofence-layout mt-3">
                <div className="geofence-controls card-glow p-4">
                  <h4>Operational Territory Controls</h4>
                  <p className="text-xs text-gray-400 mt-1">Restrict where rides can be booked or started.</p>

                  <div className="preset-buttons-col mt-4">
                    <button className="btn-secondary full-width text-left justify-between" onClick={() => handleGeofencePreset('default')}>
                      <span>Kolkata Standard Core (Default)</span>
                      <span className="text-xs text-gray-500">4 Coordinates</span>
                    </button>

                    <button className="btn-secondary full-width text-left justify-between mt-2" onClick={() => handleGeofencePreset('strict')}>
                      <span>Contract: Park Street & Victoria (Strict)</span>
                      <span className="text-xs text-yellow-500">Tight Core</span>
                    </button>

                    <button className="btn-secondary full-width text-left justify-between mt-2" onClick={() => handleGeofencePreset('expanded')}>
                      <span>Expand: Salt Lake & CCU Airport (Broad)</span>
                      <span className="text-xs text-green-500">Broad Coverage</span>
                    </button>
                  </div>

                  <div className="polygon-points-list mt-4">
                    <h5 className="font-semibold text-xs text-gray-400 uppercase tracking-wider">Active Boundary Polygon</h5>
                    <div className="poly-list-box mt-2">
                      {geofence.map((pt, idx) => (
                        <div key={idx} className="poly-point-row font-mono text-xs text-gray-300">
                          <span>Point {idx + 1}:</span>
                          <span>{pt.lat.toFixed(5)}, {pt.lng.toFixed(5)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="geofence-preview-card card-glow">
                  <div className="info-alert text-xs mb-2 text-center text-gray-400">
                    💡 The Passenger App queries this boundary in real-time before matches are allowed.
                  </div>
                  <div className="map-placeholder-text">
                    <Map size={32} className="text-amber-500" />
                    <span className="font-semibold mt-2">Geofence Boundary Activated</span>
                    <span className="text-xs text-gray-400">Map displays orange boundary constraints during simulation.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PRICING ENGINE & NIGHT MODE TOGGLES */}
          {activeTab === 'settings' && (
            <div className="admin-tab-content">
              <div className="section-title-flex">
                <h3>Fare & Surge Pricing Engine</h3>
                <p className="text-gray-400 text-sm">Configure parameters that determine real-time pricing algorithms.</p>
              </div>

              {/* Night Hour & Fuel API Index Simulator widgets */}
              <div className="flex gap-4 mt-3 mb-4">
                
                {/* 1. Fuel Indexer */}
                <div className="fuel-pricing-simulator-box card-glow p-4 bg-indigo-950/20 border border-indigo-500/20 rounded-xl flex-1">
                  <h4 className="text-sm font-bold text-indigo-400">⛽ Kolkata Fuel Market Price Feed Indexer</h4>
                  
                  <form className="flex flex-col gap-3 mt-3" onSubmit={handleUpdateFuelIndex}>
                    {/* CNG Slider */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>CNG Price (Bikes):</span>
                        <span className="font-bold text-white">₹{localFuelPrices.cng.toFixed(2)} / kg</span>
                      </div>
                      <input 
                        type="range"
                        min="80.00"
                        max="120.00"
                        step="0.50"
                        value={localFuelPrices.cng}
                        onChange={(e) => setLocalFuelPrices(prev => ({ ...prev, cng: parseFloat(e.target.value) }))}
                        className="surge-slider-range"
                        style={{ accentColor: '#818cf8', marginTop: '4px' }}
                      />
                    </div>

                    {/* Petrol Slider */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Petrol Price (Premium AC):</span>
                        <span className="font-bold text-white">₹{localFuelPrices.petrol.toFixed(2)} / L</span>
                      </div>
                      <input 
                        type="range"
                        min="95.00"
                        max="125.00"
                        step="0.50"
                        value={localFuelPrices.petrol}
                        onChange={(e) => setLocalFuelPrices(prev => ({ ...prev, petrol: parseFloat(e.target.value) }))}
                        className="surge-slider-range"
                        style={{ accentColor: '#ef4444', marginTop: '4px' }}
                      />
                    </div>

                    {/* Diesel Slider */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Diesel Price (Non-AC Cars):</span>
                        <span className="font-bold text-white">₹{localFuelPrices.diesel.toFixed(2)} / L</span>
                      </div>
                      <input 
                        type="range"
                        min="80.00"
                        max="110.00"
                        step="0.50"
                        value={localFuelPrices.diesel}
                        onChange={(e) => setLocalFuelPrices(prev => ({ ...prev, diesel: parseFloat(e.target.value) }))}
                        className="surge-slider-range"
                        style={{ accentColor: '#ffaa00', marginTop: '4px' }}
                      />
                    </div>

                    <button type="submit" className="btn-primary py-1.5 px-4 bg-indigo-600 hover:bg-indigo-700 w-auto text-xs text-white mt-1">
                      Apply API Fuel Prices Index
                    </button>
                  </form>
                  <div className="mt-2 text-[10px] text-gray-500">
                    Surcharges map category fuels (Petrol for AC, Diesel for Non-AC, CNG for Bike) to dynamic passenger minimums.
                  </div>
                </div>

                {/* 2. SIMULATE NIGHT HOURS TOGGLE */}
                <div className="fuel-pricing-simulator-box card-glow p-4 bg-indigo-950/20 border border-indigo-500/20 rounded-xl w-[260px] flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-bold text-indigo-400 flex items-center gap-1.5"><Moon size={16} /> Night Hour Shift</h4>
                      <span className="text-[9px] font-mono bg-indigo-950 text-indigo-300 font-bold px-1.5 py-0.5 rounded">1.2x SURGE</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">
                      Simulate legal night surcharge shift (10:00 PM to 6:00 AM) which applies a compliant 20% multiplier.
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-3 bg-black/40 p-2 rounded">
                    <span className="text-xs font-semibold text-gray-300">Simulate Night Hours:</span>
                    <button 
                      className="btn-status-toggle"
                      onClick={() => {
                        setIsNightMode(!isNightMode);
                      }}
                    >
                      {isNightMode ? <ToggleRight size={32} color="#00ff66" /> : <ToggleLeft size={32} color="#666" />}
                    </button>
                  </div>
                </div>

              </div>

              {/* THREE CATEGORY PRICING CONFIGURATION SETTINGS */}
              <form className="pricing-settings-form card-glow" onSubmit={handleSaveSettings}>
                
                <div className="pricing-grid-settings">
                  {/* Category: Car AC */}
                  <div className="settings-card-group">
                    <h4>🚖 4-Wheeler AC Car Fares</h4>
                    
                    <div className="form-input-stacked mt-3">
                      <label>Base Fee (₹)</label>
                      <input 
                        type="number" 
                        value={baseFareCarAC}
                        onChange={(e) => setBaseFareCarAC(e.target.value)}
                        min={10} 
                        required 
                      />
                    </div>

                    <div className="form-input-stacked mt-3">
                      <label>Per Kilometer (₹/km)</label>
                      <input 
                        type="number" 
                        value={perKmCarAC}
                        onChange={(e) => setPerKmCarAC(e.target.value)}
                        min={5} 
                        required 
                      />
                    </div>
                  </div>

                  {/* Category: Car Non-AC */}
                  <div className="settings-card-group" style={{ borderColor: 'rgba(255,170,0,0.15)' }}>
                    <h4>🚖 4-Wheeler Non-AC Car Fares</h4>
                    
                    <div className="form-input-stacked mt-3">
                      <label>Base Fee (₹)</label>
                      <input 
                        type="number" 
                        value={baseFareCarNonAC}
                        onChange={(e) => setBaseFareCarNonAC(e.target.value)}
                        min={10} 
                        required 
                      />
                    </div>

                    <div className="form-input-stacked mt-3">
                      <label>Per Kilometer (₹/km)</label>
                      <input 
                        type="number" 
                        value={perKmCarNonAC}
                        onChange={(e) => setPerKmCarNonAC(e.target.value)}
                        min={5} 
                        required 
                      />
                    </div>
                  </div>

                  {/* Category: Bike Fares */}
                  <div className="settings-card-group">
                    <h4>🏍️ App Bike Fares</h4>
                    
                    <div className="form-input-stacked mt-3">
                      <label>Base Fee (₹)</label>
                      <input 
                        type="number" 
                        value={baseFareBike}
                        onChange={(e) => setBaseFareBike(e.target.value)}
                        min={5} 
                        required 
                      />
                    </div>

                    <div className="form-input-stacked mt-3">
                      <label>Per Kilometer (₹/km)</label>
                      <input 
                        type="number" 
                        value={perKmBike}
                        onChange={(e) => setPerKmBike(e.target.value)}
                        min={2} 
                        required 
                      />
                    </div>
                  </div>
                </div>

                {/* PEAK SURGE CONTROLLER HARD-CONSTRAINED TO 1.5X WEST BENGAL CEILING */}
                <div className="settings-card-group surge-settings-card mt-3">
                  <div className="flex justify-between items-center">
                    <h4>⚡ Peak Demand Surge Multiplier</h4>
                    <span className="text-[10px] bg-red-950/40 text-red-400 font-bold px-2 py-0.5 rounded border border-red-500/20">CAPPED AT 1.5X MAX</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Adjust peak surge values. Note: West Bengal's 2022 ODTTA notification hard-caps surge multipliers at <b>1.5x maximum</b> to protect passenger rights.
                  </p>

                  <div className="form-input-stacked mt-4">
                    <div className="slider-header-label">
                      <label>Surge Level Limit</label>
                      <span className="slider-value text-amber-500 font-bold">{surgeMultiplier}x</span>
                    </div>
                    <input 
                      type="range" 
                      min="1.0" 
                      max="1.5" 
                      step="0.05"
                      value={surgeMultiplier}
                      onChange={(e) => setSurgeMultiplier(parseFloat(e.target.value))}
                      className="surge-slider-range"
                    />
                  </div>
                </div>

                <div className="divider-h mt-4"></div>

                <button type="submit" className="btn-primary mt-4 font-semibold">
                  Update Pricing Configuration
                </button>
              </form>
            </div>
          )}

          {/* TAB 6: FINANCIAL REPORTING & COMPLIANCE LEDGERS */}
          {activeTab === 'finance' && (
            <div className="admin-tab-content" style={{ gap: '16px', maxHeight: '100%', overflowY: 'auto' }}>
              <div className="section-title-flex">
                <h3>Financial Reporting & Compliance Ledger</h3>
                <p className="text-gray-400 text-sm">Detailed overview of revenue, taxes, gateway fees, and regulatory setups.</p>
              </div>

              {/* Financial KPI Cards */}
              <div className="finance-kpis grid-dashboard">
                <div className="kpi-card card-glow">
                  <span className="kpi-label">Gross Ride Bookings</span>
                  <span className="kpi-value text-green-400">₹{financials.grossBookings.toFixed(0)}</span>
                  <span className="kpi-sub text-gray-400">Total ride volumes</span>
                </div>

                <div className="kpi-card card-glow">
                  <span className="kpi-label">Platform commission (5%)</span>
                  <span className="kpi-value text-amber-500">₹{financials.platformCommissionTotal.toFixed(0)}</span>
                  <span className="kpi-sub text-gray-400">Accrued platform share</span>
                </div>

                <div className="kpi-card card-glow">
                  <span className="kpi-label">GST Tax Liabilities (5%)</span>
                  <span className="kpi-value text-indigo-400">₹{financials.accumulatedGstTotal.toFixed(0)}</span>
                  <span className="kpi-sub text-gray-400">Remitted to government</span>
                </div>

                <div className="kpi-card card-glow">
                  <span className="kpi-label">Net Platform Profit</span>
                  <span className={`kpi-value ${financials.netPlatformProfits >= 0 ? 'text-indigo-300' : 'text-red-400'}`}>
                    ₹{financials.netPlatformProfits.toFixed(0)}
                  </span>
                  <span className="kpi-sub text-gray-400">After gateway & overheads</span>
                </div>
              </div>

              {/* PREMIUM INTERACTIVE SVG ANALYTICS CHARTS SECTION */}
              <div className="finance-charts-grid mt-2" style={{ display: 'grid', gridTemplateColumns: '320px 1fr 280px', gap: '16px' }}>
                
                {/* 1. Fare Splits Donut Chart */}
                <div className="ops-map-card card-glow p-4 flex flex-col justify-between" style={{ height: '240px' }}>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fare Splits Ratio (Passenger total)</h4>
                  
                  <div className="flex justify-center items-center relative my-2">
                    <svg width="140" height="140" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="#ffdd00" strokeWidth="12" strokeDasharray="227.4 251.2" strokeDashoffset="0" />
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="#ffaa00" strokeWidth="12" strokeDasharray="12 251.2" strokeDashoffset="-227.4" />
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="#818cf8" strokeWidth="12" strokeDasharray="12 251.2" strokeDashoffset="-239.4" />
                      
                      <circle cx="50" cy="50" r="28" fill="#11141a" />
                      <text x="50" y="47" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="bold" fontFamily="monospace">100%</text>
                      <text x="50" y="56" textAnchor="middle" fill="#a0aec0" fontSize="5" fontWeight="bold" fontFamily="sans-serif">COMPLIANT</text>
                    </svg>
                  </div>

                  <div className="chart-legend flex justify-between text-[9px] text-gray-400 font-mono">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ffdd00' }}></span> Driver (90.5%)</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ffaa00' }}></span> Plat (4.8%)</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#818cf8' }}></span> GST (4.8%)</span>
                  </div>
                </div>

                {/* 2. Weekly Booking Revenue Bar Chart */}
                <div className="ops-map-card card-glow p-4 flex flex-col justify-between relative" style={{ height: '240px' }}>
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Weekly Bookings Trend</h4>
                    <span className="text-[9px] text-gray-500 font-mono">Hover bars for details</span>
                  </div>

                  <div className="bar-chart-visual flex items-end justify-between px-2 pt-6" style={{ height: '140px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {WEEKLY_REVENUE_DATA.map((item, idx) => {
                      const percentageHeight = Math.max(10, (item.bookings / maxWeeklyBookingValue) * 100);
                      const isHovered = hoveredBarIndex === idx;

                      return (
                        <div 
                          key={idx} 
                          className="flex flex-col items-center flex-1 cursor-pointer"
                          onMouseEnter={() => setHoveredBarIndex(idx)}
                          onMouseLeave={() => setHoveredBarIndex(null)}
                          style={{ minWidth: '24px' }}
                        >
                          <div 
                            className="w-[18px] rounded-t-sm transition-all duration-300"
                            style={{ 
                              height: `${percentageHeight.toFixed(0)}px`,
                              background: isHovered 
                                ? 'linear-gradient(to top, #ff9c00, #ffdd00)' 
                                : 'linear-gradient(to top, rgba(255,221,0,0.3), rgba(255,221,0,0.85))',
                              boxShadow: isHovered ? '0 0 15px rgba(255,221,0,0.6)' : 'none',
                            }}
                          ></div>
                          <span className="text-[10px] text-gray-500 font-semibold mt-2">{item.day}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tooltip Overlay */}
                  {hoveredBarIndex !== null && (
                    <div 
                      className="absolute bg-[#181d26] border border-amber-500/30 p-2.5 rounded-lg text-[10px] font-mono text-gray-300 shadow-xl"
                      style={{ 
                        top: '40px', 
                        left: `${Math.min(180, hoveredBarIndex * 40 + 20)}px`,
                        zIndex: 10
                      }}
                    >
                      <div className="font-bold text-amber-400 border-b border-white/5 pb-1 mb-1">
                        📅 {WEEKLY_REVENUE_DATA[hoveredBarIndex].day} Statistics
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>Gross Bookings:</span>
                        <span className="text-white font-semibold">₹{WEEKLY_REVENUE_DATA[hoveredBarIndex].bookings.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between gap-4 mt-0.5">
                        <span>GST Liability (5%):</span>
                        <span className="text-indigo-400">₹{WEEKLY_REVENUE_DATA[hoveredBarIndex].gst.toFixed(0)}</span>
                      </div>
                      <div className="flex justify-between gap-4 mt-0.5 border-t border-white/5 pt-1 text-emerald-400 font-bold">
                        <span>Driver Net (95%):</span>
                        <span>₹{(WEEKLY_REVENUE_DATA[hoveredBarIndex].bookings * 0.95).toFixed(0)}</span>
                      </div>
                    </div>
                  )}

                  <div className="text-[9px] text-gray-500 font-mono text-center">
                    Sunday (Today) includes live simulation booking metrics.
                  </div>
                </div>

                {/* 3. Accrued Compliance Pool circular progress ring */}
                <div className="ops-map-card card-glow p-4 flex flex-col justify-between" style={{ height: '240px' }}>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Driver Safety Pool (Accruing)</h4>
                  
                  <div className="flex justify-center items-center relative my-2">
                    {(() => {
                      const target = 1000;
                      const percentage = Math.min(100, (insuranceReservePool / target) * 100);
                      const dashOffset = 251.2 - (251.2 * percentage) / 100;
                      
                      return (
                        <svg width="120" height="120" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                          <circle cx="50" cy="50" r="40" fill="transparent" stroke="#00ff66" strokeWidth="8" strokeDasharray="251.2" strokeDashoffset={dashOffset} strokeLinecap="round" />
                          
                          <circle cx="50" cy="50" r="30" fill="#11141a" />
                          <text x="50" y="47" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="monospace">₹{insuranceReservePool.toFixed(0)}</text>
                          <text x="50" y="58" textAnchor="middle" fill="#a0aec0" fontSize="5" fontWeight="bold" fontFamily="sans-serif">ACCRUED</text>
                        </svg>
                      );
                    })()}
                  </div>

                  <div className="text-[10px] text-gray-400 text-center font-mono leading-tight">
                    Premium balance accumulated from ₹2.00 per-ride driver term reserves.
                  </div>
                </div>

              </div>

              {/* REGULATORY COMPLIANCE OVERHEADS LEDGER */}
              <div className="payouts-section card-glow p-4 bg-indigo-950/5 border border-indigo-500/10">
                <div className="flex items-center gap-2 mb-3 text-indigo-300">
                  <Building size={16} />
                  <h4 className="text-sm font-bold uppercase tracking-wider">West Bengal Compliance Setup Costs</h4>
                </div>

                <div className="payout-table-grid">
                  <div className="payout-header" style={{ gridTemplateColumns: '240px 140px 140px 1fr' }}>
                    <span>Compliance Parameter</span>
                    <span>Mandated Amount</span>
                    <span>Monthly Amortized</span>
                    <span>Legal Description</span>
                  </div>

                  <div className="payout-row" style={{ gridTemplateColumns: '240px 140px 140px 1fr' }}>
                    <span className="font-semibold text-white">Aggregator ODTTA License Fee</span>
                    <span className="font-semibold text-red-400">₹5,00,000</span>
                    <span className="text-gray-400">₹8,333 / mo</span>
                    <span className="text-xs text-gray-500">WB Transport Dept. Aggregator License (5-Year validity)</span>
                  </div>

                  <div className="payout-row" style={{ gridTemplateColumns: '240px 140px 140px 1fr' }}>
                    <span className="font-semibold text-white">24/7 IT Control Room staff</span>
                    <span className="font-semibold text-red-400">₹60,000 / mo</span>
                    <span className="text-gray-400">₹60,000 / mo</span>
                    <span className="text-xs text-gray-500">IT-educated support staff for SOS emergency monitoring</span>
                  </div>

                  <div className="payout-row" style={{ gridTemplateColumns: '240px 140px 140px 1fr' }}>
                    <span className="font-semibold text-emerald-400">Driver Health & Term Insurance</span>
                    <span className="font-semibold text-emerald-400">₹{insuranceReservePool.toFixed(2)}</span>
                    <span className="text-gray-400">Accruing (₹2/ride)</span>
                    <span className="text-xs text-emerald-500 font-semibold">Mandatory gig worker micro-premium pool (₹5L health, ₹10L term)</span>
                  </div>
                </div>
              </div>

              {/* GIG WORKER SAFETY CLAIMS REVIEW BOARD */}
              <div className="payouts-section card-glow mt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-400">🛡️ Gig Worker Safety Pool Claims Review Board</h4>
                  <div className="text-xs text-gray-400 font-mono">
                    Reserve Pool Balance: <span className="text-emerald-400 font-bold">₹{insuranceReservePool.toFixed(2)}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Review outpatient health checkup cover or term micro-premium claims submitted by partner drivers.</p>
                
                <div className="payout-table-grid mt-3">
                  <div className="payout-header" style={{ gridTemplateColumns: '120px 140px 100px 100px 1fr 180px' }}>
                    <span>Claim ID / Date</span>
                    <span>Driver Partner</span>
                    <span>Cover Type</span>
                    <span>Requested</span>
                    <span>Claim Description / Bill reason</span>
                    <span>Review Action</span>
                  </div>

                  {safetyClaims.length === 0 ? (
                    <div className="text-center py-4 text-xs text-gray-500 italic">No safety claims submitted for review.</div>
                  ) : (
                    safetyClaims.map(claim => (
                      <div key={claim.id} className="payout-row" style={{ gridTemplateColumns: '120px 140px 100px 100px 1fr 180px', padding: '12px 14px' }}>
                        <div className="flex flex-col text-left">
                          <span className="font-mono text-[10px] text-gray-400 font-bold">{claim.id}</span>
                          <span className="text-[9px] text-gray-600 mt-0.5">{claim.createdAt}</span>
                        </div>
                        <span className="font-semibold text-xs text-white text-left">{claim.driverName}</span>
                        <span className="font-mono text-xs uppercase text-indigo-400 font-semibold text-left">{claim.claimType}</span>
                        <span className="font-bold text-xs text-emerald-400 text-left">₹{claim.amount}</span>
                        <span className="text-xs text-gray-400 leading-tight text-left">{claim.description}</span>
                        
                        <div className="text-left">
                          {claim.status === 'pending' ? (
                            <div className="flex gap-2">
                              <button 
                                className="btn-pay-rzp py-1 px-3 text-[10px] bg-green-700 hover:bg-green-800"
                                style={{ width: 'auto' }}
                                onClick={() => resolveSafetyClaim(claim.id, 'approved')}
                              >
                                Approve
                              </button>
                              <button 
                                className="btn-pay-rzp py-1 px-3 text-[10px] bg-red-700 hover:bg-red-800"
                                style={{ width: 'auto' }}
                                onClick={() => resolveSafetyClaim(claim.id, 'rejected')}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded ${
                              claim.status === 'approved' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                            }`}>
                              {claim.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Driver Payout Breakdown Ledger */}
              <div className="payouts-section card-glow">
                <h4>Driver Payout Breakdown Ledger (95% Base splits)</h4>
                
                <div className="payout-table-grid mt-3">
                  <div className="payout-header">
                    <span>Partner Name</span>
                    <span>License</span>
                    <span>Total Bookings</span>
                    <span>Platform commission (5%)</span>
                    <span>Net Paid Payout (95%)</span>
                  </div>

                  {drivers.map(d => {
                    const gross = d.earnings.weekly + d.earnings.commission;
                    return (
                      <div key={d.id} className="payout-row">
                        <span className="font-semibold">{d.name}</span>
                        <span className="font-mono text-xs">{d.documents?.license || 'Not Onboarded'}</span>
                        <span>₹{gross.toFixed(0)}</span>
                        <span className="text-red-400">₹{d.earnings.commission.toFixed(0)}</span>
                        <span className="text-green-400 font-semibold">₹{d.earnings.weekly.toFixed(0)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

        </main>
      </div>
    </div>
  );
}
