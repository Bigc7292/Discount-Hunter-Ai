import React, { useState, useRef, useEffect } from 'react';
import { Search, Loader2, Zap, ArrowRight, Lock, Database, LogIn, Crown, ShieldAlert, Frown, ExternalLink, Globe, ChevronDown, Check, Sparkles, Timer, Bell, Download, Plane, Shirt, Laptop, Pizza, Briefcase, MapPin, Sun, Moon, Crosshair, Target, ChevronRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion';

// --- FIREBASE IMPORTS ---
import { auth, db } from './firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, addDoc, query as firestoreQuery, onSnapshot, orderBy } from 'firebase/firestore';

import { SearchStatus, SearchResult, LogEntry, User, CouponCode, InboxItem, HistoryEntry } from './types';
import { runSearch } from './services/searchService';
import { subscribeToRecentSavings, formatSavingForTicker, RecentSaving } from './services/recentSavingsService';
import TerminalLog from './components/TerminalLog';
import ResultCard from './components/ResultCard';
import AuthModal from './components/AuthModal';
import PricingModal from './components/PricingModal';
import BackgroundCanvas from './components/BackgroundCanvas';
import HeroSearchBar from './components/HeroSearchBar';
import Dashboard from './components/Dashboard';
import LandingPage from './components/LandingPage';
import Sidebar from './components/Sidebar';
import DashboardWorkspace from './components/DashboardWorkspace';

// import { Continent, Country } from './types'; <--- Unused now
// import { ALL_COUNTRIES } from './data/countries'; <--- Unused now
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
            className="fixed top-0 left-0 w-12 h-12 pointer-events-none z-[100000] flex items-center justify-center pointer-events-none"
            style={{ translateX: cursorXSpring, translateY: cursorYSpring, marginLeft: -24, marginTop: -24 }}
        >
            <motion.div
                animate={{ scale: isHovering ? 1.2 : 1, rotate: isHovering ? 90 : 0 }}
                className="relative w-full h-full"
            >
                {/* Scope Ring */}
                <div className="absolute inset-0 border-2 border-[#00ff00] rounded-full opacity-60 shadow-[0_0_10px_#00ff00]"></div>

                {/* Crosshairs */}
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-[#00ff00]/50 -translate-y-1/2"></div>
                <div className="absolute left-1/2 top-0 h-full w-[1px] bg-[#00ff00]/50 -translate-x-1/2"></div>

                {/* Center Target */}
                <div className={`absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2 transition-colors duration-200 shadow-[0_0_5px_#00ff00] ${isHovering ? 'bg-red-500 shadow-red-500' : 'bg-[#00ff00]'}`}></div>
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


// Region data is now handled in src/data/countries.ts

// Dynamic LiveTicker component that reads from Firestore
const LiveTicker = () => {
    const [savings, setSavings] = useState<RecentSaving[]>([]);

    useEffect(() => {
        const unsubscribe = subscribeToRecentSavings((data) => {
            setSavings(data);
        }, 10);
        return () => unsubscribe();
    }, []);

    // Generate display text from savings data
    const displayTexts = savings.length > 0
        ? savings.map(formatSavingForTicker)
        : ['🔄 SYSTEM ONLINE: AWAITING LIVE DATA...'];

    return (
        <div className="bg-black/50 backdrop-blur border-b border-hunter-border py-1 overflow-hidden flex items-center z-50 relative">
            <div className="flex animate-marquee whitespace-nowrap">
                {[...displayTexts, ...displayTexts, ...displayTexts].map((text, i) => (
                    <div key={i} className="mx-6 flex items-center gap-2 text-[10px] text-hunter-cyan font-mono tracking-widest opacity-70">
                        <span className="w-1.5 h-1.5 rounded-full bg-hunter-green animate-pulse"></span>
                        {text}
                    </div>
                ))}
            </div>
        </div>
    );
};

const DealAlert = ({ merchant }: { merchant: string }) => {
    const [subscribed, setSubscribed] = useState(false);
    return subscribed ? (<div className="mt-8 bg-hunter-green/10 border border-hunter-green/30 rounded-lg p-4 text-center animate-in fade-in"> <Check className="mx-auto text-hunter-green mb-2" size={24} /> <div className="text-hunter-green font-display font-bold text-sm tracking-wide">ALERTS ACTIVATED</div> </div>) : (<div className="mt-8 bg-hunter-surface border border-hunter-border rounded-lg p-6 relative overflow-hidden group"> <div className="flex items-start gap-4 relative z-10"> <div className="bg-hunter-cyan/10 p-3 rounded-full border border-hunter-cyan/20"><Bell className="text-hunter-cyan" size={20} /></div> <div className="flex-1"> <h4 className="text-white font-display font-bold text-sm mb-1 uppercase tracking-wide">Monitor {merchant} Signals</h4> <p className="text-xs text-hunter-muted mb-4 font-mono">Our bots scan {merchant} every 15 minutes.</p> <form onSubmit={(e) => { e.preventDefault(); setSubscribed(true); }} className="flex gap-2"> <input type="email" required placeholder="OPERATIVE EMAIL..." className="flex-1 bg-black/50 border border-hunter-border rounded px-3 py-2 text-xs text-white focus:border-hunter-cyan focus:outline-none placeholder:text-hunter-muted/50 font-mono" /> <button type="submit" className="bg-hunter-cyan text-black font-bold font-display text-xs px-4 rounded hover:bg-white transition-colors">TRACK</button> </form> </div> </div> </div>);
};

// NEW: Warning Toast for Region Selection
// WarningToast component removed (replaced by HeroSearchBar internal warning)

export default function App() {
    const [query, setQuery] = useState('');
    const [searchLocation, setSearchLocation] = useState('');
    // const [searchRegionFlag, setSearchRegionFlag] = useState('🌍'); <--- Removed
    // const [regionSelected, setRegionSelected] = useState(false); <--- Removed logic
    // NEW STATE: Influencer & Glitch Layers
    const [influencerCodes, setInfluencerCodes] = useState<CouponCode[]>([]);
    const [glitchStatus, setGlitchStatus] = useState<{ probability: number, warning?: string } | null>(null);

    const [status, setStatus] = useState<SearchStatus>(SearchStatus.IDLE);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [result, setResult] = useState<SearchResult | null>(null);
    const [isLogExpanded, setIsLogExpanded] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [isPricingOpen, setIsPricingOpen] = useState(false);
    const [isDashboardOpen, setIsDashboardOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'inbox' | 'history' | 'account' | 'admin'>('overview');
    const [dailySearchesUsed, setDailySearchesUsed] = useState(0);
    const [inbox, setInbox] = useState<InboxItem[]>([]);
    const [searchHistory, setSearchHistory] = useState<HistoryEntry[]>([]);
    const [lang, setLang] = useState<LangCode>('en');
    const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
    const [isRegionMenuOpen, setIsRegionMenuOpen] = useState(false);
    const [showRegionWarning, setShowRegionWarning] = useState(false);
    const [darkMode, setDarkMode] = useState<boolean>(true);
    const t = translations[lang] || translations['en'];
    const langMenuRef = useRef<HTMLDivElement>(null);
    // const regionMenuRef = useRef<HTMLDivElement>(null);

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

    // Subscribe to User Inbox
    useEffect(() => {
        if (!user) { setInbox([]); return; }
        const q = firestoreQuery(collection(db, "users", user.id, "inbox"), orderBy("savedAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InboxItem));
            setInbox(items);
        });
        return () => unsubscribe();
    }, [user?.id]);

    useEffect(() => { function handleClickOutside(event: MouseEvent) { if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) { setIsLangMenuOpen(false); } } document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, []);

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

        setDailySearchesUsed(prev => prev + 1);
        if (user) { setUser({ ...user, dailySearchesUsed: user.dailySearchesUsed + 1 }); }

        // Use the real search pipeline from searchService
        await runSearch(
            activeQuery,
            searchLocation || 'US',
            user?.id || null,
            addLog,
            setStatus,
            setResult,
            setInfluencerCodes,
            setGlitchStatus
        );
    };

    // const handleCountrySelect = ... Removed

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
        <div className="min-h-screen text-hunter-text font-sans selection:bg-hunter-cyan selection:text-black flex flex-col overflow-x-hidden relative bg-hunter-bg">
            <BackgroundCanvas />
            <CyberCursor />

            {user ? (
                /* AUTHENTICATED DASHBOARD VIEW */
                <div className="flex h-screen overflow-hidden relative z-10 animate-in fade-in duration-700">
                    <Sidebar
                        user={user}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        onLogout={handleLogout}
                    />

                    <DashboardWorkspace
                        query={query}
                        onQueryChange={setQuery}
                        onSearch={(q) => handleSearch(undefined, q)}
                        status={status}
                        searchLocation={searchLocation}
                        onLocationChange={setSearchLocation}
                        logs={logs}
                        result={result}
                        activeTab={activeTab}
                    />

                    {/* Dashboard overlays (Portals) */}
                    {isDashboardOpen && (
                        <Dashboard
                            isOpen={isDashboardOpen}
                            onClose={() => setIsDashboardOpen(false)}
                            user={user}
                            onLogout={handleLogout}
                            onUpgrade={() => { setIsDashboardOpen(false); setIsPricingOpen(true); }}
                            onUserUpdate={(updatedUser) => setUser(updatedUser)}
                            inboxItems={inbox}
                            historyItems={searchHistory}
                        />
                    )}
                </div>
            ) : (
                /* PUBLIC LANDING VIEW */
                <div className="flex flex-col min-h-screen relative z-10">
                    <nav className="border-b border-hunter-border bg-black/50 backdrop-blur-md sticky top-0 z-30">
                        <div className="max-w-7xl mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
                            <div className="cursor-pointer group" onClick={handleGoHome}>
                                <img src="/logo.jpg" alt="Discount Hunter AI" className="h-10 md:h-16 w-auto object-contain drop-shadow-[0_0_20px_rgba(0,240,255,0.6)] transition-all group-hover:scale-105 group-hover:drop-shadow-[0_0_30px_rgba(0,240,255,0.8)]" />
                            </div>
                            <div className="flex items-center gap-2 md:gap-4">
                                <button onClick={() => setDarkMode(!darkMode)} className="p-1.5 md:p-2 text-hunter-muted hover:text-white transition-colors">
                                    {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                                </button>
                                <div className="flex items-center gap-2 md:gap-3">
                                    <button onClick={() => setIsAuthOpen(true)} className="text-xs font-mono text-hunter-cyan hover:text-white tracking-widest px-2">{t.login}</button>
                                    <button onClick={() => setIsAuthOpen(true)} className="bg-hunter-surface text-white border border-hunter-cyan/50 px-4 py-2 rounded text-xs font-bold hover:bg-hunter-cyan hover:text-black transition-all font-display tracking-wider flex items-center gap-2 shadow-[0_0_10px_rgba(0,240,255,0.2)]">
                                        <LogIn size={14} /> REGISTER
                                    </button>
                                </div>
                            </div>
                        </div>
                        <LiveTicker />
                    </nav>

                    <LandingPage onStartHunting={() => setIsAuthOpen(true)} />
                </div>
            )}

            <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onLogin={handleLogin} />
            <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} onUpgrade={handleUpgrade} />
        </div>
    );
}