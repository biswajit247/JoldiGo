import React, { useState, useEffect } from 'react';
import { ShieldCheck, Info, X, ChevronRight, HelpCircle } from 'lucide-react';

export default function TutorialTour({ onClose }) {
  const [step, setStep] = useState(1);

  const steps = [
    {
      title: "📊 Transparent Fare Splits",
      desc: "JoldiGo is built on complete transparency. We split fares showing exactly where every Rupee goes: 95% goes directly into the driver partner's wallet, with only a 5% platform service cut. No hidden algorithm deductions.",
      highlightElement: "payout-breakdown-card",
      actionLabel: "Next Guide ➜"
    },
    {
      title: "🔐 Cryptographic Contract Hash",
      desc: "Every single booking fare calculation is signed with an immutable SHA-256 cryptographic hash. This guarantees the driver and rider both pay and receive the exact negotiated amount. Any tampering instantly invalidates the contract.",
      highlightElement: "contract-hash-badge",
      actionLabel: "Next Guide ➜"
    },
    {
      title: "🛡️ Captain Safety Pools",
      desc: "Our flat 5% commissions are reinvested into our driver safety fund. This pool funds accidental insurance coverages, medical subsidies, and emergency dispatcher assistance.",
      highlightElement: "safety-pool-widget",
      actionLabel: "Finish Walkthrough 🎉"
    }
  ];

  const handleNext = () => {
    if (step < steps.length) {
      setStep(step + 1);
    } else {
      try {
        localStorage.setItem('joldigo_tutorial_completed', 'true');
      } catch (e) {
        console.warn("Storage write blocked:", e);
      }
      if (onClose) onClose();
    }
  };

  const handleSkip = () => {
    try {
      localStorage.setItem('joldigo_tutorial_completed', 'true');
    } catch (e) {
      console.warn("Storage write blocked:", e);
    }
    if (onClose) onClose();
  };

  const cur = steps[step - 1];

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-yellow-400/30 bg-slate-900/95 p-5 shadow-2xl text-left animate-bounce-in">
        
        {/* Step dots */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex gap-1.5">
            {[1, 2, 3].map(s => (
              <div 
                key={s} 
                className={`h-1.5 rounded-full transition-all duration-300 ${s === step ? 'w-6 bg-yellow-400' : 'w-1.5 bg-gray-700'}`}
              />
            ))}
          </div>
          <button 
            onClick={handleSkip} 
            className="text-[10px] uppercase font-bold text-gray-500 hover:text-white transition-colors"
          >
            Skip Tour
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <h2 className="text-sm font-black text-white font-sans flex items-center gap-1.5">
            <HelpCircle size={15} className="text-yellow-400" />
            {cur.title}
          </h2>
          <p className="text-xs text-gray-400 leading-relaxed font-sans">
            {cur.desc}
          </p>
        </div>

        {/* Guide helper prompt */}
        <div className="mt-4 p-2 bg-yellow-400/5 border border-yellow-400/10 rounded-lg text-[10px] text-yellow-400/80 flex gap-1.5 items-start">
          <Info size={11} className="shrink-0 mt-0.5" />
          <span>Locate this element on your screen after completing the walkthrough.</span>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 mt-4 pt-3 border-t border-white/5">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold text-xs py-2 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 shadow-md shadow-yellow-400/10"
          >
            {cur.actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
