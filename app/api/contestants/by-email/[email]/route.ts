import { NextRequest, NextResponse } from 'next/server';
import { db, initializeDatabase } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    // await initializeDatabase(); // Commented out for performance - initialization happens once on server start
    
    const { email } = await params;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Decode the email parameter
    const decodedEmail = decodeURIComponent(email);

    // Get contestant by email
    const contestant = await db.getContestantByEmail(decodedEmail);

    if (!contestant) {
      return NextResponse.json(
        { error: 'Contestant not found with this email' },
        { status: 404 }
      );
    }

    return NextResponse.json(contestant);
  } catch (error) {
    console.error('Error getting contestant by email:', error);
    return NextResponse.json(
      { error: 'Failed to get contestant data' },
      { status: 500 }
    );
  }
} 