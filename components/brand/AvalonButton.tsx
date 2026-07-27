import Link from 'next/link';
import type { ReactNode, ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react';

type Variant = 'chrome' | 'outline';

type CommonProps = {
 variant?: Variant;
 className?: string;
 children: ReactNode;
};

type ButtonProps = CommonProps &
 ButtonHTMLAttributes<HTMLButtonElement> & {
 href?: undefined;
 };

type LinkProps = CommonProps &
 Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
 href: string;
 };

function classes(variant: Variant, className: string) {
 const base = variant === 'chrome' ? 'btn-chrome' : 'btn-outline-chrome';
 return `${base} inline-flex items-center justify-center gap-2 ${className}`.trim();
}

export function AvalonButton({
 variant = 'chrome',
 className = '',
 children,
 href,
 ...rest
}: ButtonProps | LinkProps) {
 const cls = classes(variant, className);
 if (href) {
 return (
 <Link href={href} className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}> {children}
 </Link> );
 }
 return (
 <button type="button" className={cls} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}> {children}
 </button> );
}
