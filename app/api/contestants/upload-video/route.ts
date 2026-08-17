import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { getAllContestantEntriesForDancer } from '@/lib/contestant-entries';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { entryId, videoFileUrl, videoFileName, videoExternalUrl, videoExternalType, eodsaId } = body;
    
    if (!entryId || !eodsaId) {
      return NextResponse.json(
        { success: false, error: 'Entry ID and EODSA ID are required' },
        { status: 400 }
      );
    }

    if (!videoExternalUrl && !videoFileUrl) {
      return NextResponse.json(
        { success: false, error: 'Video URL or video file URL is required' },
        { status: 400 }
      );
    }

    const contestantEntries = await getAllContestantEntriesForDancer(eodsaId);
    const entry = contestantEntries.find((e) => e.id === entryId);
    
    if (!entry) {
      return NextResponse.json(
        { success: false, error: 'Entry not found or access denied. You must be the entry owner or a group participant to upload video.' },
        { status: 404 }
      );
    }
    
    if (entry.entryType !== 'virtual' && !entry.nationalsEventId) {
      return NextResponse.json(
        { success: false, error: 'Only virtual entries can have video uploaded' },
        { status: 400 }
      );
    }

    const updates: Record<string, string> = {};
    if (videoExternalUrl) {
      updates.videoExternalUrl = videoExternalUrl;
      if (videoExternalType) {
        updates.videoExternalType = videoExternalType;
      }
    } else if (videoFileUrl) {
      updates.videoFileUrl = videoFileUrl;
      if (videoFileName) {
        updates.videoFileName = videoFileName;
      }
    }
    
    await db.updateEventEntry(entryId, updates);
    
    return NextResponse.json({
      success: true,
      message: videoExternalUrl ? 'Video link saved successfully' : 'Video uploaded successfully',
      entry: {
        ...entry,
        ...updates,
      },
    });
    
  } catch (error: unknown) {
    console.error('Error uploading video for contestant entry:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
