import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, ArrowRight, ShieldAlert, CheckCircle, RefreshCw, Gift, AlertTriangle } from 'lucide-react';
import { User as UserType } from '../types';
import { auth, db } from '../firebaseConfig';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendEmailVerification,
    GoogleAuthProvider,
    signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

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
    const [isFirebaseConfigured, setIsFirebaseConfigured] = useState(false);

    useEffect(() => {
        // Check if Firebase is properly configured
        setIsFirebaseConfigured(auth !== null);

        if (isOpen) {
            const storedRef = localStorage.getItem('sniper_referrer');
            if (storedRef) setReferrer(storedRef);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const validateEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    // Create user profile in Firestore
    const createUserProfile = async (userId: string, userEmail: string) => {
        const userRef = doc(db, 'users', userId);
        const userProfile: Omit<UserType, 'id'> = {
            email: userEmail,
            role: 'user',
            plan: 'free',
            searchCount: 0,
            dailySearchesUsed: 0,
            dailySearchLimit: 15,
            referralCode: `HUNTER-${Math.floor(Math.random() * 10000)}`,
            referralsCount: 0,
            credits: referrer ? 15 : 0,
            joinedDate: new Date().toISOString(),
            isVerified: false,
            referredBy: referrer || null
        };

        await setDoc(userRef, userProfile);
        return userProfile;
    };

    // Get user profile from Firestore
    const getUserProfile = async (userId: string, userEmail: string): Promise<UserType> => {
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            return { id: userId, ...userDoc.data() } as UserType;
        } else {
            // Create profile if it doesn't exist
            const profile = await createUserProfile(userId, userEmail);
            return { id: userId, ...profile };
        }
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

        // Handle Admin Login (still mock for demo)
        if (mode === 'admin') {
            if (adminKey === 'admin123') {
                onLogin({
                    id: 'admin-01',
                    email: 'owner@discounthunter.ai',
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
                setLoading(false);
                onClose();
            } else {
                setError('Invalid Admin Key');
                setLoading(false);
            }
            return;
        }

        // If Firebase is not configured, show error
        if (!isFirebaseConfigured) {
            setError('Firebase authentication is not configured. Please contact support.');
            setLoading(false);
            return;
        }

        try {
            if (mode === 'signup') {
                // Create new user with Firebase
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Send email verification
                await sendEmailVerification(user);

                // Create user profile in Firestore
                await createUserProfile(user.uid, email);

                // Switch to verification mode
                setLoading(false);
                setMode('verify');

            } else if (mode === 'login') {
                // Sign in existing user
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Get user profile from Firestore
                const userProfile = await getUserProfile(user.uid, email);

                setLoading(false);
                onLogin({
                    ...userProfile,
                    isVerified: user.emailVerified
                });
                onClose();
            }
        } catch (err: any) {
            setLoading(false);
            console.error('Auth error:', err);

            // Handle specific Firebase errors
            switch (err.code) {
                case 'auth/email-already-in-use':
                    setError('This email is already registered. Try logging in instead.');
                    break;
                case 'auth/invalid-email':
                    setError('Invalid email address format.');
                    break;
                case 'auth/weak-password':
                    setError('Password should be at least 6 characters.');
                    break;
                case 'auth/user-not-found':
                    setError('No account found with this email. Sign up first.');
                    break;
                case 'auth/wrong-password':
                    setError('Incorrect password. Please try again.');
                    break;
                case 'auth/invalid-credential':
                    setError('Invalid email or password. Please check and try again.');
                    break;
                case 'auth/too-many-requests':
                    setError('Too many failed attempts. Please try again later.');
                    break;
                default:
                    setError(err.message || 'Authentication failed. Please try again.');
            }
        }
    };

    const handleVerificationComplete = async () => {
        setLoading(true);

        if (!auth || !auth.currentUser) {
            // If no current user, just close and let them log in again
            setLoading(false);
            setMode('login');
            setError('Please log in again to continue.');
            return;
        }

        try {
            // Reload user to check if email is verified
            await auth.currentUser.reload();

            if (auth.currentUser.emailVerified) {
                const userProfile = await getUserProfile(auth.currentUser.uid, auth.currentUser.email || '');
                onLogin({ ...userProfile, isVerified: true });
                onClose();
            } else {
                setError('Email not yet verified. Please check your inbox and click the verification link.');
            }
        } catch (err: any) {
            setError('Could not verify status. Please try logging in again.');
        }

        setLoading(false);
    };

    const handleResendVerification = async () => {
        if (auth && auth.currentUser) {
            try {
                await sendEmailVerification(auth.currentUser);
                setError(''); // Clear any previous error
                alert('Verification email sent! Check your inbox.');
            } catch (err: any) {
                setError('Could not send verification email. Please try again later.');
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
            <div className="cyber-glass rounded-2xl w-full max-w-md overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.8)] border-hunter-cyan/30 animate-in zoom-in-95 duration-300">

                {/* Decorative scanning line */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-hunter-cyan/30 animate-scan"></div>

                <button onClick={onClose} className="absolute top-4 right-4 text-hunter-muted hover:text-hunter-cyan z-10 p-2 hover:bg-hunter-cyan/10 rounded-lg transition-all">
                    <X size={20} />
                </button>

                <div className="p-8">
                    {/* Firebase Warning */}
                    {!isFirebaseConfigured && (
                        <div className="mb-6 bg-red-950/30 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-[10px] font-mono flex items-center gap-3 tracking-widest uppercase">
                            <ShieldAlert size={18} className="text-red-500 animate-pulse" />
                            <span>OFFLINE MODE: DB SYNC UNAVAILABLE</span>
                        </div>
                    )}

                    {/* Header */}
                    <div className="text-center mb-8 space-y-2">
                        <div className="text-hunter-cyan text-[10px] font-mono tracking-[0.4em] uppercase opacity-50 mb-1">
                            {mode === 'admin' ? 'SECURE_UPLINK' : 'IDENT_PROTOCOL'}
                        </div>
                        <h2 className="text-3xl font-display font-black text-white tracking-tighter uppercase italic">
                            {mode === 'login' && 'Re-Link Operative'}
                            {mode === 'signup' && 'Deploy Operative'}
                            {mode === 'admin' && 'Root Access'}
                            {mode === 'verify' && 'Verify Signal'}
                        </h2>
                        <div className="h-0.5 w-12 bg-hunter-cyan mx-auto"></div>
                    </div>

                    {/* Form Content */}
                    {mode === 'verify' ? (
                        <div className="space-y-8 text-center">
                            <div className="w-24 h-24 bg-hunter-cyan/5 rounded-2xl flex items-center justify-center mx-auto border border-hunter-cyan/20 relative group">
                                <div className="absolute inset-0 bg-hunter-cyan animate-ping opacity-10 rounded-2xl"></div>
                                <Mail size={40} className="text-hunter-cyan group-hover:scale-110 transition-transform" />
                            </div>

                            <div className="space-y-3">
                                <p className="text-sm text-hunter-text font-mono tracking-tight leading-relaxed">
                                    A secure handshake has been dispatched to <span className="text-hunter-cyan">{email}</span>.
                                    Acknowledge the signal to proceed.
                                </p>
                            </div>

                            <div className="space-y-4 pt-4">
                                <button
                                    onClick={handleVerificationComplete}
                                    disabled={loading}
                                    className="w-full py-4 rounded-none skew-x-[-10deg] font-display font-black flex items-center justify-center gap-3 bg-hunter-cyan text-black hover:bg-hunter-green transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)] group disabled:opacity-50"
                                >
                                    <span className="skew-x-[10deg] flex items-center gap-3 uppercase tracking-wider">
                                        {loading ? <RefreshCw className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                                        {loading ? 'ANALYZING...' : 'ACKNOWLEDGE SIGNAL'}
                                    </span>
                                </button>

                                <button
                                    onClick={handleResendVerification}
                                    className="text-[10px] text-hunter-muted font-mono hover:text-white uppercase tracking-widest transition-colors"
                                >
                                    Resend Signal Packet
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {mode !== 'admin' && (
                                <>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <label className="text-[10px] text-hunter-muted font-mono uppercase tracking-widest">EMAIL_STATION</label>
                                            <span className="text-[10px] text-hunter-cyan/40 font-mono">PORT_8080</span>
                                        </div>
                                        <div className="relative group">
                                            <Mail className="absolute left-3 top-3.5 text-hunter-muted group-focus-within:text-hunter-cyan transition-colors" size={18} />
                                            <input
                                                type="email"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full bg-black/60 border border-hunter-border rounded-none py-3 pl-10 text-white font-mono text-sm placeholder:text-hunter-muted/30 focus:border-hunter-cyan focus:outline-none transition-all focus:bg-hunter-cyan/5"
                                                placeholder="operative@network.id"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <label className="text-[10px] text-hunter-muted font-mono uppercase tracking-widest">ACCESS_KEY</label>
                                            <span className="text-[10px] text-hunter-cyan/40 font-mono">ENCRYPTED</span>
                                        </div>
                                        <div className="relative group">
                                            <Lock className="absolute left-3 top-3.5 text-hunter-muted group-focus-within:text-hunter-cyan transition-colors" size={18} />
                                            <input
                                                type="password"
                                                required
                                                minLength={6}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full bg-black/60 border border-hunter-border rounded-none py-3 pl-10 text-white font-mono text-sm placeholder:text-hunter-muted/30 focus:border-hunter-cyan focus:outline-none transition-all focus:bg-hunter-cyan/5"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {mode === 'admin' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] text-red-500 font-mono uppercase tracking-widest">ROOT_OVERRIDE_KEY</label>
                                    <div className="relative group">
                                        <ShieldAlert className="absolute left-3 top-3.5 text-red-500" size={18} />
                                        <input
                                            type="password"
                                            required
                                            value={adminKey}
                                            onChange={(e) => setAdminKey(e.target.value)}
                                            className="w-full bg-black/60 border border-red-500/50 rounded-none py-3 pl-10 text-white font-mono text-sm focus:border-red-500 focus:outline-none transition-all placeholder:text-red-900/40"
                                            placeholder="SYSTEM_AUTH_REQUIRED"
                                        />
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="bg-red-950/40 border-l-2 border-red-500 p-3 flex items-center gap-3 animate-in slide-in-from-left-2 duration-300">
                                    <AlertTriangle size={16} className="text-red-500 shrink-0" />
                                    <span className="text-[11px] text-red-200 font-mono leading-tight">{error}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || (!isFirebaseConfigured && mode !== 'admin')}
                                className={`w-full py-4 rounded-none skew-x-[-10deg] font-display font-black flex items-center justify-center gap-3 transition-all group disabled:opacity-50 relative overflow-hidden ${mode === 'admin'
                                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(255,0,0,0.3)]'
                                    : 'bg-hunter-cyan hover:bg-hunter-green text-black shadow-[0_0_20px_rgba(0,240,255,0.3)]'
                                    }`}
                            >
                                <span className="skew-x-[10deg] flex items-center gap-2 uppercase tracking-[0.15em]">
                                    {loading ? (
                                        <>
                                            <RefreshCw className="animate-spin" size={20} />
                                            SYNCHRONIZING...
                                        </>
                                    ) : (
                                        <>
                                            {mode === 'login' ? 'INITIALIZE LINK' : mode === 'signup' ? 'ESTABLISH OPERATIVE' : 'BYPASS FIREWALL'}
                                            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </span>
                            </button>
                        </form>
                    )}

                    {/* Footer Toggle */}
                    {mode !== 'verify' && (
                        <div className="mt-8 flex items-center justify-between text-[10px] text-hunter-muted border-t border-hunter-border pt-6 font-mono tracking-widest uppercase">
                            {mode === 'admin' ? (
                                <button onClick={() => setMode('login')} className="hover:text-white transition-colors flex items-center gap-2">
                                    <ArrowRight size={12} className="rotate-180" /> RETURN_TO_CLIENT
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                                        className="hover:text-hunter-cyan transition-colors"
                                    >
                                        {mode === 'login' ? 'NEW_ACCOUNT_REQUIRED' : 'LOG_IN_EXISTING'}
                                    </button>
                                    <button
                                        onClick={() => setMode('admin')}
                                        className="text-hunter-muted/30 hover:text-red-500 transition-colors"
                                    >
                                        ROOT
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