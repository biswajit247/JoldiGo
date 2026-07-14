import React, { useState, useEffect, useRef } from 'react';
import { useSimulator, getServerEndpoints, calculateDistance } from '../context/SimulatorContext';
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
  BarChart2,
  MessageSquare,
  Gift
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
    verifyDriverDoc,
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
    updateEnvKeys,
    smsLogs,
    simulationSpeed,
    setSimulationSpeed,
    updateFuelPrices,
    addCustomHotspot,
    resetSimulator,
    mapStyle,
    setMapStyle,
    passengersList,
    refreshPassengersList,
    predictiveGuides,
    setPredictiveGuides,
    useAiSurgeEngine,
    setUseAiSurgeEngine,
    dynamicSurgeMultiplier,
    dispatchQueueLog,
    setDispatchQueueLog,
    promos,
    setPromos,
    blockages,
    setBlockages,
    fetchInitialData
  } = useSimulator();

  useEffect(() => {
    connectAdminSocket();
    refreshPassengersList();
    const interval = setInterval(() => {
      refreshPassengersList();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [driverSubTab, setDriverSubTab] = useState('drivers'); // 'drivers', 'passengers'
  const [ledgerSearchText, setLedgerSearchText] = useState('');
  const [ledgerVehicleFilter, setLedgerVehicleFilter] = useState('all');
  const [showDemandHeatmap, setShowDemandHeatmap] = useState(false);
  const [clickToAddHotspots, setClickToAddHotspots] = useState(false);
  const clickToAddHotspotsRef = useRef(clickToAddHotspots);
  const [clickToAddSurgeZone, setClickToAddSurgeZone] = useState(false);
  const clickToAddSurgeZoneRef = useRef(clickToAddSurgeZone);

  const [clickToAddBlockage, setClickToAddBlockage] = useState(false);
  const clickToAddBlockageRef = useRef(clickToAddBlockage);
  const [blockageType, setBlockageType] = useState('accident');
  const [blockageDescription, setBlockageDescription] = useState('Major accident blockage');

  useEffect(() => {
    clickToAddBlockageRef.current = clickToAddBlockage;
  }, [clickToAddBlockage]);

  useEffect(() => {
    clickToAddHotspotsRef.current = clickToAddHotspots;
  }, [clickToAddHotspots]);

  useEffect(() => {
    clickToAddSurgeZoneRef.current = clickToAddSurgeZone;
  }, [clickToAddSurgeZone]);

  useEffect(() => {
    window._deleteBlockage = async (id) => {
      if (confirm("Delete this road obstacle?")) {
        try {
          const { api } = getServerEndpoints();
          const res = await fetch(`${api}/api/blockages/${id}`, { method: 'DELETE' });
          if (res.ok) {
            fetchInitialData();
          }
        } catch (err) {
          console.error(err);
        }
      }
    };
    return () => {
      delete window._deleteBlockage;
    };
  }, []);

  // Cleanup expired predictive guides periodically to auto-fade routes
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPredictiveGuides(prev => prev.filter(g => now - g.timestamp < 15000));
    }, 5000);
    return () => clearInterval(interval);
  }, [setPredictiveGuides]);
  const [selectedDriverForDoc, setSelectedDriverForDoc] = useState(null);
  const [selectedDocTab, setSelectedDocTab] = useState('license');
  const [dlChecked, setDlChecked] = useState(false);
  const [aadharChecked, setAadharChecked] = useState(false);
  const [rcChecked, setRcChecked] = useState(false);
  const [driverReviews, setDriverReviews] = useState([]);

  useEffect(() => {
    if (selectedDriverForDoc) {
      const fetchHistory = async () => {
        try {
          const { api } = getServerEndpoints();
          const res = await fetch(`${api}/api/driver/history?driverId=${selectedDriverForDoc.id}`);
          const data = await res.json();
          if (data.success) {
            setDriverReviews(data.history || []);
          }
        } catch (e) {
          console.error(e);
        }
      };
      fetchHistory();
    } else {
      setDriverReviews([]);
    }
  }, [selectedDriverForDoc]);

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
  const tileLayerRef = useRef(null);
  const markersRef = useRef({
    drivers: {},
    activeRide: null,
    geofencePolygon: null,
    sosElements: [], 
    trafficCircles: [], // Keep track of traffic overlays
    demandCircles: [], // Keep track of heatmap circles
    blockageCircles: [], // Keep track of roadblock circles
  });

  // Geofence map elements
  const geofenceMapContainerRef = useRef(null);
  const geofenceMapRef = useRef(null);
  const geofenceTileLayerRef = useRef(null);
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

    // Render Geofence Boundary
    const geofenceCoords = geofence.map(c => [c.lat, c.lng]);
    markersRef.current.geofencePolygon = L.polygon(geofenceCoords, {
      color: '#ff9900',
      weight: 2,
      fillColor: '#ff9900',
      fillOpacity: 0.05,
    }).addTo(map);

    map.on('click', async (e) => {
      if (clickToAddHotspotsRef.current) {
        const { lat, lng } = e.latlng;
        addCustomHotspot(lat, lng, 1.0);
      } else if (clickToAddSurgeZoneRef.current) {
        const { lat, lng } = e.latlng;
        const name = prompt("Enter name for this custom Surge Geofence:", "New Surge Hub");
        if (!name) return;
        const multiplierStr = prompt("Enter Fare Multiplier (e.g. 1.5, 1.8, 2.2):", "1.5");
        const multiplier = parseFloat(multiplierStr) || 1.0;
        
        // Define a small polygon square box approximating a circle area
        const r = 0.008; 
        const points = [
          [lat + r, lng - r],
          [lat + r, lng + r],
          [lat - r, lng + r],
          [lat - r, lng - r]
        ];
        
        const newZone = {
          id: 'zone_custom_' + Date.now(),
          name,
          points,
          type: 'surge',
          multiplier,
          active: true
        };
        
        await updateGeofencingZones([...geofencingZones, newZone]);
        setClickToAddSurgeZone(false);
      } else if (clickToAddBlockageRef.current) {
        const { lat, lng } = e.latlng;
        const description = prompt("Enter description for this roadblock:", blockageDescription);
        if (description === null) return; 
        
        const type = prompt("Enter type of roadblock (accident, construction, roadblock):", blockageType);
        if (!type) return;

        const radiusStr = prompt("Enter blockage radius (meters):", "150");
        const radius = parseInt(radiusStr) || 150;

        try {
          const { api } = getServerEndpoints();
          const res = await fetch(`${api}/api/blockages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng, type, radius, description })
          });
          const data = await res.json();
          if (data.success) {
            alert(`Road blockage "${description}" added successfully!`);
          } else {
            alert("Failed to save blockage: " + (data.error || "Unknown error"));
          }
        } catch (err) {
          console.error(err);
          alert("Error saving blockage to server.");
        }
        setClickToAddBlockage(false);
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [activeTab, geofence, geofencingZones, clickToAddSurgeZone, clickToAddHotspots]);

  useEffect(() => {
    const MAP_TILE_URLS = {
      google_roadmap: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      google_satellite: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      voyager: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      dark_navigation: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    };
    if (tileLayerRef.current) {
      tileLayerRef.current.setUrl(MAP_TILE_URLS[mapStyle]);
    }
    if (geofenceTileLayerRef.current) {
      geofenceTileLayerRef.current.setUrl(MAP_TILE_URLS[mapStyle]);
    }
  }, [mapStyle]);

  // Geofence Map Initialization & Redraw Hook
  useEffect(() => {
    if (activeTab !== 'geofence' || !geofenceMapContainerRef.current) return;

    // 1. Initialize Map instance
    const map = L.map(geofenceMapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
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

    geofenceTileLayerRef.current = tileLayer;
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

    // Clear old blockages
    if (markersRef.current.blockageCircles) {
      markersRef.current.blockageCircles.forEach(c => map.removeLayer(c));
    }
    markersRef.current.blockageCircles = [];

    // Clear old predictive lines
    if (markersRef.current.predictiveLines) {
      markersRef.current.predictiveLines.forEach(l => map.removeLayer(l));
    }
    markersRef.current.predictiveLines = [];

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

      const vehicleEmoji = d.vehicleType === 'bike' ? '🏍️' : (d.vehicleType === 'auto' ? '🛺' : (d.vehicleType === 'car_ac' ? '🚗' : '🚕'));
      const adminDriverIcon = L.divIcon({
        className: 'admin-driver-marker-div',
        html: `<div class="admin-marker-dot ${isSOS ? 'sos-pulse' : ''}" style="background-color: ${pinColor}; position: relative;">
                 <span class="lbl-init">${d.avatar}</span>
                 <span style="position: absolute; bottom: -4px; right: -4px; font-size: 8px; background: rgba(0,0,0,0.85); padding: 2px; border-radius: 50%; width: 11px; height: 11px; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.15);">${vehicleEmoji}</span>
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
          stroke: true,
          color: '#ef4444',
          weight: 1,
          dashArray: '3, 5',
          fillColor: '#ef4444',
          fillOpacity: Math.min(0.3, 0.12 * pt.weight),
          radius: 400 * pt.weight
        }).addTo(map);
        markersRef.current.demandCircles.push(circle);
      });
    }

    // Render active AI predictive guide lines
    if (predictiveGuides && predictiveGuides.length > 0) {
      const now = Date.now();
      predictiveGuides.forEach(g => {
        if (now - g.timestamp < 15000) {
          const drv = drivers.find(d => d.id === g.driverId);
          if (drv && drv.location) {
            const line = L.polyline([[drv.location.lat, drv.location.lng], [g.lat, g.lng]], {
              color: '#06b6d4', // Cyan
              weight: 3,
              dashArray: '5, 8',
              opacity: 0.8,
              className: 'animated-cyan-line'
            }).addTo(map);
            line.bindPopup(`<b>AI Pre-allocation Route</b><br/>Directing Captain ${drv.name} to ${g.hotspotName}`);
            markersRef.current.predictiveLines.push(line);
          }
        }
      });
    }
    // Render dynamic active roadblock blockages
    if (blockages && blockages.length > 0) {
      blockages.forEach(b => {
        const fillCol = b.type === 'accident' ? '#ef4444' : (b.type === 'construction' ? '#f59e0b' : '#3b82f6');
        
        // Circular hazard area overlay
        const circle = L.circle([b.lat, b.lng], {
          stroke: true,
          color: fillCol,
          weight: 2,
          fillColor: fillCol,
          fillOpacity: 0.18,
          radius: b.radius || 150,
          className: 'animated-hazard-zone'
        }).addTo(map);

        // Center warning icon / delete popup
        const markerIcon = L.divIcon({
          className: 'blockage-icon-marker',
          html: `<div class="bg-black/80 border border-white/20 text-white rounded-full flex items-center justify-center font-bold" style="width: 20px; height: 20px; font-size: 10px; border-color: ${fillCol}; box-shadow: 0 0 8px ${fillCol};">⚠️</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        const marker = L.marker([b.lat, b.lng], { icon: markerIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:sans-serif;font-size:11px;color:#fff;background:#0c0e12;padding:4px;border-radius:4px;width:140px;">
              <b style="font-size:12px;color:${fillCol}">${b.type.toUpperCase()}</b><br/>
              <span>${b.description}</span><br/>
              Radius: <b>${b.radius}m</b><br/>
              <button 
                onclick="window._deleteBlockage(${b.id})" 
                style="background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.3);color:#f87171;padding:2px 6px;font-size:9px;border-radius:3px;margin-top:6px;cursor:pointer;width:100%;"
              >
                Delete Obstacle
              </button>
            </div>
          `);

        markersRef.current.blockageCircles.push(circle);
        markersRef.current.blockageCircles.push(marker);
      });
    }

  }, [drivers, activeRide, sosAlerts, activeTab, congestionZones, showDemandHeatmap, demandHotspots, predictiveGuides, blockages]);

  const exportSmsJson = () => {
    if (smsLogs.length === 0) return alert("No logs to export.");
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(smsLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `sms_telemetry_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportSmsCsv = () => {
    if (smsLogs.length === 0) return alert("No logs to export.");
    const csvRows = [
      ["ID", "Sender", "Message", "Timestamp"],
      ...smsLogs.map(log => [
        log.id,
        `"${log.sender.replace(/"/g, '""')}"`,
        `"${log.message.replace(/"/g, '""')}"`,
        log.timestamp
      ])
    ];
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", `sms_telemetry_logs_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

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

  const handleUpdateFuelIndex = async (e) => {
    e.preventDefault();
    await updateFuelPrices({
      cng: parseFloat(localFuelPrices.cng),
      petrol: parseFloat(localFuelPrices.petrol),
      diesel: parseFloat(localFuelPrices.diesel)
    });
    alert("Kolkata Fuel Market indices updated & surcharges synced in real-time!");
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
    const subscriptionEarnings = adminStats.subscriptionEarnings || 0;

    const gatewayFees = grossBookings * 1.05 * 0.02; 
    const odttaLicenseMonthlyAmortized = 8333; 
    const controlRoomStaffCostMonthly = 60000; 

    const netPlatformProfits = platformCommissionTotal + subscriptionEarnings - gatewayFees;

    return {
      grossBookings,
      platformCommissionTotal,
      accumulatedGstTotal,
      gatewayFees: parseFloat(gatewayFees.toFixed(2)),
      driverPayouts,
      subscriptionEarnings,
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
              <b>CRITICAL EMERGENCY (24/7 Control Room Active):</b> {sosAlerts.filter(a => a.status === 'dispatch' || a.status === 'secured').length} Active SOS Panic Signal(s) triggered! Police interceptor units dispatched.
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
              <span>Partners & Customers</span>
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
              className={`nav-item ${activeTab === 'sms_logs' ? 'active' : ''}`}
              onClick={() => setActiveTab('sms_logs')}
            >
              <MessageSquare size={18} />
              <span>SMS Broadcast Logs</span>
            </button>

            <button 
              className={`nav-item ${activeTab === 'promos' ? 'active' : ''}`}
              onClick={() => setActiveTab('promos')}
            >
              <Gift size={18} className="text-pink-400" />
              <span>Promo Campaigns</span>
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

              {/* SIMULATION PRESETS & SCENARIO CONTROL CENTER */}
              <div className="card-glow p-4 bg-rose-950/5 border border-rose-500/10 rounded-xl mt-4">
                <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1.5 font-mono uppercase tracking-wider">🎮 JoldiGo Simulation Preset Control Center</h4>
                <p className="text-[11px] text-gray-400 mt-1">Deploy pre-configured emergency scenarios across Kolkata, dynamically shifting weather, surge multipliers, roadblock obstructions, and transit hotspots.</p>
                
                <div className="flex gap-4 mt-3 flex-wrap md:flex-nowrap">
                  
                  {/* Preset 1: Monsoon Storm */}
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const { api } = getServerEndpoints();
                        const res = await fetch(`${api}/api/admin/presets`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ preset: 'monsoon' })
                        });
                        const data = await res.json();
                        if (data.success) {
                          addLog("🌧️ PRESET DEPLOYED: Monsoon Flooding Active! Surge set to 1.6x.", "warning");
                          fetchInitialData();
                        }
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="flex-1 bg-blue-950/20 hover:bg-blue-950/40 border border-blue-500/40 text-blue-400 p-3 rounded-lg flex items-center justify-between transition-all cursor-pointer text-left"
                    style={{ minHeight: '60px' }}
                  >
                    <div>
                      <span className="text-xs font-bold text-white block">🌧️ Monsoon Flood Alert</span>
                      <span className="text-[9px] text-gray-400 block mt-0.5">Weather: Flooding | Surge: 1.6x | Roadblocks: Active</span>
                    </div>
                    <span className="text-lg">➔</span>
                  </button>

                  {/* Preset 2: Peak Hour Traffic */}
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const { api } = getServerEndpoints();
                        const res = await fetch(`${api}/api/admin/presets`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ preset: 'peak' })
                        });
                        const data = await res.json();
                        if (data.success) {
                          addLog("🚦 PRESET DEPLOYED: Peak Hour Transit Active! High-demand hotspots triggered.", "info");
                          fetchInitialData();
                        }
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="flex-1 bg-amber-950/20 hover:bg-amber-950/40 border border-amber-500/40 text-amber-400 p-3 rounded-lg flex items-center justify-between transition-all cursor-pointer text-left"
                    style={{ minHeight: '60px' }}
                  >
                    <div>
                      <span className="text-xs font-bold text-white block">🚦 Peak Hour Traffic</span>
                      <span className="text-[9px] text-gray-400 block mt-0.5">Surge: 1.3x | Congestion: Heavy | Hotspots: Enabled</span>
                    </div>
                    <span className="text-lg">➔</span>
                  </button>

                  {/* Preset 3: Normal Reset */}
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const { api } = getServerEndpoints();
                        const res = await fetch(`${api}/api/admin/presets`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ preset: 'normal' })
                        });
                        const data = await res.json();
                        if (data.success) {
                          addLog("🔄 PRESET RESTORED: Reset to base normal conditions.", "success");
                          fetchInitialData();
                        }
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="flex-1 bg-slate-900/40 hover:bg-slate-900/60 border border-white/10 text-gray-300 p-3 rounded-lg flex items-center justify-between transition-all cursor-pointer text-left"
                    style={{ minHeight: '60px' }}
                  >
                    <div>
                      <span className="text-xs font-bold text-white block">🔄 Reset to Normal</span>
                      <span className="text-[9px] text-gray-400 block mt-0.5">Surge: 1.0x | Weather: Clear | Hotspots/Roadblocks: Cleared</span>
                    </div>
                    <span className="text-lg">➔</span>
                  </button>

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
                      {/* SIMULATION SPEED SLIDER */}
                      <div className="flex items-center gap-2 bg-black/40 border border-white/5 px-2.5 py-1 rounded-lg text-[10px]">
                        <span className="text-gray-400 font-bold uppercase">⚡ GPS Speed:</span>
                        <input 
                          type="range"
                          min="100"
                          max="850"
                          step="50"
                          value={900 - simulationSpeed}
                          onChange={(e) => setSimulationSpeed(900 - parseInt(e.target.value))}
                          style={{ width: '70px', height: '4px', cursor: 'pointer', accentColor: '#fbbf24' }}
                          title="Slide to adjust GPS simulation refresh rates"
                        />
                        <span className="text-amber-400 font-bold font-mono min-w-[30px] text-right">
                          {simulationSpeed === 400 ? '1.0x' : `${(400 / simulationSpeed).toFixed(1)}x`}
                        </span>
                      </div>

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

                      <button 
                        onClick={() => {
                          setClickToAddHotspots(!clickToAddHotspots);
                          if (clickToAddSurgeZone) setClickToAddSurgeZone(false);
                          if (clickToAddBlockage) setClickToAddBlockage(false);
                          if (!showDemandHeatmap) setShowDemandHeatmap(true);
                        }}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          clickToAddHotspots 
                            ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]' 
                            : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                        }`}
                        title="Click anywhere on the map to add custom high-demand hotspots"
                      >
                        📍 Click-to-Add Hotspots: {clickToAddHotspots ? 'ACTIVE (Click Map)' : 'OFF'}
                      </button>

                      <button 
                        onClick={() => {
                          setClickToAddSurgeZone(!clickToAddSurgeZone);
                          if (clickToAddHotspots) setClickToAddHotspots(false);
                          if (clickToAddBlockage) setClickToAddBlockage(false);
                        }}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          clickToAddSurgeZone 
                            ? 'bg-yellow-400 text-black border-yellow-300 shadow-[0_0_10px_rgba(255,221,0,0.2)]' 
                            : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                        }`}
                        title="Click anywhere on the map to define a geofenced surge hub"
                      >
                        ⚡ Draw Surge Geofence: {clickToAddSurgeZone ? 'ACTIVE (Click Map)' : 'OFF'}
                      </button>

                      <button 
                        onClick={() => {
                          setClickToAddBlockage(!clickToAddBlockage);
                          if (clickToAddHotspots) setClickToAddHotspots(false);
                          if (clickToAddSurgeZone) setClickToAddSurgeZone(false);
                        }}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          clickToAddBlockage 
                            ? 'bg-rose-600 text-white border-rose-500 shadow-[0_0_10px_rgba(225,29,72,0.2)]' 
                            : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                        }`}
                        title="Click anywhere on the map to define a road blockage obstacle (e.g. accident, construction)"
                      >
                        ⚠️ Place Road Obstacle: {clickToAddBlockage ? 'ACTIVE (Click Map)' : 'OFF'}
                      </button>

                      <div className="map-legend">
                        <span className="leg-item"><span className="dot green"></span> Free</span>
                        <span className="leg-item"><span className="dot orange"></span> In Ride</span>
                        <span className="leg-item"><span className="dot red"></span> SOS</span>
                        <span className="leg-item"><span className="dot blue"></span> 🚔 Patrol</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ position: 'relative', width: '100%', height: 'calc(100% - 50px)' }}>
                    <div ref={mapContainerRef} className="admin-leaflet-map-container" style={{ height: '100%' }}></div>
                  </div>
                </div>

                {activeRide && (activeRide.status === 'searching' || activeRide.status === 'requested') && dispatchQueueLog.length > 0 ? (
                  <div className="ops-terminal-card card-glow flex flex-col" style={{ height: '320px', padding: '16px' }}>
                    <div className="card-header-flex">
                      <h4 className="text-amber-400 flex items-center gap-1.5 font-mono uppercase tracking-wider text-xs">
                        🧠 Intelligent Dispatch Matchmaker
                      </h4>
                      <span className="animate-pulse bg-amber-950/45 text-amber-400 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-amber-500/25">
                        MATCHING IN PROGRESS...
                      </span>
                    </div>
                    <div className="p-2.5 my-2 rounded border border-gray-800 bg-gray-950/30 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Rider: <strong className="text-gray-200">Biswajit Passenger</strong></span>
                        <span className="text-gray-400">Vehicle: <strong className="text-amber-400 uppercase font-mono">{activeRide?.vehicleType?.replace('_', ' ') || ''}</strong></span>
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1 truncate">
                        Route: {activeRide.pickupName} ➔ {activeRide.dropoffName}
                      </div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }} className="space-y-1.5 pr-1">
                      {dispatchQueueLog.map((candidate, idx) => (
                        <div 
                          key={candidate.id} 
                          className="bg-black/30 border border-gray-800/80 rounded p-2 flex justify-between items-center hover:border-gray-700 transition-all"
                          style={{ opacity: idx === 0 ? 1.0 : 0.6 }}
                        >
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-gray-200">
                                {idx === 0 ? '👑 ' : ''}{candidate.name}
                              </span>
                              <span className="text-[8px] bg-gray-800 text-gray-400 px-1 rounded">
                                {candidate.distanceToPickup.toFixed(2)} km away
                              </span>
                            </div>
                            <div className="text-[9px] text-gray-500 flex gap-2">
                              <span>Acceptance: <strong className="text-emerald-500">{candidate.acceptanceRate}%</strong></span>
                              <span>Cancellations: <strong className="text-red-500">{candidate.cancellationRate}%</strong></span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-amber-500 font-mono">{candidate.matchScore}%</div>
                            <div className="text-[8px] text-gray-500 uppercase tracking-wider">Match Score</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
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
                )}

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

              {/* AI-POWERED PREDICTIVE DRIVER DISPATCHER CONTROL BOARD */}
              <div className="predictive-dispatcher-section card-glow mt-4 p-4 bg-slate-900/50 border border-cyan-500/10 rounded-xl text-left">
                <div className="flex justify-between items-center pb-2.5 border-b border-white/5 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">🗺️</span>
                    <div>
                      <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono">AI-Powered Predictive Driver Dispatcher</h4>
                      <span className="text-[9px] text-gray-500 font-bold block uppercase tracking-tight">Active Heat-Circle Routing & Pre-allocation Queue</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[9px] font-black uppercase rounded-full animate-pulse">
                    Pre-Allocating
                  </span>
                </div>

                <p className="text-[11px] text-gray-400 mb-3">
                  Match online captains with demand hotspots before bookings occur. Directing captains to high-yield areas minimizes passenger wait times and secures surge payouts.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Active Hotspots Sub-Card */}
                  <div className="bg-black/35 p-3 rounded-lg border border-white/5">
                    <span className="text-[10px] text-cyan-400 font-black uppercase tracking-wider block mb-2">🔥 Active Hotspot Multipliers</span>
                    <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                      {demandHotspots.length === 0 ? (
                        <div className="text-[10px] text-gray-500 italic">No hotspots defined. Try drawing geofences or clicking on the map.</div>
                      ) : (
                        demandHotspots.map((pt, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/5">
                            <div>
                              <span className="text-xs text-white font-bold block">Hotspot #{idx + 1}</span>
                              <span className="text-[9px] text-gray-500 block">Coordinates: {pt.lat.toFixed(4)}, {pt.lng.toFixed(4)}</span>
                            </div>
                            <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-bold rounded">
                              {(1.0 + pt.weight * 0.5).toFixed(1)}x Surge
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Dispatch Recommendations Sub-Card */}
                  <div className="bg-black/35 p-3 rounded-lg border border-white/5">
                    <span className="text-[10px] text-cyan-400 font-black uppercase tracking-wider block mb-2">⚡ Smart Routing Recommendations</span>
                    <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                      {(() => {
                        const recommendations = [];
                        const onlineDrivers = drivers.filter(d => d.status === 'online' && d.verificationStatus === 'verified' && (!activeRide || activeRide.driverId !== d.id));

                        onlineDrivers.forEach(drv => {
                          if (drv.location) {
                            demandHotspots.forEach((hotspot, idx) => {
                              const dist = calculateDistance(drv.location.lat, drv.location.lng, hotspot.lat, hotspot.lng);
                              if (dist < 4.0) {
                                recommendations.push({
                                  driver: drv,
                                  hotspot: hotspot,
                                  hotspotIndex: idx + 1,
                                  distance: dist
                                });
                              }
                            });
                          }
                        });

                        recommendations.sort((a, b) => a.distance - b.distance);

                        if (recommendations.length === 0) {
                          return <div className="text-[10px] text-gray-500 italic py-2">No captains currently near active hotspots.</div>;
                        }

                        return recommendations.map((rec, i) => (
                          <div key={i} className="flex justify-between items-center bg-white/5 p-2 rounded border border-white/5 text-[10px]">
                            <div>
                              <span className="font-bold text-white block">Captain {rec.driver.name}</span>
                              <span className="text-gray-500 block text-[9px]">Distance: {rec.distance.toFixed(1)} km to Hotspot #{rec.hotspotIndex}</span>
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  const { api } = getServerEndpoints();
                                  const res = await fetch(`${api}/api/admin/predictive/dispatch`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      driverId: rec.driver.id,
                                      hotspotName: `Hotspot #${rec.hotspotIndex}`,
                                      lat: rec.hotspot.lat,
                                      lng: rec.hotspot.lng
                                    })
                                  });
                                  const data = await res.json();
                                  if (data.success) {
                                    addLog(`[AI Dispatcher] Guided Captain ${rec.driver.name} to Hotspot #${rec.hotspotIndex}`, 'info');
                                  }
                                } catch (err) {
                                  console.error("AI pre-allocation dispatch failed:", err);
                                }
                              }}
                              className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase rounded text-[9px] transition cursor-pointer"
                            >
                              Dispatch
                            </button>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              </div>

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
                <h3>Partners & Customers Management</h3>
                <p className="text-gray-400 text-sm">Review onboard documents for partner drivers and track registered customer profiles.</p>
              </div>

              {/* Sub-tab Selectors */}
              <div className="flex gap-2 mt-3 border-b border-white/5 pb-2">
                <button
                  type="button"
                  onClick={() => setDriverSubTab('drivers')}
                  style={{
                    padding: '6px 14px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    borderRadius: '6px',
                    backgroundColor: driverSubTab === 'drivers' ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  🏍️ Driver Partners ({drivers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDriverSubTab('passengers')}
                  style={{
                    padding: '6px 14px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    borderRadius: '6px',
                    backgroundColor: driverSubTab === 'passengers' ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  👥 Passenger Customers ({passengersList.length})
                </button>
              </div>

              {driverSubTab === 'drivers' ? (
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
              ) : (
                <div className="driver-list-table card-glow mt-3">
                  <div className="table-header" style={{ gridTemplateColumns: '1.2fr 1.5fr 1fr 1.2fr' }}>
                    <span>Customer Name</span>
                    <span>Mobile Number</span>
                    <span>Wallet Balance</span>
                    <span>Registration Date</span>
                  </div>

                  {passengersList.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-500 italic">No passenger records registered on this server.</div>
                  ) : (
                    passengersList.map(pass => (
                      <div key={pass.phone} className="table-row" style={{ gridTemplateColumns: '1.2fr 1.5fr 1fr 1.2fr', padding: '10px 14px' }}>
                        <div className="col-partner text-left">
                          <span className="drv-avatar-mini" style={{ backgroundColor: '#10b981', color: '#fff', fontSize: '9px' }}>👤</span>
                          <div className="drv-details ml-2">
                            <span className="bold text-white">{pass.name || 'Guest Passenger'}</span>
                          </div>
                        </div>
                        <span className="font-mono text-xs text-gray-300 text-left">+91 {pass.phone}</span>
                        <span className="font-bold text-emerald-400 text-left">₹{parseFloat(pass.wallet_balance || 0).toFixed(2)}</span>
                        <span className="text-xs text-gray-500 text-left">{new Date(pass.created_at).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

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
                        <button 
                          className={`px-3 py-1 font-bold rounded-t-lg transition-all ${
                            selectedDocTab === 'driver_photo' 
                              ? 'bg-yellow-600/20 text-yellow-400 border-b-2 border-yellow-500' 
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                          onClick={() => setSelectedDocTab('driver_photo')}
                        >
                          👤 Driver Selfie
                        </button>
                        <button 
                          className={`px-3 py-1 font-bold rounded-t-lg transition-all ${
                            selectedDocTab === 'vehicle_photo' 
                              ? 'bg-cyan-600/20 text-cyan-400 border-b-2 border-cyan-500' 
                              : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                          onClick={() => setSelectedDocTab('vehicle_photo')}
                        >
                          🚗 Vehicle Photo
                        </button>
                      </div>

                      {/* Mock Scan Display Box */}
                      <div className="flex justify-center mb-4 p-2 bg-black/40 rounded-xl border border-white/5">
                        {selectedDocTab === 'driver_photo' && (
                          <div className="w-full max-w-[320px] rounded-xl overflow-hidden border border-white/10 bg-black/80 flex flex-col items-center justify-center p-2" style={{ aspectRatio: '1.586' }}>
                            {selectedDriverForDoc.driverPhoto ? (
                              <img src={selectedDriverForDoc.driverPhoto} alt="Driver Live Selfie" className="w-full h-full object-contain rounded-lg" />
                            ) : (
                              <div className="text-xs text-gray-500 py-8">⚠️ No Live Photo Submitted (Default Avatar Used)</div>
                            )}
                          </div>
                        )}

                        {selectedDocTab === 'vehicle_photo' && (
                          <div className="w-full max-w-[320px] rounded-xl overflow-hidden border border-white/10 bg-black/80 flex flex-col items-center justify-center p-2" style={{ aspectRatio: '1.586' }}>
                            {selectedDriverForDoc.vehiclePhoto ? (
                              <img src={selectedDriverForDoc.vehiclePhoto} alt="Vehicle Status" className="w-full h-full object-contain rounded-lg" />
                            ) : (
                              <div className="text-xs text-gray-500 py-8">⚠️ No Vehicle Photo Submitted</div>
                            )}
                          </div>
                        )}

                        {selectedDocTab === 'license' && (
                          <div className="w-full max-w-[320px] flex flex-col gap-2">
                            <div className="w-full h-32 bg-black/60 rounded border border-white/10 flex items-center justify-center overflow-hidden">
                              {selectedDriverForDoc.driverPhoto ? (
                                <img src={selectedDriverForDoc.driverPhoto} alt="DL snap" className="w-full h-full object-contain" />
                              ) : (
                                <span className="text-[10px] text-gray-500">No DL Snapshot Submitted</span>
                              )}
                            </div>
                            <div className="bg-black/20 p-2 rounded text-left">
                              <span className="text-[8px] text-gray-400 block">License Number:</span>
                              <span className="text-xs font-mono font-bold text-blue-400">{selectedDriverForDoc.documents?.license || 'N/A'}</span>
                            </div>
                            <div className="flex gap-2 justify-center mt-1">
                              <button 
                                onClick={() => verifyDriverDoc(selectedDriverForDoc.id, 'dl', true)}
                                className="px-3 py-1 text-[10px] bg-green-600 hover:bg-green-700 text-white font-bold rounded"
                              >
                                Approve DL
                              </button>
                              <button 
                                onClick={() => verifyDriverDoc(selectedDriverForDoc.id, 'dl', false)}
                                className="px-3 py-1 text-[10px] bg-red-600 hover:bg-red-700 text-white font-bold rounded"
                              >
                                Reject DL
                              </button>
                            </div>
                          </div>
                        )}

                        {selectedDocTab === 'aadhar' && (
                          <div className="w-full max-w-[320px] flex flex-col gap-2">
                            <div className="w-full h-32 bg-black/60 rounded border border-white/10 flex items-center justify-center overflow-hidden">
                              {selectedDriverForDoc.identityCardPhoto ? (
                                <img src={selectedDriverForDoc.identityCardPhoto} alt="Aadhaar snap" className="w-full h-full object-contain" />
                              ) : (
                                <span className="text-[10px] text-gray-500">No Aadhaar Snapshot Submitted</span>
                              )}
                            </div>
                            <div className="bg-black/20 p-2 rounded text-left">
                              <span className="text-[8px] text-gray-400 block">Aadhaar Card Number:</span>
                              <span className="text-xs font-mono font-bold text-green-400">{selectedDriverForDoc.documents?.aadhar || 'N/A'}</span>
                            </div>
                            <div className="flex gap-2 justify-center mt-1">
                              <button 
                                onClick={() => verifyDriverDoc(selectedDriverForDoc.id, 'identity', true)}
                                className="px-3 py-1 text-[10px] bg-green-600 hover:bg-green-700 text-white font-bold rounded"
                              >
                                Approve Aadhaar
                              </button>
                              <button 
                                onClick={() => verifyDriverDoc(selectedDriverForDoc.id, 'identity', false)}
                                className="px-3 py-1 text-[10px] bg-red-600 hover:bg-red-700 text-white font-bold rounded"
                              >
                                Reject Aadhaar
                              </button>
                            </div>
                          </div>
                        )}

                        {selectedDocTab === 'rc' && (
                          <div className="w-full max-w-[320px] flex flex-col gap-2">
                            <div className="w-full h-32 bg-black/60 rounded border border-white/10 flex items-center justify-center overflow-hidden">
                              {selectedDriverForDoc.vehiclePhoto ? (
                                <img src={selectedDriverForDoc.vehiclePhoto} alt="RC snap" className="w-full h-full object-contain" />
                              ) : (
                                <span className="text-[10px] text-gray-500">No RC Snapshot Submitted</span>
                              )}
                            </div>
                            <div className="bg-black/20 p-2 rounded text-left">
                              <span className="text-[8px] text-gray-400 block">RC Number:</span>
                              <span className="text-xs font-mono font-bold text-fuchsia-400">{selectedDriverForDoc.documents?.rc || 'N/A'}</span>
                            </div>
                            <div className="flex gap-2 justify-center mt-1">
                              <button 
                                onClick={() => verifyDriverDoc(selectedDriverForDoc.id, 'rc', true)}
                                className="px-3 py-1 text-[10px] bg-green-600 hover:bg-green-700 text-white font-bold rounded"
                              >
                                Approve RC
                              </button>
                              <button 
                                onClick={() => verifyDriverDoc(selectedDriverForDoc.id, 'rc', false)}
                                className="px-3 py-1 text-[10px] bg-red-600 hover:bg-red-700 text-white font-bold rounded"
                              >
                                Reject RC
                              </button>
                            </div>
                          </div>
                        )}

                        {selectedDocTab === 'insurance' && (
                          <div className="w-full max-w-[320px] flex flex-col gap-2">
                            <div className="w-full h-32 bg-black/60 rounded border border-white/10 flex items-center justify-center overflow-hidden">
                              {selectedDriverForDoc.vehicleInsurancePhoto ? (
                                <img src={selectedDriverForDoc.vehicleInsurancePhoto} alt="Insurance snap" className="w-full h-full object-contain" />
                              ) : (
                                <span className="text-[10px] text-gray-500">No Insurance Snapshot Submitted</span>
                              )}
                            </div>
                            <div className="flex gap-2 justify-center mt-1">
                              <button 
                                onClick={() => verifyDriverDoc(selectedDriverForDoc.id, 'insurance', true)}
                                className="px-3 py-1 text-[10px] bg-green-600 hover:bg-green-700 text-white font-bold rounded"
                              >
                                Approve Insurance
                              </button>
                              <button 
                                onClick={() => verifyDriverDoc(selectedDriverForDoc.id, 'insurance', false)}
                                className="px-3 py-1 text-[10px] bg-red-600 hover:bg-red-700 text-white font-bold rounded"
                              >
                                Reject Insurance
                              </button>
                            </div>
                          </div>
                        )}

                        {selectedDocTab === 'puc' && (
                          <div className="w-full max-w-[320px] flex flex-col gap-2">
                            <div className="w-full h-32 bg-black/60 rounded border border-white/10 flex items-center justify-center overflow-hidden">
                              {selectedDriverForDoc.vehiclePucPhoto ? (
                                <img src={selectedDriverForDoc.vehiclePucPhoto} alt="PUC snap" className="w-full h-full object-contain" />
                              ) : (
                                <span className="text-[10px] text-gray-500">No PUC Snapshot Submitted</span>
                              )}
                            </div>
                            <div className="flex gap-2 justify-center mt-1">
                              <button 
                                onClick={() => verifyDriverDoc(selectedDriverForDoc.id, 'puc', true)}
                                className="px-3 py-1 text-[10px] bg-green-600 hover:bg-green-700 text-white font-bold rounded"
                              >
                                Approve PUC
                              </button>
                              <button 
                                onClick={() => verifyDriverDoc(selectedDriverForDoc.id, 'puc', false)}
                                className="px-3 py-1 text-[10px] bg-red-600 hover:bg-red-700 text-white font-bold rounded"
                              >
                                Reject PUC
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Payout Bank & Demographic Details */}
                      <div className="bg-black/30 border border-white/5 rounded-lg p-3 text-xs text-left flex flex-col gap-2">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block border-b border-white/5 pb-1">Profile & Payout Banking Details</span>
                        <div className="grid grid-cols-2 gap-2 text-gray-300">
                          <div>
                            <span className="text-[9px] text-gray-500 block">Age:</span>
                            <span className="font-semibold text-white">{selectedDriverForDoc.age || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-gray-500 block">City:</span>
                            <span className="font-semibold text-white">{selectedDriverForDoc.city || 'N/A'}</span>
                          </div>
                          <div className="col-span-2 border-t border-white/5 pt-1 mt-1">
                            <span className="text-[9px] text-gray-500 block">Bank Account Holder:</span>
                            <span className="font-semibold text-white">{selectedDriverForDoc.bankDetails?.holderName || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-gray-500 block">Account Number:</span>
                            <span className="font-mono font-semibold text-white">{selectedDriverForDoc.bankDetails?.accountNumber || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-gray-500 block">IFSC Code:</span>
                            <span className="font-mono font-semibold text-yellow-400">{selectedDriverForDoc.bankDetails?.ifscCode || 'N/A'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Passenger Feedback Reviews */}
                      <div className="bg-black/30 border border-white/5 rounded-lg p-3 text-xs text-left flex flex-col gap-2 mt-3">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block border-b border-white/5 pb-1">
                          ⭐️ Customer Reviews ({driverReviews.length})
                        </span>
                        
                        {driverReviews.length === 0 ? (
                          <span className="text-[10px] text-gray-500 italic block py-1">No customer feedbacks registered for this driver yet.</span>
                        ) : (
                          <div className="max-h-[140px] overflow-y-auto flex flex-col gap-1.5 pr-1" style={{ overflowY: 'auto' }}>
                            {driverReviews.map((rev, idx) => (
                              <div key={idx} className="bg-black/40 border border-white/5 p-2 rounded flex flex-col gap-0.5">
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="text-yellow-400 font-bold">
                                    {Array.from({ length: rev.rating || 5 }).map((_, i) => "⭐")}
                                  </span>
                                  <span className="text-gray-500 text-[8px]">{new Date(rev.createdAt).toLocaleDateString()}</span>
                                </div>
                                <p className="text-[10px] text-gray-300 italic mt-0.5">
                                  "{rev.comment || 'Safe and comfortable journey'}"
                                </p>
                                <span className="text-[8px] text-gray-500 block text-right">
                                  {rev.pickupName} ➔ {rev.dropoffName}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="kyc-disclaimer mt-3 p-2 bg-amber-500/10 border border-amber-500/20 text-[10px] rounded text-amber-300">
                        🛡️ Approve individual document cards. Once all 5 are marked verified, the account will be automatically activated.
                      </div>
                    </div>

                    <div className="modal-footer-actions mt-4 flex gap-2">
                      <button 
                        className="btn-modal-reject flex-1 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 font-semibold rounded-lg text-xs transition-all cursor-pointer"
                        onClick={() => setSelectedDriverForDoc(null)}
                      >
                        Close KYC Inspector
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
                                {alert?.status?.replace('_', ' ') || ''}
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

                {/* AI DYNAMIC SURGE OPERATIONS DESK */}
                <div className="settings-card-group ai-surge-card mt-3" style={{ border: useAiSurgeEngine ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)', transition: 'all 0.3s ease' }}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🤖</span>
                      <h4 className="font-semibold text-white">AI Dynamic Surge Engine</h4>
                    </div>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={useAiSurgeEngine}
                        onChange={(e) => setUseAiSurgeEngine(e.target.checked)}
                        className="sr-only peer"
                        id="ai-surge-toggle"
                      />
                      <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                      <label htmlFor="ai-surge-toggle" className="ml-2 text-[10px] uppercase font-bold tracking-wider" style={{ color: useAiSurgeEngine ? '#10b981' : '#718096' }}>
                        {useAiSurgeEngine ? 'Active' : 'Offline'}
                      </label>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Continuously balances rider demand against available idle captains. Replaces manual peak demand inputs with dynamic regulation-compliant calculations.
                  </p>

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-800">
                    <div className="bg-gray-900/60 p-2 rounded border border-gray-800">
                      <div className="text-[9px] text-gray-500 uppercase tracking-wider">Simulated Demand</div>
                      <div className="text-sm font-semibold text-gray-200 mt-0.5">
                        {((activeRide && (activeRide.status === 'searching' || activeRide.status === 'requested') ? 1.5 : 0) + (demandHotspots.length > 0 ? demandHotspots.reduce((acc, h) => acc + (h.weight || 1), 0) * 0.35 : 0.6)).toFixed(2)} pts
                      </div>
                    </div>
                    <div className="bg-gray-900/60 p-2 rounded border border-gray-800">
                      <div className="text-[9px] text-gray-500 uppercase tracking-wider">Idle Captains (Supply)</div>
                      <div className="text-sm font-semibold text-gray-200 mt-0.5">
                        {drivers.filter(d => d.status === 'online' && d.verificationStatus === 'verified' && !(activeRide && activeRide.driverId === d.id && activeRide.status !== 'completed' && activeRide.status !== 'cancelled')).length} Online
                      </div>
                    </div>
                    <div className="bg-gray-900/60 p-2 rounded col-span-2 border border-gray-800 flex justify-between items-center">
                      <div>
                        <div className="text-[9px] text-gray-500 uppercase tracking-wider">Dynamic Multiplier</div>
                        <div className="text-xs text-gray-400">West Bengal cap: 1.50x</div>
                      </div>
                      <div className="text-xl font-bold font-monospace" style={{ color: useAiSurgeEngine ? '#f59e0b' : '#a0aec0' }}>
                        {dynamicSurgeMultiplier.toFixed(2)}x
                      </div>
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

                <div className="flex gap-4 mt-4">
                  <button type="submit" className="btn-primary flex-1 font-semibold">
                    Update Pricing Configuration
                  </button>
                  <button 
                    type="button" 
                    onClick={async () => {
                      if (window.confirm("⚠️ WARNING: This will terminate all active rides, truncate disputes/claims, reset all configuration adjustments, and wipe the session SMS logs. Are you sure you want to proceed?")) {
                        await resetSimulator();
                        alert("Simulator state reset completed successfully!");
                        window.location.reload();
                      }
                    }}
                    className="btn-secondary border border-red-500/30 bg-red-950/20 text-red-400 hover:bg-red-900 hover:text-white flex-1 font-semibold flex items-center justify-center cursor-pointer"
                  >
                    ⚡ Reset Simulator State
                  </button>
                </div>
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
              <div className="finance-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                <div className="kpi-card card-glow">
                  <span className="kpi-label">Gross Ride Bookings</span>
                  <span className="kpi-value text-green-400">₹{financials.grossBookings.toFixed(0)}</span>
                  <span className="kpi-sub text-gray-400">Total ride volumes</span>
                </div>

                <div className="kpi-card card-glow">
                  <span className="kpi-label">Platform commission</span>
                  <span className="kpi-value text-amber-500">₹{financials.platformCommissionTotal.toFixed(0)}</span>
                  <span className="kpi-sub text-gray-400">Accrued platform share</span>
                </div>

                <div className="kpi-card card-glow">
                  <span className="kpi-label">Premium Subscriptions</span>
                  <span className="kpi-value text-emerald-400">₹{financials.subscriptionEarnings.toFixed(0)}</span>
                  <span className="kpi-sub text-gray-400">Silver & Gold tiers</span>
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
                  <span className="kpi-sub text-gray-400">Net platform revenue</span>
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
                            className="rounded-t-sm transition-all duration-300"
                            style={{ 
                              width: '18px',
                              height: `${percentageHeight.toFixed(0)}px`,
                              background: isHovered 
                                ? 'linear-gradient(to top, #ff9c00, #ffdd00)' 
                                : 'linear-gradient(to top, rgba(255,221,0,0.4), rgba(255,221,0,0.95))',
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

              {/* Driver Subscription Tier Registry */}
              <div className="payouts-section card-glow mt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    👑 Premium Subscriptions Registry & MRR Ledger
                  </h4>
                  <div className="text-xs text-gray-400 font-mono">
                    MRR (Silver & Gold): <span className="text-emerald-400 font-bold">₹{((adminStats.silverCount || 0) * 299 + (adminStats.goldCount || 0) * 599).toLocaleString('en-IN')} / mo</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Overview of partner drivers registered on Gold (1.0% Commission, ₹599/mo) and Silver (2.5% Commission, ₹299/mo) subscription tiers.
                </p>

                <div className="payout-table-grid mt-3">
                  <div className="payout-header" style={{ gridTemplateColumns: '150px 140px 100px 140px 1fr' }}>
                    <span>Partner Name</span>
                    <span>Active Subscription Tier</span>
                    <span>Commission Cut</span>
                    <span>Billing Status</span>
                    <span>Estimated Renewal Date</span>
                  </div>

                  {drivers.map(d => {
                    const tier = d.subscription_tier || 'standard';
                    const isZeroComm = d.rating >= 4.8;
                    const commissionCut = isZeroComm ? '0.0% (Zero-Comm)' : (tier === 'gold' ? '1.0%' : (tier === 'silver' ? '2.5%' : '5.0%'));
                    const billingStatus = isZeroComm ? 'Waived (Reward)' : (tier === 'standard' ? 'N/A (Free)' : 'Active (Prepaid)');
                    const renewal = isZeroComm ? 'N/A (Zero-Comm)' : (tier === 'standard' ? 'N/A' : 'Auto-renewing (30d)');
                    return (
                      <div key={d.id} className="payout-row" style={{ gridTemplateColumns: '150px 140px 100px 140px 1fr' }}>
                        <span className="font-semibold text-white">
                          {d.name} {isZeroComm && '⚡'}
                        </span>
                        <span>
                          <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded ${
                            tier === 'gold' 
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                              : (tier === 'silver' ? 'bg-slate-400/10 text-slate-300 border border-slate-400/20' : 'bg-gray-800 text-gray-400')
                          }`}>
                            {tier.toUpperCase()}
                          </span>
                        </span>
                        <span className="font-mono text-xs text-emerald-400 font-bold">{commissionCut}</span>
                        <span className="text-xs text-gray-300">{billingStatus}</span>
                        <span className="text-xs text-gray-500">{renewal}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Driver Payout Breakdown Ledger */}
              <div className="payouts-section card-glow mt-4">
                <div className="flex justify-between items-center flex-wrap gap-2 mb-3">
                  <h4 style={{ margin: 0 }}>Driver Payout Breakdown Ledger (95% Base splits)</h4>
                  
                  {/* Search and Filters */}
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Search Driver Name / License..."
                      value={ledgerSearchText}
                      onChange={(e) => setLedgerSearchText(e.target.value)}
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        color: '#fff',
                        outline: 'none',
                        width: '200px'
                      }}
                    />
                    <select
                      value={ledgerVehicleFilter}
                      onChange={(e) => setLedgerVehicleFilter(e.target.value)}
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        color: '#fff',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="all">All Vehicles</option>
                      <option value="bike">Bike Taxi</option>
                      <option value="auto">Auto Rickshaw</option>
                      <option value="car_ac">AC Car</option>
                      <option value="car_non_ac">Non-AC Car</option>
                    </select>
                  </div>
                </div>
                
                <div className="payout-table-grid mt-3">
                  <div className="payout-header">
                    <span>Partner Name</span>
                    <span>License</span>
                    <span>Total Bookings</span>
                    <span>Commission (5%)</span>
                    <span>Net Weekly Owed</span>
                    <span>Action</span>
                  </div>

                  {(() => {
                    const filteredDrivers = drivers.filter(d => {
                      const matchesSearch = (d.name || '').toLowerCase().includes(ledgerSearchText.toLowerCase()) || 
                                            (d.documents?.license || '').toLowerCase().includes(ledgerSearchText.toLowerCase());
                      const matchesVehicle = ledgerVehicleFilter === 'all' || d.vehicleType === ledgerVehicleFilter;
                      return matchesSearch && matchesVehicle;
                    });

                    if (filteredDrivers.length === 0) {
                      return <div className="text-center py-6 text-xs text-gray-500 italic" style={{ gridColumn: 'span 6' }}>No matching driver payout records found.</div>;
                    }

                    return filteredDrivers.map(d => {
                      const isZeroComm = d.rating >= 4.8;
                      const commissionFee = isZeroComm ? 0 : d.earnings.commission;
                      const gross = d.earnings.weekly + d.earnings.commission;
                      const netOwed = isZeroComm ? gross : d.earnings.weekly;
                      return (
                        <div key={d.id} className="payout-row">
                          <span className="font-semibold text-white">
                            {d.name} {isZeroComm && '⚡'}
                          </span>
                          <span className="font-mono text-xs">{d.documents?.license || 'Not Onboarded'}</span>
                          <span>₹{gross.toFixed(0)}</span>
                          <span className="text-red-400">
                            {isZeroComm ? <span className="text-emerald-400 font-bold">₹0 (Zero-Comm)</span> : `₹${commissionFee.toFixed(0)}`}
                          </span>
                          <span className="text-green-400 font-semibold">₹{netOwed.toFixed(0)}</span>
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
                    });
                  })()}
                </div>
              </div>

            </div>
          )}

          {activeTab === 'promos' && (
            <div className="admin-tab-content animate-fade-in" style={{ gap: '16px', maxHeight: '100%', overflowY: 'auto', padding: '24px' }}>
              <div className="section-title-flex">
                <h3>Promo Campaign Builder</h3>
                <p className="text-gray-400 text-sm">Create and manage dynamic discount codes that synchronize instantly across passenger interfaces.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form to Add Promo */}
                <div className="lg:col-span-1 card-glow p-5 flex flex-col gap-4">
                  <h4 className="text-sm font-bold text-pink-400 uppercase tracking-wider">
                    🎉 Create New Campaign
                  </h4>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.target;
                    const code = form.code.value.trim().toUpperCase();
                    const discountValue = parseFloat(form.discountValue.value);
                    const weatherRestriction = form.weatherRestriction.value || null;

                    if (!code || isNaN(discountValue)) {
                      alert("Please fill out the code and discount fields.");
                      return;
                    }

                    try {
                      const res = await fetch('/api/promos', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code, discountValue, weatherRestriction })
                      });
                      const data = await res.json();
                      if (data.success) {
                        form.reset();
                        fetchInitialData(); // Sync context
                      } else {
                        alert("Error: " + (data.error || "Failed to create promo"));
                      }
                    } catch (err) {
                      console.error("Failed to post promo:", err);
                    }
                  }} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-gray-400 font-bold uppercase">Promo Coupon Code</label>
                      <input 
                        type="text" 
                        name="code" 
                        placeholder="e.g. MONSOON75" 
                        required
                        style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px', borderRadius: '6px', padding: '8px 10px', outline: 'none' }}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-gray-400 font-bold uppercase">Discount Amount (₹)</label>
                      <input 
                        type="number" 
                        name="discountValue" 
                        placeholder="e.g. 75" 
                        required
                        min="5"
                        max="500"
                        style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px', borderRadius: '6px', padding: '8px 10px', outline: 'none' }}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-gray-400 font-bold uppercase">Weather Restriction</label>
                      <select 
                        name="weatherRestriction"
                        style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px', borderRadius: '6px', padding: '8px 10px', outline: 'none' }}
                      >
                        <option value="">None (Available Always)</option>
                        <option value="rain">Monsoon/Rain Only</option>
                      </select>
                    </div>

                    <button 
                      type="submit" 
                      style={{ background: 'linear-gradient(135deg, #ec4899, #db2777)', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px' }}
                    >
                      Launch Campaign
                    </button>
                  </form>
                </div>

                {/* List of Active & Inactive Promos */}
                <div className="lg:col-span-2 card-glow p-5 flex flex-col gap-3">
                  <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider flex items-center justify-between">
                    <span>📜 Live Promo Code Records</span>
                    <span className="text-xs text-pink-400 font-mono">({promos.length} Campaign(s))</span>
                  </h4>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#888' }}>
                          <th style={{ padding: '8px' }}>CODE</th>
                          <th style={{ padding: '8px' }}>DISCOUNT</th>
                          <th style={{ padding: '8px' }}>RESTRICTIONS</th>
                          <th style={{ padding: '8px' }}>STATUS</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {promos.length === 0 ? (
                          <tr>
                            <td colSpan="5" style={{ padding: '16px', fontStyle: 'italic', textAlign: 'center', color: '#555' }}>
                              No promo campaigns constructed yet. Create one on the left panel!
                            </td>
                          </tr>
                        ) : (
                          promos.map(promo => (
                            <tr key={promo.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: '#ddd' }}>
                              <td style={{ padding: '8px', fontWeight: 'bold', fontFamily: 'monospace', color: '#fff' }}>{promo.code}</td>
                              <td style={{ padding: '8px', color: '#10b981', fontWeight: 'bold' }}>₹{promo.discountValue}</td>
                              <td style={{ padding: '8px' }}>
                                {promo.weatherRestriction ? (
                                  <span style={{ fontSize: '9px', backgroundColor: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59,130,246,0.2)' }}>
                                    🌧️ Rain Alert Only
                                  </span>
                                ) : (
                                  <span style={{ color: '#666' }}>None</span>
                                )}
                              </td>
                              <td style={{ padding: '8px' }}>
                                <span style={{ 
                                  fontSize: '9px', 
                                  backgroundColor: promo.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                                  color: promo.status === 'active' ? '#10b981' : '#ef4444',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  border: promo.status === 'active' ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)',
                                  fontWeight: 'bold'
                                }}>
                                  {promo.status.toUpperCase()}
                                </span>
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                  <button 
                                    onClick={async () => {
                                      try {
                                        const res = await fetch('/api/promos/toggle', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ id: promo.id })
                                        });
                                        if (res.ok) fetchInitialData();
                                      } catch (err) {
                                        console.error(err);
                                      }
                                    }}
                                    style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: '#ccc', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', cursor: 'pointer' }}
                                  >
                                    Toggle
                                  </button>
                                  <button 
                                    onClick={async () => {
                                      if (confirm(`Delete coupon code ${promo.code}?`)) {
                                        try {
                                          const res = await fetch(`/api/promos/${promo.id}`, { method: 'DELETE' });
                                          if (res.ok) fetchInitialData();
                                        } catch (err) {
                                          console.error(err);
                                        }
                                      }
                                    }}
                                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', cursor: 'pointer' }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'env' && (
            <EnvSettingsPanel fetchEnvKeys={fetchEnvKeys} updateEnvKeys={updateEnvKeys} />
          )}

          {activeTab === 'sms_logs' && (
            <div className="admin-tab-content animate-fade-in" style={{ gap: '16px', maxHeight: '100%', overflowY: 'auto', padding: '24px' }}>
              <div className="section-title-flex">
                <h3>SMS Gateway & Telemetry Logs</h3>
                <p className="text-gray-400 text-sm">Real-time tracking of OTP verifications, dispatch notifications, and panic alerts.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
                
                {/* LEFT: SMS Broadcast Composer Panel */}
                <div className="card-glow p-5 flex flex-col gap-4" style={{ alignSelf: 'start' }}>
                  <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wider flex items-center gap-2">
                    📢 SMS Broadcast Composer
                  </h4>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-500 font-bold uppercase">Target Recipients</label>
                    <select 
                      value={broadcastTarget} 
                      onChange={(e) => setBroadcastTarget(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none w-full cursor-pointer"
                    >
                      <option value="all">All Devices (all)</option>
                      <option value="passenger">Passengers Only</option>
                      <option value="driver">Drivers Only</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-500 font-bold uppercase">Alert Message Text</label>
                    <textarea 
                      rows={4}
                      placeholder="e.g. 🌧️ Monsoon alert: Heavy waterlogging expected in Kolkata. Travel safely."
                      value={broadcastMsgInput}
                      onChange={(e) => setBroadcastMsgInput(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded px-3 py-1.5 text-xs text-white outline-none w-full resize-none font-sans"
                      style={{ minHeight: '80px' }}
                    />
                    <div className="text-[9px] text-gray-500 text-right mt-1 font-mono">
                      Length: {broadcastMsgInput.length} chars
                    </div>
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
                      
                      // Refresh logs list from backend
                      try {
                        const { api } = getServerEndpoints();
                        const smsRes = await fetch(`${api}/api/admin/sms-logs`);
                        const smsData = await smsRes.json();
                        if (smsData.success && Array.isArray(smsData.logs)) {
                          setSmsLogs(smsData.logs);
                        }
                      } catch (err) {
                        console.error(err);
                      }
                      
                      setTimeout(() => setBroadcastStatus(''), 4000);
                    }}
                    className="bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded text-xs uppercase tracking-wide transition-all w-full cursor-pointer border-none"
                  >
                    Send Broadcast SMS
                  </button>

                  {broadcastStatus && (
                    <span className="text-[10px] text-green-400 animate-pulse font-semibold text-center mt-1">
                      {broadcastStatus}
                    </span>
                  )}

                  <div className="flex flex-col gap-2 mt-2">
                    <span className="text-[10px] text-gray-500 font-bold uppercase">Quick Preset Templates</span>
                    <div className="flex flex-col gap-1.5">
                      {[
                        { label: '🌧️ Heavy Rain Flood Alert', text: '🌧️ Heavy rains & flooding reported in Salt Lake. Travel carefully.' },
                        { label: '🚧 Howrah Bridge Closure', text: '🚧 Howrah Bridge closed temporarily due to congestion checks.' },
                        { label: '⚡ Promo surcharge active', text: '⚡ Surcharge active! Apply code JOLDISURGE for 15% off next ride.' }
                      ].map((preset, i) => (
                        <button 
                          key={i}
                          type="button"
                          onClick={() => setBroadcastMsgInput(preset.text)}
                          className="text-[9px] text-left bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 px-3 py-2 rounded transition-all cursor-pointer truncate"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* RIGHT: SMS Telemetry Records Logs List */}
                <div className="card-glow p-5" style={{ alignSelf: 'start' }}>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wider flex items-center gap-2">
                      💬 Live SMS Gateway Logs ({smsLogs.length} Active Records)
                    </h4>
                    <div className="flex items-center gap-2">
                      {smsLogs.length > 0 && (
                        <>
                          <button 
                            onClick={exportSmsJson}
                            className="bg-[#1e1b4b] text-[#c7d2fe] hover:bg-[#312e81] border border-[#4338ca]/30 px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-all"
                          >
                            📄 Export JSON
                          </button>
                          <button 
                            onClick={exportSmsCsv}
                            className="bg-[#451a03] text-[#fef3c7] hover:bg-[#78350f] border border-[#b45309]/30 px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-all"
                          >
                            📊 Export CSV
                          </button>
                        </>
                      )}
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
                        🟢 SIMULATED TWILIO GATEWAY: ONLINE
                      </span>
                    </div>
                  </div>

                  {smsLogs.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 italic text-xs">
                      No SMS dispatches registered in this session. Book a ride or request an OTP to trigger gateway payloads.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '480px', overflowY: 'auto' }} className="custom-scrollbar">
                      {smsLogs.map(log => (
                        <div 
                          key={log.id} 
                          className="p-3 bg-black/25 rounded-lg border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                        >
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <span className="font-mono text-[10px] text-indigo-400 font-bold bg-indigo-950 px-2 py-0.5 rounded">
                              {log.sender}
                            </span>
                            <span className="text-gray-300">{log.message}</span>
                          </div>
                          <span className="font-mono text-[10px] text-gray-500 whitespace-nowrap">
                            {log.timestamp}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
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
              <div className="kpi-row">
                <div className="kpi-card card-glow" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span className="kpi-label">Fleet Carbon Offset</span>
                  <span className="kpi-value text-emerald-400" style={{ fontSize: '20px' }}>248.5 kg</span>
                  <span className="text-[9px] text-gray-400 mt-1">CO₂ offset by active JoldiGo Bike bookings</span>
                </div>
                <div className="kpi-card card-glow" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span className="kpi-label">Avg Commuter Wait</span>
                  <span className="kpi-value text-amber-500" style={{ fontSize: '20px' }}>4.2 mins</span>
                  <span className="text-[9px] text-gray-400 mt-1">Match-to-pickup elapsed duration</span>
                </div>
                <div className="kpi-card card-glow" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span className="kpi-label">SLA Completion Rate</span>
                  <span className="kpi-value text-blue-400" style={{ fontSize: '20px' }}>96.8%</span>
                  <span className="text-[9px] text-gray-400 mt-1">Trips completed without rider dispute</span>
                </div>
                <div className="kpi-card card-glow" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span className="kpi-label">Total Platform Rides</span>
                  <span className="kpi-value text-purple-400" style={{ fontSize: '20px' }}>1,482</span>
                  <span className="text-[9px] text-gray-400 mt-1">Historical database transactions</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                
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
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 10, width: '45px' }}>
                        <div style={{ width: '100%', display: 'flex', gap: '4px', alignItems: 'end', height: '160px', backgroundColor: 'rgba(0,0,0,0.3)', borderTopLeftRadius: '4px', borderTopRightRadius: '4px', overflow: 'hidden', padding: '0 2px' }}>
                          {/* Completion bar */}
                          <div 
                            style={{ height: `${day.completion}%`, flex: 1, background: 'linear-gradient(to top, #059669, #34d399)', borderTopLeftRadius: '2px', borderTopRightRadius: '2px' }}
                            title={`Completed: ${day.completion}%`}
                          ></div>
                          {/* Dispute bar */}
                          <div 
                            style={{ height: `${day.dispute * 5}%`, width: '8px', background: 'linear-gradient(to top, #dc2626, #f87171)', borderTopLeftRadius: '2px', borderTopRightRadius: '2px' }}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '8px' }}>
                
                {/* SVG Line Chart: Platform Commission Earnings */}
                <div className="card-glow p-5" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                <div className="card-glow p-5" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                <div className="card-glow p-5" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

              {/* TOP PARTNERS LEADERBOARD */}
              <div className="card-glow p-5 mt-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-wide text-amber-500">🏆 JoldiGo Top Partners Leaderboard</h4>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">Real-time driver ratings, compliance metrics, and subscription contributions.</p>
                  </div>
                  <span className="text-[10px] text-amber-400 font-mono bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/20 font-bold">
                    Updated live
                  </span>
                </div>

                {(() => {
                  const sortedDrivers = [...drivers].sort((a, b) => {
                    if (b.rating !== a.rating) return b.rating - a.rating;
                    const aRides = Math.round((a.id * 7 + 12) % 35) + 15;
                    const bRides = Math.round((b.id * 7 + 12) % 35) + 15;
                    return bRides - aRides;
                  });

                  return (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 text-gray-500 text-[10px] uppercase tracking-wider">
                            <th className="py-2 px-3">Rank</th>
                            <th className="py-2 px-3">Partner</th>
                            <th className="py-2 px-3">Category</th>
                            <th className="py-2 px-3">Customer Rating</th>
                            <th className="py-2 px-3">Est. Weekly Trips</th>
                            <th className="py-2 px-3">Est. Weekly Revenue</th>
                            <th className="py-2 px-3 text-right">Subscription Tier</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedDrivers.slice(0, 5).map((drv, idx) => {
                            const rides = Math.round((drv.id * 7 + 12) % 35) + 15;
                            const rankLabel = idx === 0 ? '🥇 1st' : (idx === 1 ? '🥈 2nd' : (idx === 2 ? '🥉 3rd' : `${idx + 1}th`));
                            return (
                              <tr key={drv.id} className="border-b border-white/5 hover:bg-white/5 transition-all">
                                <td className="py-2.5 px-3 font-bold text-amber-400">{rankLabel}</td>
                                <td className="py-2.5 px-3 font-semibold text-white">
                                  {drv.name} {drv.rating >= 4.8 && <span className="ml-1 text-[8px] bg-emerald-500 text-black px-1 rounded font-extrabold uppercase">Zero-Comm</span>}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[10px] text-gray-400">
                                  {drv.vehicleType === 'car_ac' ? 'AC Car' : (drv.vehicleType === 'car_non_ac' ? 'Non-AC Car' : 'Bike')}
                                </td>
                                <td className="py-2.5 px-3 text-emerald-400 font-bold">⭐️ {drv.rating.toFixed(1)} / 5.0</td>
                                <td className="py-2.5 px-3 text-gray-300 font-mono">{rides} rides</td>
                                <td className="py-2.5 px-3 text-emerald-400 font-mono">₹{(rides * 135).toFixed(0)}</td>
                                <td className="py-2.5 px-3 text-right">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                    drv.subscriptionTier === 'gold' 
                                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' 
                                      : (drv.subscriptionTier === 'silver' 
                                        ? 'bg-slate-300/20 text-slate-200 border border-slate-300/30' 
                                        : 'bg-black/40 text-gray-500 border border-white/5')
                                  }`}>
                                    {drv.subscriptionTier.toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
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
    razorpayKeySecret: '',
    googleMapsKeyWeb: '',
    googleMapsKeyAndroid: '',
    googleMapsKeyIos: '',
    pricingEngineUrl: '',
    pricingEngineApiKey: ''
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

          <div className="border-t border-white/5 my-3 pt-3">
            <h4 className="text-[10px] uppercase tracking-wider text-yellow-400 font-extrabold mb-3">Google Maps API Credentials</h4>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] uppercase tracking-wider text-gray-500 font-extrabold">Google Maps Web API Key</label>
                <input 
                  type="password" 
                  name="googleMapsKeyWeb" 
                  value={keys.googleMapsKeyWeb} 
                  onChange={handleChange}
                  placeholder="••••••••••••••••••••••••••••••••"
                  className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-yellow-400"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] uppercase tracking-wider text-gray-500 font-extrabold">Google Maps Android API Key</label>
                  <input 
                    type="password" 
                    name="googleMapsKeyAndroid" 
                    value={keys.googleMapsKeyAndroid} 
                    onChange={handleChange}
                    placeholder="••••••••••••••••••••••••••••••••"
                    className="bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] uppercase tracking-wider text-gray-500 font-extrabold">Google Maps iOS API Key</label>
                  <input 
                    type="password" 
                    name="googleMapsKeyIos" 
                    value={keys.googleMapsKeyIos} 
                    onChange={handleChange}
                    placeholder="••••••••••••••••••••••••••••••••"
                    className="bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 my-3 pt-3">
            <h4 className="text-[10px] uppercase tracking-wider text-yellow-400 font-extrabold mb-3">Fare & Surge Pricing Engine</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] uppercase tracking-wider text-gray-500 font-extrabold">External Pricing API Endpoint URL</label>
                <input 
                  type="text" 
                  name="pricingEngineUrl" 
                  value={keys.pricingEngineUrl} 
                  onChange={handleChange}
                  placeholder="https://api.jaldigo.com/v1/pricing"
                  className="bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-yellow-400"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] uppercase tracking-wider text-gray-500 font-extrabold">Pricing Engine API Access Key</label>
                <input 
                  type="password" 
                  name="pricingEngineApiKey" 
                  value={keys.pricingEngineApiKey} 
                  onChange={handleChange}
                  placeholder="••••••••••••••••••••••••••••••••"
                  className="bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-yellow-400"
                />
              </div>
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
