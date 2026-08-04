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

type PortalItem = {
  href: string;
  icon: IconComponent;
  label: string;
  phase2?: boolean;
};

export default function BackendDashboard() {
  const router = useRouter();
  const { isEnabled: isPhase2Enabled } = usePhase2Feature();
  const [authorized, setAuthorized] = useState(false);

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

  const alwaysOn: PortalItem[] = [
    { href: '/portal/admin', icon: Shield, label: 'Admin Portal' },
    { href: '/portal/judge', icon: Gavel, label: 'Judge Portal' },
    { href: '/backend/archived', icon: Archive, label: 'Archived' },
    { href: '/backend/logs', icon: ScrollText, label: 'Logs' },
    { href: '/backend/guide', icon: BookOpen, label: 'Admin Guide' },
  ];

  const phase2: PortalItem[] = [
    { href: '/portal/backstage', icon: Layers, label: 'Backstage Manager', phase2: true },
    { href: '/portal/announcer', icon: Mic2, label: 'Announcer Portal', phase2: true },
    { href: '/portal/registration', icon: ClipboardList, label: 'Registration Desk', phase2: true },
    { href: '/portal/media', icon: Camera, label: 'Media Portal', phase2: true },
    { href: '/admin/sound-tech', icon: Volume2, label: 'Sound Tech', phase2: true },
    { href: '/admin/notifications', icon: Bell, label: 'Admin Notifications', phase2: true },
    { href: '/event-type-manager', icon: CalendarCog, label: 'Event Type Manager', phase2: true },
  ];

  // Solid tiles only — no glass/blur/scale (Chrome tablet compositor-safe)
  const tileClass =
    'flex flex-col items-center justify-center gap-2 p-3 sm:p-4 rounded-xl bg-[#141414] border border-[rgba(192,192,192,0.28)] min-h-[96px] sm:min-h-[110px] text-center no-underline';

  const PortalTile = ({ href, icon: Icon, label, phase2: isPhase2 }: PortalItem) => {
    const disabled = Boolean(isPhase2 && !isPhase2Enabled);
    const className = `${tileClass} ${
      disabled
        ? 'opacity-50 cursor-not-allowed'
        : 'hover:border-[rgba(192,192,192,0.5)] hover:bg-[#1a1a1a] cursor-pointer'
    }`;

    const content = (
      <>
        <Icon
          className={`w-6 h-6 ${disabled ? 'text-gray-500' : 'text-[#c0c0c0]'}`}
          strokeWidth={1.75}
        />
        <span
          className={`text-[11px] sm:text-xs font-medium leading-tight ${
            disabled ? 'text-gray-500' : 'text-[#e8e8e8]'
          }`}
        >
          {label}
        </span>
      </>
    );

    if (disabled) {
      return (
        <div className={className} title="This feature is temporarily unavailable.">
          {content}
        </div>
      );
    }

    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  };

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <p className="text-[#c0c0c0] text-sm">Verifying admin access…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-20 sm:h-20 bg-[#141414] border border-[rgba(192,192,192,0.35)] rounded-2xl mb-3 sm:mb-4">
            <span className="text-[#e8e8e8] text-xl sm:text-3xl font-bold">EODSA</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-[#e8e8e8] mb-2">Backend Dashboard</h1>
          <p className="text-[#c0c0c0] text-sm sm:text-lg">Staff & Official Management Portal</p>
          <p className="text-xs text-amber-300/80 mt-2">Admin access only</p>
        </div>

        <div className="rounded-2xl border border-[rgba(192,192,192,0.28)] bg-[#111111] p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-bold text-[#e8e8e8] mb-4 text-center">
            Staff & Official Portals
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {alwaysOn.map((portal) => (
              <PortalTile key={portal.href} {...portal} />
            ))}
            {phase2.map((portal) => (
              <PortalTile key={portal.href} {...portal} />
            ))}
          </div>
        </div>

        <div className="text-center space-y-4">
          <Link
            href="/admin/scoring-approval"
            className="text-[#c0c0c0] hover:text-[#e8e8e8] text-sm no-underline"
          >
            Score Approval System
          </Link>
        </div>

        <div className="text-center mt-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-[rgba(192,192,192,0.45)] px-6 py-3 text-sm font-semibold tracking-widest uppercase text-[#e8e8e8] bg-[#111111] no-underline"
          >
            Back to Main Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
