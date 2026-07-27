'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthPortalLayout, authFieldClass, authErrorClass } from '@/components/brand/AuthPortalLayout';

export default function ClientLoginPage() {
 const [formData, setFormData] = useState({
 email: '',
 password: ''
 });
 const [isLoading, setIsLoading] = useState(false);
 const [error, setError] = useState('');
 const router = useRouter();

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setIsLoading(true);
 setError('');

 try {
 const response = await fetch('/api/auth/client', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify(formData),
 });

 const data = await response.json();

 if (data.success) {
 // Store client session
 localStorage.setItem('clientSession', JSON.stringify(data.client));
 console.log(' Client login successful, redirecting to dashboard');
 router.push('/client-dashboard');
 } else {
 setError(data.error || 'Login failed');
 }
 } catch (error) {
 console.error('Login error:', error);
 setError('Network error. Please try again.');
 } finally {
 setIsLoading(false);
 }
 };

 const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 setFormData(prev => ({
 ...prev,
 [e.target.name]: e.target.value
 }));
 };

 return (
 <AuthPortalLayout title="Staff Portal" subtitle="Avalon Competition Management">
 <div className="p-8">
 <p className="text-[var(--muted-foreground)] text-sm text-center mb-6"> Access your authorized dashboards
 </p>  <form onSubmit={handleSubmit} className="space-y-6"> {error && <div className={authErrorClass}>{error}</div>}

 <div>
 <label htmlFor="email" className="label-caps text-[var(--sidebar-muted)] block mb-2"> Email Address
 </label>
 <input
 type="email" id="email" name="email" required
 value={formData.email}
 onChange={handleChange}
 className={authFieldClass}
 placeholder="your.email@company.com" />
 </div>  <div>
 <label htmlFor="password" className="label-caps text-[var(--sidebar-muted)] block mb-2"> Password
 </label>
 <input
 type="password" id="password" name="password" required
 value={formData.password}
 onChange={handleChange}
 className={authFieldClass}
 placeholder="Enter your password" />
 </div>  <button
 type="submit" disabled={isLoading}
 className="btn-chrome w-full justify-center disabled:opacity-50" >
 {isLoading ? 'Signing In...' : 'Sign In'}
 </button>
 </form>  <div className="mt-6 pt-6 border-t border-[rgba(192,192,192,0.15)]">
 <p className="text-center text-[var(--muted-foreground)] text-sm"> Need access? Contact your administrator
 </p>
 </div>
 </div>
 </AuthPortalLayout> );
}
