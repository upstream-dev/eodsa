import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const assignmentId = id;
    
    // Verify admin authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    // Remove the judge assignment
    await db.removeJudgeEventAssignment(assignmentId);

    return NextResponse.json({
      success: true,
      message: 'Judge unassigned successfully'
    });

  } catch (error: any) {
    console.error('Error removing judge assignment:', error);
    return NextResponse.json(
      { error: 'Failed to unassign judge' },
      { status: 500 }
    );
  }
} 