'use client';

import { useEffect, useState, type ComponentType, type CSSProperties } from 'react';
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

  const portals: PortalItem[] = [
    { href: '/portal/admin', icon: Shield, label: 'Admin Portal' },
    { href: '/portal/judge', icon: Gavel, label: 'Judge Portal' },
    { href: '/backend/archived', icon: Archive, label: 'Archived' },
    { href: '/backend/logs', icon: ScrollText, label: 'Logs' },
    { href: '/backend/guide', icon: BookOpen, label: 'Admin Guide' },
    { href: '/portal/backstage', icon: Layers, label: 'Backstage Manager', phase2: true },
    { href: '/portal/announcer', icon: Mic2, label: 'Announcer Portal', phase2: true },
    { href: '/portal/registration', icon: ClipboardList, label: 'Registration Desk', phase2: true },
    { href: '/portal/media', icon: Camera, label: 'Media Portal', phase2: true },
    { href: '/admin/sound-tech', icon: Volume2, label: 'Sound Tech', phase2: true },
    { href: '/admin/notifications', icon: Bell, label: 'Admin Notifications', phase2: true },
    { href: '/event-type-manager', icon: CalendarCog, label: 'Event Type Manager', phase2: true },
  ];

  if (!authorized) {
    return (
      <div style={{ minHeight: '100dvh', background: '#050505', color: '#c0c0c0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: 14 }}>Verifying admin access…</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#050505', color: '#fff', padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 64,
              height: 64,
              border: '1px solid rgba(192,192,192,0.35)',
              borderRadius: 12,
              background: '#141414',
              marginBottom: 12,
              fontWeight: 700,
              fontSize: 20,
              color: '#e8e8e8',
            }}
          >
            EODSA
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 700, color: '#e8e8e8' }}>
            Backend Dashboard
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: '#c0c0c0' }}>
            Staff & Official Management Portal
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#fbbf24' }}>Admin access only</p>
        </header>

        <section
          style={{
            border: '1px solid rgba(192,192,192,0.28)',
            borderRadius: 12,
            background: '#111111',
            overflow: 'hidden',
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              margin: 0,
              padding: '14px 16px',
              fontSize: 16,
              fontWeight: 700,
              color: '#e8e8e8',
              borderBottom: '1px solid rgba(192,192,192,0.18)',
              textAlign: 'center',
            }}
          >
            Staff & Official Portals
          </h2>

          {/* Single-column list — card grids ghost on many tablet GPUs */}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {portals.map(({ href, icon: Icon, label, phase2 }) => {
              const disabled = Boolean(phase2 && !isPhase2Enabled);
              const rowStyle: CSSProperties = {
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderBottom: '1px solid rgba(192,192,192,0.12)',
                color: disabled ? '#6b7280' : '#e8e8e8',
                textDecoration: 'none',
                background: '#111111',
                opacity: disabled ? 0.55 : 1,
                minHeight: 52,
              };

              const content = (
                <>
                  <Icon width={20} height={20} color={disabled ? '#6b7280' : '#c0c0c0'} strokeWidth={1.75} />
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
                  {disabled && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>Unavailable</span>
                  )}
                </>
              );

              return (
                <li key={href} style={{ margin: 0, padding: 0 }}>
                  {disabled ? (
                    <div style={rowStyle} title="This feature is temporarily unavailable.">
                      {content}
                    </div>
                  ) : (
                    <Link href={href} style={rowStyle}>
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <Link
            href="/admin/scoring-approval"
            style={{ color: '#c0c0c0', fontSize: 14, textDecoration: 'none' }}
          >
            Score Approval System
          </Link>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              padding: '12px 28px',
              border: '1px solid rgba(192,192,192,0.45)',
              borderRadius: 999,
              color: '#e8e8e8',
              background: '#111111',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            Back to Main Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
