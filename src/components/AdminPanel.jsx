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
  ToggleRight,
  Key,
  BarChart2
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
    adminStats,
    isNightMode,
    setIsNightMode,
    verifyDriverStatus,
    payoutDriver,
    broadcastNotification,
    updateSettings,
    updateGeofence,
    geofencingZones,
    updateGeofencingZones,
    fraudAlerts,
    resolveFraudAlert,
    surgeSchedules,
    activeScheduledSurge,
    updateSurgeSchedules,
    demandHotspots,
    resolveSOS,
    resolveDispute,
    fastForwardDisputeSla,
    congestionZones,
    toggleCongestionZone,
    safetyClaims,
    resolveSafetyClaim,
    connectAdminSocket,
    fetchEnvKeys,
    updateEnvKeys
  } = useSimulator();

  useEffect(() => {
    connectAdminSocket();
  }, []);

  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [showDemandHeatmap, setShowDemandHeatmap] = useState(false);
  const [selectedDriverForDoc, setSelectedDriverForDoc] = useState(null);
  const [selectedDocTab, setSelectedDocTab] = useState('license');
  const [dlChecked, setDlChecked] = useState(false);
  const [aadharChecked, setAadharChecked] = useState(false);
  const [rcChecked, setRcChecked] = useState(false);

  // Form states for settings
  const [baseFareCarAC, setBaseFareCarAC] = useState(settings.baseFareCarAC || 50);
  const [perKmCarAC, setPerKmCarAC] = useState(settings.perKmCarAC || 20);
  const [baseFareCarNonAC, setBaseFareCarNonAC] = useState(settings.baseFareCarNonAC || 30);
  const [perKmCarNonAC, setPerKmCarNonAC] = useState(settings.perKmCarNonAC || 15);
  const [baseFareBike, setBaseFareBike] = useState(settings.baseFareBike || 20);
  const [perKmBike, setPerKmBike] = useState(settings.perKmBike || 7);
  const [surgeMultiplier, setSurgeMultiplier] = useState(settings.surgeMultiplier || 1.0);
  const [weather, setWeather] = useState(settings.weather || 'clear');
  const [localFuelPrices, setLocalFuelPrices] = useState(fuelPrices);

  // Chart interactivity states
  const [hoveredBarIndex, setHoveredBarIndex] = useState(null);
  const [hoveredHourIndex, setHoveredHourIndex] = useState(null);
  const [hoveredCategory, setHoveredCategory] = useState(null);

  // Mock playing evidence states
  const [playingMediaId, setPlayingMediaId] = useState(null);

  // Broadcast simulator form states
  const [broadcastTarget, setBroadcastTarget] = useState('all');
  const [broadcastMsgInput, setBroadcastMsgInput] = useState('');
  const [broadcastStatus, setBroadcastStatus] = useState('');

  // Map elements
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({
    drivers: {},
    activeRide: null,
    geofencePolygon: null,
    sosElements: [], 
    trafficCircles: [], // Keep track of traffic overlays
    demandCircles: [], // Keep track of heatmap circles
  });

  // Geofence map elements
  const geofenceMapContainerRef = useRef(null);
  const geofenceMapRef = useRef(null);
  const geofencePolygonsRef = useRef({});

  // Sync settings inputs with global settings changes
  useEffect(() => {
    setBaseFareCarAC(settings.baseFareCarAC || 50);
    setPerKmCarAC(settings.perKmCarAC || 20);
    setBaseFareCarNonAC(settings.baseFareCarNonAC || 30);
    setPerKmCarNonAC(settings.perKmCarNonAC || 15);
    setBaseFareBike(settings.baseFareBike || 20);
    setPerKmBike(settings.perKmBike || 7);
    setSurgeMultiplier(settings.surgeMultiplier || 1.0);
    setWeather(settings.weather || 'clear');
  }, [settings]);

  useEffect(() => {
    setLocalFuelPrices(fuelPrices);
  }, [fuelPrices]);

  // Reset compliance checklist for new documents review session
  useEffect(() => {
    setDlChecked(false);
    setAadharChecked(false);
    setRcChecked(false);
    setSelectedDocTab('license');
  }, [selectedDriverForDoc]);

  // Leaflet Map Initialization
  useEffect(() => {
    if (activeTab !== 'dashboard' || !mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([22.5726, 88.3639], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);

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

  // Geofence Map Initialization & Redraw Hook
  useEffect(() => {
    if (activeTab !== 'geofence' || !geofenceMapContainerRef.current) return;

    // 1. Initialize Map instance
    const map = L.map(geofenceMapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([22.5726, 88.3639], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
    geofenceMapRef.current = map;

    // 2. Draw standard geofence boundary (green dash polygon)
    const geofenceCoords = geofence.map(c => [c.lat, c.lng]);
    L.polygon(geofenceCoords, {
      color: '#22c55e',
      weight: 1.5,
      fillColor: '#22c55e',
      fillOpacity: 0.02,
      dashArray: '5, 5'
    }).addTo(map).bindPopup("<b>Standard Operational boundary</b>");

    // 3. Draw active/inactive geofencing zones
    const zonePolygons = {};
    geofencingZones.forEach(zone => {
      const color = zone.type === 'ban' ? '#ef4444' : '#f59e0b';
      const fillOpacity = zone.active ? (zone.type === 'ban' ? 0.20 : 0.12) : 0.02;
      const weight = zone.active ? 2.0 : 1.0;
      const dashArray = zone.active ? '' : '3, 6';

      const poly = L.polygon(zone.points, {
        color: color,
        weight: weight,
        fillColor: color,
        fillOpacity: fillOpacity,
        dashArray: dashArray
      }).addTo(map);

      // Tooltip label
      const label = `
        <div style="font-family:sans-serif;font-size:11px;color:#fff;">
          <b style="font-size:12px;color:${color}">${zone.name}</b><br/>
          Type: <b>${zone.type.toUpperCase()}</b><br/>
          Status: <b style="color:${zone.active ? '#22c55e' : '#9ca3af'}">${zone.active ? 'ACTIVE' : 'INACTIVE'}</b><br/>
          ${zone.type === 'surge' ? `Surge Rate: <b>${zone.multiplier}x</b>` : 'Ride dispatch suspended'}
        </div>
      `;
      poly.bindPopup(label);
      zonePolygons[zone.id] = poly;
    });
    geofencePolygonsRef.current = zonePolygons;

    // Cleanup on unmount or tab change
    return () => {
      if (geofenceMapRef.current) {
        geofenceMapRef.current.remove();
        geofenceMapRef.current = null;
      }
    };
  }, [activeTab, geofencingZones, geofence]);

  // Update Map Markers (including dynamic SOS police dispatches and congestion zones)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || activeTab !== 'dashboard') return;

    // Clear old driver and ride markers
    Object.values(markersRef.current.drivers).forEach(m => map.removeLayer(m));
    markersRef.current.drivers = {};

    // Clear old demand circles
    if (markersRef.current.demandCircles) {
      markersRef.current.demandCircles.forEach(c => map.removeLayer(c));
    }
    markersRef.current.demandCircles = [];

    if (markersRef.current.traveledPolyline) {
      map.removeLayer(markersRef.current.traveledPolyline);
      markersRef.current.traveledPolyline = null;
    }
    if (markersRef.current.remainingPolyline) {
      map.removeLayer(markersRef.current.remainingPolyline);
      markersRef.current.remainingPolyline = null;
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

    // Render active ride route lines (split trail: traveled green vs remaining yellow)
    if (activeRide && activeRide.route && activeRide.status !== 'searching') {
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
          const pIdx = alert.policeRouteIndex || 0;
          const traveledCoords = alert.policeRoute.slice(0, pIdx + 1).map(pt => [pt.lat, pt.lng]);
          const remainingCoords = alert.policeRoute.slice(pIdx).map(pt => [pt.lat, pt.lng]);

          if (traveledCoords.length > 1) {
            const policeTraveledLine = L.polyline(traveledCoords, {
              color: '#1e40af',
              weight: 4,
              opacity: 0.8
            }).addTo(map);
            markersRef.current.sosElements.push(policeTraveledLine);
          }

          if (remainingCoords.length > 0) {
            const policeRemainingLine = L.polyline(remainingCoords, {
              color: '#3b82f6',
              weight: 4,
              opacity: 0.9,
              className: 'animated-police-path'
            }).addTo(map);
            markersRef.current.sosElements.push(policeRemainingLine);
          }
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

    // Render demand heatmap circles
    if (showDemandHeatmap && demandHotspots) {
      demandHotspots.forEach(pt => {
        const circle = L.circle([pt.lat, pt.lng], {
          stroke: false,
          fillColor: '#ef4444',
          fillOpacity: 0.18 * pt.weight,
          radius: 500 * pt.weight
        }).addTo(map);
        markersRef.current.demandCircles.push(circle);
      });
    }

  }, [drivers, activeRide, sosAlerts, activeTab, congestionZones, showDemandHeatmap, demandHotspots]);

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
      surgeMultiplier: parseFloat(surgeMultiplier)
    });
    alert("Pricing configuration updated successfully!");
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
    const grossBookings = adminStats.grossBookings || 0;
    const platformCommissionTotal = adminStats.totalCommission || 0;
    const accumulatedGstTotal = adminStats.accumulatedGstTotal || 0;
    const driverPayouts = adminStats.driverPayouts || 0;

    const gatewayFees = grossBookings * 1.05 * 0.02; 
    const odttaLicenseMonthlyAmortized = 8333; 
    const controlRoomStaffCostMonthly = 60000; 

    const netPlatformProfits = platformCommissionTotal - gatewayFees - (odttaLicenseMonthlyAmortized + controlRoomStaffCostMonthly);

    return {
      grossBookings,
      platformCommissionTotal,
      accumulatedGstTotal,
      gatewayFees: parseFloat(gatewayFees.toFixed(2)),
      driverPayouts,
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

  const HOURLY_LOAD_DATA = [
    { time: '08:00', load: 35, revenue: 2450 },
    { time: '10:00', load: 85, revenue: 5950 },
    { time: '12:00', load: 60, revenue: 4200 },
    { time: '14:00', load: 45, revenue: 3150 },
    { time: '16:00', load: 70, revenue: 4900 },
    { time: '18:00', load: 95, revenue: 8650 },
    { time: '20:00', load: 80, revenue: 5600 },
    { time: '22:00', load: 40, revenue: 2800 }
  ];

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
              className={`nav-item ${activeTab === 'fraud' ? 'active' : ''}`}
              onClick={() => setActiveTab('fraud')}
            >
              <AlertTriangle size={18} className="text-amber-500" />
              <span>Security & Fraud</span>
              {fraudAlerts.filter(a => a.status === 'pending').length > 0 && (
                <span className="pending-badge bg-amber-600 text-white">
                  {fraudAlerts.filter(a => a.status === 'pending').length}
                </span>
              )}
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

            <button 
              className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              <BarChart2 size={18} />
              <span>Operations Analytics</span>
            </button>

            <button 
              className={`nav-item ${activeTab === 'env' ? 'active' : ''}`}
              onClick={() => setActiveTab('env')}
            >
              <Key size={18} />
              <span>API Credentials</span>
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
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setShowDemandHeatmap(!showDemandHeatmap)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          showDemandHeatmap 
                            ? 'bg-red-600/20 text-red-400 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.1)]' 
                            : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        🔥 Demand Heatmap: {showDemandHeatmap ? 'ON' : 'OFF'}
                      </button>
                      <div className="map-legend">
                        <span className="leg-item"><span className="dot green"></span> Free</span>
                        <span className="leg-item"><span className="dot orange"></span> In Ride</span>
                        <span className="leg-item"><span className="dot red"></span> SOS</span>
                        <span className="leg-item"><span className="dot blue"></span> 🚔 Patrol</span>
                      </div>
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

              {/* Emergency Broadcast Control Widget */}
              <div className="card-glow mt-4 p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2 text-red-400 font-bold uppercase tracking-wider text-sm">
                  <span>📢</span> Emergency Broadcast & Notification Center
                </div>
                
                <p className="text-xs text-gray-400">
                  Broadcast system-wide notification alerts, road hazard closures, or weather advisories to all active Passenger and Driver simulator interfaces.
                </p>

                <div className="flex flex-col md:flex-row gap-3 items-end">
                  <div className="flex flex-col gap-1 w-full md:w-[180px]">
                    <label className="text-[10px] text-gray-500 font-bold uppercase">Target Recipients</label>
                    <select 
                      value={broadcastTarget} 
                      onChange={(e) => setBroadcastTarget(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none w-full"
                    >
                      <option value="all">All Devices (all)</option>
                      <option value="passenger">Passengers Only</option>
                      <option value="driver">Drivers Only</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1 flex-1 w-full">
                    <label className="text-[10px] text-gray-500 font-bold uppercase">Alert Message Text</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 🌧️ Monsoon alert: Heavy waterlogging expected in Kolkata. Travel safely."
                      value={broadcastMsgInput}
                      onChange={(e) => setBroadcastMsgInput(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none w-full animate-none"
                    />
                  </div>

                  <button 
                    onClick={async () => {
                      if (!broadcastMsgInput.trim()) {
                        alert("Please specify notification message text!");
                        return;
                      }
                      setBroadcastStatus('Sending...');
                      await broadcastNotification(broadcastTarget, broadcastMsgInput.trim());
                      setBroadcastMsgInput('');
                      setBroadcastStatus('Broadcast successfully deployed!');
                      setTimeout(() => setBroadcastStatus(''), 4000);
                    }}
                    className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-1.5 rounded text-xs uppercase tracking-wide transition-all h-[32px] w-full md:w-auto"
                  >
                    Send Alert
                  </button>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <span className="text-[10px] text-gray-500 flex items-center">Preset Quick Alerts:</span>
                  {[
                    '🌧️ Heavy rains & flooding reported in Salt Lake. Travel carefully.',
                    '🚧 Howrah Bridge closed temporarily due to congestion checks.',
                    '⚡ Night Surcharge active: Fares scale to 1.2x base rate.'
                  ].map((preset, i) => (
                    <button 
                      key={i}
                      type="button"
                      onClick={() => setBroadcastMsgInput(preset)}
                      className="text-[9px] bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 px-2 py-0.5 rounded transition-all"
                    >
                      Preset {i+1}
                    </button>
                  ))}
                </div>

                {broadcastStatus && (
                  <span className="text-[10px] text-green-400 animate-pulse font-semibold mt-1">
                    {broadcastStatus}
                  </span>
                )}
              </div>

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

                    <div className="modal-body-content mt-3 text-left">
                      <p className="text-gray-400 text-xs mb-3">
                        Applicant Name: <span className="text-white font-semibold">{selectedDriverForDoc.name}</span>
                      </p>

                      {/* Mock Scans Tabs */}
                      <div className="flex gap-1 mb-3 border-b border-white/10 pb-1 text-[11px]">
                        <button 
                          className={`px-3 py-1 font-bold rounded-t-lg transition-all ${
                            selectedDocTab === 'license' 
                              ? 'bg-blue-600/20 text-blue-400 border-b-2 border-blue-500' 
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                          onClick={() => setSelectedDocTab('license')}
                        >
                          🪪 Driving License
                        </button>
                        <button 
                          className={`px-3 py-1 font-bold rounded-t-lg transition-all ${
                            selectedDocTab === 'aadhar' 
                              ? 'bg-emerald-600/20 text-emerald-400 border-b-2 border-emerald-500' 
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                          onClick={() => setSelectedDocTab('aadhar')}
                        >
                          🇮🇳 Aadhar Card
                        </button>
                        <button 
                          className={`px-3 py-1 font-bold rounded-t-lg transition-all ${
                            selectedDocTab === 'rc' 
                              ? 'bg-fuchsia-600/20 text-fuchsia-400 border-b-2 border-fuchsia-500' 
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                          onClick={() => setSelectedDocTab('rc')}
                        >
                          📄 Vehicle RC
                        </button>
                      </div>

                      {/* Mock Scan Display Box */}
                      <div className="flex justify-center mb-4 p-2 bg-black/40 rounded-xl border border-white/5">
                        {selectedDocTab === 'license' && (
                          <div className="w-full max-w-[320px] p-4 rounded-xl relative overflow-hidden" style={{
                            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                            border: '1.5px solid #3b82f6',
                            color: '#fff',
                            aspectRatio: '1.586',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.4)'
                          }}>
                            <div className="flex justify-between items-start">
                              <div className="text-left">
                                <span className="text-[7px] uppercase tracking-wider text-blue-400 block font-bold">UNION OF INDIA</span>
                                <span className="text-[10px] font-bold text-white block">DRIVING LICENSE</span>
                              </div>
                              <span className="text-[7px] bg-blue-500/20 text-blue-300 font-bold px-1.5 py-0.5 rounded border border-blue-500/30">WEST BENGAL</span>
                            </div>

                            <div className="flex gap-3 my-2 items-center">
                              <div className="w-10 h-12 bg-gray-800 rounded border border-gray-700 flex items-center justify-center text-xl flex-shrink-0">
                                {selectedDriverForDoc.avatar || '👤'}
                              </div>
                              <div className="flex-1 text-left">
                                <span className="text-[7px] text-gray-400 block">Name / नाम:</span>
                                <span className="text-[9px] font-bold block">{selectedDriverForDoc.name}</span>
                                <span className="text-[7px] text-gray-400 block mt-1">License No:</span>
                                <span className="text-[9px] font-mono font-bold block text-blue-400">{selectedDriverForDoc.documents?.license || 'N/A'}</span>
                              </div>
                            </div>

                            <div className="flex justify-between items-center text-[7px] text-gray-400 border-t border-gray-800 pt-1">
                              <span>Class: LMV, MCWG</span>
                              <span>Auth: WB RTO KOLKATA</span>
                            </div>
                          </div>
                        )}

                        {selectedDocTab === 'aadhar' && (
                          <div className="w-full max-w-[320px] p-4 rounded-xl relative overflow-hidden" style={{
                            background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                            border: '1.5px solid #22c55e',
                            color: '#0f172a',
                            aspectRatio: '1.586',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.4)'
                          }}>
                            <div className="flex justify-between items-center border-b border-gray-200 pb-1">
                              <span className="text-[7px] font-bold text-red-600">भारत सरकार / Govt of India</span>
                              <span className="text-[7px] font-bold text-emerald-600">AADHAR CARD</span>
                            </div>

                            <div className="flex gap-3 my-2 items-center">
                              <div className="w-10 h-12 bg-gray-200 rounded border border-gray-300 flex items-center justify-center text-xl flex-shrink-0">
                                {selectedDriverForDoc.avatar || '👤'}
                              </div>
                              <div className="flex-1 text-left">
                                <span className="text-[7px] text-gray-500 block">Name:</span>
                                <span className="text-[9px] font-bold block text-gray-900">{selectedDriverForDoc.name}</span>
                                <span className="text-[7px] text-gray-500 block mt-1">Aadhar Number:</span>
                                <span className="text-[11px] font-mono font-bold block text-gray-900 tracking-wider text-left">
                                  {selectedDriverForDoc.documents?.aadhar || 'N/A'}
                                </span>
                              </div>
                            </div>

                            <div className="flex justify-between items-center text-[7px] text-gray-500 border-t border-gray-200 pt-1">
                              <span>mera aadhar, meri pehchan</span>
                              <span className="font-bold text-red-600 font-mono">UIDAI</span>
                            </div>
                          </div>
                        )}

                        {selectedDocTab === 'rc' && (
                          <div className="w-full max-w-[320px] p-4 rounded-xl relative overflow-hidden" style={{
                            background: 'linear-gradient(135deg, #1e1b4b, #311042)',
                            border: '1.5px solid #d946ef',
                            color: '#fff',
                            aspectRatio: '1.586',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.4)'
                          }}>
                            <div className="flex justify-between items-start">
                              <div className="text-left">
                                <span className="text-[7px] uppercase tracking-wider text-fuchsia-400 block font-bold">STATE OF WEST BENGAL</span>
                                <span className="text-[10px] font-bold text-white block">REGISTRATION CERTIFICATE</span>
                              </div>
                              <span className="text-[7px] bg-fuchsia-500/20 text-fuchsia-300 font-bold px-1.5 py-0.5 rounded border border-fuchsia-500/30">FORM 23</span>
                            </div>

                            <div className="my-2 text-left">
                              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                <div>
                                  <span className="text-[6px] text-gray-400 block">Reg. Number:</span>
                                  <span className="text-[8px] font-mono font-bold text-fuchsia-300">{selectedDriverForDoc.documents?.rc || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-[6px] text-gray-400 block">Owner:</span>
                                  <span className="text-[8px] font-bold text-white">{selectedDriverForDoc.name}</span>
                                </div>
                                <div>
                                  <span className="text-[6px] text-gray-400 block">Vehicle Class:</span>
                                  <span className="text-[8px] font-bold text-white capitalize">{selectedDriverForDoc.vehicleType}</span>
                                </div>
                                <div>
                                  <span className="text-[6px] text-gray-400 block">Maker/Model:</span>
                                  <span className="text-[8px] font-bold text-white">{selectedDriverForDoc.vehicleName}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-between items-center text-[7px] text-gray-400 border-t border-gray-800 pt-1">
                              <span>Issued: RTO WEST BENGAL</span>
                              <span>Fuel: PETROL/CNG</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Compliance Checklist */}
                      <div className="kyc-checklist bg-black/30 border border-white/5 rounded-lg p-3">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-2">Legal Compliance Checklist</span>
                        
                        <div className="flex flex-col gap-2">
                          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={dlChecked} 
                              onChange={(e) => setDlChecked(e.target.checked)} 
                              className="w-3.5 h-3.5 accent-amber-500"
                            />
                            <span>Driving License matches West Bengal transport directives.</span>
                          </label>

                          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={aadharChecked} 
                              onChange={(e) => setAadharChecked(e.target.checked)} 
                              className="w-3.5 h-3.5 accent-amber-500"
                            />
                            <span>Aadhar No. matches national biometric records (UIDAI).</span>
                          </label>

                          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={rcChecked} 
                              onChange={(e) => setRcChecked(e.target.checked)} 
                              className="w-3.5 h-3.5 accent-amber-500"
                            />
                            <span>Vehicle Registration (RC) matches active insurance pool.</span>
                          </label>
                        </div>
                      </div>

                      <div className="kyc-disclaimer mt-3 p-2 bg-amber-500/10 border border-amber-500/20 text-[10px] rounded text-amber-300">
                        🛡️ Approve partner only if all cards match West Bengal aggregators guidelines.
                      </div>
                    </div>

                    <div className="modal-footer-actions mt-4 flex gap-2">
                      <button 
                        className="btn-modal-reject flex-1 py-2 bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 text-red-400 font-semibold rounded-lg text-xs transition-all"
                        onClick={() => {
                          verifyDriverStatus(selectedDriverForDoc.id, false);
                          setSelectedDriverForDoc(null);
                        }}
                      >
                        Reject Documents
                      </button>
                      <button 
                        className={`flex-1 py-2 font-semibold rounded-lg text-xs transition-all border ${
                          (dlChecked && aadharChecked && rcChecked)
                            ? 'bg-amber-500 border-amber-600 text-black hover:bg-amber-400 cursor-pointer'
                            : 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'
                        }`}
                        onClick={() => {
                          if (dlChecked && aadharChecked && rcChecked) {
                            verifyDriverStatus(selectedDriverForDoc.id, true);
                            setSelectedDriverForDoc(null);
                          }
                        }}
                        disabled={!(dlChecked && aadharChecked && rcChecked)}
                        title={!(dlChecked && aadharChecked && rcChecked) ? "Please check all compliance ticks first" : "Authorize Driver Account"}
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

          {/* TAB: SECURITY & FRAUD DETECTION */}
          {activeTab === 'fraud' && (
            <div className="admin-tab-content flex flex-col gap-4">
              <div className="section-title-flex">
                <div>
                  <h3 className="text-lg font-bold text-white">Security & Anti-Collusion Dashboard</h3>
                  <p className="text-gray-400 text-xs mt-0.5">Automated detection checks to flag promo farming, self-booking, and driver-passenger coordinate collusion.</p>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card-glow p-4 bg-red-950/10 border border-red-500/20 rounded-xl">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold">Total Flagged Violations</span>
                  <h4 className="text-2xl font-bold text-red-500 mt-1">{fraudAlerts.length} Alerts</h4>
                  <span className="text-[10px] text-gray-500">Real-time alerts processed via OSRM & GPS containment</span>
                </div>
                <div className="card-glow p-4 bg-amber-950/10 border border-amber-500/20 rounded-xl">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold">Pending Action</span>
                  <h4 className="text-2xl font-bold text-amber-500 mt-1">{fraudAlerts.filter(a => a.status === 'pending').length} Unresolved</h4>
                  <span className="text-[10px] text-gray-500">Awaiting operational audit / account freeze</span>
                </div>
                <div className="card-glow p-4 bg-emerald-950/10 border border-emerald-500/20 rounded-xl">
                  <span className="text-[10px] text-gray-400 uppercase font-semibold">Suspended Partner Accounts</span>
                  <h4 className="text-2xl font-bold text-emerald-400 mt-1">
                    {drivers.filter(d => d.verificationStatus === 'suspended').length} Suspensions
                  </h4>
                  <span className="text-[10px] text-gray-500">Drivers blocked from accepting passenger offers</span>
                </div>
              </div>

              {/* Alerts List */}
              <div className="card-glow p-4">
                <h4 className="text-sm font-bold text-gray-200 mb-3">Security Log Audits</h4>
                {fraudAlerts.length === 0 ? (
                  <div className="text-center py-10">
                    <Shield size={32} className="text-emerald-500 mx-auto" />
                    <h5 className="font-semibold text-gray-300 mt-2 text-xs">All Passenger & Partner Activity Clean</h5>
                    <p className="text-[10px] text-gray-500 mt-0.5">Automated collision scanners report zero anomalies in matching coordinates.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {fraudAlerts.map(alert => {
                      const isPending = alert.status === 'pending';
                      const isHigh = alert.severity === 'high';
                      
                      let typeLabel = "Anomalous Activity";
                      let desc = "";
                      if (alert.alert_type === 'co_location') {
                        typeLabel = "Co-location Collusion Flag";
                        desc = "Driver and Passenger coordinates matched within <50m radius during ride offer booking (suspected promo/cashout farming).";
                      } else if (alert.alert_type === 'frequency_abuse') {
                        typeLabel = "High-Frequency Matching Abuse";
                        desc = "Same driver and passenger pair matched 2+ times in less than an hour (suspected repetitive booking collusion).";
                      }

                      return (
                        <div key={alert.id} className="border border-white/5 bg-white/5 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all hover:bg-white/[0.07]">
                          <div className="flex flex-col gap-1 max-w-xl">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider ${
                                isHigh ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}>
                                {alert.severity} severity
                              </span>
                              <span className="text-xs font-bold text-white">{typeLabel}</span>
                              <span className="text-[10px] text-gray-500 font-mono">({alert.id})</span>
                            </div>

                            <p className="text-[11px] text-gray-400 mt-1">{desc}</p>

                            <div className="flex items-center gap-4 text-[10px] text-gray-500 mt-1 font-mono">
                              <span>Passenger: <b>{alert.passenger_phone}</b></span>
                              <span>Driver ID: <b>{alert.driver_id}</b></span>
                              <span>Time: <b>{new Date(alert.created_at).toLocaleString()}</b></span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isPending ? (
                              <>
                                <button 
                                  onClick={() => resolveFraudAlert(alert.id, 'suspend')}
                                  className="btn-danger text-[10px] font-semibold px-2.5 py-1"
                                >
                                  ⛔ Freeze Account
                                </button>
                                <button 
                                  onClick={() => resolveFraudAlert(alert.id, 'dismiss')}
                                  className="btn-secondary text-[10px] font-semibold px-2.5 py-1"
                                >
                                  Dismiss
                                </button>
                              </>
                            ) : (
                              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                alert.status === 'resolved_suspended' 
                                  ? 'bg-red-950/20 text-red-400 border border-red-500/10' 
                                  : 'bg-white/5 text-gray-400 border border-white/5'
                              }`}>
                                {alert.status.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: GEOFENCING ZONES */}
          {activeTab === 'geofence' && (
            <div className="admin-tab-content flex flex-col gap-4">
              <div className="section-title-flex">
                <div>
                  <h3 className="text-lg font-bold text-white">Geofencing & Dynamic Surge Zones Manager</h3>
                  <p className="text-gray-400 text-xs mt-0.5">Control active operational territories, dynamic pricing zones, and restricted flight security blockades in real-time.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch min-h-[480px]">
                {/* Geofence Zones Controls Column (Left) */}
                <div className="lg:col-span-5 flex flex-col gap-4 flex-1">
                  <div className="card-glow p-4 flex flex-col gap-3">
                    <h4 className="text-sm font-bold text-gray-200">Active Geofencing Polygons</h4>
                    <p className="text-[11px] text-gray-500">Toggle zones to alter ride dispatch pricing or temporarily suspend bookings in specific sectors.</p>
                    
                    <div className="flex flex-col gap-3 mt-1">
                      {geofencingZones.map((zone) => {
                        const isBan = zone.type === 'ban';
                        const themeColor = isBan ? 'border-red-500/20 bg-red-950/10' : 'border-amber-500/20 bg-amber-950/10';
                        const nameColor = isBan ? 'text-red-400' : 'text-amber-400';
                        return (
                          <div key={zone.id} className={`border rounded-xl p-3 flex flex-col gap-2 transition-all ${themeColor}`}>
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-semibold ${nameColor}`}>{zone.name}</span>
                              <button 
                                onClick={async () => {
                                  const updated = geofencingZones.map(z => z.id === zone.id ? { ...z, active: !z.active } : z);
                                  await updateGeofencingZones(updated);
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider transition-all ${
                                  zone.active 
                                    ? 'bg-green-600/20 text-green-400 border border-green-500/30' 
                                    : 'bg-white/5 text-gray-400 border border-white/10'
                                }`}
                              >
                                {zone.active ? 'Active' : 'Inactive'}
                              </button>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-gray-400">
                              <span>Type: <b className="uppercase">{zone.type}</b></span>
                              <span>Coordinates: <b>{zone.points.length} vertices</b></span>
                            </div>

                            {zone.type === 'surge' && zone.active && (
                              <div className="flex flex-col gap-1 mt-1 border-t border-white/5 pt-2">
                                <div className="flex justify-between text-[10px] text-gray-400">
                                  <span>Zone Surge Surcharge Rate:</span>
                                  <span className="font-bold text-amber-400">{zone.multiplier}x</span>
                                </div>
                                <input 
                                  type="range"
                                  min="1.0"
                                  max="2.2"
                                  step="0.1"
                                  value={zone.multiplier}
                                  onChange={async (e) => {
                                    const val = parseFloat(e.target.value);
                                    const updated = geofencingZones.map(z => z.id === zone.id ? { ...z, multiplier: val } : z);
                                    await updateGeofencingZones(updated);
                                  }}
                                  className="w-full h-1 bg-black/40 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="card-glow p-4 flex flex-col gap-2">
                    <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Territory Guidelines</h5>
                    <div className="flex flex-col gap-1.5 text-[10px] text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span><b>Green Dash:</b> Operational base limits (Kolkata Municipal)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span><b>Amber Solid:</b> Surcharge region (multiplies base ride fares)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        <span><b>Red Solid:</b> Dispatch embargo (bookings strictly banned)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Leaflet Map Preview Column (Right) */}
                <div className="lg:col-span-7 flex flex-col flex-1 h-[480px]">
                  <div className="card-glow p-2 flex flex-col flex-1 relative h-full">
                    <div 
                      ref={geofenceMapContainerRef} 
                      className="w-full h-full rounded-lg border border-white/5 overflow-hidden" 
                      style={{ minHeight: '460px', zIndex: 1 }}
                    />
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-3 mb-4">
                
                {/* 1. Fuel Indexer */}
                <div className="fuel-pricing-simulator-box card-glow p-4 bg-indigo-950/20 border border-indigo-500/20 rounded-xl flex flex-col justify-between">
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
                <div className="fuel-pricing-simulator-box card-glow p-4 bg-indigo-950/20 border border-indigo-500/20 rounded-xl flex flex-col justify-between">
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

                {/* 3. SIMULATE WEATHER CONDITIONS CONTROLLERS */}
                <div className="fuel-pricing-simulator-box card-glow p-4 bg-indigo-950/20 border border-indigo-500/20 rounded-xl flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-bold text-indigo-400 flex items-center gap-1.5">🌦️ Weather Operations Center</h4>
                      <span className="text-[9px] font-mono bg-indigo-950 text-indigo-300 font-bold px-1.5 py-0.5 rounded">dispatch rules</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">
                      Adjust simulator weather. Heavy Rain surges pricing by 1.15x. Flooding triggers 1.25x surge and safety-suspends bike dispatch.
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-3">
                    <button
                      type="button"
                      onClick={() => updateSettings({ weather: 'clear' })}
                      className={`btn-primary py-1.5 px-3 text-[10px] font-bold rounded flex items-center justify-between transition-all ${
                        settings.weather === 'clear' ? 'bg-amber-500 text-black' : 'bg-black/40 text-gray-400 border border-white/5'
                      }`}
                      style={{ padding: '6px 12px' }}
                    >
                      <span>☀️ Clear Sky</span>
                      {settings.weather === 'clear' && <span className="text-[9px] uppercase tracking-wider font-extrabold text-black">Active</span>}
                    </button>

                    <button
                      type="button"
                      onClick={() => updateSettings({ weather: 'rain' })}
                      className={`btn-primary py-1.5 px-3 text-[10px] font-bold rounded flex items-center justify-between transition-all ${
                        settings.weather === 'rain' ? 'bg-blue-500 text-white' : 'bg-black/40 text-gray-400 border border-white/5'
                      }`}
                      style={{ padding: '6px 12px' }}
                    >
                      <span>🌧️ Heavy Rain</span>
                      {settings.weather === 'rain' && <span className="text-[9px] uppercase tracking-wider font-extrabold text-white">Active</span>}
                    </button>

                    <button
                      type="button"
                      onClick={() => updateSettings({ weather: 'flooding' })}
                      className={`btn-primary py-1.5 px-3 text-[10px] font-bold rounded flex items-center justify-between transition-all ${
                        settings.weather === 'flooding' || settings.weather === 'waterlogged' ? 'bg-red-500 text-white' : 'bg-black/40 text-gray-400 border border-white/5'
                      }`}
                      style={{ padding: '6px 12px' }}
                    >
                      <span>🌊 Flooding / Waterlog</span>
                      {(settings.weather === 'flooding' || settings.weather === 'waterlogged') && <span className="text-[9px] uppercase tracking-wider font-extrabold text-white">Active</span>}
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

              {/* PEAK SURGE PRICING SCHEDULER WIDGET */}
              <div className="card-glow p-4 mt-4 bg-indigo-950/10 border border-indigo-500/20 rounded-xl flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-indigo-400">⚡ Scheduled Peak-Hour Surges</h4>
                  {activeScheduledSurge ? (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/30 animate-pulse">
                      ⚡ {activeScheduledSurge.name} Active ({activeScheduledSurge.multiplier}x)
                    </span>
                  ) : (
                    <span className="text-[10px] bg-white/5 text-gray-400 font-bold px-2 py-0.5 rounded border border-white/10">
                      No Scheduled Surge Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  Define automated surcharge windows. Active intervals will automatically override standard base surge factors.
                </p>

                {/* Schedules list */}
                <div className="flex flex-col gap-2.5 mt-2">
                  {surgeSchedules.map(sched => (
                    <div key={sched.id} className="flex justify-between items-center bg-black/40 border border-white/5 p-3 rounded-lg text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-white">{sched.name}</span>
                        <span className="text-[10px] text-gray-500 font-mono">Interval: <b>{sched.start}</b> to <b>{sched.end}</b></span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-indigo-400">{sched.multiplier}x</span>
                        <button 
                          onClick={async () => {
                            const updated = surgeSchedules.map(s => s.id === sched.id ? { ...s, active: !s.active } : s);
                            await updateSurgeSchedules(updated);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider transition-all ${
                            sched.active 
                              ? 'bg-green-600/20 text-green-400 border border-green-500/30' 
                              : 'bg-white/5 text-gray-400 border border-white/10'
                          }`}
                        >
                          {sched.active ? 'Active' : 'Inactive'}
                        </button>
                        <button 
                          onClick={async () => {
                            const updated = surgeSchedules.filter(s => s.id !== sched.id);
                            await updateSurgeSchedules(updated);
                          }}
                          className="text-red-400 hover:text-red-500 font-bold text-xs p-1"
                          title="Delete Schedule"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Form to add new schedule */}
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const name = e.target.schedName.value;
                    const start = e.target.schedStart.value;
                    const end = e.target.schedEnd.value;
                    const multiplier = parseFloat(e.target.schedMult.value);
                    if (!name || !start || !end || isNaN(multiplier)) return;

                    const newSched = {
                      id: 'sched_' + Date.now(),
                      name,
                      start,
                      end,
                      multiplier,
                      active: true
                    };

                    await updateSurgeSchedules([...surgeSchedules, newSched]);
                    e.target.reset();
                  }}
                  className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3 border-t border-white/5 pt-3"
                >
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-400">Schedule Name</label>
                    <input name="schedName" type="text" placeholder="e.g. Rainy Peak" className="text-xs bg-black/40 text-white rounded p-1.5 border border-white/10" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-400">Start Time</label>
                    <input name="schedStart" type="time" className="text-xs bg-black/40 text-white rounded p-1.5 border border-white/10" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-400">End Time</label>
                    <input name="schedEnd" type="time" className="text-xs bg-black/40 text-white rounded p-1.5 border border-white/10" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-400">Surge Factor</label>
                    <div className="flex gap-2">
                      <input name="schedMult" type="number" step="0.1" min="1.0" max="2.0" defaultValue="1.3" className="text-xs bg-black/40 text-white rounded p-1.5 border border-white/10 w-full" required />
                      <button type="submit" className="btn-primary py-1 px-3 bg-indigo-600 hover:bg-indigo-700 text-xs text-white">Add</button>
                    </div>
                  </div>
                </form>
              </div>
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
                </div>
              </div>
              {/* HOURLY DISPATCH LOAD AREA CHART */}
              {(() => {
                const hourlyPoints = HOURLY_LOAD_DATA.map((d, idx) => {
                  const x = (idx * (500 / (HOURLY_LOAD_DATA.length - 1)));
                  const y = 95 - (d.revenue / 9000) * 75;
                  return { x, y, data: d };
                });

                const hourlyPathD = hourlyPoints.reduce((acc, p, idx) => {
                  return acc + (idx === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
                }, '');

                const hourlyFillD = hourlyPathD + ` L 500 105 L 0 105 Z`;

                return (
                  <div className="ops-map-card card-glow p-4 mt-4 relative" style={{ height: '220px' }}>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Real-time Dispatch Hourly Load Curve (Kolkata Transit Channels)
                      </h4>
                      <span className="text-[9px] text-gray-500 font-mono">Hover curve to scan points</span>
                    </div>

                    <div className="relative" style={{ height: '150px' }}>
                      <svg width="100%" height="100%" viewBox="0 0 500 120" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Grid lines */}
                        <line x1="0" y1="20" x2="500" y2="20" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                        <line x1="0" y1="60" x2="500" y2="60" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                        <line x1="0" y1="105" x2="500" y2="105" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

                        {/* Fill & Stroke */}
                        <path d={hourlyFillD} fill="url(#areaGrad)" />
                        <path d={hourlyPathD} fill="none" stroke="#10b981" strokeWidth="2.5" />

                        {/* Grid labels */}
                        <text x="5" y="16" fill="rgba(255,255,255,0.2)" fontSize="6" fontFamily="monospace">₹9,000</text>
                        <text x="5" y="56" fill="rgba(255,255,255,0.2)" fontSize="6" fontFamily="monospace">₹4,500</text>

                        {/* Interactive scanning cursor */}
                        {hoveredHourIndex !== null && (
                          <g>
                            <line 
                              x1={hourlyPoints[hoveredHourIndex].x} 
                              y1="10" 
                              x2={hourlyPoints[hoveredHourIndex].x} 
                              y2="105" 
                              stroke="rgba(16, 185, 129, 0.4)" 
                              strokeWidth="1" 
                              strokeDasharray="3, 3" 
                            />
                            <circle 
                              cx={hourlyPoints[hoveredHourIndex].x} 
                              cy={hourlyPoints[hoveredHourIndex].y} 
                              r="4.5" 
                              fill="#10b981" 
                              stroke="#fff" 
                              strokeWidth="1.5" 
                            />
                          </g>
                        )}

                        {/* Invisible overlay columns for hover detection */}
                        {hourlyPoints.map((p, idx) => (
                          <rect
                            key={idx}
                            x={Math.max(0, p.x - 25)}
                            y="0"
                            width="50"
                            height="120"
                            fill="transparent"
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={() => setHoveredHourIndex(idx)}
                            onMouseLeave={() => setHoveredHourIndex(null)}
                          />
                        ))}
                      </svg>

                      {/* Tooltip */}
                      {hoveredHourIndex !== null && (
                        <div 
                          className="absolute bg-[#181d26] border border-emerald-500/30 p-2.5 rounded-lg text-[10px] font-mono text-gray-300 shadow-xl"
                          style={{ 
                            top: '10px', 
                            left: `${Math.min(320, hourlyPoints[hoveredHourIndex].x + 15)}px`,
                            zIndex: 10
                          }}
                        >
                          <div className="font-bold text-emerald-400 border-b border-white/5 pb-1 mb-1">
                            🕒 {HOURLY_LOAD_DATA[hoveredHourIndex].time} Load Details
                          </div>
                          <div className="flex justify-between gap-6">
                            <span>Simulated Load:</span>
                            <span className="text-white font-semibold">{HOURLY_LOAD_DATA[hoveredHourIndex].load}%</span>
                          </div>
                          <div className="flex justify-between gap-6 mt-0.5">
                            <span>Est. Gross Revenue:</span>
                            <span className="text-emerald-300 font-bold">₹{HOURLY_LOAD_DATA[hoveredHourIndex].revenue}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* PREMIUM INTERACTIVE SVG ANALYTICS CHARTS SECTION */}
              <div className="finance-charts-grid mt-4" style={{ display: 'grid', gridTemplateColumns: '320px 1fr 280px', gap: '16px' }}>
                
                {/* 1. Fare Splits Donut Chart */}
                {(() => {
                  const totalFinancials = (financials.driverPayouts || 18000) + (financials.platformCommissionTotal || 1058) + (financials.accumulatedGstTotal || 1058);
                  const driverPct = totalFinancials > 0 ? ((financials.driverPayouts / totalFinancials) * 100) : 90.5;
                  const platformPct = totalFinancials > 0 ? ((financials.platformCommissionTotal / totalFinancials) * 100) : 4.8;
                  const gstPct = totalFinancials > 0 ? ((financials.accumulatedGstTotal / totalFinancials) * 100) : 4.7;

                  const strokeBasis = 251.2;
                  const driverStroke = (driverPct / 100) * strokeBasis;
                  const platformStroke = (platformPct / 100) * strokeBasis;
                  const gstStroke = (gstPct / 100) * strokeBasis;

                  const driverOffset = 0;
                  const platformOffset = -driverStroke;
                  const gstOffset = -(driverStroke + platformStroke);

                  const getCentralText = () => {
                    if (hoveredCategory === 'driver') return `${driverPct.toFixed(1)}%`;
                    if (hoveredCategory === 'platform') return `${platformPct.toFixed(1)}%`;
                    if (hoveredCategory === 'gst') return `${gstPct.toFixed(1)}%`;
                    return '100%';
                  };

                  const getCentralSub = () => {
                    if (hoveredCategory === 'driver') return 'DRIVER SHARE';
                    if (hoveredCategory === 'platform') return 'PLATFORM FEES';
                    if (hoveredCategory === 'gst') return 'GST AMOUNT';
                    return 'COMPLIANT';
                  };

                  return (
                    <div className="ops-map-card card-glow p-4 flex flex-col justify-between" style={{ height: '240px' }}>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fare Splits Ratio (Passenger total)</h4>
                      
                      <div className="flex justify-center items-center relative my-2">
                        <svg width="140" height="140" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                          {/* Driver segment */}
                          <circle 
                            cx="50" 
                            cy="50" 
                            r="40" 
                            fill="transparent" 
                            stroke="#ffdd00" 
                            strokeWidth={hoveredCategory === 'driver' ? '15' : '12'} 
                            strokeDasharray={`${driverStroke} ${strokeBasis}`} 
                            strokeDashoffset={driverOffset}
                            className="transition-all duration-300 cursor-pointer"
                            onMouseEnter={() => setHoveredCategory('driver')}
                            onMouseLeave={() => setHoveredCategory(null)}
                            style={{ filter: hoveredCategory === 'driver' ? 'drop-shadow(0 0 4px rgba(255, 221, 0, 0.5))' : 'none' }}
                          />
                          {/* Platform segment */}
                          <circle 
                            cx="50" 
                            cy="50" 
                            r="40" 
                            fill="transparent" 
                            stroke="#ffaa00" 
                            strokeWidth={hoveredCategory === 'platform' ? '15' : '12'} 
                            strokeDasharray={`${platformStroke} ${strokeBasis}`} 
                            strokeDashoffset={platformOffset}
                            className="transition-all duration-300 cursor-pointer"
                            onMouseEnter={() => setHoveredCategory('platform')}
                            onMouseLeave={() => setHoveredCategory(null)}
                            style={{ filter: hoveredCategory === 'platform' ? 'drop-shadow(0 0 4px rgba(255, 170, 0, 0.5))' : 'none' }}
                          />
                          {/* GST segment */}
                          <circle 
                            cx="50" 
                            cy="50" 
                            r="40" 
                            fill="transparent" 
                            stroke="#818cf8" 
                            strokeWidth={hoveredCategory === 'gst' ? '15' : '12'} 
                            strokeDasharray={`${gstStroke} ${strokeBasis}`} 
                            strokeDashoffset={gstOffset}
                            className="transition-all duration-300 cursor-pointer"
                            onMouseEnter={() => setHoveredCategory('gst')}
                            onMouseLeave={() => setHoveredCategory(null)}
                            style={{ filter: hoveredCategory === 'gst' ? 'drop-shadow(0 0 4px rgba(129, 140, 248, 0.5))' : 'none' }}
                          />
                          
                          {/* Central circle to create donut effect */}
                          <circle cx="50" cy="50" r="28" fill="#11141a" />
                        </svg>
                        
                        {/* Overlay text in center (unrotated) */}
                        <div className="absolute flex flex-col items-center justify-center" style={{ pointerEvents: 'none' }}>
                          <span className="text-[12px] font-bold text-white font-mono">{getCentralText()}</span>
                          <span className="text-[6px] font-bold text-gray-400 tracking-wider mt-0.5">{getCentralSub()}</span>
                        </div>
                      </div>

                      <div className="chart-legend flex justify-between text-[9px] text-gray-400 font-mono">
                        <span 
                          className="flex items-center gap-1 cursor-pointer transition-all"
                          onMouseEnter={() => setHoveredCategory('driver')}
                          onMouseLeave={() => setHoveredCategory(null)}
                          style={{ color: hoveredCategory === 'driver' ? '#fff' : 'inherit', fontWeight: hoveredCategory === 'driver' ? 'bold' : 'normal' }}
                        >
                          <span className="w-2 h-2 rounded-full bg-[#ffdd00]"></span> Driver ({driverPct.toFixed(1)}%)
                        </span>
                        <span 
                          className="flex items-center gap-1 cursor-pointer transition-all"
                          onMouseEnter={() => setHoveredCategory('platform')}
                          onMouseLeave={() => setHoveredCategory(null)}
                          style={{ color: hoveredCategory === 'platform' ? '#fff' : 'inherit', fontWeight: hoveredCategory === 'platform' ? 'bold' : 'normal' }}
                        >
                          <span className="w-2 h-2 rounded-full bg-[#ffaa00]"></span> Plat ({platformPct.toFixed(1)}%)
                        </span>
                        <span 
                          className="flex items-center gap-1 cursor-pointer transition-all"
                          onMouseEnter={() => setHoveredCategory('gst')}
                          onMouseLeave={() => setHoveredCategory(null)}
                          style={{ color: hoveredCategory === 'gst' ? '#fff' : 'inherit', fontWeight: hoveredCategory === 'gst' ? 'bold' : 'normal' }}
                        >
                          <span className="w-2 h-2 rounded-full bg-[#818cf8]"></span> GST ({gstPct.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  );
                })()}

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
                    <span>Commission (5%)</span>
                    <span>Net Weekly Owed</span>
                    <span>Action</span>
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
                        <span>
                          <button 
                            disabled={d.earnings.weekly <= 0}
                            onClick={() => payoutDriver(d.id)}
                            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-black font-bold px-2 py-0.5 rounded text-[10px] uppercase transition-all"
                          >
                            Payout
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {activeTab === 'env' && (
            <EnvSettingsPanel fetchEnvKeys={fetchEnvKeys} updateEnvKeys={updateEnvKeys} />
          )}

          {activeTab === 'analytics' && (
            <div className="admin-tab-content animate-fade-in flex flex-col gap-6 p-6">
              
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-wider text-amber-500">📊 Dispatch Operations Analytics</h2>
                  <p className="text-xs text-gray-400 mt-1">Real-time telemetrics, carbon offset indexing, and SLA tracking.</p>
                </div>
                <div className="bg-black/40 border border-white/5 px-3 py-1.5 rounded text-xs text-amber-400 font-mono">
                  SLA Goal Status: <span className="text-green-400 font-bold">98.4% Compliant</span>
                </div>
              </div>

              {/* Analytics Core Keycards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card-glow p-4 flex flex-col gap-1">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Fleet Carbon Offset</span>
                  <span className="text-2xl font-black text-emerald-400">248.5 kg</span>
                  <span className="text-[9px] text-gray-400">CO₂ offset by active JoldiGo Bike bookings</span>
                </div>
                <div className="card-glow p-4 flex flex-col gap-1">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Avg Commuter Wait</span>
                  <span className="text-2xl font-black text-amber-500">4.2 mins</span>
                  <span className="text-[9px] text-gray-400">Match-to-pickup elapsed duration</span>
                </div>
                <div className="card-glow p-4 flex flex-col gap-1">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">SLA Completion Rate</span>
                  <span className="text-2xl font-black text-blue-400">96.8%</span>
                  <span className="text-[9px] text-gray-400">Trips completed without rider dispute</span>
                </div>
                <div className="card-glow p-4 flex flex-col gap-1">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Total Platform Rides</span>
                  <span className="text-2xl font-black text-purple-400">1,482</span>
                  <span className="text-[9px] text-gray-400">Historical database transactions</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Visual CSS Bar Graph */}
                <div className="card-glow p-5 flex flex-col gap-4">
                  <h4 className="text-sm font-bold uppercase tracking-wide text-gray-300">📈 Dispatch Outcome Trends (Last 5 Days)</h4>
                  
                  <div className="flex items-end justify-between h-[200px] border-b border-white/10 pb-2 px-4 relative mt-2">
                    {/* Background grid lines */}
                    <div className="absolute left-0 right-0 top-0 border-t border-white/5 text-[9px] text-gray-600 font-mono pt-0.5">100%</div>
                    <div className="absolute left-0 right-0 top-[66px] border-t border-white/5 text-[9px] text-gray-600 font-mono pt-0.5">66%</div>
                    <div className="absolute left-0 right-0 top-[133px] border-t border-white/5 text-[9px] text-gray-600 font-mono pt-0.5">33%</div>

                    {/* Bars */}
                    {[
                      { label: 'Mon', completion: 94, dispute: 4 },
                      { label: 'Tue', completion: 88, dispute: 6 },
                      { label: 'Wed', completion: 96, dispute: 2 },
                      { label: 'Thu', completion: 92, dispute: 5 },
                      { label: 'Fri', completion: 97, dispute: 1 },
                    ].map((day, i) => (
                      <div key={i} className="flex flex-col items-center gap-2 z-10 w-[45px]">
                        <div className="w-full flex gap-1 items-end h-[160px] bg-black/30 rounded-t overflow-hidden">
                          {/* Completion bar */}
                          <div 
                            style={{ height: `${day.completion}%` }}
                            className="flex-1 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t"
                            title={`Completed: ${day.completion}%`}
                          ></div>
                          {/* Dispute bar */}
                          <div 
                            style={{ height: `${day.dispute * 5}%` }}
                            className="w-2.5 bg-gradient-to-t from-red-600 to-red-400 rounded-t"
                            title={`Disputes: ${day.dispute}%`}
                          ></div>
                        </div>
                        <span className="text-[10px] text-gray-400 font-semibold">{day.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-4 text-[10px] text-gray-500 font-mono mt-1 justify-center">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-emerald-400 rounded-sm"></span>
                      <span>Ride Completed Successfully</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-red-500 rounded-sm"></span>
                      <span>Disputes Logged</span>
                    </div>
                  </div>
                </div>

                {/* Fleet Category Distribution */}
                <div className="card-glow p-5 flex flex-col gap-4">
                  <h4 className="text-sm font-bold uppercase tracking-wide text-gray-300">🛞 Active Fleet Category Distribution</h4>
                  
                  <div className="flex flex-col gap-3 justify-center h-full">
                    
                    {/* Multi-segment Progress Bar */}
                    <div className="w-full h-5 rounded-full overflow-hidden flex bg-black/40 border border-white/5">
                      <div className="bg-amber-400" style={{ width: '45%' }} title="Bikes (45%)"></div>
                      <div className="bg-emerald-400" style={{ width: '35%' }} title="AC Cars (35%)"></div>
                      <div className="bg-blue-400" style={{ width: '20%' }} title="Non-AC Cars (20%)"></div>
                    </div>

                    {/* Stats List */}
                    <div className="flex flex-col gap-2 mt-2">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 bg-amber-400 rounded-full"></span>
                          <span className="text-gray-300">JoldiGo Bikes (TVS Apache / Honda Activa)</span>
                        </div>
                        <span className="font-bold text-white">45% Fleet Share</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full"></span>
                          <span className="text-gray-300">Aggregator AC Cars (Hyundai i10)</span>
                        </div>
                        <span className="font-bold text-white">35% Fleet Share</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 bg-blue-400 rounded-full"></span>
                          <span className="text-gray-300">Non-AC Basic Cars (Suzuki Dzire)</span>
                        </div>
                        <span className="font-bold text-white">20% Fleet Share</span>
                      </div>
                    </div>

                    <div className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-lg text-[11px] text-amber-300/80 mt-2 font-serif">
                      💡 Operational Notice: Heavy weather automatically safety-suspends Bike allocations, rerouting commuters to Aggregator AC/Non-AC categories.
                    </div>

                  </div>
                </div>
              </div>

              {/* INTERACTIVE DYNAMIC SVG CHARTS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
                
                {/* SVG Line Chart: Platform Commission Earnings */}
                <div className="card-glow p-5 flex flex-col gap-4">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wide text-gray-300">📈 System commission earnings</h4>
                    <p className="text-[9px] text-gray-500 font-mono mt-0.5">Platform Cut (5%) trend (Last 7 Days)</p>
                  </div>
                  
                  <div className="relative h-[180px] bg-black/25 rounded-lg border border-white/5 p-2 flex items-center justify-center">
                    <svg viewBox="0 0 300 150" className="w-full h-full">
                      <line x1="30" y1="20" x2="290" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
                      <line x1="30" y1="65" x2="290" y2="65" stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
                      <line x1="30" y1="110" x2="290" y2="110" stroke="rgba(255,255,255,0.05)" strokeDasharray="3,3" />
                      <line x1="30" y1="130" x2="290" y2="130" stroke="rgba(255,255,255,0.1)" />
                      <line x1="30" y1="20" x2="30" y2="130" stroke="rgba(255,255,255,0.1)" />

                      <path 
                        d="M 30 110 L 73 90 L 116 115 L 159 75 L 202 50 L 245 60 L 290 30" 
                        fill="none" 
                        stroke="url(#greenGradient)" 
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      <path 
                        d="M 30 130 L 30 110 L 73 90 L 116 115 L 159 75 L 202 50 L 245 60 L 290 30 L 290 130 Z" 
                        fill="url(#greenAreaGradient)" 
                      />

                      <circle cx="30" cy="110" r="4.5" fill="#22c55e" stroke="#fff" strokeWidth="1.5" />
                      <circle cx="73" cy="90" r="4.5" fill="#22c55e" stroke="#fff" strokeWidth="1.5" />
                      <circle cx="116" cy="115" r="4.5" fill="#22c55e" stroke="#fff" strokeWidth="1.5" />
                      <circle cx="159" cy="75" r="4.5" fill="#22c55e" stroke="#fff" strokeWidth="1.5" />
                      <circle cx="202" cy="50" r="4.5" fill="#22c55e" stroke="#fff" strokeWidth="1.5" />
                      <circle cx="245" cy="60" r="4.5" fill="#22c55e" stroke="#fff" strokeWidth="1.5" />
                      <circle cx="290" cy="30" r="5" fill="#22c55e" stroke="#ffdd00" strokeWidth="2" />

                      <text x="30" y="145" fontSize="8" fill="#718096" textAnchor="middle" fontWeight="bold">D1</text>
                      <text x="73" y="145" fontSize="8" fill="#718096" textAnchor="middle" fontWeight="bold">D2</text>
                      <text x="116" y="145" fontSize="8" fill="#718096" textAnchor="middle" fontWeight="bold">D3</text>
                      <text x="159" y="145" fontSize="8" fill="#718096" textAnchor="middle" fontWeight="bold">D4</text>
                      <text x="202" y="145" fontSize="8" fill="#718096" textAnchor="middle" fontWeight="bold">D5</text>
                      <text x="245" y="145" fontSize="8" fill="#718096" textAnchor="middle" fontWeight="bold">D6</text>
                      <text x="290" y="145" fontSize="8" fill="#ffdd00" textAnchor="middle" fontWeight="bold">Today</text>

                      <text x="290" y="18" fontSize="8" fill="#22c55e" textAnchor="middle" fontWeight="black">₹842</text>

                      <defs>
                        <linearGradient id="greenGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#22c55e" />
                          <stop offset="100%" stopColor="#ffdd00" />
                        </linearGradient>
                        <linearGradient id="greenAreaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(34, 197, 94, 0.25)" />
                          <stop offset="100%" stopColor="rgba(34, 197, 94, 0.0)" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>

                {/* SVG Bar Chart: Category Bookings Distribution */}
                <div className="card-glow p-5 flex flex-col gap-4">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wide text-gray-300">🛺 Category Bookings volume</h4>
                    <p className="text-[9px] text-gray-500 font-mono mt-0.5">Real-time demand category distributions</p>
                  </div>
                  
                  <div className="relative h-[180px] bg-black/25 rounded-lg border border-white/5 p-2 flex items-center justify-center">
                    {(() => {
                      const acCount = drivers.filter(d => d.vehicleType === 'car_ac').length;
                      const nonAcCount = drivers.filter(d => d.vehicleType === 'car_non_ac').length;
                      const bikeCount = drivers.filter(d => d.vehicleType === 'bike').length;
                      const totalCount = acCount + nonAcCount + bikeCount || 1;

                      const acHeight = Math.max(15, (acCount / totalCount) * 100);
                      const nonAcHeight = Math.max(15, (nonAcCount / totalCount) * 100);
                      const bikeHeight = Math.max(15, (bikeCount / totalCount) * 100);

                      return (
                        <svg viewBox="0 0 300 150" className="w-full h-full">
                          <line x1="30" y1="130" x2="270" y2="130" stroke="rgba(255,255,255,0.1)" />
                          
                          <rect 
                            x="60" 
                            y={130 - acHeight} 
                            width="35" 
                            height={acHeight} 
                            fill="#10b981" 
                            rx="4" 
                            className="transition-all duration-500"
                          />
                          <text x="77.5" y={120 - acHeight} fontSize="9" fill="#10b981" textAnchor="middle" fontWeight="bold">{acCount}</text>

                          <rect 
                            x="132.5" 
                            y={130 - nonAcHeight} 
                            width="35" 
                            height={nonAcHeight} 
                            fill="#3b82f6" 
                            rx="4" 
                            className="transition-all duration-500"
                          />
                          <text x="150" y={120 - nonAcHeight} fontSize="9" fill="#3b82f6" textAnchor="middle" fontWeight="bold">{nonAcCount}</text>

                          <rect 
                            x="205" 
                            y={130 - bikeHeight} 
                            width="35" 
                            height={bikeHeight} 
                            fill="#f59e0b" 
                            rx="4" 
                            className="transition-all duration-500"
                          />
                          <text x="222.5" y={120 - bikeHeight} fontSize="9" fill="#f59e0b" textAnchor="middle" fontWeight="bold">{bikeCount}</text>

                          <text x="77.5" y="144" fontSize="8" fill="#718096" textAnchor="middle" fontWeight="bold">AC Car</text>
                          <text x="150" y="144" fontSize="8" fill="#718096" textAnchor="middle" fontWeight="bold">Non-AC</text>
                          <text x="222.5" y="144" fontSize="8" fill="#718096" textAnchor="middle" fontWeight="bold">Bike</text>
                        </svg>
                      );
                    })()}
                  </div>
                </div>

                {/* SVG Radial Donut Gauge: Active Driver Ratio */}
                <div className="card-glow p-5 flex flex-col gap-4">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wide text-gray-300">👥 Partner Availability Ratio</h4>
                    <p className="text-[9px] text-gray-500 font-mono mt-0.5">Online active vs. offline system capacity</p>
                  </div>
                  
                  <div className="relative h-[180px] bg-black/25 rounded-lg border border-white/5 p-2 flex items-center justify-center">
                    {(() => {
                      const onlineCount = drivers.filter(d => d.status === 'online').length;
                      const totalDrivers = drivers.length || 1;
                      const ratio = onlineCount / totalDrivers;
                      const percentage = Math.round(ratio * 100);
                      
                      const strokeDashoffset = 251.2 - (251.2 * ratio);

                      return (
                        <svg viewBox="0 0 150 150" className="w-[140px] h-[140px]">
                          <circle 
                            cx="75" 
                            cy="75" 
                            r="40" 
                            fill="transparent" 
                            stroke="rgba(255,255,255,0.05)" 
                            strokeWidth="10" 
                          />
                          <circle 
                            cx="75" 
                            cy="75" 
                            r="40" 
                            fill="transparent" 
                            stroke="#ffdd00" 
                            strokeWidth="10" 
                            strokeDasharray="251.2"
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            transform="rotate(-90 75 75)"
                            className="transition-all duration-700"
                          />
                          <text x="75" y="72" fontSize="16" fill="#fff" textAnchor="middle" fontWeight="black">{percentage}%</text>
                          <text x="75" y="87" fontSize="8" fill="#718096" textAnchor="middle" fontWeight="bold">Online</text>
                          
                          <text x="75" y="138" fontSize="8.5" fill="#a0aec0" textAnchor="middle" fontWeight="bold">
                            {onlineCount} / {totalDrivers} Partners Active
                          </text>
                        </svg>
                      );
                    })()}
                  </div>
                </div>

              </div>

            </div>
          )}

        </main>
      </div>
    </div>
  );
}

function EnvSettingsPanel({ fetchEnvKeys, updateEnvKeys }) {
  const [keys, setKeys] = useState({
    databaseUrl: '',
    twilioSid: '',
    twilioAuthToken: '',
    twilioPhoneNumber: '',
    razorpayKeyId: '',
    razorpayKeySecret: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let active = true;
    const loadKeys = async () => {
      const data = await fetchEnvKeys();
      if (active) {
        setKeys(data);
        setLoading(false);
      }
    };
    loadKeys();
    return () => { active = false; };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setKeys(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await updateEnvKeys(keys);
    setSaving(false);
    if (res.success) {
      setMessage({ type: 'success', text: 'Server configuration updated and clients reloaded successfully!' });
      const data = await fetchEnvKeys();
      setKeys(data);
    } else {
      setMessage({ type: 'error', text: res.error || 'Failed to update configuration.' });
    }
  };

  if (loading) {
    return (
      <div className="admin-tab-content text-center font-bold text-xs" style={{ padding: '40px 20px', color: '#888' }}>
        Loading credentials from server environment...
      </div>
    );
  }

  return (
    <div className="admin-tab-content" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="payouts-section card-glow text-left">
        <h3 className="text-sm font-bold uppercase tracking-wider text-yellow-400 mb-1 flex items-center gap-1.5">
          <span>⚙️</span> API Keys & Environmental Credentials Manager
        </h3>
        <p className="text-[10px] text-gray-400 mb-4 leading-relaxed">
          Configure active server credentials dynamically. These parameters write directly back to the database environment variables on disk. Leave secret codes masked (showing ****) to preserve their active states.
        </p>

        {message && (
          <div className={`p-3 rounded text-[11px] mb-4 font-bold border ${
            message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] uppercase tracking-wider text-gray-500 font-extrabold">Neon Serverless PostgreSQL connection URL</label>
            <input 
              type="text" 
              name="databaseUrl" 
              value={keys.databaseUrl} 
              onChange={handleChange}
              placeholder="postgresql://user:password@host/db"
              className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase tracking-wider text-gray-500 font-extrabold">Twilio Account SID</label>
              <input 
                type="text" 
                name="twilioSid" 
                value={keys.twilioSid} 
                onChange={handleChange}
                placeholder="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                className="bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-yellow-400"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase tracking-wider text-gray-500 font-extrabold">Twilio Auth Token</label>
              <input 
                type="password" 
                name="twilioAuthToken" 
                value={keys.twilioAuthToken} 
                onChange={handleChange}
                placeholder="••••••••••••••••••••••••••••••••"
                className="bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-yellow-400"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] uppercase tracking-wider text-gray-500 font-extrabold">Twilio Registered Sender Phone Number</label>
            <input 
              type="text" 
              name="twilioPhoneNumber" 
              value={keys.twilioPhoneNumber} 
              onChange={handleChange}
              placeholder="+1234567890"
              className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-yellow-400"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase tracking-wider text-gray-500 font-extrabold">Razorpay Client Key ID</label>
              <input 
                type="text" 
                name="razorpayKeyId" 
                value={keys.razorpayKeyId} 
                onChange={handleChange}
                placeholder="rzp_test_XXXXXXXXXXXXXX"
                className="bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-yellow-400"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] uppercase tracking-wider text-gray-500 font-extrabold">Razorpay Client Key Secret</label>
              <input 
                type="password" 
                name="razorpayKeySecret" 
                value={keys.razorpayKeySecret} 
                onChange={handleChange}
                placeholder="••••••••••••••••••••••••"
                className="bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-yellow-400"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={saving}
            className="w-full bg-[#ffdd00] hover:bg-[#e6c700] text-black font-extrabold uppercase py-2.5 rounded text-[10px] tracking-widest mt-2 transition-all duration-300 disabled:opacity-50"
            style={{ width: '100%' }}
          >
            {saving ? 'Reloading Server Configuration...' : 'Save & Hot-Reload Credentials'}
          </button>
        </form>
      </div>
    </div>
  );
}
