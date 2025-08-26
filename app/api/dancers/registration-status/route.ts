import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { dancerIds } = await request.json();
    
    if (!dancerIds || !Array.isArray(dancerIds)) {
      return NextResponse.json(
        { error: 'dancerIds array is required' },
        { status: 400 }
      );
    }

    // Get dancers with registration fee status
    const dancers = await unifiedDb.getDancersWithRegistrationStatus(dancerIds);
    
    return NextResponse.json({
      success: true,
      dancers
    });
    
  } catch (error) {
    console.error('Error fetching dancer registration status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch registration status' },
      { status: 500 }
    );
  }
} 