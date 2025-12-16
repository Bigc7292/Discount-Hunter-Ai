import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Continent, Country } from '../types';
import { ALL_COUNTRIES } from '../data/countries';

interface SmartRegionSelectorProps {
    selectedCode: string;
    selectedFlag: string;
    onSelect: (country: Country) => void;
    warning?: boolean; // If true, show red warning state
}

const SmartRegionSelector: React.FC<SmartRegionSelectorProps> = ({ selectedCode, selectedFlag, onSelect, warning }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [menuPosition, setMenuPosition] = useState<'bottom' | 'top'>('bottom');
    const containerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Filter countries
    const filteredCountries = ALL_COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase())
    );

    // Group by continent
    const groupedCountries = ['NORTH_AMERICA', 'EUROPE', 'ASIA', 'OCEANIA', 'SOUTH_AMERICA', 'AFRICA', 'GLOBAL'].map(continent => ({
        continent,
        countries: filteredCountries.filter(c => c.continent === continent)
    })).filter(g => g.countries.length > 0);

    // Smart Positioning Logic
    useEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            // If less than 400px space below, open upwards
            if (spaceBelow < 400) {
                setMenuPosition('top');
            } else {
                setMenuPosition('bottom');
            }
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (country: Country) => {
        onSelect(country);
        setIsOpen(false);
        setSearch(''); // Reset search
    };

    return (
        <div className="relative h-full" ref={containerRef}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 h-full px-4 md:px-6 transition-all duration-300 border-r border-hunter-border/50
                    ${warning
                        ? 'bg-red-500/20 text-red-500 animate-pulse border-red-500/50'
                        : 'text-hunter-muted hover:text-white hover:bg-white/5'}
                `}
            >
                <span className="text-xl md:text-2xl filter drop-shadow-md">{selectedFlag}</span>
                <div className="hidden md:flex flex-col items-start ml-1">
                    <span className="text-[10px] text-hunter-muted/70 font-mono leading-none tracking-wider">REGION</span>
                    <span className={`text-xs font-bold font-mono ${warning ? 'text-red-400' : 'text-white'}`}>
                        {selectedCode}
                    </span>
                </div>
                <ChevronDown
                    size={14}
                    className={`ml-2 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''} ${warning ? 'text-red-500' : 'text-hunter-muted'}`}
                />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Mobile Full Screen Overlay Backdrop */}
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9998] md:bg-transparent md:backdrop-blur-none" onClick={() => setIsOpen(false)} />

                        <motion.div
                            ref={menuRef}
                            initial={{ opacity: 0, y: menuPosition === 'bottom' ? 10 : -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: menuPosition === 'bottom' ? 10 : -10, scale: 0.95 }}
                            className={`
                                fixed md:absolute left-0 right-0 md:w-80 bg-[#0a0a0a] border border-hunter-border rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col z-[9999]
                                ${// Mobile: Center screen
                                'top-20 bottom-20 mx-4 md:mx-0 md:top-auto md:bottom-auto'
                                }
                                ${// Desktop: Position relative to trigger
                                menuPosition === 'bottom' ? 'md:top-full md:mt-4' : 'md:bottom-full md:mb-4'
                                }
                            `}
                        >
                            {/* Search Header */}
                            <div className="p-3 border-b border-hunter-border/50 bg-hunter-surface/50 flex items-center gap-2 sticky top-0 z-10 backdrop-blur-md">
                                <Search size={14} className="text-hunter-muted" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search country..."
                                    className="w-full bg-transparent text-sm text-white focus:outline-none placeholder:text-hunter-muted/50 font-mono"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>

                            {/* Scrollable List */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                                {groupedCountries.map(group => (
                                    <div key={group.continent}>
                                        <div className="px-3 py-2 text-[10px] text-hunter-cyan/70 font-bold uppercase tracking-widest bg-black/40 mb-1 sticky top-0 backdrop-blur-sm z-10">
                                            {group.continent.replace('_', ' ')}
                                        </div>
                                        <div className="grid grid-cols-1 gap-1 px-1">
                                            {group.countries.map(c => (
                                                <button
                                                    key={c.code}
                                                    type="button"
                                                    onClick={() => handleSelect(c)}
                                                    className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center gap-3 transition-colors group
                                                        ${selectedCode === c.code
                                                            ? 'bg-hunter-cyan/10 text-hunter-cyan'
                                                            : 'hover:bg-hunter-cyan/5 hover:text-white text-hunter-muted'}
                                                    `}
                                                >
                                                    <span className="text-xl filter drop-shadow opacity-80 group-hover:opacity-100 transition-opacity">{c.flag}</span>
                                                    <span className="font-mono text-xs md:text-sm">{c.name}</span>
                                                    {selectedCode === c.code && <Check size={14} className="ml-auto text-hunter-cyan" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {groupedCountries.length === 0 && (
                                    <div className="p-4 text-center text-hunter-muted text-xs font-mono">
                                        No targets found.
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-2 border-t border-hunter-border/30 bg-black/40 text-[10px] text-hunter-muted text-center font-mono">
                                {search ? 'Filtering targets...' : 'Select hunting ground'}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SmartRegionSelector;
