import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, Cpu, ShieldCheck, Terminal, Download, Play, CheckCircle, RefreshCw } from 'lucide-react';

export default function MobileBuilder() {
  const [platform, setPlatform] = useState('android'); // 'android', 'ios'
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileProgress, setCompileProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [buildComplete, setBuildComplete] = useState(false);
  const consoleEndRef = useRef(null);

  const mockLogs = {
    android: [
      "🔄 Initializing Android Build Pipeline...",
      "⚙️ Fetching system environment keys...",
      "📦 Running production packaging: vite build...",
      "✓ vite build completed. 79 modules transformed.",
      "🚀 Executing Capacitor Asset Sync: npx cap sync android...",
      "📂 Copying assets from dist/ to android/app/src/main/assets/public...",
      "🔗 Integrating Capacitor Android plugins: @capacitor/core, @capacitor/android...",
      "☕ Compiling native Gradle tasks: ./gradlew assembleDebug...",
      "🔧 Resolving Android SDK references: Target SDK 34...",
      "✨ Building java sources and resource files...",
      "🔑 Signing APK with mock developer keystore...",
      "✅ Build successful! APK compiled: app-debug.apk (12.4 MB)"
    ],
    ios: [
      "🔄 Initializing iOS Build Pipeline...",
      "⚙️ Fetching system environment keys...",
      "📦 Running production packaging: vite build...",
      "✓ vite build completed. 79 modules transformed.",
      "🚀 Executing Capacitor Asset Sync: npx cap sync ios...",
      "📂 Copying assets from dist/ to ios/App/App/public...",
      "🔗 Integrating CocoaPods dependencies...",
      "🔨 Updating Podfile lock definitions...",
      "🍏 Launching Xcode Build runner: xcodebuild archive...",
      "🛠️ Compiling Swift components & bridging headers...",
      "🔑 Attaching ad-hoc development certificate...",
      "✅ Build successful! iOS App Bundle compiled: JoldiGo.app (18.6 MB)"
    ]
  };

  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleStartCompile = () => {
    setIsCompiling(true);
    setBuildComplete(false);
    setCompileProgress(0);
    setLogs([]);

    let step = 0;
    const lines = mockLogs[platform];
    const totalSteps = lines.length;

    const interval = setInterval(() => {
      if (step < totalSteps) {
        setLogs(prev => [...prev, lines[step]]);
        setCompileProgress(Math.min(98, Math.round(((step + 1) / totalSteps) * 100)));
        step++;
      } else {
        clearInterval(interval);
        setCompileProgress(100);
        setIsCompiling(false);
        setBuildComplete(true);
      }
    }, 800);
  };

  return (
    <div className="admin-tab-content animate-fade-in text-left" style={{ gap: '16px', maxHeight: '100%', overflowY: 'auto', padding: '24px', fontFamily: 'Outfit, sans-serif' }}>
      
      {/* Header */}
      <div className="section-title-flex text-left">
        <div className="flex items-center gap-2 text-left">
          <Smartphone className="text-amber-500" size={24} />
          <h3 style={{ margin: 0, color: '#fff' }}>Native Mobile App Builder Console</h3>
        </div>
        <p className="text-gray-400 text-sm mt-1">Simulate native Android/iOS compilation pipelines and inspect local developer instructions.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginTop: '12px' }}>
        
        {/* Compiler Simulator Card */}
        <div className="card-glow p-5 text-left" style={{ backgroundColor: 'rgba(16,20,27,0.8)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px' }}>
          <h4 className="text-white font-bold text-sm mb-3">🛠️ Compiler Pipeline Simulator</h4>
          
          {/* Platform selector */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => !isCompiling && setPlatform('android')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                platform === 'android' 
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
              }`}
              disabled={isCompiling}
            >
              🤖 Android Package (.APK)
            </button>
            <button
              onClick={() => !isCompiling && setPlatform('ios')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                platform === 'ios' 
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' 
                  : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'
              }`}
              disabled={isCompiling}
            >
              🍏 iOS App Bundle (.APP)
            </button>
          </div>

          {/* Trigger button */}
          <button
            onClick={handleStartCompile}
            disabled={isCompiling}
            className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-bold text-xs rounded-lg cursor-pointer transition-all hover:scale-[1.01] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCompiling ? <RefreshCw className="animate-spin" size={14} /> : <Play size={14} fill="#000" />}
            {isCompiling ? "Compiling Assets..." : `Build ${platform === 'android' ? 'Android APK' : 'iOS Bundle'}`}
          </button>

          {/* Progress bar */}
          {(isCompiling || buildComplete) && (
            <div style={{ marginTop: '16px' }}>
              <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-mono">
                <span>Progress: {compileProgress}%</span>
                <span>{buildComplete ? 'Finished' : 'Running Tasks...'}</span>
              </div>
              <div style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${compileProgress}%`, height: '100%', backgroundColor: buildComplete ? '#10b981' : '#f59e0b', transition: 'width 0.3s ease-out' }}></div>
              </div>
            </div>
          )}

          {/* Output log console */}
          <div style={{ marginTop: '16px', backgroundColor: '#090d13', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '12px', height: '180px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '9px', color: '#a0aec0' }}>
            <div className="text-[8px] text-gray-600 border-b border-white/5 pb-1 mb-2 uppercase tracking-widest flex justify-between">
              <span>SYSTEM BUILD CONSOLE</span>
              <span className="text-emerald-500 font-bold">online</span>
            </div>
            {logs.length === 0 && (
              <div className="text-gray-600 italic mt-8 text-center">Press compile to view real-time log outputs...</div>
            )}
            {logs.map((log, idx) => {
              const isSuccess = log && typeof log === 'string' && (log.includes('✅') || log.includes('successful!'));
              return (
                <div key={idx} style={{ color: isSuccess ? '#10b981' : '#a0aec0', marginBottom: '4.5px', lineHeight: '1.4' }}>
                  {log}
                </div>
              );
            })}
            <div ref={consoleEndRef} />
          </div>

          {/* Success card with mock download links */}
          {buildComplete && (
            <div className="mt-4 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex items-center justify-between animate-scale-in">
              <div className="flex items-center gap-3">
                <CheckCircle className="text-emerald-400" size={24} />
                <div className="text-left">
                  <h5 className="text-[11px] font-bold text-emerald-400 m-0">Compilation Complete!</h5>
                  <p className="text-[9px] text-gray-400 mt-0.5">The native artifact is packaged and ready for test installation.</p>
                </div>
              </div>
              <button
                onClick={() => alert(`Simulated Download: Starting download of ${platform === 'android' ? 'jaldigo-debug.apk' : 'jaldigo-ios-test.zip'}`)}
                className="py-1 px-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[10px] rounded flex items-center gap-1 cursor-pointer transition-all"
              >
                <Download size={10} /> Download
              </button>
            </div>
          )}

        </div>

        {/* Local CLI Command Guide Cheatsheet */}
        <div className="card-glow p-5 text-left flex flex-col justify-between" style={{ backgroundColor: 'rgba(16,20,27,0.8)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px' }}>
          <div>
            <h4 className="text-white font-bold text-sm mb-3">💻 Local Terminal Build Guide</h4>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              Run these commands in your laptop terminal to compile the real APK/Xcode bundles using Capacitor.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Build Step 1 */}
              <div>
                <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>1. Build React Web Assets</span>
                <div style={{ backgroundColor: '#090d13', padding: '6px 10px', borderRadius: '6px', marginTop: '4px', border: '1px solid rgba(255,255,255,0.04)' }} className="flex justify-between items-center">
                  <code className="text-amber-500 text-[10px]">npm run build</code>
                  <span style={{ fontSize: '8px', color: '#64748b' }}>Vite Compile</span>
                </div>
              </div>

              {/* Build Step 2 */}
              <div>
                <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>2. Copy Assets to Native Mobile projects</span>
                <div style={{ backgroundColor: '#090d13', padding: '6px 10px', borderRadius: '6px', marginTop: '4px', border: '1px solid rgba(255,255,255,0.04)' }} className="flex justify-between items-center">
                  <code className="text-amber-500 text-[10px]">npx cap sync</code>
                  <span style={{ fontSize: '8px', color: '#64748b' }}>Capacitor Link</span>
                </div>
              </div>

              {/* Build Step 3 */}
              <div>
                <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>3. Open Native workspace (Android Studio / Xcode)</span>
                <div style={{ backgroundColor: '#090d13', padding: '6px 10px', borderRadius: '6px', marginTop: '4px', border: '1px solid rgba(255,255,255,0.04)' }} className="flex flex-col gap-1 text-[10px]">
                  <div className="flex justify-between items-center">
                    <code className="text-emerald-400">npx cap open android</code>
                    <span style={{ fontSize: '8px', color: '#64748b' }}>Android Studio</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-white/5 pt-1 mt-1 font-mono">
                    <code className="text-blue-400">npx cap open ios</code>
                    <span style={{ fontSize: '8px', color: '#64748b' }}>Xcode (macOS)</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div style={{ marginTop: '16px', backgroundColor: 'rgba(255,221,0,0.03)', border: '1px solid rgba(255,221,0,0.08)', borderRadius: '8px', padding: '10px', display: 'flex', alignItems: 'start', gap: '8px' }}>
            <span style={{ fontSize: '12px' }}>💡</span>
            <p style={{ margin: 0, fontSize: '8px', color: '#a0aec0', lineHeight: '1.4' }}>
              <b>Tip:</b> Make sure you have Android SDK/Studio installed for compiling APKs, and Xcode (macOS only) for iOS IPA bundles.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
