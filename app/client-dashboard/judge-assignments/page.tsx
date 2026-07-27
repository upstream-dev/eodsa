'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/simple-toast';

interface ClientSession {
 id: string;
 name: string;
 email: string;
 phone?: string;
 allowedDashboards: string[];
 canViewAllEvents: boolean;
 allowedEventIds: string[];
 userType: 'client';
}

interface Event {
 id: string;
 name: string;
 description?: string;
 region: string;
 ageCategory: string;
 performanceType: string;
 eventDate: string;
 venue: string;
 status: string;
}

interface Judge {
 id: string;
 name: string;
 email: string;
 phone?: string;
 assignmentId: string;
 displayOrder: number;
}

interface EventWithJudges extends Event {
 judges: Judge[];
}

export default function JudgeAssignmentsPage() {
 const [clientSession, setClientSession] = useState<ClientSession | null>(null);
 const [events, setEvents] = useState<EventWithJudges[]>([]);
 const [availableJudges, setAvailableJudges] = useState<any[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
 const [showAddJudgeModal, setShowAddJudgeModal] = useState(false);
 const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
 const router = useRouter();
 const { success, error } = useToast();

 useEffect(() => {
 const session = localStorage.getItem('clientSession');
 if (!session) {
 router.push('/portal/client');
 return;
 }

 try {
 const parsedSession = JSON.parse(session);
 if (parsedSession.userType !== 'client') {
 router.push('/portal/client');
 return;
 }
 setClientSession(parsedSession);
 loadData();
 } catch {
 router.push('/portal/client');
 }
 }, [router]);

 const loadData = async () => {
 setIsLoading(true);
 try {
 // Load events
 const eventsRes = await fetch('/api/events');
 if (eventsRes.ok) {
 const eventsData = await eventsRes.json();
 if (eventsData.success) {
 const allEvents = eventsData.events || [];
 
 // Filter events based on staff permissions
 let filteredEvents = allEvents;
 if (clientSession && !clientSession.canViewAllEvents && clientSession.allowedEventIds.length > 0) {
 filteredEvents = allEvents.filter((e: Event) => clientSession.allowedEventIds.includes(e.id)
 );
 }

 // Load judges for each event
 const eventsWithJudges = await Promise.all(
 filteredEvents.map(async (event: Event) => {
 try {
 const teamsRes = await fetch(`/api/events/${event.id}/teams`);
 if (teamsRes.ok) {
 const teamsData = await teamsRes.json();
 if (teamsData.success) {
 return {
 ...event,
 judges: teamsData.teams.judges || []
 };
 }
 }
 } catch (err) {
 console.error(`Error loading judges for event ${event.id}:`, err);
 }
 return {
 ...event,
 judges: []
 };
 })
 );

 setEvents(eventsWithJudges);
 }
 }

 // Load available judges
 const judgesRes = await fetch('/api/users?userType=judge');
 if (judgesRes.ok) {
 const judgesData = await judgesRes.json();
 if (judgesData.success) {
 setAvailableJudges(judgesData.users || []);
 }
 }
 } catch (err) {
 console.error('Error loading data:', err);
 error('Failed to load events and judges');
 } finally {
 setIsLoading(false);
 }
 };

 const handleAddJudge = async (judgeId: string) => {
 if (!selectedEventId || !clientSession) {
 error('Invalid event or session');
 return;
 }

 try {
 const response = await fetch(`/api/events/${selectedEventId}/teams/judges`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 judgeId,
 assignedBy: clientSession.id
 })
 });

 const data = await response.json();
 if (data.success) {
 success('Judge assigned successfully');
 setShowAddJudgeModal(false);
 setSelectedEventId(null);
 loadData();
 } else {
 error(data.error || 'Failed to assign judge');
 }
 } catch (err) {
 console.error('Error assigning judge:', err);
 error('Failed to assign judge');
 }
 };

 const handleRemoveJudge = async (eventId: string, judgeId: string) => {
 if (!confirm('Are you sure you want to remove this judge from the event?')) {
 return;
 }

 try {
 const response = await fetch(`/api/events/${eventId}/teams/judges?judgeId=${judgeId}`, {
 method: 'DELETE',
 });

 const data = await response.json();
 if (data.success) {
 success('Judge removed successfully');
 loadData();
 } else {
 error(data.error || 'Failed to remove judge');
 }
 } catch (err) {
 console.error('Error removing judge:', err);
 error('Failed to remove judge');
 }
 };

 const openAddJudgeModal = (eventId: string) => {
 setSelectedEventId(eventId);
 setShowAddJudgeModal(true);
 };

 const getAvailableJudgesForEvent = (eventId: string) => {
 const event = events.find(e => e.id === eventId);
 if (!event) return [];
 
 const assignedJudgeIds = event.judges.map(j => j.id);
 return availableJudges.filter(j => !assignedJudgeIds.includes(j.id));
 };

 if (isLoading) {
 return (
 <div className="min-h-screen avalon-mesh flex items-center justify-center">
 <div className="text-center">
 <div className="animate-spin rounded-full h-16 w-16 border-2 border-[rgba(192,192,192,0.2)] border-t-[var(--chrome-mid)] mx-auto mb-4"></div>
 <p className="text-gray-300">Loading judge assignments...</p>
 </div>
 </div> );
 }

 if (!clientSession) {
 return null;
 }

 return (
 <div className="min-h-screen avalon-mesh"> {/* Header */}
 <div className="glass-panel backdrop-blur-sm border-b border-[rgba(192,192,192,0.15)]/20">
 <div className="container mx-auto px-4 py-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center space-x-4">
 <Link
 href="/client-dashboard" className="text-gray-400 hover:text-white transition-colors" >
  Back to Dashboard
 </Link>
 <div className="w-12 h-12 btn-chrome !rounded-full rounded-full flex items-center justify-center">
 <span className="text-xl font-display text-white">J</span>
 </div>
 <div>
 <h1 className="font-display text-2xl chrome-text leading-none">Judge Assignments</h1>
 <p className="text-gray-400 text-sm mt-1"> Manage judge assignments for events
 </p>
 </div>
 </div>
 <div className="flex items-center space-x-4">
 <span className="text-gray-400 text-sm"> {clientSession.name}
 </span>
 <button
 onClick={() => {
 localStorage.removeItem('clientSession');
 router.push('/portal/client');
 }}
 className="btn-outline-chrome !px-4 !py-2" >
 Logout
 </button>
 </div>
 </div>
 </div>
 </div>  <div className="container mx-auto px-4 py-8"> {events.length === 0 ? (
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] p-8 text-center">
 <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center mx-auto mb-4">
 <span className="text-2xl"></span>
 </div>
 <h3 className="text-xl font-bold text-white mb-2">No Events Available</h3>
 <p className="text-gray-400"> {clientSession.canViewAllEvents
 ? 'No events have been created yet.'
 : 'You do not have access to any events yet. Please contact the administrator.'}
 </p>
 </div> ) : (
 <div className="space-y-4"> {events.map((event) => (
 <div
 key={event.id}
 className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] p-6" >
 <div className="flex items-center justify-between mb-4">
 <div className="flex-1">
 <div className="flex items-center space-x-3 mb-2">
 <h2 className="text-xl font-bold text-white">{event.name}</h2>
 <span className="px-2 py-1 bg-[rgba(192,192,192,0.08)] text-[var(--chrome-light)] rounded text-xs"> {event.status}
 </span>
 </div>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-400">
 <div>
 <span className="font-medium">Date:</span>{' '}
 <span className="text-white"> {new Date(event.eventDate).toLocaleDateString()}
 </span>
 </div>
 <div>
 <span className="font-medium">Venue:</span>{' '}
 <span className="text-white">{event.venue}</span>
 </div>
 <div>
 <span className="font-medium">Region:</span>{' '}
 <span className="text-white">{event.region}</span>
 </div>
 <div>
 <span className="font-medium">Judges:</span>{' '}
 <span className="text-white">{event.judges.length}</span>
 </div>
 </div>
 </div>
 <button
 onClick={() => setExpandedEventId(
 expandedEventId === event.id ? null : event.id
 )}
 className="ml-4 btn-chrome !px-4 !py-2" >
 {expandedEventId === event.id ? 'Hide' : 'View'} Judges
 </button>
 </div> {expandedEventId === event.id && (
 <div className="mt-4 pt-4 border-t border-[rgba(192,192,192,0.15)]/20">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-lg font-semibold text-white"> Assigned Judges ({event.judges.length})</h3>
 <button
 onClick={() => openAddJudgeModal(event.id)}
 className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm" disabled={getAvailableJudgesForEvent(event.id).length === 0}
 > + Add Judge
 </button>
 </div> {event.judges.length === 0 ? (
 <div className="text-center py-8 text-gray-400">
 <p>No judges assigned to this event yet.</p> {getAvailableJudgesForEvent(event.id).length > 0 && (
 <button
 onClick={() => openAddJudgeModal(event.id)}
 className="mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm" >
 Add First Judge
 </button> )}
 </div> ) : (
 <div className="space-y-2"> {event.judges
 .sort((a, b) => a.displayOrder - b.displayOrder)
 .map((judge, index) => (
 <div
 key={judge.id}
 className="bg-black/40 rounded-lg p-4 flex items-center justify-between" >
 <div className="flex items-center space-x-4">
 <div className="w-10 h-10 btn-chrome !rounded-full rounded-full flex items-center justify-center text-[#050505] font-bold"> {index + 1}
 </div>
 <div>
 <div className="text-white font-medium">{judge.name}</div>
 <div className="text-gray-400 text-sm">{judge.email}</div> {judge.phone && (
 <div className="text-gray-400 text-sm">{judge.phone}</div> )}
 </div>
 </div>
 <button
 onClick={() => handleRemoveJudge(event.id, judge.id)}
 className="px-3 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition-colors text-sm" >
 Remove
 </button>
 </div> ))}
 </div> )}
 </div> )}
 </div> ))}
 </div> )}
 </div> {/* Add Judge Modal */}
 {showAddJudgeModal && selectedEventId && (
 <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
 <div className="bg-gray-800 rounded-xl border border-[rgba(192,192,192,0.22)] p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-xl font-bold text-white">Add Judge to Event</h3>
 <button
 onClick={() => {
 setShowAddJudgeModal(false);
 setSelectedEventId(null);
 }}
 className="text-gray-400 hover:text-white transition-colors" >
 ✕
 </button>
 </div>  <div className="mb-4">
 <label className="block text-sm font-medium text-gray-300 mb-2"> Select Judge
 </label> {getAvailableJudgesForEvent(selectedEventId).length === 0 ? (
 <div className="text-center py-8 text-gray-400">
 <p>All available judges are already assigned to this event.</p>
 </div> ) : (
 <div className="space-y-2 max-h-64 overflow-y-auto"> {getAvailableJudgesForEvent(selectedEventId).map((judge) => (
 <button
 key={judge.id}
 onClick={() => handleAddJudge(judge.id)}
 className="w-full text-left bg-black/40 hover:bg-black/40 rounded-lg p-4 transition-colors" >
 <div className="text-white font-medium">{judge.name}</div>
 <div className="text-gray-400 text-sm">{judge.email}</div> {judge.phone && (
 <div className="text-gray-400 text-sm">{judge.phone}</div> )}
 </button> ))}
 </div> )}
 </div>  <div className="flex justify-end space-x-3">
 <button
 onClick={() => {
 setShowAddJudgeModal(false);
 setSelectedEventId(null);
 }}
 className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors" >
 Cancel
 </button>
 </div>
 </div>
 </div> )}
 </div> );
}

