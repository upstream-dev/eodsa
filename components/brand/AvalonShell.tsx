'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Menu, LogOut, LayoutDashboard, Calendar, ClipboardList, Trophy, User, X } from 'lucide-react';
import { AvalonWordmark, CoBrandLine, EodPortalMark } from '@/components/brand/BrandLogo';

export type ShellNavItem = {
 id: string;
 label: string;
 href?: string;
 onClick?: () => void;
 icon?: 'home' | 'events' | 'entries' | 'results' | 'profile';
 active?: boolean;
};

type AvalonShellProps = {
 children: ReactNode;
 title?: string;
 userName?: string;
 userMeta?: string;
 navItems?: ShellNavItem[];
 onLogout?: () => void;
 showSidebar?: boolean;
};

const ICONS = {
 home: LayoutDashboard,
 events: Calendar,
 entries: ClipboardList,
 results: Trophy,
 profile: User,
} as const;

export function AvalonShell({
 children,
 title,
 userName,
 userMeta,
 navItems = [],
 onLogout,
 showSidebar = true,
}: AvalonShellProps) {
 const [drawerOpen, setDrawerOpen] = useState(false);

 const nav = (
 <nav className="flex-1 px-3 space-y-1"> {navItems.map((item) => {
 const Icon = item.icon ? ICONS[item.icon] : LayoutDashboard;
 const className = `flex items-center gap-3.5 px-4 py-3.5 rounded-[10px] text-[13px] font-medium tracking-wide border transition-colors ${
 item.active
 ? 'text-white bg-[rgba(192,192,192,0.08)] border-[rgba(192,192,192,0.35)] shadow-[inset_2px_0_0_0_#00E6FF]'
 : 'text-[var(--sidebar-muted)] border-transparent hover:text-[#e8e8e8] hover:bg-[rgba(192,192,192,0.05)]'
 }`;

 if (item.href) {
 return (
 <Link
 key={item.id}
 href={item.href}
 className={className}
 onClick={() => setDrawerOpen(false)}
 >
 <Icon className="w-5 h-5" strokeWidth={1.75} />
 <span>{item.label}</span>
 </Link> );
 }

 return (
 <button
 key={item.id}
 type="button" className={`${className} w-full text-left`}
 onClick={() => {
 item.onClick?.();
 setDrawerOpen(false);
 }}
 >
 <Icon className="w-5 h-5" strokeWidth={1.75} />
 <span>{item.label}</span>
 </button> );
 })}
 </nav> );

 return (
 <div className="min-h-screen avalon-mesh flex"> {showSidebar && (
 <>
 <aside
 className={`fixed lg:static inset-y-0 left-0 z-50 w-[260px] bg-[#0a0a0a] border-r border-[rgba(192,192,192,0.12)] flex flex-col transition-transform duration-300 ${
 drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
 }`}
 >
 <div className="p-6 pb-4 flex items-start justify-between gap-2">
 <AvalonWordmark />
 <button
 type="button" className="lg:hidden p-2 text-[var(--chrome-mid)]" onClick={() => setDrawerOpen(false)}
 aria-label="Close menu" >
 <X className="w-5 h-5" />
 </button>
 </div> {nav}
 <div className="p-5 mt-auto border-t border-[rgba(192,192,192,0.12)]">
 <EodPortalMark />
 </div>
 </aside> {drawerOpen && (
 <div
 className="fixed inset-0 z-40 bg-black/55 lg:hidden" onClick={() => setDrawerOpen(false)}
 aria-hidden
 /> )}
 </> )}

 <div className="flex-1 flex flex-col min-w-0">
 <header className="sticky top-0 z-30 border-b border-[rgba(192,192,192,0.12)] bg-[rgba(5,5,5,0.85)] backdrop-blur-md">
 <div className="flex items-center justify-between px-4 sm:px-8 py-4 gap-4">
 <div className="flex items-center gap-4 min-w-0"> {showSidebar && (
 <button
 type="button" className="lg:hidden p-2 rounded-lg border border-[rgba(192,192,192,0.2)] text-[var(--chrome-mid)]" onClick={() => setDrawerOpen(true)}
 aria-label="Open menu" >
 <Menu className="w-5 h-5" />
 </button> )}
 <div className="min-w-0 hidden sm:block">
 <div className="font-display text-xl sm:text-2xl chrome-text leading-none"> Avalon Competition Management
 </div>
 <CoBrandLine className="mt-1" />
 </div>
 <div className="sm:hidden label-caps text-white">{title || 'Avalon'}</div>
 </div>  <div className="flex items-center gap-3"> {(userName || userMeta) && (
 <div className="hidden md:flex flex-col items-end"> {userName && <span className="text-sm text-white font-medium">{userName}</span>}
 {userMeta && (
 <span className="text-[10px] text-[var(--sidebar-muted)] tracking-wide uppercase"> {userMeta}
 </span> )}
 </div> )}
 <div className="w-9 h-9 rounded-full border border-[rgba(192,192,192,0.35)] bg-[#111] flex items-center justify-center">
 <User className="w-4 h-4 text-[var(--chrome-mid)]" strokeWidth={1.75} />
 </div> {onLogout && (
 <button type="button" onClick={onLogout} className="btn-outline-chrome !px-4 !py-2 hidden sm:inline-flex">
 <LogOut className="w-3.5 h-3.5" /> Logout
 </button> )}
 </div>
 </div>
 </header>  <main className="flex-1 p-4 sm:p-8 overflow-auto">
 <div className="max-w-6xl mx-auto">{children}</div>
 </main>
 </div>
 </div> );
}
