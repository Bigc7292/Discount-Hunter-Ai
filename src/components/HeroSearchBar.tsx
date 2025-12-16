import React, { useRef, useState, useEffect } from 'react';
import { Search, Loader2, AlertTriangle, ChevronRight, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Defined directly in component to avoid circular dependency issues during refactor
interface HeroSearchBarProps {
    query: string;
    onQueryChange: (val: string) => void;
    onSearch: (overrideQuery?: string) => void;
    status: 'idle' | 'scanning' | 'analyzing' | 'extracting' | 'completed' | 'error';
    searchLocation: string;
    onLocationChange: (val: string) => void;
    showRegionWarning: boolean;
}

const HeroSearchBar: React.FC<HeroSearchBarProps> = ({
    query,
    onQueryChange,
    onSearch,
    status,
    searchLocation,
    onLocationChange,
    showRegionWarning
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    // Auto-focus on mount
    useEffect(() => {
        if (status === 'idle') {
            const timer = setTimeout(() => inputRef.current?.focus(), 800);
            return () => clearTimeout(timer);
        }
    }, [status]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && status === 'idle' && query.trim()) {
            onSearch();
        }
    };

    const isLoading = status !== 'idle' && status !== 'completed' && status !== 'error';

    return (
        <div className="w-full max-w-4xl mx-auto relative z-50">
            {/* GLOW EFFECT BACKGROUND */}
            <div className={`absolute -inset-1 bg-gradient-to-r from-hunter-cyan/0 via-hunter-cyan/20 to-hunter-purple/0 rounded-2xl blur-xl transition-opacity duration-500 ${isFocused || isLoading ? 'opacity-100' : 'opacity-30'}`}></div>

            <div className={`
                relative flex items-center bg-hunter-bg/90 backdrop-blur-xl border rounded-2xl shadow-2xl transition-all duration-300 overflow-visible
                ${showRegionWarning ? 'border-red-500 ring-1 ring-red-500/50' : isFocused ? 'border-hunter-cyan/50 ring-1 ring-hunter-cyan/30' : 'border-hunter-border'}
                h-16 md:h-20
            `}>

                {/* Location Input (New) */}
                <div className="h-full flex items-center border-r border-hunter-border px-4 relative z-[60] min-w-[140px] md:min-w-[180px]">
                    <MapPin size={18} className={`shrink-0 mr-2 ${showRegionWarning ? 'text-red-500' : 'text-hunter-cyan'}`} />
                    <input
                        type="text"
                        value={searchLocation}
                        onChange={(e) => onLocationChange(e.target.value)}
                        placeholder="Location..."
                        className="w-full h-full bg-transparent text-white focus:outline-none placeholder:text-hunter-muted/50 text-sm font-mono border-none"
                    />
                </div>

                {/* Main Input */}
                <div className="flex-1 h-full relative flex items-center pl-4 bg-transparent z-[50]">
                    <Search className={`shrink-0 mr-3 transition-colors ${isFocused ? 'text-hunter-cyan' : 'text-hunter-muted'}`} />

                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => onQueryChange(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading}
                        placeholder={isLoading ? "ESTABLISHING CONNECTION..." : "Enter product (e.g. 'PS5 Slim', 'Nike Air Max')"}
                        className="w-full bg-transparent text-lg md:text-xl text-white placeholder:text-hunter-muted/50 focus:outline-none font-sans tracking-wide h-full py-2"
                        autoComplete="off"
                    />
                </div>

                {/* Action Button */}
                <div className="h-full p-2 relative z-[50]">
                    <button
                        onClick={() => onSearch()}
                        disabled={isLoading || !query.trim()}
                        className={`
                            h-full px-6 md:px-8 rounded-xl font-bold text-sm md:text-base tracking-widest transition-all duration-300 flex items-center gap-2 overflow-hidden relative group
                            ${isLoading
                                ? 'bg-hunter-surface text-hunter-muted cursor-wait'
                                : !query.trim()
                                    ? 'bg-hunter-surface text-hunter-muted cursor-not-allowed opacity-50'
                                    : 'bg-hunter-cyan text-black hover:bg-white hover:shadow-[0_0_20px_rgba(6,182,212,0.6)]'
                            }
                        `}
                    >
                        {/* Shimmer effect */}
                        {!isLoading && query.trim() && (
                            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent z-10"></div>
                        )}

                        <span className="relative z-20 flex items-center gap-2">
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    <span className="hidden md:inline">Processing</span>
                                </>
                            ) : (
                                <>
                                    <span>HUNT</span>
                                    <ChevronRight size={18} className={`transition-transform duration-300 ${isFocused && query.trim() ? 'translate-x-1' : ''}`} />
                                </>
                            )}
                        </span>
                    </button>
                </div>

                {/* Loading Progress Bar */}
                {isLoading && (
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-hunter-bg overflow-hidden rounded-b-2xl">
                        <motion.div
                            className="h-full bg-hunter-cyan box-glow"
                            initial={{ width: "0%" }}
                            animate={{
                                width: status === 'scanning' ? "30%" :
                                    status === 'analyzing' ? "60%" :
                                        status === 'extracting' ? "90%" : "100%"
                            }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                )}
            </div>

            {/* Warning Message */}
            <AnimatePresence>
                {showRegionWarning && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute -bottom-10 left-0 right-0 mx-auto text-center"
                    >
                        <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-2 rounded-lg backdrop-blur-md">
                            <AlertTriangle size={16} />
                            <span className="text-xs font-bold font-mono">LOCATION INPUT REQUIRED</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default HeroSearchBar;
