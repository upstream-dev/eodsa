'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';

export default function JudgeRedirectPage() {
 const router = useRouter();

 useEffect(() => {
 // Auto-redirect after 3 seconds
 const timer = setTimeout(() => {
 router.push('/portal/judge');
 }, 3000);

 return () => clearTimeout(timer);
 }, [router]);

 return (
 <div className="min-h-screen avalon-mesh flex items-center justify-center p-4">
 <div className="max-w-md w-full glass-panel border border-[rgba(192,192,192,0.22)] p-8 text-center">
 <BrandLogo brand="avalon" size={72} priority className="mx-auto mb-5" />  <h2 className="font-display text-3xl chrome-text leading-none mb-4">Judge Portal</h2>
 <p className="text-gray-300 mb-6"> Redirecting you to the judge login portal...
 </p>  <div className="w-12 h-12 border-2 border-[rgba(192,192,192,0.2)] border-t-[var(--chrome-mid)] rounded-full animate-spin mx-auto mb-6"></div>  <div className="space-y-3">
 <Link 
 href="/portal/judge" className="btn-chrome w-full justify-center" >
 Go to Judge Portal Now
 </Link>  <Link 
 href="/" className="btn-outline-chrome w-full justify-center" >
 Back to Home
 </Link>
 </div>  <div className="mt-6 p-3 glass-panel border border-[rgba(192,192,192,0.22)] rounded-lg">
 <p className="text-[var(--chrome-mid)] text-sm"> Tip: Bookmark <code className="text-white">/portal/judge</code> for direct access to the judge login.
 </p>
 </div>
 </div>
 </div> );
}
