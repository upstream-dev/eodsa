import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAllContestantEntriesForDancer } from '@/lib/contestant-entries';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { entryId, musicFileUrl, musicFileName, eodsaId } = body;
    
    if (!entryId || !musicFileUrl || !musicFileName || !eodsaId) {
      return NextResponse.json(
        { success: false, error: 'Entry ID, music file URL, filename, and EODSA ID are required' },
        { status: 400 }
      );
    }

    const contestantEntries = await getAllContestantEntriesForDancer(eodsaId);
    const entry = contestantEntries.find((e) => e.id === entryId);
    
    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Entry not found or access denied. You must be the entry owner or a group participant to upload music.' },
        { status: 404 }
      );
    }
    
    if (entry.entryType !== 'live') {
      return NextResponse.json(
        { success: false, error: 'Only live entries can have music uploaded' },
        { status: 400 }
      );
    }

    await db.updateEventEntry(entryId, {
      musicFileUrl,
      musicFileName,
    });
    
    return NextResponse.json({
      success: true,
      message: 'Music uploaded successfully',
      entry: {
        ...entry,
        musicFileUrl,
        musicFileName,
      },
    });
    
  } catch (error: unknown) {
    console.error('Error uploading music for entry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload music' },
      { status: 500 }
    );
  }
}
