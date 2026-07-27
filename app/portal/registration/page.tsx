'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ForgotPasswordLink from '@/app/components/ForgotPasswordLink';
import { usePhase2Feature } from '@/hooks/usePhase2Feature';
import FeatureUnavailable from '@/components/FeatureUnavailable';
import { AuthPortalLayout, authFieldClass, authErrorClass } from '@/components/brand/AuthPortalLayout';

export default function RegistrationPortalPage() {
 const { isEnabled: isPhase2Enabled, isLoading: isLoadingFlag } = usePhase2Feature();
 
 if (!isLoadingFlag && !isPhase2Enabled) {
 return <FeatureUnavailable featureName="Registration Desk" />;
 }
 const router = useRouter();
 const [formData, setFormData] = useState({
 email: '',
 password: ''
 });
 const [showPassword, setShowPassword] = useState(false);
 const [isLoading, setIsLoading] = useState(false);
 const [error, setError] = useState('');

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setIsLoading(true);
 setError('');

 try {
 const response = await fetch('/api/auth/registration', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(formData),
 });

 if (response.ok) {
 const result = await response.json();
 if (result.success) {
 localStorage.setItem('registrationSession', JSON.stringify(result.user));
 router.push('/registration-dashboard');
 } else {
 setError(result.error || 'Authentication failed');
 }
 } else {
 const error = await response.json();
 setError(error.error || 'Authentication failed');
 }
 } catch (error) {
 setError('Login failed. Please try again.');
 } finally {
 setIsLoading(false);
 }
 };

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 setFormData(prev => ({
 ...prev,
 [e.target.name]: e.target.value
 }));
 };

 return (
 <AuthPortalLayout title="Registration Portal" subtitle="Avalon Competition Management">
 <div className="p-8">
 <p className="text-[var(--muted-foreground)] text-sm text-center mb-6"> Check-in performers and manage attendance
 </p>  <form className="space-y-6" onSubmit={handleSubmit}>
 <div>
 <label htmlFor="email" className="label-caps text-[var(--sidebar-muted)] block mb-2"> Email address
 </label>
 <input
 id="email" name="email" type="email" autoComplete="email" required
 value={formData.email}
 onChange={handleInputChange}
 className={authFieldClass}
 placeholder="Enter your email" />
 </div>  <div>
 <label htmlFor="password" className="label-caps text-[var(--sidebar-muted)] block mb-2"> Password
 </label>
 <div className="relative">
 <input
 id="password" name="password" type={showPassword ? 'text' : 'password'}
 autoComplete="current-password" required
 value={formData.password}
 onChange={handleInputChange}
 className={`${authFieldClass} pr-16`}
 placeholder="Enter your password" />
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
 {isLoading ? 'Signing in...' : 'Sign in to Registration'}
 </button>  <div className="mt-6">
 <ForgotPasswordLink userType="registration" />
 </div>
 </form>  <div className="mt-8 pt-6 border-t border-[rgba(192,192,192,0.15)]">
 <div className="text-center">
 <p className="text-sm text-[var(--muted-foreground)] mb-4">Access other portals:</p>
 <div className="grid grid-cols-2 gap-2">
 <button
 onClick={() => router.push('/portal/admin')}
 className="px-3 py-2 text-xs font-medium text-[var(--chrome-mid)] bg-white/5 border border-[rgba(192,192,192,0.15)] rounded-md hover:bg-white/10 hover:text-white transition-colors" >
 Admin Portal
 </button>
 <button
 onClick={() => router.push('/portal/backstage')}
 className="px-3 py-2 text-xs font-medium text-[var(--chrome-mid)] bg-white/5 border border-[rgba(192,192,192,0.15)] rounded-md hover:bg-white/10 hover:text-white transition-colors" >
 Backstage Portal
 </button>
 <button
 onClick={() => router.push('/portal/announcer')}
 className="px-3 py-2 text-xs font-medium text-[var(--chrome-mid)] bg-white/5 border border-[rgba(192,192,192,0.15)] rounded-md hover:bg-white/10 hover:text-white transition-colors" >
 Announcer Portal
 </button>
 <button
 onClick={() => router.push('/portal/media')}
 className="px-3 py-2 text-xs font-medium text-[var(--chrome-mid)] bg-white/5 border border-[rgba(192,192,192,0.15)] rounded-md hover:bg-white/10 hover:text-white transition-colors" >
 Media Portal
 </button>
 </div>
 </div>
 </div>
 </div>
 </AuthPortalLayout> );
}
