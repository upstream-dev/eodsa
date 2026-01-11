'use client';

import Link from 'next/link';
import { usePhase2Feature } from '@/hooks/usePhase2Feature';
import { useState } from 'react';

export default function BackendDashboard() {
  const { isEnabled: isPhase2Enabled, isLoading } = usePhase2Feature();
  const [batchFixLoading, setBatchFixLoading] = useState(false);
  const [batchFixReport, setBatchFixReport] = useState<any>(null);
  
  // Portal links that should be disabled when Phase 2 is disabled
  const phase2Portals = [
    { href: '/portal/backstage', icon: '🎭', label: 'Backstage Manager', color: 'purple' },
    { href: '/portal/announcer', icon: '📢', label: 'Announcer Portal', color: 'orange' },
    { href: '/portal/registration', icon: '✅', label: 'Registration Desk', color: 'teal' },
    { href: '/portal/media', icon: '📸', label: 'Media Portal', color: 'pink' },
    { href: '/admin/sound-tech', icon: '🎵', label: 'Sound Tech', color: 'indigo' },
    { href: '/admin/notifications', icon: '📧', label: 'Admin Notifications', color: 'emerald' },
    { href: 'https://www.avalondance.co.za/event-type-manager', icon: '🗂️', label: 'Event Type Manager', color: 'yellow', external: true }
  ];

  const PortalLink = ({ href, icon, label, color, external = false }: { href: string; icon: string; label: string; color: string; external?: boolean }) => {
    const isDisabled = !isPhase2Enabled;
    
    // Map color to Tailwind classes
    const colorClasses: Record<string, { bg: string; hover: string; text: string }> = {
      purple: { bg: 'bg-purple-600/20', hover: 'hover:bg-purple-600/30', text: 'text-purple-400' },
      orange: { bg: 'bg-orange-600/20', hover: 'hover:bg-orange-600/30', text: 'text-orange-400' },
      teal: { bg: 'bg-teal-600/20', hover: 'hover:bg-teal-600/30', text: 'text-teal-400' },
      pink: { bg: 'bg-pink-600/20', hover: 'hover:bg-pink-600/30', text: 'text-pink-400' },
      indigo: { bg: 'bg-indigo-600/20', hover: 'hover:bg-indigo-600/30', text: 'text-indigo-400' },
      emerald: { bg: 'bg-emerald-600/20', hover: 'hover:bg-emerald-600/30', text: 'text-emerald-400' },
      yellow: { bg: 'bg-yellow-500/20', hover: 'hover:bg-yellow-500/30', text: 'text-yellow-300' }
    };
    
    const colorClass = colorClasses[color] || colorClasses.purple;
    const baseClasses = `flex flex-col items-center p-3 rounded-lg transition-colors group ${
      isDisabled 
        ? 'bg-gray-600/10 opacity-50 cursor-not-allowed' 
        : `${colorClass.bg} ${colorClass.hover} cursor-pointer`
    }`;
    
    const content = (
      <>
        <span className={`text-2xl mb-2 ${isDisabled ? '' : 'group-hover:scale-110'} transition-transform`}>{icon}</span>
        <span className={`text-xs font-medium text-center ${isDisabled ? 'text-gray-500' : colorClass.text}`}>{label}</span>
      </>
    );

    if (isDisabled) {
      return (
        <div className={baseClasses} title="This feature is temporarily unavailable.">
          {content}
        </div>
      );
    }

    if (external) {
      return (
        <a href={href} target="_blank" rel="noreferrer" className={baseClasses}>
          {content}
        </a>
      );
    }

    return (
      <Link href={href} className={baseClasses}>
        {content}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          {/* EODSA Logo Placeholder */}
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-2xl">
            <span className="text-white text-3xl font-bold">EODSA</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            Backend Dashboard
          </h1>
          <p className="text-gray-300 text-lg">Staff & Official Management Portal</p>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto">
          {/* Staff Portals */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border-2 border-gray-500/30 p-6 mb-8 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 text-center">Staff & Official Portals</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <Link href="/portal/admin" className="flex flex-col items-center p-3 bg-blue-600/20 rounded-lg hover:bg-blue-600/30 transition-colors group">
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">👑</span>
                <span className="text-xs text-blue-400 font-medium">Admin Portal</span>
              </Link>
              <Link href="/portal/judge" className="flex flex-col items-center p-3 bg-green-600/20 rounded-lg hover:bg-green-600/30 transition-colors group">
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">⚖️</span>
                <span className="text-xs text-green-400 font-medium">Judge Portal</span>
              </Link>
              {phase2Portals.map((portal) => (
                <PortalLink key={portal.href} {...portal} />
              ))}
            </div>
          </div>

          {/* Certificate Batch Fix Tool */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border-2 border-gray-500/30 p-6 mb-8 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 text-center">Certificate Tools</h3>
            <div className="space-y-4">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <h4 className="text-lg font-semibold text-white mb-2">Batch Fix Group Certificates</h4>
                <p className="text-gray-300 text-sm mb-4">
                  Regenerates all certificates for Duet, Trio, and Group performances to ensure they use studio names and dynamic font scaling.
                </p>
                <button
                  onClick={async () => {
                    if (batchFixLoading) return;
                    setBatchFixLoading(true);
                    setBatchFixReport(null);
                    
                    try {
                      const response = await fetch('/api/certificates/batch-fix-groups', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                      });
                      
                      const data = await response.json();
                      setBatchFixReport(data);
                    } catch (error) {
                      setBatchFixReport({
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                      });
                    } finally {
                      setBatchFixLoading(false);
                    }
                  }}
                  disabled={batchFixLoading}
                  className={`w-full px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                    batchFixLoading
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {batchFixLoading ? 'Processing...' : '🔄 Batch Fix Group Certificates'}
                </button>
              </div>

              {/* Report Display */}
              {batchFixReport && (
                <div className={`rounded-lg p-4 border-2 ${
                  batchFixReport.success
                    ? 'bg-green-900/20 border-green-500/30'
                    : 'bg-red-900/20 border-red-500/30'
                }`}>
                  <h4 className={`text-lg font-semibold mb-2 ${
                    batchFixReport.success ? 'text-green-300' : 'text-red-300'
                  }`}>
                    {batchFixReport.success ? '✅ Batch Fix Report' : '❌ Batch Fix Failed'}
                  </h4>
                  
                  {batchFixReport.success && batchFixReport.results && (
                    <div className="space-y-2 text-sm">
                      <div className="text-gray-300">
                        <span className="font-semibold">Total Certificates:</span> {batchFixReport.results.total}
                      </div>
                      <div className="text-gray-300">
                        <span className="font-semibold">Processed:</span> {batchFixReport.results.processed}
                      </div>
                      <div className="text-green-300">
                        <span className="font-semibold">Succeeded:</span> {batchFixReport.results.succeeded}
                      </div>
                      <div className="text-red-300">
                        <span className="font-semibold">Failed:</span> {batchFixReport.results.failed}
                      </div>
                      
                      {batchFixReport.results.errors && batchFixReport.results.errors.length > 0 && (
                        <div className="mt-4">
                          <h5 className="font-semibold text-red-300 mb-2">Errors ({batchFixReport.results.errors.length}):</h5>
                          <div className="max-h-40 overflow-y-auto space-y-1">
                            {batchFixReport.results.errors.slice(0, 10).map((err: any, idx: number) => (
                              <div key={idx} className="text-xs text-red-200 bg-red-900/30 p-2 rounded">
                                <div><span className="font-semibold">Performance ID:</span> {err.performanceId}</div>
                                <div><span className="font-semibold">Error:</span> {err.error.substring(0, 100)}...</div>
                              </div>
                            ))}
                            {batchFixReport.results.errors.length > 10 && (
                              <div className="text-xs text-gray-400 italic">
                                ... and {batchFixReport.results.errors.length - 10} more errors
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!batchFixReport.success && (
                    <div className="text-red-200 text-sm">
                      <p><span className="font-semibold">Error:</span> {batchFixReport.error || 'Unknown error'}</p>
                      {batchFixReport.details && (
                        <p className="mt-2 text-xs text-gray-400">{batchFixReport.details}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Additional Admin Links */}
          <div className="text-center space-y-4">
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link href="/admin/scoring-approval" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                Score Approval System
              </Link>
            </div>
          </div>

          {/* Back to Main */}
          <div className="text-center mt-8">
            <Link 
              href="/"
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg font-semibold hover:from-gray-700 hover:to-gray-800 transition-all duration-300 shadow-lg hover:shadow-xl text-sm"
            >
              ← Back to Main Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
