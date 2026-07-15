import React, { useState } from 'react';
import { SimulatorProvider } from './context/SimulatorContext';
import PassengerApp from './components/PassengerApp';
import DriverApp from './components/DriverApp';
import AdminPanel from './components/AdminPanel';
import MobileBuilder from './components/MobileBuilder';
import { LayoutGrid, Smartphone, Monitor, ShieldCheck, Cpu, Car, User, RefreshCw } from 'lucide-react';
import './index.css';

// React Error Boundary to catch and display runtime render crashes
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: 32, 
          background: '#0c0e12', 
          color: '#ff3333', 
          fontFamily: 'monospace', 
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          <div style={{ maxWidth: 640, background: '#11141a', padding: 24, borderRadius: 12, border: '1px solid #ff3333' }}>
            <h2 style={{ color: '#ff3333', marginBottom: 12 }}>⚠️ JoldiGo Cockpit Error</h2>
            <p style={{ color: '#a0aec0', fontSize: 13, marginBottom: 16 }}>
              A client-side rendering exception has occurred. You can review the details below:
            </p>
            <pre style={{ 
              whiteSpace: 'pre-wrap', 
              color: '#ffaa00', 
              background: '#000', 
              padding: 12, 
              borderRadius: 6, 
              fontSize: 12,
              textAlign: 'left',
              overflowX: 'auto',
              maxHeight: 250
            }}>{this.state.error?.toString()}</pre>
            <button 
              onClick={() => window.location.reload()} 
              style={{ 
                marginTop: 20, 
                padding: '10px 24px', 
                background: '#ffdd00', 
                color: '#000', 
                border: 'none', 
                borderRadius: 6, 
                fontWeight: 'bold', 
                cursor: 'pointer' 
              }}
            >
              Reload Simulator
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showNativeSelector, setShowNativeSelector] = useState(false);
  const [showDevMenu, setShowDevMenu] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        let saved = localStorage.getItem('joldigo_server_url');
        if (saved) {
          return saved;
        }
      } catch (e) {}
      const isCapacitor = !!window.Capacitor;
      if (!isCapacitor && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        return 'http://localhost:5001';
      }
    }
    return 'https://joldigo-backend.onrender.com';
  });

  const [viewMode, setViewMode] = useState('split');

  // Detect standalone app overrides based on URL query parameters or Capacitor native app detection
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!!window.Capacitor) {
        alert("✨ JoldiGo native app starting... isNative: true");
      }
      const params = new URLSearchParams(window.location.search);
      const appLock = params.get('app');

      // Check if running inside Capacitor native webview
      const isNative = !!window.Capacitor;

      const path = window.location.pathname.replace(/^\/|\/$/g, '');

      if (appLock === 'simulator' || appLock === 'cockpit' || appLock === 'demo' || 
          path === 'simulator' || path === 'cockpit' || path === 'demo') {
        setIsStandalone(false);
        const mobile = window.innerWidth < 768;
        setIsMobile(mobile);
        if (mobile) {
          setViewMode('passenger');
        } else {
          setViewMode('split');
        }
      } else if (appLock && ['passenger', 'driver', 'admin'].includes(appLock)) {
        setIsStandalone(true);
        setViewMode(appLock);
      } else if (['passenger', 'driver', 'admin'].includes(path)) {
        setIsStandalone(true);
        setViewMode(path);
      } else if (isNative) {
        // If native, check if app persona is locked in localStorage
        let savedMode = null;
        try {
          savedMode = localStorage.getItem('joldigo_app_mode');
        } catch (e) {}
        if (savedMode && ['passenger', 'driver', 'admin'].includes(savedMode)) {
          setIsStandalone(true);
          setViewMode(savedMode);
        } else {
          // First-boot on native device: show launcher persona selector
          setShowNativeSelector(true);
        }
      } else {
        // Production Homepage Default: Show standalone Passenger app
        setIsStandalone(true);
        setViewMode('passenger');
      }
    }
  }, []);

  // Track window resizing only when NOT locked in standalone mode
  React.useEffect(() => {
    if (isStandalone) return;
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && viewMode === 'split') {
        setViewMode('passenger');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewMode, isStandalone]);

  const selectNativePersona = (mode) => {
    try {
      localStorage.setItem('joldigo_app_mode', mode);
      localStorage.setItem('joldigo_server_url', serverUrlInput);
    } catch (e) {}
    setIsStandalone(true);
    setViewMode(mode);
    setShowNativeSelector(false);
  };

  const resetNativePersona = () => {
    try {
      localStorage.removeItem('joldigo_app_mode');
    } catch (e) {}
    window.location.reload();
  };

  // Render first-boot native app welcome persona selector
  if (showNativeSelector) {
    return (
      <div className="native-selector-root">
        <div className="native-selector-container">
          <div className="native-selector-header">
            <div className="native-logo">
              <img src="/logo.jpg" alt="JaldiGo Logo" style={{ width: '56px', height: '56px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 14px rgba(16,185,129,0.2)' }} />
            </div>
            <h1>JoldiGo Platform</h1>
            <p>Select your native application persona to lock this device's workspace.</p>
          </div>

          <div className="native-server-config">
            <label className="config-label">Server Connection URL</label>
            <input 
              type="text" 
              className="config-input"
              value={serverUrlInput} 
              onChange={(e) => setServerUrlInput(e.target.value)} 
              placeholder="e.g. http://192.168.1.100:5000 or https://tunnel.loca.lt" 
            />
          </div>

          <div className="native-selector-options">
            <button 
              className="native-selector-card passenger-card"
              onClick={() => selectNativePersona('passenger')}
            >
              <div className="card-icon-wrapper">
                <User size={28} />
              </div>
              <div className="card-details">
                <h3>Passenger Client App</h3>
                <p>Book rides, make payments, receive real-time SMS OTPs, and travel safely across the city.</p>
              </div>
            </button>
 
            <button 
              className="native-selector-card driver-card"
              onClick={() => selectNativePersona('driver')}
            >
              <div className="card-icon-wrapper">
                <Car size={28} />
              </div>
              <div className="card-details">
                <h3>Driver Partner App</h3>
                <p>Verify KYC documents, track ride offers, manage your wallet earnings, and complete safety training modules.</p>
              </div>
            </button>
          </div>

          <div className="native-selector-footer">
            <p>You can clear your selection anytime by reinstalling or clearing app storage data.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SimulatorProvider>
      <ErrorBoundary>
        <div className={`cockpit-root ${isStandalone ? 'standalone-app' : ''}`}>
          {/* Cockpit Global Header (hidden in Standalone Mode) */}
          {!isStandalone && (
            <header className="cockpit-global-header">
              <div className="cockpit-brand">
                <div className="cockpit-icon-wrapper">
                  <img src="/logo.jpg" alt="JaldiGo Logo" style={{ width: '24px', height: '24px', borderRadius: '6px' }} />
                </div>
                <div>
                  <h2>JoldiGo Cockpit Simulator</h2>
                  <p>Real-time Ride-Hailing Testing & Operations Environment</p>
                </div>
              </div>

              {/* View Mode Selectors */}
              <div className="cockpit-view-selectors">
                <button 
                  className={`view-btn ${viewMode === 'split' ? 'active' : ''}`}
                  onClick={() => setViewMode('split')}
                  title="Show Passenger, Driver, and Admin side-by-side"
                >
                  <LayoutGrid size={16} />
                  <span>Unified Simulator</span>
                </button>

                <button 
                  className={`view-btn ${viewMode === 'passenger' ? 'active' : ''}`}
                  onClick={() => setViewMode('passenger')}
                  title="Focus Passenger App"
                >
                  <Smartphone size={16} />
                  <span>Passenger App</span>
                </button>

                <button 
                  className={`view-btn ${viewMode === 'driver' ? 'active' : ''}`}
                  onClick={() => setViewMode('driver')}
                  title="Focus Driver App"
                >
                  <Smartphone size={16} />
                  <span>Driver App</span>
                </button>

                <button 
                  className={`view-btn ${viewMode === 'admin' ? 'active' : ''}`}
                  onClick={() => setViewMode('admin')}
                  title="Focus Admin Panel Dashboard"
                >
                  <Monitor size={16} />
                  <span>Admin Panel</span>
                </button>

                <button 
                  className={`view-btn ${viewMode === 'native-builder' ? 'active' : ''}`}
                  onClick={() => setViewMode('native-builder')}
                  title="Mobile App Builder & Compiler Console"
                >
                  <Smartphone size={16} />
                  <span>Mobile Builder</span>
                </button>
              </div>

              {/* Connection Status Badge & Server Config */}
              <div className="cockpit-status-badge">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span style={{ marginRight: '4px' }}>Active Server:</span>
                <input 
                  type="text" 
                  className="cockpit-server-input"
                  value={serverUrlInput} 
                  onChange={(e) => {
                    setServerUrlInput(e.target.value);
                    try {
                      localStorage.setItem('joldigo_server_url', e.target.value);
                    } catch (err) {}
                  }} 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      window.location.reload();
                    }
                  }}
                  onBlur={() => {
                    // Automatically reload and apply if changed
                    let saved = '';
                    try {
                      saved = localStorage.getItem('joldigo_server_url') || '';
                    } catch (err) {}
                    if (saved.trim() !== '') {
                      window.location.reload();
                    }
                  }}
                  placeholder="http://localhost:5001"
                  title="Backend Server Endpoint URL (e.g. https://joldigo.onrender.com). Press Enter or click away to apply."
                />
              </div>
            </header>
          )}

          {/* Cockpit View Area */}
          <main className={`cockpit-main-view mode-${viewMode} ${isStandalone ? 'standalone-main' : ''}`}>
            
            {/* Passenger App Mobile Frame - Unique Key added */}
            {(viewMode === 'split' || viewMode === 'passenger') && (
              <div className={isStandalone ? "standalone-viewport" : "simulator-phone-wrapper"} key="passenger-view">
                {!isStandalone && <div className="simulator-title-tag">📱 Passenger Client App</div>}
                <PassengerApp isStandalone={isStandalone} />
              </div>
            )}

            {/* Driver App Mobile Frame - Unique Key added */}
            {(viewMode === 'split' || viewMode === 'driver') && (
              <div className={isStandalone ? "standalone-viewport" : "simulator-phone-wrapper"} key="driver-view">
                {!isStandalone && <div className="simulator-title-tag">🚗 Driver Partner App</div>}
                <DriverApp isStandalone={isStandalone} />
              </div>
            )}

            {/* Central Admin Panel Desktop Frame - Unique Key added */}
            {(viewMode === 'split' || viewMode === 'admin') && (
              <div className={isStandalone ? "standalone-viewport-admin" : "simulator-desktop-wrapper"} key="admin-view">
                {!isStandalone && <div className="simulator-title-tag">🖥️ Central Operations Admin (admin.joldigo.in)</div>}
                <AdminPanel />
              </div>
            )}

            {viewMode === 'native-builder' && (
              <div className="simulator-desktop-wrapper" key="builder-view">
                {!isStandalone && <div className="simulator-title-tag">🛠️ Native Mobile App Builder</div>}
                <MobileBuilder />
              </div>
            )}

          </main>

          {/* Floating Reset Button for testing in Standalone Mode on physical devices */}
          {isStandalone && !!window.Capacitor && (
            <button 
              onClick={resetNativePersona}
              style={{
                position: 'fixed',
                bottom: '16px',
                right: '16px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(15,17,21,0.85)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#718096',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 99999,
                cursor: 'pointer'
              }}
              title="Reset Persona"
            >
              <RefreshCw size={12} />
            </button>
          )}

          {/* Floating Developer Menu (only on web browser, not inside native app wrapper) */}
          {!window.Capacitor && (
            <div style={{ position: 'fixed', bottom: '16px', left: '16px', zIndex: 999999 }}>
              <button
                onClick={() => setShowDevMenu(!showDevMenu)}
                style={{
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '8px 16px',
                  fontSize: '11px',
                  fontWeight: '900',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🛠️ Dev Menu
              </button>
              
              {showDevMenu && (
                <div style={{
                  position: 'absolute',
                  bottom: '40px',
                  left: '0',
                  backgroundColor: '#11141a',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '8px',
                  width: '180px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                }}>
                  <button
                    onClick={() => {
                      setIsStandalone(false);
                      setViewMode('split');
                      setShowDevMenu(false);
                    }}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#e2e8f0',
                      padding: '8px',
                      borderRadius: '6px',
                      textAlign: 'left',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: '700'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                    onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    🖥️ Cockpit Simulator
                  </button>
                  <button
                    onClick={() => {
                      setIsStandalone(true);
                      setViewMode('passenger');
                      setShowDevMenu(false);
                    }}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#e2e8f0',
                      padding: '8px',
                      borderRadius: '6px',
                      textAlign: 'left',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: '700'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                    onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    📱 Passenger App
                  </button>
                  <button
                    onClick={() => {
                      setIsStandalone(true);
                      setViewMode('driver');
                      setShowDevMenu(false);
                    }}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#e2e8f0',
                      padding: '8px',
                      borderRadius: '6px',
                      textAlign: 'left',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: '700'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                    onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    🚗 Driver App
                  </button>
                  <button
                    onClick={() => {
                      setIsStandalone(true);
                      setViewMode('admin');
                      setShowDevMenu(false);
                    }}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#e2e8f0',
                      padding: '8px',
                      borderRadius: '6px',
                      textAlign: 'left',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: '700'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                    onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    💼 Admin Panel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Floating native-style bottom navigation bar on mobile (hidden in Standalone Mode) */}
          {isMobile && !isStandalone && (
            <div className="mobile-bottom-nav">
              <button 
                className={`mobile-bottom-nav-btn ${viewMode === 'passenger' ? 'active' : ''}`}
                onClick={() => setViewMode('passenger')}
              >
                <Smartphone size={18} />
                <span>Passenger App</span>
              </button>
              <button 
                className={`mobile-bottom-nav-btn ${viewMode === 'driver' ? 'active' : ''}`}
                onClick={() => setViewMode('driver')}
              >
                <Smartphone size={18} />
                <span>Driver App</span>
              </button>
              <button 
                className={`mobile-bottom-nav-btn ${viewMode === 'admin' ? 'active' : ''}`}
                onClick={() => setViewMode('admin')}
              >
                <Monitor size={18} />
                <span>Admin Operations</span>
              </button>
            </div>
          )}
        </div>
      </ErrorBoundary>
    </SimulatorProvider>
  );
}

export default App;
