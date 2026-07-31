'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/simple-toast';
import RealtimeUpdates from '@/components/RealtimeUpdates';
import {
  ListOrdered,
  Radio,
  Video,
  Megaphone,
  Clapperboard,
} from 'lucide-react';

interface Performance {
 id: string;
 title: string;
 contestantName: string;
 participantNames: string[];
 duration: number;
 itemNumber?: number;
 performanceOrder?: number;
 status: 'scheduled' | 'ready' | 'hold' | 'in_progress' | 'completed' | 'cancelled';
 entryType?: 'live' | 'virtual';
 announced?: boolean;
 announcedAt?: string;
 itemStyle?: string;
 ageCategory?: string;
 musicCue?: 'onstage' | 'offstage';
}

interface Event {
 id: string;
 name: string;
 eventDate: string;
 venue: string;
 status: string;
}

export default function MediaDashboard() {
 const router = useRouter();
 const { success } = useToast();
 const [user, setUser] = useState<any>(null);
 const [selectedEvent, setSelectedEvent] = useState<string>('');
 const [event, setEvent] = useState<Event | null>(null);
 const [events, setEvents] = useState<Event[]>([]);
 const [performances, setPerformances] = useState<Performance[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [searchTerm, setSearchTerm] = useState('');
 const [entryTypeFilter, setEntryTypeFilter] = useState<string>('all');
 const [lastSyncAt, setLastSyncAt] = useState<string>('');

 useEffect(() => {
 // Check authentication
 const session = localStorage.getItem('mediaSession');
 if (!session) {
 router.push('/portal/media');
 return;
 }

 try {
 const userData = JSON.parse(session);
 setUser(userData);
 fetchEvents();
 } catch (err) {
 router.push('/portal/media');
 }
 }, [router]);

 useEffect(() => {
 if (selectedEvent) {
 fetchEventData();
 }
 }, [selectedEvent]);

 // Join media room for real-time updates
 useEffect(() => {
 if (selectedEvent) {
 import('@/lib/socket-client').then(({ socketClient }) => {
 socketClient.joinAsMedia(selectedEvent);
 console.log(`📸 Joined media room for event: ${selectedEvent}`);
 setLastSyncAt(new Date().toLocaleTimeString());
 });
 }
 }, [selectedEvent]);

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
 }
 };

 const fetchEventData = async () => {
 setIsLoading(true);
 try {
 // Load event details
 const eventRes = await fetch(`/api/events/${selectedEvent}`);
 const eventData = await eventRes.json();

 if (eventData.success) {
 setEvent(eventData.event);
 }

 // Load performances for this event
 const performancesRes = await fetch(`/api/events/${selectedEvent}/performances`);
 const performancesData = await performancesRes.json();

 if (performancesData.success) {
 // SYNC WITH BACKSTAGE: Sort by performanceOrder (backstage sequence), fallback to item number
 const sortedPerformances = performancesData.performances.sort((a: Performance, b: Performance) => {
 // Primary sort: performanceOrder (backstage sequence)
 if (a.performanceOrder && b.performanceOrder) {
 return a.performanceOrder - b.performanceOrder;
 }
 // Fallback to item number if performanceOrder missing
 if (a.itemNumber && b.itemNumber) {
 return a.itemNumber - b.itemNumber;
 } else if (a.itemNumber && !b.itemNumber) {
 return -1;
 } else if (!a.itemNumber && b.itemNumber) {
 return 1;
 }
 return a.title.localeCompare(b.title);
 });

 setPerformances(sortedPerformances);
 }
 } catch (error) {
 console.error('Error loading event data:', error);
 } finally {
 setIsLoading(false);
 }
 };

 const handlePerformanceReorder = (reorderedPerformances: any[]) => {
 console.log('📸 Media: Received reorder from backstage', reorderedPerformances);

 // Merge both itemNumber (permanent) and performanceOrder (dynamic) from backstage
 setPerformances(prev => {
 const updateMap = new Map(reorderedPerformances.map((r: any) => [r.id, r]));
 const merged = prev.map(p => {
 if (updateMap.has(p.id)) {
 const update = updateMap.get(p.id)!;
 return {
 ...p,
 itemNumber: update.itemNumber || p.itemNumber, // Keep permanent item number
 performanceOrder: update.performanceOrder // Update performance order from backstage
 };
 }
 return p;
 });
 // Sort by performance order (backstage sequence) for live sync
 merged.sort((a, b) => {
 // Primary sort: performanceOrder (backstage sequence)
 if (a.performanceOrder && b.performanceOrder) return a.performanceOrder - b.performanceOrder;
 // Fallback to item number if performanceOrder missing
 if (a.itemNumber && b.itemNumber) return a.itemNumber - b.itemNumber;
 if (a.itemNumber && !b.itemNumber) return -1;
 if (!a.itemNumber && b.itemNumber) return 1;
 return a.title.localeCompare(b.title);
 });
 return merged;
 });
 setLastSyncAt(new Date().toLocaleTimeString());
 success('Synced with backstage order');
 };

 const handlePerformanceStatus = (data: any) => {
 console.log('📸 Media: Received status update from backstage', data);
 setPerformances(prev => prev.map(p => p.id === data.performanceId
 ? { ...p, status: data.status }
 : p
 )
 );
 setLastSyncAt(new Date().toLocaleTimeString());
 };

 const handlePerformanceAnnounced = (data: any) => {
 console.log('📸 Media: Performance announced', data);
 setPerformances(prev => prev.map(p => p.id === data.performanceId
 ? { ...p, announced: true, announcedAt: data.announcedAt }
 : p
 )
 );
 setLastSyncAt(new Date().toLocaleTimeString());
 };

 const filteredPerformances = performances.filter(perf => {
 const matchesEntryType = entryTypeFilter === 'all' || perf.entryType === entryTypeFilter;

 const matchesSearch = searchTerm === '' ||
 perf.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
 perf.contestantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
 perf.participantNames.some(name => name.toLowerCase().includes(searchTerm.toLowerCase())) ||
 (perf.itemNumber && perf.itemNumber.toString().includes(searchTerm));

 return matchesEntryType && matchesSearch;
 });

 const livePerformances = filteredPerformances.filter(p => p.entryType === 'live');
 const virtualPerformances = filteredPerformances.filter(p => p.entryType === 'virtual');

 if (isLoading && !event) {
 return (
 <div className="min-h-screen avalon-mesh flex items-center justify-center">
 <div className="text-center">
 <div className="animate-spin rounded-full h-12 w-12 border-2 border-[rgba(192,192,192,0.2)] border-t-[var(--chrome-mid)] mx-auto"></div>
 <p className="mt-4 text-gray-300">Loading media dashboard...</p>
 </div>
 </div> );
 }

 return (
 <RealtimeUpdates
 eventId={selectedEvent}
 role="media" strictEvent
 onPerformanceReorder={handlePerformanceReorder}
 onPerformanceStatus={handlePerformanceStatus}
 onPerformanceAnnounced={handlePerformanceAnnounced}
 onPerformanceMusicCue={(data) => {
 setPerformances(prev => prev.map(p => p.id === data.performanceId ? { ...p, musicCue: data.musicCue } : p));
 }}
 >
 <div className="min-h-screen avalon-mesh"> {/* Header */}
 <div className="glass-panel backdrop-blur-sm border-b border-[rgba(192,192,192,0.15)]">
 <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 py-6">
 <div className="flex items-center space-x-4">
 <div className="w-12 h-12 btn-chrome !rounded-xl rounded-xl flex items-center justify-center">
 <span className="text-[#050505] text-xl font-display">M</span>
 </div>
 <div>
 <h1 className="font-display text-2xl chrome-text leading-none">Media Dashboard</h1>
 <p className="text-[#c0c0c0] mt-1">Welcome, {user?.name}</p>
 <div className="flex flex-wrap items-center gap-2 mt-1">
 <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[rgba(192,192,192,0.08)] text-[var(--chrome-mid)] border border-[rgba(192,192,192,0.22)]"> Live Sync
 </span> {lastSyncAt && (
 <span className="text-xs text-[#c0c0c0]"> Last update: {lastSyncAt}
 </span> )}
 </div>
 </div>
 </div>
 <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
 <select
 value={selectedEvent}
 onChange={(e) => setSelectedEvent(e.target.value)}
 className="w-full sm:w-auto px-3 py-2 border border-[rgba(192,192,192,0.22)] bg-black/40 text-white rounded-lg focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" >
 {events.map(event => (
 <option key={event.id} value={event.id}>{event.name}</option> ))}
 </select>
 <div className="flex items-center gap-3">
 <button
 onClick={() => window.open('https://eodsa.vercel.app/admin/rankings', '_blank')}
 className="btn-chrome !px-4 !py-2 flex-1 sm:flex-none" >
 View Rankings
 </button>
 <button
 onClick={() => {
 localStorage.removeItem('mediaSession');
 router.push('/portal/media');
 }}
 className="btn-outline-chrome !px-4 !py-2 flex-1 sm:flex-none" >
 Logout
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"> {/* Event Info */}
 {event && (
 <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-lg p-6 mb-8">
 <h2 className="text-xl font-semibold text-white mb-2">{event.name}</h2>
 <p className="text-[#e0e0e0]">Date: {event.eventDate} | Venue: {event.venue}</p>
 </div> )}

 {/* Stats Cards */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
 <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-lg p-6">
 <div className="flex items-center">
 <div className="w-8 h-8 bg-[rgba(192,192,192,0.08)] border border-[rgba(192,192,192,0.22)] rounded-lg flex items-center justify-center mr-3">
 <ListOrdered className="w-4 h-4 text-[var(--chrome-mid)]" />
 </div>
 <div>
 <p className="text-sm font-medium text-[#c0c0c0]">Total Items</p>
 <p className="text-2xl font-semibold text-white">{performances.length}</p>
 </div>
 </div>
 </div>  <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-lg p-6">
 <div className="flex items-center">
 <div className="w-8 h-8 bg-[rgba(192,192,192,0.08)] border border-[rgba(192,192,192,0.22)] rounded-lg flex items-center justify-center mr-3">
 <Radio className="w-4 h-4 text-[var(--chrome-mid)]" />
 </div>
 <div>
 <p className="text-sm font-medium text-[#c0c0c0]">Live Performances</p>
 <p className="text-2xl font-semibold text-white">{livePerformances.length}</p>
 </div>
 </div>
 </div>  <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-lg p-6">
 <div className="flex items-center">
 <div className="w-8 h-8 bg-[rgba(192,192,192,0.08)] border border-[rgba(192,192,192,0.22)] rounded-lg flex items-center justify-center mr-3">
 <Video className="w-4 h-4 text-[var(--chrome-mid)]" />
 </div>
 <div>
 <p className="text-sm font-medium text-[#c0c0c0]">Virtual Performances</p>
 <p className="text-2xl font-semibold text-white">{virtualPerformances.length}</p>
 </div>
 </div>
 </div>  <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-lg p-6">
 <div className="flex items-center">
 <div className="w-8 h-8 bg-[rgba(192,192,192,0.08)] border border-[rgba(192,192,192,0.22)] rounded-lg flex items-center justify-center mr-3">
 <Megaphone className="w-4 h-4 text-[var(--chrome-mid)]" />
 </div>
 <div>
 <p className="text-sm font-medium text-[#c0c0c0]">Announced</p>
 <p className="text-2xl font-semibold text-white"> {performances.filter(p => p.announced).length}
 </p>
 </div>
 </div>
 </div>
 </div> {/* Filters */}
 <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-lg p-6 mb-8">
 <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
 <div className="flex-1">
 <label className="block text-sm font-medium text-[#e0e0e0] mb-2">Search</label>
 <input
 type="text" value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 placeholder="Search by item, performer, or studio..." className="w-full px-3 py-2 border border-[rgba(192,192,192,0.22)] bg-black/40 text-white rounded-lg focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)] placeholder:text-[#c0c0c0]" />
 </div>  <div>
 <label className="block text-sm font-medium text-[#e0e0e0] mb-2">Entry Type</label>
 <select
 value={entryTypeFilter}
 onChange={(e) => setEntryTypeFilter(e.target.value)}
 className="w-full sm:w-auto px-3 py-2 border border-[rgba(192,192,192,0.22)] bg-black/40 text-white rounded-lg focus:ring-2 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]" >
 <option value="all">All Types</option>
 <option value="live">Live Performances</option>
 <option value="virtual">Virtual Performances</option>
 </select>
 </div>
 </div>
 </div> {/* Performance List - SIMPLIFIED */}
 <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-lg">
 <div className="px-6 py-4 border-b border-[rgba(192,192,192,0.15)]">
 <h2 className="text-lg font-semibold text-white flex items-center gap-2">
 <Clapperboard className="w-5 h-5 text-[var(--chrome-mid)]" /> Performance Details ({filteredPerformances.length} items)</h2>
 </div> {filteredPerformances.length > 0 ? (
 <div className="divide-y divide-[rgba(192,192,192,0.15)]"> {filteredPerformances.map((performance) => {
 return (
 <div key={performance.id} className="p-6 hover:bg-black/20 transition-colors">
 <div className="flex flex-col sm:flex-row sm:items-center gap-4"> {/* Item Number Badge */}
 <div className={`w-16 h-16 shrink-0 rounded-xl flex flex-col items-center justify-center font-bold border-4 ${
 performance.entryType === 'live'
 ? 'bg-green-600 border-green-500 text-white'
 : 'bg-[rgba(192,192,192,0.25)] border-[rgba(192,192,192,0.35)] text-white'
 }`}>
 <div className="text-base leading-none">#{performance.itemNumber || '?'}</div> {performance.performanceOrder && (
 <div className="text-[10px] opacity-75 leading-none mt-1"> Pos: {performance.performanceOrder}
 </div> )}
 </div> {/* Simplified Info - ONLY Required Fields */}
 <div className="flex-1 min-w-0">
 <h3 className="text-xl font-bold text-white leading-tight"> {performance.title}</h3> {/* Item Name (title) - Already shown above */}

 {/* Performer(s) */}
 <p className="text-base text-[#e0e0e0] mt-1">
 <strong className="text-white">Performer(s):</strong> {performance.participantNames.join(', ')}
 </p> {/* Style */}
 <p className="text-base text-[#e0e0e0]">
 <strong className="text-white">Style:</strong> {performance.itemStyle || 'N/A'}
 </p> {/* Music On/Offstage */}
 {performance.entryType === 'live' && performance.musicCue && (
 <p className="text-base text-[#c0c0c0]">
 <strong className="text-white">Music Cue:</strong> {performance.musicCue === 'onstage' ? 'On Stage' : 'Off Stage'}
 </p> )}

 {/* Age Category */}
 {performance.ageCategory && (
 <p className="text-base text-[#c0c0c0]">
 <strong className="text-white">Age Category:</strong> {performance.ageCategory}
 </p> )}
 </div> {/* Status Badges */}
 <div className="flex flex-row flex-wrap sm:flex-col sm:items-end gap-2">
 <span className={`px-3 py-1 text-sm font-medium rounded-full ${
 performance.entryType === 'live'
 ? 'bg-green-900 text-green-200 border border-green-700'
 : 'bg-black/40 text-[var(--chrome-mid)] border border-[rgba(192,192,192,0.22)]'
 }`}> {performance.entryType?.toUpperCase()}
 </span>  <span className={`px-3 py-1 text-sm font-medium rounded-full ${
 performance.status === 'in_progress' ? 'bg-[rgba(192,192,192,0.12)] text-[#e0e0e0] border border-[rgba(192,192,192,0.35)]' :
 performance.status === 'completed' ? 'bg-green-900/40 text-green-200 border border-green-700/50' :
 performance.status === 'cancelled' ? 'bg-red-900 text-red-200 border border-red-700' :
 'bg-black/40 text-[#c0c0c0] border border-[rgba(192,192,192,0.22)]'
 }`}> {performance.status.toUpperCase()}
 </span> {performance.announced && (
 <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-900 text-green-200 border border-green-700"> ANNOUNCED
 </span> )}
 </div>
 </div>
 </div> );
 })}
 </div> ) : (
 <div className="p-8 text-center">
 <Clapperboard className="w-10 h-10 mx-auto mb-4 text-[var(--chrome-mid)]" />
 <p className="text-[#e0e0e0]">No performances found for the selected filter</p>
 </div> )}
 </div>
 </div>
 </div>
 </RealtimeUpdates> );
}
