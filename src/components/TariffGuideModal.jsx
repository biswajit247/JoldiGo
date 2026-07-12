import React, { useState } from 'react';
import { X, Shield, Info, Gauge } from 'lucide-react';

export default function TariffGuideModal({ onClose }) {
  const [distance, setDistance] = useState(12);
  const [vehicleType, setVehicleType] = useState('car_ac');
  const [weather, setWeather] = useState('clear');
  const [period, setPeriod] = useState('day');
  const [traffic, setTraffic] = useState('medium');
  const [fuelType, setFuelType] = useState('cng');

  // Math calculations matching SimulatorContext logic
  const getTariffCalculation = () => {
    const baseFare = vehicleType === 'bike' ? 20.00 : 35.00;
    const ratePerKm = vehicleType === 'bike' ? 8.00 : (vehicleType === 'car_ac' ? 15.00 : 12.00);
    const distanceFare = distance * ratePerKm;

    // CNG indexing surcharge (+10%), Petrol surcharge (+15%)
    const fuelIndexSurcharge = fuelType === 'cng' ? (distanceFare * 0.10) : (distanceFare * 0.15);
    const rawSubtotal = baseFare + distanceFare + fuelIndexSurcharge;

    // Multipliers
    const weatherMult = weather === 'rain' ? 1.15 : (weather === 'waterlogged' ? 1.25 : 1.00);
    const nightMult = period === 'night' ? 1.20 : 1.00;
    const trafficMult = traffic === 'heavy' ? 1.15 : (traffic === 'medium' ? 1.08 : 1.00);

    // Dynamic surge (capped strictly at 1.5x under West Bengal compliance rules)
    const rawSurge = weatherMult * nightMult * trafficMult;
    const finalSurgeMultiplier = parseFloat(Math.min(1.50, rawSurge).toFixed(2));

    const grossBaseRideFare = parseFloat((rawSubtotal * finalSurgeMultiplier).toFixed(2));
    const gstAmount = parseFloat((grossBaseRideFare * 0.05).toFixed(2));
    const safetyInsurancePremium = 2.00;
    const tollEstimate = distance > 15 ? 35 : 0;

    // Transparent splits
    const totalFare = (weather === 'waterlogged' && vehicleType === 'bike') 
      ? 0 
      : parseFloat((grossBaseRideFare + gstAmount + safetyInsurancePremium + tollEstimate).toFixed(2));

    const driverPayout = parseFloat((grossBaseRideFare * 0.95).toFixed(2));
    const platformCommission = parseFloat((grossBaseRideFare * 0.05).toFixed(2));

    return {
      baseFare,
      distanceFare,
      fuelIndexSurcharge,
      finalSurgeMultiplier,
      grossBaseRideFare,
      gstAmount,
      safetyInsurancePremium,
      tollEstimate,
      totalFare,
      driverPayout,
      platformCommission
    };
  };

  const cal = getTariffCalculation();

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-2xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Shield className="text-yellow-400" size={22} />
            <div>
              <h2 className="text-lg font-bold text-white font-sans">Tariff & Transparency Guide</h2>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Dynamic Indexing Policy & Split Auditing</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="rounded-lg p-1 text-gray-400 hover:bg-white/5 hover:text-white transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sliders Area & Pricing splits side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Sliders Columns */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-2">Configure Simulation</h3>
            
            {/* Vehicle Type Select */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 block mb-1">Vehicle Category</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'bike', label: 'App Bike' },
                  { id: 'car_non_ac', label: 'Non-AC Car' },
                  { id: 'car_ac', label: 'AC Sedan' }
                ].map(v => (
                  <button
                    key={v.id}
                    onClick={() => setVehicleType(v.id)}
                    className={`p-2 rounded-lg text-xs font-bold border transition-all ${
                      vehicleType === v.id 
                        ? 'bg-yellow-400/10 border-yellow-400 text-yellow-400' 
                        : 'bg-black/30 border-white/5 text-gray-400 hover:bg-white/5'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Distance Slider */}
            <div>
              <div className="flex justify-between text-[11px] font-bold text-gray-400 mb-1">
                <span>Trip Distance</span>
                <span className="text-white">{distance} km</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="35" 
                value={distance} 
                onChange={(e) => setDistance(parseInt(e.target.value))}
                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-yellow-400"
              />
            </div>

            {/* Fuel Surcharge Type */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 block mb-1">Dynamic Fuel Index</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'cng', label: 'CNG Surcharge (+10%)' },
                  { id: 'petrol', label: 'Petrol Surcharge (+15%)' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFuelType(f.id)}
                    className={`p-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                      fuelType === f.id 
                        ? 'bg-indigo-500/15 border-indigo-500 text-indigo-400' 
                        : 'bg-black/20 border-white/5 text-gray-500 hover:bg-white/5'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Weather Multiplier Selector */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 block mb-1">Weather Multiplier</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'clear', label: 'Clear (1.0x)' },
                  { id: 'rain', label: 'Rain (1.15x)' },
                  { id: 'waterlogged', label: 'Flooded (1.25x)' }
                ].map(w => (
                  <button
                    key={w.id}
                    onClick={() => setWeather(w.id)}
                    className={`p-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                      weather === w.id 
                        ? 'bg-blue-500/10 border-blue-500 text-blue-400' 
                        : 'bg-black/20 border-white/5 text-gray-500 hover:bg-white/5'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Period Multiplier */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 block mb-1">Time Period Surcharge</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'day', label: 'Day (1.0x)' },
                  { id: 'night', label: 'Night (1.2x)' }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPeriod(p.id)}
                    className={`p-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                      period === p.id 
                        ? 'bg-purple-500/10 border-purple-500 text-purple-400' 
                        : 'bg-black/20 border-white/5 text-gray-500 hover:bg-white/5'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Traffic Congestion */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 block mb-1">Traffic Congestion</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'clear', label: 'Clear (1.0x)' },
                  { id: 'medium', label: 'Moderate (1.08x)' },
                  { id: 'heavy', label: 'Heavy (1.15x)' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTraffic(t.id)}
                    className={`p-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                      traffic === t.id 
                        ? 'bg-orange-500/10 border-orange-500 text-orange-400' 
                        : 'bg-black/20 border-white/5 text-gray-500 hover:bg-white/5'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Fare Calculation Display */}
          <div className="flex flex-col justify-between bg-black/40 border border-white/5 rounded-xl p-4">
            <div>
              <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">Live Fare Breakdowns</h3>
              
              <div className="space-y-2 text-xs font-sans text-gray-300">
                <div className="flex justify-between">
                  <span className="text-gray-500">Base Minimum Fare:</span>
                  <span>₹{cal.baseFare.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Distance Travel Charge:</span>
                  <span>₹{cal.distanceFare.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Fuel Surcharge ({fuelType.toUpperCase()}):</span>
                  <span className="text-indigo-300">+₹{cal.fuelIndexSurcharge.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Accrued Surge Multiplier:</span>
                  <span className="text-yellow-400 font-mono font-bold">x{cal.finalSurgeMultiplier}</span>
                </div>

                <div className="border-t border-white/5 my-2 pt-2 flex justify-between text-gray-200">
                  <span>Gross Ride Fare:</span>
                  <span>₹{cal.grossBaseRideFare.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-500">GST (5% added):</span>
                  <span>₹{cal.gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-500">Safety Insurance Pool:</span>
                  <span>₹{cal.safetyInsurancePremium.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-500">Estimated Bridge Tolls:</span>
                  <span>₹{cal.tollEstimate.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Total Block */}
            <div className="border-t border-white/10 mt-4 pt-3">
              {weather === 'waterlogged' && vehicleType === 'bike' ? (
                <div className="bg-red-950/30 border border-red-500/20 rounded-lg p-2 text-center text-[10px] text-red-400 font-bold">
                  ⚠️ Bike services suspended due to severe flooding
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-baseline mb-3">
                    <span className="text-xs font-bold text-white">Estimated Passenger Total:</span>
                    <span className="text-2xl font-black text-yellow-400 font-mono">₹{cal.totalFare.toFixed(2)}</span>
                  </div>

                  {/* Splits Bar */}
                  <div className="bg-white/5 border border-white/5 rounded-lg p-2.5 text-[11px] space-y-1.5">
                    <div className="flex justify-between text-emerald-400 font-bold">
                      <span className="flex items-center gap-1">🟢 Driver Earnings (95%):</span>
                      <span>₹{cal.driverPayout.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span className="flex items-center gap-1">⚪ Platform Fee (5%):</span>
                      <span>₹{cal.platformCommission.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Regulatory Info Box */}
        <div className="mt-5 p-3 rounded-lg bg-white/5 border border-white/5 text-[11px] text-gray-400 leading-relaxed font-sans flex gap-2">
          <Info className="text-yellow-400 shrink-0 mt-0.5" size={14} />
          <div>
            <b>West Bengal Aggregator Guidelines Compliance:</b> Our booking algorithms hard-constrain surge multipliers to <b>1.50x maximum limit</b>. Flat commissions are restricted to <b>5%</b>, with 95% credited directly to our captain's wallet. Standard 5% GST is split for local state infrastructure pools.
          </div>
        </div>
        
      </div>
    </div>
  );
}
