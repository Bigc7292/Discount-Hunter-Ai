import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, RefreshCw, ShieldCheck, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { fetchCheckoutLedger, type CheckoutLedgerEntry } from '../services/apiService';

const RESULT_STYLE: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  pass: {
    label: 'PASS',
    className: 'text-hunter-green border-hunter-green/40 bg-hunter-green/10',
    icon: <ShieldCheck size={12} />,
  },
  fail: {
    label: 'FAIL',
    className: 'text-red-400 border-red-500/40 bg-red-500/10',
    icon: <XCircle size={12} />,
  },
  expired: {
    label: 'EXPIRED',
    className: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
    icon: <Clock size={12} />,
  },
  error: {
    label: 'ERROR',
    className: 'text-hunter-muted border-white/20 bg-white/5',
    icon: <AlertTriangle size={12} />,
  },
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Public Verified Checkout Ledger — shows redacted simulated-checkout results only.
 * Never displays full discount codes.
 */
const CheckoutLedger: React.FC = () => {
  const [entries, setEntries] = useState<CheckoutLedgerEntry[]>([]);
  const [source, setSource] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCheckoutLedger(40, 0);
      if (!data) {
        setEntries([]);
        setError('Ledger offline');
        setSource('');
      } else {
        setEntries(data.entries);
        setSource(data.source);
      }
    } catch {
      setError('Failed to load ledger');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="py-20 px-4 border-t border-hunter-border bg-black/30 relative overflow-hidden">
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 text-hunter-cyan text-[10px] font-mono tracking-widest uppercase mb-3">
              <ClipboardList size={14} />
              PUBLIC AUDIT TRAIL
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-black text-white tracking-tight">
              VERIFIED CHECKOUT LEDGER
            </h2>
            <p className="mt-3 text-hunter-muted font-mono text-sm max-w-xl">
              Timestamped simulated-checkout results. Full codes are never shown — only pass/fail signals.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-hunter-border text-hunter-cyan text-xs font-bold font-mono hover:bg-hunter-cyan/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            REFRESH
          </button>
        </div>

        <div className="cyber-glass rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1.2fr_1fr_0.7fr_0.8fr_0.9fr] gap-2 px-4 py-3 border-b border-hunter-border text-[10px] font-mono tracking-widest text-hunter-muted uppercase">
            <span>Merchant</span>
            <span>Cart</span>
            <span>Region</span>
            <span>Result</span>
            <span>Tested</span>
          </div>

          {loading && entries.length === 0 && (
            <div className="px-4 py-12 text-center text-hunter-muted font-mono text-sm">
              Loading ledger…
            </div>
          )}

          {!loading && error && entries.length === 0 && (
            <div className="px-4 py-12 text-center text-hunter-muted font-mono text-sm">
              {error}. Start the verifier backend to populate live entries.
            </div>
          )}

          {!loading && !error && entries.length === 0 && (
            <div className="px-4 py-12 text-center text-hunter-muted font-mono text-sm">
              No checkout tests recorded yet. Run a hunt to append ledger rows.
            </div>
          )}

          <ul className="divide-y divide-hunter-border/60 max-h-[420px] overflow-y-auto custom-scrollbar">
            {entries.map((row, idx) => {
              const style = RESULT_STYLE[row.result] || RESULT_STYLE.error;
              return (
                <motion.li
                  key={row.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                  className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_0.7fr_0.8fr_0.9fr] gap-2 px-4 py-3 items-center hover:bg-white/[0.02]"
                >
                  <div className="font-display font-bold text-sm text-white truncate">
                    {row.merchant}
                    <div className="text-[10px] text-hunter-muted font-mono mt-0.5">
                      …{row.codeLast4}
                    </div>
                  </div>
                  <div className="text-xs text-hunter-muted font-mono truncate">{row.cartSummary}</div>
                  <div className="text-xs font-mono text-hunter-cyan">{row.region || '—'}</div>
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-black tracking-wider ${style.className}`}
                    >
                      {style.icon}
                      {style.label}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-hunter-muted">{formatTime(row.testedAt)}</div>
                </motion.li>
              );
            })}
          </ul>

          {source && (
            <div className="px-4 py-2 border-t border-hunter-border text-[10px] font-mono text-hunter-muted tracking-widest">
              SOURCE: {source.toUpperCase()} · CODES REDACTED
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CheckoutLedger;
