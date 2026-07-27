'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/simple-toast';
import { AdminAccessSplash, useRequireAdminSession } from '@/hooks/useRequireAdminSession';

interface ActivityLog {
 id: string;
 at: string;
 category: string;
 action: string;
 summary: string;
 actor?: string | null;
}

export default function BackendLogsPage() {
 const { error } = useToast();
 const { authorized, checking, admin } = useRequireAdminSession();

 const [logs, setLogs] = useState<ActivityLog[]>([]);
 const [loading, setLoading] = useState(true);
 const [loadError, setLoadError] = useState<string | null>(null);
 const [categoryFilter, setCategoryFilter] = useState<string>('all');

 useEffect(() => {
 if (!authorized) return;
 loadLogs();
 }, [authorized]);

 const loadLogs = async () => {
 setLoading(true);
 setLoadError(null);
 const controller = new AbortController();
 const timeoutId = setTimeout(() => controller.abort(), 12000);
 try {
 const adminId = admin?.id || '';
 const res = await fetch(
 `/api/admin/activity-logs?limit=100&adminId=${encodeURIComponent(adminId || '')}`,
 { signal: controller.signal }
 );
 const data = await res.json();
 if (!res.ok || data.success === false) {
 throw new Error(data.error || 'Failed to load logs');
 }
 setLogs(Array.isArray(data.logs) ? data.logs : []);
 } catch (err: any) {
 console.error(err);
 setLogs([]);
 if (err?.name === 'AbortError') {
 setLoadError('Timed out loading logs. Tap Try again.');
 } else {
 setLoadError(err?.message || 'Failed to load logs');
 error(err?.message || 'Failed to load logs');
 }
 } finally {
 clearTimeout(timeoutId);
 setLoading(false);
 }
 };

 const categories = Array.from(new Set(logs.map((l) => l.category))).sort();
 const filtered =
 categoryFilter === 'all' ? logs : logs.filter((l) => l.category === categoryFilter);

 if (checking || !authorized) {
 return <AdminAccessSplash />;
 }

 return (
 <div className="min-h-screen avalon-mesh">
 <div className="glass-panel backdrop-blur-sm border-b border-[rgba(192,192,192,0.22)]">
 <div className="container mx-auto px-4 py-6">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <Link href="/backend" className="text-sm text-gray-400 hover:text-[var(--chrome-light)] transition-colors"> Backend
 </Link>
 <span className="text-gray-600">·</span>
 <Link href="/admin" className="text-sm text-gray-400 hover:text-[var(--chrome-light)] transition-colors"> Admin
 </Link>
 </div>
 <h1 className="text-3xl font-bold chrome-text"> System Logs</h1>
 <p className="text-gray-300 text-sm mt-1"> App-wide activity: qualifications, score edits, payments, archives
 </p>
 </div>
 <button
 type="button" onClick={loadLogs}
 className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors self-start sm:self-auto" >
 ↻ Refresh
 </button>
 </div>
 </div>
 </div>  <div className="container mx-auto px-4 py-6 space-y-6">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] p-5">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-gray-400 text-sm">Log entries</p>
 <p className="text-3xl font-bold text-white">{loading ? '—' : logs.length}</p>
 </div>
 <div className="text-4xl"></div>
 </div>
 </div>
 <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] p-5">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-gray-400 text-sm">Categories</p>
 <p className="text-3xl font-bold text-indigo-300"> {loading ? '—' : categories.length}
 </p>
 </div>
 <div className="text-4xl"></div>
 </div>
 </div>
 </div>  <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] p-4">
 <label className="block text-sm font-medium text-gray-300 mb-2">Filter by category</label>
 <select
 value={categoryFilter}
 onChange={(e) => setCategoryFilter(e.target.value)}
 className="w-full sm:w-64 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-[3px] focus:ring-[rgba(192,192,192,0.12)]" >
 <option value="all">All categories</option> {categories.map((cat) => (
 <option key={cat} value={cat}> {cat}
 </option> ))}
 </select> {!loading && (
 <p className="text-xs text-gray-500 mt-2"> Showing {filtered.length} of {logs.length} entries
 </p> )}
 </div>  <div className="glass-panel rounded-xl border border-[rgba(192,192,192,0.22)] overflow-hidden">
 <div className="p-6 border-b border-[rgba(192,192,192,0.22)]">
 <h2 className="text-xl font-bold text-white">Activity</h2>
 </div> {loading ? (
 <div className="p-12 text-center">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--chrome-mid)] mx-auto mb-4" />
 <p className="text-gray-300">Loading logs…</p>
 </div> ) : loadError ? (
 <div className="p-12 text-center space-y-4">
 <p className="text-red-300">{loadError}</p>
 <button
 type="button" onClick={loadLogs}
 className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors" >
 Try again
 </button>
 </div> ) : filtered.length === 0 ? (
 <div className="p-12 text-center">
 <div className="text-6xl mb-4"></div>
 <p className="text-gray-300 text-lg">No log entries found</p>
 </div> ) : (
 <div className="divide-y divide-purple-500/20 max-h-[70vh] overflow-y-auto"> {filtered.map((log) => (
 <div key={log.id} className="px-6 py-4 hover:bg-purple-500/5 transition-colors">
 <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
 <div className="min-w-0">
 <div className="flex items-center gap-2 mb-1 flex-wrap">
 <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[rgba(192,192,192,0.08)] text-[var(--chrome-light)] border border-[rgba(192,192,192,0.22)]"> {log.category}
 </span>
 <span className="text-xs font-mono text-gray-500">{log.action}</span>
 </div>
 <p className="text-sm text-white">{log.summary}</p> {log.actor && (
 <p className="text-xs text-gray-500 mt-1">By {log.actor}</p> )}
 </div>
 <time className="text-xs text-gray-500 tabular-nums shrink-0"> {log.at ? new Date(log.at).toLocaleString() : ''}
 </time>
 </div>
 </div> ))}
 </div> )}
 </div>
 </div>
 </div> );
}
