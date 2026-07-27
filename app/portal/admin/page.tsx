'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ForgotPasswordLink from '@/app/components/ForgotPasswordLink';
import { AuthPortalLayout, authFieldClass, authErrorClass } from '@/components/brand/AuthPortalLayout';

function AdminPortalLogin() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const [formData, setFormData] = useState({
 email: '',
 password: ''
 });
 const [showPassword, setShowPassword] = useState(false);
 const [isLoading, setIsLoading] = useState(false);
 const [error, setError] = useState('');

 const nextParam = searchParams.get('next');
 const nextPath =
 nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
 ? nextParam
 : '/admin';

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setIsLoading(true);
 setError('');

 try {
 const response = await fetch('/api/auth/login', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(formData)
 });

 const result = await response.json();
 if (response.ok && result.success && result.judge?.isAdmin) {
 localStorage.setItem('adminSession', JSON.stringify(result.judge));
 router.push(nextPath);
 } else if (result.success && result.judge && !result.judge.isAdmin) {
 setError('Admin access required. Judges should use the Judge Portal.');
 } else {
 setError(result.error || 'Authentication failed');
 }
 } catch {
 setError('Login failed. Please try again.');
 } finally {
 setIsLoading(false);
 }
 };

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 setFormData((prev) => ({
 ...prev,
 [e.target.name]: e.target.value
 }));
 };

 return (
 <AuthPortalLayout title="Admin Control" subtitle="Avalon Competition Management">
 <div className="p-8"> {nextParam && (
 <p className="text-[var(--chrome-mid)] text-xs mb-4 text-center"> Enter your Admin email and password to continue
 </p> )}

 <form onSubmit={handleSubmit} className="space-y-5"> {error && <div className={authErrorClass}>{error}</div>}

 <div>
 <label htmlFor="email" className="label-caps text-[var(--sidebar-muted)] block mb-2"> Email
 </label>
 <input
 type="email" id="email" name="email" value={formData.email}
 onChange={handleInputChange}
 required
 autoComplete="username" className={authFieldClass}
 placeholder="admin@example.com" />
 </div>  <div>
 <label htmlFor="password" className="label-caps text-[var(--sidebar-muted)] block mb-2"> Password
 </label>
 <div className="relative">
 <input
 type={showPassword ? 'text' : 'password'}
 id="password" name="password" value={formData.password}
 onChange={handleInputChange}
 required
 autoComplete="current-password" className={`${authFieldClass} pr-16`}
 placeholder="••••••••" />
 <button
 type="button" onClick={() => setShowPassword((v) => !v)}
 className="absolute inset-y-0 right-2 my-1 px-3 rounded-lg text-[var(--muted-foreground)] hover:text-white hover:bg-white/10 text-xs tracking-wide uppercase" aria-label="Toggle password visibility" >
 {showPassword ? 'Hide' : 'Show'}
 </button>
 </div>
 </div>  <ForgotPasswordLink userType="admin" />  <button
 type="submit" disabled={isLoading}
 className="btn-chrome w-full justify-center disabled:opacity-50" >
 {isLoading ? 'Signing in…' : 'Sign in as Admin'}
 </button>
 </form>
 </div>
 </AuthPortalLayout> );
}

export default function AdminPortalPage() {
 return (
 <Suspense
 fallback={
 <div className="min-h-screen avalon-mesh flex items-center justify-center">
 <p className="text-[var(--chrome-mid)] text-sm">Loading…</p>
 </div> }
 >
 <AdminPortalLogin />
 </Suspense> );
}
