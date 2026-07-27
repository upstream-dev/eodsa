'use client';

import { useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePhase2Feature } from '@/hooks/usePhase2Feature';
import {
  Shield,
  Gavel,
  Archive,
  ScrollText,
  BookOpen,
  Mic2,
  ClipboardList,
  Camera,
  Volume2,
  Bell,
  CalendarCog,
  Layers,
  type LucideProps,
} from 'lucide-react';

type IconComponent = ComponentType<LucideProps>;

export default function BackendDashboard() {
  const router = useRouter();
  const { isEnabled: isPhase2Enabled } = usePhase2Feature();
  const [authorized, setAuthorized] = useState(false);

  // Client-side belt-and-suspenders — middleware already enforces Admin cookie.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/admin-session', { method: 'GET' });
        if (!res.ok) {
          router.replace('/portal/admin?next=/backend');
          return;
        }
        if (!cancelled) setAuthorized(true);
      } catch {
        router.replace('/portal/admin?next=/backend');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Portal links that should be disabled when Phase 2 is disabled
  const phase2Portals: { href: string; icon: IconComponent; label: string; external?: boolean }[] = [
    { href: '/portal/backstage', icon: Layers, label: 'Backstage Manager' },
    { href: '/portal/announcer', icon: Mic2, label: 'Announcer Portal' },
    { href: '/portal/registration', icon: ClipboardList, label: 'Registration Desk' },
    { href: '/portal/media', icon: Camera, label: 'Media Portal' },
    { href: '/admin/sound-tech', icon: Volume2, label: 'Sound Tech' },
    { href: '/admin/notifications', icon: Bell, label: 'Admin Notifications' },
    { href: '/event-type-manager', icon: CalendarCog, label: 'Event Type Manager' },
  ];

  const tileBase =
    'flex flex-col items-center justify-center p-3 sm:p-4 rounded-lg transition-colors group glass-panel bg-black/40 border border-[rgba(192,192,192,0.22)] min-h-[88px] sm:min-h-[100px]';

  const PortalLink = ({
    href,
    icon: Icon,
    label,
    external = false,
  }: {
    href: string;
    icon: IconComponent;
    label: string;
    external?: boolean;
  }) => {
    const isDisabled = !isPhase2Enabled;

    const baseClasses = `${tileBase} ${
      isDisabled
        ? 'opacity-50 cursor-not-allowed'
        : 'hover:border-[rgba(192,192,192,0.4)] hover:bg-black/50 cursor-pointer'
    }`;

    const content = (
      <>
        <Icon
          className={`w-6 h-6 mb-2 text-[var(--chrome-mid)] ${
            isDisabled ? '' : 'group-hover:scale-110'
          } transition-transform`}
          strokeWidth={1.75}
        />
        <span
          className={`text-xs font-medium text-center ${
            isDisabled ? 'text-gray-500' : 'text-[#e8e8e8]'
          }`}
        >
          {label}
        </span>
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

  if (!authorized) {
    return (
      <div className="min-h-screen avalon-mesh flex items-center justify-center">
        <p className="text-[#c0c0c0] text-sm">Verifying admin access…</p>
      </div>
    );
  }

  const alwaysOnPortals: { href: string; icon: IconComponent; label: string }[] = [
    { href: '/portal/admin', icon: Shield, label: 'Admin Portal' },
    { href: '/portal/judge', icon: Gavel, label: 'Judge Portal' },
    { href: '/backend/archived', icon: Archive, label: 'Archived' },
    { href: '/backend/logs', icon: ScrollText, label: 'Logs' },
    { href: '/backend/guide', icon: BookOpen, label: 'Admin Guide' },
  ];

  return (
    <div className="min-h-screen avalon-mesh avalon-shell">
      <div className="avalon-container avalon-section">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-20 sm:h-20 bg-[rgba(192,192,192,0.1)] border border-[rgba(192,192,192,0.3)] rounded-2xl mb-3 sm:mb-4 shadow-2xl">
            <span className="text-[#e8e8e8] text-xl sm:text-3xl font-bold">EODSA</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold chrome-text mb-2">Backend Dashboard</h1>
          <p className="text-[#c0c0c0] text-sm sm:text-lg">Staff & Official Management Portal</p>
          <p className="text-xs text-amber-300/80 mt-2">Admin access only</p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="glass-panel rounded-2xl border border-[rgba(192,192,192,0.22)] p-4 sm:p-6 mb-6 sm:mb-8">
            <h3 className="text-lg sm:text-xl font-bold text-[#e8e8e8] mb-4 text-center">
              Staff & Official Portals
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {alwaysOnPortals.map(({ href, icon: Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`${tileBase} min-h-[88px] sm:min-h-[100px] justify-center hover:border-[rgba(192,192,192,0.4)] hover:bg-black/50 cursor-pointer`}
                >
                  <Icon
                    className="w-5 h-5 sm:w-6 sm:h-6 mb-2 text-[var(--chrome-mid)] group-hover:scale-110 transition-transform"
                    strokeWidth={1.75}
                  />
                  <span className="text-[11px] sm:text-xs text-[#e8e8e8] font-medium text-center leading-tight">{label}</span>
                </Link>
              ))}
              {phase2Portals.map((portal) => (
                <PortalLink key={portal.href} {...portal} />
              ))}
            </div>
          </div>

          <div className="text-center space-y-4">
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link
                href="/admin/scoring-approval"
                className="text-[var(--chrome-mid)] hover:text-[#e8e8e8] transition-colors"
              >
                Score Approval System
              </Link>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link href="/" className="btn-outline-chrome inline-flex items-center text-sm">
              Back to Main Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
