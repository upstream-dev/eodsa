'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/simple-toast';

export default function BackstageDashboard() {
 const router = useRouter();
 const { success, error } = useToast();
 const [user, setUser] = useState<any>(null);
 const [selectedEvent, setSelectedEvent] = useState<string>('');
 const [events, setEvents] = useState<any[]>([]);
 const [isLoading, setIsLoading] = useState(true);

 useEffect(() => {
 // Check authentication
 const session = localStorage.getItem('backstageSession');
 if (!session) {
 router.push('/portal/backstage');
 return;
 }

 try {
 const userData = JSON.parse(session);
 setUser(userData);
 fetchEvents();
 } catch (err) {
 router.push('/portal/backstage');
 }
 }, [router]);

 const fetchEvents = async () => {
 try {
 const response = await fetch('/api/events');
 const data = await response.json();
 if (data.success) {
 setEvents(data.events || []);
 if (data.events && data.events.length > 0) {
 setSelectedEvent(data.events[0].id);
 }
 }
 } catch (error) {
 console.error('Error fetching events:', error);
 } finally {
 setIsLoading(false);
 }
 };

 const goToBackstageControl = () => {
 if (selectedEvent) {
 router.push(`/admin/backstage/${selectedEvent}`);
 } else {
 error('Please select an event first');
 }
 };

 if (isLoading) {
 return (
 <div className="min-h-screen avalon-mesh flex items-center justify-center">
 <div className="text-center">
 <div className="animate-spin rounded-full h-12 w-12 border-2 border-[rgba(192,192,192,0.2)] border-t-[var(--chrome-mid)] mx-auto"></div>
 <p className="mt-4 text-gray-300">Loading backstage dashboard...</p>
 </div>
 </div> );
 }

 return (
 <div className="min-h-screen avalon-mesh avalon-shell"> {/* Header */}
 <div className="glass-panel backdrop-blur-sm border-b border-[rgba(192,192,192,0.15)]">
 <div className="avalon-container">
 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4 sm:py-6 gap-3">
 <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
 <div className="w-10 h-10 sm:w-12 sm:h-12 btn-chrome !rounded-xl rounded-xl flex items-center justify-center flex-shrink-0">
 <span className="text-[#050505] text-lg sm:text-xl font-display">B</span>
 </div>
 <div className="min-w-0">
 <h1 className="font-display text-xl sm:text-2xl chrome-text leading-none">Backstage Manager Dashboard</h1>
 <p className="text-[#c0c0c0] mt-1 text-sm truncate">Welcome, {user?.name}</p>
 </div>
 </div>
 <button
 onClick={() => {
 localStorage.removeItem('backstageSession');
 router.push('/portal/backstage');
 }}
 className="btn-outline-chrome !px-4 !py-2 avalon-tap self-start sm:self-auto" >
 Logout
 </button>
 </div>
 </div>
 </div>  <div className="avalon-container avalon-section"> {/* Welcome Section */}
 <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-lg p-4 sm:p-8 mb-6 sm:mb-8">
 <h2 className="font-display text-xl sm:text-2xl chrome-text leading-none mb-3 sm:mb-4">Backstage Control Center</h2>
 <p className="text-[#c0c0c0] mb-4 sm:mb-6 text-sm sm:text-base"> As a Backstage Manager, you have full control over the performance order and live event flow. 
 You can drag and drop to reorder performances, control performance status, and manage the 
 running order in real-time.
 </p>  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
 <div className="bg-black/40 border border-[rgba(192,192,192,0.22)] p-4 rounded-lg">
 <h3 className="font-semibold text-white mb-2">Drag & Drop Reordering</h3>
 <p className="text-sm text-gray-400"> Instantly reorder performances by dragging item numbers. Changes sync across all dashboards.
 </p>
 </div>
 <div className="bg-black/40 border border-[rgba(192,192,192,0.22)] p-4 rounded-lg">
 <h3 className="font-semibold text-white mb-2">Status Control</h3>
 <p className="text-sm text-gray-400"> Mark performances as "Ready", "In Progress", or "Complete" to keep everyone informed.
 </p>
 </div>
 <div className="bg-black/40 border border-[rgba(192,192,192,0.22)] p-4 rounded-lg">
 <h3 className="font-semibold text-white mb-2">Real-time Sync</h3>
 <p className="text-sm text-gray-400"> All changes update instantly across judge, announcer, registration, and admin views.
 </p>
 </div>
 </div>
 </div> {/* Event Selection */}
 <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-lg p-6 mb-8">
 <h3 className="text-lg font-semibold text-white mb-4">Select Event to Manage</h3> {events.length > 0 ? (
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-300 mb-2">Choose Event</label>
 <select
 value={selectedEvent}
 onChange={(e) => setSelectedEvent(e.target.value)}
 className="w-full px-3 py-2 border border-[rgba(192,192,192,0.22)] bg-black/40 rounded-lg focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)] text-white" >
 <option value="">Select an event...</option> {events.map(event => (
 <option key={event.id} value={event.id}> {event.name} - {event.eventDate} ({event.venue})
 </option> ))}
 </select>
 </div> {selectedEvent && (
 <div className="pt-4">
 <button
 onClick={goToBackstageControl}
 className="btn-chrome w-full sm:w-auto justify-center" >
 Enter Backstage Control
 </button>
 <p className="text-sm text-gray-400 mt-2"> This will take you to the full backstage control interface with drag & drop functionality.
 </p>
 </div> )}
 </div> ) : (
 <div className="text-center py-8">
 <p className="text-white">No events found</p>
 <p className="text-sm text-gray-400 mt-2"> Contact an administrator to create events before managing backstage operations.
 </p>
 </div> )}
 </div> {/* Quick Access Features */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-lg p-6">
 <div className="flex items-center mb-4">
 <div className="w-10 h-10 bg-[rgba(192,192,192,0.08)] border border-[rgba(192,192,192,0.22)] rounded-lg flex items-center justify-center mr-3">
 <span className="text-[var(--chrome-mid)] text-sm font-medium">01</span>
 </div>
 <h3 className="font-semibold text-white">Performance Order</h3>
 </div>
 <p className="text-sm text-gray-400"> Drag and drop to reorder performances in real-time. Item numbers update automatically.
 </p>
 </div>  <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-lg p-6">
 <div className="flex items-center mb-4">
 <div className="w-10 h-10 bg-[rgba(192,192,192,0.08)] border border-[rgba(192,192,192,0.22)] rounded-lg flex items-center justify-center mr-3">
 <span className="text-[var(--chrome-mid)] text-sm font-medium">02</span>
 </div>
 <h3 className="font-semibold text-white">Status Control</h3>
 </div>
 <p className="text-sm text-gray-400"> Control the flow with "Ready", "In Progress", and "Complete" status updates.
 </p>
 </div>  <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-lg p-6">
 <div className="flex items-center mb-4">
 <div className="w-10 h-10 bg-[rgba(192,192,192,0.08)] border border-[rgba(192,192,192,0.22)] rounded-lg flex items-center justify-center mr-3">
 <span className="text-[var(--chrome-mid)] text-sm font-medium">03</span>
 </div>
 <h3 className="font-semibold text-white">Music Player</h3>
 </div>
 <p className="text-sm text-gray-400"> Preview music files and video links directly from the backstage interface.
 </p>
 </div>  <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-lg p-6">
 <div className="flex items-center mb-4">
 <div className="w-10 h-10 bg-[rgba(192,192,192,0.08)] border border-[rgba(192,192,192,0.22)] rounded-lg flex items-center justify-center mr-3">
 <span className="text-[var(--chrome-mid)] text-sm font-medium">04</span>
 </div>
 <h3 className="font-semibold text-white">Live Updates</h3>
 </div>
 <p className="text-sm text-gray-400"> All changes sync instantly to judges, announcers, registration, and admin dashboards.
 </p>
 </div>
 </div> {/* Instructions */}
 <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-lg p-6 mt-8">
 <h3 className="text-lg font-semibold text-white mb-4">Quick Instructions</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <h4 className="font-medium text-[var(--chrome-mid)] mb-2">Getting Started:</h4>
 <ol className="text-sm text-gray-400 space-y-1">
 <li>1. Select an event from the dropdown above</li>
 <li>2. Click "Enter Backstage Control" to access the full interface</li>
 <li>3. Use the drag handles (⋮⋮) to reorder performances</li>
 <li>4. Click status buttons to update performance states</li>
 </ol>
 </div>
 <div>
 <h4 className="font-medium text-[var(--chrome-mid)] mb-2">Key Features:</h4>
 <ul className="text-sm text-gray-400 space-y-1">
 <li>• Real-time drag & drop reordering</li>
 <li>• Instant status updates across all dashboards</li>
 <li>• Built-in music and video preview</li>
 <li>• Live event flow control</li>
 </ul>
 </div>
 </div>
 </div>
 </div>
 </div> );
}
