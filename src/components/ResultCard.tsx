import React, { useState } from 'react';
import { CouponCode } from '../types';
import { Copy, Check, ExternalLink, Clock, Target, Bookmark, BookmarkCheck, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
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

  const isVerified = code.status === 'verified';
  const isFailed = code.status === 'failed' || code.status === 'expired';
  const isUnverified = code.status === 'unverified' || code.status === 'error';

  const getStatusBadge = () => {
    if (isVerified) {
      return (
        <div className="flex items-center gap-1 text-[10px] font-display uppercase tracking-widest px-2 py-1 rounded border bg-hunter-green/10 border-hunter-green/40 text-hunter-green shadow-[0_0_10px_rgba(10,255,0,0.2)]">
          <Target size={12} className="animate-pulse" />
          VERIFIED
        </div>
      );
    }
    if (isFailed) {
      return (
        <div className="flex items-center gap-1 text-[10px] font-display uppercase tracking-widest px-2 py-1 rounded border bg-red-500/10 border-red-500/40 text-red-400">
          <XCircle size={12} />
          EXPIRED
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-[10px] font-display uppercase tracking-widest px-2 py-1 rounded border bg-yellow-500/10 border-yellow-500/40 text-yellow-400">
        <HelpCircle size={12} />
        UNVERIFIED
      </div>
    );
  };

  const getConfidenceColor = () => {
    if (code.successRate >= 86) return 'text-hunter-green';
    if (code.successRate >= 61) return 'text-hunter-cyan';
    if (code.successRate >= 31) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, delay: rank * 0.1 }}
      className={`
        group relative bg-hunter-surface backdrop-blur-md border transition-all duration-300 rounded-xl overflow-hidden p-5
        ${isVerified ? 'border-hunter-green/50 hover:border-hunter-green shadow-[0_0_30px_-5px_rgba(10,255,0,0.2)]' : ''}
        ${isFailed ? 'border-red-500/30 opacity-60' : ''}
        ${isUnverified ? 'border-yellow-500/30' : 'border-hunter-border hover:border-hunter-cyan/50'}
        ${rank === 0 && isVerified ? 'ring-1 ring-hunter-green/30' : ''}
      `}
    >
      {/* Target Locked Graphic Overlay */}
      <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none opacity-20 group-hover:opacity-100 transition-opacity">
        <svg viewBox="0 0 100 100" className={`w-full h-full stroke-2 fill-none ${isVerified ? 'stroke-hunter-green' : 'stroke-hunter-muted'}`}>
          <path d="M10,10 L30,10 M10,10 L10,30" />
          <path d="M90,10 L70,10 M90,10 L90,30" />
        </svg>
      </div>

      {/* Rank/Verified Badge */}
      <div className="absolute top-0 right-0 p-3 flex gap-2">
        {getStatusBadge()}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">

        {/* Left: Code Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h3 className={`
              text-3xl font-black font-mono tracking-wider group-hover:drop-shadow-[0_0_5px_rgba(0,240,255,0.5)] transition-colors
              ${isVerified ? 'text-white group-hover:text-hunter-green' : 'text-hunter-muted'}
            `}>
              {code.code}
            </h3>
            {rank === 0 && isVerified && (
              <span className="bg-hunter-green text-black text-[10px] font-bold px-1.5 py-0.5 rounded skew-x-[-10deg]">MVP</span>
            )}
          </div>
          <p className="text-sm text-hunter-cyan/80 font-medium">{code.description}</p>

          {/* Real Stats */}
          <div className="flex items-center gap-4 text-xs text-hunter-muted font-mono mt-2">
            <div className="flex items-center gap-1">
              <Clock size={12} />
              {code.lastVerified}
            </div>
            <div className="flex items-center gap-1">
              <ExternalLink size={12} />
              {code.source}
            </div>
            {code.testedRegion && (
              <div className="text-hunter-cyan">
                Tested: {code.testedRegion}
              </div>
            )}
          </div>

          {/* Confidence Bar */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-hunter-muted font-mono">CONFIDENCE:</span>
            <div className="flex-1 max-w-[120px] h-1.5 bg-black/40 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${getConfidenceColor().replace('text-', 'bg-')}`}
                style={{ width: `${code.successRate}%` }}
              />
            </div>
            <span className={`text-[10px] font-mono font-bold ${getConfidenceColor()}`}>
              {code.successRate}%
            </span>
          </div>

          {/* Warning for unverified */}
          {isUnverified && (
            <div className="flex items-center gap-1 text-[10px] text-yellow-400/80 font-mono mt-1">
              <AlertTriangle size={10} />
              Not tested - use at your own risk
            </div>
          )}

          {/* Error message for failed */}
          {code.errorMessage && (
            <div className="flex items-center gap-1 text-[10px] text-red-400/80 font-mono mt-1">
              <XCircle size={10} />
              {code.errorMessage}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleCopy}
            disabled={isFailed}
            className={`
              flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 font-bold font-display rounded-lg transition-all active:scale-95 duration-100 min-w-[140px]
              ${isFailed
                ? 'bg-hunter-surface text-hunter-muted cursor-not-allowed border border-hunter-border'
                : isVerified
                  ? 'bg-hunter-cyan/10 border border-hunter-cyan/50 text-hunter-cyan hover:bg-hunter-green hover:text-black hover:border-hunter-green shadow-[0_0_15px_rgba(0,240,255,0.2)] group-hover:shadow-[0_0_15px_rgba(10,255,0,0.4)]'
                  : 'bg-yellow-500/10 border border-yellow-500/50 text-yellow-400 hover:bg-yellow-500 hover:text-black'
              }
            `}
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? 'COPIED' : isFailed ? 'EXPIRED' : 'EXTRACT'}
          </button>

          <button
            onClick={handleSave}
            disabled={saved || isFailed}
            className={`
              px-4 py-3 border rounded-lg transition-colors flex items-center justify-center gap-2 font-bold font-display
              ${saved ? 'bg-hunter-green/20 border-hunter-green text-hunter-green' : ''}
              ${isFailed ? 'border-hunter-border text-hunter-muted cursor-not-allowed opacity-50' : ''}
              ${!saved && !isFailed ? 'border-hunter-border text-gray-400 hover:bg-hunter-cyan/10 hover:text-hunter-cyan hover:border-hunter-cyan/50' : ''}
            `}
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
