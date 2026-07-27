'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/simple-toast';
import { useAlert } from '@/components/ui/custom-alert';
import { ThemeProvider, useTheme, getThemeClasses } from '@/components/providers/ThemeProvider';

interface Judge {
 id: string;
 name: string;
 email: string;
 phone?: string;
 assignmentId: string;
 displayOrder: number;
}

interface Staff {
 id: string;
 name: string;
 email: string;
 phone?: string;
 assignmentId: string;
 eventRole: 'announcer' | 'backstage' | 'media' | 'runner' | 'score_approver';
 staffPermissions?: any;
}

interface Admin {
 id: string;
 name: string;
 email: string;
 phone?: string;
 userType: 'admin' | 'superadmin';
}

export default function EventTeamsPage() {
 return (
 <ThemeProvider>
 <EventTeamsPageContent />
 </ThemeProvider> );
}

function EventTeamsPageContent() {
 const { theme } = useTheme();
 const themeClasses = getThemeClasses(theme);
 const params = useParams();
 const router = useRouter();
 const eventId = params?.id as string;
 
 const { success, error } = useToast();
 const { showAlert, showConfirm } = useAlert();
 
 const [event, setEvent] = useState<any>(null);
 const [judges, setJudges] = useState<Judge[]>([]);
 const [staff, setStaff] = useState<Staff[]>([]);
 const [admins, setAdmins] = useState<Admin[]>([]);
 const [availableJudges, setAvailableJudges] = useState<any[]>([]);
 const [availableStaff, setAvailableStaff] = useState<any[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [activeSection, setActiveSection] = useState<'judges' | 'staff' | 'admins'>('judges');
 
 // Modals
 const [showAddJudgeModal, setShowAddJudgeModal] = useState(false);
 const [showAddStaffModal, setShowAddStaffModal] = useState(false);
 const [selectedStaffRole, setSelectedStaffRole] = useState<'announcer' | 'backstage' | 'media' | 'runner' | 'score_approver'>('announcer');
 
 useEffect(() => {
 const session = localStorage.getItem('adminSession');
 if (!session) {
 router.push('/portal/admin');
 return;
 }
 
 if (eventId) {
 loadData();
 }
 }, [eventId, router]);
 
 const loadData = async () => {
 setIsLoading(true);
 try {
 // Load event
 const eventRes = await fetch(`/api/events/${eventId}`);
 if (eventRes.ok) {
 const eventData = await eventRes.json();
 setEvent(eventData.event);
 }
 
 // Load teams
 const teamsRes = await fetch(`/api/events/${eventId}/teams`);
 if (teamsRes.ok) {
 const teamsData = await teamsRes.json();
 if (teamsData.success) {
 setJudges(teamsData.teams.judges || []);
 setStaff(teamsData.teams.staff || []);
 setAdmins(teamsData.teams.admins || []);
 }
 }
 
 // Load available users
 const usersRes = await fetch('/api/users');
 if (usersRes.ok) {
 const usersData = await usersRes.json();
 if (usersData.success) {
 setAvailableJudges(usersData.users.filter((u: any) => u.userType === 'judge'));
 setAvailableStaff(usersData.users.filter((u: any) => u.userType === 'staff'));
 }
 }
 } catch (err) {
 console.error('Error loading data:', err);
 error('Failed to load event teams');
 } finally {
 setIsLoading(false);
 }
 };
 
 const handleAddJudge = async (judgeId: string) => {
 try {
 const session = localStorage.getItem('adminSession');
 if (!session) {
 error('Session expired');
 return;
 }
 
 const adminData = JSON.parse(session);
 const response = await fetch(`/api/events/${eventId}/teams/judges`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${adminData.id}`
 },
 body: JSON.stringify({
 judgeId,
 assignedBy: adminData.id
 })
 });
 
 const data = await response.json();
 if (data.success) {
 success('Judge added successfully');
 setShowAddJudgeModal(false);
 loadData();
 } else {
 error(data.error || 'Failed to add judge');
 }
 } catch (err) {
 console.error('Error adding judge:', err);
 error('Failed to add judge');
 }
 };
 
 const handleRemoveJudge = async (judgeId: string) => {
 showConfirm(
 'Are you sure you want to remove this judge from the event?',
 async () => {
 try {
 const response = await fetch(`/api/events/${eventId}/teams/judges?judgeId=${judgeId}`, {
 method: 'DELETE'
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
 }
 );
 };
 
 const handleReorderJudges = async (newOrder: string[]) => {
 try {
 const response = await fetch(`/api/events/${eventId}/teams/judges/reorder`, {
 method: 'PUT',
 headers: {
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({ judgeIds: newOrder })
 });
 
 const data = await response.json();
 if (data.success) {
 success('Judge order updated');
 loadData();
 } else {
 error(data.error || 'Failed to reorder judges');
 }
 } catch (err) {
 console.error('Error reordering judges:', err);
 error('Failed to reorder judges');
 }
 };
 
 const handleAddStaff = async (staffId: string, eventRole: string) => {
 try {
 const session = localStorage.getItem('adminSession');
 if (!session) {
 error('Session expired');
 return;
 }
 
 const adminData = JSON.parse(session);
 const response = await fetch(`/api/events/${eventId}/teams/staff`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${adminData.id}`
 },
 body: JSON.stringify({
 staffId,
 eventRole,
 assignedBy: adminData.id
 })
 });
 
 const data = await response.json();
 if (data.success) {
 success('Staff assigned successfully');
 setShowAddStaffModal(false);
 loadData();
 } else {
 error(data.error || 'Failed to assign staff');
 }
 } catch (err) {
 console.error('Error assigning staff:', err);
 error('Failed to assign staff');
 }
 };
 
 const handleRemoveStaff = async (staffId: string, eventRole: string) => {
 showConfirm(
 'Are you sure you want to remove this staff member from the event?',
 async () => {
 try {
 const response = await fetch(`/api/events/${eventId}/teams/staff?staffId=${staffId}&eventRole=${eventRole}`, {
 method: 'DELETE'
 });
 
 const data = await response.json();
 if (data.success) {
 success('Staff removed successfully');
 loadData();
 } else {
 error(data.error || 'Failed to remove staff');
 }
 } catch (err) {
 console.error('Error removing staff:', err);
 error('Failed to remove staff');
 }
 }
 );
 };
 
 if (isLoading) {
 return (
 <div className={`min-h-screen ${themeClasses.mainBg} flex items-center justify-center`}>
 <div className="text-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
 <p className="text-gray-600 dark:text-gray-400">Loading event teams...</p>
 </div>
 </div> );
 }
 
 const assignedJudgeIds = new Set(judges.map(j => j.id));
 const unassignedJudges = availableJudges.filter(j => !assignedJudgeIds.has(j.id));
 
 return (
 <div className={`min-h-screen ${themeClasses.mainBg}`}> {/* Header */}
 <div className={`${themeClasses.headerBg} border-b ${themeClasses.headerBorder} p-6`}>
 <div className="flex justify-between items-center">
 <div>
 <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">Event Teams</h1>
 <p className="text-gray-600 dark:text-gray-400 mt-1">{event?.name || 'Loading...'}</p>
 </div>
 <div className="flex items-center space-x-4">
 <Link
 href={`/admin/events/${eventId}`}
 className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold transition-colors" >
  Back to Event
 </Link>
 </div>
 </div>
 </div> {/* Tabs */}
 <div className={`${themeClasses.headerBg} border-b ${themeClasses.headerBorder}`}>
 <div className="flex space-x-1 p-4">
 <button
 onClick={() => setActiveSection('judges')}
 className={`px-6 py-2 rounded-lg font-medium transition-colors ${
 activeSection === 'judges'
 ? 'bg-blue-600 text-white'
 : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
 }`}
 > Judges ({judges.length})
 </button>
 <button
 onClick={() => setActiveSection('staff')}
 className={`px-6 py-2 rounded-lg font-medium transition-colors ${
 activeSection === 'staff'
 ? 'bg-blue-600 text-white'
 : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
 }`}
 > Staff ({staff.length})
 </button>
 <button
 onClick={() => setActiveSection('admins')}
 className={`px-6 py-2 rounded-lg font-medium transition-colors ${
 activeSection === 'admins'
 ? 'bg-blue-600 text-white'
 : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
 }`}
 > Admins ({admins.length})
 </button>
 </div>
 </div> {/* Content */}
 <div className="p-6"> {/* Judges Section */}
 {activeSection === 'judges' && (
 <div className="space-y-4">
 <div className="flex justify-between items-center">
 <h2 className="text-xl font-semibold">Judges</h2>
 <button
 onClick={() => setShowAddJudgeModal(true)}
 className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors" >
 + Add Judge
 </button>
 </div> {judges.length === 0 ? (
 <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
 <p className="text-gray-600 dark:text-gray-400">No judges assigned to this event</p>
 </div> ) : (
 <div className="space-y-2"> {judges
 .sort((a, b) => a.displayOrder - b.displayOrder)
 .map((judge, index) => (
 <div
 key={judge.id}
 className={`${themeClasses.cardBg} border ${themeClasses.cardBorder} rounded-lg p-4 flex justify-between items-center`}
 >
 <div className="flex items-center gap-4">
 <span className="text-gray-400 dark:text-gray-600 font-bold text-lg"> {index + 1}
 </span>
 <div>
 <h3 className="font-semibold">{judge.name}</h3>
 <p className="text-sm text-gray-600 dark:text-gray-400">{judge.email}</p>
 </div>
 </div>
 <button
 onClick={() => handleRemoveJudge(judge.id)}
 className="px-3 py-1 bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded text-sm font-medium transition-colors" >
 Remove
 </button>
 </div> ))}
 </div> )}
 </div> )}
 
 {/* Staff Section */}
 {activeSection === 'staff' && (
 <div className="space-y-4">
 <div className="flex justify-between items-center">
 <h2 className="text-xl font-semibold">Staff</h2>
 <button
 onClick={() => setShowAddStaffModal(true)}
 className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors" >
 + Assign Staff
 </button>
 </div> {staff.length === 0 ? (
 <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
 <p className="text-gray-600 dark:text-gray-400">No staff assigned to this event</p>
 </div> ) : (
 <div className="space-y-2"> {staff.map((s) => (
 <div
 key={`${s.id}-${s.eventRole}`}
 className={`${themeClasses.cardBg} border ${themeClasses.cardBorder} rounded-lg p-4 flex justify-between items-center`}
 >
 <div>
 <h3 className="font-semibold">{s.name}</h3>
 <p className="text-sm text-gray-600 dark:text-gray-400">{s.email}</p>
 <span className="inline-block mt-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-medium"> {s.eventRole}
 </span>
 </div>
 <button
 onClick={() => handleRemoveStaff(s.id, s.eventRole)}
 className="px-3 py-1 bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded text-sm font-medium transition-colors" >
 Remove
 </button>
 </div> ))}
 </div> )}
 </div> )}
 
 {/* Admins Section */}
 {activeSection === 'admins' && (
 <div className="space-y-4">
 <h2 className="text-xl font-semibold">Admins</h2>
 <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
 <p className="text-sm text-blue-800 dark:text-blue-200"> Admins and Superadmins automatically have access to all events. They do not require assignment.
 </p>
 </div> {admins.length === 0 ? (
 <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
 <p className="text-gray-600 dark:text-gray-400">No admins in the system</p>
 </div> ) : (
 <div className="space-y-2"> {admins.map((admin) => (
 <div
 key={admin.id}
 className={`${themeClasses.cardBg} border ${themeClasses.cardBorder} rounded-lg p-4`}
 >
 <div className="flex items-center justify-between">
 <div>
 <h3 className="font-semibold">{admin.name}</h3>
 <p className="text-sm text-gray-600 dark:text-gray-400">{admin.email}</p>
 </div>
 <span className={`px-2 py-1 rounded text-xs font-medium ${
 admin.userType === 'superadmin'
 ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
 : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
 }`}> {admin.userType}
 </span>
 </div>
 </div> ))}
 </div> )}
 </div> )}
 </div> {/* Add Judge Modal */}
 {showAddJudgeModal && (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
 <div className={`${themeClasses.cardBg} rounded-lg shadow-xl max-w-md w-full`}>
 <div className="p-6 border-b border-gray-200 dark:border-[rgba(192,192,192,0.15)]">
 <h2 className="text-2xl font-bold">Add Judge</h2>
 </div>
 <div className="p-6 max-h-96 overflow-y-auto"> {unassignedJudges.length === 0 ? (
 <p className="text-gray-600 dark:text-gray-400">No available judges to add</p> ) : (
 <div className="space-y-2"> {unassignedJudges.map((judge) => (
 <button
 key={judge.id}
 onClick={() => handleAddJudge(judge.id)}
 className="w-full text-left p-3 border border-gray-200 dark:border-[rgba(192,192,192,0.15)] rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" >
 <div className="font-medium">{judge.name}</div>
 <div className="text-sm text-gray-600 dark:text-gray-400">{judge.email}</div>
 </button> ))}
 </div> )}
 </div>
 <div className="p-6 border-t border-gray-200 dark:border-[rgba(192,192,192,0.15)] flex justify-end">
 <button
 onClick={() => setShowAddJudgeModal(false)}
 className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors" >
 Cancel
 </button>
 </div>
 </div>
 </div> )}
 
 {/* Add Staff Modal */}
 {showAddStaffModal && (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
 <div className={`${themeClasses.cardBg} rounded-lg shadow-xl max-w-md w-full`}>
 <div className="p-6 border-b border-gray-200 dark:border-[rgba(192,192,192,0.15)]">
 <h2 className="text-2xl font-bold">Assign Staff</h2>
 </div>
 <div className="p-6 space-y-4">
 <div>
 <label className="block text-sm font-medium mb-2">Event Role</label>
 <select
 value={selectedStaffRole}
 onChange={(e) => setSelectedStaffRole(e.target.value as any)}
 className={`w-full px-4 py-2 border ${themeClasses.cardBorder} ${themeClasses.cardBg} rounded-lg`}
 >
 <option value="announcer">Announcer</option>
 <option value="backstage">Backstage</option>
 <option value="media">Media</option>
 <option value="runner">Runner</option>
 <option value="score_approver">Score Approver</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium mb-2">Staff Member</label>
 <div className="space-y-2 max-h-64 overflow-y-auto"> {availableStaff.map((s) => (
 <button
 key={s.id}
 onClick={() => handleAddStaff(s.id, selectedStaffRole)}
 className="w-full text-left p-3 border border-gray-200 dark:border-[rgba(192,192,192,0.15)] rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" >
 <div className="font-medium">{s.name}</div>
 <div className="text-sm text-gray-600 dark:text-gray-400">{s.email}</div>
 </button> ))}
 </div>
 </div>
 </div>
 <div className="p-6 border-t border-gray-200 dark:border-[rgba(192,192,192,0.15)] flex justify-end">
 <button
 onClick={() => setShowAddStaffModal(false)}
 className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors" >
 Cancel
 </button>
 </div>
 </div>
 </div> )}
 </div> );
}

