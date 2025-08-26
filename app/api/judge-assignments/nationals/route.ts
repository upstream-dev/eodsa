import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { judgeId, region, assignedBy } = body;

    if (!judgeId || !region || !assignedBy) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get all events in the specified region
    const events = await db.getAllEvents();
    const regionEvents = events.filter(event => 
      event.region.toLowerCase() === region.toLowerCase()
    );

    if (regionEvents.length === 0) {
      return NextResponse.json(
        { success: false, error: `No events found in ${region}` },
        { status: 400 }
      );
    }

    // Create judge assignments for all events in the region
    const createdAssignments = [];
    let skippedCount = 0;

    for (const event of regionEvents) {
      try {
        const assignment = await db.createJudgeEventAssignment({
          judgeId,
          eventId: event.id,
          assignedBy
        });
        createdAssignments.push(assignment);
      } catch (error: any) {
        if (error.message.includes('already assigned')) {
          skippedCount++;
          continue;
        }
        throw error;
      }
    }

    console.log(`✅ Judge assigned to ${createdAssignments.length} nationals events in ${region}`);

    return NextResponse.json({
      success: true,
      assignedCount: createdAssignments.length,
      skippedCount,
      region,
      message: `Judge assigned to ${createdAssignments.length} events in ${region}${skippedCount > 0 ? ` (${skippedCount} already assigned)` : ''}`
    });
  } catch (error) {
    console.error('Error creating nationals judge assignment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create nationals assignment' },
      { status: 500 }
    );
  }
} 