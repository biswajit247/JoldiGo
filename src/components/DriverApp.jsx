import React, { useState, useEffect, useRef } from 'react';
import { useSimulator, calculateDistance, getServerEndpoints } from '../context/SimulatorContext';
import TariffGuideModal from './TariffGuideModal';
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
  Send,
  Mic,
  Grid
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
    getChatTranslation,
    toggleDriverStatus,
    uploadDriverDocs,
    payoutDriver,
    acceptRide,
    rejectRide,
    startRide,
    triggerSOS,
    uploadDisputeEvidence,
    safetyClaims,
    fileSafetyClaim,
    insuranceReservePool,
    sosAlerts,
    connectDriverSocket,
    startGpsTracking,
    stopGpsTracking,
    isGpsActive,
    demandHotspots,
    geofencingZones,
    blockages,
    mapStyle,
    setMapStyle,
    callState,
    callFrom,
    callPartner,
    callDuration,
    initiateCall,
    acceptCall,
    endCall,
    enrollDriver,
    isNightMode,
    setIsNightMode,
    addLog,
    playSound,
    simulationSpeed
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
        console.log(`[TTS Speech] Selected Voice: ${selectedVoice.name}`);
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

  // Active Simulated Driver
  const [selectedDriverId, setSelectedDriverId] = useState('drv_1');
  const [tab, setTab] = useState('dashboard');
  const [callMuted, setCallMuted] = useState(false);
  const [callSpeaker, setCallSpeaker] = useState(false);
  const [showCallDialpad, setShowCallDialpad] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showTariffGuide, setShowTariffGuide] = useState(false);
  const [isOnRideBookingActive, setIsOnRideBookingActive] = useState(true);
  const [goMode, setGoMode] = useState('stay_in');
  const [showIdCard, setShowIdCard] = useState(false);
  const [showIncentives, setShowIncentives] = useState(false);
  const [customAlert, setCustomAlert] = useState(null);
  const alert = (msg) => {
    setCustomAlert({ message: msg });
  };
  const [showStayInPopover, setShowStayInPopover] = useState(false);
  const [earningsSubTab, setEarningsSubTab] = useState('all');
  const [helpSubView, setHelpSubView] = useState('main');
  const [isGoltalaActive, setIsGoltalaActive] = useState(false);
  const [isGoToActive, setIsGoToActive] = useState(false);
  const [goToDestination, setGoToDestination] = useState('Howrah Station');
  const [showGoToPopover, setShowGoToPopover] = useState(false);

  useEffect(() => {
    if (activeRide && activeRide.status === 'requested' && isGoToActive) {
      const dropoff = (activeRide.dropoffName || "").toLowerCase();
      const target = goToDestination.toLowerCase();
      
      // If the destination doesn't match, filter it
      if (!dropoff.includes(target) && !target.includes(dropoff)) {
        playSound('filter');
        addLog(`📍 [Go To Destination Filter] Filtered out ride offer to "${activeRide.dropoffName}" (not along route to ${goToDestination})`, 'warning');
        rejectRide();
        alert(`📍 [Destination Filter] Auto-filtered & rejected ride to "${activeRide.dropoffName}" (not along your route home to ${goToDestination}).`);
      }
    }
  }, [activeRide, isGoToActive, goToDestination]);

  useEffect(() => {
    if (selectedDriverId) {
      connectDriverSocket(selectedDriverId);
    }
  }, [selectedDriverId]);
  
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
    // Check if running on a native platform (iOS/Android)
    const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();

    if (isNative) {
      try {
        const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
        const photo = await Camera.getPhoto({
          quality: 50,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera
        });

        if (photo && photo.dataUrl) {
          const imageBase64 = photo.dataUrl;
          if (target === 'driver') setDriverPhoto(imageBase64);
          else if (target === 'vehicle') setVehiclePhoto(imageBase64);
          else if (target === 'insurance') setInsurancePhoto(imageBase64);
          else if (target === 'puc') setPucPhoto(imageBase64);
          else if (target === 'identity') setIdentityPhoto(imageBase64);
          else if (target === 'license') setLicensePhoto(imageBase64);
          else if (target === 'rc') setRcPhoto(imageBase64);
          return;
        }
      } catch (err) {
        console.warn("Capacitor camera failed, trying browser media fallback:", err);
      }
    }

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

  const currentDriver = drivers.find((d) => d.id === selectedDriverId) || drivers[0] || {
    id: selectedDriverId || 'drv_1',
    name: 'JoldiGo Driver',
    phone: '',
    verificationStatus: 'pending',
    documentStatuses: {},
    earnings: { daily: 0, weekly: 0 },
    location: { lat: 22.5726, lng: 88.3639 },
    avatar: '👨‍✈️',
    status: 'offline',
    vehicleType: 'car',
    vehicleNumber: 'WB 02 JB 1234',
    rating: 4.8
  };

  // Chat Panel State
  const [showChat, setShowChat] = useState(false);
  const [chatInputText, setChatInputText] = useState('');
  const [simulatedSpeed, setSimulatedSpeed] = useState(0);
  const [driverLang, setDriverLang] = useState('bn');
  const [passengerLang, setPassengerLang] = useState('en');

  // Voice Co-Pilot States
  const [isCoPilotEnabled, setIsCoPilotEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [recognizedCommand, setRecognizedCommand] = useState('');
  const coPilotActiveRef = useRef(false);

  const isNavActive = activeRide && activeRide.driverId === currentDriver.id && (activeRide.status === 'accepted' || activeRide.status === 'arrived' || activeRide.status === 'in_progress');

  const lastSpokenSpeedingRef = useRef(false);

  useEffect(() => {
    if (isNavActive && activeRide && activeRide.speed !== undefined) {
      setSimulatedSpeed(activeRide.speed);
    } else {
      setSimulatedSpeed(0);
      lastSpokenSpeedingRef.current = false;
    }
  }, [isNavActive, activeRide?.speed]);

  useEffect(() => {
    if (simulatedSpeed > 50) {
      if (!lastSpokenSpeedingRef.current) {
        speakText(`Speed alert. Please slow down. Speed limit is 50 kilometers per hour.`, 'en-US');
        lastSpokenSpeedingRef.current = true;
        if (addLog) {
          addLog(`⚠️ Telemetry Alert: Captain ${currentDriver?.name} (${currentDriver?.vehicleType}) exceeded speed limit! Speed: ${simulatedSpeed} km/h (Limit: 50 km/h)`, 'warning');
        }
      }
    } else if (simulatedSpeed > 0 && simulatedSpeed <= 48) {
      lastSpokenSpeedingRef.current = false;
    }
  }, [simulatedSpeed, currentDriver, addLog]);

  // Voice Co-Pilot Core Implementation
  const activeRideRef = useRef(activeRide);
  const currentDriverRef = useRef(currentDriver);
  const driverLangRef = useRef(driverLang);

  useEffect(() => {
    activeRideRef.current = activeRide;
    currentDriverRef.current = currentDriver;
    driverLangRef.current = driverLang;
  }, [activeRide, currentDriver, driverLang]);

  const matchVoiceCommand = (transcript) => {
    const t = transcript.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").toLowerCase();
    
    // 1. ACCEPT commands
    const acceptWords = [
      'accept', 'accept ride', 'accept offer', 'yes', 'ok', 'okay',
      'হ্যাঁ', 'হ্যা', 'হাঁ', 'গ্রহণ করুন', 'মঞ্জুর',
      'हाँ', 'हा', 'हां', 'स्वीकार', 'ओके'
    ];
    if (acceptWords.some(w => t.includes(w))) return 'accept';

    // 2. REJECT/DECLINE commands
    const rejectWords = [
      'reject', 'decline', 'no', 'cancel',
      'না', 'বাতিল', 'প্রত্যাখ্যান',
      'ना', 'नही', 'अस्वीकार', 'कैंसिल'
    ];
    if (rejectWords.some(w => t.includes(w))) return 'reject';

    // 3. ARRIVED commands
    const arrivedWords = [
      'arrived', 'reach', 'here',
      'পৌঁছে গেছি', 'পৌঁছেছি', 'এসেছি',
      'पहुंच गया', 'आ गया'
    ];
    if (arrivedWords.some(w => t.includes(w))) return 'arrived';

    // 4. START RIDE commands
    const startWords = [
      'start', 'start ride', 'go', "let's go",
      'শুরু', 'চলুন', 'যাও',
      'शुरू', 'स्टार्ट', 'चलो'
    ];
    if (startWords.some(w => t.includes(w))) return 'start';

    // 5. SOS commands
    const sosWords = [
      'sos', 'danger', 'help', 'emergency',
      'বাঁচাও', 'জরুরি', 'বিপদ',
      'मदद', 'बचाओ', 'इमरजेंसी'
    ];
    if (sosWords.some(w => t.includes(w))) return 'sos';

    return null;
  };

  const executeVoiceCommand = (command) => {
    const drvId = currentDriverRef.current?.id || 'drv_1';
    const active = activeRideRef.current;
    
    if (command === 'accept') {
      if (active && active.status === 'requested' && active.driverId === drvId) {
        setRecognizedCommand('ACCEPT OFFER');
        acceptRide(drvId);
        
        const lang = driverLangRef.current;
        if (lang === 'bn') {
          speakText("রাইড বুকিং গ্রহণ করা হয়েছে। যাত্রীর ঠিকানায় রওনা হচ্ছি।", 'bn-IN');
        } else if (lang === 'hi') {
          speakText("राइड स्वीकार कर ली गई है। यात्री के पास जा रहे हैं।", 'hi-IN');
        } else {
          speakText("Ride offer accepted. Routing to customer location.", 'en-IN');
        }
      }
    } else if (command === 'reject') {
      if (active && active.status === 'requested' && active.driverId === drvId) {
        setRecognizedCommand('DECLINE OFFER');
        rejectRide(drvId);
        
        const lang = driverLangRef.current;
        if (lang === 'bn') {
          speakText("রাইড বুকিং বাতিল করা হয়েছে।", 'bn-IN');
        } else if (lang === 'hi') {
          speakText("राइड अस्वीकार कर दी गई है।", 'hi-IN');
        } else {
          speakText("Ride request declined.", 'en-IN');
        }
      }
    } else if (command === 'arrived') {
      if (active && active.status === 'accepted' && active.driverId === drvId) {
        setRecognizedCommand('ARRIVED');
        // Let the simulation reach natural arrival or skip there. We trigger TTS feedback.
        const lang = driverLangRef.current;
        if (lang === 'bn') {
          speakText("আপনি পিকআপ লোকেশনে পৌঁছে গেছেন। যাত্রীকে ওটিপি জিজ্ঞেস করুন।", 'bn-IN');
        } else if (lang === 'hi') {
          speakText("आप पिकअप स्थान पर पहुंच गए हैं। यात्री से ओटीपी पूछें।", 'hi-IN');
        } else {
          speakText("Arrived at pickup point. Please ask passenger for OTP to start.", 'en-IN');
        }
      }
    } else if (command === 'start') {
      if (active && active.status === 'arrived' && active.driverId === drvId) {
        setRecognizedCommand('START TRIP');
        startRide();
        
        const lang = driverLangRef.current;
        if (lang === 'bn') {
          speakText("ট্রিপ শুরু হয়েছে। সাবধানে গাড়ি চালান।", 'bn-IN');
        } else if (lang === 'hi') {
          speakText("यात्रा शुरू हो गई है। सुरक्षित ड्राइव करें।", 'hi-IN');
        } else {
          speakText("Trip started. Drive safely.", 'en-IN');
        }
      }
    } else if (command === 'sos') {
      if (active && active.driverId === drvId && active.status !== 'completed') {
        setRecognizedCommand('SOS EMERGENCY');
        triggerSOS(drvId);
        
        const lang = driverLangRef.current;
        if (lang === 'bn') {
          speakText("জরুরি বিপদ সংকেত পাঠানো হয়েছে। পুলিশ পাঠানো হচ্ছে।", 'bn-IN');
        } else if (lang === 'hi') {
          speakText("आपातकालीन अलार्म सक्रिय हो गया है। पुलिस आ रही है।", 'hi-IN');
        } else {
          speakText("SOS emergency triggered. dispatching police assistance interceptors.", 'en-IN');
        }
      }
    }
    
    setTimeout(() => {
      setRecognizedCommand('');
    }, 4000);
  };

  useEffect(() => {
    coPilotActiveRef.current = isCoPilotEnabled;
    if (!isCoPilotEnabled) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API is not supported in this browser.");
      addLog("⚠️ Speech Recognition is not supported in this browser.", "warning");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    
    const lang = driverLang;
    if (lang === 'bn') {
      recognition.lang = 'bn-IN';
    } else if (lang === 'hi') {
      recognition.lang = 'hi-IN';
    } else {
      recognition.lang = 'en-IN';
    }

    recognition.onstart = () => {
      setIsListening(true);
      console.log(`[Co-Pilot] Speech recognition started for lang ${recognition.lang}`);
    };

    recognition.onend = () => {
      if (coPilotActiveRef.current) {
        try {
          recognition.start();
        } catch (err) {
          console.warn("[Co-Pilot] Auto-restart failed:", err);
        }
      } else {
        setIsListening(false);
      }
    };

    recognition.onerror = (e) => {
      console.warn("[Co-Pilot] Speech recognition error:", e.error);
      if (e.error === 'not-allowed') {
        setIsCoPilotEnabled(false);
        addLog("⚠️ Voice Co-Pilot blocked. Please grant microphone permissions.", "warning");
      }
    };

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      if (result.isFinal) {
        const transcript = result[0].transcript.trim().toLowerCase();
        setLastTranscript(transcript);
        
        const command = matchVoiceCommand(transcript);
        if (command) {
          executeVoiceCommand(command);
        }
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("[Co-Pilot] Failed to start SpeechRecognition:", err);
    }

    return () => {
      recognition.stop();
    };
  }, [isCoPilotEnabled, driverLang]);

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
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

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
    geofencePolygons: [],
    blockageCircles: []
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
      voyager: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      dark_navigation: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
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
        voyager: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        dark_navigation: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
      };
      tileLayerRef.current.setUrl(MAP_TILE_URLS[mapStyle]);
    }
  }, [mapStyle]);

  // Update map markers reactively
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentDriver) return;

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
    if (markersRef.current.police) {
      map.removeLayer(markersRef.current.police);
      markersRef.current.police = null;
    }
    if (markersRef.current.policePolyline) {
      map.removeLayer(markersRef.current.policePolyline);
      markersRef.current.policePolyline = null;
    }

    if (markersRef.current.heatmapCircles) {
      markersRef.current.heatmapCircles.forEach(c => map.removeLayer(c));
      markersRef.current.heatmapCircles = [];
    }

    if (markersRef.current.geofencePolygons) {
      markersRef.current.geofencePolygons.forEach(p => map.removeLayer(p));
      markersRef.current.geofencePolygons = [];
    }

    if (markersRef.current.blockageCircles) {
      markersRef.current.blockageCircles.forEach(c => map.removeLayer(c));
      markersRef.current.blockageCircles = [];
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

    const targetLatLng = L.latLng(currentDriver.location.lat, currentDriver.location.lng);
    if (!markersRef.current.driver) {
      markersRef.current.driver = L.marker(targetLatLng, { icon: driverIcon }).addTo(map);
      map.panTo(targetLatLng);
    } else {
      markersRef.current.driver.setIcon(driverIcon);
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
            map.panTo([currLat, currLng]);
          }
          
          if (progress < 1) {
            requestAnimationFrame(step);
          }
        };
        
        requestAnimationFrame(step);
      }
    }

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

      // Draw active SOS dispatch on map
      const activeSos = activeRide ? sosAlerts.find(alert => alert.driverId === currentDriver.id) : null;
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

      // Render dynamic active roadblock blockages on driver map
      if (blockages && blockages.length > 0) {
        if (!markersRef.current.blockageCircles) {
          markersRef.current.blockageCircles = [];
        }
        blockages.forEach(b => {
          const fillCol = b.type === 'accident' ? '#ef4444' : (b.type === 'construction' ? '#f59e0b' : '#3b82f6');
          
          const circle = L.circle([b.lat, b.lng], {
            stroke: true,
            color: fillCol,
            weight: 2,
            fillColor: fillCol,
            fillOpacity: 0.15,
            radius: b.radius || 150,
          }).addTo(map);

          const markerIcon = L.divIcon({
            className: 'blockage-icon-marker',
            html: `<div class="bg-black/80 border border-white/20 text-white rounded-full flex items-center justify-center font-bold" style="width: 20px; height: 20px; font-size: 10px; border-color: ${fillCol}; box-shadow: 0 0 8px ${fillCol};">⚠️</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });

          const marker = L.marker([b.lat, b.lng], { icon: markerIcon })
            .addTo(map)
            .bindPopup(`<b>${b.type.toUpperCase()}: Roadblock Alert</b><br/>${b.description}`);

          markersRef.current.blockageCircles.push(circle);
          markersRef.current.blockageCircles.push(marker);
        });
      }
    }
  }, [activeRide, currentDriver, selectedDriverId, showHeatmap, demandHotspots, geofencingZones, sosAlerts, blockages]);



  // Chat message send handler
  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInputText.trim()) return;
    sendChatMessage('driver', chatInputText.trim(), driverLang, passengerLang);
    setChatInputText('');
  };

  // Driver quick replies templates
  const LOCALIZED_DRIVER_QUICK_REPLIES = {
    'bn': [
      "আমি লোকেশনে পৌঁছে গেছি",
      "ভীষণ জ্যাম আছে, একটু দেরি হবে",
      "আমি আসছি",
      "কোন রুট দিয়ে যাব?",
      "আমার কাছে খুচরো আছে",
      "আপনার ওটিপি টা বলুন"
    ],
    'en': [
      "I have arrived at the location.",
      "Traffic is heavy, will be late.",
      "I am coming.",
      "Which route should I take?",
      "I have cash change.",
      "Please tell me your OTP."
    ],
    'hi': [
      "मैं लोकेशन पर पहुँच गया हूँ।",
      "बहुत भारी ट्रैफिक है, देरी होगी।",
      "मैं आ रहा हूँ।",
      "किस रास्ते से जाना है?",
      "मेरे पास छुट्टे पैसे हैं।",
      "कृपया अपना ओटीपी बताएं।"
    ]
  };

  const driverQuickReplies = LOCALIZED_DRIVER_QUICK_REPLIES[driverLang] || LOCALIZED_DRIVER_QUICK_REPLIES['bn'];

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
            let currentUrl = 'https://joldigo-backend.onrender.com';
            try {
              currentUrl = localStorage.getItem('joldigo_server_url') || 'https://joldigo-backend.onrender.com';
            } catch (e) {}
            const newUrl = window.prompt("Enter JoldiGo Server URL:", currentUrl);
            if (newUrl !== null) {
              try {
                localStorage.setItem('joldigo_server_url', newUrl.trim());
              } catch (e) {}
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

    const isInvolved = (callFrom === 'driver') || 
                       (callFrom === 'passenger' && callPartner?.role === 'driver' && callPartner?.id === currentDriver.id);
                       
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

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '40px 0', minHeight: '120px' }}>
          {showCallDialpad ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', width: '100%', maxWidth: '180px' }} className="animate-fade-in">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(num => (
                <button 
                  key={num}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    border: '1px solid rgba(255,255,255,0.15)',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                  onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                >
                  {num}
                </button>
              ))}
            </div>
          ) : (
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
          )}
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px', width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '240px', opacity: 0.95 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '10px', color: '#a0aec0', gap: '6px' }}>
                  <button 
                    onClick={() => setCallMuted(!callMuted)}
                    style={{ 
                      width: '48px', 
                      height: '48px', 
                      borderRadius: '50%', 
                      border: callMuted ? 'none' : '1px solid rgba(255,255,255,0.15)', 
                      backgroundColor: callMuted ? '#ffdd00' : 'rgba(255,255,255,0.06)', 
                      color: callMuted ? '#000' : '#fff', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      transition: 'all 0.2s', 
                      cursor: 'pointer' 
                    }}
                  >
                    <Mic size={18} color={callMuted ? '#000' : '#fff'} />
                  </button>
                  Mute
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '10px', color: '#a0aec0', gap: '6px' }}>
                  <button 
                    onClick={() => setShowCallDialpad(!showCallDialpad)}
                    style={{ 
                      width: '48px', 
                      height: '48px', 
                      borderRadius: '50%', 
                      border: showCallDialpad ? 'none' : '1px solid rgba(255,255,255,0.15)', 
                      backgroundColor: showCallDialpad ? '#ffdd00' : 'rgba(255,255,255,0.06)', 
                      color: showCallDialpad ? '#000' : '#fff', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      transition: 'all 0.2s', 
                      cursor: 'pointer' 
                    }}
                  >
                    <Grid size={18} color={showCallDialpad ? '#000' : '#fff'} />
                  </button>
                  Keypad
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '10px', color: '#a0aec0', gap: '6px' }}>
                  <button 
                    onClick={() => setCallSpeaker(!callSpeaker)}
                    style={{ 
                      width: '48px', 
                      height: '48px', 
                      borderRadius: '50%', 
                      border: callSpeaker ? 'none' : '1px solid rgba(255,255,255,0.15)', 
                      backgroundColor: callSpeaker ? '#ffdd00' : 'rgba(255,255,255,0.06)', 
                      color: callSpeaker ? '#000' : '#fff', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      transition: 'all 0.2s', 
                      cursor: 'pointer' 
                    }}
                  >
                    <Volume2 size={18} color={callSpeaker ? '#000' : '#fff'} />
                  </button>
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
            
            {!isNavActive && tab === 'dashboard' && (
              <div 
                style={{
                  height: '56px',
                  backgroundColor: '#ffffff',
                  borderBottom: '1px solid #e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 16px',
                  zIndex: 990,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Hamburger menu trigger */}
                  <button
                    type="button"
                    onClick={() => setShowSidebar(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#000000',
                      fontSize: '20px',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Sidebar Menu"
                  >
                    ☰
                  </button>
                  <span style={{ fontSize: '18px', fontWeight: '800', color: '#000000' }}>0 Orders</span>
                </div>

                {/* Destination Filter button */}
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setShowGoToPopover(!showGoToPopover)}
                    style={{
                      backgroundColor: isGoToActive ? '#e0f2fe' : '#f3f4f6',
                      border: isGoToActive ? '1px solid #0284c7' : '1px solid #e5e7eb',
                      borderRadius: '9999px',
                      padding: '4px 12px',
                      fontSize: '11px',
                      fontWeight: '850',
                      color: isGoToActive ? '#0284c7' : '#4b5563',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.2s'
                    }}
                  >
                    📍 {isGoToActive ? `Go To: ${goToDestination.split(' ')[0]}` : 'Go To'}
                  </button>

                  {/* Go To Destination Filter Popover Dialog */}
                  {showGoToPopover && (
                    <div 
                      style={{
                        position: 'absolute',
                        top: '36px',
                        right: '-50px',
                        zIndex: 1010,
                        width: '260px',
                        backgroundColor: '#ffffff',
                        color: '#000000',
                        borderRadius: '16px',
                        padding: '16px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        border: '1px solid #e5e7eb',
                        fontFamily: 'sans-serif'
                      }}
                      className="animate-bounce-in text-center"
                    >
                      {/* Arrow pointed up */}
                      <div 
                        style={{
                          position: 'absolute',
                          top: '-6px',
                          right: '65px',
                          width: '0',
                          height: '0',
                          borderLeft: '6px solid transparent',
                          borderRight: '6px solid transparent',
                          borderBottom: '6px solid #ffffff'
                        }}
                      ></div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                        <span style={{ fontSize: '12px', fontWeight: '900', color: '#111827' }}>📍 Go Home / Destination Mode</span>
                        <span style={{ fontSize: '10px', color: '#6b7280', lineHeight: '1.3' }}>Set a target destination. JoldiGo will only assign rides heading along your route.</span>
                      </div>

                      {/* Toggle Active Switch */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f3f4f6', paddingTop: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#374151' }}>Enable Filter</span>
                        <label className="switch-toggle-label relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isGoToActive}
                            onChange={() => setIsGoToActive(!isGoToActive)}
                            className="sr-only peer"
                          />
                          <div className="w-7 h-4 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                      </div>

                      {/* Custom input */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                        <span style={{ fontSize: '9px', color: '#4b5563', fontWeight: 'bold', textTransform: 'uppercase' }}>Target Destination</span>
                        <input
                          type="text"
                          value={goToDestination}
                          onChange={(e) => {
                            setGoToDestination(e.target.value);
                            setIsGoToActive(true);
                          }}
                          placeholder="Enter station, mall or area"
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            fontSize: '11.5px',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      {/* Presets Grid */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                        <span style={{ fontSize: '9px', color: '#4b5563', fontWeight: 'bold', textTransform: 'uppercase' }}>Quick Presets</span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                          {[
                            { name: 'Howrah Station', label: 'Howrah' },
                            { name: 'Salt Lake Sector V', label: 'Salt Lake' },
                            { name: 'Newtown Axis Mall', label: 'Newtown' },
                            { name: 'Sealdah Station', label: 'Sealdah' }
                          ].map(preset => (
                            <button
                              key={preset.name}
                              type="button"
                              onClick={() => {
                                setGoToDestination(preset.name);
                                setIsGoToActive(true);
                                setShowGoToPopover(false);
                              }}
                              style={{
                                border: '1px solid #e5e7eb',
                                backgroundColor: goToDestination === preset.name && isGoToActive ? '#e0f2fe' : '#ffffff',
                                color: goToDestination === preset.name && isGoToActive ? '#0284c7' : '#374151',
                                fontSize: '10px',
                                fontWeight: '800',
                                padding: '6px 0',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                            >
                              🏠 {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick toggle settings button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {currentDriver.status === 'online' ? (
                    <button
                      type="button"
                      onClick={() => toggleDriverStatus(currentDriver.id)}
                      style={{
                        backgroundColor: '#10b981',
                        border: 'none',
                        borderRadius: '9999px',
                        padding: '6px 14px',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: '900',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 10px rgba(16,185,129,0.3)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#ffffff', borderRadius: '50%' }} className="radar-pulse"></span>
                      ONLINE
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleDriverStatus(currentDriver.id)}
                      style={{
                        backgroundColor: '#374151',
                        border: 'none',
                        borderRadius: '9999px',
                        padding: '6px 14px',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: '900',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 10px rgba(55,65,81,0.3)',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#9ca3af', borderRadius: '50%' }}></span>
                      OFFLINE
                    </button>
                  )}
                  
                  <button
                    type="button"
                    onClick={() => setIsCoPilotEnabled(!isCoPilotEnabled)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '18px',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isCoPilotEnabled ? '#10b981' : 'inherit',
                      opacity: isCoPilotEnabled ? 1 : 0.45,
                      transition: 'all 0.2s'
                    }}
                    title="Toggle Voice Co-Pilot"
                  >
                    🎙️
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSettingsDrawer(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '18px',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Theme Settings"
                  >
                    ⚙️
                  </button>
                </div>
              </div>
            )}

            {tab === 'dashboard' && (
              <div style={{ position: 'relative', flex: 1, minHeight: '0', display: 'flex', flexDirection: 'column' }}>
                <div ref={mapContainerRef} className="map-view-container driver-map"></div>

                {/* Voice Co-Pilot HUD Status Overlay */}
                {isCoPilotEnabled && (
                  <div 
                    style={{
                      position: 'absolute',
                      top: isNavActive ? '80px' : '16px',
                      left: '12px',
                      right: '12px',
                      zIndex: 999,
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '10px 14px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                      backdropFilter: 'blur(8px)',
                      color: '#ffffff',
                      fontFamily: 'monospace',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      pointerEvents: 'auto'
                    }}
                    className="animate-slide-down"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span 
                          style={{ 
                            display: 'inline-block', 
                            width: '8px', 
                            height: '8px', 
                            backgroundColor: isListening ? '#10b981' : '#f59e0b', 
                            borderRadius: '50%',
                            boxShadow: isListening ? '0 0 10px #10b981' : 'none'
                          }}
                          className={isListening ? 'animate-pulse' : ''}
                        ></span>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.05em', color: '#10b981' }}>
                          🎙️ VOICE CO-PILOT: {isListening ? 'LISTENING' : 'STANDBY'}
                        </span>
                      </div>
                      <span style={{ fontSize: '8px', color: '#9ca3af', backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 5px', borderRadius: '4px' }}>
                        {driverLang === 'bn' ? 'বাংলা' : (driverLang === 'hi' ? 'हिंदी' : 'English')}
                      </span>
                    </div>

                    {lastTranscript && (
                      <div style={{ fontSize: '11px', color: '#e5e7eb', marginTop: '4px', borderLeft: '2px solid #3b82f6', paddingLeft: '6px' }}>
                        <span style={{ color: '#9ca3af', fontSize: '9px' }}>Heard:</span> "{lastTranscript}"
                      </div>
                    )}

                    {recognizedCommand && (
                      <div 
                        style={{ 
                          fontSize: '10px', 
                          fontWeight: 'bold', 
                          color: '#10b981', 
                          marginTop: '2px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px',
                          animation: 'pulse 1s infinite'
                        }}
                      >
                        ✅ Triggered: <span style={{ textDecoration: 'underline' }}>{recognizedCommand}</span>
                      </div>
                    )}
                  </div>
                )}

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
                      type="button"
                      onClick={() => setIsCoPilotEnabled(!isCoPilotEnabled)}
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        backgroundColor: isCoPilotEnabled ? '#10b981' : 'rgba(255,255,255,0.15)',
                        border: 'none',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: isCoPilotEnabled ? '0 0 10px #10b981' : 'none',
                        transition: 'all 0.2s'
                      }}
                      title="Toggle Voice Co-Pilot"
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
                      width: '50px',
                      height: '50px',
                      borderRadius: '50%',
                      backgroundColor: simulatedSpeed > 50 ? '#ef4444' : '#ffffff',
                      color: simulatedSpeed > 50 ? '#ffffff' : '#000000',
                      border: simulatedSpeed > 50 ? '2px solid #ef4444' : '2px solid rgba(0,0,0,0.1)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: simulatedSpeed > 50 ? '0 0 15px rgba(239,68,68,0.8)' : '0 4px 12px rgba(0,0,0,0.3)',
                      fontFamily: 'Outfit, sans-serif'
                    }}
                    className="animate-scale-in"
                  >
                    <span style={{ fontSize: '15px', fontWeight: '800', lineHeight: '1' }}>{simulatedSpeed}</span>
                    <span style={{ fontSize: '7px', fontWeight: 'bold', color: simulatedSpeed > 50 ? '#ffdddd' : '#666' }}>km/h</span>
                    {simulatedSpeed > 50 && (
                      <span style={{ position: 'absolute', top: '-10px', backgroundColor: '#000000', color: '#ffdd00', fontSize: '6px', fontWeight: '900', padding: '1px 3px', borderRadius: '3px', border: '1px solid #ffdd00', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>LIMIT 50</span>
                    )}
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

                        {/* Disputes Tab moved inside standby preview container */}
            {/* Bottom Overlay: Dashboard / Earnings tabs */}
            <div 
              className="driver-bottom-overlay card-glow"
              style={activeRide && activeRide.driverId === currentDriver.id ? (
                isNavActive ? {
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  borderRadius: '16px',
                  border: '1px solid rgba(0,0,0,0.12)',
                  padding: '16px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  bottom: '12px',
                  left: '12px',
                  right: '12px'
                } : {}
              ) : {
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 0,
                padding: 0,
                boxShadow: 'none',
                pointerEvents: 'none',
                zIndex: 900
              }}
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

                      {/* Active Police Dispatch Banner */}
                      {(() => {
                        const activeSos = sosAlerts.find(alert => alert.driverId === currentDriver.id);
                        if (!activeSos) return null;
                        return (
                          <div 
                            className="p-3 rounded-lg text-white mb-2 text-left border flex flex-col gap-1 transition-all duration-300"
                            style={{
                              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(30, 64, 175, 0.95))',
                              border: '1px solid rgba(255, 255, 255, 0.25)',
                              boxShadow: '0 0 15px rgba(239, 68, 68, 0.5)',
                              animation: 'pulse 1.5s infinite alternate'
                            }}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-black tracking-wider uppercase flex items-center gap-1">
                                🚨🚔 Police Dispatch Active
                              </span>
                              <span className="text-[8px] bg-white/20 px-1.5 py-0.5 rounded font-mono uppercase font-black">
                                {activeSos.status}
                              </span>
                            </div>
                            <p className="text-[9px] font-bold mt-1 text-white">
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

                      {/* Telemetry HUD Speedometer and Alarm System */}
                      <div className="telemetry-dashboard mt-3 p-3 rounded-xl border border-white/5 bg-black/40 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-400 font-medium">CAPTAIN TELEMETRY HUD</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse font-mono">GPS SYNCED</span>
                        </div>
                        
                        <div className="flex items-center gap-4 justify-around py-1">
                          {/* Radial Speedometer */}
                          <div style={{ position: 'relative', width: '80px', height: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            {/* SVG Arc for Speedometer */}
                            <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                              {/* Background track */}
                              <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                              {/* Active speed progress arc */}
                              <circle 
                                cx="40" 
                                cy="40" 
                                r="32" 
                                fill="none" 
                                stroke={activeRide.speed > 50 ? '#ef4444' : (activeRide.speed > 35 ? '#f59e0b' : 'var(--color-primary)')} 
                                strokeWidth="6" 
                                strokeDasharray={2 * Math.PI * 32}
                                strokeDashoffset={2 * Math.PI * 32 * (1 - Math.min(100, activeRide.speed || 0) / 100)}
                                strokeLinecap="round"
                                style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.4s ease' }}
                              />
                            </svg>
                            {/* Central Speed Text */}
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: '20px', fontWeight: '900', color: activeRide.speed > 50 ? '#ef4444' : '#fff', fontFamily: 'monospace' }}>{activeRide.speed || 0}</span>
                              <span style={{ fontSize: '7px', color: '#888', fontWeight: 'bold', marginTop: '-2px' }}>KM/H</span>
                            </div>
                          </div>

                          {/* Telemetry Status Items */}
                          <div className="flex-1 flex flex-col gap-1.5 justify-center">
                            <div className="flex items-center justify-between text-[9px]">
                              <span className="text-gray-500">Route Deviation</span>
                              <span className={`font-bold ${activeRide.isDeviated ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`}>
                                {activeRide.isDeviated ? '⚠️ OUT OF PATH' : '✅ ON TRACK'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[9px]">
                              <span className="text-gray-500">G-Force Warning</span>
                              <span className={`font-bold ${activeRide.abruptBraking ? 'text-amber-500 animate-pulse' : 'text-gray-400'}`}>
                                {activeRide.abruptBraking ? '⚠️ G-FORCE EXCEEDED' : 'Normal (1.0G)'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[9px]">
                              <span className="text-gray-500">Max Limit</span>
                              <span className="text-gray-300 font-mono">50 km/h</span>
                            </div>
                          </div>
                        </div>

                        {/* Overspeeding / Abrupt Braking Flashing Warnings */}
                        {activeRide.speed > 50 && (
                          <div className="text-[9px] py-1.5 px-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 font-bold flex items-center gap-1.5 animate-pulse justify-center">
                            <span>🚨 OVERSPEED LIMIT EXCEEDED - SLOW DOWN</span>
                          </div>
                        )}
                        {activeRide.abruptBraking && (
                          <div className="text-[9px] py-1.5 px-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400 font-bold flex items-center gap-1.5 animate-pulse justify-center">
                            <span>⚠️ ABRUPT BRAKING DETECTED - WATCH DISTANCE</span>
                          </div>
                        )}
                        {activeRide.isDeviated && (
                          <div className="text-[9px] py-1.5 px-3 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 font-bold flex items-center gap-1.5 animate-pulse justify-center">
                            <span>📡 DEVIATION Telemetry Triggered - Recalculating...</span>
                          </div>
                        )}
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

                      {/* Language Selectors Row */}
                      <div style={{ display: 'flex', gap: '8px', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <span style={{ color: '#888' }}>My Lang:</span>
                          <select 
                            value={driverLang} 
                            onChange={(e) => setDriverLang(e.target.value)} 
                            style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '10px', borderRadius: '4px', padding: '2px 4px', outline: 'none' }}
                          >
                            <option value="bn">বাংলা (Bengali)</option>
                            <option value="en">English</option>
                            <option value="hi">हिंदी (Hindi)</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <span style={{ color: '#888' }}>Passenger prefers:</span>
                          <select 
                            value={passengerLang} 
                            onChange={(e) => setPassengerLang(e.target.value)} 
                            style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '10px', borderRadius: '4px', padding: '2px 4px', outline: 'none' }}
                          >
                            <option value="en">English</option>
                            <option value="bn">বাংলা (Bengali)</option>
                            <option value="hi">हिंदी (Hindi)</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.12)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', color: '#f59e0b', fontFamily: 'Outfit, sans-serif' }}>
                        <span className="animate-pulse" style={{ fontSize: '10px' }}>🛡️</span>
                        <span><b>Safe Driving Mode:</b> One-tap quick replies auto-translate to Passenger's selected layout.</span>
                      </div>

                      {/* Messages list */}
                      <div className="chat-messages-container" style={{ height: '110px' }}>
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

                      {/* Localized Driver Quick-Replies Grid */}
                      <div className="chat-quick-replies-grid">
                        {driverQuickReplies.map((reply, idx) => (
                          <button 
                            key={idx}
                            className="quick-reply-btn"
                            onClick={() => sendChatMessage('driver', reply, driverLang, passengerLang)}
                          >
                            {reply}
                          </button>
                        ))}
                      </div>

                      {/* Custom input Form */}
                      <form onSubmit={handleSendChat} className="chat-input-form">
                        <input 
                          type="text" 
                          placeholder={`Type in ${driverLang === 'bn' ? 'Bengali' : (driverLang === 'hi' ? 'Hindi' : 'English')}...`}
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
                <div 
                  className="standby-earnings-preview"
                  style={{
                    position: 'absolute',
                    top: tab === 'dashboard' ? 'auto' : '56px',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: tab === 'dashboard' ? 'transparent' : '#0c0e12',
                    border: 'none',
                    borderRadius: 0,
                    padding: tab === 'dashboard' ? 0 : '16px',
                    overflowY: tab === 'dashboard' ? 'visible' : 'auto',
                    pointerEvents: tab === 'dashboard' ? 'none' : 'auto'
                  }}
                >
                  {/* Standby Dashboard View with Premium Radar and Floating Capsule Menu */}
                  {tab === 'dashboard' && !isNavActive && (
                    <div style={{ pointerEvents: 'auto' }}>
                      <style>{`
                        @keyframes pulse-radar {
                          0% { transform: scale(0.95); opacity: 0.85; box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); }
                          50% { transform: scale(1.05); opacity: 1; box-shadow: 0 0 20px 10px rgba(37, 99, 235, 0.2); }
                          100% { transform: scale(0.95); opacity: 0.85; box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); }
                        }
                        @keyframes radar-ring {
                          0% { transform: scale(0.6); opacity: 0.8; }
                          100% { transform: scale(2.0); opacity: 0; }
                        }
                        .radar-pulse {
                          animation: pulse-radar 2.5s infinite ease-in-out;
                        }
                        .radar-ring {
                          animation: radar-ring 3s infinite cubic-bezier(0.215, 0.610, 0.355, 1.000);
                        }
                      `}</style>

                      {/* Radar Overlay Animation for Online Captain */}
                      {currentDriver.status === 'online' && (
                        <div 
                          style={{
                            position: 'absolute',
                            top: '40%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 800,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            pointerEvents: 'none'
                          }}
                        >
                          <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div className="radar-ring" style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', border: '2.5px solid #3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.05)' }}></div>
                            <div className="radar-ring" style={{ position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', border: '2.5px solid #2563eb', backgroundColor: 'rgba(37, 99, 235, 0.05)', animationDelay: '1.5s' }}></div>
                            <div className="radar-pulse" style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #ffffff', zIndex: 10 }}>
                              <span style={{ fontSize: '18px' }}>🏍️</span>
                            </div>
                          </div>
                          <span style={{
                            marginTop: '16px',
                            backgroundColor: 'rgba(0, 0, 0, 0.85)',
                            color: '#ffffff',
                            fontSize: '11px',
                            fontWeight: '800',
                            padding: '6px 16px',
                            borderRadius: '9999px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            letterSpacing: '0.3px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            textAlign: 'center'
                          }}>
                            Scanning area for bookings...
                          </span>
                        </div>
                      )}

                      {/* Floating HUD Statistics Overlay */}
                      {currentDriver.status === 'online' && (
                        <div 
                          style={{
                            position: 'absolute',
                            top: '80px',
                            left: '16px',
                            right: '16px',
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.8)',
                            borderRadius: '16px',
                            padding: '12px 16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            zIndex: 900,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.06)'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                            <span style={{ fontSize: '9px', color: '#6b7280', fontWeight: 'bold', textTransform: 'uppercase' }}>Today's Pay</span>
                            <span style={{ fontSize: '16px', fontWeight: '900', color: '#111827' }}>₹{currentDriver.earnings.daily.toFixed(0)}</span>
                          </div>
                          <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb' }}></div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                            <span style={{ fontSize: '9px', color: '#6b7280', fontWeight: 'bold', textTransform: 'uppercase' }}>Target Bonus</span>
                            <span style={{ fontSize: '13px', fontWeight: '800', color: '#2563eb' }}>₹550 Bonus</span>
                          </div>
                          <div style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb' }}></div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                            <span style={{ fontSize: '9px', color: '#6b7280', fontWeight: 'bold', textTransform: 'uppercase' }}>Status</span>
                            <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              ● ONLINE
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Floating Action Button (Settings/Refresh) */}
                      <button
                        type="button"
                        onClick={() => {
                          if (playSound) playSound();
                          alert("↻ Connecting with dispatch server GPS logs... Signal quality strong (98%).");
                        }}
                        style={{
                          position: 'absolute',
                          bottom: '96px',
                          right: '20px',
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          backgroundColor: '#ffffff',
                          border: '1px solid #e5e7eb',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '18px',
                          cursor: 'pointer',
                          zIndex: 900
                        }}
                      >
                        ↻
                      </button>

                      {/* Floating Glassmorphic Bottom Navigation Dock Capsule */}
                      <div 
                        style={{
                          position: 'absolute',
                          bottom: '16px',
                          left: '16px',
                          right: '16px',
                          height: '64px',
                          backgroundColor: 'rgba(255, 255, 255, 0.92)',
                          backdropFilter: 'blur(20px)',
                          borderRadius: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-around',
                          padding: '0 12px',
                          zIndex: 990,
                          border: '1px solid rgba(255, 255, 255, 0.6)',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setTab('dashboard')}
                          style={{
                            background: 'none',
                            border: 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            color: tab === 'dashboard' ? '#2563eb' : '#6b7280'
                          }}
                        >
                          <span style={{ fontSize: '20px' }}>🗺️</span>
                          <span style={{ fontSize: '9px', fontWeight: '800' }}>Radar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setTab('earnings'); setEarningsSubTab('all'); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            color: tab === 'earnings' && earningsSubTab === 'all' ? '#2563eb' : '#6b7280'
                          }}
                        >
                          <span style={{ fontSize: '20px' }}>📊</span>
                          <span style={{ fontSize: '9px', fontWeight: '800' }}>Earnings</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setTab('earnings'); setEarningsSubTab('wallet'); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            color: tab === 'earnings' && earningsSubTab === 'wallet' ? '#2563eb' : '#6b7280'
                          }}
                        >
                          <span style={{ fontSize: '20px' }}>💳</span>
                          <span style={{ fontSize: '9px', fontWeight: '800' }}>Wallet</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setTab('garage')}
                          style={{
                            background: 'none',
                            border: 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            color: tab === 'garage' ? '#2563eb' : '#6b7280'
                          }}
                        >
                          <span style={{ fontSize: '20px' }}>🔧</span>
                          <span style={{ fontSize: '9px', fontWeight: '800' }}>Services</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setTab('disputes')}
                          style={{
                            background: 'none',
                            border: 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            color: tab === 'disputes' ? '#2563eb' : '#6b7280'
                          }}
                        >
                          <span style={{ fontSize: '20px' }}>🎧</span>
                          <span style={{ fontSize: '9px', fontWeight: '800' }}>Help</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Earnings Tab (All Earnings & Wallet view) */}
                  {tab === 'earnings' && (
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#f9fafb', color: '#000000', display: 'flex', flexDirection: 'column', zIndex: 1000, fontFamily: 'sans-serif' }}>
                      {/* Earnings Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px', backgroundColor: '#ffffff', padding: '0 16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button
                            type="button"
                            onClick={() => setTab('dashboard')}
                            style={{ background: 'none', border: 'none', fontSize: '18px', color: '#000', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            ←
                          </button>
                          <span style={{ fontSize: '16px', fontWeight: '800', color: '#000000' }}>Earnings Overview</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTab('disputes')}
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '9999px',
                            padding: '4px 12px',
                            fontSize: '11px',
                            fontWeight: '800',
                            color: '#000000',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          👤 Help
                        </button>
                      </div>

                      {/* Sub-header tabs switcher */}
                      <div style={{ display: 'flex', backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => setEarningsSubTab('all')}
                          style={{
                            flex: 1,
                            padding: '14px 0',
                            fontSize: '13px',
                            fontWeight: '800',
                            border: 'none',
                            background: 'none',
                            color: earningsSubTab === 'all' ? '#2563eb' : '#4b5563',
                            borderBottom: earningsSubTab === 'all' ? '3px solid #2563eb' : '3px solid transparent',
                            cursor: 'pointer'
                          }}
                        >
                          Earning Stats
                        </button>
                        <button
                          type="button"
                          onClick={() => setEarningsSubTab('wallet')}
                          style={{
                            flex: 1,
                            padding: '14px 0',
                            fontSize: '13px',
                            fontWeight: '800',
                            border: 'none',
                            background: 'none',
                            color: earningsSubTab === 'wallet' ? '#2563eb' : '#4b5563',
                            borderBottom: earningsSubTab === 'wallet' ? '3px solid #2563eb' : '3px solid transparent',
                            cursor: 'pointer'
                          }}
                        >
                          Earning Wallet
                        </button>
                      </div>

                      {/* Subviews Container */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {earningsSubTab === 'all' ? (
                          <>
                            {/* Today's Earnings card - Blue Gradient */}
                            <div style={{ 
                              background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', 
                              borderRadius: '16px', 
                              padding: '24px 20px', 
                              textAlign: 'center', 
                              boxShadow: '0 8px 24px rgba(37,99,235,0.2)',
                              color: '#ffffff',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}>
                              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Net Earnings Today</span>
                              <h2 style={{ fontSize: '36px', fontWeight: '900', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                ₹{currentDriver.earnings.daily.toFixed(0)}
                              </h2>
                              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '12px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.7)', fontWeight: 'bold' }}>Trips</span>
                                  <span style={{ fontSize: '14px', fontWeight: '900' }}>8 Rides</span>
                                </div>
                                <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.15)' }}></div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.7)', fontWeight: 'bold' }}>Online Hrs</span>
                                  <span style={{ fontSize: '14px', fontWeight: '900' }}>6.2 hrs</span>
                                </div>
                              </div>
                            </div>

                            {/* List options */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => setTab('history')}
                                style={{
                                  backgroundColor: '#ffffff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '12px',
                                  padding: '14px 16px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  cursor: 'pointer',
                                  width: '100%',
                                  boxSizing: 'border-box'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <span style={{ fontSize: '18px' }}>📝</span>
                                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#1f2937' }}>All Orders & History logs</span>
                                </div>
                                <span style={{ color: '#9ca3af', fontSize: '14px', fontWeight: 'bold' }}>&gt;</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => alert("📋 Rate Card: Base Fare ₹35, Distance Fare ₹10/km, Ride Share commission flat 5%.")}
                                style={{
                                  backgroundColor: '#ffffff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '12px',
                                  padding: '14px 16px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  cursor: 'pointer',
                                  width: '100%',
                                  boxSizing: 'border-box'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <span style={{ fontSize: '18px' }}>💳</span>
                                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#1f2937' }}>View Rate Card parameters</span>
                                </div>
                                <span style={{ color: '#9ca3af', fontSize: '14px', fontWeight: 'bold' }}>&gt;</span>
                              </button>
                            </div>

                            {/* Earning Target Banner */}
                            <div 
                              onClick={() => setTab('subscription')}
                              style={{
                                backgroundColor: '#000000',
                                borderRadius: '16px',
                                padding: '16px 20px',
                                color: '#ffffff',
                                textAlign: 'left',
                                display: 'flex',
                                justifyStyle: 'space-between',
                                alignItems: 'center',
                                cursor: 'pointer',
                                position: 'relative',
                                overflow: 'hidden',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                              }}
                            >
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 2 }}>
                                <span style={{ fontSize: '14px', fontWeight: '900', letterSpacing: '0.5px' }}>Earning Subscription Plans</span>
                                <span style={{ fontSize: '12px', color: '#facc15', fontWeight: '800' }}>Ride commission free today!</span>
                                <span style={{ fontSize: '9px', color: '#ffffff', border: '1px solid #facc15', backgroundColor: 'rgba(250,204,21,0.2)', borderRadius: '4px', padding: '2px 8px', width: 'fit-content', marginTop: '6px', fontWeight: '800' }}>
                                  Choose Earning Plan →
                                </span>
                              </div>
                              <span style={{ fontSize: '32px', zIndex: 2 }}>🎁</span>
                            </div>

                            {/* Weekly Trend Card */}
                            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '16px', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                              <span style={{ fontSize: '11px', color: '#4b5563', fontWeight: '800', display: 'block', marginBottom: '12px' }}>📊 Weekly Earnings Trend (₹)</span>
                              
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', height: '90px', padding: '16px 8px 8px 8px', backgroundColor: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: '12px' }}>
                                {[
                                  { day: 'Mon', amt: 850 },
                                  { day: 'Tue', amt: 1200 },
                                  { day: 'Wed', amt: 950 },
                                  { day: 'Thu', amt: 1500 },
                                  { day: 'Fri', amt: 1850 },
                                  { day: 'Sat', amt: 2200 },
                                  { day: 'Sun', amt: Math.max(1600, Math.round(currentDriver.earnings.daily)) }
                                ].map((d, idx) => {
                                  const maxAmt = 2200;
                                  const pctHeight = (d.amt / maxAmt) * 100;
                                  return (
                                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                      <span style={{ fontSize: '8px', color: '#2563eb', fontWeight: 'bold', fontFamily: 'monospace' }}>₹{d.amt}</span>
                                      <div 
                                        style={{
                                          height: `${Math.max(4, pctHeight * 0.5)}px`,
                                          width: '12px',
                                          backgroundColor: '#bfdbfe',
                                          borderTop: '2px solid #2563eb',
                                          borderRadius: '2px 2px 0 0',
                                          marginTop: '2px'
                                        }}
                                      ></div>
                                      <span style={{ fontSize: '9px', color: '#6b7280', fontWeight: '800', marginTop: '4px' }}>{d.day}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Premium Metallic Gold Credit Card for Wallet */}
                            <div style={{
                              background: 'linear-gradient(135deg, #b45309 0%, #d97706 50%, #facc15 100%)',
                              borderRadius: '20px',
                              padding: '20px',
                              color: '#ffffff',
                              textAlign: 'left',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              height: '150px',
                              boxShadow: '0 10px 25px rgba(217,119,6,0.25)',
                              position: 'relative',
                              overflow: 'hidden'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 2 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.7)', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>JoldiGo Cash Card</span>
                                  <span style={{ fontSize: '16px', fontWeight: '900' }}>{currentDriver.name}</span>
                                </div>
                                <span style={{ fontSize: '24px' }}>💳</span>
                              </div>
                              
                              <div style={{ zIndex: 2 }}>
                                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.7)', fontWeight: 'bold' }}>Current Captain Balance</span>
                                <h3 style={{ fontSize: '24px', fontWeight: '900', margin: '2px 0 0 0' }}>-₹25.38</h3>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', zIndex: 2 }}>
                                <span style={{ fontSize: '10px', fontFamily: 'monospace', letterSpacing: '2px' }}>•••• •••• •••• 9811</span>
                                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.8)', fontWeight: 'bold', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px', padding: '1px 6px' }}>Status: Expired</span>
                              </div>
                              {/* Glowing card graphic background details */}
                              <div style={{ position: 'absolute', right: '-40px', bottom: '-40px', width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)', zIndex: 1 }}></div>
                            </div>

                            {/* Wallet Action Box */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => alert("💳 Opening secure wallet payment gateway to top up Captain balance...")}
                                style={{
                                  backgroundColor: '#facc15',
                                  border: 'none',
                                  borderRadius: '12px',
                                  padding: '14px 0',
                                  fontSize: '13px',
                                  fontWeight: '900',
                                  color: '#000000',
                                  cursor: 'pointer',
                                  boxShadow: '0 4px 12px rgba(250,204,21,0.2)'
                                }}
                              >
                                Recharge Captain Card Now
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  await payoutDriver(currentDriver.id);
                                  alert(`💸 Payout request submitted! Net earnings successfully transferred to your bank account.`);
                                }}
                                style={{
                                  backgroundColor: '#000000',
                                  border: 'none',
                                  borderRadius: '12px',
                                  padding: '14px 0',
                                  fontSize: '13px',
                                  fontWeight: '800',
                                  color: '#ffffff',
                                  cursor: 'pointer',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                }}
                              >
                                Payout to Registered Bank
                              </button>
                            </div>

                            {/* Refer and Earn */}
                            <div style={{
                              backgroundColor: '#faf5ff',
                              borderRadius: '16px',
                              border: '1px solid #f3e8ff',
                              padding: '16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              textAlign: 'left',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                            }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'bold' }}>Refer and Earn</span>
                                <span style={{ fontSize: '15px', fontWeight: '900', color: '#6b21a8' }}>Up to ₹4500 per approval</span>
                              </div>
                              <span style={{ fontSize: '32px' }}>💵</span>
                            </div>

                            {/* Transaction history */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', fontWeight: '800', color: '#1f2937' }}>Transaction History</span>
                                <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: '800', cursor: 'pointer' }}>Filter</span>
                              </div>

                              <div style={{ display: 'flex', gap: '8px' }}>
                                <span style={{ fontSize: '10px', fontWeight: '800', padding: '6px 16px', borderRadius: '9999px', backgroundColor: '#2563eb', color: '#fff', border: '1px solid #2563eb' }}>All transactions</span>
                                <span style={{ fontSize: '10px', fontWeight: '800', padding: '6px 16px', borderRadius: '9999px', backgroundColor: '#ffffff', color: '#4b5563', border: '1px solid #e5e7eb' }}>Pending</span>
                              </div>

                              {/* Mock transactions matching the screenshot */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '800', color: '#6b7280', textAlign: 'left' }}>27 Jun 2026</span>
                                {[
                                  { label: 'Order Deductions', amt: '- ₹7.01', time: '05:50 am' },
                                  { label: 'Order Deductions', amt: '- ₹5.25', time: '04:44 am' },
                                  { label: 'Order Deductions', amt: '- ₹4.72', time: '04:14 am' },
                                  { label: 'Order Deductions', amt: '- ₹8.44', time: '03:59 am' }
                                ].map((t, idx) => (
                                  <div key={idx} style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left' }}>
                                      <span style={{ fontSize: '14px', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>₹</span>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#1f2937' }}>{t.label}</span>
                                        <span style={{ fontSize: '9px', color: '#9ca3af' }}>{t.time}</span>
                                      </div>
                                    </div>
                                    <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#ef4444' }}>{t.amt}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Disputes Tab (Help & Support + Explore All Issues view) */}
                  {tab === 'disputes' && (
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#f9fafb', color: '#000000', display: 'flex', flexDirection: 'column', zIndex: 1000, fontFamily: 'sans-serif' }}>
                      {/* Custom Help Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px', backgroundColor: '#ffffff', padding: '0 16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (helpSubView === 'all_issues') {
                                setHelpSubView('main');
                              } else {
                                setTab('dashboard');
                              }
                            }}
                            style={{ background: 'none', border: 'none', fontSize: '18px', color: '#000', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            ←
                          </button>
                          <span style={{ fontSize: '16px', fontWeight: '800', color: '#000000' }}>
                            {helpSubView === 'main' ? 'Help & Support' : 'Explore All Issues'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => alert("📞 Connecting to emergency priority JoldiGo Captain helpline channel...")}
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '9999px',
                            padding: '4px 12px',
                            fontSize: '11px',
                            fontWeight: '800',
                            color: '#000000',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          👤 Emergency
                        </button>
                      </div>

                      {/* Content Body based on helpSubView */}
                      {helpSubView === 'main' ? (
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {/* Search box */}
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '10px', fontSize: '14px', color: '#9ca3af' }}>🔍</span>
                            <input
                              type="text"
                              placeholder="Search your issue"
                              style={{
                                width: '100%',
                                padding: '10px 12px 10px 36px',
                                border: '1px solid #e5e7eb',
                                borderRadius: '9999px',
                                fontSize: '12px',
                                backgroundColor: '#ffffff',
                                color: '#000000',
                                outline: 'none',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>

                          {/* Recent Orders section */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '800', color: '#1f2937', textAlign: 'left' }}>Recent Orders</span>
                            
                            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', fontWeight: '800', color: '#1f2937' }}>Bike Boost (ID: jld_9801)</span>
                                <span style={{ fontSize: '13px', fontWeight: '800', color: '#10b981' }}>₹140.00</span>
                              </div>
                              <span style={{ fontSize: '10px', color: '#6b7280', fontWeight: 'bold' }}>05 July 2026, 10:30 AM</span>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', paddingLeft: '16px', marginTop: '4px' }}>
                                {/* Vertical connection line */}
                                <div style={{ position: 'absolute', left: '4px', top: '6px', bottom: '6px', width: '2px', backgroundColor: '#e5e7eb' }}></div>
                                
                                <div style={{ position: 'relative' }}>
                                  <div style={{ position: 'absolute', left: '-15px', top: '4px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                                  <p style={{ margin: 0, fontSize: '11px', color: '#4b5563', lineHeight: '1.4' }}>
                                    302, Jodhbhim, Hatgacha, Newtown, Kolkata, West Bengal 700107
                                  </p>
                                </div>
                                <div style={{ position: 'relative' }}>
                                  <div style={{ position: 'absolute', left: '-15px', top: '4px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                                  <p style={{ margin: 0, fontSize: '11px', color: '#4b5563', lineHeight: '1.4' }}>
                                    Axis Mall, Major Arterial Road(South-East), Newtown, West Bengal
                                  </p>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setTab('history')}
                              style={{
                                backgroundColor: '#ffffff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '12px',
                                padding: '12px',
                                fontSize: '12px',
                                fontWeight: '800',
                                color: '#2563eb',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: 'pointer',
                                width: '100%',
                                marginTop: '4px',
                                boxSizing: 'border-box'
                              }}
                            >
                              <span>View All Ride Orders</span>
                              <span>&gt;</span>
                            </button>
                          </div>

                          {/* Help support center primary issues banner */}
                          <div style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '16px',
                            border: '1px solid #e5e7eb',
                            padding: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            textAlign: 'left',
                            gap: '12px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                              <span style={{ fontSize: '14px', fontWeight: '800', color: '#1f2937' }}>Need immediate support?</span>
                              <span style={{ fontSize: '11px', color: '#4b5563', lineHeight: '1.4' }}>Connect with local dispatch resolution desk</span>
                              <button
                                type="button"
                                onClick={() => {
                                  alert("💬 Initiating chat with JoldiGo automated captain resolution bot...");
                                }}
                                style={{
                                  backgroundColor: '#facc15',
                                  border: 'none',
                                  borderRadius: '9999px',
                                  padding: '8px 20px',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  color: '#000000',
                                  cursor: 'pointer',
                                  width: 'fit-content',
                                  marginTop: '6px'
                                }}
                              >
                                Start Chat
                              </button>
                            </div>
                            <div style={{ fontSize: '42px' }}>👨‍💼</div>
                          </div>

                          {/* Two action cards */}
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <div 
                              onClick={() => setHelpSubView('all_issues')}
                              style={{
                                flex: 1,
                                backgroundColor: '#dbeafe',
                                borderRadius: '16px',
                                padding: '16px',
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                border: '1px solid #bfdbfe',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                              }}
                            >
                              <span style={{ fontSize: '24px' }}>💬</span>
                              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e3a8a' }}>Explore FAQ Issues</span>
                            </div>

                            <div 
                              onClick={() => alert("📺 Opening safety and operations captain training guides video library...")}
                              style={{
                                flex: 1,
                                backgroundColor: '#dbeafe',
                                borderRadius: '16px',
                                padding: '16px',
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                border: '1px solid #bfdbfe',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                              }}
                            >
                              <span style={{ fontSize: '24px' }}>🎬</span>
                              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e3a8a' }}>Training Videos</span>
                            </div>
                          </div>

                          {/* Active disputes fallback list if any exist */}
                          {driverDisputes.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
                              <span style={{ fontSize: '11px', fontWeight: '800', color: '#ef4444', textAlign: 'left' }}>⚠️ Active Ride Disputes Under Review</span>
                              {driverDisputes.map(disp => (
                                <div key={disp.id} style={{ backgroundColor: '#fff', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                                  <span style={{ fontSize: '10px', color: '#b91c1c', fontWeight: '800' }}>Suspended Payout: ₹{disp.suspendedPayout}</span>
                                  <p style={{ margin: 0, fontSize: '10px', color: '#4b5563' }}><b>Rider Complaint:</b> {disp.riderComplaint}</p>
                                  {disp.status === 'awaiting_evidence' ? (
                                    <button
                                      type="button"
                                      onClick={() => uploadDisputeEvidence(disp.id, 'video', 'dashcam_evidence.mp4')}
                                      style={{ alignSelf: 'flex-start', marginTop: '6px', fontSize: '9px', fontWeight: 'bold', padding: '4px 8px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                      Upload Evidence
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: '9px', color: '#2563eb', fontWeight: 'bold', marginTop: '4px' }}>✓ Evidence Uploaded (Under Review)</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Explore All Issues list */
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {[
                            { title: 'Nearby Demand Locations', icon: '📍' },
                            { title: 'Earnings & Payments', icon: '💵' },
                            { title: 'Account and Profile Update', icon: '👤' },
                            { title: 'App & GPS satellite issues', icon: '📱' },
                            { title: 'Helpline & Emergency', icon: '⚠️' },
                            { title: 'Accidental Cover claims', icon: '🛡️' }
                          ].map((issue, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                if (issue.title.includes('Earnings')) {
                                  setTab('earnings');
                                } else if (issue.title.includes('Account')) {
                                  setTab('garage');
                                } else {
                                  alert(`ℹ️ Support Desk: Details on "${issue.title}" can be resolved via active JoldiGo local dispatch hubs.`);
                                }
                              }}
                              style={{
                                backgroundColor: '#ffffff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '12px',
                                padding: '14px 16px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: 'pointer',
                                boxSizing: 'border-box',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '18px' }}>{issue.icon}</span>
                                <span style={{ fontSize: '12px', fontWeight: '800', color: '#1f2937' }}>{issue.title}</span>
                              </div>
                              <span style={{ color: '#9ca3af', fontSize: '14px', fontWeight: 'bold' }}>&gt;</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Service Manager Tab (garage) */}
                  {tab === 'garage' && (
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#f9fafb', color: '#000000', display: 'flex', flexDirection: 'column', zIndex: 1000, fontFamily: 'sans-serif' }}>
                      {/* Service Manager Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px', backgroundColor: '#ffffff', padding: '0 16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button
                            type="button"
                            onClick={() => setTab('dashboard')}
                            style={{ background: 'none', border: 'none', fontSize: '18px', color: '#000', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            ←
                          </button>
                          <span style={{ fontSize: '16px', fontWeight: '800', color: '#000000' }}>Service Setup</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTab('disputes')}
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '9999px',
                            padding: '4px 12px',
                            fontSize: '11px',
                            fontWeight: '800',
                            color: '#000000',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          👤 Help
                        </button>
                      </div>

                      {/* Content Body */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Services List cards */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {[
                            { name: 'Bike Metro Stream', active: true, avatar: '🚴‍♂️' },
                            { name: 'Bike Boost Premium', active: true, avatar: '⚡' },
                            { name: 'Regular Bike Cab', active: true, avatar: '🛵' },
                            { name: 'Parcel Dispatch', active: true, avatar: '📦' }
                          ].map((s, idx) => (
                            <div
                              key={idx}
                              style={{
                                backgroundColor: '#fef3c7',
                                border: '1px solid #fde68a',
                                borderRadius: '16px',
                                padding: '16px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                textAlign: 'left',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '24px' }}>{s.avatar}</span>
                                <span style={{ fontSize: '13px', fontWeight: '800', color: '#1f2937' }}>{s.name}</span>
                              </div>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: '800',
                                backgroundColor: '#10b981',
                                color: '#ffffff',
                                padding: '4px 12px',
                                borderRadius: '9999px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                ✓ Active
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Extra earnings promo banner */}
                        <div style={{
                          backgroundColor: '#ffffff',
                          borderRadius: '16px',
                          border: '1px solid #e5e7eb',
                          padding: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyStyle: 'space-between',
                          textAlign: 'left',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                            <span style={{ fontSize: '13.5px', fontWeight: '900', color: '#111827' }}>JoldiGo Delivery Captains</span>
                            <span style={{ fontSize: '13.5px', fontWeight: '900', color: '#111827', marginTop: '2px' }}>earn 40% extra daily !! 🎉</span>
                          </div>
                          <span style={{ fontSize: '32px' }}>🪙</span>
                        </div>

                        {/* Start Delivery category actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {[
                            { name: 'Food Delivery Stream', desc: 'Watch Setup Guide ▶', actionLabel: 'Configure', avatar: '🍔' },
                            { name: 'Grocery Delivery Courier', desc: 'Accept local packages', actionLabel: 'Configure', avatar: '🛒' }
                          ].map((d, idx) => (
                            <div
                              key={idx}
                              style={{
                                backgroundColor: '#ffffff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '16px',
                                padding: '16px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                textAlign: 'left',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '24px' }}>{d.avatar}</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#1f2937' }}>{d.name}</span>
                                  <span style={{ fontSize: '9px', color: '#2563eb', fontWeight: 'bold' }}>{d.desc}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => alert(`🚀 Starting setup workflow for "${d.name}" dispatch channels...`)}
                                style={{
                                  backgroundColor: '#ffffff',
                                  border: '1px solid #10b981',
                                  color: '#10b981',
                                  borderRadius: '8px',
                                  padding: '6px 16px',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  cursor: 'pointer'
                                }}
                              >
                                {d.actionLabel}
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Garage inputs for registration (from existing code) */}
                        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '16px', textAlign: 'left', marginTop: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                          <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '800', display: 'block', marginBottom: '8px' }}>🚗 Registered Dispatch Vehicles</span>
                          {currentDriver.vehicles && currentDriver.vehicles.map(veh => (
                            <div key={veh.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#111827' }}>{veh.name}</span>
                                <span style={{ fontSize: '9px', color: '#9ca3af', fontFamily: 'monospace' }}>{veh.number}</span>
                              </div>
                              <span style={{ fontSize: '9px', color: veh.active ? '#10b981' : '#6b7280', fontWeight: 'bold' }}>
                                {veh.active ? '● Active' : 'Select'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ride History Tab */}
                  {tab === 'history' && (
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#f9fafb', color: '#000000', display: 'flex', flexDirection: 'column', zIndex: 1000, fontFamily: 'sans-serif' }}>
                      {/* History Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px', backgroundColor: '#ffffff', padding: '0 16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button
                            type="button"
                            onClick={() => setTab('dashboard')}
                            style={{ background: 'none', border: 'none', fontSize: '18px', color: '#000', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            ←
                          </button>
                          <span style={{ fontSize: '16px', fontWeight: '800', color: '#000000' }}>Ride History logs</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTab('disputes')}
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '9999px',
                            padding: '4px 12px',
                            fontSize: '11px',
                            fontWeight: '800',
                            color: '#000000',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          👤 Help
                        </button>
                      </div>

                      {/* Content Body */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#1f2937', textAlign: 'left' }}>📜 Completed Rides History</span>
                        
                        {loadingHistory ? (
                          <div style={{ textAlign: 'center', padding: '24px', fontSize: '12px', color: '#6b7280' }}>Loading history logs...</div>
                        ) : history.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '36px', fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>No completed rides logged for this partner.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {history.map(item => (
                              <div key={item.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#10b981' }}>₹{item.takeHome.toFixed(2)} Take-Home</span>
                                  <span style={{ fontSize: '10px', color: '#6b7280', fontWeight: 'bold' }}>{new Date(item.createdAt).toLocaleDateString()}</span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', paddingLeft: '16px', marginTop: '4px' }}>
                                  <div style={{ position: 'absolute', left: '4px', top: '4px', bottom: '4px', width: '2.5px', backgroundColor: '#e5e7eb' }}></div>
                                  <div style={{ position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: '-15px', top: '4px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                                    <span style={{ fontSize: '11px', color: '#4b5563', lineHeight: '1.4' }}><b>Pickup:</b> {item.pickupName}</span>
                                  </div>
                                  <div style={{ position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: '-15px', top: '4px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                                    <span style={{ fontSize: '11px', color: '#4b5563', lineHeight: '1.4' }}><b>Dropoff:</b> {item.dropoffName}</span>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#6b7280', borderTop: '1px solid #f3f4f6', paddingTop: '8px', marginTop: '4px' }}>
                                  <span>Distance: {item.distance.toFixed(1)} km</span>
                                  <span>Gross Fare: ₹{item.totalFare.toFixed(0)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Incentives and More / Rewards Tab (subscription) */}
                  {tab === 'subscription' && (
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#f9fafb', color: '#000000', display: 'flex', flexDirection: 'column', zIndex: 1000, fontFamily: 'sans-serif' }}>
                      {/* Incentives Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px', backgroundColor: '#ffffff', padding: '0 16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button
                            type="button"
                            onClick={() => setTab('dashboard')}
                            style={{ background: 'none', border: 'none', fontSize: '18px', color: '#000', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          >
                            ←
                          </button>
                          <span style={{ fontSize: '16px', fontWeight: '800', color: '#000000' }}>Incentives & Rewards</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTab('disputes')}
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '9999px',
                            padding: '4px 12px',
                            fontSize: '11px',
                            fontWeight: '800',
                            color: '#000000',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          👤 Help
                        </button>
                      </div>

                      {/* Content Body */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        
                        {/* Incentives Row Card */}
                        <div style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '16px',
                          padding: '16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          textAlign: 'left',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                        }}
                          onClick={() => alert("📈 Incentives breakdown: Daily targets completed: 0/6. Weekly target bonus: ₹500 on 30 rides.")}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '24px' }}>💵</span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: '#1f2937' }}>Daily Incentive Milestones</span>
                              <span style={{ fontSize: '10px', color: '#6b7280', fontWeight: 'bold' }}>Complete 5 rides to unlock ₹120</span>
                            </div>
                          </div>
                          <span style={{ color: '#9ca3af', fontSize: '14px', fontWeight: 'bold' }}>&gt;</span>
                        </div>

                        {/* Choose Plan Banner */}
                        <div style={{
                          backgroundColor: '#000000',
                          borderRadius: '16px',
                          padding: '16px 20px',
                          color: '#ffffff',
                          textAlign: 'left',
                          display: 'flex',
                          justifyStyle: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          position: 'relative',
                          overflow: 'hidden',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}>
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 2 }}>
                            <span style={{ fontSize: '14px', fontWeight: '900', letterSpacing: '0.5px' }}>Choose your earning plan</span>
                            <span style={{ fontSize: '12px', color: '#facc15', fontWeight: '800' }}>Flat commission plans available</span>
                            <span style={{ fontSize: '9px', color: '#ffffff', border: '1px solid #facc15', backgroundColor: 'rgba(250,204,21,0.2)', borderRadius: '4px', padding: '2px 8px', width: 'fit-content', marginTop: '6px', fontWeight: '800' }}>
                              View All Plans →
                            </span>
                          </div>
                          <span style={{ fontSize: '32px', zIndex: 2 }}>⚡</span>
                        </div>

                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#1f2937', textAlign: 'left', marginTop: '4px' }}>Commission Settings</span>

                        {/* Subscription Tier Card */}
                        <div style={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '16px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          textAlign: 'left',
                          position: 'relative',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                        }}>
                          <span style={{
                            position: 'absolute',
                            right: '12px',
                            top: '12px',
                            backgroundColor: '#fee2e2',
                            color: '#ef4444',
                            border: '1px solid #fecaca',
                            borderRadius: '4px',
                            fontSize: '9px',
                            fontWeight: '800',
                            padding: '2px 6px',
                            textTransform: 'uppercase'
                          }}>
                            Expired
                          </span>

                          <span style={{ fontSize: '14px', fontWeight: '900', color: '#1f2937', display: 'block', maxWidth: '160px' }}>
                            Zero Commission Plan
                          </span>
                          <span style={{ fontSize: '11px', color: '#4b5563', fontWeight: 'bold' }}>
                            Base rate flat ₹0 commission on all dispatch streams
                          </span>

                          <button
                            type="button"
                            onClick={() => alert("🎉 Current active partner plan standard: waives per-ride platform base commissions. Gold and Silver tiers active.")}
                            style={{
                              backgroundColor: '#ffffff',
                              border: '1px solid #2563eb',
                              color: '#2563eb',
                              borderRadius: '8px',
                              padding: '8px 16px',
                              fontSize: '11px',
                              fontWeight: '800',
                              cursor: 'pointer',
                              width: 'fit-content'
                            }}
                          >
                            Subscribe Plan Now
                          </button>
                        </div>

                        {/* Rapido Rewards List */}
                        <span style={{ fontSize: '12px', fontWeight: '800', color: '#1f2937', textAlign: 'left', marginTop: '8px' }}>Captain Rewards program</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {/* Health Insurance Card */}
                          <div style={{
                            backgroundColor: '#f0fdf4',
                            borderRadius: '16px',
                            border: '1px solid #dcfce7',
                            padding: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            textAlign: 'left',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '900', color: '#166534' }}>Health Insurance Cover</span>
                              <span style={{ fontSize: '10px', color: '#15803d', fontWeight: 'bold' }}>🏥 Outward clinic cover up to ₹25,000</span>
                              <button
                                type="button"
                                onClick={() => alert("🏥 Health Insurance: Complete 20 rides weekly to get outward clinic cover of ₹25,000 for outpatient medical cover.")}
                                style={{
                                  backgroundColor: '#ffffff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px',
                                  padding: '6px 12px',
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  color: '#000',
                                  cursor: 'pointer',
                                  width: 'fit-content',
                                  marginTop: '8px',
                                  boxSizing: 'border-box'
                                }}
                              >
                                View Details
                              </button>
                            </div>
                            <span style={{ fontSize: '32px' }}>🧑‍⚕️</span>
                          </div>

                          {/* Accidental Insurance Card */}
                          <div style={{
                            backgroundColor: '#fefaf0',
                            borderRadius: '16px',
                            border: '1px solid #fef3c7',
                            padding: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            textAlign: 'left',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '900', color: '#b45309' }}>Accidental Protection</span>
                              <span style={{ fontSize: '10px', color: '#d97706', fontWeight: 'bold' }}>🏍️ ₹2,0,000 active accidental cover</span>
                              <button
                                type="button"
                                onClick={() => alert("🛡️ Accidental Cover: Active ₹2,00,000 accidental cover, details available on priority verification status.")}
                                style={{
                                  backgroundColor: '#ffffff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px',
                                  padding: '6px 12px',
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  color: '#000',
                                  cursor: 'pointer',
                                  width: 'fit-content',
                                  marginTop: '8px',
                                  boxSizing: 'border-box'
                                }}
                              >
                                View Details
                              </button>
                            </div>
                            <span style={{ fontSize: '32px' }}>🏍️</span>
                          </div>

                          {/* Medicine Discount Card */}
                          <div style={{
                            backgroundColor: '#faf5ff',
                            borderRadius: '16px',
                            border: '1px solid #f3e8ff',
                            padding: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            textAlign: 'left',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '900', color: '#6b21a8' }}>Medicine Cashbacks</span>
                              <span style={{ fontSize: '10px', color: '#7e22ce', fontWeight: 'bold' }}>💊 Flat 10% off Apollo Pharmacy</span>
                              <button
                                type="button"
                                onClick={() => alert("💊 Medicine Discount: Show JoldiGo Captain ID Card at any Apollo Pharmacy outlet to get flat 10% discount.")}
                                style={{
                                  backgroundColor: '#ffffff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px',
                                  padding: '6px 12px',
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  color: '#000',
                                  cursor: 'pointer',
                                  width: 'fit-content',
                                  marginTop: '8px',
                                  boxSizing: 'border-box'
                                }}
                              >
                                View Code
                              </button>
                            </div>
                            <span style={{ fontSize: '32px' }}>💊</span>
                          </div>
                        </div>
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

            {/* Voice Co-Pilot Controls */}
            <div className="mt-4 pt-3 border-t border-white/5 flex flex-col gap-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-[11px] font-bold text-gray-300">🎙️ Voice Command Co-Pilot</span>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={isCoPilotEnabled}
                    onChange={(e) => setIsCoPilotEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
              <p className="text-[9px] text-gray-500 leading-normal px-1">
                Enable hands-free dispatcher controls. Say <b className="text-gray-400">"Accept"</b>, <b className="text-gray-400">"Decline"</b>, <b className="text-gray-400">"Start"</b>, or <b className="text-gray-400">"SOS"</b> to command the JoldiGo application.
              </p>
            </div>

          </div>
        )}

        {/* DRIVER SIDEBAR DRAWER MENU */}
        {showSidebar && (
          <div 
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: '240px',
              backgroundColor: '#111317',
              borderRight: '1px solid rgba(255, 255, 255, 0.1)',
              zIndex: 10000,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '4px 0 30px rgba(0, 0, 0, 0.8)'
            }}
            className="animate-slide-right text-left"
          >
            <div>
              {/* Header card with gradient */}
              <div 
                style={{
                  background: 'linear-gradient(135deg, #10b981, #047857)',
                  padding: '20px 16px 16px 16px',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="drv-avatar-large" style={{ width: '40px', height: '40px', fontSize: '18px', backgroundColor: '#fff', color: '#000', borderRadius: '50%', display: 'flex', alignItems: 'center', justify: 'center', fontWeight: 'bold' }}>
                    {currentDriver.avatar}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '13px', margin: 0, fontWeight: '800' }}>{currentDriver.name}</h4>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      4.6 ★
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowProfile(true);
                    setShowSidebar(false);
                  }}
                  className="bg-white/20 hover:bg-white/30 border-none rounded-full px-3 py-1 text-[9px] font-black text-white cursor-pointer uppercase transition-colors"
                >
                  Profile &gt;
                </button>
              </div>

              {/* Sidebar Menu Items */}
              <div className="flex flex-col p-2 gap-1 mt-2">
                {[
                  { icon: '📁', label: 'Earnings', desc: 'Transfer Money to Bank, History', action: () => { setTab('earnings'); setShowSidebar(false); } },
                  { icon: '💵', label: 'Incentives and More', desc: 'Know how you get paid', action: () => { setTab('subscription'); setShowSidebar(false); } },
                  { icon: '🎁', label: 'Rewards', desc: 'Insurance and Discounts', action: () => { setTab('subscription'); setShowSidebar(false); } },
                  { icon: '📜', label: 'Tariff Guide', desc: 'Pricing transparency policies', action: () => { setShowTariffGuide(true); setShowSidebar(false); } },
                  { icon: '🎛️', label: 'Service Manager', desc: 'Auto, Cab & Courier status', action: () => { setTab('garage'); setShowSidebar(false); } },
                  { icon: '🗺️', label: 'Demand Planner', desc: 'High Demand Areas & Hotspots', action: () => { alert("🗺️ Demand Hotspots highlighted in red rings on your standby screen."); setShowSidebar(false); } },
                  { icon: '🎧', label: 'Help', desc: 'Get support, Accident Insurance', action: () => { setTab('disputes'); setShowSidebar(false); } },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={item.action}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-transparent hover:bg-white/5 border-none text-left cursor-pointer transition-colors"
                    style={{ width: '100%' }}
                  >
                    <span style={{ fontSize: '15px' }}>{item.icon}</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff' }}>{item.label}</span>
                      <span style={{ fontSize: '9px', color: '#777' }}>{item.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom Footer switch toggle */}
            <div className="p-3 border-t border-white/5 flex flex-col gap-3">
              {/* Refer friends card */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 flex justify-between items-center">
                <div className="flex flex-col text-left">
                  <span className="text-[8px] text-emerald-400 font-bold uppercase">Refer Friends</span>
                  <span className="text-[9px] text-gray-300">Earn ₹100 per driver approval</span>
                </div>
                <button
                  type="button"
                  onClick={() => alert(`📋 Referral link copied! Share with prospective driver partners.`)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[9px] px-2 py-0.5 rounded cursor-pointer border-none"
                >
                  Refer Now
                </button>
              </div>

              {/* On-Ride Booking switch */}
              <div className="flex justify-between items-center py-1">
                <span className="text-[10px] font-black text-white uppercase tracking-wider">On-Ride Booking</span>
                <label className="switch-toggle-label relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOnRideBookingActive}
                    onChange={() => setIsOnRideBookingActive(!isOnRideBookingActive)}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <button
                type="button"
                onClick={() => setShowSidebar(false)}
                className="w-full bg-white/5 hover:bg-white/10 text-white font-bold text-[10px] py-1.5 rounded cursor-pointer border-none uppercase"
              >
                Close Menu
              </button>
            </div>
          </div>
        )}

        {/* DRIVER MY PROFILE FULLSCREEN OVERLAY */}
        {showProfile && (
          <div 
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: '#0c0e12',
              zIndex: 10005,
              display: 'flex',
              flexDirection: 'column'
            }}
            className="animate-slide-up"
          >
            {/* Header */}
            <div className="flex justify-between items-center p-3 border-b border-white/5 bg-black/40">
              <button
                type="button"
                onClick={() => setShowProfile(false)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' }}
              >
                ←
              </button>
              <span className="text-xs font-black text-white uppercase tracking-wider">My Profile</span>
              <button
                type="button"
                onClick={() => alert("Helpline: Dial 100 or check JoldiGo Help menu in sidebar.")}
                className="bg-white/5 border border-white/10 rounded px-2.5 py-1 text-[9px] font-black text-white hover:bg-white/10 cursor-pointer"
              >
                Help
              </button>
            </div>

            {/* Profile Content */}
            <div style={{ flex: 1, overflowY: 'auto' }} className="text-center">
              
              {/* Orange Sunset Landscape Banner Card */}
              <div 
                style={{
                  height: '140px',
                  background: 'linear-gradient(to bottom, #d97706, #f59e0b, #fffbeb)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingBottom: '20px'
                }}
              >
                {/* Silhouette graphics inside CSS */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40px', opacity: 0.1, background: 'radial-gradient(circle, #000 20%, transparent 80%)' }}></div>
                
                {/* Big Avatar */}
                <div 
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    border: '3px solid #0c0e12',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    fontWeight: 'bold',
                    color: '#000',
                    zIndex: 2,
                    marginBottom: '-32px'
                  }}
                >
                  {currentDriver.avatar}
                </div>
              </div>

              {/* Name & Rating spacer */}
              <div style={{ marginTop: '40px', padding: '0 16px' }}>
                <h3 className="text-sm font-black text-white mb-1">{currentDriver.name}</h3>
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Verified Partner</span>
              </div>

              {/* Stats Row */}
              <div className="flex gap-4 justify-around py-4 px-6 mt-2 border-y border-white/5 bg-black/20">
                <div className="flex flex-col items-center">
                  <span className="text-[14px] font-black text-white flex items-center gap-1">4.6 ⭐</span>
                  <span className="text-[8px] text-gray-500 uppercase tracking-wider font-bold">Rating</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[14px] font-black text-white">382</span>
                  <span className="text-[8px] text-gray-500 uppercase tracking-wider font-bold">Orders</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[14px] font-black text-white">2.7 Yrs</span>
                  <span className="text-[8px] text-gray-500 uppercase tracking-wider font-bold">Experience</span>
                </div>
              </div>

              {/* Submenu Options List */}
              <div className="p-3 flex flex-col gap-2 mt-2">
                {[
                  { icon: '👤', label: 'Profile Info', action: () => alert(`Name: ${currentDriver.name}\nVehicle: ${getVehicleLabel(currentDriver.vehicleType)} (${currentDriver.vehicleNumber})\nPhone: ${currentDriver.phone}`) },
                  { icon: '🪪', label: 'JoldiGo ID Card', action: () => setShowIdCard(true) },
                  { icon: '📁', label: 'Documents (RC, DL, PAN)', action: () => { setShowProfile(false); setTab('garage'); } },
                  { icon: '🌐', label: 'Language Settings', action: () => alert("Language preference: Bengali & English quick messaging enabled.") },
                ].map((option, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={option.action}
                    className="flex justify-between items-center p-3 rounded-lg bg-black/40 border border-white/5 hover:border-white/10 cursor-pointer text-left transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{option.icon}</span>
                      <span className="text-xs font-bold text-gray-300">{option.label}</span>
                    </div>
                    <span className="text-xs text-gray-600 font-bold">&gt;</span>
                  </button>
                ))}

                {/* Logout Button */}
                <button
                  type="button"
                  onClick={() => {
                    setShowProfile(false);
                    alert("Logging out from active simulator session...");
                  }}
                  className="w-full bg-transparent hover:bg-white/5 border border-white/15 rounded-lg py-2.5 font-extrabold text-[10px] text-white uppercase tracking-wider mt-4 cursor-pointer transition-colors"
                >
                  Logout
                </button>

                {/* Delete Account */}
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this simulated driver profile? This action will reset driver logs.")) {
                      setShowProfile(false);
                    }
                  }}
                  className="w-full bg-red-950/20 hover:bg-red-900/30 border border-red-500/20 rounded-lg py-2.5 font-black text-[10px] text-red-400 uppercase tracking-wider cursor-pointer transition-colors"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* JOLDIGO DIGITAL ID CARD MODAL */}
        {showIdCard && (
          <div className="admin-modal-overlay flex items-center justify-center p-4" style={{ zIndex: 11010 }}>
            <div className="card-glow animate-bounce-in w-full max-w-[280px] rounded-2xl bg-[#0e1116] border border-white/10 p-5 text-center flex flex-col items-center gap-4">
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block">JoldiGo verified captain</span>
              
              <div 
                style={{
                  width: '100%',
                  height: '150px',
                  backgroundColor: '#1b1f26',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  position: 'relative'
                }}
              >
                {/* ID badge circle */}
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#fff', color: '#000', display: 'flex', alignItems: 'center', justify: 'center', fontSize: '20px', fontWeight: 'bold' }}>
                  {currentDriver.avatar}
                </div>
                <div className="flex flex-col">
                  <span className="text-[12px] font-extrabold text-white">{currentDriver.name}</span>
                  <span className="text-[9px] text-gray-500 font-mono mt-0.5">{currentDriver.vehicleNumber}</span>
                </div>
                <div className="bg-emerald-500/10 text-emerald-400 text-[8px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-wider absolute top-3 right-3">
                  ✓ Verified
                </div>
              </div>

              {/* Barcode representation */}
              <div className="flex flex-col gap-1 w-full items-center">
                <div style={{ height: '24px', width: '120px', background: 'repeating-linear-gradient(90deg, #fff 0px, #fff 2px, transparent 2px, transparent 6px, #fff 6px, #fff 7px)', opacity: 0.8 }}></div>
                <span className="text-[8px] text-gray-500 font-mono">UID: {currentDriver.id.toUpperCase()}</span>
              </div>

              <button
                type="button"
                onClick={() => setShowIdCard(false)}
                className="bg-white/5 hover:bg-white/10 text-white font-bold text-[10px] px-4 py-1.5 rounded cursor-pointer border border-white/10 uppercase"
              >
                Close ID Card
              </button>
            </div>
          </div>
        )}

        {/* INCENTIVES STRUCTURE TABLE MODAL */}
        {showIncentives && (
          <div className="admin-modal-overlay flex items-center justify-center p-4" style={{ zIndex: 11010 }}>
            <div className="card-glow animate-bounce-in w-full max-w-[280px] rounded-2xl bg-[#0e1116] border border-white/10 p-5 text-center flex flex-col gap-3">
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block">💵 Incentives & Target Pay</span>
              
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex justify-between items-center text-xs border-b border-white/5 pb-1">
                  <span className="text-gray-400">Target</span>
                  <span className="text-white font-bold">Payout Bonus</span>
                </div>
                {[
                  { target: '5 completed rides', bonus: '₹120' },
                  { target: '10 completed rides', bonus: '₹300' },
                  { target: '15 completed rides', bonus: '₹550' },
                ].map((tier, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[10px] py-1 border-b border-white/5 text-left">
                    <span className="text-gray-300">{tier.target}</span>
                    <span className="text-emerald-400 font-bold">{tier.bonus}</span>
                  </div>
                ))}
              </div>

              <span className="text-[8px] text-gray-500 italic text-left block leading-snug mt-1">
                * Note: Targets reset daily at midnight. Bonuses are credited instantly upon target match confirmation.
              </span>

              <button
                type="button"
                onClick={() => setShowIncentives(false)}
                className="bg-white/5 hover:bg-white/10 text-white font-bold text-[10px] py-1.5 rounded cursor-pointer border border-white/10 uppercase mt-2"
              >
                Close
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Dynamic Calling Simulator Overlay */}
      {renderCallOverlay()}

      {/* Custom Alert Overlay */}
      {customAlert && (
        <div className="admin-modal-overlay flex items-center justify-center p-4" style={{ zIndex: 11050 }}>
          <div className="card-glow animate-bounce-in w-full max-w-[260px] rounded-2xl bg-[#0c0e12] border border-white/10 p-5 text-center flex flex-col items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center text-base border border-amber-500/30">
              🔔
            </div>
            <p className="text-[11px] text-gray-200 leading-snug font-medium whitespace-pre-line">{customAlert.message}</p>
            <button
              type="button"
              onClick={() => setCustomAlert(null)}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[10px] py-1.5 rounded cursor-pointer border-none uppercase transition-colors mt-1"
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {showTariffGuide && (
        <TariffGuideModal onClose={() => setShowTariffGuide(false)} />
      )}

      <div className="phone-home-bar"></div>
    </div>
    </>
  );
}
