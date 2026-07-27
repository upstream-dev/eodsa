'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/simple-toast';
import { ThemeProvider, useTheme, getThemeClasses } from '@/components/providers/ThemeProvider';
import { ClipboardCheck, RefreshCw, Hourglass, CheckCircle2, Search as SearchIcon, X } from 'lucide-react';

interface JudgeScore {
 judgeId: string;
 judgeName: string;
 scoreId: string;
 technicalScore: number;
 musicalScore: number;
 performanceScore: number;
 stylingScore: number;
 overallImpressionScore: number;
 total: number;
 comments: string;
 submittedAt: string;
}

interface PerformanceApproval {
 performanceId: string;
 performanceTitle: string;
 eventId: string;
 totalJudges: number;
 scoredJudges: number;
 judgeScores: JudgeScore[];
 averageScore: number;
 percentage: number;
 medal: string | { type: string; label: string; color: string; bgColor: string; borderColor: string; emoji: string };
 status: 'pending' | 'published';
 scoresPublished: boolean;
}

function ScoringApprovalPageContent() {
 const router = useRouter();
 const { theme } = useTheme();
 const themeClasses = getThemeClasses(theme);
 const { success, error } = useToast();
 const [user, setUser] = useState<any>(null);
 const [approvals, setApprovals] = useState<PerformanceApproval[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [statusFilter, setStatusFilter] = useState<string>('pending');
 const [searchTerm, setSearchTerm] = useState('');
 const [processingPublish, setProcessingPublish] = useState<Set<string>>(new Set());
 const [selectedApproval, setSelectedApproval] = useState<PerformanceApproval | null>(null);
 const [showDetails, setShowDetails] = useState(false);
 const [editingJudgeScore, setEditingJudgeScore] = useState<JudgeScore | null>(null);
 const [editedScoreValues, setEditedScoreValues] = useState<any>(null);
 const [editingTotal, setEditingTotal] = useState<number | null>(null);

 useEffect(() => {
 // Check admin authentication
 const session = localStorage.getItem('adminSession');
 if (!session) {
 router.push('/portal/admin');
 return;
 }

 try {
 const userData = JSON.parse(session);
 setUser(userData);
 if (!userData.isAdmin) {
 router.push('/portal/admin');
 return;
 }
 fetchApprovals();
 } catch (err) {
 router.push('/portal/admin');
 }
 }, [router]);

 const fetchApprovals = async () => {
 setIsLoading(true);
 try {
 const response = await fetch('/api/scores/approve');
 const data = await response.json();
 if (data.success) {
 setApprovals(data.approvals || []);
 }
 } catch (error) {
 console.error('Error fetching score approvals:', error);
 } finally {
 setIsLoading(false);
 }
 };

 const publishScores = async (performanceId: string, performanceTitle: string) => {
 if (processingPublish.has(performanceId)) return;

 setProcessingPublish(prev => new Set(prev).add(performanceId));

 try {
 const response = await fetch('/api/scores/approve', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 performanceId,
 approvedBy: user.id,
 action: 'publish'
 })
 });

 if (response.ok) {
 success(`Scores for "${performanceTitle}" published successfully`);
 await fetchApprovals(); // Refresh the list
 setShowDetails(false);
 } else {
 error('Failed to publish scores');
 }
 } catch (err) {
 console.error('Error publishing scores:', err);
 error('Failed to publish scores');
 } finally {
 setProcessingPublish(prev => {
 const newSet = new Set(prev);
 newSet.delete(performanceId);
 return newSet;
 });
 }
 };

 const regenerateCertificate = async (performanceId: string, performanceTitle: string) => {
 if (processingPublish.has(performanceId)) return;

 setProcessingPublish(prev => new Set(prev).add(performanceId));

 try {
 const response = await fetch('/api/certificates/regenerate', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 performanceId,
 forceRegenerate: true
 })
 });

 const data = await response.json();

 if (response.ok && data.success) {
 success(`Certificate for "${performanceTitle}" regenerated successfully!`);
 await fetchApprovals(); // Refresh the list
 } else {
 error(data.error || 'Failed to regenerate certificate');
 }
 } catch (err) {
 console.error('Error regenerating certificate:', err);
 error('Failed to regenerate certificate');
 } finally {
 setProcessingPublish(prev => {
 const newSet = new Set(prev);
 newSet.delete(performanceId);
 return newSet;
 });
 }
 };

 const openDetails = (approval: PerformanceApproval) => {
 setSelectedApproval(approval);
 setShowDetails(true);
 setEditingJudgeScore(null);
 setEditingTotal(null);
 };

 const startEditingJudgeScore = (judgeScore: JudgeScore) => {
 setEditingJudgeScore(judgeScore);
 setEditingTotal(judgeScore.total);
 };

 const cancelEditing = () => {
 setEditingJudgeScore(null);
 setEditingTotal(null);
 };

 const saveEditedJudgeScore = async () => {
 if (!editingJudgeScore || editingTotal === null || !selectedApproval) return;

 // Validate total
 if (editingTotal < 0 || editingTotal > 100) {
 error('Total score must be between 0 and 100');
 return;
 }

 try {
 const response = await fetch('/api/scores/edit-total', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 scoreId: editingJudgeScore.scoreId,
 performanceId: selectedApproval.performanceId,
 judgeId: editingJudgeScore.judgeId,
 newTotal: editingTotal,
 editedBy: user.id,
 editedByName: user.name
 })
 });

 if (response.ok) {
 success('Score total updated successfully');
 setEditingJudgeScore(null);
 setEditingTotal(null);
 await fetchApprovals(); // Refresh the list
 setShowDetails(false);
 } else {
 const result = await response.json();
 error(result.error || 'Failed to update score');
 }
 } catch (err) {
 console.error('Error updating score:', err);
 error('Failed to update score');
 }
 };

 const filteredApprovals = approvals.filter(approval => {
 const matchesStatus = statusFilter === 'all' ||
 (statusFilter === 'pending' && !approval.scoresPublished) ||
 (statusFilter === 'published' && approval.scoresPublished);

 const matchesSearch = searchTerm === '' ||
 approval.performanceTitle.toLowerCase().includes(searchTerm.toLowerCase());

 return matchesStatus && matchesSearch;
 });

 const pendingCount = approvals.filter(a => !a.scoresPublished).length;
 const publishedCount = approvals.filter(a => a.scoresPublished).length;

 const getMedalColor = (medal: string) => {
 const colors: Record<string, string> = {
 'Elite': 'from-yellow-600 to-yellow-800',
 'Opus': 'from-yellow-500 to-yellow-700',
 'Legend': 'from-yellow-400 to-yellow-600',
 'Gold': 'from-yellow-300 to-yellow-500',
 'Silver+': 'from-slate-300 to-slate-500',
 'Silver': 'from-gray-400 to-gray-600',
 'Bronze': 'from-amber-500 to-amber-700',
 };
 return colors[medal] || 'from-gray-400 to-gray-600';
 };

 if (isLoading) {
 return (
 <div className={`min-h-screen ${themeClasses.loadingBg} flex items-center justify-center`}>
 <div className="text-center">
 <div className={`animate-spin rounded-full h-12 w-12 border-2 border-[rgba(192,192,192,0.2)] border-t-[var(--chrome-mid)] mx-auto`}></div>
 <p className={`mt-4 ${themeClasses.loadingText}`}>Loading scoring approvals...</p>
 </div>
 </div> );
 }

 const inputClass = `w-full min-h-[44px] px-3 py-2.5 rounded-lg border ${themeClasses.inputBorder} ${themeClasses.inputBg} ${themeClasses.textPrimary} ${themeClasses.inputFocus} text-base placeholder:text-[#8a8a8a]`;

 return (
 <div className={`min-h-screen avalon-shell ${themeClasses.mainBg}`}>
 <div className={`${themeClasses.headerBg} border-b ${themeClasses.headerBorder} shadow`}>
 <div className="avalon-container">
 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-3 sm:py-6 gap-3 sm:gap-4">
 <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
 <div className={`w-10 h-10 sm:w-12 sm:h-12 ${themeClasses.iconContainer} ${themeClasses.cardRadius} flex items-center justify-center flex-shrink-0`}>
 <ClipboardCheck className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--chrome-mid)]" strokeWidth={1.75} />
 </div>
 <div className="min-w-0">
 <h1 className={`font-display text-lg sm:text-2xl chrome-text leading-none`}>Score Approval Dashboard</h1>
 <p className={`text-xs sm:text-sm ${themeClasses.textSecondary} hidden sm:block mt-1`}>Review & publish aggregated performance scores</p>
 </div>
 </div>
 <div className="flex items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
 <button
 onClick={() => router.push('/admin')}
 className={`flex-1 sm:flex-none avalon-tap ${themeClasses.buttonBase} ${themeClasses.buttonSecondary}`}
 > Back
 </button>
 <button
 onClick={fetchApprovals}
 className={`flex-1 sm:flex-none avalon-tap inline-flex items-center justify-center gap-2 ${themeClasses.buttonBase} ${themeClasses.buttonPrimary}`}
 >
 <RefreshCw className="w-3.5 h-3.5" /> Refresh
 </button>
 </div>
 </div>
 </div>
 </div>

 <div className="avalon-container avalon-section">
 <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
 <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} ${themeClasses.cardShadow} p-3 sm:p-6 border ${themeClasses.metricCardBorder}`}>
 <div className="flex items-center">
 <div className={`w-8 h-8 ${themeClasses.badgeBlue} ${themeClasses.cardRadius} flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0`}>
 <ClipboardCheck className="w-4 h-4 text-[#a8e8f5]" strokeWidth={1.75} />
 </div>
 <div className="min-w-0">
 <p className={`text-xs sm:text-sm font-medium ${themeClasses.textSecondary} truncate`}>Total</p>
 <p className={`text-xl sm:text-2xl font-semibold ${themeClasses.textPrimary}`}>{approvals.length}</p>
 </div>
 </div>
 </div>
 <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} ${themeClasses.cardShadow} p-3 sm:p-6 border ${themeClasses.metricCardBorder}`}>
 <div className="flex items-center">
 <div className={`w-8 h-8 ${themeClasses.badgeYellow} ${themeClasses.cardRadius} flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0`}>
 <Hourglass className="w-4 h-4 text-[#c4b87a]" strokeWidth={1.75} />
 </div>
 <div className="min-w-0">
 <p className={`text-xs sm:text-sm font-medium ${themeClasses.textSecondary} truncate`}>Pending</p>
 <p className={`text-xl sm:text-2xl font-semibold ${themeClasses.textPrimary}`}>{pendingCount}</p>
 </div>
 </div>
 </div>
 <div className={`${themeClasses.metricCardBg} ${themeClasses.cardRadius} ${themeClasses.cardShadow} p-3 sm:p-6 border ${themeClasses.metricCardBorder}`}>
 <div className="flex items-center">
 <div className={`w-8 h-8 ${themeClasses.badgeGreen} ${themeClasses.cardRadius} flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0`}>
 <CheckCircle2 className="w-4 h-4 text-[#9bb5a6]" strokeWidth={1.75} />
 </div>
 <div className="min-w-0">
 <p className={`text-xs sm:text-sm font-medium ${themeClasses.textSecondary} truncate`}>Published</p>
 <p className={`text-xl sm:text-2xl font-semibold ${themeClasses.textPrimary}`}>{publishedCount}</p>
 </div>
 </div>
 </div>
 </div>

 <div className={`${themeClasses.cardBg} ${themeClasses.cardRadius} ${themeClasses.cardShadow} p-4 sm:p-6 mb-6 sm:mb-8 border ${themeClasses.cardBorder}`}>
 <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
 <div className="flex-1">
 <label className={`block ${themeClasses.label} mb-2`}>Search</label>
 <div className="relative">
 <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a8a8a]" />
 <input
 type="text" value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 placeholder="Search performance..." className={`${inputClass} pl-10`} />
 </div>
 </div>
 <div className="w-full sm:w-auto">
 <label className={`block ${themeClasses.label} mb-2`}>Status</label>
 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 className={`${inputClass} sm:min-w-[160px]`} >
 <option value="pending">Pending</option>
 <option value="published">Published</option>
 <option value="all">All</option>
 </select>
 </div>
 </div>
 </div>

 <div className={`${themeClasses.cardBg} ${themeClasses.cardRadius} ${themeClasses.cardShadow} border ${themeClasses.cardBorder} overflow-hidden`}>
 <div className={`px-6 py-4 border-b ${themeClasses.cardBorder}`}>
 <h2 className={`text-lg font-semibold ${themeClasses.textPrimary}`}>Performance Scores ({filteredApprovals.length} performances)</h2>
 </div>
 {filteredApprovals.length > 0 ? (
 <div className={`divide-y divide-[rgba(192,192,192,0.12)]`}>
 {filteredApprovals.map((approval) => (
 <div key={approval.performanceId} className={`p-4 sm:p-6 ${
 approval.scoresPublished ? 'bg-[rgba(61,92,74,0.12)]' : ''
 }`}>
 <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-2 flex-wrap">
 <h3 className={`text-lg sm:text-xl font-bold ${themeClasses.textPrimary}`}>{approval.performanceTitle}</h3>
 <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
 approval.scoresPublished ? themeClasses.badgeGreen : themeClasses.badgeYellow
 }`}> {approval.scoresPublished ? 'PUBLISHED' : 'PENDING'}
 </span>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
 <div className={`bg-gradient-to-r ${getMedalColor(typeof approval.medal === 'string' ? approval.medal : approval.medal.label)} rounded-lg p-4 text-center`}>
 <p className="text-xs font-semibold text-white mb-1">FINAL SCORE</p>
 <p className="text-3xl sm:text-4xl font-bold text-white"> {approval.averageScore.toFixed(2)}
 <span className="text-lg sm:text-xl">/100</span>
 </p>
 <p className="text-xs text-white mt-1">{approval.percentage.toFixed(1)}%</p>
 </div>
 <div className={`bg-gradient-to-r ${getMedalColor(typeof approval.medal === 'string' ? approval.medal : approval.medal.label)} rounded-lg p-4 text-center`}>
 <p className="text-xs font-semibold text-white mb-1">MEDAL</p>
 <p className="text-3xl sm:text-4xl font-bold text-white"> {typeof approval.medal === 'string' ? approval.medal : approval.medal.label}
 </p>
 <p className="text-xs text-white mt-1">{approval.totalJudges} judges scored</p>
 </div>
 </div>
 <div className={`rounded-lg p-3 mb-2 border ${themeClasses.cardBorder} bg-black/30`}>
 <p className={`text-xs font-semibold ${themeClasses.textPrimary} mb-2`}>Judge Scores:</p>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2"> {approval.judgeScores.map((js) => (
 <div key={js.judgeId} className={`rounded p-2 text-center border ${themeClasses.cardBorder} bg-black/40`}>
 <div className="font-bold text-[var(--electric-cyan)] text-lg">{js.total}/100</div>
 <div className={`${themeClasses.textSecondary} text-xs truncate font-medium`}>{js.judgeName}</div>
 </div> ))}
 </div>
 </div>
 </div>
 <div className="flex flex-row sm:flex-col items-center justify-between sm:justify-start gap-2 sm:ml-4">
 <button
 onClick={() => openDetails(approval)}
 className={`${themeClasses.buttonBase} ${themeClasses.buttonSecondary} whitespace-nowrap`} >
 View Details
 </button> {!approval.scoresPublished && (
 <button
 onClick={() => publishScores(approval.performanceId, approval.performanceTitle)}
 disabled={processingPublish.has(approval.performanceId)}
 className={`${themeClasses.buttonBase} ${themeClasses.buttonSuccess} ${processingPublish.has(approval.performanceId) ? themeClasses.buttonDisabled : ''} whitespace-nowrap`} >
 {processingPublish.has(approval.performanceId) ? 'Publishing...' : 'Publish Scores'}
 </button> )}
 {approval.scoresPublished && (
 <button
 onClick={() => regenerateCertificate(approval.performanceId, approval.performanceTitle)}
 disabled={processingPublish.has(approval.performanceId)}
 className={`btn-chrome !px-4 !py-2 whitespace-nowrap ${processingPublish.has(approval.performanceId) ? 'opacity-50' : ''}`} title="Regenerate certificate (useful if template was uploaded after publishing)" >
 {processingPublish.has(approval.performanceId) ? 'Regenerating...' : 'Regenerate Cert'}
 </button> )}
 </div>
 </div>
 </div> ))}
 </div> ) : (
 <div className="p-8 text-center">
 <ClipboardCheck className="w-10 h-10 mx-auto mb-4 text-[var(--chrome-mid)] opacity-60" strokeWidth={1.5} />
 <p className={`font-medium ${themeClasses.textPrimary}`}>No performances found for the selected filter</p>
 <p className={`text-sm ${themeClasses.textSecondary} mt-2`}>Performances appear here when all assigned judges have submitted their scores</p>
 </div> )}
 </div>
 </div>

 {showDetails && selectedApproval && (
 <div className={`fixed inset-0 ${themeClasses.modalOverlay} flex items-center justify-center p-2 sm:p-4 z-50`}>
 <div className={`${themeClasses.modalBg} rounded-xl shadow-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto border ${themeClasses.modalBorder}`}>
 <div className={`px-4 sm:px-6 py-3 sm:py-4 border-b ${themeClasses.modalBorder} flex justify-between items-center sticky top-0 ${themeClasses.modalBg} z-10`}>
 <h3 className={`text-base sm:text-xl font-semibold ${themeClasses.textPrimary} pr-4`}> {selectedApproval.performanceTitle}</h3>
 <button
 onClick={() => setShowDetails(false)}
 className={`${themeClasses.textMuted} hover:text-white flex-shrink-0 p-2`} >
 <X className="w-5 h-5" />
 </button>
 </div>
 <div className="p-4 sm:p-6">
 <div className={`bg-gradient-to-r ${getMedalColor(typeof selectedApproval.medal === 'string' ? selectedApproval.medal : selectedApproval.medal.label)} rounded-xl p-6 mb-6 text-center text-white`}>
 <p className="text-sm font-semibold mb-2">FINAL AVERAGE SCORE</p>
 <p className="text-5xl font-bold"> {selectedApproval.averageScore.toFixed(2)}
 <span className="text-2xl">/100</span>
 </p>
 <p className="text-lg mt-2">{selectedApproval.percentage.toFixed(1)}% • {typeof selectedApproval.medal === 'string' ? selectedApproval.medal : selectedApproval.medal.label}</p>
 <p className="text-sm mt-1 opacity-90">Averaged from {selectedApproval.totalJudges} judges</p>
 </div>
 <div className="space-y-4">
 <h4 className={`text-lg font-bold ${themeClasses.textPrimary}`}>Individual Judge Scores</h4> {selectedApproval.judgeScores.map((judgeScore) => (
 <div key={judgeScore.judgeId} className={`rounded-lg p-4 border ${themeClasses.cardBorder} bg-black/30`}>
 <div className="flex justify-between items-center mb-3">
 <div>
 <h5 className={`font-bold text-base ${themeClasses.textPrimary}`}>{judgeScore.judgeName}</h5>
 <p className={`text-sm ${themeClasses.textSecondary}`}>Submitted: {new Date(judgeScore.submittedAt).toLocaleString()}</p>
 </div>
 <div className="flex items-center gap-2">
 <div className="text-right">
 <p className="text-2xl font-bold text-[var(--electric-cyan)]">{judgeScore.total}/100</p>
 </div> {!selectedApproval.scoresPublished && editingJudgeScore?.judgeId !== judgeScore.judgeId && (
 <button
 onClick={() => startEditingJudgeScore(judgeScore)}
 className="btn-chrome !px-3 !py-1 !text-[10px]" >
 Edit
 </button> )}
 </div>
 </div> {editingJudgeScore?.judgeId === judgeScore.judgeId && editingTotal !== null ? (
 <div className={`space-y-3 p-4 rounded border border-[rgba(0,230,255,0.35)] bg-black/40`}>
 <p className="text-sm font-semibold text-[var(--electric-cyan)]">Editing {judgeScore.judgeName}'s Total Score</p>
 <div>
 <label className={`block ${themeClasses.label} mb-2`}>Total Score (0-100)</label>
 <input
 type="number" min="0" max="100" step="0.1" value={editingTotal}
 onChange={(e) => setEditingTotal(Number(e.target.value))}
 className={`${inputClass} text-lg font-bold text-center`} autoFocus
 />
 <p className={`text-xs ${themeClasses.textMuted} mt-1`}> Original score: {judgeScore.total}/100 • Category scores will be adjusted proportionally
 </p>
 </div>
 <div className="flex gap-2 mt-3">
 <button
 onClick={saveEditedJudgeScore}
 className={`flex-1 ${themeClasses.buttonBase} ${themeClasses.buttonSuccess}`} >
 Save Total
 </button>
 <button
 onClick={cancelEditing}
 className={`flex-1 ${themeClasses.buttonBase} ${themeClasses.buttonSecondary}`} >
 Cancel
 </button>
 </div>
 </div> ) : (
 <div className="grid grid-cols-5 gap-2 text-xs">
 {[
 ['Tech', judgeScore.technicalScore],
 ['Music', judgeScore.musicalScore],
 ['Perf', judgeScore.performanceScore],
 ['Style', judgeScore.stylingScore],
 ['Overall', judgeScore.overallImpressionScore],
 ].map(([label, val]) => (
 <div key={String(label)} className={`text-center rounded p-2 border ${themeClasses.cardBorder} bg-black/40`}>
 <div className="font-bold text-[var(--chrome-light)]">{val}/20</div>
 <div className={themeClasses.textMuted}>{label}</div>
 </div>
 ))}
 </div> )}

 {judgeScore.comments && (
 <div className="mt-2 rounded p-2 border border-[rgba(0,230,255,0.25)] bg-[rgba(0,230,255,0.06)]">
 <p className="text-xs font-semibold text-[#a8e8f5]">Comments:</p>
 <p className="text-xs text-[#c8eef5] italic">{judgeScore.comments}</p>
 </div> )}
 </div> ))}
 </div>
 {!selectedApproval.scoresPublished && (
 <div className={`mt-6 pt-6 border-t ${themeClasses.cardBorder}`}>
 <button
 onClick={() => publishScores(selectedApproval.performanceId, selectedApproval.performanceTitle)}
 disabled={processingPublish.has(selectedApproval.performanceId)}
 className={`w-full ${themeClasses.buttonBase} ${themeClasses.buttonSuccess} ${processingPublish.has(selectedApproval.performanceId) ? themeClasses.buttonDisabled : ''}`} >
 {processingPublish.has(selectedApproval.performanceId) ? 'Publishing...' : 'Publish Scores to Contestants & Teachers'}
 </button>
 <p className={`text-xs ${themeClasses.textMuted} text-center mt-2`}> Once published, scores will be visible to contestants and teachers. You can still edit individual judge scores after publishing.
 </p>
 </div> )}
 {selectedApproval.scoresPublished && (
 <div className={`mt-6 pt-6 border-t ${themeClasses.cardBorder}`}>
 <button
 onClick={() => regenerateCertificate(selectedApproval.performanceId, selectedApproval.performanceTitle)}
 disabled={processingPublish.has(selectedApproval.performanceId)}
 className={`w-full btn-chrome justify-center ${processingPublish.has(selectedApproval.performanceId) ? 'opacity-50' : ''}`} title="Regenerate certificate (useful if template was uploaded after publishing)" >
 {processingPublish.has(selectedApproval.performanceId) ? 'Regenerating...' : 'Regenerate Certificate'}
 </button>
 <p className={`text-xs ${themeClasses.textMuted} text-center mt-2`}> Regenerate certificate for this performance. Useful if the template was uploaded after scores were published.
 </p>
 </div> )}
 </div>
 </div>
 </div> )}
 </div> );

}

export default function ScoringApprovalPage() {
 return (
 <ThemeProvider>
 <ScoringApprovalPageContent />
 </ThemeProvider> );
}
