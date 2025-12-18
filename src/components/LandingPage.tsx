import React from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Search, ShieldCheck, Zap, ArrowRight, Sparkles } from 'lucide-react';

interface LandingPageProps {
    onStartHunting: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStartHunting }) => {
    const steps = [
        {
            icon: UserPlus,
            title: "1. SIGN UP",
            desc: "Register your operative credentials to access the hunter network.",
            color: "text-hunter-cyan",
            bg: "bg-hunter-cyan/10"
        },
        {
            icon: Search,
            title: "2. ENTER URL",
            desc: "Deploy our AI nodes to any product URL or target store domain.",
            color: "text-hunter-purple",
            bg: "bg-hunter-purple/10"
        },
        {
            icon: ShieldCheck,
            title: "3. GET DISCOUNTS",
            desc: "Receive verified, validated discount codes in real-time.",
            color: "text-hunter-green",
            bg: "bg-hunter-green/10"
        }
    ];

    return (
        <div className="flex-1 flex flex-col relative overflow-hidden">
            {/* HERO SECTION */}
            <section className="relative pt-20 pb-16 md:pt-32 md:pb-24 px-4">
                <div className="max-w-6xl mx-auto text-center space-y-8 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-hunter-cyan/5 text-hunter-cyan text-[10px] font-mono border border-hunter-cyan/20 tracking-widest uppercase mb-4"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-hunter-cyan opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-hunter-cyan"></span>
                        </span>
                        SYSTEM ONLINE: HUNTER PROTOCOL ACTIVE
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.7, delay: 0.2 }}
                        className="text-5xl md:text-8xl font-display font-black tracking-tighter leading-tight"
                    >
                        <span className="text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                            MODERN AI
                        </span>
                        <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-hunter-cyan via-hunter-green to-hunter-cyan animate-pulse">
                            DISCOUNT HUNTING
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.4 }}
                        className="max-w-2xl mx-auto text-hunter-muted text-lg md:text-xl font-mono tracking-wide"
                    >
                        The world's most aggressive AI engine designed to verify and validate potential discount codes for any target.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.6 }}
                        className="pt-8"
                    >
                        <button
                            onClick={onStartHunting}
                            className="bg-hunter-cyan text-black font-black font-display text-lg px-10 py-5 rounded-none skew-x-[-10deg] transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(0,240,255,0.4)] hover:shadow-[0_0_50px_rgba(0,240,255,0.6)] group"
                        >
                            <span className="skew-x-[10deg] flex items-center gap-3">
                                <Sparkles size={24} className="animate-spin-slow" />
                                CREATE ACCOUNT TO START HUNTING
                                <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
                            </span>
                        </button>
                    </motion.div>
                </div>

                {/* Cyber Decorative Elements */}
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-hunter-cyan/20 to-transparent -translate-y-1/2 pointer-events-none"></div>
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-hunter-purple/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-hunter-cyan/5 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
            </section>

            {/* HOW IT WORKS SECTION */}
            <section className="py-24 px-4 border-t border-hunter-border bg-black/40 backdrop-blur-sm relative overflow-hidden">
                <div className="max-w-6xl mx-auto relative z-10">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-display font-black text-white mb-4 tracking-tight">HOW IT WORKS</h2>
                        <div className="h-1 w-24 bg-hunter-cyan mx-auto"></div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {steps.map((step, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: idx * 0.2 }}
                                className="cyber-glass p-8 rounded-2xl group hover:border-hunter-cyan/40 transition-all duration-500"
                            >
                                <div className={`${step.bg} w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                    <step.icon className={step.color} size={32} />
                                </div>
                                <h3 className={`text-xl font-display font-bold mb-4 tracking-wider ${step.color}`}>{step.title}</h3>
                                <p className="text-hunter-muted font-mono text-sm leading-relaxed">
                                    {step.desc}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FOOTER MINI */}
            <footer className="py-12 px-4 border-t border-hunter-border text-center">
                <p className="text-xs text-hunter-muted font-mono tracking-widest uppercase">
                    &copy; {new Date().getFullYear()} DISCOUNT HUNTER AI. ALL RIGHTS RESERVED.
                </p>
            </footer>
        </div>
    );
};

export default LandingPage;
