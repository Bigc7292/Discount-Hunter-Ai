import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Check, ChevronDown } from 'lucide-react';

// Simplified countries list for the dropdown
const POPULAR_REGIONS = [
    { name: 'Global', code: 'GL', flag: '🌍' },
    { name: 'United States', code: 'US', flag: '🇺🇸' },
    { name: 'United Kingdom', code: 'UK', flag: '🇬🇧' },
    { name: 'Canada', code: 'CA', flag: '🇨🇦' },
    { name: 'Germany', code: 'DE', flag: '🇩🇪' },
    { name: 'France', code: 'FR', flag: '🇫🇷' },
    { name: 'Spain', code: 'ES', flag: '🇪🇸' },
    { name: 'Australia', code: 'AU', flag: '🇦🇺' },
    { name: 'Brazil', code: 'BR', flag: '🇧🇷' },
    { name: 'Japan', code: 'JP', flag: '🇯🇵' },
    { name: 'India', code: 'IN', flag: '🇮🇳' },
];

interface RegionSelectorProps {
    value: string;
    onChange: (val: string) => void;
    error?: boolean;
}

const RegionSelector: React.FC<RegionSelectorProps> = ({ value, onChange, error }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const filtered = POPULAR_REGIONS.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.code.toLowerCase().includes(search.toLowerCase())
    );

    const selected = POPULAR_REGIONS.find(r => r.name === value) || POPULAR_REGIONS[0];

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 min-w-[140px] border
                    ${error ? 'border-red-500 bg-red-500/10' : 'border-hunter-border bg-black/40 hover:border-hunter-cyan/50'}
                    ${isOpen ? 'ring-1 ring-hunter-cyan/30' : ''}
                `}
            >
                <span className="text-lg">{selected.flag}</span>
                <span className="text-sm font-mono text-white truncate max-w-[80px]">{selected.name}</span>
                <ChevronDown size={14} className={`ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full mb-2 left-0 w-64 cyber-glass rounded-xl overflow-hidden z-[100] border-hunter-cyan/30 shadow-[0_0_30px_rgba(0,0,0,0.8)]"
                    >
                        <div className="p-2 border-b border-hunter-border bg-black/40">
                            <div className="relative">
                                <Search className="absolute left-2 top-2 text-hunter-muted" size={14} />
                                <input
                                    type="text"
                                    value={search}
                                    autoFocus
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search region..."
                                    className="w-full bg-hunter-bg border border-hunter-border rounded-lg py-1.5 pl-8 pr-2 text-xs text-white focus:outline-none focus:border-hunter-cyan"
                                />
                            </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                            {filtered.length > 0 ? (
                                filtered.map(region => (
                                    <button
                                        key={region.code}
                                        type="button"
                                        onClick={() => {
                                            onChange(region.name);
                                            setIsOpen(false);
                                            setSearch('');
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2 text-xs text-hunter-muted hover:text-white hover:bg-hunter-cyan/10 transition-colors"
                                    >
                                        <span>{region.flag}</span>
                                        <span className="flex-1 text-left">{region.name}</span>
                                        {value === region.name && <Check size={12} className="text-hunter-cyan" />}
                                    </button>
                                ))
                            ) : (
                                <div className="p-4 text-center text-[10px] text-hunter-muted font-mono uppercase">Target not found</div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default RegionSelector;
