import Image from 'next/image';

type BrandLogoProps = {
 brand: 'avalon' | 'eod';
 size?: number;
 className?: string;
 priority?: boolean;
};

const SRC = {
 avalon: '/brand/avalon-logo.png',
 eod: '/brand/eod-logo.png',
} as const;

const ALT = {
 avalon: 'Avalon',
 eod: 'Elements of Dance South Africa',
} as const;

export function BrandLogo({ brand, size = 48, className = '', priority = false }: BrandLogoProps) {
 return (
 <Image
 src={SRC[brand]}
 alt={ALT[brand]}
 width={size}
 height={size}
 className={`object-contain ${className}`}
 priority={priority}
 /> );
}

export function AvalonWordmark({ className = '' }: { className?: string }) {
 return (
 <div className={`flex items-center gap-3 ${className}`}>
 <BrandLogo brand="avalon" size={40} />
 <div className="min-w-0">
 <div className="label-caps text-white leading-none mb-1">Avalon</div>
 <div className="text-[10px] text-[var(--sidebar-muted)] tracking-wide leading-snug"> Competition Management
 </div>
 </div>
 </div> );
}

export function EodPortalMark({ className = '' }: { className?: string }) {
 return (
 <div className={`flex items-center gap-3 opacity-70 ${className}`}>
 <BrandLogo brand="eod" size={36} />
 <div className="min-w-0">
 <div className="text-[9px] text-[var(--sidebar-muted)] tracking-[0.12em] uppercase leading-tight"> Official Entry Portal
 </div>
 <div className="text-[10px] text-[#a8a8a8] leading-tight mt-0.5">Elements of Dance SA</div>
 </div>
 </div> );
}

export function CoBrandLine({ className = '' }: { className?: string }) {
 return (
 <div className={`flex flex-wrap items-center gap-2 ${className}`}>
 <span className="text-[10px] text-[var(--sidebar-muted)] tracking-[0.12em] uppercase"> Official Entry Portal for
 </span>
 <span className="text-[10px] tracking-[0.08em] uppercase">
 <span className="brand-duo-text">Elements of Dance</span>{' '}
 <span className="text-[var(--chrome-mid)]">South Africa</span>
 </span>
 <BrandLogo brand="eod" size={20} className="opacity-60 hidden sm:inline-block" />
 </div> );
}
