'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ForgotPasswordLink from '@/app/components/ForgotPasswordLink';
import { AuthPortalLayout, authFieldClass, authErrorClass } from '@/components/brand/AuthPortalLayout';

export default function JudgeLogin() {
 const [formData, setFormData] = useState({
 email: '',
 password: ''
 });
 const [isLoading, setIsLoading] = useState(false);
 const [error, setError] = useState('');
 const [showPassword, setShowPassword] = useState(false);
 const router = useRouter();

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const { name, value } = e.target;
 setFormData(prev => ({
 ...prev,
 [name]: value
 }));
 // Clear error when user starts typing
 if (error) setError('');
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setIsLoading(true);
 setError('');

 try {
 const response = await fetch('/api/auth/judge', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify(formData),
 });

 const data = await response.json();

 if (data.success) {
 // Store session data
 localStorage.setItem('judgeSession', JSON.stringify({
 id: data.judge.id,
 name: data.judge.name,
 email: data.judge.email,
 isAdmin: data.judge.isAdmin
 }));

 // Redirect based on role
 if (data.judge.isAdmin) {
 // Redirect admin users to the admin portal instead
 setError('Admin users should use the Admin Portal. Redirecting...');
 setTimeout(() => {
 router.push('/portal/admin');
 }, 2000);
 return;
 } else {
 router.push('/judge/dashboard');
 }
 } else {
 setError(data.error || 'Login failed. Please try again.');
 }
 } catch (error) {
 setError('Network error. Please check your connection and try again.');
 } finally {
 setIsLoading(false);
 }
 };

 return (
 <AuthPortalLayout title="Judge Portal" subtitle="Avalon Competition Management">
 <div className="px-8 py-6 border-b border-[rgba(192,192,192,0.12)]">
 <h2 className="font-display text-2xl text-white text-center leading-none">Sign In</h2>
 <p className="text-[var(--muted-foreground)] text-center mt-2 text-sm"> Access your judging dashboard
 </p>
 </div>  <div className="p-8">
 <form onSubmit={handleSubmit} className="space-y-6">
 <div>
 <label htmlFor="email" className="label-caps text-[var(--sidebar-muted)] block mb-2"> Email Address
 </label>
 <input
 type="email" id="email" name="email" value={formData.email}
 onChange={handleInputChange}
 className={authFieldClass}
 placeholder="judge@competition.com" required
 />
 </div>  <div>
 <label htmlFor="password" className="label-caps text-[var(--sidebar-muted)] block mb-2"> Password
 </label>
 <div className="relative">
 <input
 type={showPassword ? 'text' : 'password'}
 id="password" name="password" value={formData.password}
 onChange={handleInputChange}
 className={`${authFieldClass} pr-16`}
 placeholder="Enter your password" required
 />
 <button
 type="button" onClick={() => setShowPassword(v => !v)}
 className="absolute inset-y-0 right-2 my-1 px-3 rounded-lg text-[var(--muted-foreground)] hover:text-white hover:bg-white/10 text-xs tracking-wide uppercase" aria-label="Toggle password visibility" >
 {showPassword ? 'Hide' : 'Show'}
 </button>
 </div>
 </div> {error && <div className={authErrorClass}>{error}</div>}

 <button
 type="submit" disabled={isLoading}
 className="btn-chrome w-full justify-center disabled:opacity-50" >
 {isLoading ? 'Signing you in...' : 'Sign In'}
 </button>
 </form>  <div className="mt-6 text-center">
 <ForgotPasswordLink userType="judge" />
 </div>
 </div>
 </AuthPortalLayout> );
}
