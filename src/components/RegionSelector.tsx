/**
 * RegionSelector — Standalone pill component
 * Sits ABOVE the search bar. Does NOT live inside HeroSearchBar.
 * Full-width clickable pill with animated dropdown.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Check, ChevronDown, Globe } from 'lucide-react';

// ---------------------------------------------------------------------------
// Regions data — expanded to match backend geoProxy.ts supported regions
// ---------------------------------------------------------------------------

export const REGIONS = [
  { name: 'Global',           code: 'GLOBAL', flag: '🌍' },
  { name: 'United States',    code: 'US',     flag: '🇺🇸' },
  { name: 'United Kingdom',   code: 'UK',     flag: '🇬🇧' },
  { name: 'United Arab Emirates', code: 'AE', flag: '🇦🇪' },
  { name: 'Canada',           code: 'CA',     flag: '🇨🇦' },
  { name: 'Australia',        code: 'AU',     flag: '🇦🇺' },
  { name: 'Germany',          code: 'DE',     flag: '🇩🇪' },
  { name: 'France',           code: 'FR',     flag: '🇫🇷' },
  { name: 'Japan',            code: 'JP',     flag: '🇯🇵' },
  { name: 'India',            code: 'IN',     flag: '🇮🇳' },
  { name: 'Saudi Arabia',     code: 'SA',     flag: '🇸🇦' },
  { name: 'Singapore',        code: 'SG',     flag: '🇸🇬' },
  { name: 'Spain',            code: 'ES',     flag: '🇪🇸' },
  { name: 'Italy',            code: 'IT',     flag: '🇮🇹' },
  { name: 'Netherlands',      code: 'NL',     flag: '🇳🇱' },
  { name: 'Brazil',           code: 'BR',     flag: '🇧🇷' },
  { name: 'South Korea',      code: 'KR',     flag: '🇰🇷' },
  { name: 'Mexico',           code: 'MX',     flag: '🇲🇽' },
  { name: 'Turkey',           code: 'TR',     flag: '🇹🇷' },
  { name: 'Poland',           code: 'PL',     flag: '🇵🇱' },
];

interface RegionSelectorProps {
  value: string;       // Region name (e.g. "United States")
  onChange: (val: string) => void;
  disabled?: boolean;
}

const RegionSelector: React.FC<RegionSelectorProps> = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = REGIONS.find(r => r.name === value || r.code === value) || REGIONS[0];

  const filtered = REGIONS.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.code.toLowerCase().includes(search.toLowerCase())
  );

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = (region: typeof REGIONS[0]) => {
    onChange(region.name);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* ── Pill Button ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        className={`
          w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200
          text-sm font-mono tracking-wide
          ${disabled
            ? 'opacity-50 cursor-not-allowed border-hunter-border bg-black/20 text-hunter-muted'
            : 'border-hunter-border bg-black/30 hover:border-hunter-cyan/40 hover:bg-black/50 text-white cursor-pointer'
          }
          ${isOpen ? 'border-hunter-cyan/50 ring-1 ring-hunter-cyan/20' : ''}
        `}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <MapPin size={13} className="text-hunter-cyan shrink-0" />
        <span className="text-hunter-muted text-xs uppercase tracking-widest shrink-0">Searching in:</span>
        <span className="text-lg leading-none shrink-0">{selected.flag}</span>
        <span className="flex-1 text-left font-semibold">{selected.name}</span>
        <ChevronDown
          size={14}
          className={`text-hunter-muted transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Dropdown ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-0 right-0 z-[200] rounded-xl overflow-hidden
                       bg-hunter-bg border border-hunter-cyan/20 shadow-[0_16px_48px_rgba(0,0,0,0.8)]"
            role="listbox"
          >
            {/* Search input */}
            <div className="p-2 border-b border-hunter-border bg-black/40">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-hunter-muted" size={13} />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search region..."
                  className="w-full bg-hunter-surface border border-hunter-border rounded-lg py-2 pl-8 pr-3
                             text-xs text-white font-mono focus:outline-none focus:border-hunter-cyan/50
                             placeholder:text-hunter-muted/60"
                />
              </div>
            </div>

            {/* Region list */}
            <ul className="max-h-56 overflow-y-auto custom-scrollbar py-1">
              {filtered.length > 0 ? (
                filtered.map(region => (
                  <li key={region.code}>
                    <button
                      type="button"
                      onClick={() => handleSelect(region)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-mono
                                 text-hunter-muted hover:text-white hover:bg-hunter-cyan/8
                                 transition-colors group"
                    >
                      <span className="text-base leading-none">{region.flag}</span>
                      <span className="flex-1 text-left group-hover:text-white transition-colors">
                        {region.name}
                      </span>
                      <span className="text-hunter-muted/50 text-[10px]">{region.code}</span>
                      {selected.code === region.code && (
                        <Check size={12} className="text-hunter-cyan shrink-0" />
                      )}
                    </button>
                  </li>
                ))
              ) : (
                <li className="p-4 text-center text-[10px] text-hunter-muted font-mono uppercase tracking-widest">
                  No regions match "{search}"
                </li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RegionSelector;
