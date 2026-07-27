'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';

// Disable static generation for this page
export const dynamic = 'force-dynamic';

interface PaymentDetails {
 payment_id: string;
 entry_id: string;
 event_id: string;
 event_name: string;
 entry_title: string;
 amount: number;
 status: string;
 paid_at: string;
}

function PaymentSuccessContent() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
 const [isLoading, setIsLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [entriesProcessed, setEntriesProcessed] = useState(false);
 const [processingEntries, setProcessingEntries] = useState(false);
 const [createdEntries, setCreatedEntries] = useState<any[]>([]);
 const [payerType, setPayerType] = useState<'studio' | 'dancer'>('dancer');

 const resolvePayerType = () => {
 const storedPayerType = sessionStorage.getItem('paymentPayerType');
 if (storedPayerType === 'studio') return 'studio';
 if (typeof window !== 'undefined' && localStorage.getItem('studioSession')) return 'studio';
 return 'dancer';
 };

 const dashboardHref = payerType === 'studio' ? '/studio-dashboard' : '/dancer-dashboard';
 const dashboardLabel = payerType === 'studio' ? 'Studio Dashboard' : 'My Entries';

 // Get payment ID from URL parameters or session storage
 const paymentId = searchParams.get('payment_id') || searchParams.get('m_payment_id');

 useEffect(() => {
 setPayerType(resolvePayerType());

 if (paymentId) {
 fetchPaymentDetails(paymentId);
 } else {
 // Check for payment data in session storage (stored during payment initiation)
 const sessionPaymentAmount = sessionStorage.getItem('paymentAmount');
 const sessionEventId = sessionStorage.getItem('paymentEventId');
 const sessionEventName = sessionStorage.getItem('paymentEventName');
 
 if (sessionPaymentAmount && sessionEventId) {
 // Show success message based on session data
 setPaymentDetails({
 payment_id: 'pending_verification',
 entry_id: '',
 event_id: sessionEventId,
 event_name: sessionEventName || 'Competition Entry',
 entry_title: 'Competition Entries',
 amount: parseFloat(sessionPaymentAmount),
 status: 'pending_verification',
 paid_at: new Date().toISOString()
 });
 setIsLoading(false);
 
 // Clear session data
 sessionStorage.removeItem('paymentAmount');
 sessionStorage.removeItem('paymentEventId');
 sessionStorage.removeItem('paymentEventName');
 sessionStorage.removeItem('pendingEntries');
 sessionStorage.removeItem('paymentPayerType');
 } else {
 setError('Payment verification in progress. Please check your dashboard for payment status.');
 setIsLoading(false);
 }
 }
 }, [paymentId]);

 const fetchPaymentDetails = async (paymentId: string) => {
 try {
 const response = await fetch(`/api/payments/status?payment_id=${paymentId}`);
 const data = await response.json();

 if (data.success) {
 setPaymentDetails(data.payment);
 
 // If payment is completed, check and process entries
 if (data.payment.status === 'completed' || data.payment.payment_status === 'COMPLETE') {
 await processEntriesAfterPayment(paymentId);
 }
 } else {
 setError(data.error || 'Failed to fetch payment details');
 }
 } catch (err) {
 setError('Network error occurred');
 console.error('Payment details fetch error:', err);
 } finally {
 setIsLoading(false);
 }
 };

 const processEntriesAfterPayment = async (paymentId: string) => {
 try {
 const processedKey = `entriesProcessed_${paymentId}`;
 if (typeof window !== 'undefined' && sessionStorage.getItem(processedKey) === '1') {
 const checkResponse = await fetch(`/api/payments/process-entries?payment_id=${paymentId}`);
 const checkData = await checkResponse.json();
 if (checkData.success) {
 setCreatedEntries(checkData.entries);
 setEntriesProcessed(true);
 }
 return;
 }

 // First, check if entries were already processed
 const checkResponse = await fetch(`/api/payments/process-entries?payment_id=${paymentId}`);
 const checkData = await checkResponse.json();

 if (checkData.success && checkData.isComplete) {
 setCreatedEntries(checkData.entries);
 setEntriesProcessed(true);
 sessionStorage.setItem(processedKey, '1');
 console.log(' All entries already processed:', checkData.entries);
 return;
 }

 if (checkData.success && checkData.entries.length > 0 && !checkData.isComplete) {
 console.log(
 ` Partial entries (${checkData.count}/${checkData.expectedCount}) — reconciling missing items...`
 );
 }

 // Get pending entries from session storage
 const pendingEntriesData = sessionStorage.getItem('pendingEntries');
 if (!pendingEntriesData) {
 console.log(' No pending entries found in session storage');
 return;
 }

 const pendingEntries = JSON.parse(pendingEntriesData);
 if (!Array.isArray(pendingEntries) || pendingEntries.length === 0) {
 console.log(' No valid pending entries to process');
 return;
 }

 setProcessingEntries(true);
 console.log('🔄 Processing entries after payment:', pendingEntries);

 // Process the entries
 const processResponse = await fetch('/api/payments/process-entries', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 payment_id: paymentId,
 entries: pendingEntries
 }),
 });

 const processData = await processResponse.json();

 if (processData.success) {
 setCreatedEntries(processData.entries);
 setEntriesProcessed(true);
 sessionStorage.setItem(processedKey, '1');
 
 // Clear session storage
 sessionStorage.removeItem('pendingEntries');
 sessionStorage.removeItem('paymentAmount');
 sessionStorage.removeItem('paymentEventId');
 sessionStorage.removeItem('paymentEventName');
 sessionStorage.removeItem('paymentPayerType');
 
 console.log(' Entries processed successfully:', processData.entries);
 } else {
 console.error(' Failed to process entries:', processData.error);
 setError(`Failed to create competition entries: ${processData.error}`);
 }

 } catch (err) {
 console.error('💥 Entry processing error:', err);
 setError('Failed to process competition entries after payment');
 } finally {
 setProcessingEntries(false);
 }
 };

 if (isLoading) {
 return (
 <div className="min-h-screen avalon-mesh flex items-center justify-center">
 <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-2xl p-8 max-w-md w-full mx-4">
 <div className="text-center">
 <div className="animate-spin rounded-full h-16 w-16 border-2 border-[rgba(192,192,192,0.2)] border-t-[var(--chrome-mid)] mx-auto mb-4"></div>
 <h2 className="font-display text-xl chrome-text">Verifying Payment...</h2>
 <p className="text-gray-400 mt-2">Please wait while we confirm your payment with PayFast.</p>
 </div>
 </div>
 </div> );
 }

 if (error) {
 return (
 <div className="min-h-screen avalon-mesh flex items-center justify-center">
 <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-2xl p-8 max-w-md w-full mx-4">
 <div className="text-center">
 <div className="w-16 h-16 bg-[rgba(192,192,192,0.08)] border border-[rgba(192,192,192,0.22)] rounded-full flex items-center justify-center mx-auto mb-4">
 <span className="text-[var(--chrome-mid)] text-xs font-display tracking-wide">WAIT</span>
 </div>
 <h2 className="font-display text-xl chrome-text mb-2">Payment Processing</h2>
 <p className="text-gray-300 mb-6">{error}</p>
 <p className="text-sm text-gray-400 mb-6">Your payment may still be processing. The webhook notification will update your entry status automatically.</p>
 <div className="space-y-3">
 <Link 
 href={dashboardHref}
 className="btn-chrome w-full justify-center" >
 {payerType === 'studio' ? 'Go to Studio Dashboard' : 'Return to Dashboard'}
 </Link> {payerType === 'studio' && (
 <Link
 href="/studio-login" className="btn-outline-chrome w-full justify-center" >
 Studio Login
 </Link> )}
 <button
 onClick={() => window.location.reload()}
 className="btn-outline-chrome w-full justify-center" >
 Retry Verification
 </button>
 </div>
 </div>
 </div>
 </div> );
 }

 return (
 <div className="min-h-screen avalon-mesh flex items-center justify-center">
 <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-2xl p-8 max-w-lg w-full mx-4">
 <div className="text-center">
 <BrandLogo brand="avalon" size={64} priority className="mx-auto mb-4" /> {/* Success Icon */}
 <div className="w-20 h-20 bg-[rgba(192,192,192,0.08)] border border-[rgba(192,192,192,0.22)] rounded-full flex items-center justify-center mx-auto mb-6">
 <span className="text-[var(--chrome-mid)] text-2xl font-display">OK</span>
 </div> {/* Success Message */}
 <h1 className="font-display text-3xl chrome-text leading-none mb-2">Payment Successful!</h1>
 <p className="text-gray-300 mb-6"> Your competition entry payment has been processed successfully.
 </p> {/* Payment Details */}
 {paymentDetails && (
 <div className="bg-black/40 border border-[rgba(192,192,192,0.22)] rounded-lg p-6 mb-6 text-left">
 <h3 className="font-semibold text-white mb-4">Payment Details</h3>  <div className="space-y-3 text-sm">
 <div className="flex justify-between">
 <span className="text-gray-400">Entry:</span>
 <span className="font-medium text-white">{paymentDetails.entry_title}</span>
 </div>  <div className="flex justify-between">
 <span className="text-gray-400">Event:</span>
 <span className="font-medium text-white">{paymentDetails.event_name}</span>
 </div>  <div className="flex justify-between">
 <span className="text-gray-400">Amount Paid:</span>
 <span className="font-medium text-[var(--chrome-mid)]">R{paymentDetails.amount.toFixed(2)}</span>
 </div>  <div className="flex justify-between">
 <span className="text-gray-400">Payment ID:</span>
 <span className="font-mono text-xs">{paymentDetails.payment_id}</span>
 </div>  <div className="flex justify-between">
 <span className="text-gray-400">Date:</span>
 <span className="font-medium text-white"> {new Date(paymentDetails.paid_at).toLocaleDateString('en-ZA', {
 year: 'numeric',
 month: 'long',
 day: 'numeric',
 hour: '2-digit',
 minute: '2-digit'
 })}
 </span>
 </div>
 </div>
 </div> )}

 {/* Entry Processing Status */}
 {processingEntries && (
 <div className="bg-black/40 border border-[rgba(192,192,192,0.22)] rounded-lg p-4 mb-6">
 <div className="flex items-center space-x-3">
 <div className="animate-spin rounded-full h-6 w-6 border-2 border-[rgba(192,192,192,0.2)] border-t-[var(--chrome-mid)]"></div>
 <div>
 <h4 className="font-semibold text-white">🔄 Creating Your Entries</h4>
 <p className="text-sm text-gray-400">Processing your competition entries...</p>
 </div>
 </div>
 </div> )}

 {/* Created Entries Display */}
 {entriesProcessed && createdEntries.length > 0 && (
 <div className="bg-black/40 border border-[rgba(192,192,192,0.22)] rounded-lg p-4 mb-6">
 <h4 className="font-semibold text-white mb-3"> Competition Entries Created</h4>
 <div className="space-y-2"> {createdEntries.map((entry, index) => (
 <div key={index} className="flex justify-between items-center text-sm bg-white rounded p-2">
 <div>
 <span className="font-medium text-white">{entry.itemName}</span>
 <span className="text-gray-600 ml-2">({entry.performanceType})</span>
 </div>
 <span className="text-[var(--chrome-mid)] font-medium"> Created</span>
 </div> ))}
 </div>
 <p className="text-xs text-gray-400 mt-2"> Entry IDs: {createdEntries.map(e => e.entryId).join(', ')}
 </p>
 </div> )}

 {/* Next Steps */}
 <div className="bg-black/40 border border-[rgba(192,192,192,0.22)] rounded-lg p-4 mb-6">
 <h4 className="font-semibold text-white mb-2"> What's Next?</h4>
 <ul className="text-sm text-gray-400 text-left space-y-1"> {entriesProcessed ? (
 <>
 <li>• Your {createdEntries.length} competition {createdEntries.length === 1 ? 'entry is' : 'entries are'} now confirmed and active</li>
 <li>• You'll receive a confirmation email shortly</li>
 <li>• Check your dashboard for entry status updates</li>
 <li>• Prepare for your competition performance!</li>
 </> ) : (
 <>
 <li>• Your payment has been processed successfully</li>
 <li>• Your competition entries are being created</li>
 <li>• You'll receive confirmation once entries are ready</li>
 <li>• Check your dashboard for status updates</li>
 </> )}
 </ul>
 </div> {/* Action Buttons */}
 <div className="space-y-3">
 <Link 
 href={dashboardHref}
 className="btn-chrome w-full justify-center" >
 {payerType === 'studio' ? 'Go to Studio Dashboard' : 'Go to Dashboard'}
 </Link>  <div className="flex space-x-3"> {payerType === 'studio' ? (
 <Link 
 href="/studio-login" className="btn-outline-chrome flex-1 justify-center !py-2 !px-4 text-sm" >
 Studio Login
 </Link> ) : (
 <Link 
 href="/dancer-dashboard" className="btn-chrome flex-1 justify-center !py-2 !px-4 text-sm" >
 {dashboardLabel}
 </Link> )}
 
 <button
 onClick={() => window.print()}
 className="btn-outline-chrome flex-1 justify-center !py-2 !px-4 text-sm" >
 Print Receipt
 </button>
 </div>
 </div> {/* Support Link */}
 <p className="text-xs text-gray-400 mt-6"> Need help? <Link href="/contact" className="text-[var(--chrome-mid)] hover:underline">Contact Support</Link>
 </p>
 </div>
 </div>
 </div> );
}

export default function PaymentSuccessPage() {
 return (
 <Suspense fallback={
 <div className="min-h-screen avalon-mesh flex items-center justify-center">
 <div className="glass-panel border border-[rgba(192,192,192,0.22)] rounded-2xl p-8 max-w-md w-full mx-4">
 <div className="text-center">
 <div className="animate-spin rounded-full h-16 w-16 border-2 border-[rgba(192,192,192,0.2)] border-t-[var(--chrome-mid)] mx-auto mb-4"></div>
 <h2 className="font-display text-xl chrome-text">Loading payment details...</h2>
 </div>
 </div>
 </div> }>
 <PaymentSuccessContent />
 </Suspense> );
}
