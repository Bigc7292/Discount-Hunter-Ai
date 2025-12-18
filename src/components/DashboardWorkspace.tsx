import React from 'react';
import { motion } from 'framer-motion';
import HeroSearchBar from './HeroSearchBar';
import TerminalLog from './TerminalLog';
import { SearchStatus, SearchResult, LogEntry } from '../types';
import ResultsDisplay from './ResultsDisplay';

interface DashboardWorkspaceProps {
    query: string;
    onQueryChange: (val: string) => void;
    onSearch: (q?: string) => void;
    status: SearchStatus;
    searchLocation: string;
    onLocationChange: (val: string) => void;
    logs: LogEntry[];
    result: SearchResult | null;
    activeTab: 'overview' | 'inbox' | 'history' | 'account' | 'admin';
}

const DashboardWorkspace: React.FC<DashboardWorkspaceProps> = ({
    query,
    onQueryChange,
    onSearch,
    status,
    searchLocation,
    onLocationChange,
    logs,
    result,
    activeTab
}) => {
    const renderContent = () => {
        switch (activeTab) {
            case 'history':
                return (
                    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="text-xl font-display font-black text-hunter-cyan mb-6 uppercase tracking-widest italic">MISSION HISTORY</h3>
                        <div className="cyber-glass border-hunter-border p-8 text-center">
                            <p className="text-hunter-muted font-mono text-sm">ARCHIVE ACCESS ENABLED. VIEWING PAST EXTRACTIONS...</p>
                            {/* In a real app, we'd map over history here */}
                            <div className="mt-8 grid gap-4">
                                <div className="p-4 border border-hunter-border bg-black/40 rounded-lg flex justify-between items-center group hover:border-hunter-cyan/50 transition-all cursor-pointer">
                                    <div className="text-left">
                                        <div className="text-white font-mono text-xs">TARGET: NIKE.COM</div>
                                        <div className="text-hunter-muted text-[10px]">VERIFIED_EXTRACTION: 3 CODES</div>
                                    </div>
                                    <div className="text-hunter-cyan font-mono text-[10px]">2025-12-18</div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'inbox':
                return (
                    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="text-xl font-display font-black text-hunter-cyan mb-6 uppercase tracking-widest italic">SECURE INBOX</h3>
                        <div className="cyber-glass border-hunter-border p-8 text-center">
                            <p className="text-hunter-muted font-mono text-sm">ENCRYPTED VAULT. ALL SAVED CODES STORED HERE.</p>
                        </div>
                    </div>
                );
            case 'account':
                return (
                    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="text-xl font-display font-black text-hunter-cyan mb-6 uppercase tracking-widest italic">OPERATIVE PROFILE</h3>
                        <div className="cyber-glass border-hunter-border p-8">
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="text-[10px] text-hunter-muted font-mono uppercase tracking-widest">CREDENTIALS</div>
                                    <div className="p-4 bg-black/40 border border-hunter-border rounded-lg">
                                        <div className="text-white font-mono text-sm">HUNTER_LVL_1</div>
                                        <div className="text-hunter-cyan text-[10px] mt-1">PLAN: FREE_ACCESS</div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="text-[10px] text-hunter-muted font-mono uppercase tracking-widest">NODES_STATION</div>
                                    <div className="p-4 bg-black/40 border border-hunter-border rounded-lg">
                                        <div className="text-white font-mono text-sm">15 / 15 DAILY_TICKS</div>
                                        <div className="text-hunter-muted text-[10px] mt-1">RESETS_IN: 14H 22M</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            default:
                return (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center space-y-4">
                            <motion.h2
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-white text-3xl md:text-5xl font-display font-black tracking-tight"
                            >
                                DEPLOY <span className="text-hunter-cyan">HUNTING</span> NODES
                            </motion.h2>
                            <p className="text-hunter-muted font-mono text-xs uppercase tracking-[0.3em]">Neural link stable. Awaiting target parameters.</p>
                        </div>

                        <HeroSearchBar
                            query={query}
                            onQueryChange={onQueryChange}
                            onSearch={onSearch}
                            status={status}
                            searchLocation={searchLocation}
                            onLocationChange={onLocationChange}
                            showRegionWarning={false}
                        />

                        <div className="w-full">
                            <TerminalLog
                                logs={logs}
                                status={status}
                                isExpanded={true}
                                onToggle={() => { }}
                            />
                        </div>

                        {result && (
                            <ResultsDisplay
                                result={result}
                                onSaveCode={() => { }}
                                influencerCodes={[]}
                                glitchStatus={null}
                            />
                        )}
                    </div>
                );
        }
    };

    return (
        <main className="flex-1 flex flex-col items-center justify-start pt-24 md:pt-32 px-6 relative z-10 overflow-y-auto custom-scrollbar pb-20">
            {/* Background decorative grid */}
            <div className="absolute inset-0 bg-cyber-grid opacity-20 pointer-events-none"></div>

            <div className="w-full max-w-4xl relative z-10">
                {renderContent()}
            </div>
        </main>
    );
};

export default DashboardWorkspace;
