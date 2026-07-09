'use client';

import Link from 'next/link';
import { usePhase2Feature } from '@/hooks/usePhase2Feature';

export default function BackendDashboard() {
  const { isEnabled: isPhase2Enabled } = usePhase2Feature();
  
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
              <Link href="/backend/guide" className="flex flex-col items-center p-3 bg-amber-600/20 rounded-lg hover:bg-amber-600/30 transition-colors group">
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">📖</span>
                <span className="text-xs text-amber-400 font-medium">Admin Guide</span>
              </Link>
              {phase2Portals.map((portal) => (
                <PortalLink key={portal.href} {...portal} />
              ))}
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
