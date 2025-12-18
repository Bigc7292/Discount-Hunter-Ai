import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { ShieldCheck, Globe, Server, Cpu, Brain, ChevronDown, Activity, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TerminalLogProps {
  logs: LogEntry[];
  status: string;
  isExpanded: boolean;
  onToggle: () => void;
}

const TerminalLog: React.FC<TerminalLogProps> = ({ logs, status, isExpanded, onToggle }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const latestLog = logs.length > 0 ? logs[logs.length - 1] : { message: "INITIALIZING NEURAL NET...", type: 'system' };

  useEffect(() => {
    if (isExpanded) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isExpanded]);

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 relative z-20">

      {/* --- SUMMARY BAR (Always Visible) --- */}
      <motion.div
        layout
        onClick={onToggle}
        className={`cursor-pointer group relative overflow-hidden rounded-lg border backdrop-blur-md transition-all duration-300 ${isExpanded ? 'bg-[#020205] border-hunter-cyan/50 shadow-[0_0_20px_rgba(0,240,255,0.15)] rounded-b-none' : 'bg-black/60 border-hunter-border hover:border-hunter-cyan hover:bg-hunter-cyan/5'}`}
      >
        {/* Background Pulse Animation */}
        {!isExpanded && status !== 'COMPLETE' && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-hunter-cyan/5 to-transparent animate-scan"></div>
        )}

        <div className="p-4 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            {/* ANIMATED BRAIN ICON */}
            <div className="relative">
              <div className={`absolute inset-0 bg-hunter-cyan blur-md rounded-full transition-opacity duration-500 ${status === 'COMPLETE' ? 'opacity-0' : 'opacity-40 animate-pulse'}`}></div>
              <Brain
                size={24}
                className={`relative z-10 transition-colors duration-300 ${status === 'COMPLETE' ? 'text-hunter-green' : 'text-hunter-cyan'}`}
              />
              {status !== 'COMPLETE' && status !== 'IDLE' && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-hunter-purple rounded-full animate-ping"></div>
              )}
            </div>

            {/* STATUS TEXT */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs font-display font-bold tracking-widest text-white">
                  {status === 'COMPLETE' ? 'MISSION COMPLETE' : 'AI OPERATIVE ACTIVE'}
                </span>
                {status !== 'COMPLETE' && status !== 'IDLE' && (
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 bg-hunter-cyan rounded-full animate-bounce delay-0"></span>
                    <span className="w-1 h-1 bg-hunter-cyan rounded-full animate-bounce delay-100"></span>
                    <span className="w-1 h-1 bg-hunter-cyan rounded-full animate-bounce delay-200"></span>
                  </span>
                )}
              </div>

              {/* Latest Log Preview */}
              <div className="text-[10px] font-mono text-hunter-muted truncate max-w-[200px] md:max-w-md flex items-center gap-2">
                <Activity size={10} className="text-hunter-purple" />
                <span className="text-hunter-cyan/80">{latestLog.message}</span>
              </div>
            </div>
          </div>

          {/* TOGGLE BUTTON */}
          <div className="flex items-center gap-3">
            <span className="hidden md:block text-[9px] font-mono text-hunter-muted uppercase tracking-wider">
              {isExpanded ? 'COLLAPSE TERMINAL' : 'VIEW DATA STREAM'}
            </span>
            <div className={`p-1 rounded border border-hunter-border transition-all duration-300 ${isExpanded ? 'bg-hunter-cyan text-black rotate-180' : 'text-hunter-cyan bg-transparent'}`}>
              <ChevronDown size={16} />
            </div>
          </div>
        </div>
      </motion.div>

      {/* --- DETAILED TERMINAL (Collapsible) --- */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden bg-zinc-950/90 border-x border-b border-hunter-border rounded-b-lg relative"
          >
            {/* Inner Design Elements */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-hunter-cyan/30 to-transparent"></div>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,240,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.02)_1px,transparent_1px)] bg-[length:20px_20px] pointer-events-none"></div>

            {/* Log Content */}
            <div className="p-4 h-64 overflow-y-auto font-mono text-sm relative z-10 space-y-1 scrollbar-hide">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 border-l-2 border-transparent hover:border-hunter-cyan pl-2 transition-colors group">
                  <span className="text-hunter-muted/50 shrink-0 text-[10px] mt-1 group-hover:text-hunter-cyan/50">
                    [{log.timestamp}]
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {log.type === 'info' && <Globe size={12} className="text-blue-400" />}
                    {log.type === 'system' && <Server size={12} className="text-hunter-purple" />}
                    {log.type === 'success' && <ShieldCheck size={12} className="text-hunter-green" />}
                    {log.type === 'warning' && <Brain size={12} className="text-hunter-cyan" />}
                    {log.type === 'error' && <span className="text-red-500 font-bold">ERR</span>}
                  </div>
                  <span className={`
                    ${log.type === 'success' ? 'text-hunter-green font-bold drop-shadow-[0_0_3px_rgba(10,255,0,0.5)]' : ''}
                    ${log.type === 'error' ? 'text-red-500 line-through opacity-70' : ''}
                    ${log.type === 'warning' ? 'text-hunter-cyan' : ''}
                    ${log.type === 'info' || log.type === 'system' ? 'text-hunter-text/80' : ''}
                    `}>
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={bottomRef} />

              {status !== 'IDLE' && status !== 'COMPLETE' && status !== 'ERROR' && (
                <div className="flex items-center gap-2 mt-2 border-t border-dashed border-hunter-border/30 pt-2 animate-pulse">
                  <span className="w-1.5 h-1.5 bg-hunter-cyan rounded-full"></span>
                  <span className="text-hunter-cyan text-xs font-display tracking-[0.2em] font-black uppercase italic">Neural Overload Engaged... RAIDING SHADOW NETWORKS</span>
                </div>
              )}
            </div>

            {/* Footer Decoration */}
            <div className="bg-[#020205] px-4 py-1 flex justify-between items-center border-t border-hunter-border/30">
              <div className="flex gap-1">
                <Lock size={10} className="text-hunter-muted" />
                <span className="text-[9px] text-hunter-muted uppercase">Connection Secure (TLS 1.3)</span>
              </div>
              <div className="text-[9px] text-hunter-purple font-mono">NODE_ID: {Math.floor(Math.random() * 9999)}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TerminalLog;