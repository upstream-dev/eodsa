import { NextResponse } from 'next/server';
import { isPhase2Enabled } from '@/lib/feature-flags';

/**
 * API endpoint to check Phase 2 feature flag status
 * Used by client-side components
 */
export async function GET() {
  return NextResponse.json({
    enabled: isPhase2Enabled()
  });
}
