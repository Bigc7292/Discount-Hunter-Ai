import React from 'react';
import { X, Check, Zap, Star, ShieldCheck } from 'lucide-react';

export type CheckoutPlan = 'yearly' | 'lifetime';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: (plan: CheckoutPlan) => void;
}

const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, onUpgrade }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl grid md:grid-cols-3 bg-hunter-surface border border-hunter-border rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl">
        <button onClick={onClose} className="absolute top-4 right-4 z-10 text-hunter-muted hover:text-white bg-black/50 rounded-full p-1">
            <X size={20} />
        </button>

        {/* Free — gated verified outcomes (verify-first unchanged) */}
        <div className="p-8 flex flex-col border-b md:border-b-0 md:border-r border-hunter-border">
            <div className="mb-6">
                <h3 className="text-xl font-bold text-white font-display tracking-wide">Free</h3>
                <div className="text-4xl font-mono font-bold text-hunter-muted mt-2">$0</div>
                <p className="text-sm text-gray-500 mt-2">Gated verified outcomes — verify-first, never untested codes.</p>
            </div>

            <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm text-hunter-muted">
                    <Check size={16} className="text-gray-500" /> Limited verified searches
                </li>
                <li className="flex items-center gap-3 text-sm text-hunter-muted">
                    <Check size={16} className="text-gray-500" /> Checkout-verified codes only
                </li>
                <li className="flex items-center gap-3 text-sm text-hunter-muted">
                    <Check size={16} className="text-gray-500" /> No untested codes surfaced
                </li>
            </ul>

            <button onClick={onClose} className="w-full py-3 rounded-lg border border-hunter-border text-hunter-text hover:bg-hunter-bg font-bold transition-all font-display tracking-wider">
                CONTINUE FREE
            </button>
        </div>

        {/* Yearly — primary paid ≈ $24/yr */}
        <div className="p-8 flex flex-col bg-hunter-cyan/5 relative border-b md:border-b-0 md:border-r border-hunter-border">
            <div className="absolute top-0 right-0 bg-hunter-cyan text-black text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                PRIMARY
            </div>

            <div className="mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2 font-display tracking-wide">
                    Yearly <Zap size={18} className="text-hunter-purple animate-pulse" />
                </h3>
                <div className="text-4xl font-mono font-bold text-white mt-2">~$24<span className="text-sm font-sans text-gray-500 font-normal">/yr</span></div>
                <p className="text-sm text-hunter-cyan mt-2">Verified access for one year.</p>
            </div>

            <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm text-white">
                    <div className="bg-hunter-cyan/20 p-1 rounded-full"><Check size={12} className="text-hunter-cyan" /></div>
                    Full verified access
                </li>
                <li className="flex items-center gap-3 text-sm text-white">
                    <div className="bg-hunter-cyan/20 p-1 rounded-full"><Check size={12} className="text-hunter-cyan" /></div>
                    Higher search limits
                </li>
                <li className="flex items-center gap-3 text-sm text-white">
                    <div className="bg-hunter-cyan/20 p-1 rounded-full"><Check size={12} className="text-hunter-cyan" /></div>
                    Verify-first DoD unchanged
                </li>
            </ul>

            <button
                onClick={() => onUpgrade('yearly')}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-hunter-cyan to-hunter-green text-black font-bold shadow-lg shadow-hunter-cyan/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 font-display tracking-wider"
            >
                <Star size={18} className="fill-black/20" /> GET VERIFIED ACCESS
            </button>
            <p className="text-center text-[10px] text-gray-500 mt-3">Secured by Stripe. Cancel anytime.</p>
        </div>

        {/* Lifetime — optional LTD SKU */}
        <div className="p-8 flex flex-col relative">
            <div className="absolute top-0 right-0 bg-hunter-purple text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                LTD
            </div>

            <div className="mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2 font-display tracking-wide">
                    Lifetime <ShieldCheck size={18} className="text-hunter-cyan" />
                </h3>
                <div className="text-4xl font-mono font-bold text-white mt-2">$49<span className="text-sm font-sans text-gray-500 font-normal"> LTD</span></div>
                <p className="text-sm text-hunter-cyan mt-2">Lifetime verified access.</p>
            </div>

            <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm text-white">
                    <div className="bg-hunter-purple/20 p-1 rounded-full"><Check size={12} className="text-hunter-purple" /></div>
                    Lifetime verified access
                </li>
                <li className="flex items-center gap-3 text-sm text-white">
                    <div className="bg-hunter-purple/20 p-1 rounded-full"><Check size={12} className="text-hunter-purple" /></div>
                    Same verify-first guarantees
                </li>
                <li className="flex items-center gap-3 text-sm text-white">
                    <div className="bg-hunter-purple/20 p-1 rounded-full"><Check size={12} className="text-hunter-purple" /></div>
                    One-time payment — optional LTD
                </li>
            </ul>

            <button
                onClick={() => onUpgrade('lifetime')}
                className="w-full py-3 rounded-lg border border-hunter-purple/50 bg-hunter-purple/10 text-white font-bold hover:bg-hunter-purple/20 active:scale-95 transition-all flex items-center justify-center gap-2 font-display tracking-wider"
            >
                <ShieldCheck size={18} /> LIFETIME VERIFIED ACCESS
            </button>
            <p className="text-center text-[10px] text-gray-500 mt-3">Secured by Stripe. One-time LTD.</p>
        </div>

      </div>
    </div>
  );
};

export default PricingModal;
