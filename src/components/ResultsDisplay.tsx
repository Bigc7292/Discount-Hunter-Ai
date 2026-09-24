/**
 * ResultsDisplay — Shows ONLY checkout-verified codes.
 * LAUNCH INVARIANT: Never surface untested/unverified codes in any UI path.
 * Every code displayed here has been confirmed working at a real checkout.
 */

import React from 'react';
import { SearchResult, CouponCode } from '../types';
import ResultCard from './ResultCard';
import { motion } from 'framer-motion';
import {
  ExternalLink, ShoppingCart, Globe, Zap,
  ShieldCheck, WifiOff, XCircle
} from 'lucide-react';

interface ResultsDisplayProps {
  result: SearchResult;
  onSaveCode: (code: CouponCode) => void;
  glitchStatus?: { probability: number; warning?: string } | null;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  result,
  onSaveCode,
  glitchStatus,
}) => {
  // Defensive: primary list renders ONLY checkout-verified codes
  const verifiedCodes = result.codes.filter((c) => c.status === 'verified');
  const verifiedCount = verifiedCodes.length;
  const testedCount = result.stats.codesTested || 0;
  const discoveredCount = result.stats.codesDiscovered || result.stats.sourcesScanned || 0;
  const isVerifierOffline = !result.verifierOnline;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-700">

      {/* ── Merchant header ── */}
      <div className="cyber-glass border-hunter-cyan/20 p-5 md:p-6 flex flex-col md:flex-row
                      justify-between items-start md:items-center gap-5 relative overflow-hidden rounded-xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-hunter-cyan/5 blur-3xl rounded-full pointer-events-none" />

        {/* Store info */}
        <div className="flex items-center gap-4 relative z-10 min-w-0">
          <div className="w-14 h-14 shrink-0 bg-black border border-hunter-cyan/20 rounded-xl
                          flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.08)]">
            <ShoppingCart className="text-hunter-cyan" size={28} />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl md:text-3xl font-display font-black text-white italic
                           uppercase tracking-tighter truncate">
              {result.merchantName}
            </h2>
            {result.merchantUrl && (
              <a
                href={result.merchantUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-hunter-cyan/50 hover:text-hunter-cyan text-xs font-mono
                           flex items-center gap-1.5 transition-colors mt-0.5 w-fit"
              >
                <Globe size={11} />
                {result.merchantUrl.replace(/^https?:\/\//, '').slice(0, 40)}
                <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 md:gap-6 relative z-10 shrink-0">
          <div className="text-center">
            <div className="text-hunter-muted font-display font-bold text-xl">{discoveredCount}</div>
            <div className="text-[9px] text-hunter-muted uppercase font-mono tracking-widest">DISCOVERED</div>
          </div>
          <div className="w-px bg-hunter-border" />
          <div className="text-center">
            <div className="text-hunter-cyan font-display font-bold text-xl">{testedCount}</div>
            <div className="text-[9px] text-hunter-muted uppercase font-mono tracking-widest">TESTED</div>
          </div>
          <div className="w-px bg-hunter-border" />
          <div className="text-center">
            <div className={`font-display font-bold text-xl ${
              verifiedCount > 0 ? 'text-hunter-green' : 'text-red-400'
            }`}>
              {verifiedCount}
            </div>
            <div className="text-[9px] text-hunter-muted uppercase font-mono tracking-widest">VERIFIED</div>
          </div>
        </div>
      </div>

      {/* ── Verifier offline warning ── */}
      {isVerifierOffline && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-red-950/30 border border-red-500/40 p-4 rounded-xl
                     flex items-center gap-4 shadow-[0_0_20px_rgba(239,68,68,0.08)]"
        >
          <WifiOff className="text-red-400 shrink-0" size={20} />
          <div>
            <div className="text-red-400 font-display font-bold text-xs uppercase tracking-wider">
              Checkout Verifier Was Offline
            </div>
            <p className="text-red-400/60 text-[10px] font-mono mt-0.5">
              No codes can be confirmed without real checkout testing. Results may be incomplete.
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Price glitch alert ── */}
      {glitchStatus && glitchStatus.probability > 40 && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-purple-950/30 border border-purple-500/40 p-4 rounded-xl
                     flex items-center gap-4 shadow-[0_0_20px_rgba(168,85,247,0.08)]"
        >
          <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center shrink-0">
            <Zap className="text-purple-400 animate-pulse" size={18} />
          </div>
          <div>
            <div className="text-purple-300 font-display font-bold text-xs uppercase tracking-wider">
              Price Anomaly Signal Detected
            </div>
            <p className="text-purple-300/60 text-[10px] font-mono mt-0.5">
              {glitchStatus.warning || 'Potential pricing irregularity detected. Check for temporary deals.'}
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Verified codes section ── */}
      <div className="space-y-4">
        {/* Section header */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-hunter-border" />
          <div className="flex items-center gap-2">
            <ShieldCheck size={12} className="text-hunter-green" />
            <span className="text-[10px] text-hunter-green font-mono uppercase tracking-[0.4em]">
              Checkout Verified Codes
            </span>
          </div>
          <div className="h-px flex-1 bg-hunter-border" />
        </div>

        {verifiedCount > 0 ? (
          <div className="grid gap-4">
            {verifiedCodes.map((code, idx) => (
              <ResultCard
                key={`${code.code}-${idx}`}
                code={code}
                rank={idx}
                onSave={onSaveCode}
              />
            ))}
          </div>
        ) : (
          /* ── Empty state — honest zero result ── */
          <div className="cyber-glass border-hunter-border p-10 text-center rounded-xl">
            <XCircle className="text-hunter-muted mx-auto mb-4" size={36} />
            <h3 className="text-white font-display font-bold uppercase italic text-lg mb-2">
              0 Verified / {testedCount || discoveredCount} Tested
            </h3>
            <p className="text-hunter-muted font-mono text-xs leading-relaxed max-w-sm mx-auto">
              {discoveredCount > 0
                ? `Discovered ${discoveredCount} candidate${discoveredCount !== 1 ? 's' : ''}. `
                : ''}
              Checkout simulation tested{' '}
              {testedCount > 0
                ? `${testedCount} code${testedCount !== 1 ? 's' : ''}`
                : 'candidates'}
              {' '}at the real store — none applied. Unverified codes are never shown.
            </p>
            {result.dominantFailureReason && (
              <p className="text-amber-400/80 font-mono text-[11px] mt-3">
                Most failures: {result.dominantFailureReason}
              </p>
            )}
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                            bg-hunter-green/5 border border-hunter-green/20 text-hunter-green/70
                            text-[10px] font-mono uppercase tracking-wider">
              <ShieldCheck size={11} />
              Good — we didn't give you fake codes
            </div>
            {result.unverifiedCount !== undefined && result.unverifiedCount > 0 && (
              <p className="text-hunter-muted/50 text-[10px] font-mono mt-4">
                {result.unverifiedCount} candidate{result.unverifiedCount !== 1 ? 's' : ''} failed or were not retested (not shown).
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsDisplay;
