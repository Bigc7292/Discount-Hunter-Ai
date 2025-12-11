import React from 'react';
import { X, Check, Zap, Star } from 'lucide-react';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, onUpgrade }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl grid md:grid-cols-2 bg-hunter-surface border border-hunter-border rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
        <button onClick={onClose} className="absolute top-4 right-4 z-10 text-hunter-muted hover:text-white bg-black/50 rounded-full p-1">
            <X size={20} />
        </button>

        {/* Free Tier */}
        <div className="p-8 flex flex-col border-b md:border-b-0 md:border-r border-hunter-border">
            <div className="mb-6">
                <h3 className="text-xl font-bold text-white font-display tracking-wide">Starter Scout</h3>
                <div className="text-4xl font-mono font-bold text-hunter-muted mt-2">$0<span className="text-sm font-sans text-gray-500 font-normal">/mo</span></div>
                <p className="text-sm text-gray-500 mt-2">Perfect for occasional shoppers.</p>
            </div>
            
            <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm text-hunter-muted">
                    <Check size={16} className="text-gray-500" /> 5 Deep Searches / Hour
                </li>
                <li className="flex items-center gap-3 text-sm text-hunter-muted">
                    <Check size={16} className="text-gray-500" /> Basic Public Coupon Scan
                </li>
                <li className="flex items-center gap-3 text-sm text-hunter-muted">
                    <Check size={16} className="text-gray-500" /> Standard Speed
                </li>
            </ul>

            <button onClick={onClose} className="w-full py-3 rounded-lg border border-hunter-border text-hunter-text hover:bg-hunter-bg font-bold transition-all font-display tracking-wider">
                CONTINUE FREE
            </button>
        </div>

        {/* Pro Tier */}
        <div className="p-8 flex flex-col bg-hunter-cyan/5 relative">
            <div className="absolute top-0 right-0 bg-hunter-cyan text-black text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                MOST POPULAR
            </div>

            <div className="mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2 font-display tracking-wide">
                    Sniper Elite <Zap size={18} className="text-hunter-purple animate-pulse" />
                </h3>
                <div className="text-4xl font-mono font-bold text-white mt-2">$9.99<span className="text-sm font-sans text-gray-500 font-normal">/mo</span></div>
                <p className="text-sm text-hunter-cyan mt-2">Start with 7 days free. Then $9.99/mo.</p>
            </div>
            
            <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm text-white">
                    <div className="bg-hunter-cyan/20 p-1 rounded-full"><Check size={12} className="text-hunter-cyan" /></div>
                    <strong>Unlimited</strong> Deep Searches
                </li>
                <li className="flex items-center gap-3 text-sm text-white">
                    <div className="bg-hunter-cyan/20 p-1 rounded-full"><Check size={12} className="text-hunter-cyan" /></div>
                    Access Private Leaks & Discord
                </li>
                <li className="flex items-center gap-3 text-sm text-white">
                    <div className="bg-hunter-cyan/20 p-1 rounded-full"><Check size={12} className="text-hunter-cyan" /></div>
                    Priority "Stealth" Proxies
                </li>
                <li className="flex items-center gap-3 text-sm text-white">
                    <div className="bg-hunter-cyan/20 p-1 rounded-full"><Check size={12} className="text-hunter-cyan" /></div>
                    Auto-Apply Browser Extension
                </li>
            </ul>

            <button 
                onClick={onUpgrade}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-hunter-cyan to-hunter-green text-black font-bold shadow-lg shadow-hunter-cyan/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 font-display tracking-wider"
            >
                <Star size={18} className="fill-black/20" /> START 7-DAY FREE TRIAL
            </button>
            <p className="text-center text-[10px] text-gray-500 mt-3">Cancel anytime. Secured by Stripe.</p>
        </div>

      </div>
    </div>
  );
};

export default PricingModal;