'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ForgotPasswordLink from '@/app/components/ForgotPasswordLink';
import { BrandLogo, CoBrandLine } from '@/components/brand/BrandLogo';

export default function StudioLoginPage() {
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [showPassword, setShowPassword] = useState(false);
 const [isLoading, setIsLoading] = useState(false);
 const [error, setError] = useState('');
 const router = useRouter();

 const handleLogin = async (e: React.FormEvent) => {
 e.preventDefault();
 setIsLoading(true);
 setError('');

 try {
 const response = await fetch('/api/auth/studio', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({ email, password }),
 });

 const data = await response.json();

 if (data.success) {
 localStorage.setItem('studioSession', JSON.stringify(data.studio));
 router.push('/studio-dashboard');
 } else {
 setError(data.error || 'Login failed');
 }
 } catch (error) {
 console.error('Login error:', error);
 setError('Login failed. Please try again.');
 } finally {
 setIsLoading(false);
 }
 };

 const fieldClass =
 'w-full px-4 py-3.5 bg-black/40 border border-[rgba(192,192,192,0.2)] rounded-[10px] text-white placeholder-[#5a5a5a] focus:border-[rgba(192,192,192,0.5)] focus:ring-[3px] focus:ring-[rgba(192,192,192,0.12)] transition-all';

 return (
 <div className="min-h-screen avalon-mesh flex items-center justify-center p-4">
 <div className="w-full max-w-md">
 <div className="text-center mb-8">
 <BrandLogo brand="avalon" size={80} priority className="mx-auto mb-5" />
 <h1 className="font-display text-4xl chrome-text leading-none mb-2">Studio Portal</h1>
 <p className="label-caps text-[var(--chrome-mid)] mb-3">Avalon Competition Management</p>
 <div className="flex justify-center mb-2">
 <CoBrandLine />
 </div>
 <p className="text-sm text-[var(--muted-foreground)] mt-3"> Access your studio dashboard to manage dancers
 </p>
 </div>  <div className="glass-panel p-8">
 <form onSubmit={handleLogin} className="space-y-6">
 <div>
 <label htmlFor="email" className="label-caps text-[var(--sidebar-muted)] block mb-2"> Studio Email
 </label>
 <input
 type="email" id="email" value={email}
 onChange={(e) => setEmail(e.target.value)}
 className={fieldClass}
 placeholder="studio@example.com" required
 />
 </div>  <div>
 <label htmlFor="password" className="label-caps text-[var(--sidebar-muted)] block mb-2"> Password
 </label>
 <div className="relative">
 <input
 type={showPassword ? 'text' : 'password'}
 id="password" value={password}
 onChange={(e) => setPassword(e.target.value)}
 className={`${fieldClass} pr-12`}
 placeholder="Enter your password" required
 />
 <button
 type="button" onClick={() => setShowPassword((v) => !v)}
 className="absolute inset-y-0 right-2 my-1 px-3 rounded-lg text-[var(--muted-foreground)] hover:text-white hover:bg-white/10 text-xs tracking-wide uppercase" aria-label="Toggle password visibility" >
 {showPassword ? 'Hide' : 'Show'}
 </button>
 </div>
 </div> {error && (
 <div className="border border-[rgba(139,58,58,0.45)] bg-[rgba(139,58,58,0.2)] text-[#f0c4c4] px-4 py-3 rounded-[10px] text-sm"> {error}
 </div> )}

 <button type="submit" disabled={isLoading} className="btn-chrome w-full justify-center disabled:opacity-50"> {isLoading ? 'Signing In...' : 'Sign In to Studio Dashboard'}
 </button>
 </form>  <div className="mt-6 text-center">
 <ForgotPasswordLink userType="studio" />
 </div>  <div className="mt-8 pt-6 border-t border-[rgba(192,192,192,0.12)] text-center space-y-3">
 <Link href="/studio-register" className="block text-[var(--chrome-mid)] hover:text-white transition-colors font-medium text-sm"> Register New Studio
 </Link>
 <Link href="/" className="block text-[var(--sidebar-muted)] hover:text-[var(--muted-foreground)] transition-colors text-sm"> Back to Home
 </Link>
 </div>
 </div>  <div className="mt-6 glass-panel p-4">
 <h4 className="label-caps text-[var(--chrome-mid)] mb-2">Studio Dashboard</h4>
 <ul className="text-[var(--muted-foreground)] text-xs space-y-1.5">
 <li>· Add and manage your dancers</li>
 <li>· Register dancers for competitions</li>
 <li>· View dancer profiles and EODSA IDs</li>
 <li>· Track competition entries</li>
 </ul>
 </div>
 </div>
 </div> );
}
