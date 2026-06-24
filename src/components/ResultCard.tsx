/**
 * ResultCard — Displays a single checkout-verified coupon code.
 * Only renders for codes that passed real checkout simulation.
 */

import React, { useState } from 'react';
import { CouponCode } from '../types';
import {
  Copy, Check, ExternalLink, Clock, Bookmark, BookmarkCheck,
  ShieldCheck, XCircle, AlertTriangle, Zap, MapPin, Timer
} from 'lucide-react';
import { motion } from 'framer-motion';

interface ResultCardProps {
  code: CouponCode;
  rank: number;
  onSave?: (code: CouponCode) => void;
}

const ResultCard: React.FC<ResultCardProps> = ({ code, rank, onSave }) => {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const isVerified  = code.status === 'verified';
  const isFailed    = code.status === 'failed' || code.status === 'expired';
  const isUnverified = !isVerified && !isFailed;

  // ── Copy handler ──
  const handleCopy = () => {
    navigator.clipboard.writeText(code.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ── Save handler ──
  const handleSave = () => {
    if (onSave && !saved) {
      onSave(code);
      setSaved(true);
    }
  };

  // ── Confidence colour ──
  const confidenceColor =
    code.successRate >= 86 ? 'text-hunter-green' :
    code.successRate >= 61 ? 'text-hunter-cyan' :
    code.successRate >= 31 ? 'text-yellow-400' :
    'text-red-400';

  const confidenceBg =
    code.successRate >= 86 ? 'bg-hunter-green' :
    code.successRate >= 61 ? 'bg-hunter-cyan' :
    code.successRate >= 31 ? 'bg-yellow-400' :
    'bg-red-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, delay: rank * 0.08 }}
      className={`
        group relative bg-hunter-surface backdrop-blur-md border rounded-xl overflow-hidden
        transition-all duration-300 p-5
        ${isVerified
          ? 'border-hunter-green/40 hover:border-hunter-green/70 shadow-[0_4px_24px_-4px_rgba(10,255,0,0.15)] hover:shadow-[0_4px_32px_-4px_rgba(10,255,0,0.25)]'
          : isFailed
            ? 'border-red-500/20 opacity-55'
            : 'border-yellow-500/20 hover:border-yellow-500/40'
        }
        ${rank === 0 && isVerified ? 'ring-1 ring-hunter-green/25' : ''}
      `}
    >
      {/* ── Corner bracket decoration ── */}
      <div className="absolute top-0 right-0 w-12 h-12 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <svg viewBox="0 0 100 100" className={`w-full h-full stroke-current fill-none stroke-2 ${isVerified ? 'text-hunter-green/40' : 'text-hunter-muted/30'}`}>
          <path d="M90,10 L70,10 M90,10 L90,30" />
        </svg>
      </div>

      {/* ── Status badge — top right ── */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        {rank === 0 && isVerified && (
          <span className="bg-hunter-green text-black text-[9px] font-black px-1.5 py-0.5 rounded skew-x-[-8deg] tracking-wider">
            BEST
          </span>
        )}
        {isVerified && (
          <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider
                          px-2 py-1 rounded border
                          bg-hunter-green/10 border-hunter-green/30 text-hunter-green">
            <ShieldCheck size={11} className="shrink-0" />
            CHECKOUT VERIFIED
          </div>
        )}
        {isFailed && (
          <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider
                          px-2 py-1 rounded border
                          bg-red-500/10 border-red-500/30 text-red-400">
            <XCircle size={11} className="shrink-0" />
            FAILED
          </div>
        )}
        {isUnverified && (
          <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider
                          px-2 py-1 rounded border
                          bg-yellow-500/10 border-yellow-500/30 text-yellow-400">
            <AlertTriangle size={11} className="shrink-0" />
            UNVERIFIED
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mt-1">

        {/* LEFT — Code info */}
        <div className="space-y-2 min-w-0 pr-2">

          {/* The code itself */}
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className={`
              text-2xl md:text-3xl font-black font-mono tracking-wider
              transition-colors duration-200
              ${isVerified
                ? 'text-white group-hover:text-hunter-green'
                : isFailed
                  ? 'text-hunter-muted line-through'
                  : 'text-yellow-200/70'
              }
            `}>
              {code.code}
            </h3>
          </div>

          {/* Description */}
          <p className={`text-sm font-medium leading-snug ${
            isVerified ? 'text-hunter-cyan/80' : 'text-hunter-muted'
          }`}>
            {code.description}
          </p>

          {/* Actual discount detected at checkout */}
          {isVerified && (code.discountText || code.discountAmount) && (
            <div className="flex items-center gap-2">
              <Zap size={12} className="text-hunter-green shrink-0" />
              <span className="text-xs font-mono text-hunter-green font-bold">
                {code.discountAmount
                  ? `${code.discountAmount} detected at checkout`
                  : code.discountText}
              </span>
            </div>
          )}

          {/* Meta row: verified time, source, region */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-hunter-muted font-mono">
            <div className="flex items-center gap-1">
              <Clock size={11} />
              {code.lastVerified}
            </div>
            {code.source && (
              <div className="flex items-center gap-1">
                <ExternalLink size={11} />
                {code.source}
              </div>
            )}
            {code.testedRegion && isVerified && (
              <div className="flex items-center gap-1 text-hunter-cyan/70">
                <MapPin size={11} />
                Tested in {code.testedRegion}
              </div>
            )}
            {code.responseTime && isVerified && (
              <div className="flex items-center gap-1 text-hunter-muted/50">
                <Timer size={11} />
                {(code.responseTime / 1000).toFixed(1)}s
              </div>
            )}
          </div>

          {/* Confidence bar */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-hunter-muted font-mono shrink-0">CONFIDENCE</span>
            <div className="flex-1 max-w-[100px] h-1 bg-black/50 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-700 ${confidenceBg}`}
                style={{ width: `${code.successRate}%` }}
              />
            </div>
            <span className={`text-[10px] font-mono font-bold shrink-0 ${confidenceColor}`}>
              {code.successRate}%
            </span>
          </div>

          {/* Error detail for failed codes */}
          {isFailed && code.errorMessage && (
            <div className="flex items-center gap-1.5 text-[10px] text-red-400/70 font-mono">
              <XCircle size={10} />
              {code.errorMessage}
            </div>
          )}

          {/* Unverified disclaimer */}
          {isUnverified && (
            <div className="flex items-center gap-1.5 text-[10px] text-yellow-400/70 font-mono">
              <AlertTriangle size={10} />
              Not tested at checkout — use at your own risk
            </div>
          )}
        </div>

        {/* RIGHT — Actions */}
        <div className="flex flex-row lg:flex-col gap-3 shrink-0">

          {/* Copy / Extract button */}
          <button
            onClick={handleCopy}
            disabled={isFailed}
            className={`
              flex items-center justify-center gap-2 px-5 py-3 font-black font-display
              rounded-xl transition-all duration-200 active:scale-95 text-sm min-w-[130px]
              ${isFailed
                ? 'bg-hunter-surface text-hunter-muted cursor-not-allowed border border-hunter-border'
                : isVerified
                  ? copied
                    ? 'bg-hunter-green text-black border border-hunter-green'
                    : 'bg-hunter-cyan/10 border border-hunter-cyan/40 text-hunter-cyan hover:bg-hunter-green hover:text-black hover:border-hunter-green'
                  : 'bg-yellow-500/10 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500 hover:text-black'
              }
            `}
            title={isFailed ? 'Code failed at checkout' : 'Copy code to clipboard'}
          >
            {copied ? <Check size={16} className="shrink-0" /> : <Copy size={16} className="shrink-0" />}
            <span>{copied ? 'COPIED!' : isFailed ? 'INVALID' : 'COPY CODE'}</span>
          </button>

          {/* Save / Archive button */}
          <button
            onClick={handleSave}
            disabled={saved || isFailed}
            className={`
              flex items-center justify-center gap-2 px-4 py-3 border rounded-xl
              transition-all duration-200 font-bold font-display text-sm
              ${saved
                ? 'bg-hunter-green/15 border-hunter-green/50 text-hunter-green cursor-default'
                : isFailed
                  ? 'border-hunter-border text-hunter-muted cursor-not-allowed opacity-40'
                  : 'border-hunter-border text-hunter-muted hover:bg-hunter-cyan/10 hover:text-hunter-cyan hover:border-hunter-cyan/40'
              }
            `}
            title={saved ? 'Saved to inbox' : 'Save to inbox'}
          >
            {saved
              ? <><BookmarkCheck size={16} /><span className="hidden sm:inline">SAVED</span></>
              : <><Bookmark size={16} /><span className="hidden sm:inline">SAVE</span></>
            }
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ResultCard;
