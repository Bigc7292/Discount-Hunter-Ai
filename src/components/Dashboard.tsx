import React, { useState } from 'react';
import { User, InboxItem, HistoryEntry } from '../types';
import { UserCircle, Crown, Users, Gift, LogOut, BarChart3, DollarSign, Activity, Server, Search, RefreshCw, Trash2, Shield, ArrowLeft, CheckCircle, XCircle, Plus, Clock, TrendingUp, CreditCard, Chrome, Inbox, History, Filter, Copy } from 'lucide-react';

interface DashboardProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onUpgrade: () => void;
  onUserUpdate?: (user: User) => void;
  inboxItems: InboxItem[];
  historyItems: HistoryEntry[];
}

const Dashboard: React.FC<DashboardProps> = ({ user, isOpen, onClose, onLogout, onUpgrade, onUserUpdate, inboxItems, historyItems }) => {
  const [adminTab, setAdminTab] = useState<'overview' | 'users' | 'analytics'>('overview');
  const [userTab, setUserTab] = useState<'profile' | 'inbox' | 'history'>('profile');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  
  // Mock Data for Admin Management
  const [managedUsers, setManagedUsers] = useState<User[]>([
    { id: 'u1', email: 'sarah.connor@sky.net', role: 'user', plan: 'pro', searchCount: 156, dailySearchesUsed: 3, dailySearchLimit: 1000, referralCode: 'FATE01', referralsCount: 12, credits: 120, joinedDate: '2025-01-15', isVerified: true },
    { id: 'u2', email: 'neo@matrix.io', role: 'user', plan: 'free', searchCount: 5, dailySearchesUsed: 5, dailySearchLimit: 5, referralCode: 'ONE', referralsCount: 0, credits: 0, joinedDate: '2025-02-01', isVerified: true },
    { id: 'u3', email: 'john.wick@continental.com', role: 'user', plan: 'pro', searchCount: 842, dailySearchesUsed: 12, dailySearchLimit: 1000, referralCode: 'DOG', referralsCount: 55, credits: 550, joinedDate: '2024-12-10', isVerified: true },
    { id: 'u4', email: 'guest_77@temp.com', role: 'user', plan: 'free', searchCount: 2, dailySearchesUsed: 2, dailySearchLimit: 5, referralCode: 'G77', referralsCount: 0, credits: 0, joinedDate: '2025-02-21', isVerified: false },
    { id: 'u5', email: 'admin_test@sniper.io', role: 'admin', plan: 'pro', searchCount: 0, dailySearchesUsed: 0, dailySearchLimit: 1000, referralCode: 'ROOT', referralsCount: 0, credits: 0, joinedDate: '2024-01-01', isVerified: true },
  ]);

  if (!isOpen) return null;

  const copyRef = () => {
    navigator.clipboard.writeText(`https://codesniper.io/?ref=${user.referralCode}`);
    alert('Referral link copied!');
  };

  const handleSimulateReferral = () => {
      if (!onUserUpdate) return;
      const newCount = (user.referralsCount || 0) + 1;
      const newCredits = (user.credits || 0) + 15;
      
      // Auto upgrade if target reached
      const newPlan = newCount >= 3 ? 'pro' : user.plan;
      
      onUserUpdate({
          ...user,
          referralsCount: newCount,
          credits: newCredits,
          plan: newPlan
      });
      
      if (newPlan === 'pro' && user.plan === 'free') {
          alert("🎉 Congratulations! You've referred 3 friends and unlocked Sniper Elite for FREE!");
      }
  };

  // Admin Actions
  const handleTogglePlan = (userId: string) => {
      setManagedUsers(users => users.map(u => {
          if (u.id === userId) {
              return { ...u, plan: u.plan === 'free' ? 'pro' : 'free' };
          }
          return u;
      }));
  };

  const handleResetSearch = (userId: string) => {
      setManagedUsers(users => users.map(u => {
          if (u.id === userId) return { ...u, dailySearchesUsed: 0 };
          return u;
      }));
  };

  const handleDeleteUser = (userId: string) => {
      if (confirm('Permanently delete this user?')) {
          setManagedUsers(users => users.filter(u => u.id !== userId));
      }
  };

  const filteredUsers = managedUsers.filter(u => 
      u.email.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
      u.id.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  // --- CHART COMPONENTS (Simulated) ---
  const BarChartSim = () => (
      <div className="h-32 flex items-end justify-between gap-1 mt-4">
        {[35, 45, 30, 60, 55, 80, 70, 90, 65, 85].map((h, i) => (
          <div key={i} className="flex-1 bg-hunter-cyan/20 hover:bg-hunter-cyan transition-all duration-300 rounded-t relative group" style={{ height: `${h}%` }}>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white border border-white/20 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
               ${h * 42}
            </div>
          </div>
        ))}
      </div>
  );

  const FunnelChart = () => (
      <div className="flex flex-col gap-2 mt-4">
          <div className="relative h-8 bg-gray-800 rounded flex items-center px-4">
              <span className="text-xs text-white z-10 font-bold flex justify-between w-full"><span>Visitors</span> <span>10,000</span></span>
              <div className="absolute left-0 h-full bg-blue-900/50 rounded w-full"></div>
          </div>
          <div className="flex justify-center"><div className="h-4 w-0.5 bg-gray-700"></div></div>
          <div className="relative h-8 bg-gray-800 rounded flex items-center px-4 mx-4">
              <span className="text-xs text-white z-10 font-bold flex justify-between w-full"><span>Trial Started</span> <span>2,500 (25%)</span></span>
              <div className="absolute left-0 h-full bg-blue-800/50 rounded w-[25%]"></div>
          </div>
          <div className="flex justify-center"><div className="h-4 w-0.5 bg-gray-700"></div></div>
          <div className="relative h-8 bg-gray-800 rounded flex items-center px-4 mx-8">
              <span className="text-xs text-white z-10 font-bold flex justify-between w-full"><span>Paid Pro</span> <span>850 (8.5%)</span></span>
              <div className="absolute left-0 h-full bg-hunter-cyan/50 rounded w-[8.5%]"></div>
          </div>
      </div>
  );

  const CohortChart = () => (
      <div className="h-32 flex items-end gap-1 mt-4 border-l border-b border-gray-700 p-2">
          {[100, 85, 70, 65, 62, 60, 58, 55].map((h, i) => (
              <div key={i} className="flex-1 bg-hunter-purple/20 border-t border-hunter-purple/50 relative group" style={{ height: `${h}%` }}>
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] text-gray-400 opacity-0 group-hover:opacity-100">W{i+1}</div>
              </div>
          ))}
      </div>
  );

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`w-full ${user.role === 'admin' ? 'max-w-4xl' : 'max-w-md'} bg-hunter-bg border-l border-hunter-border h-full shadow-2xl p-6 flex flex-col animate-in slide-in-from-right duration-300 transition-colors`}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold font-mono flex items-center gap-2 text-white">
                {user.role === 'admin' ? <Server className="text-red-500" /> : <UserCircle className="text-hunter-cyan" />}
                {user.role === 'admin' ? 'COMMAND CENTER' : 'USER PROFILE'}
            </h2>
            <button onClick={onClose} className="text-hunter-muted hover:text-white">Close</button>
        </div>

        {/* ADMIN INTERFACE */}
        {user.role === 'admin' && (
            <div className="flex flex-col h-full overflow-hidden">
                {/* Admin Tabs */}
                <div className="flex border-b border-hunter-border mb-6">
                    <button onClick={() => setAdminTab('overview')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors font-display tracking-wider ${adminTab === 'overview' ? 'border-hunter-cyan text-white' : 'border-transparent text-hunter-muted hover:text-white'}`}>KPI & ANALYTICS</button>
                    <button onClick={() => setAdminTab('analytics')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors font-display tracking-wider ${adminTab === 'analytics' ? 'border-hunter-cyan text-white' : 'border-transparent text-hunter-muted hover:text-white'}`}>GROWTH</button>
                    <button onClick={() => setAdminTab('users')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors font-display tracking-wider ${adminTab === 'users' ? 'border-hunter-cyan text-white' : 'border-transparent text-hunter-muted hover:text-white'}`}>USER MGMT</button>
                </div>

                {/* OVERVIEW TAB */}
                {adminTab === 'overview' && (
                    <div className="space-y-6 flex-1 overflow-y-auto pr-2">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                             <div className="bg-hunter-surface p-4 rounded-lg border border-hunter-border">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-hunter-muted text-xs uppercase">Total Revenue</div>
                                    <DollarSign size={14} className="text-green-500" />
                                </div>
                                <div className="text-2xl font-mono font-bold text-white">$42,104</div>
                                <div className="text-xs text-green-500 mt-1 flex items-center gap-1"><TrendingUp size={10} /> +12% vs last mo</div>
                            </div>
                            <div className="bg-hunter-surface p-4 rounded-lg border border-hunter-border">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-hunter-muted text-xs uppercase">Active Users</div>
                                    <Users size={14} className="text-blue-500" />
                                </div>
                                <div className="text-2xl font-mono font-bold text-white">1,240</div>
                                <div className="text-xs text-blue-500 mt-1 flex items-center gap-1"><TrendingUp size={10} /> +8% this week</div>
                            </div>
                            <div className="bg-hunter-surface p-4 rounded-lg border border-hunter-border">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-hunter-muted text-xs uppercase">Search Success</div>
                                    <CheckCircle size={14} className="text-hunter-cyan" />
                                </div>
                                <div className="text-2xl font-mono font-bold text-white">94.2%</div>
                                <div className="text-xs text-hunter-muted mt-1">Global Rate</div>
                            </div>
                            <div className="bg-hunter-surface p-4 rounded-lg border border-hunter-border">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-hunter-muted text-xs uppercase">Server Load</div>
                                    <Activity size={14} className="text-yellow-500" />
                                </div>
                                <div className="text-2xl font-mono font-bold text-white">42%</div>
                                <div className="text-xs text-green-500 mt-1">Healthy</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Revenue Chart */}
                            <div className="bg-hunter-surface p-5 rounded-lg border border-hunter-border">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-bold text-white text-sm">Revenue Trend (10 Days)</h3>
                                    <BarChart3 size={16} className="text-hunter-muted" />
                                </div>
                                <BarChartSim />
                            </div>
                        </div>
                    </div>
                )}

                {/* GROWTH ANALYTICS TAB (New Feature) */}
                {adminTab === 'analytics' && (
                    <div className="space-y-6 flex-1 overflow-y-auto pr-2">
                        <div className="bg-hunter-surface p-5 rounded-lg border border-hunter-border">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-white text-sm">Conversion Funnel</h3>
                                <Filter size={16} className="text-hunter-muted" />
                            </div>
                            <p className="text-xs text-hunter-muted mb-4">Visitor to Paid Subscriber conversion path.</p>
                            <FunnelChart />
                        </div>

                        <div className="bg-hunter-surface p-5 rounded-lg border border-hunter-border">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-bold text-white text-sm">Cohort Retention</h3>
                                <Users size={16} className="text-hunter-muted" />
                            </div>
                            <p className="text-xs text-hunter-muted mb-4">Weekly user retention rate (8 weeks).</p>
                            <CohortChart />
                        </div>
                    </div>
                )}

                {/* USERS TAB */}
                {adminTab === 'users' && (
                    <div className="flex flex-col h-full overflow-hidden">
                        {/* Search Bar */}
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-2.5 text-hunter-muted" size={16} />
                            <input 
                                type="text" 
                                placeholder="Search by email or ID..."
                                value={userSearchTerm}
                                onChange={(e) => setUserSearchTerm(e.target.value)}
                                className="w-full bg-hunter-surface border border-hunter-border rounded-lg pl-9 py-2 text-sm text-white focus:border-hunter-cyan focus:outline-none placeholder:text-hunter-muted"
                            />
                        </div>

                        {/* User Table Header */}
                        <div className="grid grid-cols-12 gap-2 text-[10px] uppercase text-hunter-muted font-bold px-3 mb-2 font-mono">
                            <div className="col-span-5">User / Email</div>
                            <div className="col-span-2">Plan</div>
                            <div className="col-span-2">Daily Usage</div>
                            <div className="col-span-3 text-right">Actions</div>
                        </div>

                        {/* User List */}
                        <div className="flex-1 overflow-y-auto space-y-1 pr-2">
                            {filteredUsers.map(u => (
                                <div key={u.id} className="bg-hunter-surface hover:bg-hunter-bg border border-hunter-border rounded-lg p-3 grid grid-cols-12 gap-2 items-center transition-colors">
                                    
                                    {/* User Info */}
                                    <div className="col-span-5 overflow-hidden">
                                        <div className="flex items-center gap-2">
                                            <div className="text-white font-mono text-xs font-bold truncate">{u.email}</div>
                                            {u.isVerified && <CheckCircle size={10} className="text-hunter-cyan shrink-0" />}
                                            {u.role === 'admin' && <span className="bg-red-500/20 text-red-400 text-[9px] px-1 rounded border border-red-500/30">ADMIN</span>}
                                        </div>
                                        <div className="text-[10px] text-hunter-muted truncate">ID: {u.id}</div>
                                    </div>

                                    {/* Plan */}
                                    <div className="col-span-2">
                                        <button 
                                            onClick={() => handleTogglePlan(u.id)}
                                            className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${u.plan === 'pro' ? 'bg-hunter-cyan/20 text-hunter-cyan border-hunter-cyan/30 hover:bg-hunter-cyan/30' : 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'}`}
                                        >
                                            {u.plan.toUpperCase()}
                                        </button>
                                    </div>

                                    {/* Searches */}
                                    <div className="col-span-2 flex items-center gap-2">
                                        <span className={`text-xs font-mono ${u.dailySearchesUsed >= u.dailySearchLimit ? 'text-red-500' : 'text-white'}`}>{u.dailySearchesUsed}/{u.dailySearchLimit}</span>
                                    </div>
                                    
                                    {/* Actions */}
                                    <div className="col-span-3 flex justify-end gap-2">
                                        <button onClick={() => handleResetSearch(u.id)} className="p-1.5 hover:bg-hunter-bg rounded text-hunter-muted hover:text-white transition-colors" title="Reset Searches">
                                            <RefreshCw size={12} />
                                        </button>
                                        <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 hover:bg-red-900/30 rounded text-hunter-muted hover:text-red-500 transition-colors" title="Delete User">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* USER INTERFACE */}
        {user.role === 'user' && (
            <div className="flex flex-col h-full overflow-hidden">
                {/* User Tabs */}
                <div className="flex border-b border-hunter-border mb-6">
                    <button onClick={() => setUserTab('profile')} className={`flex-1 flex items-center justify-center gap-2 px-2 py-3 text-xs font-bold border-b-2 transition-colors font-display tracking-wider ${userTab === 'profile' ? 'border-hunter-cyan text-white' : 'border-transparent text-hunter-muted hover:text-white'}`}>
                        <UserCircle size={14} /> PROFILE
                    </button>
                    <button onClick={() => setUserTab('inbox')} className={`flex-1 flex items-center justify-center gap-2 px-2 py-3 text-xs font-bold border-b-2 transition-colors font-display tracking-wider ${userTab === 'inbox' ? 'border-hunter-cyan text-white' : 'border-transparent text-hunter-muted hover:text-white'}`}>
                        <Inbox size={14} /> INBOX <span className="bg-gray-800 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">{inboxItems.length}</span>
                    </button>
                    <button onClick={() => setUserTab('history')} className={`flex-1 flex items-center justify-center gap-2 px-2 py-3 text-xs font-bold border-b-2 transition-colors font-display tracking-wider ${userTab === 'history' ? 'border-hunter-cyan text-white' : 'border-transparent text-hunter-muted hover:text-white'}`}>
                        <History size={14} /> HISTORY
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6">
                    
                    {/* PROFILE TAB */}
                    {userTab === 'profile' && (
                        <>
                            {/* ID Card */}
                            <div className="bg-hunter-surface border border-hunter-border rounded-xl p-5 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 flex flex-col items-end gap-1">
                                    {user.plan === 'pro' ? (
                                        <span className="bg-hunter-cyan text-black text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
                                            <Crown size={10} /> 
                                            {user.trialEndsAt ? 'TRIAL ACTIVE' : 'PRO'}
                                        </span>
                                    ) : (
                                        <span className="bg-gray-700 text-gray-300 text-[10px] font-bold px-2 py-1 rounded">
                                            FREE
                                        </span>
                                    )}
                                    <div className="flex items-center gap-1">
                                        <span className={`w-1.5 h-1.5 rounded-full ${user.isVerified ? 'bg-hunter-cyan' : 'bg-red-500'}`}></span>
                                        <span className="text-[9px] text-hunter-muted uppercase">{user.isVerified ? 'Verified' : 'Pending'}</span>
                                    </div>
                                </div>
                                <div className="text-hunter-muted text-xs uppercase tracking-widest mb-1 font-display">Operative ID</div>
                                <div className="text-white font-mono text-sm truncate">{user.email}</div>
                                <div className="text-gray-500 text-[10px] mt-1 font-mono">Joined: {new Date(user.joinedDate).toLocaleDateString()}</div>
                                
                                {user.trialEndsAt && (
                                <div className="mt-3 pt-3 border-t border-hunter-border flex items-center gap-2 text-xs text-hunter-purple font-mono">
                                    <Clock size={12} />
                                    <span>Trial ends: {new Date(user.trialEndsAt).toLocaleDateString()}</span>
                                </div>
                                )}
                            </div>

                            {/* Daily Search Limit */}
                            <div className="bg-hunter-surface rounded-lg p-4 border border-hunter-border">
                                <div className="flex justify-between items-end mb-2">
                                        <span className="text-hunter-muted text-xs uppercase font-display tracking-wide">Daily Searches</span>
                                        <span className={`${user.dailySearchesUsed >= user.dailySearchLimit ? 'text-red-500' : 'text-hunter-cyan'} font-mono font-bold text-sm`}>
                                            {user.dailySearchesUsed}/{user.dailySearchLimit}
                                        </span>
                                </div>
                                <div className="w-full bg-hunter-bg h-1.5 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full transition-all duration-500 ${user.dailySearchesUsed >= user.dailySearchLimit ? 'bg-red-500' : 'bg-hunter-cyan'}`} 
                                        style={{ width: `${Math.min(100, (user.dailySearchesUsed / user.dailySearchLimit) * 100)}%` }}
                                    ></div>
                                </div>
                                {user.plan === 'free' && (
                                    <p className="text-[10px] text-hunter-muted mt-2">Upgrade to Pro for unlimited searches.</p>
                                )}
                            </div>

                            {/* Chrome Extension CTA */}
                            {user.plan === 'pro' && (
                                <div className="bg-blue-900/10 border border-blue-500/20 rounded-xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-500/20 p-2 rounded-lg">
                                            <Chrome className="text-blue-400" size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-white">Browser Agent</h3>
                                            <p className="text-[10px] text-hunter-muted">Auto-apply codes at checkout.</p>
                                        </div>
                                    </div>
                                    <button className="text-xs font-bold bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-500 transition-colors">
                                        Install
                                    </button>
                                </div>
                            )}

                             {/* Referral System */}
                            <div className="border-t border-hunter-border pt-6">
                                <h3 className="flex items-center gap-2 text-white font-bold mb-4 font-display tracking-wide">
                                    <Gift size={16} className="text-hunter-purple" /> Referral Program
                                </h3>
                                <div className="bg-hunter-surface border border-hunter-border rounded-lg p-4 mb-4">
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-hunter-muted text-xs uppercase">Your referrals</span>
                                        <span className="text-hunter-purple font-mono font-bold text-xl">{user.referralsCount}/3</span>
                                    </div>
                                    <div className="w-full bg-hunter-bg h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-hunter-purple h-full transition-all duration-500" style={{ width: `${Math.min(100, (user.referralsCount / 3) * 100)}%` }}></div>
                                    </div>
                                    <p className="text-[10px] text-hunter-muted mt-2">
                                        {user.referralsCount >= 3 
                                            ? <span className="text-hunter-cyan">GOAL REACHED! PRO UNLOCKED.</span> 
                                            : "Invite 3 friends to get 1 month of Pro FREE."}
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs text-hunter-muted font-mono">YOUR UNIQUE LINK</label>
                                    <div className="flex gap-2">
                                        <input 
                                            readOnly 
                                            value={`codesniper.io/?ref=${user.referralCode}`} 
                                            className="flex-1 bg-hunter-surface border border-hunter-border rounded px-3 py-2 text-xs text-white font-mono focus:outline-none"
                                        />
                                        <button onClick={copyRef} className="bg-hunter-bg hover:bg-hunter-surface text-white px-3 rounded text-xs transition-colors border border-hunter-border font-bold">
                                            Copy
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Simulation Tools for Demo */}
                                <div className="mt-6 pt-4 border-t border-hunter-border">
                                    <button 
                                        onClick={handleSimulateReferral}
                                        className="w-full py-2 border border-dashed border-hunter-border text-hunter-muted hover:text-white hover:border-white rounded text-xs transition-colors flex items-center justify-center gap-2 font-mono"
                                    >
                                        <Plus size={12} /> [DEMO] SIMULATE +1 REFERRAL
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* INBOX TAB */}
                    {userTab === 'inbox' && (
                        <div className="space-y-3">
                             {inboxItems.length === 0 ? (
                                 <div className="text-center py-8">
                                     <Inbox size={32} className="mx-auto text-hunter-muted mb-2" />
                                     <p className="text-hunter-muted text-sm">No saved codes yet.</p>
                                     <p className="text-[10px] text-gray-500">Codes you save after verification appear here.</p>
                                 </div>
                             ) : (
                                 inboxItems.map(item => (
                                     <div key={item.id} className="bg-hunter-surface border border-hunter-border rounded-lg p-4 group hover:border-hunter-cyan/30 transition-colors">
                                         <div className="flex justify-between items-start mb-2">
                                             <h4 className="text-white font-bold font-display tracking-wide">{item.merchant}</h4>
                                             <span className="text-[10px] text-hunter-muted font-mono">{item.savedAt}</span>
                                         </div>
                                         <div className="bg-hunter-bg border border-hunter-border rounded px-3 py-2 flex items-center justify-between mb-2">
                                             <code className="text-hunter-cyan font-mono font-bold">{item.code}</code>
                                             <button 
                                                onClick={() => navigator.clipboard.writeText(item.code)}
                                                className="text-hunter-muted hover:text-white transition-colors"
                                             >
                                                 <Copy size={14} />
                                             </button>
                                         </div>
                                         <p className="text-xs text-gray-400">{item.description}</p>
                                     </div>
                                 ))
                             )}
                        </div>
                    )}

                    {/* HISTORY TAB */}
                    {userTab === 'history' && (
                         <div className="space-y-0 divide-y divide-hunter-border border border-hunter-border rounded-lg bg-hunter-surface overflow-hidden">
                            {historyItems.length === 0 ? (
                                <div className="text-center py-8">
                                    <History size={32} className="mx-auto text-hunter-muted mb-2" />
                                    <p className="text-hunter-muted text-sm">No search history.</p>
                                </div>
                            ) : (
                                historyItems.map(entry => (
                                    <div key={entry.id} className="p-3 flex items-center justify-between hover:bg-hunter-bg/50 transition-colors">
                                        <div>
                                            <div className="text-sm text-white font-medium font-display tracking-wide">{entry.merchant}</div>
                                            <div className="text-[10px] text-hunter-muted flex items-center gap-2 font-mono">
                                                <span>{entry.timestamp}</span>
                                                <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
                                                <span>{entry.query}</span>
                                            </div>
                                        </div>
                                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${entry.resultCount > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {entry.resultCount} CODES
                                        </div>
                                    </div>
                                ))
                            )}
                         </div>
                    )}
                </div>
            </div>
        )}

        {/* Footer */}
        <div className="border-t border-hunter-border pt-6 mt-4">
            <button 
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 text-red-500 hover:bg-red-500/10 py-2 rounded transition-colors text-sm font-bold font-display tracking-wider"
            >
                <LogOut size={16} /> LOGOUT
            </button>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;