import { NextResponse } from 'next/server';
import { unifiedDb, initializeDatabase } from '@/lib/database';

// Get all studio applications for admin overview
export async function GET() {
  try {
    // // // await initializeDatabase() // Commented out for performance - initialization happens once on server start; // Commented out for performance - initialization happens once on server start // Commented out for performance - initialization happens once on server start
    
    const applications = await unifiedDb.getAllStudioApplications();

    return NextResponse.json({
      success: true,
      applications
    });
  } catch (error) {
    console.error('Error getting studio applications:', error);
    return NextResponse.json(
      { error: 'Failed to get studio applications' },
      { status: 500 }
    );
  }
} 