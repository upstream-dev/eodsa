'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { REGIONS, PERFORMANCE_TYPES, AGE_CATEGORIES } from '@/lib/types';

interface Dancer {
 id: string;
 eodsaId: string;
 name: string;
 age: number;
 dateOfBirth: string;
 nationalId: string;
 email?: string;
 phone?: string;
 approved: boolean;
 approvedBy?: string;
 approvedAt?: string;
 rejectionReason?: string;
 createdAt: string;
}

interface StudioApplication {
 id: string;
 studioId: string;
 status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
 appliedAt: string;
 respondedAt?: string;
 studio: {
 name: string;
 email: string;
 address: string;
 };
}

interface Event {
 id: string;
 name: string;
 description: string;
 region: string;
 ageCategory: string;
 performanceType: string;
 eventDate: string;
 registrationDeadline: string;
 venue: string;
 status: string;
 maxParticipants?: number;
 entryFee: number;
}

export default function CompetitionEntry() {
 const router = useRouter();
 const [dancer, setDancer] = useState<Dancer | null>(null);
 const [studioApplications, setStudioApplications] = useState<StudioApplication[]>([]);
 const [events, setEvents] = useState<Event[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [error, setError] = useState('');
 const [eodsaId, setEodsaId] = useState('');
 const [loginAttempted, setLoginAttempted] = useState(false);

 useEffect(() => {
 // Check session
 const session = localStorage.getItem('dancerSession');
 if (session) {
 const data = JSON.parse(session);
 loadDancerData(data.eodsaId);
 } else {
 setIsLoading(false);
 }
 }, []);

 const loadDancerData = async (id: string) => {
 try {
 const response = await fetch(`/api/dancers/by-eodsa-id/${id}`);
 if (response.ok) {
 const data = await response.json();
 setDancer(data.dancer);
 loadEvents();
 } else {
 setError('Dancer not found');
 }
 } catch (error) {
 setError('Failed to load data');
 } finally {
 setIsLoading(false);
 }
 };

 const loadEvents = async () => {
 try {
 const response = await fetch('/api/events');
 if (response.ok) {
 const data = await response.json();
 setEvents(data.events?.filter((e: Event) => e.status !== 'completed') || []);
 }
 } catch (error) {
 console.error('Failed to load events');
 }
 };

 const handleLogin = async (e: React.FormEvent) => {
 e.preventDefault();
 if (eodsaId.trim()) {
 setIsLoading(true);
 await loadDancerData(eodsaId.trim());
 }
 };

 // Check dancer eligibility
 const getDancerStatus = () => {
 if (!dancer) return { eligible: false, reason: 'Not logged in' };
 
 if (dancer.rejectionReason) {
 return { 
 eligible: false, 
 reason: 'Account disabled', 
 message: 'Your account has been disabled. Please contact support for assistance.' 
 };
 }

 const acceptedApplications = studioApplications.filter(app => app.status === 'accepted');
 
 return {
 eligible: true,
 reason: 'Active',
 isIndependent: acceptedApplications.length === 0,
 studioAffiliation: acceptedApplications.length > 0 ? acceptedApplications[0].studio.name : null
 };
 };

 const status = getDancerStatus();

 if (isLoading) {
 return (
 <div className="min-h-screen avalon-mesh flex items-center justify-center">
 <div className="text-center">
 <div className="w-16 h-16 border-4 border-[rgba(192,192,192,0.22)] border-t-[var(--chrome-mid)] rounded-full animate-spin mx-auto mb-4"></div>
 <p className="text-[var(--muted-foreground)] text-sm tracking-wide">Loading...</p>
 </div>
 </div> );
 }

 if (!dancer) {
 return (
 <div className="min-h-screen avalon-mesh">
 <div className="container mx-auto px-4 py-8">
 <div className="max-w-md mx-auto glass-panel rounded-2xl border border-[rgba(192,192,192,0.22)] p-8">
 <h1 className="font-display text-2xl chrome-text text-center mb-6">Competition Entry</h1>
 <form onSubmit={handleLogin} className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-300 mb-2">EODSA ID</label>
 <input
 type="text" value={eodsaId}
 onChange={(e) => setEodsaId(e.target.value)}
 className="w-full px-3 py-2 border border-[rgba(192,192,192,0.25)] bg-black/40 rounded-lg focus:ring-[3px] focus:ring-[rgba(192,192,192,0.12)] text-white placeholder-gray-500" placeholder="Enter your Element of Dance ID or Studio ID" required
 />
 </div> {error && <p className="text-red-400 text-sm">{error}</p>}
 <button
 type="submit" className="w-full btn-chrome" >
 Access Portal
 </button>
 </form>
 <div className="mt-4 text-center">
 <Link href="/register" className="text-[var(--chrome-mid)] hover:underline"> Register as New Dancer
 </Link>
 </div>
 </div>
 </div>
 </div> );
 }

 // Main dashboard
 return (
 <div className="min-h-screen avalon-mesh">
 <header className="sticky top-0 z-10 bg-[rgba(5,5,5,0.92)] backdrop-blur-lg border-b border-[rgba(192,192,192,0.12)]">
 <div className="max-w-7xl mx-auto px-4 py-6">
 <div className="flex justify-between items-center gap-4">
 <h1 className="font-display text-xl sm:text-2xl chrome-text">Competition Portal — {dancer.name}</h1>
 <button
 onClick={() => {
 localStorage.removeItem('dancerSession');
 router.push('/');
 }}
 className="btn-outline-chrome" >
 Logout
 </button>
 </div>
 </div>
 </header>  <div className="max-w-7xl mx-auto px-4 py-8">
 <div className="glass-panel rounded-2xl border border-[rgba(192,192,192,0.22)] p-8 mb-8">
 <div className="text-center">
 <h2 className="text-2xl font-bold text-white mb-4">Competition Eligibility</h2> {status.eligible ? (
 <div className="bg-green-900/20 p-6 rounded-xl border border-green-500/30">
 <p className="text-green-300 font-semibold text-lg"> Eligible for Competition Entry</p>
 <p className="text-green-400/80 mt-2">You are approved and can enter competitions</p>
 </div> ) : (
 <div className="bg-orange-900/20 p-6 rounded-xl border border-orange-500/30">
 <p className="text-orange-300 font-semibold text-lg">⏳ Pending Admin Approval</p>
 <p className="text-orange-400/80 mt-2"> {dancer.rejectionReason 
 ? `Registration rejected: ${dancer.rejectionReason}` 
 : 'Your registration is pending admin approval'
 }
 </p>
 <Link 
 href="/dancer-dashboard" className="inline-block mt-4 btn-chrome" >
 Check Dashboard
 </Link>
 </div> )}
 </div>
 </div> {status.eligible && (
 <div className="glass-panel rounded-2xl border border-[rgba(192,192,192,0.22)] overflow-hidden">
 <div className="px-6 py-4 border-b border-[rgba(192,192,192,0.15)]">
 <h2 className="text-xl font-bold text-white">Available Competitions</h2>
 </div> {events.length === 0 ? (
 <div className="text-center py-12">
 <p className="text-gray-400">No competitions available at this time</p>
 </div> ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6"> {events.map((event) => (
 <div key={event.id} className="border border-[rgba(192,192,192,0.22)] rounded-lg p-4 hover:border-[rgba(192,192,192,0.4)] transition-colors bg-black/30">
 <h3 className="font-bold text-lg mb-2 text-white">{event.name}</h3>
 <div className="space-y-1 text-sm text-gray-400 mb-4">
 <p> {new Date(event.eventDate).toLocaleDateString()}</p>
 <p>📍 {event.venue}</p>
 <p> {event.performanceType}</p>
 <p> {event.ageCategory}</p>
 <p> R{event.entryFee}</p>
 </div>
 <button
 onClick={() => router.push(`/event-entry?eventId=${event.id}&dancerId=${dancer.id}`)}
 className="w-full btn-chrome" >
 Enter Competition
 </button>
 </div> ))}
 </div> )}
 </div> )}
 </div>
 </div> );
}
