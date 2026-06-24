/**
 * HeroSearchBar — Clean, full-width search input
 * RegionSelector has been removed from this component.
 * It now sits ABOVE this bar in DashboardWorkspace.
 */

import React, { useRef, useState, useEffect } from 'react';
import { Search, Loader2, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { SearchStatus } from '../types';

interface HeroSearchBarProps {
  query: string;
  onQueryChange: (val: string) => void;
  onSearch: (overrideQuery?: string) => void;
  status: SearchStatus;
  placeholder?: string;
}

const HeroSearchBar: React.FC<HeroSearchBarProps> = ({
  query,
  onQueryChange,
  onSearch,
  status,
  placeholder,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const isLoading =
    status !== SearchStatus.IDLE &&
    status !== SearchStatus.COMPLETE &&
    status !== SearchStatus.ERROR &&
    status !== SearchStatus.VERIFIER_OFFLINE;

  // Auto-focus input when idle
  useEffect(() => {
    if (status === SearchStatus.IDLE) {
      const timer = setTimeout(() => inputRef.current?.focus(), 600);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading && query.trim()) {
      onSearch();
    }
  };

  // Progress value for the loading bar
  const progressWidth =
    status === SearchStatus.PLANNING     ? '15%' :
    status === SearchStatus.SCANNING     ? '30%' :
    status === SearchStatus.DISCOVERING  ? '50%' :
    status === SearchStatus.VERIFYING    ? '80%' :
    status === SearchStatus.COMPLETE     ? '100%' : '0%';

  return (
    <div className="w-full relative">
      {/* Ambient glow */}
      <div
        className={`absolute -inset-1 rounded-2xl blur-xl transition-opacity duration-500 pointer-events-none
          bg-gradient-to-r from-hunter-cyan/0 via-hunter-cyan/15 to-hunter-purple/0
          ${isFocused || isLoading ? 'opacity-100' : 'opacity-20'}`}
      />

      {/* Main bar */}
      <div
        className={`
          relative flex items-center bg-hunter-bg/90 backdrop-blur-xl border rounded-2xl
          shadow-2xl transition-all duration-300 overflow-hidden h-16 md:h-20
          ${isLoading
            ? 'border-hunter-cyan/40 ring-1 ring-hunter-cyan/20'
            : isFocused
              ? 'border-hunter-cyan/50 ring-1 ring-hunter-cyan/30'
              : 'border-hunter-border hover:border-hunter-cyan/30'
          }
        `}
      >
        {/* Search icon */}
        <div className="pl-5 pr-3 shrink-0">
          <Search
            size={22}
            className={`transition-colors duration-200 ${
              isFocused || isLoading ? 'text-hunter-cyan' : 'text-hunter-muted'
            }`}
          />
        </div>

        {/* Text input — takes full remaining width */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder={
            isLoading
              ? 'HUNTING IN PROGRESS...'
              : placeholder || 'Enter product or store URL (e.g. Nike, amazon.com/dp/...)'
          }
          className="flex-1 min-w-0 bg-transparent text-base md:text-xl text-white
                     placeholder:text-hunter-muted/40 focus:outline-none font-sans
                     tracking-wide h-full py-2 disabled:cursor-wait"
          autoComplete="off"
          spellCheck={false}
        />

        {/* HUNT button */}
        <div className="h-full p-2 pr-3 shrink-0">
          <button
            onClick={() => onSearch()}
            disabled={isLoading || !query.trim()}
            className={`
              h-full px-6 md:px-10 rounded-xl font-black text-sm md:text-base
              tracking-widest transition-all duration-300 flex items-center gap-2
              overflow-hidden relative group select-none
              ${isLoading
                ? 'bg-hunter-surface text-hunter-muted cursor-wait'
                : !query.trim()
                  ? 'bg-hunter-surface text-hunter-muted/40 cursor-not-allowed'
                  : 'bg-hunter-cyan text-black hover:bg-white hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] active:scale-95'
              }
            `}
          >
            {/* Shimmer on hover */}
            {!isLoading && query.trim() && (
              <span className="absolute inset-0 -translate-x-full group-hover:animate-shimmer
                               bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin shrink-0" size={18} />
                  <span className="hidden sm:inline text-xs">HUNTING</span>
                </>
              ) : (
                <>
                  <span>HUNT</span>
                  <ChevronRight
                    size={18}
                    className={`transition-transform duration-200 ${
                      isFocused && query.trim() ? 'translate-x-1' : ''
                    }`}
                  />
                </>
              )}
            </span>
          </button>
        </div>

        {/* Loading progress bar — bottom of the bar */}
        {isLoading && (
          <motion.div
            className="absolute bottom-0 left-0 h-[3px] bg-hunter-cyan rounded-full
                       shadow-[0_0_8px_rgba(0,240,255,0.8)]"
            initial={{ width: '0%' }}
            animate={{ width: progressWidth }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          />
        )}
      </div>
    </div>
  );
};

export default HeroSearchBar;
