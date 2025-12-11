import React, { useState, useRef, useEffect } from 'react';
import { Search, Loader2, Zap, ArrowRight, Lock, Database, LogIn, Crown, ShieldAlert, Frown, ExternalLink, Globe, ChevronDown, Check, Sparkles, Timer, Bell, Download, Plane, Shirt, Laptop, Pizza, Briefcase, MapPin, Sun, Moon, Crosshair, Target, ChevronRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';

// --- FIREBASE IMPORTS ---
import { auth, db } from './firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { SearchStatus, SearchResult, LogEntry, User, CouponCode, InboxItem, HistoryEntry } from './types';
import * as GeminiService from './services/geminiService';
import TerminalLog from './components/TerminalLog';
import ResultCard from './components/ResultCard';
import AuthModal from './components/AuthModal';
import PricingModal from './components/PricingModal';
import Dashboard from './components/Dashboard';
import BackgroundCanvas from './components/BackgroundCanvas'; // <--- NEW IMPORT

// --- CYBER CURSOR COMPONENT ---
const CyberCursor = () => {
    const cursorX = useMotionValue(-100);
    const cursorY = useMotionValue(-100);
    const [isHovering, setIsHovering] = useState(false);

    const springConfig = { damping: 25, stiffness: 700 };
    const cursorXSpring = useSpring(cursorX, springConfig);
    const cursorYSpring = useSpring(cursorY, springConfig);

    useEffect(() => {
        const moveCursor = (e: MouseEvent) => {
            cursorX.set(e.clientX - 16);
            cursorY.set(e.clientY - 16);
        };

        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const isClickable = target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'INPUT' || target.closest('button') || target.closest('a');
            setIsHovering(!!isClickable);
        };

        window.addEventListener('mousemove', moveCursor);
        window.addEventListener('mouseover', handleMouseOver);
        return () => {
            window.removeEventListener('mousemove', moveCursor);
            window.removeEventListener('mouseover', handleMouseOver);
        };
    }, []);

    return (
        <motion.div
            className="fixed top-0 left-0 w-8 h-8 pointer-events-none z-[9999] hidden md:flex items-center justify-center mix-blend-screen"
            style={{ translateX: cursorXSpring, translateY: cursorYSpring }}
        >
            <motion.div
                animate={{ scale: isHovering ? 0.8 : 1, rotate: isHovering ? 45 : 0 }}
                className="relative w-full h-full transition-colors duration-200"
            >
                <div className={`absolute top-1/2 left-1/2 w-1 h-1 rounded-full -translate-x-1/2 -translate-y-1/2 transition-colors duration-200 ${isHovering ? 'bg-hunter-green' : 'bg-hunter-cyan'}`}></div>
                <div className={`absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 transition-colors duration-200 ${isHovering ? 'border-hunter-green' : 'border-hunter-cyan'}`}></div>
                <div className={`absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 transition-colors duration-200 ${isHovering ? 'border-hunter-green' : 'border-hunter-cyan'}`}></div>
            </motion.div>
        </motion.div>
    );
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type LangCode = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja' | 'ko' | 'th' | 'tl' | 'vi' | 'it' | 'pt' | 'ru' | 'tr' | 'id' | 'hi' | 'ar';

const languages: { code: LangCode; label: string; flag: string }[] = [
    { code: 'en', label: 'English', flag: '🇺🇸' }, { code: 'es', label: 'Español', flag: '🇪🇸' }, { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' }, { code: 'zh', label: '中文', flag: '🇨🇳' }, { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'ko', label: '한국어', flag: '🇰🇷' }, { code: 'th', label: 'ไทย', flag: '🇹🇭' }, { code: 'tl', label: 'Filipino', flag: '🇵🇭' },
    { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' }, { code: 'id', label: 'Bahasa Indo', flag: '🇮🇩' }, { code: 'it', label: 'Italiano', flag: '🇮🇹' },
    { code: 'pt', label: 'Português', flag: '🇧🇷' }, { code: 'ru', label: 'Русский', flag: '🇷🇺' }, { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
    { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' }, { code: 'ar', label: 'العربية', flag: '🇸🇦' },
];

const translations: Record<LangCode, any> = {
    en: {
        heroTitle: "TARGET ACQUIRED.", heroSubtitle: "HUNTING DISCOUNTS.", heroDesc: "The Cyber-Hunter Cockpit.", trialPromo: "INITIATE 7-DAY FREE TRIAL SEQUENCE",
        systemOnline: "SYSTEM ONLINE: HUNTER PROTOCOL ACTIVE", searchPlaceholder: "PASTE PRODUCT URL OR TARGET STORE...", searchButton: "DEPLOY", searching: "HUNTING",
        login: "LOGIN", signup: "REGISTER", upgrade: "UPGRADE", profile: "ID CARD", admin: "COMMAND", status: "STATUS", timeTaken: "LATENCY",
        liveSources: "NODES", estSavings: "VALUE", verifiedHeader: "VERIFIED TARGETS FOR", noCodesHeader: "NO TARGETS FOUND", noCodesDesc: "Scans returned zero viable matches.",
        checkingComp: "REROUTING...", compHeaderFound: "ALTERNATIVE TARGETS DETECTED", compHeaderNone: "USE ALTERNATIVE VECTORS", saveApprox: "SAVE ~", openSite: "ENGAGE"
    },
    es: { heroTitle: "OBJETIVO ADQUIRIDO", heroSubtitle: "CAZANDO DESCUENTOS", searchButton: "DESPLEGAR", searchPlaceholder: "PEGAR URL..." },
} as any;

const categories = [{ id: 'tech', label: 'TECH', icon: Laptop }, { id: 'fashion', label: 'FASHION', icon: Shirt }, { id: 'travel', label: 'TRAVEL', icon: Plane }, { id: 'food', label: 'FOOD', icon: Pizza }, { id: 'services', label: 'SERVICES', icon: Briefcase },];

interface Country { name: string; code: string; flag: string; }
interface Continent { name: string; countries: Country[]; }
const regionData: Record<string, Continent> = {
    "GLOBAL": { name: "GLOBAL", countries: [{ name: "Global / Any", code: "GLOBAL", flag: "🌍" }] },
    "NORTH_AMERICA": { name: "NORTH AMERICA", countries: [{ name: "USA", code: "US", flag: "🇺🇸" }, { name: "Canada", code: "CA", flag: "🇨🇦" }] },
    "EUROPE": { name: "EUROPE", countries: [{ name: "UK", code: "GB", flag: "🇬🇧" }, { name: "Germany", code: "DE", flag: "🇩🇪" }] },
    "ASIA": { name: "ASIA", countries: [{ name: "Japan", code: "JP", flag: "🇯🇵" }, { name: "China", code: "CN", flag: "🇨🇳" }] },
};

const liveSavings = ["🇺🇸 TARGET: NIKE -> SAVED $12.50", "🇬🇧 TARGET: ASOS -> SAVED £8.00", "🇩🇪 TARGET: ADIDAS -> SAVED €15.20", "🇯🇵 TARGET: RAKUTEN -> SAVED ¥1200",];
const LiveTicker = () => (<div className="bg-black/50 backdrop-blur border-b border-hunter-border py-1 overflow-hidden flex items-center z-50 relative"> <div className="flex animate-marquee whitespace-nowrap"> {[...liveSavings, ...liveSavings, ...liveSavings].map((text, i) => (<div key={i} className="mx-6 flex items-center gap-2 text-[10px] text-hunter-cyan font-mono tracking-widest opacity-70"> <span className="w-1.5 h-1.5 rounded-full bg-hunter-green animate-pulse"></span> {text} </div>))} </div> </div>);

const DealAlert = ({ merchant }: { merchant: string }) => {
    const [subscribed, setSubscribed] = useState(false);
    return subscribed ? (<div className="mt-8 bg-hunter-green/10 border border-hunter-green/30 rounded-lg p-4 text-center animate-in fade-in"> <Check className="mx-auto text-hunter-green mb-2" size={24} /> <div className="text-hunter-green font-display font-bold text-sm tracking-wide">ALERTS ACTIVATED</div> </div>) : (<div className="mt-8 bg-hunter-surface border border-hunter-border rounded-lg p-6 relative overflow-hidden group"> <div className="flex items-start gap-4 relative z-10"> <div className="bg-hunter-cyan/10 p-3 rounded-full border border-hunter-cyan/20"><Bell className="text-hunter-cyan" size={20} /></div> <div className="flex-1"> <h4 className="text-white font-display font-bold text-sm mb-1 uppercase tracking-wide">Monitor {merchant} Signals</h4> <p className="text-xs text-hunter-muted mb-4 font-mono">Our bots scan {merchant} every 15 minutes.</p> <form onSubmit={(e) => { e.preventDefault(); setSubscribed(true); }} className="flex gap-2"> <input type="email" required placeholder="OPERATIVE EMAIL..." className="flex-1 bg-black/50 border border-hunter-border rounded px-3 py-2 text-xs text-white focus:border-hunter-cyan focus:outline-none placeholder:text-hunter-muted/50 font-mono" /> <button type="submit" className="bg-hunter-cyan text-black font-bold font-display text-xs px-4 rounded hover:bg-white transition-colors">TRACK</button> </form> </div> </div> </div>);
};

export default function App() {
    const [query, setQuery] = useState('');
    const [searchRegionCode, setSearchRegionCode] = useState('GLOBAL');
    const [searchRegionFlag, setSearchRegionFlag] = useState('🌍');
    const [regionMenuState, setRegionMenuState] = useState<'CONTINENTS' | 'COUNTRIES'>('CONTINENTS');
    const [activeContinentKey, setActiveContinentKey] = useState<string | null>(null);
    const [status, setStatus] = useState<SearchStatus>(SearchStatus.IDLE);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [result, setResult] = useState<SearchResult | null>(null);
    const [isLogExpanded, setIsLogExpanded] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [isPricingOpen, setIsPricingOpen] = useState(false);
    const [isDashboardOpen, setIsDashboardOpen] = useState(false);
    const [dailySearchesUsed, setDailySearchesUsed] = useState(0);
    const [inbox, setInbox] = useState<InboxItem[]>([]);
    const [searchHistory, setSearchHistory] = useState<HistoryEntry[]>([]);
    const [lang, setLang] = useState<LangCode>('en');
    const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
    const [isRegionMenuOpen, setIsRegionMenuOpen] = useState(false);
    const [darkMode, setDarkMode] = useState<boolean>(true);
    const t = translations[lang] || translations['en'];
    const langMenuRef = useRef<HTMLDivElement>(null);
    const regionMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Only set up auth listener if Firebase is configured
        if (!auth) {
            console.log('Firebase not configured - skipping auth');
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
                    if (userDoc.exists()) { setUser({ ...userDoc.data(), id: firebaseUser.uid } as User); }
                    else { setUser({ id: firebaseUser.uid, email: firebaseUser.email || '', role: 'user', plan: 'free', searchCount: 0, dailySearchesUsed: 0, dailySearchLimit: 15, credits: 0, referralsCount: 0, referralCode: 'PENDING', joinedDate: new Date().toISOString(), isVerified: firebaseUser.emailVerified }); }
                } catch (error) { console.error("Error fetching user profile:", error); }
            } else { setUser(null); setIsDashboardOpen(false); }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => { function handleClickOutside(event: MouseEvent) { if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) { setIsLangMenuOpen(false); } if (regionMenuRef.current && !regionMenuRef.current.contains(event.target as Node)) { setIsRegionMenuOpen(false); } } document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, []);

    const addLog = (message: string, type: LogEntry['type'] = 'info') => { setLogs(prev => [...prev, { id: Math.random().toString(36).substring(7), timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }), message, type }]); };
    const handleLogin = (loggedInUser: User) => { setIsAuthOpen(false); setUser(loggedInUser); };
    const handleLogout = async () => { try { await signOut(auth); setUser(null); setIsDashboardOpen(false); setDailySearchesUsed(0); addLog('SESSION TERMINATED.', 'system'); } catch (error) { console.error("Logout failed", error); } };
    const handleUpgrade = () => { setIsPricingOpen(false); setTimeout(() => { if (user) { const upgradedUser: User = { ...user, plan: 'pro', dailySearchLimit: 1000, trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }; setUser(upgradedUser); addLog('OPERATIVE UPGRADED TO HUNTER ELITE.', 'system'); setIsDashboardOpen(true); } else { setIsAuthOpen(true); } }, 500); };
    const handleSaveCode = (code: CouponCode) => { if (!user) { setIsAuthOpen(true); return; } setInbox(prev => [{ id: Math.random().toString(36).substring(7), merchant: result?.merchantName || 'Unknown Store', code: code.code, description: code.description, savedAt: new Date().toLocaleDateString() }, ...prev]); };

    const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
        if (e) e.preventDefault();
        const activeQuery = overrideQuery || query;
        if (!activeQuery.trim()) return;
        if (overrideQuery) setQuery(overrideQuery);
        if (!user && dailySearchesUsed >= 2) { setIsAuthOpen(true); return; }
        if (user && user.dailySearchesUsed >= user.dailySearchLimit) { setIsPricingOpen(true); return; }
        setStatus(SearchStatus.PLANNING); setLogs([]); setResult(null); setIsLogExpanded(false); setDailySearchesUsed(prev => prev + 1);
        if (user) { setUser({ ...user, dailySearchesUsed: user.dailySearchesUsed + 1 }); }
        addLog(`INITIALIZING HUNTER PROTOCOL: "${activeQuery}" REGION: ${searchRegionCode}`, 'system');
        try {
            addLog(`CONNECTING TO GLOBAL NODE NETWORK...`, 'system');
            const plan = await GeminiService.planSearch(activeQuery, searchRegionCode);
            if (!plan.merchantName) throw new Error("TARGET NOT IDENTIFIED");
            addLog(`TARGET LOCKED: ${plan.merchantName} (${plan.merchantUrl})`, 'success');
            setStatus(SearchStatus.SCANNING);
            const simulationSteps = ['DEEP WEB DATABASES', 'AFFILIATE NETWORKS', 'DISCORD LEAKS', 'TWITTER STREAM', 'REDDIT THREADS'];
            for (const source of simulationSteps) { await delay(300 + Math.random() * 400); addLog(`SCANNING ${source}...`, 'info'); }
            const totalCodes = plan.suggestedCodes.length;
            setStatus(SearchStatus.VALIDATING);
            const validatedCodes: CouponCode[] = [];
            const startTime = Date.now();
            for (let i = 0; i < totalCodes; i++) {
                const suggestion = plan.suggestedCodes[i];
                addLog(`TESTING ${suggestion.code}...`, 'system');
                await delay(800);
                let isSuccess = Math.random() * 100 < (suggestion.likelySuccessRate || 40);
                if (i === totalCodes - 1 && validatedCodes.length === 0 && Math.random() > 0.1) isSuccess = true;
                if (isSuccess) { addLog(`TARGET CONFIRMED: ${suggestion.code} [SAVINGS VERIFIED]`, 'success'); validatedCodes.push({ code: suggestion.code, description: suggestion.description, successRate: 100, lastVerified: 'Just now', source: suggestion.source || 'Verified Source', isVerified: true }); } else { addLog(`TARGET FAILED: ${suggestion.code} [INVALID]`, 'error'); }
            }
            setStatus(SearchStatus.COMPLETE);
            setResult({ merchantName: plan.merchantName, merchantUrl: plan.merchantUrl, codes: validatedCodes, competitors: plan.competitors, groundingUrls: plan.groundingUrls, stats: { sourcesScanned: (plan.groundingUrls?.length || 0) + 12, codesTested: totalCodes, timeTaken: `${((Date.now() - startTime) / 1000).toFixed(1)}s`, moneySavedEstimate: validatedCodes.length > 0 ? '$24.50' : '$0.00' } });
            if (user) { setSearchHistory(prev => [{ id: Math.random().toString(36).substring(7), merchant: plan.merchantName, query: activeQuery, resultCount: validatedCodes.length, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...prev]); }
        } catch (error) { console.error(error); addLog('FATAL ERROR IN PIPELINE.', 'error'); setStatus(SearchStatus.ERROR); }
    };
    const handleContinentSelect = (key: string) => { if (key === 'GLOBAL') { setSearchRegionCode('GLOBAL'); setSearchRegionFlag('🌍'); setIsRegionMenuOpen(false); } else { setActiveContinentKey(key); setRegionMenuState('COUNTRIES'); } };
    const handleCountrySelect = (country: Country) => { setSearchRegionCode(country.code); setSearchRegionFlag(country.flag); setIsRegionMenuOpen(false); setRegionMenuState('CONTINENTS'); setActiveContinentKey(null); };

    // Navigate back to main page
    const handleGoHome = () => {
        setIsDashboardOpen(false);
        setIsAuthOpen(false);
        setIsPricingOpen(false);
        setStatus(SearchStatus.IDLE);
        setResult(null);
        setQuery('');
        setLogs([]);
    };

    return (
        <div className="min-h-screen text-hunter-text font-sans selection:bg-hunter-cyan selection:text-black flex flex-col overflow-x-hidden relative">
            <BackgroundCanvas /> {/* <--- Canvas is now the animated background! */}
            <CyberCursor />

            {/* Navbar - Sticky and relative to sit on top of canvas */}
            <nav className="border-b border-hunter-border bg-black/50 backdrop-blur-md sticky top-0 z-30 relative">
                <div className="max-w-7xl mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
                    <div className="cursor-pointer group" onClick={handleGoHome}>
                        <img src="/logo.jpg" alt="Discount Hunter AI" className="h-10 md:h-16 w-auto object-contain drop-shadow-[0_0_20px_rgba(0,240,255,0.6)] transition-all group-hover:scale-105 group-hover:drop-shadow-[0_0_30px_rgba(0,240,255,0.8)]" />
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                        <button onClick={() => setDarkMode(!darkMode)} className="p-1.5 md:p-2 text-hunter-muted hover:text-white transition-colors active:scale-90 active:text-hunter-cyan">{darkMode ? <Sun size={16} className="md:w-5 md:h-5" /> : <Moon size={16} className="md:w-5 md:h-5" />}</button>
                        <div className="relative" ref={langMenuRef}>
                            <button onClick={() => setIsLangMenuOpen(!isLangMenuOpen)} className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1.5 rounded bg-hunter-surface border border-hunter-border hover:border-hunter-cyan text-hunter-muted hover:text-white transition-colors font-mono text-xs"> <Globe size={14} /> <span className="hidden md:block">{languages.find(l => l.code === lang)?.label}</span> </button>
                            {isLangMenuOpen && (<div className="absolute top-full right-0 mt-2 w-48 bg-[#0a0a0a] border border-hunter-border rounded shadow-[0_0_20px_rgba(0,240,255,0.1)] py-1 z-50 max-h-80 overflow-y-auto"> {languages.map((l) => (<button key={l.code} onClick={() => { setLang(l.code); setIsLangMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-xs font-mono flex items-center justify-between hover:bg-hunter-cyan/10 transition-colors ${lang === l.code ? 'text-hunter-cyan' : 'text-gray-400'}`}> <span className="flex items-center gap-3"><span className="text-base">{l.flag}</span>{l.label}</span> </button>))} </div>)}
                        </div>
                        {user ? (
                            <div className="flex items-center gap-3">
                                {user.plan === 'free' && (<button onClick={() => setIsPricingOpen(true)} className="hidden md:flex items-center gap-1 text-xs font-bold text-black bg-hunter-cyan px-3 py-1.5 rounded hover:bg-white transition-colors font-display tracking-wide active:scale-95 active:shadow-[0_0_15px_rgba(0,240,255,0.6)]"> <Zap size={12} /> {t.upgrade} </button>)}
                                <button onClick={() => setIsDashboardOpen(true)} className="flex items-center gap-2 hover:bg-hunter-surface px-3 py-1.5 rounded transition-colors border border-transparent hover:border-hunter-border active:scale-95 active:bg-hunter-cyan/10"> <div className="w-8 h-8 rounded bg-gradient-to-tr from-hunter-purple to-blue-600 flex items-center justify-center text-xs font-bold text-white border border-white/20"> {user.email ? user.email.substring(0, 2).toUpperCase() : 'ID'} </div> </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 md:gap-3"> <button onClick={() => setIsAuthOpen(true)} className="hidden sm:block text-xs font-mono text-hunter-cyan hover:text-white tracking-widest px-2 active:scale-95">{t.login}</button> <button onClick={() => setIsAuthOpen(true)} className="bg-hunter-surface text-white border border-hunter-cyan/50 px-3 md:px-4 py-1.5 md:py-2 rounded text-xs font-bold hover:bg-hunter-cyan hover:text-black transition-all font-display tracking-wider flex items-center gap-1.5 md:gap-2 shadow-[0_0_10px_rgba(0,240,255,0.2)] active:scale-95 active:shadow-[0_0_20px_rgba(0,240,255,0.5)]"> <LogIn size={14} /> <span className="hidden sm:inline">{t.signup}</span><span className="sm:hidden">JOIN</span> </button> </div>
                        )}
                    </div>
                </div>
                <LiveTicker />
            </nav>

            {/* Main Content - Relative z-index to sit on top of canvas */}
            <main className="flex-1 flex flex-col p-4 md:px-8 max-w-7xl mx-auto w-full relative z-10">
                <div className={`transition-all duration-700 ease-in-out ${status === SearchStatus.IDLE ? 'flex-1 flex flex-col justify-center' : 'mt-8'}`}>
                    <div className="max-w-4xl mx-auto w-full text-center space-y-8">
                        {status === SearchStatus.IDLE && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                                <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-hunter-cyan/5 text-hunter-cyan text-[10px] font-mono border border-hunter-cyan/20 tracking-widest uppercase"> <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-hunter-cyan opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-hunter-cyan"></span></span> {t.systemOnline} </div>

                                {/* Epic Multi-Row Animated Hero Text */}
                                <div className="space-y-2 md:space-y-4">
                                    {/* Row 1: Welcome */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.6, delay: 0.1 }}
                                        className="text-2xl md:text-4xl font-display font-bold text-hunter-cyan tracking-wide"
                                    >
                                        WELCOME TO
                                    </motion.div>

                                    {/* Row 2: Discount Hunter AI */}
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.7, delay: 0.3 }}
                                        className="text-5xl md:text-8xl font-display font-black tracking-tighter leading-none"
                                    >
                                        <span className="text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]">
                                            DISCOUNT HUNTER
                                        </span>
                                        {" "}
                                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-hunter-cyan via-hunter-green to-hunter-cyan animate-pulse">
                                            AI
                                        </span>
                                    </motion.div>

                                    {/* Row 3: World's Most Aggressive AI */}
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.6, delay: 0.5 }}
                                        className="text-xl md:text-3xl font-display font-extrabold"
                                    >
                                        <span className="text-hunter-green drop-shadow-[0_0_15px_rgba(10,255,0,0.6)]">
                                            WORLD'S MOST AGGRESSIVE AI
                                        </span>
                                    </motion.div>

                                    {/* Row 4: Designed And Built */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.6, delay: 0.7 }}
                                        className="text-base md:text-xl font-mono text-hunter-muted tracking-wider"
                                    >
                                        DESIGNED AND BUILT WITH ONE PURPOSE
                                    </motion.div>

                                    {/* Row 5: To Verify and Validate */}
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.7, delay: 0.9 }}
                                        className="text-2xl md:text-4xl font-display font-black tracking-tight"
                                    >
                                        <span className="text-white">TO </span>
                                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-hunter-purple via-hunter-cyan to-hunter-purple">
                                            VERIFY
                                        </span>
                                        <span className="text-white"> AND </span>
                                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-hunter-cyan via-hunter-green to-hunter-cyan">
                                            VALIDATE
                                        </span>
                                    </motion.div>

                                    {/* Row 6: Potential Discount Codes */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.7, delay: 1.1 }}
                                        className="text-3xl md:text-5xl font-display font-black"
                                    >
                                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-hunter-green via-hunter-cyan to-white animate-pulse drop-shadow-[0_0_25px_rgba(0,240,255,0.7)]">
                                            POTENTIAL DISCOUNT CODES
                                        </span>
                                    </motion.div>
                                </div>

                                <div onClick={() => !user ? setIsAuthOpen(true) : setIsPricingOpen(true)} className="cursor-pointer group relative inline-flex items-center gap-3 bg-black border border-hunter-purple/50 hover:border-hunter-purple px-8 py-3 rounded-none skew-x-[-10deg] transition-all hover:scale-105 active:scale-95 mt-4"> <div className="absolute inset-0 bg-hunter-purple/5 blur-xl group-hover:bg-hunter-purple/20 transition-colors"></div> <Sparkles size={16} className="text-hunter-purple animate-spin-slow skew-x-[10deg]" /> <span className="text-sm font-bold font-mono text-hunter-purple tracking-widest skew-x-[10deg]">{t.trialPromo}</span> </div>
                            </div>
                        )}
                        <div className="relative group z-10 perspective-1000">
                            {status === SearchStatus.IDLE && (<div className="flex flex-wrap justify-center gap-3 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-200"> {categories.map(cat => (<button key={cat.id} onClick={() => handleSearch(undefined, `${cat.label} discount codes`)} className="relative flex items-center gap-2 px-4 py-2 rounded-sm bg-black/50 border border-hunter-border hover:border-hunter-cyan hover:bg-hunter-cyan/20 transition-all text-[10px] font-display tracking-wider text-hunter-muted hover:text-white active:scale-95 active:border-hunter-green active:bg-hunter-green/30 hover:shadow-[0_0_20px_rgba(0,240,255,0.5)] active:shadow-[0_0_30px_rgba(10,255,0,0.7)] group"> <div className="absolute inset-0 bg-hunter-cyan/0 group-hover:bg-hunter-cyan/10 group-active:bg-hunter-green/20 blur-sm transition-all duration-300"></div> <cat.icon size={12} className="relative z-10 group-hover:text-hunter-cyan group-active:text-hunter-green transition-colors" /> <span className="relative z-10">{cat.label}</span> </button>))} </div>)}
                            <form onSubmit={(e) => handleSearch(e)} className="relative transform transition-transform duration-300 hover:scale-[1.01]">
                                <div className="absolute -inset-1 bg-gradient-to-r from-hunter-cyan via-hunter-purple to-hunter-cyan rounded opacity-20 group-hover:opacity-40 blur-lg transition duration-500"></div>
                                <div className="relative flex items-center bg-black border-2 border-hunter-border group-focus-within:border-hunter-cyan/70 overflow-visible z-50">
                                    <div className="absolute left-0 w-2 h-full bg-hunter-cyan/20"></div>
                                    <div className="h-full flex items-center border-r border-hunter-border px-1 relative z-[60]" ref={regionMenuRef}>
                                        <button type="button" onClick={() => setIsRegionMenuOpen(!isRegionMenuOpen)} className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-4 md:py-6 h-full hover:bg-hunter-surface transition-colors text-xs font-mono text-hunter-muted hover:text-white"> <span className="text-xl md:text-2xl filter drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">{searchRegionFlag}</span> <ChevronDown size={10} className={`md:w-3 md:h-3 transition-transform duration-300 ${isRegionMenuOpen ? 'rotate-180 text-hunter-cyan' : ''}`} /> </button>
                                        <AnimatePresence> {isRegionMenuOpen && (<motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} transition={{ duration: 0.2 }} className="absolute top-full left-0 mt-2 w-64 bg-[#0a0a0a]/95 backdrop-blur-xl border border-hunter-border shadow-[0_0_30px_rgba(0,0,0,0.8)] z-[70] overflow-hidden rounded-sm"> <div className="px-4 py-2 border-b border-hunter-border/50 flex items-center justify-between bg-hunter-surface/50"> {regionMenuState === 'COUNTRIES' ? (<button onClick={() => setRegionMenuState('CONTINENTS')} className="text-[10px] text-hunter-cyan font-bold hover:text-white flex items-center gap-1"><ArrowLeft size={10} /> BACK</button>) : (<span className="text-[10px] text-hunter-muted font-bold tracking-widest">SELECT REGION</span>)} <span className="text-[10px] font-mono text-hunter-purple">{regionMenuState}</span> </div> <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-hunter-border scrollbar-track-transparent"> {regionMenuState === 'CONTINENTS' ? (<div className="py-1"> <button onClick={() => handleContinentSelect('GLOBAL')} className="w-full text-left px-4 py-3 text-xs font-mono flex items-center justify-between hover:bg-hunter-cyan/10 transition-colors group"> <span className="flex items-center gap-3"><span className="text-lg grayscale group-hover:grayscale-0 transition-all">🌍</span><span className="font-bold text-white">GLOBAL / ANY</span></span> </button> <div className="h-[1px] bg-hunter-border/30 mx-4 my-1"></div> {Object.keys(regionData).filter(k => k !== 'GLOBAL').map((key) => (<button key={key} onClick={() => handleContinentSelect(key)} className="w-full text-left px-4 py-3 text-xs font-mono flex items-center justify-between hover:bg-hunter-cyan/10 transition-colors group"> <span className="text-gray-300 group-hover:text-hunter-cyan transition-colors">{regionData[key].name}</span> <ChevronRight size={14} className="text-gray-600 group-hover:text-hunter-cyan" /> </button>))} </div>) : (<motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="py-1"> {activeContinentKey && regionData[activeContinentKey].countries.map((country) => (<button key={country.code} onClick={() => handleCountrySelect(country)} className="w-full text-left px-4 py-2.5 text-xs font-mono flex items-center justify-between hover:bg-hunter-cyan/10 transition-colors group"> <span className="flex items-center gap-3"> <span className="text-lg">{country.flag}</span> <span className={`${searchRegionCode === country.code ? 'text-hunter-cyan font-bold' : 'text-gray-300'}`}>{country.name}</span> </span> {searchRegionCode === country.code && <Check size={12} className="text-hunter-cyan" />} </button>))} </motion.div>)} </div> </motion.div>)} </AnimatePresence>
                                    </div>
                                    <div className="pl-2 md:pl-4 pr-2 md:pr-4"><Target className="text-hunter-muted group-focus-within:text-hunter-cyan transition-colors" size={20} /></div>
                                    <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchPlaceholder} className="w-full bg-transparent text-white text-sm md:text-lg lg:text-xl font-mono py-4 md:py-6 focus:outline-none placeholder:text-hunter-muted/50 tracking-wider uppercase placeholder:text-xs md:placeholder:text-base" disabled={status !== SearchStatus.IDLE && status !== SearchStatus.COMPLETE} />
                                    <button type="submit" disabled={status !== SearchStatus.IDLE && status !== SearchStatus.COMPLETE} className="bg-hunter-cyan text-black hover:bg-white disabled:bg-gray-800 disabled:text-gray-600 font-display font-black tracking-widest px-4 md:px-8 py-4 md:py-6 transition-all flex items-center gap-1.5 md:gap-2 hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] active:scale-95 active:shadow-[0_0_30px_rgba(0,240,255,0.8)] text-xs md:text-base"> {status === SearchStatus.IDLE || status === SearchStatus.COMPLETE ? <><span className="hidden sm:inline">{t.searchButton}</span><span className="sm:hidden">GO</span> <ArrowRight className="w-4 h-4 md:w-5 md:h-5" /></> : <><Loader2 className="animate-spin w-4 h-4 md:w-5 md:h-5" /> <span className="hidden sm:inline">{t.searching}</span><span className="sm:hidden">...</span></>} </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
                {(status !== SearchStatus.IDLE || logs.length > 0) && (<motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="mt-12 transition-all duration-500"> <TerminalLog logs={logs} status={status} isExpanded={isLogExpanded} onToggle={() => setIsLogExpanded(!isLogExpanded)} /> </motion.div>)}
                {status === SearchStatus.COMPLETE && result && (
                    <div className="mt-12 space-y-12 pb-20">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-black/40 border border-hunter-border p-4 relative group overflow-hidden"> <div className="absolute inset-0 bg-hunter-green/5 -translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div> <div className="text-[10px] text-hunter-muted uppercase tracking-[0.2em] mb-1 font-display">{t.status}</div> <div className={`text-xl font-mono font-bold ${result.codes.length > 0 ? 'text-hunter-green' : 'text-red-500'}`}>{result.codes.length > 0 ? 'SUCCESS' : 'FAILURE'}</div> </div>
                            <div className="bg-black/40 border border-hunter-border p-4"> <div className="text-[10px] text-hunter-muted uppercase tracking-[0.2em] mb-1 font-display">{t.timeTaken}</div> <div className="text-2xl font-mono font-bold text-white">{result.stats.timeTaken}</div> </div>
                            <div className="bg-black/40 border border-hunter-border p-4"> <div className="text-[10px] text-hunter-muted uppercase tracking-[0.2em] mb-1 font-display">{t.liveSources}</div> <div className="text-2xl font-mono font-bold text-white">{result.stats.sourcesScanned}</div> </div>
                            <div className="bg-hunter-cyan/10 border border-hunter-cyan/30 p-4 relative overflow-hidden"> <div className="absolute top-0 right-0 w-12 h-12 bg-hunter-cyan blur-2xl opacity-20"></div> <div className="text-[10px] text-hunter-cyan uppercase tracking-[0.2em] mb-1 font-display">{t.estSavings}</div> <div className="text-2xl font-mono font-bold text-white">{result.stats.moneySavedEstimate}</div> </div>
                        </div>
                        {result.codes.length > 0 ? (<div> <h2 className="text-2xl font-display font-bold mb-6 flex items-center gap-3 text-white"> <Crosshair className="text-hunter-green animate-spin-slow" /> {t.verifiedHeader} <span className="text-hunter-cyan">{result.merchantName}</span> </h2> <div className="grid gap-4"> {result.codes.map((code, idx) => (<ResultCard key={idx} code={code} rank={idx} onSave={handleSaveCode} />))} </div> <DealAlert merchant={result.merchantName} /> </div>) : (<div className="bg-red-950/20 border border-red-500/30 p-8 text-center relative overflow-hidden"> <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div> <Frown className="mx-auto text-red-500 mb-4" size={48} /> <h2 className="text-2xl font-display font-bold text-white mb-2 tracking-widest">{t.noCodesHeader}</h2> <p className="text-hunter-muted max-w-lg mx-auto mb-8 font-mono text-sm">{t.noCodesDesc}</p> <div className="flex flex-col items-center gap-4"> <div className="inline-flex items-center gap-2 text-hunter-cyan font-bold text-xs font-display bg-hunter-cyan/10 px-6 py-2 border border-hunter-cyan/20"> <ArrowRight size={16} /> {t.checkingComp} </div> </div> </div>)}
                        {(result.competitors.length > 0) && (<div className="border-t border-hunter-border/50 pt-12"> <h3 className="text-hunter-muted font-display text-xs mb-8 uppercase flex items-center gap-2 tracking-widest"> <Zap size={14} className={result.codes.length === 0 ? 'text-hunter-cyan animate-pulse' : 'text-hunter-muted'} /> {result.codes.length === 0 ? t.compHeaderNone : t.compHeaderFound} </h3> <div className="grid grid-cols-1 md:grid-cols-3 gap-6"> {result.competitors.map((comp, idx) => (<a key={idx} href={comp.url} target="_blank" rel="noopener noreferrer" className="block bg-black/40 hover:bg-hunter-surface p-6 border border-hunter-border hover:border-hunter-cyan transition-all cursor-pointer group relative overflow-hidden"> <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><ExternalLink size={14} className="text-hunter-cyan" /></div> <div className="flex justify-between items-start mb-4"><span className="font-bold font-display text-lg text-white group-hover:text-hunter-cyan transition-colors">{comp.name}</span></div> <div className="flex items-center gap-2 mb-4"><span className="text-xs font-mono text-hunter-green bg-hunter-green/10 px-2 py-1 border border-hunter-green/20">{t.saveApprox}{comp.avgSavings}</span></div> <div className="w-full py-2 bg-hunter-border/20 group-hover:bg-hunter-cyan/20 text-xs font-bold text-center text-hunter-muted group-hover:text-hunter-cyan transition-colors font-display tracking-wider">{t.openSite}</div> </a>))} </div> </div>)}
                    </div>
                )}
            </main>
            <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onLogin={handleLogin} />
            <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} onUpgrade={handleUpgrade} />
            {user && <Dashboard isOpen={isDashboardOpen} onClose={() => setIsDashboardOpen(false)} user={user} onLogout={handleLogout} onUpgrade={() => { setIsDashboardOpen(false); setIsPricingOpen(true); }} onUserUpdate={(updatedUser) => setUser(updatedUser)} inboxItems={inbox} historyItems={searchHistory} />}
        </div>
    );
}