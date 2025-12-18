import React from 'react';
import { SearchResult, CouponCode } from '../types';
import ResultCard from './ResultCard';
import { motion } from 'framer-motion';
import { ExternalLink, ShoppingCart, Globe, Zap, AlertTriangle } from 'lucide-react';

interface ResultsDisplayProps {
    result: SearchResult;
    onSaveCode: (code: CouponCode) => void;
    influencerCodes?: CouponCode[];
    glitchStatus?: { probability: number, warning?: string } | null;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ result, onSaveCode, influencerCodes = [], glitchStatus }) => {
    return (
        <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Merchant Header */}
            <div className="cyber-glass border-hunter-cyan/30 p-6 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-hunter-cyan/5 blur-3xl rounded-full"></div>

                <div className="flex items-center gap-6 relative z-10">
                    <div className="w-16 h-16 bg-black border border-hunter-cyan/30 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.1)]">
                        <ShoppingCart className="text-hunter-cyan" size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-display font-black text-white italic uppercase tracking-tighter">
                            {result.merchantName}
                        </h2>
                        <a
                            href={result.merchantUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-hunter-cyan/60 hover:text-hunter-cyan text-xs font-mono flex items-center gap-2 transition-colors"
                        >
                            <Globe size={12} />
                            {result.merchantUrl.replace('https://', '')}
                            <ExternalLink size={10} />
                        </a>
                    </div>
                </div>

                <div className="flex gap-4 relative z-10">
                    <div className="text-center px-4 border-r border-hunter-border">
                        <div className="text-hunter-cyan font-display font-bold text-xl">{result.stats.codesTested}</div>
                        <div className="text-[9px] text-hunter-muted uppercase font-mono tracking-widest">RAIDED</div>
                    </div>
                    <div className="text-center px-4">
                        <div className="text-hunter-green font-display font-bold text-xl">{result.codes.length}</div>
                        <div className="text-[9px] text-hunter-muted uppercase font-mono tracking-widest">EXTRACTED</div>
                    </div>
                </div>
            </div>

            {/* Glitch Warning if active */}
            {glitchStatus && glitchStatus.probability > 40 && (
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-purple-950/30 border border-purple-500/50 p-4 rounded-xl flex items-center gap-4 shadow-[0_0_20px_rgba(168,85,247,0.1)]"
                >
                    <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center shrink-0">
                        <Zap className="text-purple-400 animate-pulse" size={20} />
                    </div>
                    <div className="flex-1">
                        <div className="text-purple-300 font-display font-bold text-xs uppercase tracking-wider">SYSTEM VULNERABILITY DETECTED</div>
                        <p className="text-purple-300/60 text-[10px] font-mono">{glitchStatus.warning || 'Glitch protocols active. Check sidebar for unstable codes.'}</p>
                    </div>
                </motion.div>
            )}

            {/* Primary Extracted Codes */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-hunter-border"></div>
                    <span className="text-[10px] text-hunter-muted font-mono uppercase tracking-[0.4em]">Verified Extractions</span>
                    <div className="h-px flex-1 bg-hunter-border"></div>
                </div>

                {result.codes.length > 0 ? (
                    <div className="grid gap-4">
                        {result.codes.map((code, idx) => (
                            <ResultCard
                                key={idx}
                                code={code}
                                rank={idx}
                                onSave={onSaveCode}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="cyber-glass border-red-500/30 p-12 text-center">
                        <AlertTriangle className="text-red-500 mx-auto mb-4" size={40} />
                        <h3 className="text-white font-display font-bold uppercase italic">No Signals Found</h3>
                        <p className="text-hunter-muted font-mono text-xs mt-2">Target security too high. Manual verification suggested.</p>
                    </div>
                )}
            </div>

            {/* Influencer Layer */}
            {influencerCodes.length > 0 && (
                <div className="space-y-4 pt-8">
                    <div className="flex items-center gap-3 text-hunter-purple">
                        <div className="h-px flex-1 bg-hunter-purple/30"></div>
                        <span className="text-[10px] font-mono uppercase tracking-[0.4em]">Social Intel Signal</span>
                        <div className="h-px flex-1 bg-hunter-purple/30"></div>
                    </div>
                    <div className="grid gap-4 opacity-80 hover:opacity-100 transition-opacity">
                        {influencerCodes.map((code, idx) => (
                            <ResultCard
                                key={`infl-${idx}`}
                                code={code}
                                rank={idx + 10}
                                onSave={onSaveCode}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResultsDisplay;
