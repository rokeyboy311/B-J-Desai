import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, ShieldCheck, KeyRound, ArrowRight, Delete, AlertCircle, Database, Server } from 'lucide-react';

export const PinScreen: React.FC = () => {
  const { unlockWithPin, error: authError } = useAuth();
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const displayError = localError || authError;

  const handleSubmit = async (pinToSubmit?: string) => {
    const value = pinToSubmit !== undefined ? pinToSubmit : pin;
    if (!value || value.length < 4) {
      setLocalError('Please enter a valid PIN code');
      triggerShake();
      return;
    }

    setIsSubmitting(true);
    setLocalError(null);
    try {
      const success = await unlockWithPin(value);
      if (!success) {
        setLocalError('Incorrect PIN. Access Denied.');
        triggerShake();
        setPin('');
      }
    } catch (err: any) {
      setLocalError(err.message || 'Verification failed');
      triggerShake();
      setPin('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleKeypadPress = (digit: string) => {
    if (isSubmitting) return;
    setLocalError(null);
    if (pin.length < 16) {
      const newPin = pin + digit;
      setPin(newPin);
    }
  };

  const handleBackspace = () => {
    if (isSubmitting) return;
    setLocalError(null);
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (isSubmitting) return;
    setLocalError(null);
    setPin('');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 select-none">
      {/* Background Decorative Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      <div className="relative w-full max-w-md z-10">
        {/* Main Card */}
        <div 
          className={`bg-slate-900/90 border border-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl p-6 sm:p-8 transition-transform duration-200 ${
            shake ? 'animate-shake ring-2 ring-red-500/50' : ''
          }`}
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-lg shadow-indigo-500/25 mb-4 ring-4 ring-indigo-500/10">
              <KeyRound className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
              Bina Enterprise
            </h1>
            <p className="text-xs text-indigo-400 font-medium tracking-wide uppercase mt-1">
              CENTRAL SHARED SYSTEM
            </p>
            <p className="text-sm text-slate-400 mt-2">
              Enter security password to access ERP system
            </p>
          </div>

          <form onSubmit={handleFormSubmit}>
            {/* Password Input */}
            <div className="space-y-4 mb-6">
              <div className="relative flex items-center justify-center">
                <input
                  type={showPin ? "text" : "password"}
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    setLocalError(null);
                  }}
                  placeholder="Enter password..."
                  autoComplete="current-password"
                  className="w-full text-center tracking-normal text-lg font-sans py-3.5 px-12 bg-slate-950/80 border border-slate-700/60 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition cursor-pointer"
                >
                  {showPin ? 'Hide' : 'Show'}
                </button>
              </div>

              {/* Error Message */}
              {displayError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/60 border border-red-800/60 text-red-300 text-xs font-medium animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{displayError}</span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || pin.length === 0}
              className="w-full h-12 bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 active:scale-[0.99] text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying from Database...</span>
                </>
              ) : (
                <>
                  <span>Unlock Accounting ERP</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Architecture info badges */}
          <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Central Database</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-blue-400" />
              <span>Single Tenant ERP</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>PIN Protected</span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-400 mt-4">
          B_D Enterprise • Shared Real-time Construction Accounting System
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
    </div>
  );
};

export default PinScreen;
