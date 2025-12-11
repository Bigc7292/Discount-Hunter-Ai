import React, { useState } from 'react';
import { CouponCode } from '../types';
import { Copy, Check, ExternalLink, Clock, Target, Bookmark, BookmarkCheck } from 'lucide-react';
import { motion } from 'framer-motion';

interface ResultCardProps {
  code: CouponCode;
  rank: number;
  onSave?: (code: CouponCode) => void;
}

const ResultCard: React.FC<ResultCardProps> = ({ code, rank, onSave }) => {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (onSave) {
        onSave(code);
        setSaved(true);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, delay: rank * 0.1 }}
      className={`group relative bg-hunter-surface backdrop-blur-md border border-hunter-border hover:border-hunter-green/50 transition-all duration-300 rounded-xl overflow-hidden p-5 ${rank === 0 ? 'shadow-[0_0_30px_-5px_rgba(10,255,0,0.2)] ring-1 ring-hunter-green/30' : ''}`}
    >
      {/* Target Locked Graphic Overlay (Neon Green on Hover) */}
      <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none opacity-20 group-hover:opacity-100 transition-opacity">
        <svg viewBox="0 0 100 100" className="w-full h-full stroke-hunter-green fill-none stroke-[2]">
             <path d="M10,10 L30,10 M10,10 L10,30" />
             <path d="M90,10 L70,10 M90,10 L90,30" />
        </svg>
      </div>

      {/* Rank/Verified Badge */}
      <div className="absolute top-0 right-0 p-3 flex gap-2">
        <div className="flex items-center gap-1 text-[10px] font-display uppercase tracking-widest px-2 py-1 rounded border bg-hunter-green/10 border-hunter-green/40 text-hunter-green shadow-[0_0_10px_rgba(10,255,0,0.2)]">
          <Target size={12} className="animate-pulse" />
          VERIFIED
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        
        {/* Left: Code Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h3 className="text-3xl font-black font-mono tracking-wider text-white group-hover:text-hunter-green transition-colors drop-shadow-[0_0_5px_rgba(0,240,255,0.5)]">
              {code.code}
            </h3>
            {rank === 0 && (
              <span className="bg-hunter-green text-black text-[10px] font-bold px-1.5 py-0.5 rounded skew-x-[-10deg]">MVP</span>
            )}
          </div>
          <p className="text-sm text-hunter-cyan/80 font-medium">{code.description}</p>
          <div className="flex items-center gap-4 text-xs text-hunter-muted font-mono mt-2">
             <div className="flex items-center gap-1">
               <Clock size={12} />
               Sync: {code.lastVerified}
             </div>
             <div className="flex items-center gap-1">
               <ExternalLink size={12} />
               Node: {code.source}
             </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={handleCopy}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-hunter-cyan/10 border border-hunter-cyan/50 text-hunter-cyan hover:bg-hunter-green hover:text-black hover:border-hunter-green font-bold font-display rounded-lg transition-all active:scale-95 duration-100 min-w-[140px] shadow-[0_0_15px_rgba(0,240,255,0.2)] group-hover:shadow-[0_0_15px_rgba(10,255,0,0.4)] clip-path-polygon"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? 'COPIED' : 'EXTRACT'}
          </button>
          
          <button 
            onClick={handleSave}
            disabled={saved}
            className={`px-4 py-3 border rounded-lg transition-colors flex items-center justify-center gap-2 font-bold font-display ${saved ? 'bg-hunter-green/20 border-hunter-green text-hunter-green' : 'border-hunter-border text-gray-400 hover:bg-hunter-cyan/10 hover:text-hunter-cyan hover:border-hunter-cyan/50'}`}
            title="Save to Database"
          >
             {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
             <span className="hidden sm:inline">{saved ? 'ARCHIVED' : 'ARCHIVE'}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ResultCard;