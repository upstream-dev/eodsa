'use client';

import Link from 'next/link';
import type { ReactNode, FormEventHandler } from 'react';
import { BrandLogo, CoBrandLine } from '@/components/brand/BrandLogo';

type AuthPortalLayoutProps = {
 title: string;
 subtitle?: string;
 children: ReactNode;
 footer?: ReactNode;
};

/** Shared Avalon chrome shell for all portal / auth screens */
export function AuthPortalLayout({ title, subtitle, children, footer }: AuthPortalLayoutProps) {
 return (
 <div className="min-h-screen avalon-mesh flex items-center justify-center px-4 py-8">
 <div className="w-full max-w-md">
 <div className="text-center mb-8">
 <BrandLogo brand="avalon" size={72} priority className="mx-auto mb-5" />
 <h1 className="font-display text-3xl sm:text-4xl chrome-text leading-none mb-2">{title}</h1> {subtitle && <p className="label-caps text-[var(--chrome-mid)] mb-3">{subtitle}</p>}
 <div className="flex justify-center">
 <CoBrandLine />
 </div>
 </div>  <div className="glass-panel overflow-hidden">{children}</div> {footer && <div className="mt-6">{footer}</div>}

 <div className="text-center mt-8">
 <Link href="/" className="text-[var(--chrome-mid)] hover:text-white text-sm transition-colors"> Back to Home
 </Link>
 </div>
 </div>
 </div> );
}

export const authFieldClass =
 'w-full px-4 py-3.5 bg-black/40 border border-[rgba(192,192,192,0.2)] rounded-[10px] text-white placeholder-[#5a5a5a] focus:border-[rgba(192,192,192,0.5)] focus:ring-[3px] focus:ring-[rgba(192,192,192,0.12)] transition-all';

export const authErrorClass =
 'border border-[rgba(139,58,58,0.45)] bg-[rgba(139,58,58,0.2)] text-[#f0c4c4] px-4 py-3 rounded-[10px] text-sm';
