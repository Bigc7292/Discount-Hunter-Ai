import React, { useEffect } from 'react';
import { LayoutDashboard, History, Inbox, Settings, LogOut, Crown, Shield, X } from 'lucide-react';

interface SidebarProps {
    activeTab: 'overview' | 'inbox' | 'history' | 'account' | 'admin';
    onTabChange: (tab: 'overview' | 'inbox' | 'history' | 'account' | 'admin') => void;
    onLogout: () => void;
    user: any;
    /** Mobile drawer open state. Ignored on md+ where sidebar is always in-flow. */
    isOpen?: boolean;
    onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    activeTab,
    onTabChange,
    onLogout,
    user,
    isOpen = false,
    onClose,
}) => {
    type TabId = 'overview' | 'inbox' | 'history' | 'account' | 'admin';
    const navItems: { id: TabId; label: string; icon: any; badge?: number }[] = [
        { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'inbox', label: 'Inbox', icon: Inbox, badge: 0 },
        { id: 'history', label: 'History', icon: History },
        { id: 'account', label: 'Account', icon: Settings },
    ];

    if (user.role === 'admin') {
        navItems.push({ id: 'admin', label: 'Command', icon: Shield });
    }

    // Esc closes mobile drawer
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    // Lock body scroll while mobile drawer is open
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [isOpen]);

    const handleTabChange = (tab: TabId) => {
        onTabChange(tab);
        onClose?.();
    };

    const renderPanel = (showClose: boolean) => (
        <aside
            className="
                w-64 h-full border-r border-hunter-border bg-black/95 md:bg-black/40
                backdrop-blur-md flex flex-col z-40
                shadow-[0_0_40px_rgba(0,240,255,0.08)]
            "
            aria-label="Dashboard navigation"
        >
            <div className="p-6 border-b border-hunter-border">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-hunter-purple to-hunter-cyan flex items-center justify-center text-white font-bold border border-white/20">
                        {user.email?.[0].toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <div className="text-sm font-bold text-white truncate">{user.email}</div>
                        <div className="flex items-center gap-1.5">
                            {user.plan === 'pro' || user.plan === 'yearly' || user.plan === 'lifetime' ? (
                                <span className="text-[9px] text-hunter-cyan font-bold tracking-widest flex items-center gap-1">
                                    <Crown size={8} /> VERIFIED
                                </span>
                            ) : (
                                <span className="text-[9px] text-hunter-muted font-bold tracking-widest">FREE AGENT</span>
                            )}
                        </div>
                    </div>
                    {showClose && (
                        <button
                            type="button"
                            onClick={() => onClose?.()}
                            className="p-2 -mr-2 text-hunter-muted hover:text-hunter-cyan rounded-lg hover:bg-white/5 transition-colors"
                            aria-label="Close menu"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
                {user.plan === 'free' && (
                    <button
                        type="button"
                        className="w-full py-2 bg-hunter-cyan/10 border border-hunter-cyan/30 text-hunter-cyan text-[10px] font-bold rounded-lg hover:bg-hunter-cyan hover:text-black transition-all"
                    >
                        UPGRADE TO ELITE
                    </button>
                )}
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => handleTabChange(item.id)}
                        className={`
                            w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group
                            ${activeTab === item.id
                                ? 'bg-hunter-cyan/10 text-hunter-cyan'
                                : 'text-hunter-muted hover:text-white hover:bg-white/5'}
                        `}
                    >
                        <item.icon size={18} className={activeTab === item.id ? 'text-hunter-cyan' : 'group-hover:text-hunter-cyan transition-colors'} />
                        <span className="text-sm font-bold tracking-wide font-display">{item.label}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                            <span className="ml-auto bg-hunter-cyan text-black text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                                {item.badge}
                            </span>
                        )}
                    </button>
                ))}
            </nav>

            <div className="p-4 border-t border-hunter-border space-y-1">
                {user.role === 'admin' && (
                    <button
                        type="button"
                        onClick={() => handleTabChange('admin')}
                        className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/5 rounded-xl transition-all"
                    >
                        <Shield size={18} />
                        <span className="text-sm font-bold font-display">COMMAND CENTER</span>
                    </button>
                )}
                <button
                    type="button"
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-hunter-muted hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                    <LogOut size={18} />
                    <span className="text-sm font-bold font-display">SIGNOUT</span>
                </button>
            </div>
        </aside>
    );

    return (
        <>
            {/* Desktop: in-flow sidebar (md+) — never overlays content */}
            <div className="hidden md:flex h-full shrink-0 z-20">
                {renderPanel(false)}
            </div>

            {/* Mobile: overlay drawer — off by default, hamburger opens */}
            <div
                className={`
                    md:hidden fixed inset-0 z-50
                    ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}
                `}
                aria-hidden={!isOpen}
            >
                <button
                    type="button"
                    aria-label="Dismiss menu"
                    onClick={() => onClose?.()}
                    className={`
                        absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300
                        ${isOpen ? 'opacity-100' : 'opacity-0'}
                    `}
                />
                <div
                    className={`
                        absolute inset-y-0 left-0 h-full transform transition-transform duration-300 ease-out
                        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                    `}
                >
                    {renderPanel(true)}
                </div>
            </div>
        </>
    );
};

export default Sidebar;
