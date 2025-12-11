import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, ArrowRight, ShieldAlert, CheckCircle, RefreshCw, Gift } from 'lucide-react';
import { User as UserType } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: UserType) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLogin }) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'admin' | 'verify'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [referrer, setReferrer] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
        const storedRef = localStorage.getItem('sniper_referrer');
        if (storedRef) setReferrer(storedRef);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode !== 'admin' && !validateEmail(email)) {
        setError('Please enter a valid email address.');
        return;
    }

    if (mode !== 'admin' && password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
    }

    setLoading(true);
    
    // Simulate API Call
    setTimeout(() => {
      setLoading(false);
      
      if (mode === 'admin') {
        if (adminKey === 'admin123') { // Mock secret
            onLogin({
                id: 'admin-01',
                email: 'owner@codesniper.io',
                role: 'admin',
                plan: 'pro',
                searchCount: 0,
                dailySearchesUsed: 0,
                dailySearchLimit: 1000,
                referralCode: 'ADMIN',
                referralsCount: 9999,
                credits: 9999,
                joinedDate: new Date().toISOString(),
                isVerified: true
            });
            onClose();
        } else {
            setError('Invalid Admin Key');
        }
        return;
      }

      if (mode === 'signup') {
        // Switch to verification mode instead of logging in immediately
        setMode('verify');
        return;
      }

      // Mock User Login
      onLogin({
        id: Math.random().toString(36),
        email: email,
        role: 'user',
        plan: 'pro', // Simulate returning pro user on login for demo
        searchCount: 0,
        dailySearchesUsed: 0,
        dailySearchLimit: 1000,
        referralCode: `SNIPER-${Math.floor(Math.random() * 10000)}`,
        referralsCount: 12,
        credits: 150,
        joinedDate: new Date().toISOString(),
        isVerified: true,
        referredBy: undefined
      });
      onClose();
    }, 1000);
  };

  const handleVerificationComplete = () => {
      setLoading(true);
      setTimeout(() => {
          onLogin({
            id: Math.random().toString(36),
            email: email,
            role: 'user',
            plan: 'free',
            searchCount: 0,
            dailySearchesUsed: 0,
            dailySearchLimit: 15,
            referralCode: `SNIPER-${Math.floor(Math.random() * 10000)}`,
            referralsCount: 0,
            credits: referrer ? 15 : 0, // Award 15 credits if they were referred
            joinedDate: new Date().toISOString(),
            isVerified: true,
            referredBy: referrer || undefined
          });
          setLoading(false);
          onClose();
      }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-hunter-surface border border-hunter-border rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl animate-in zoom-in-95 duration-200 backdrop-blur-md">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-hunter-muted hover:text-white z-10">
            <X size={20} />
        </button>

        <div className="p-8">
            {/* Header Text */}
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2 font-display tracking-wide">
                    {mode === 'login' && 'Welcome Back'}
                    {mode === 'signup' && 'Join the Hunt'}
                    {mode === 'admin' && 'Restricted Area'}
                    {mode === 'verify' && 'Check Your Inbox'}
                </h2>
                <p className="text-sm text-hunter-muted font-mono">
                    {mode === 'admin' && 'Authorized personnel only. Access monitored.'}
                    {mode === 'verify' && `We sent a verification link to ${email}`}
                    {(mode === 'login' || mode === 'signup') && 'Access our automated discount intelligence network.'}
                </p>
            </div>

            {/* Referral Badge */}
            {mode === 'signup' && referrer && (
                <div className="mb-6 bg-hunter-cyan/10 border border-hunter-cyan/30 rounded-lg p-3 flex items-center gap-3 animate-pulse-fast">
                    <Gift className="text-hunter-cyan" size={20} />
                    <div className="text-left">
                        <div className="text-xs text-hunter-cyan font-bold">REFERRAL APPLIED</div>
                        <div className="text-[10px] text-hunter-muted">Sign up now to unlock 15 bonus credits from code: <span className="text-white font-mono">{referrer}</span></div>
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="mb-4 bg-red-900/20 border border-red-500/50 text-red-200 px-4 py-2 rounded text-xs text-center">
                    {error}
                </div>
            )}

            {/* VERIFICATION VIEW */}
            {mode === 'verify' ? (
                <div className="space-y-6 text-center">
                    <div className="w-20 h-20 bg-hunter-cyan/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
                        <Mail size={40} className="text-hunter-cyan" />
                    </div>
                    
                    <div className="space-y-2">
                        <p className="text-sm text-gray-300">
                            Click the link in the email we just sent you to activate your account.
                        </p>
                        <p className="text-xs text-gray-500">
                            (This may take up to 60 seconds)
                        </p>
                    </div>

                    <div className="space-y-3 pt-4">
                        <button 
                            onClick={handleVerificationComplete}
                            className="w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 bg-hunter-cyan hover:bg-hunter-green text-black transition-all font-display tracking-wider"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={18}/> : <CheckCircle size={18} />}
                            {loading ? 'ACTIVATING...' : 'I HAVE VERIFIED MY EMAIL'}
                        </button>
                        
                        <button className="text-xs text-gray-500 hover:text-white underline decoration-dotted">
                            Resend verification email
                        </button>
                    </div>
                    
                    <div className="border-t border-hunter-border pt-4 mt-4">
                         <span className="text-xs text-hunter-purple uppercase font-bold tracking-widest">[Demo Mode]</span>
                         <p className="text-[10px] text-gray-500 mt-1">Clicking the big green button simulates a successful email click.</p>
                    </div>
                </div>
            ) : (
                /* LOGIN / SIGNUP / ADMIN FORM */
                <form onSubmit={handleSubmit} className="space-y-4">
                    {mode !== 'admin' && (
                        <>
                            <div className="space-y-1">
                                <label className="text-xs text-hunter-muted font-mono">EMAIL ACCESS</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 text-hunter-muted" size={18} />
                                    <input 
                                        type="email" 
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-black/50 border border-hunter-border rounded-lg py-2.5 pl-10 text-white placeholder:text-hunter-muted/50 focus:border-hunter-cyan focus:outline-none transition-colors"
                                        placeholder="name@example.com"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-hunter-muted font-mono">PASSWORD</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 text-hunter-muted" size={18} />
                                    <input 
                                        type="password" 
                                        required
                                        minLength={6}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-black/50 border border-hunter-border rounded-lg py-2.5 pl-10 text-white placeholder:text-hunter-muted/50 focus:border-hunter-cyan focus:outline-none transition-colors"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {mode === 'admin' && (
                        <div className="space-y-1">
                            <label className="text-xs text-red-500 font-mono">ADMIN KEY</label>
                            <div className="relative">
                                <ShieldAlert className="absolute left-3 top-3 text-red-500" size={18} />
                                <input 
                                    type="password" 
                                    required
                                    value={adminKey}
                                    onChange={(e) => setAdminKey(e.target.value)}
                                    className="w-full bg-black/50 border border-red-500/50 rounded-lg py-2.5 pl-10 text-white focus:border-red-500 focus:outline-none placeholder:text-red-900"
                                    placeholder="Enter system key..."
                                />
                            </div>
                            <p className="text-[10px] text-gray-600 text-right pt-1 font-mono">(Demo Key: admin123)</p>
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={loading}
                        className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all font-display tracking-wider ${
                            mode === 'admin' 
                            ? 'bg-red-600 hover:bg-red-500 text-white' 
                            : 'bg-hunter-cyan hover:bg-hunter-green text-black'
                        }`}
                    >
                        {loading ? 'AUTHENTICATING...' : (
                            <>
                                {mode === 'login' ? 'LOGIN' : mode === 'signup' ? 'CREATE ACCOUNT' : 'ACCESS SYSTEM'}
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>
            )}

            {mode !== 'verify' && (
                <div className="mt-6 flex items-center justify-between text-xs text-hunter-muted border-t border-hunter-border pt-4">
                    {mode === 'admin' ? (
                         <button onClick={() => setMode('login')} className="hover:text-white">
                            ← Return to user login
                         </button>
                    ) : (
                        <>
                            <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="hover:text-white">
                                {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Login'}
                            </button>
                            <button onClick={() => setMode('admin')} className="text-gray-600 hover:text-red-500 transition-colors">
                                Admin
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;