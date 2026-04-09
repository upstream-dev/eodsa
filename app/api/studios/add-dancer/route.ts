import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb, initializeDatabase } from '@/lib/database';

// Add a registered dancer directly to a studio by EODSA ID
export async function POST(request: NextRequest) {
  try {
    // // // await initializeDatabase() // Commented out for performance - initialization happens once on server start; // Commented out for performance - initialization happens once on server start // Commented out for performance - initialization happens once on server start
    
    const { studioId, eodsaId, addedBy } = await request.json();

    if (!studioId || !eodsaId || !addedBy) {
      return NextResponse.json(
        { error: 'Studio ID, EODSA ID, and added by are required' },
        { status: 400 }
      );
    }

    // Validate EODSA ID format (should be like "E123456")
    const eodsaIdRegex = /^E\d{6}$/;
    if (!eodsaIdRegex.test(eodsaId)) {
      return NextResponse.json(
        { error: 'Invalid EODSA ID format. Should be E followed by 6 digits (e.g., E123456)' },
        { status: 400 }
      );
    }

    const result = await unifiedDb.addDancerToStudioByEodsaId(studioId, eodsaId, addedBy);

    return NextResponse.json({
      success: true,
      message: 'Dancer added to studio successfully',
      application: result
    });
  } catch (error: any) {
    console.error('Error adding dancer to studio:', error);
    
    // Handle duplicate/conflict errors with friendlier messaging
    if (
      error?.message?.includes('studio_applications_dancer_id_studio_id_key') ||
      error?.message?.includes('duplicate key') ||
      error?.message?.includes('already a member') ||
      error?.message?.includes('pending application')
    ) {
      return NextResponse.json(
        { error: error.message || 'This dancer already has a studio link for this studio' },
        { status: 409 }
      );
    }

    // Handle specific error messages
    if (error.message) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to add dancer to studio' },
      { status: 500 }
    );
  }
} 