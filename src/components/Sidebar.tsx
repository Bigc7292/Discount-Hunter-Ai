import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, History, Inbox, Settings, LogOut, User, Crown, Shield } from 'lucide-react';

interface SidebarProps {
    activeTab: 'overview' | 'inbox' | 'history' | 'account' | 'admin';
    onTabChange: (tab: 'overview' | 'inbox' | 'history' | 'account' | 'admin') => void;
    onLogout: () => void;
    user: any;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, onLogout, user }) => {
    type TabId = 'overview' | 'inbox' | 'history' | 'account' | 'admin';
    const navItems: { id: TabId, label: string, icon: any, badge?: number }[] = [
        { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'inbox', label: 'Inbox', icon: Inbox, badge: 0 },
        { id: 'history', label: 'History', icon: History },
        { id: 'account', label: 'Account', icon: Settings },
    ];

    if (user.role === 'admin') {
        navItems.push({ id: 'admin', label: 'Command', icon: Shield });
    }

    return (
        <aside className="w-64 h-full border-r border-hunter-border bg-black/40 backdrop-blur-md flex flex-col z-20">
            {/* User Profile Header */}
            <div className="p-6 border-b border-hunter-border">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-hunter-purple to-hunter-cyan flex items-center justify-center text-white font-bold border border-white/20">
                        {user.email?.[0].toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <div className="text-sm font-bold text-white truncate">{user.email}</div>
                        <div className="flex items-center gap-1.5">
                            {user.plan === 'pro' ? (
                                <span className="text-[9px] text-hunter-cyan font-bold tracking-widest flex items-center gap-1">
                                    <Crown size={8} /> PRO
                                </span>
                            ) : (
                                <span className="text-[9px] text-hunter-muted font-bold tracking-widest">FREE AGENT</span>
                            )}
                        </div>
                    </div>
                </div>
                {user.plan === 'free' && (
                    <button className="w-full py-2 bg-hunter-cyan/10 border border-hunter-cyan/30 text-hunter-cyan text-[10px] font-bold rounded-lg hover:bg-hunter-cyan hover:text-black transition-all">
                        UPGRADE TO ELITE
                    </button>
                )}
            </div>

            {/* Navigation Navigation */}
            <nav className="flex-1 p-4 space-y-1">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
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

            {/* Footer Actions */}
            <div className="p-4 border-t border-hunter-border space-y-1">
                {user.role === 'admin' && (
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-500/5 rounded-xl transition-all">
                        <Shield size={18} />
                        <span className="text-sm font-bold font-display">COMMAND CENTER</span>
                    </button>
                )}
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-hunter-muted hover:text-white hover:bg-white/5 rounded-xl transition-all"
                >
                    <LogOut size={18} />
                    <span className="text-sm font-bold font-display">SIGNOUT</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
