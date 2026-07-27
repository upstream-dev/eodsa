'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthPortalLayout, authFieldClass, authErrorClass } from '@/components/brand/AuthPortalLayout';

function ResetPasswordContent() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const [formData, setFormData] = useState({
 newPassword: '',
 confirmPassword: ''
 });
 const [isLoading, setIsLoading] = useState(false);
 const [error, setError] = useState('');
 const [success, setSuccess] = useState(false);
 const [token, setToken] = useState('');
 const [userType, setUserType] = useState('');
 const [showNew, setShowNew] = useState(false);
 const [showConfirm, setShowConfirm] = useState(false);

 useEffect(() => {
 const tokenParam = searchParams.get('token');
 const typeParam = searchParams.get('type');
 
 if (!tokenParam || !typeParam) {
 setError('Invalid reset link. Please request a new password reset.');
 return;
 }
 
 setToken(tokenParam);
 setUserType(typeParam);
 }, [searchParams]);

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const { name, value } = e.target;
 
 // Validate password strength in real-time
 if (name === 'newPassword') {
 if (value.length < 8) {
 setError('Password must be at least 8 characters long');
 } else if (!/[A-Z]/.test(value)) {
 setError('Password must contain at least one uppercase letter');
 } else if (!/[a-z]/.test(value)) {
 setError('Password must contain at least one lowercase letter');
 } else if (!/[0-9]/.test(value)) {
 setError('Password must contain at least one number');
 } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
 setError('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
 } else {
 setError('');
 }
 } else {
 // Clear error when user starts typing in other fields
 if (error) setError('');
 }
 
 setFormData(prev => ({
 ...prev,
 [name]: value
 }));
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setIsLoading(true);
 setError('');

 // Validate passwords match
 if (formData.newPassword !== formData.confirmPassword) {
 setError('Passwords do not match');
 setIsLoading(false);
 return;
 }

 // Validate password strength
 if (formData.newPassword.length < 8) {
 setError('Password must be at least 8 characters long');
 setIsLoading(false);
 return;
 }
 
 // Check for uppercase letter
 if (!/[A-Z]/.test(formData.newPassword)) {
 setError('Password must contain at least one uppercase letter');
 setIsLoading(false);
 return;
 }
 
 // Check for lowercase letter
 if (!/[a-z]/.test(formData.newPassword)) {
 setError('Password must contain at least one lowercase letter');
 setIsLoading(false);
 return;
 }
 
 // Check for number
 if (!/[0-9]/.test(formData.newPassword)) {
 setError('Password must contain at least one number');
 setIsLoading(false);
 return;
 }
 
 // Check for special character
 if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.newPassword)) {
 setError('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
 setIsLoading(false);
 return;
 }

 try {
 const response = await fetch('/api/auth/reset-password', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 token: token,
 newPassword: formData.newPassword
 }),
 });

 const data = await response.json();

 if (data.success) {
 setSuccess(true);
 // Redirect to appropriate login page after 3 seconds
 setTimeout(() => {
 if (userType === 'studio') {
 router.push('/studio-login');
 } else if (userType === 'admin') {
 router.push('/portal/admin');
 } else {
 router.push('/portal/judge');
 }
 }, 3000);
 } else {
 setError(data.error || 'Failed to reset password. Please try again.');
 }
 } catch (error) {
 setError('Network error. Please check your connection and try again.');
 } finally {
 setIsLoading(false);
 }
 };

 const getUserTypeDisplay = () => {
 switch (userType) {
 case 'studio': return 'Studio';
 case 'admin': return 'Admin';
 case 'judge': return 'Judge';
 default: return 'User';
 }
 };

 const loginHref =
 userType === 'studio' ? '/studio-login' : userType === 'admin' ? '/portal/admin' : '/portal/judge';

 if (!token || !userType) {
 return (
 <AuthPortalLayout title="Invalid Link" subtitle="Avalon Competition Management">
 <div className="p-8 text-center">
 <p className="text-[var(--muted-foreground)] mb-6"> This password reset link is invalid or has expired. Please request a new password reset.
 </p> {error && <div className={`${authErrorClass} mb-6 text-left`}>{error}</div>}
 <Link href="/" className="btn-chrome inline-flex justify-center"> Back to Home
 </Link>
 </div>
 </AuthPortalLayout> );
 }

 if (success) {
 return (
 <AuthPortalLayout title="Success" subtitle="Avalon Competition Management">
 <div className="p-8 text-center">
 <p className="text-[var(--muted-foreground)] mb-6"> Your password has been successfully reset. You will be redirected to the login page in a few seconds.
 </p>  <div className="flex items-center justify-center space-x-3 mb-6">
 <div className="relative">
 <div className="w-5 h-5 border-2 border-[rgba(192,192,192,0.3)] rounded-full"></div>
 <div className="absolute top-0 left-0 w-5 h-5 border-2 border-transparent border-t-[var(--chrome-mid)] rounded-full animate-spin"></div>
 </div>
 <span className="text-[var(--chrome-mid)] font-medium">Redirecting...</span>
 </div>  <Link href={loginHref} className="btn-chrome inline-flex justify-center"> Login Now
 </Link>
 </div>
 </AuthPortalLayout> );
 }

 return (
 <AuthPortalLayout
 title="Reset Password" subtitle="Avalon Competition Management" footer={
 <div className="text-center">
 <p className="text-[var(--muted-foreground)] text-sm mb-3">Remember your password?</p>
 <Link
 href={loginHref}
 className="text-[var(--chrome-mid)] hover:text-white text-sm transition-colors" >
  Back to Login
 </Link>
 </div> }
 >
 <div className="px-8 py-6 border-b border-[rgba(192,192,192,0.12)]">
 <h2 className="font-display text-2xl text-white text-center leading-none">Set New Password</h2>
 <p className="text-[var(--muted-foreground)] text-center mt-2 text-sm"> {getUserTypeDisplay()} Account Recovery
 </p>
 </div>  <div className="p-8">
 <form onSubmit={handleSubmit} className="space-y-6">
 <div>
 <label htmlFor="newPassword" className="label-caps text-[var(--sidebar-muted)] block mb-2"> New Password
 </label>
 <div className="relative">
 <input
 type={showNew ? 'text' : 'password'}
 id="newPassword" name="newPassword" value={formData.newPassword}
 onChange={handleInputChange}
 className={`${authFieldClass} pr-16`}
 placeholder="Enter new password" required
 minLength={6}
 />
 <button
 type="button" onClick={() => setShowNew(v => !v)}
 className="absolute inset-y-0 right-2 my-1 px-3 rounded-lg text-[var(--muted-foreground)] hover:text-white hover:bg-white/10 text-xs tracking-wide uppercase" aria-label="Toggle new password visibility" >
 {showNew ? 'Hide' : 'Show'}
 </button>
 </div>
 </div>  <div>
 <label htmlFor="confirmPassword" className="label-caps text-[var(--sidebar-muted)] block mb-2"> Confirm New Password
 </label>
 <div className="relative">
 <input
 type={showConfirm ? 'text' : 'password'}
 id="confirmPassword" name="confirmPassword" value={formData.confirmPassword}
 onChange={handleInputChange}
 className={`${authFieldClass} pr-16`}
 placeholder="Confirm new password" required
 minLength={6}
 />
 <button
 type="button" onClick={() => setShowConfirm(v => !v)}
 className="absolute inset-y-0 right-2 my-1 px-3 rounded-lg text-[var(--muted-foreground)] hover:text-white hover:bg-white/10 text-xs tracking-wide uppercase" aria-label="Toggle confirm password visibility" >
 {showConfirm ? 'Hide' : 'Show'}
 </button>
 </div>
 </div> {error && <div className={authErrorClass}>{error}</div>}

 <button
 type="submit" disabled={isLoading}
 className="btn-chrome w-full justify-center disabled:opacity-50" >
 {isLoading ? 'Resetting Password...' : 'Reset Password'}
 </button>
 </form>
 </div>
 </AuthPortalLayout> );
}

function LoadingFallback() {
 return (
 <div className="min-h-screen avalon-mesh flex items-center justify-center px-4 py-8">
 <div className="text-center">
 <div className="relative mx-auto mb-6 w-10 h-10">
 <div className="w-10 h-10 border-2 border-[rgba(192,192,192,0.3)] rounded-full"></div>
 <div className="absolute top-0 left-0 w-10 h-10 border-2 border-transparent border-t-[var(--chrome-mid)] rounded-full animate-spin"></div>
 </div>
 <h1 className="font-display text-2xl text-white">Loading...</h1>
 <p className="text-[var(--muted-foreground)] mt-2 text-sm">Preparing password reset</p>
 </div>
 </div> );
}

export default function ResetPasswordPage() {
 return (
 <Suspense fallback={<LoadingFallback />}>
 <ResetPasswordContent />
 </Suspense> );
}
