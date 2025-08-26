import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb, initializeDatabase } from '@/lib/database';

// Admin-only: Delete a competition entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initializeDatabase();
    
    const { id } = await params;
    const entryId = id;
    
    // Get admin ID from request body
    const body = await request.json();
    const { adminId } = body;
    
    if (!adminId) {
      return NextResponse.json(
        { error: 'Admin ID is required' },
        { status: 400 }
      );
    }
    
    const result = await unifiedDb.deleteEntryAsAdmin(adminId, entryId);
    
    return NextResponse.json({
      success: true,
      message: result.message
    });
    
  } catch (error: any) {
    console.error('Error deleting entry:', error);
    
    if (error.message.includes('Admin privileges required')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    
    if (error.message.includes('not found')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete entry' },
      { status: 500 }
    );
  }
} 