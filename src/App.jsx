import React, { useState } from 'react';
import { SimulatorProvider } from './context/SimulatorContext';
import PassengerApp from './components/PassengerApp';
import DriverApp from './components/DriverApp';
import AdminPanel from './components/AdminPanel';
import { LayoutGrid, Smartphone, Monitor, ShieldCheck, Cpu } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState('split'); // 'split', 'passenger', 'driver', 'admin'

  return (
    <SimulatorProvider>
      <ErrorBoundary>
        <div className="cockpit-root">
          {/* Cockpit Global Header */}
          <header className="cockpit-global-header">
            <div className="cockpit-brand">
              <div className="cockpit-icon-wrapper">
                <Cpu size={20} className="cockpit-icon" />
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
            </div>

            {/* Connection Status Badge */}
            <div className="cockpit-status-badge">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Simulator Engine Active</span>
            </div>
          </header>

          {/* Cockpit View Area */}
          <main className={`cockpit-main-view mode-${viewMode}`}>
            
            {/* Passenger App Mobile Frame - Unique Key added */}
            {(viewMode === 'split' || viewMode === 'passenger') && (
              <div className="simulator-phone-wrapper" key="passenger-view">
                <div className="simulator-title-tag">📱 Passenger Client App</div>
                <PassengerApp />
              </div>
            )}

            {/* Driver App Mobile Frame - Unique Key added */}
            {(viewMode === 'split' || viewMode === 'driver') && (
              <div className="simulator-phone-wrapper" key="driver-view">
                <div className="simulator-title-tag">🚗 Driver Partner App</div>
                <DriverApp />
              </div>
            )}

            {/* Central Admin Panel Desktop Frame - Unique Key added */}
            {(viewMode === 'split' || viewMode === 'admin') && (
              <div className="simulator-desktop-wrapper" key="admin-view">
                <div className="simulator-title-tag">🖥️ Central Operations Admin (admin.joldigo.in)</div>
                <AdminPanel />
              </div>
            )}

          </main>
        </div>
      </ErrorBoundary>
    </SimulatorProvider>
  );
}

export default App;
