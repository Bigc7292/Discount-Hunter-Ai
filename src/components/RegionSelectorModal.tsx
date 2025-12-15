import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Globe, ArrowLeft, Search } from 'lucide-react';
import { Country } from '../types';
import { ALL_COUNTRIES } from '../data/countries';

interface RegionSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectCountry: (country: Country) => void;
    currentRegionCode: string;
}

const RegionSelectorModal: React.FC<RegionSelectorModalProps> = ({ isOpen, onClose, onSelectCountry, currentRegionCode }) => {
    const [selectedContinent, setSelectedContinent] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isBrowser, setIsBrowser] = useState(false);

    useEffect(() => {
        setIsBrowser(true);
    }, []);

    // Get unique continents
    const continents = Array.from(new Set(ALL_COUNTRIES.map(c => c.continent))).map(key => {
        // Pretty print continent names
        const name = key.replace('_', ' ').toUpperCase();
        const countries = ALL_COUNTRIES.filter(c => c.continent === key);
        return { key, name, countries, icon: key === 'GLOBAL' ? '🌍' : '🗺️' };
    });

    // Filter logic
    const filteredCountries = ALL_COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isSearching = searchTerm.length > 0;

    if (!isBrowser) return null;

    return ReactDOM.createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-md bg-hunter-surface border border-hunter-border rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] z-10"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-hunter-border bg-black/40">
                            <div className="flex items-center gap-2">
                                {(selectedContinent && !isSearching) ? (
                                    <button
                                        onClick={() => setSelectedContinent(null)}
                                        className="p-1 hover:bg-white/10 rounded-full transition-colors text-hunter-cyan"
                                    >
                                        <ArrowLeft size={20} />
                                    </button>
                                ) : (
                                    <Globe className="text-hunter-cyan" size={20} />
                                )}
                                <h3 className="font-display font-bold text-white tracking-wide">
                                    {(selectedContinent && !isSearching) ? selectedContinent.replace('_', ' ') : 'SELECT REGION'}
                                </h3>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-red-500/20 hover:text-red-500 rounded-full transition-colors text-hunter-muted"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="p-4 border-b border-hunter-border bg-black/20">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hunter-muted" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search country..."
                                    className="w-full bg-black/50 border border-hunter-border rounded-lg pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-hunter-cyan placeholder:text-hunter-muted/50 font-mono"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

                            {/* IF SEARCHING: Show Flat List */}
                            {isSearching ? (
                                <div className="grid gap-2">
                                    {filteredCountries.map((country) => (
                                        <button
                                            key={country.code}
                                            onClick={() => {
                                                onSelectCountry(country);
                                                onClose();
                                            }}
                                            className={`w-full flex items-center justify-between p-3 rounded-lg transition-all group border ${currentRegionCode === country.code
                                                ? 'bg-hunter-cyan/10 border-hunter-cyan'
                                                : 'bg-black/20 border-hunter-border/30 hover:bg-hunter-cyan/5 hover:border-hunter-cyan/50'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{country.flag}</span>
                                                <span className={`font-mono text-sm ${currentRegionCode === country.code ? 'text-hunter-cyan font-bold' : 'text-white'}`}>
                                                    {country.name}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                    {filteredCountries.length === 0 && (
                                        <div className="text-center py-6 text-hunter-muted text-sm font-mono">No results found.</div>
                                    )}
                                </div>
                            ) : (
                                /* IF NOT SEARCHING: Show Continents OR Countries */
                                !selectedContinent ? (
                                    // CONTINENT LIST
                                    <div className="grid gap-3">
                                        {continents.map((cont) => (
                                            <button
                                                key={cont.key}
                                                onClick={() => {
                                                    if (cont.key === 'GLOBAL') {
                                                        // Auto-select Global
                                                        onSelectCountry(cont.countries[0]);
                                                        onClose();
                                                    } else {
                                                        setSelectedContinent(cont.key);
                                                    }
                                                }}
                                                className="w-full flex items-center justify-between p-4 bg-black/20 border border-hunter-border/50 hover:border-hunter-cyan hover:bg-hunter-cyan/5 rounded-lg transition-all group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl filter drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">
                                                        {cont.icon}
                                                    </span>
                                                    <span className="font-mono text-sm group-hover:text-hunter-cyan transition-colors font-bold tracking-wide">
                                                        {cont.name}
                                                    </span>
                                                </div>
                                                {cont.key !== 'GLOBAL' && (
                                                    <ChevronRight className="text-hunter-muted group-hover:text-hunter-cyan transition-colors" size={16} />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    // COUNTRY LIST (For selected continent)
                                    <div className="grid gap-2">
                                        {ALL_COUNTRIES.filter(c => c.continent === selectedContinent).map((country) => (
                                            <button
                                                key={country.code}
                                                onClick={() => {
                                                    onSelectCountry(country);
                                                    onClose();
                                                }}
                                                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all group border ${currentRegionCode === country.code
                                                    ? 'bg-hunter-cyan/10 border-hunter-cyan'
                                                    : 'bg-black/20 border-hunter-border/30 hover:bg-hunter-cyan/5 hover:border-hunter-cyan/50'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl">{country.flag}</span>
                                                    <span className={`font-mono text-sm ${currentRegionCode === country.code ? 'text-hunter-cyan font-bold' : 'text-white'}`}>
                                                        {country.name}
                                                    </span>
                                                </div>
                                                {currentRegionCode === country.code && (
                                                    <div className="w-2 h-2 rounded-full bg-hunter-cyan shadow-[0_0_8px_#00d2ff]"></div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default RegionSelectorModal;
