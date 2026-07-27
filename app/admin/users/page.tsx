'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/simple-toast';
import { useAlert } from '@/components/ui/custom-alert';
import { ThemeProvider, useTheme, getThemeClasses } from '@/components/providers/ThemeProvider';
import { usePhase2Feature } from '@/hooks/usePhase2Feature';
import type { User } from '@/lib/types';
import { Users, ArrowLeft, Plus, Calendar, UserCheck, Building2 } from 'lucide-react';

export default function UsersPage() {
 return (
 <ThemeProvider>
 <UsersPageContent />
 </ThemeProvider> );
}

function UsersPageContent() {
 const { theme } = useTheme();
 const themeClasses = getThemeClasses(theme);
 const { isEnabled: isPhase2Enabled } = usePhase2Feature();
 const router = useRouter();
 const { success, error, warning } = useToast();
 const { showAlert, showConfirm } = useAlert();
 
 const [users, setUsers] = useState<User[]>([]);
 const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [searchTerm, setSearchTerm] = useState('');
 const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'judge' | 'staff' | 'admin' | 'superadmin'>('all');
 
 // Create/Edit user modal state
 const [showUserModal, setShowUserModal] = useState(false);
 const [editingUser, setEditingUser] = useState<User | null>(null);
 const [userForm, setUserForm] = useState({
 name: '',
 email: '',
 phone: '',
 password: '',
 userType: 'judge' as 'judge' | 'staff' | 'admin' | 'superadmin',
 staffPermissions: {
 announcer: false,
 backstage: false,
 media: false,
 runner: false,
 eventViewer: false,
 scoreApprover: false,
 judgeAccess: false
 }
 });
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [currentUser, setCurrentUser] = useState<User | null>(null);
 
 useEffect(() => {
 const session = localStorage.getItem('adminSession');
 if (!session) {
 router.push('/portal/admin');
 return;
 }
 
 try {
 const adminData = JSON.parse(session);
 if (!adminData.isAdmin) {
 router.push('/judge/dashboard');
 return;
 }
 // Get current user info
 fetchCurrentUser(adminData.id);
 } catch {
 router.push('/portal/admin');
 }
 
 fetchUsers();
 }, [router]);
 
 const fetchCurrentUser = async (userId: string) => {
 try {
 const response = await fetch(`/api/users/${userId}`, {
 headers: {
 'Authorization': `Bearer ${userId}`
 }
 });
 const data = await response.json();
 if (data.success) {
 setCurrentUser(data.user);
 }
 } catch (err) {
 console.error('Error fetching current user:', err);
 }
 };
 
 const fetchUsers = async () => {
 setIsLoading(true);
 try {
 // Fetch regular users
 const usersResponse = await fetch('/api/users');
 const usersData = await usersResponse.json();
 
 // Fetch staff accounts (clients)
 const clientsResponse = await fetch('/api/clients');
 const clientsData = await clientsResponse.json();
 
 let allUsers: User[] = [];
 
 if (usersData.success) {
 allUsers = [...usersData.users];
 }
 
 // Transform clients to User format
 if (clientsData.success && clientsData.clients) {
 const staffUsers: User[] = clientsData.clients.map((client: any) => ({
 id: client.id,
 name: client.name,
 email: client.email,
 phone: client.phone || '',
 password: '', // Don't expose password
 userType: 'staff' as const,
 isAdmin: false,
 role: 'staff' as any, // Map to a staff role
 staffPermissions: {
 // Map allowedDashboards to staffPermissions
 announcer: client.allowedDashboards?.includes('announcer-dashboard') || false,
 backstage: client.allowedDashboards?.includes('backstage-dashboard') || false,
 media: client.allowedDashboards?.includes('media-dashboard') || false,
 runner: false, // Not in dashboard list
 eventViewer: client.allowedDashboards?.includes('event-dashboard') || false,
 scoreApprover: false, // Not in dashboard list
 judgeAccess: client.allowedDashboards?.includes('judge-dashboard') || false
 },
 createdAt: client.createdAt,
 // Store client-specific data
 isClientAccount: true,
 isActive: client.isActive,
 isApproved: client.isApproved,
 lastLoginAt: client.lastLoginAt,
 allowedDashboards: client.allowedDashboards || []
 }));
 
 allUsers = [...allUsers, ...staffUsers];
 }
 
 setUsers(allUsers);
 setFilteredUsers(allUsers);
 } catch (err) {
 console.error('Error fetching users:', err);
 error('Failed to load users');
 } finally {
 setIsLoading(false);
 }
 };
 
 useEffect(() => {
 let filtered = users;
 
 // Filter by search term
 if (searchTerm) {
 filtered = filtered.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
 u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
 (u.phone && u.phone.includes(searchTerm))
 );
 }
 
 // Filter by userType
 if (userTypeFilter !== 'all') {
 filtered = filtered.filter(u => u.userType === userTypeFilter);
 }
 
 setFilteredUsers(filtered);
 }, [searchTerm, userTypeFilter, users]);
 
 const handleCreateUser = () => {
 setEditingUser(null);
 setUserForm({
 name: '',
 email: '',
 phone: '',
 password: '',
 userType: 'judge',
 staffPermissions: {
 announcer: false,
 backstage: false,
 media: false,
 runner: false,
 eventViewer: false,
 scoreApprover: false,
 judgeAccess: false
 }
 });
 setShowUserModal(true);
 };
 
 const handleEditUser = (user: User) => {
 setEditingUser(user);
 setUserForm({
 name: user.name,
 email: user.email,
 phone: user.phone || '',
 password: '', // Don't pre-fill password
 userType: user.userType,
 staffPermissions: user.staffPermissions ? {
 announcer: user.staffPermissions.announcer ?? false,
 backstage: user.staffPermissions.backstage ?? false,
 media: user.staffPermissions.media ?? false,
 runner: user.staffPermissions.runner ?? false,
 eventViewer: user.staffPermissions.eventViewer ?? false,
 scoreApprover: user.staffPermissions.scoreApprover ?? false,
 judgeAccess: user.staffPermissions.judgeAccess ?? false
 } : {
 announcer: false,
 backstage: false,
 media: false,
 runner: false,
 eventViewer: false,
 scoreApprover: false,
 judgeAccess: false
 }
 });
 setShowUserModal(true);
 };
 
 const handleDeleteUser = (user: User) => {
 if (user.id === currentUser?.id) {
 warning('You cannot delete your own account');
 return;
 }
 
 showConfirm(
 `Are you sure you want to delete user "${user.name}"? This action cannot be undone.`,
 async () => {
 try {
 const session = localStorage.getItem('adminSession');
 if (!session) {
 error('Session expired. Please log in again.');
 return;
 }
 
 const adminData = JSON.parse(session);
 const response = await fetch(`/api/users/${user.id}`, {
 method: 'DELETE',
 headers: {
 'Authorization': `Bearer ${adminData.id}`
 }
 });
 
 const data = await response.json();
 if (data.success) {
 success(`User "${user.name}" deleted successfully`);
 fetchUsers();
 } else {
 error(data.error || 'Failed to delete user');
 }
 } catch (err) {
 console.error('Error deleting user:', err);
 error('Failed to delete user');
 }
 }
 );
 };
 
 const handleSubmitUser = async () => {
 // Validation
 if (!userForm.name || !userForm.email) {
 showAlert('Name and email are required', 'warning');
 return;
 }
 
 if (!editingUser && !userForm.password) {
 showAlert('Password is required for new users', 'warning');
 return;
 }
 
 if (userForm.password && userForm.password.length < 6) {
 showAlert('Password must be at least 6 characters long', 'warning');
 return;
 }
 
 setIsSubmitting(true);
 try {
 const session = localStorage.getItem('adminSession');
 if (!session) {
 error('Session expired. Please log in again.');
 return;
 }
 
 const adminData = JSON.parse(session);
 const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
 const method = editingUser ? 'PUT' : 'POST';
 
 const body: any = {
 name: userForm.name,
 email: userForm.email,
 phone: userForm.phone || undefined,
 userType: userForm.userType,
 staffPermissions: userForm.userType === 'staff' ? userForm.staffPermissions : undefined
 };
 
 if (userForm.password) {
 body.password = userForm.password;
 }
 
 const response = await fetch(url, {
 method,
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${adminData.id}`
 },
 body: JSON.stringify(body)
 });
 
 const data = await response.json();
 if (data.success) {
 success(editingUser ? 'User updated successfully' : 'User created successfully');
 setShowUserModal(false);
 fetchUsers();
 // Refresh current user if editing self
 if (editingUser && editingUser.id === currentUser?.id) {
 fetchCurrentUser(adminData.id);
 }
 } else {
 error(data.error || 'Failed to save user');
 }
 } catch (err) {
 console.error('Error saving user:', err);
 error('Failed to save user');
 } finally {
 setIsSubmitting(false);
 }
 };
 
 // Check if current user is superadmin (by role or email)
 const canManageAdmins = currentUser?.role === 'superadmin' || 
 (currentUser?.email && ['gabriel@elementscentral.com', 'info@upstreamcreatives.co.za', 'mains@elementscentral.com', 'admin@eodsa.com'].includes(currentUser.email.toLowerCase()));
 
 return (
 <div className={`min-h-screen avalon-shell ${themeClasses.mainBg} ${themeClasses.textPrimary}`}>
 {/* Admin chrome header — same shell as /admin */}
 <header className={`${themeClasses.headerBg} backdrop-blur-lg shadow-xl border-b ${themeClasses.headerBorder}`}>
 <div className="avalon-container">
 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-3 sm:py-6 gap-3 sm:gap-4">
 <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
 <img src="/brand/avalon-logo.png" alt="Avalon" className="w-9 h-9 sm:w-12 sm:h-12 object-contain flex-shrink-0" />
 <div className="min-w-0 flex-1">
 <h1 className={`text-lg sm:text-2xl lg:text-3xl font-display ${themeClasses.accentGradientText} leading-tight tracking-[0.08em]`}>Avalon Admin</h1>
 <p className={`${themeClasses.textSecondary} text-xs sm:text-sm font-medium truncate`}>User Management · <span className="brand-duo-text">Elements of Dance SA</span></p>
 </div>
 </div>
 <Link href="/admin" className="btn-outline-chrome !py-2 !px-4 avalon-tap self-start sm:self-auto">
 <ArrowLeft className="w-3.5 h-3.5" />
 <span className="sm:inline">Back</span>
 </Link>
 </div>
 </div>
 </header>

 <div className="avalon-container avalon-section">
 {/* Tab navigation — mirrors /admin so Users stays in the same shell */}
 <div className={`${themeClasses.navBg} backdrop-blur-sm rounded-xl sm:rounded-2xl p-2 sm:p-4 mb-6 sm:mb-8 shadow-xl border ${themeClasses.navBorder}`}>
 <nav className="avalon-tabs">
 {[
 { id: 'events', label: 'Events', href: '/admin', icon: Calendar },
 { id: 'users', label: 'Users', href: '/admin/users', icon: Users, active: true },
 { id: 'assignments', label: 'Assignments', href: '/admin', icon: UserCheck },
 { id: 'dancers', label: 'Dancers', href: '/admin', icon: Users },
 { id: 'studios', label: 'Studios', href: '/admin', icon: Building2 },
 ].map((tab) => {
 const Icon = tab.icon;
 return (
 <Link
 key={tab.id}
 href={tab.href}
 className={`avalon-tab gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-semibold transition-all duration-300 text-sm sm:text-base ${
 tab.active
 ? 'btn-chrome !rounded-xl shadow-lg'
 : `${themeClasses.textSecondary} hover:bg-black/40 hover:shadow-md`
 }`}
 >
 <Icon className="w-4 h-4" strokeWidth={1.75} />
 <span>{tab.label}</span>
 </Link>
 );
 })}
 </nav>
 </div>

 <div className={`${themeClasses.cardBg} border ${themeClasses.cardBorder} ${themeClasses.cardRadius} ${themeClasses.cardShadow} overflow-hidden mb-6`}>
 <div className={`px-4 sm:px-6 py-4 sm:py-5 border-b ${themeClasses.cardBorder}`}>
 <h2 className="font-display text-xl sm:text-2xl chrome-text leading-none flex items-center gap-3">
 <Users className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--chrome-mid)]" strokeWidth={1.75} />
 User Management
 </h2>
 <p className={`${themeClasses.textMuted} mt-2 text-xs sm:text-sm`}>
 Create and manage all system users (judges, staff, admins)
 </p>
 </div>
 <div className="p-4 sm:p-6 border-b border-[rgba(192,192,192,0.12)]">
 <div className="flex flex-col md:flex-row gap-3 sm:gap-4 items-stretch md:items-center justify-between">
 <div className="flex flex-1 flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
 <input
 type="text" placeholder="Search users..." value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className={`flex-1 min-h-[44px] px-4 py-2.5 border ${themeClasses.inputBorder} ${themeClasses.inputBg} ${themeClasses.textPrimary} rounded-lg focus:outline-none ${themeClasses.inputFocus} placeholder:text-[#8a8a8a]`}
 />
 <select
 value={userTypeFilter}
 onChange={(e) => setUserTypeFilter(e.target.value as any)}
 className={`min-h-[44px] px-4 py-2.5 border ${themeClasses.inputBorder} ${themeClasses.inputBg} ${themeClasses.textPrimary} rounded-lg focus:outline-none ${themeClasses.inputFocus}`}
 >
 <option value="all">All Types</option>
 <option value="judge">Judges</option>
 <option value="staff">Staff</option>
 <option value="admin">Admins</option>
 <option value="superadmin">Super Admins</option>
 </select>
 </div>
 <button
 onClick={() => {
 if (!isPhase2Enabled) {
 alert('This feature is temporarily unavailable.');
 return;
 }
 handleCreateUser();
 }}
 disabled={!isPhase2Enabled}
 className={`btn-chrome avalon-tap w-full md:w-auto justify-center ${!isPhase2Enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
 title={!isPhase2Enabled ? 'This feature is temporarily unavailable.' : ''}
 >
 <Plus className="w-4 h-4" />
 Create User
 </button>
 </div>
 </div>
 </div>

 {/* Users List */}
 <div> {isLoading ? (
 <div className="text-center py-12">
 <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[rgba(192,192,192,0.2)] border-t-[var(--chrome-mid)]"></div>
 <p className="mt-4 text-[var(--muted-foreground)]">Loading users...</p>
 </div> ) : filteredUsers.length === 0 ? (
 <div className="text-center py-12">
 <p className="text-[var(--muted-foreground)]">No users found</p>
 </div> ) : (
 <div className="overflow-x-auto avalon-scroll-x -mx-0">
 <table className="min-w-[720px] w-full divide-y divide-[rgba(192,192,192,0.1)]">
 <thead className={`${themeClasses.headerBg}`}>
 <tr>
 <th className={`px-6 py-3 text-left text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}> Name
 </th>
 <th className={`px-6 py-3 text-left text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}> Email
 </th>
 <th className={`px-6 py-3 text-left text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}> Phone
 </th>
 <th className={`px-6 py-3 text-left text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}> Type / Permissions
 </th>
 <th className={`px-6 py-3 text-left text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}> Status
 </th>
 <th className={`px-6 py-3 text-left text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}> Last Login
 </th>
 <th className={`px-6 py-3 text-left text-xs font-medium ${themeClasses.textMuted} uppercase tracking-wider`}> Actions
 </th>
 </tr>
 </thead>
 <tbody className={`${themeClasses.cardBg} divide-y divide-[rgba(192,192,192,0.1)]`}> {filteredUsers.map((user) => {
 const isClientAccount = (user as any).isClientAccount;
 const userStatus = isClientAccount 
 ? ((user as any).isActive && (user as any).isApproved ? 'Active' : 'Inactive')
 : 'Active';
 
 // Get dashboard permissions for staff accounts
 const dashboardPermissions = isClientAccount && (user as any).allowedDashboards
 ? (user as any).allowedDashboards.map((d: string) => d.replace('-dashboard', ''))
 : [];
 
 return (
 <tr key={user.id} className="hover:bg-[rgba(192,192,192,0.04)]">
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="text-sm font-medium">{user.name}</div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="text-sm text-[var(--muted-foreground)]">{user.email}</div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="text-sm text-[var(--muted-foreground)]">{user.phone || '-'}</div>
 </td>
 <td className="px-6 py-4">
 <div className="flex flex-col gap-1">
 <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${
 user.userType === 'superadmin' ? 'bg-[rgba(184,150,62,0.2)] text-[#d4c07a] border-[rgba(184,150,62,0.35)]' :
 user.userType === 'admin' ? 'bg-[rgba(139,58,58,0.3)] text-[#f0c4c4] border-[rgba(139,58,58,0.4)]' :
 user.userType === 'staff' ? 'bg-[rgba(61,92,74,0.35)] text-[#9bb5a6] border-[rgba(107,143,122,0.35)]' :
 'bg-[rgba(0,230,255,0.12)] text-[#a8e8f5] border-[rgba(0,230,255,0.3)]'
 }`}> {user.userType}
 </span> {dashboardPermissions.length > 0 && (
 <div className="flex flex-wrap gap-1 mt-1"> {dashboardPermissions.map((perm: string) => (
 <span key={perm} className="px-2 py-0.5 text-xs bg-[rgba(192,192,192,0.08)] border border-[rgba(192,192,192,0.2)] rounded capitalize"> {perm}
 </span> ))}
 </div> )}
 {user.userType === 'staff' && !isClientAccount && user.staffPermissions && (
 <div className="flex flex-wrap gap-1 mt-1"> {Object.entries(user.staffPermissions).map(([key, value]) => value && (
 <span key={key} className="px-2 py-0.5 text-xs bg-[rgba(192,192,192,0.08)] border border-[rgba(192,192,192,0.2)] rounded capitalize"> {key}
 </span> )
 )}
 </div> )}
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
 userStatus === 'Active' 
 ? 'bg-[rgba(61,92,74,0.35)] text-[#9bb5a6] border border-[rgba(107,143,122,0.35)]'
 : 'bg-[rgba(139,58,58,0.3)] text-[#f0c4c4] border border-[rgba(139,58,58,0.4)]'
 }`}> {userStatus}
 </span>
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="text-sm text-[var(--muted-foreground)]"> {(user as any).lastLoginAt 
 ? new Date((user as any).lastLoginAt).toLocaleDateString()
 : 'Never'
 }
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
 <div className="flex gap-2"> {isClientAccount ? (
 <>
 <button
 onClick={async () => {
 const newStatus = !((user as any).isActive && (user as any).isApproved);
 try {
 const response = await fetch('/api/clients', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 id: user.id,
 name: user.name,
 email: user.email,
 phone: user.phone,
 allowedDashboards: (user as any).allowedDashboards || [],
 isActive: newStatus,
 isApproved: newStatus
 })
 });
 const data = await response.json();
 if (data.success) {
 success(`Staff ${newStatus ? 'activated' : 'deactivated'}`);
 fetchUsers();
 } else {
 error(data.error || 'Failed to update staff');
 }
 } catch (err) {
 error('Network error');
 }
 }}
 className={`px-3 py-1 text-xs rounded ${
 userStatus === 'Active'
 ? 'bg-[rgba(139,58,58,0.3)] text-[#f0c4c4] border border-[rgba(139,58,58,0.4)]'
 : 'bg-[rgba(61,92,74,0.35)] text-[#9bb5a6] border border-[rgba(107,143,122,0.35)]'
 }`}
 > {userStatus === 'Active' ? 'Deactivate' : 'Activate'}
 </button>
 <button
 onClick={() => {
 showConfirm(
 'Are you sure you want to delete this staff account? This action cannot be undone.',
 async () => {
 try {
 const response = await fetch(`/api/clients?id=${user.id}`, {
 method: 'DELETE'
 });
 const data = await response.json();
 if (data.success) {
 success('Staff account deleted successfully');
 fetchUsers();
 } else {
 error(data.error || 'Failed to delete staff account');
 }
 } catch (err) {
 error('Network error');
 }
 }
 );
 }}
 className="px-3 py-1 text-xs rounded bg-[rgba(139,58,58,0.3)] text-[#f0c4c4] border border-[rgba(139,58,58,0.4)]" >
 Delete
 </button>
 </> ) : (
 <>
 <button
 onClick={() => handleEditUser(user)}
 className="px-3 py-1 bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded text-sm font-medium transition-colors" >
 Edit
 </button>
 <button
 onClick={() => handleDeleteUser(user)}
 className="px-3 py-1 bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded text-sm font-medium transition-colors" >
 Delete
 </button>
 </> )}
 </div>
 </td>
 </tr> );
 })}
 </tbody>
 </table>
 </div> )}
 </div> {/* Create/Edit User Modal */}
 {showUserModal && (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
 <div className={`${themeClasses.headerBg} rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
 <div className="p-6 border-b border-gray-200 dark:border-[rgba(192,192,192,0.15)]">
 <h2 className="text-2xl font-bold"> {editingUser ? 'Edit User' : 'Create User'}</h2>
 </div>  <div className="p-6 space-y-4"> {/* Basic Fields */}
 <div>
 <label className="block text-sm font-medium mb-1">Name *</label>
 <input
 type="text" value={userForm.name}
 onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
 className={`w-full px-4 py-2 border ${themeClasses.cardBorder} ${themeClasses.cardBg} rounded-lg focus:outline-none focus:ring-[3px] focus:ring-[rgba(192,192,192,0.12)] focus:border-[rgba(192,192,192,0.5)]`}
 />
 </div>  <div>
 <label className="block text-sm font-medium mb-1">Email *</label>
 <input
 type="email" value={userForm.email}
 onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
 className={`w-full px-4 py-2 border ${themeClasses.cardBorder} ${themeClasses.cardBg} rounded-lg focus:outline-none focus:ring-[3px] focus:ring-[rgba(192,192,192,0.12)] focus:border-[rgba(192,192,192,0.5)]`}
 />
 </div>  <div>
 <label className="block text-sm font-medium mb-1">Phone</label>
 <input
 type="tel" value={userForm.phone}
 onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
 className={`w-full px-4 py-2 border ${themeClasses.cardBorder} ${themeClasses.cardBg} rounded-lg focus:outline-none focus:ring-[3px] focus:ring-[rgba(192,192,192,0.12)] focus:border-[rgba(192,192,192,0.5)]`}
 />
 </div>  <div>
 <label className="block text-sm font-medium mb-1"> {editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}
 </label>
 <input
 type="password" value={userForm.password}
 onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
 className={`w-full px-4 py-2 border ${themeClasses.cardBorder} ${themeClasses.cardBg} rounded-lg focus:outline-none focus:ring-[3px] focus:ring-[rgba(192,192,192,0.12)] focus:border-[rgba(192,192,192,0.5)]`}
 />
 </div> {/* User Type */}
 <div>
 <label className="block text-sm font-medium mb-1">User Type *</label>
 <select
 value={userForm.userType}
 onChange={(e) => {
 const newType = e.target.value as 'judge' | 'staff' | 'admin' | 'superadmin';
 setUserForm({ 
 ...userForm, 
 userType: newType,
 staffPermissions: newType === 'staff' 
 ? (userForm.staffPermissions || {
 announcer: false,
 backstage: false,
 media: false,
 runner: false,
 eventViewer: false,
 scoreApprover: false,
 judgeAccess: false
 })
 : undefined as any
 });
 }}
 disabled={!canManageAdmins && (userForm.userType === 'admin' || userForm.userType === 'superadmin')}
 className={`w-full px-4 py-2 border ${themeClasses.cardBorder} ${themeClasses.cardBg} rounded-lg focus:outline-none focus:ring-[3px] focus:ring-[rgba(192,192,192,0.12)] focus:border-[rgba(192,192,192,0.5)]`}
 >
 <option value="judge">Judge</option>
 <option value="staff">Staff</option> {canManageAdmins && (
 <>
 <option value="admin">Admin</option>
 <option value="superadmin">Super Admin</option>
 </> )}
 </select> {!canManageAdmins && (userForm.userType === 'admin' || userForm.userType === 'superadmin') && (
 <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1"> Only superadmins can create/manage admin accounts
 </p> )}
 </div> {/* Staff Permissions */}
 {userForm.userType === 'staff' && (
 <div className="border-t border-gray-200 dark:border-[rgba(192,192,192,0.15)] pt-4 mt-4">
 <label className="block text-sm font-medium mb-3">Staff Permissions</label>
 <div className="space-y-2"> {[
 { key: 'announcer', label: 'Announcer' },
 { key: 'backstage', label: 'Backstage' },
 { key: 'media', label: 'Media' },
 { key: 'runner', label: 'Runner' },
 { key: 'eventViewer', label: 'Event Viewer' },
 { key: 'scoreApprover', label: 'Score Approver' },
 { key: 'judgeAccess', label: 'Judge Access (only if intentionally checked)' }
 ].map(({ key, label }) => (
 <label key={key} className="flex items-center gap-2">
 <input
 type="checkbox" checked={(userForm.staffPermissions && userForm.staffPermissions[key as keyof typeof userForm.staffPermissions]) || false}
 onChange={(e) => {
 const currentPermissions = userForm.staffPermissions || {
 announcer: false,
 backstage: false,
 media: false,
 runner: false,
 eventViewer: false,
 scoreApprover: false,
 judgeAccess: false
 };
 setUserForm({
 ...userForm,
 staffPermissions: {
 ...currentPermissions,
 [key]: e.target.checked
 }
 });
 }}
 className="w-4 h-4" />
 <span className="text-sm">{label}</span>
 </label> ))}
 </div>
 </div> )}
 
 {/* Admin/Superadmin Info */}
 {userForm.userType === 'admin' && (
 <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
 <p className="text-sm text-blue-800 dark:text-blue-200">
 <strong>Admin access:</strong> Full system access
 </p>
 </div> )}
 
 {userForm.userType === 'superadmin' && (
 <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
 <p className="text-sm text-purple-800 dark:text-purple-200">
 <strong>Super Admin access:</strong> Can delete admins, promote/demote admins, manage system-wide settings.
 </p>
 </div> )}
 </div>  <div className="p-6 border-t border-gray-200 dark:border-[rgba(192,192,192,0.15)] flex justify-end gap-3">
 <button
 onClick={() => setShowUserModal(false)}
 className="px-4 py-2 bg-[rgba(192,192,192,0.08)] border border-[rgba(192,192,192,0.2)] hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors" >
 Cancel
 </button>
 <button
 onClick={handleSubmitUser}
 disabled={isSubmitting}
 className="px-4 py-2 btn-chrome !rounded-full font-medium transition-colors disabled:opacity-50" >
 {isSubmitting ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
 </button>
 </div>
 </div>
 </div> )}
 </div>
 </div>
 );
}

