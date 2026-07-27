'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { UserPlus, User, Building2, ArrowRight } from 'lucide-react';
import { BrandLogo, CoBrandLine } from '@/components/brand/BrandLogo';

export default function HomePage() {
 const [showSplash, setShowSplash] = useState(true);
 const [splashPhase, setSplashPhase] = useState<'entering' | 'visible' | 'exiting'>('entering');

 useEffect(() => {
 const timer1 = setTimeout(() => setSplashPhase('visible'), 500);
 const timer2 = setTimeout(() => setSplashPhase('exiting'), 2500);
 const timer3 = setTimeout(() => setShowSplash(false), 3500);

 return () => {
 clearTimeout(timer1);
 clearTimeout(timer2);
 clearTimeout(timer3);
 };
 }, []);

 if (showSplash) {
 return (
 <div
 className={`fixed inset-0 z-50 flex items-center justify-center avalon-mesh transition-opacity duration-1000 ${
 splashPhase === 'entering' ? 'opacity-0' : splashPhase === 'visible' ? 'opacity-100' : 'opacity-0'
 }`}
 >
 <div
 className={`relative text-center transition-all duration-1000 ${
 splashPhase === 'entering'
 ? 'scale-94 opacity-0 translate-y-8'
 : splashPhase === 'visible'
 ? 'scale-100 opacity-100 translate-y-0'
 : 'scale-105 opacity-0 -translate-y-6'
 }`}
 >
 <BrandLogo brand="avalon" size={120} priority className="mx-auto mb-6" />
 <h1 className="font-display text-6xl md:text-8xl chrome-text leading-none mb-3">Avalon</h1>
 <p className="label-caps text-[var(--chrome-mid)] tracking-[0.2em]">Competition Management</p>
 <div className="mt-10 w-56 mx-auto">
 <div className="h-px bg-[rgba(192,192,192,0.15)] overflow-hidden">
 <div
 className={`h-full bg-gradient-to-r from-[#00E6FF] to-[#FF2DA1] transition-all duration-[2000ms] ${
 splashPhase === 'visible' ? 'w-full' : 'w-0'
 }`}
 />
 </div>
 </div>
 </div>
 </div> );
 }

 return (
 <div className="min-h-screen avalon-mesh flex flex-col">
 <header className="relative z-10 px-6 py-5 flex items-center justify-between">
 <div className="flex items-center gap-3 opacity-80">
 <BrandLogo brand="avalon" size={32} />
 <span className="label-caps text-[var(--muted-foreground)] hidden sm:inline">Avalon</span>
 </div>
 <Link href="/portal/admin" className="btn-outline-chrome !py-2 !px-4 text-[10px]"> Staff portals
 <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
 </Link>
 </header>  <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-10 sm:py-16">
 <div
 className="pointer-events-none absolute w-[min(520px,90vw)] h-[min(520px,90vw)] rounded-full border border-[rgba(192,192,192,0.08)] top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%]" aria-hidden
 >
 <div className="absolute inset-7 rounded-full border border-[rgba(0,230,255,0.08)]" />
 <div className="absolute inset-14 rounded-full border border-[rgba(255,45,161,0.07)]" />
 </div>  <div className="relative z-10 w-full max-w-4xl text-center">
 <div className="animate-avalon-brand mb-8">
 <BrandLogo brand="avalon" size={128} priority className="mx-auto sm:w-36 sm:h-36" />
 </div>  <h1 className="font-display text-5xl sm:text-7xl md:text-8xl chrome-text leading-none mb-4 animate-avalon-fade-up"> Avalon</h1>
 <p className="label-caps text-[var(--chrome-mid)] mb-3 tracking-[0.2em] animate-avalon-fade-up"> Competition Management
 </p>
 <div className="brand-duo-rule mx-auto mb-6 animate-avalon-fade-up" />
 <div className="flex justify-center mb-12 animate-avalon-fade-up">
 <CoBrandLine />
 </div>  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 text-left"> {/* Register — same destination as before */}
 <div className="glass-panel p-7 transition-all duration-220 hover:border-[rgba(192,192,192,0.45)] hover:shadow-[0_0_32px_rgba(0,230,255,0.08),0_0_28px_rgba(255,45,161,0.06)] group">
 <div className="w-14 h-14 rounded-[14px] border border-[rgba(192,192,192,0.28)] bg-[rgba(192,192,192,0.06)] flex items-center justify-center mx-auto mb-5 group-hover:border-[rgba(0,230,255,0.35)] transition-colors">
 <UserPlus className="w-6 h-6 text-[var(--chrome-mid)]" strokeWidth={1.75} />
 </div>
 <h2 className="font-display text-2xl text-white leading-none mb-3 text-center">Register</h2>
 <p className="text-sm text-[var(--muted-foreground)] text-center leading-relaxed mb-6"> Create a dancer account to enter EODSA competitions.
 </p>
 <div className="flex justify-center">
 <Link href="/register" className="btn-chrome !py-2.5 !px-5"> Get Started
 </Link>
 </div>
 </div> {/* Dancer login — same destination */}
 <div className="glass-panel p-7 transition-all duration-220 hover:border-[rgba(192,192,192,0.45)] hover:shadow-[0_0_32px_rgba(0,230,255,0.08),0_0_28px_rgba(255,45,161,0.06)] group">
 <div className="w-14 h-14 rounded-[14px] border border-[rgba(192,192,192,0.28)] bg-[rgba(192,192,192,0.06)] flex items-center justify-center mx-auto mb-5 group-hover:border-[rgba(0,230,255,0.35)] transition-colors">
 <User className="w-6 h-6 text-[var(--chrome-mid)]" strokeWidth={1.75} />
 </div>
 <h2 className="font-display text-2xl text-white leading-none mb-3 text-center">Dancer</h2>
 <p className="text-sm text-[var(--muted-foreground)] text-center leading-relaxed mb-6"> Sign in to manage your profile and competition entries.
 </p>
 <div className="flex justify-center">
 <Link href="/dancer-login" className="btn-outline-chrome !py-2.5 !px-5"> Sign In
 </Link>
 </div>
 </div> {/* Studio — keep both register + login */}
 <div className="glass-panel p-7 transition-all duration-220 hover:border-[rgba(192,192,192,0.45)] hover:shadow-[0_0_32px_rgba(0,230,255,0.08),0_0_28px_rgba(255,45,161,0.06)] group">
 <div className="w-14 h-14 rounded-[14px] border border-[rgba(192,192,192,0.28)] bg-[rgba(192,192,192,0.06)] flex items-center justify-center mx-auto mb-5 group-hover:border-[rgba(255,45,161,0.35)] transition-colors">
 <Building2 className="w-6 h-6 text-[var(--chrome-mid)]" strokeWidth={1.75} />
 </div>
 <h2 className="font-display text-2xl text-white leading-none mb-3 text-center">Studio</h2>
 <p className="text-sm text-[var(--muted-foreground)] text-center leading-relaxed mb-6"> Register your studio or sign in to manage dancers and entries.
 </p>
 <div className="flex flex-col gap-2">
 <Link href="/studio-register" className="btn-chrome !py-2.5 !px-5 w-full text-center"> Register Studio
 </Link>
 <Link href="/studio-login" className="btn-outline-chrome !py-2.5 !px-5 w-full text-center"> Studio Login
 </Link>
 </div>
 </div>
 </div>
 </div>
 </main>  <footer className="relative z-10 px-6 py-6 flex flex-col sm:flex-row items-center justify-center gap-4 opacity-50">
 <div className="flex items-center gap-2">
 <BrandLogo brand="avalon" size={20} />
 <span className="text-[10px] tracking-[0.14em] uppercase text-[var(--muted-foreground)]"> avalondance.co.za
 </span>
 </div>
 <span className="hidden sm:inline text-[#3a3a3a]">|</span>
 <div className="flex items-center gap-2">
 <BrandLogo brand="eod" size={20} />
 <span className="text-[10px] tracking-[0.14em] uppercase text-[var(--muted-foreground)]"> elementscentral.com
 </span>
 </div>
 </footer>
 </div> );
}
