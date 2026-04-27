import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const performanceId = id;
    const body = await request.json();
    const { announced } = body;

    if (typeof announced !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid payload. "announced" must be a boolean.' },
        { status: 400 }
      );
    }

    const updatedPerformance = await db.setPerformanceAnnounced(performanceId, announced);

    if (!updatedPerformance) {
      return NextResponse.json(
        { error: 'Performance not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      performance: updatedPerformance
    });
  } catch (error) {
    console.error('Error toggling performance announced status:', error);
    return NextResponse.json(
      { error: 'Failed to update announced status' },
      { status: 500 }
    );
  }
}
