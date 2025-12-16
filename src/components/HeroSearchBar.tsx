import React, { useState } from 'react';
import { Search, Loader2, ArrowRight, Target, ShieldAlert } from 'lucide-react';
import SmartRegionSelector from './SmartRegionSelector';
import CategoryChips from './CategoryChips';
import { Country, SearchStatus } from '../types';

interface HeroSearchBarProps {
    query: string;
    onQueryChange: (val: string) => void;
    onSearch: (e?: React.FormEvent, override?: string) => void;
    status: SearchStatus;
    searchRegionCode: string;
    searchRegionFlag: string;
    onRegionSelect: (country: Country) => void;
    regionSelected: boolean;
    showRegionWarning: boolean;
}

const HeroSearchBar: React.FC<HeroSearchBarProps> = ({
    query, onQueryChange, onSearch, status,
    searchRegionCode, searchRegionFlag, onRegionSelect, regionSelected, showRegionWarning
}) => {

    // Additional internal state to pulse or highlight if validation fails (passed from parent or local)
    // For now purely relying on props.

    return (
        <div className="relative group z-30 perspective-1000 w-full max-w-4xl mx-auto">
            {/* Quick Filters */}
            {status === SearchStatus.IDLE && (
                <div className="mb-6">
                    <CategoryChips onSelect={(cat) => onSearch(undefined, `${cat} discount codes`)} />
                </div>
            )}

            {/* Main Bar */}
            <form
                onSubmit={(e) => onSearch(e)}
                className={`relative transform transition-all duration-300 hover:scale-[1.01] ${showRegionWarning ? 'shake-animation' : ''}`}
            >
                {/* Glow Effect */}
                <div className="absolute -inset-1 bg-gradient-to-r from-hunter-cyan via-hunter-purple to-hunter-cyan rounded opacity-20 group-hover:opacity-40 blur-lg transition duration-500"></div>

                {/* Warning Toast Indicator (Inline) */}
                {showRegionWarning && (
                    <div className="absolute -top-12 left-0 right-0 flex justify-center animate-in fade-in slide-in-from-bottom-2">
                        <div className="bg-red-500/90 text-white text-xs font-bold font-display px-4 py-2 rounded shadow-lg flex items-center gap-2 border border-red-400">
                            <ShieldAlert size={14} className="animate-pulse" />
                            SELECT YOUR HUNTING GROUND
                            <div className="w-2 h-2 bg-red-400 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
                        </div>
                    </div>
                )}

                <div className={`relative flex items-center bg-black border-2 group-focus-within:border-hunter-cyan/70 overflow-visible z-50
                    ${showRegionWarning ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'border-hunter-border'}
                `}>

                    {/* Left Accent */}
                    <div className={`absolute left-0 w-2 h-full transition-colors duration-300 ${showRegionWarning ? 'bg-red-500/50' : 'bg-hunter-cyan/20'}`}></div>

                    {/* Region Selector */}
                    <div className="h-16 md:h-20 shrink-0">
                        <SmartRegionSelector
                            selectedCode={searchRegionCode}
                            selectedFlag={searchRegionFlag}
                            onSelect={onRegionSelect}
                            warning={showRegionWarning}
                        />
                    </div>

                    {/* Input Field */}
                    <div className="flex-1 relative h-16 md:h-20 flex items-center">
                        <div className="absolute left-4 text-hunter-muted"><Target size={20} className="group-focus-within:text-hunter-cyan transition-colors" /></div>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => onQueryChange(e.target.value)}
                            placeholder={!regionSelected ? "WAITING FOR TARGET REGION..." : "PASTE PRODUCT URL OR STORE..."}
                            className={`w-full h-full bg-transparent text-white text-sm md:text-lg lg:text-xl font-mono pl-12 pr-4 focus:outline-none tracking-wider uppercase placeholder:text-xs md:placeholder:text-base transition-colors
                                ${!regionSelected ? 'placeholder:text-red-500/50 cursor-not-allowed' : 'placeholder:text-hunter-muted/50'}
                            `}
                            disabled={status !== SearchStatus.IDLE && status !== SearchStatus.COMPLETE}
                        />
                        {/* AI Badge */}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1.5 px-2 py-1 bg-hunter-cyan/5 border border-hunter-cyan/20 rounded text-[9px] text-hunter-cyan font-mono tracking-widest pointer-events-none">
                            <div className="w-1.5 h-1.5 rounded-full bg-hunter-cyan animate-pulse"></div>
                            AI ACTIVE
                        </div>
                    </div>

                    {/* Deploy Button */}
                    <button
                        type="submit"
                        disabled={status !== SearchStatus.IDLE && status !== SearchStatus.COMPLETE}
                        className={`h-16 md:h-20 px-6 md:px-10 font-display font-black tracking-widest transition-all flex items-center gap-2 text-xs md:text-base border-l border-hunter-border/30
                            ${status === SearchStatus.IDLE || status === SearchStatus.COMPLETE
                                ? 'bg-hunter-cyan text-black hover:bg-white hover:shadow-[0_0_30px_rgba(0,240,255,0.6)]'
                                : 'bg-gray-900 text-gray-500 cursor-wait'}
                        `}
                    >
                        {status === SearchStatus.IDLE || status === SearchStatus.COMPLETE ? (
                            <>
                                <span className="hidden sm:inline">DEPLOY</span>
                                <span className="sm:hidden">GO</span>
                                <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
                            </>
                        ) : (
                            <>
                                <Loader2 className="animate-spin w-4 h-4 md:w-5 md:h-5" />
                                <span className="hidden sm:inline">HUNTING</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default HeroSearchBar;
