'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BrandLogo, CoBrandLine } from '@/components/brand/BrandLogo';

export default function DancerLoginPage() {
 const [formData, setFormData] = useState({
 eodsaId: '',
 nationalId: ''
 });
 const [isLoading, setIsLoading] = useState(false);
 const [error, setError] = useState('');
 const router = useRouter();

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const { name, value } = e.target;

 if (name === 'nationalId') {
 const numericValue = value.replace(/\D/g, '');
 const limitedValue = numericValue.slice(0, 13);

 setFormData((prev) => ({
 ...prev,
 [name]: limitedValue
 }));
 if (error) setError('');
 return;
 }

 setFormData((prev) => ({
 ...prev,
 [name]: value
 }));
 if (error) setError('');
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setIsLoading(true);
 setError('');

 try {
 const response = await fetch('/api/auth/dancer', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify(formData),
 });

 const data = await response.json();

 if (data.success) {
 localStorage.setItem(
 'dancerSession',
 JSON.stringify({
 id: data.dancer.id,
 name: data.dancer.name,
 eodsaId: data.dancer.eodsaId,
 approved: data.dancer.approved,
 email: data.dancer.email
 })
 );

 router.push('/dancer-dashboard');
 } else {
 setError(data.error || 'Login failed. Please try again.');
 }
 } catch {
 setError('Network error. Please check your connection and try again.');
 } finally {
 setIsLoading(false);
 }
 };

 const fieldClass =
 'w-full px-4 py-3.5 bg-black/40 border border-[rgba(192,192,192,0.2)] rounded-[10px] text-white placeholder-[#5a5a5a] focus:border-[rgba(192,192,192,0.5)] focus:ring-[3px] focus:ring-[rgba(192,192,192,0.12)] transition-all';

 return (
 <div className="min-h-screen avalon-mesh flex items-center justify-center px-4 py-8">
 <div className="w-full max-w-md">
 <div className="text-center mb-8">
 <BrandLogo brand="avalon" size={80} priority className="mx-auto mb-5" />
 <h1 className="font-display text-4xl chrome-text leading-none mb-2">Dancer Portal</h1>
 <p className="label-caps text-[var(--chrome-mid)] mb-3">Avalon Competition Management</p>
 <div className="flex justify-center">
 <CoBrandLine />
 </div>
 </div>  <div className="glass-panel overflow-hidden">
 <div className="px-8 py-6 border-b border-[rgba(192,192,192,0.12)]">
 <h2 className="font-display text-2xl text-white text-center leading-none">Welcome Back</h2>
 <p className="text-[var(--muted-foreground)] text-center mt-2 text-sm"> Access your dancer dashboard
 </p>
 </div>  <div className="p-8">
 <form onSubmit={handleSubmit} className="space-y-6">
 <div>
 <label htmlFor="eodsaId" className="label-caps text-[var(--sidebar-muted)] block mb-2"> EODSA ID
 </label>
 <input
 type="text" id="eodsaId" name="eodsaId" value={formData.eodsaId}
 onChange={handleInputChange}
 className={fieldClass}
 placeholder="E123456" required
 />
 </div>  <div>
 <label htmlFor="nationalId" className="label-caps text-[var(--sidebar-muted)] block mb-2"> National ID Number
 </label>
 <input
 type="text" id="nationalId" name="nationalId" value={formData.nationalId}
 onChange={handleInputChange}
 className={fieldClass}
 placeholder="13 digit ID number" maxLength={13}
 inputMode="numeric" title="Please enter exactly 13 digits" required
 />
 </div> {error && (
 <div className="border border-[rgba(139,58,58,0.45)] bg-[rgba(139,58,58,0.2)] text-[#f0c4c4] px-4 py-3 rounded-[10px] text-sm"> {error}
 </div> )}

 <button type="submit" disabled={isLoading} className="btn-chrome w-full justify-center disabled:opacity-50"> {isLoading ? 'Signing you in...' : 'Access Dashboard'}
 </button>
 </form>  <div className="mt-8 text-center">
 <p className="text-[var(--muted-foreground)] text-sm mb-4">Don&apos;t have an account yet?</p>
 <Link href="/register" className="btn-outline-chrome inline-flex"> Register as Dancer
 </Link>
 </div>
 </div>
 </div>  <div className="text-center mt-8">
 <p className="text-[var(--sidebar-muted)] text-sm">Official entry portal for Elements of Dance SA</p>
 <div className="mt-4">
 <Link href="/" className="text-[var(--chrome-mid)] hover:text-white text-sm transition-colors"> Back to Home
 </Link>
 </div>
 </div>
 </div>
 </div> );
}
