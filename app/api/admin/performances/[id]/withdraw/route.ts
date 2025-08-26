import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const performanceId = id;
    const { action } = await request.json();

    if (!performanceId) {
      return NextResponse.json(
        { success: false, error: 'Performance ID is required' },
        { status: 400 }
      );
    }

    if (!action || !['withdraw', 'restore'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Action must be either "withdraw" or "restore"' },
        { status: 400 }
      );
    }

    // Verify the performance exists
    const performance = await db.getPerformanceById(performanceId);
    if (!performance) {
      return NextResponse.json(
        { success: false, error: 'Performance not found' },
        { status: 404 }
      );
    }

    let result;
    let message;

    if (action === 'withdraw') {
      result = await db.withdrawPerformanceFromJudging(performanceId);
      message = 'Performance withdrawn from judging successfully';
    } else {
      result = await db.restorePerformanceToJudging(performanceId);
      message = 'Performance restored to judging successfully';
    }

    return NextResponse.json({
      success: true,
      message,
      performanceId,
      action
    });

  } catch (error) {
    console.error('Error updating performance withdrawal status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update performance withdrawal status' },
      { status: 500 }
    );
  }
} 