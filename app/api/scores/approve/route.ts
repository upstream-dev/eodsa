import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { performanceId, approvedBy, action } = body;

    if (!performanceId || !approvedBy || !action) {
      return NextResponse.json(
        { success: false, error: 'Performance ID, approver ID, and action are required' },
        { status: 400 }
      );
    }

    // Derive base URL from request URL to ensure it works in all environments
    let baseUrl: string;
    try {
      const requestUrl = new URL(request.url);
      baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    } catch (urlError) {
      // Fallback to environment variables if URL parsing fails
      baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    }

    let result;
    if (action === 'publish') {
      // Publish scores to make them visible to contestants/teachers
      result = await db.publishPerformanceScores(performanceId, approvedBy, baseUrl);

      return NextResponse.json({
        success: true,
        message: 'Scores published successfully',
        result
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use "publish"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error processing score approval:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process score approval' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const performanceId = searchParams.get('performanceId');

    const approvals = await db.getScoreApprovals(performanceId || undefined);

    return NextResponse.json({
      success: true,
      approvals
    });
  } catch (error) {
    console.error('Error fetching score approvals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch score approvals' },
      { status: 500 }
    );
  }
}

