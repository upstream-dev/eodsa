import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function POST() {
  try {
    await db.updateEventStatuses();
    
    return NextResponse.json({
      success: true,
      message: 'Event statuses updated successfully'
    });
  } catch (error) {
    console.error('Error updating event statuses:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update event statuses' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await db.updateEventStatuses();
    
    return NextResponse.json({
      success: true,
      message: 'Event statuses updated successfully'
    });
  } catch (error) {
    console.error('Error updating event statuses:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update event statuses' },
      { status: 500 }
    );
  }
} 