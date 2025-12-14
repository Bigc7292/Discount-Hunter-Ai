import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Globe, ArrowLeft } from 'lucide-react';
import { Continent, Country } from '../types';

interface RegionSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    regionData: Record<string, Continent>;
    onSelectCountry: (country: Country) => void;
    currentRegionCode: string;
}

const RegionSelectorModal: React.FC<RegionSelectorModalProps> = ({ isOpen, onClose, regionData, onSelectCountry, currentRegionCode }) => {
    const [selectedContinentKey, setSelectedContinentKey] = useState<string | null>(null);
    const [isBrowser, setIsBrowser] = useState(false);

    useEffect(() => {
        setIsBrowser(true);
    }, []);

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
                                {selectedContinentKey ? (
                                    <button
                                        onClick={() => setSelectedContinentKey(null)}
                                        className="p-1 hover:bg-white/10 rounded-full transition-colors text-hunter-cyan"
                                    >
                                        <ArrowLeft size={20} />
                                    </button>
                                ) : (
                                    <Globe className="text-hunter-cyan" size={20} />
                                )}
                                <h3 className="font-display font-bold text-white tracking-wide">
                                    {selectedContinentKey ? regionData[selectedContinentKey].name : 'SELECT TARGET REGION'}
                                </h3>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-red-500/20 hover:text-red-500 rounded-full transition-colors text-hunter-muted"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {!selectedContinentKey ? (
                                // CONTINENTS VIEW
                                <div className="grid gap-3">
                                    {Object.entries(regionData).map(([key, continent]) => (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                if (key === 'GLOBAL') {
                                                    onSelectCountry(continent.countries[0]);
                                                    onClose();
                                                } else {
                                                    setSelectedContinentKey(key);
                                                }
                                            }}
                                            className="w-full flex items-center justify-between p-4 bg-black/20 border border-hunter-border/50 hover:border-hunter-cyan hover:bg-hunter-cyan/5 rounded-lg transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl filter drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">
                                                    {key === 'GLOBAL' ? '🌍' :
                                                        key === 'NORTH_AMERICA' ? '🌎' :
                                                            key === 'EUROPE' ? '🌍' :
                                                                key === 'ASIA' ? '🌏' : '🌍'}
                                                </span>
                                                <span className="font-mono text-sm group-hover:text-hunter-cyan transition-colors">
                                                    {continent.name}
                                                </span>
                                            </div>
                                            {key !== 'GLOBAL' && (
                                                <ChevronRight className="text-hunter-muted group-hover:text-hunter-cyan transition-colors" size={16} />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                // COUNTRIES VIEW
                                <div className="grid gap-3">
                                    {regionData[selectedContinentKey].countries.map((country) => (
                                        <button
                                            key={country.code}
                                            onClick={() => {
                                                onSelectCountry(country);
                                                onClose();
                                            }}
                                            className={`w-full flex items-center justify-between p-4 border rounded-lg transition-all group ${currentRegionCode === country.code
                                                    ? 'bg-hunter-cyan/10 border-hunter-cyan'
                                                    : 'bg-black/20 border-hunter-border/50 hover:border-hunter-cyan hover:bg-hunter-cyan/5'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{country.flag}</span>
                                                <span className={`font-mono text-sm ${currentRegionCode === country.code ? 'text-hunter-cyan font-bold' : 'group-hover:text-hunter-cyan transition-colors'}`}>
                                                    {country.name}
                                                </span>
                                            </div>
                                            {currentRegionCode === country.code && (
                                                <div className="w-2 h-2 rounded-full bg-hunter-cyan shadow-[0_0_8px_#00d2ff]"></div>
                                            )}
                                        </button>
                                    ))}
                                </div>
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
