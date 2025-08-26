import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { dancerId, masteryLevel } = await request.json();
    
    if (!dancerId || !masteryLevel) {
      return NextResponse.json(
        { error: 'dancerId and masteryLevel are required' },
        { status: 400 }
      );
    }

    // Check if dancer exists
    try {
      await unifiedDb.getDancerById(dancerId);
    } catch (error) {
      return NextResponse.json(
        { error: 'Dancer not found' },
        { status: 404 }
      );
    }

    // Mark registration fee as paid
    await unifiedDb.markRegistrationFeePaid(dancerId, masteryLevel);
    
    return NextResponse.json({
      success: true,
      message: `Registration fee marked as paid for mastery level: ${masteryLevel}`
    });
    
  } catch (error) {
    console.error('Error marking registration fee as paid:', error);
    return NextResponse.json(
      { error: 'Failed to update registration status' },
      { status: 500 }
    );
  }
} 