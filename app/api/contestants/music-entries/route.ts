import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import {
  getAllContestantEntriesForDancer,
  normalizeEntryEventId,
} from '@/lib/contestant-entries';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eodsaId = searchParams.get('eodsaId');
    
    if (!eodsaId) {
      return NextResponse.json(
        { success: false, error: 'EODSA ID is required' },
        { status: 400 }
      );
    }

    const contestantEntries = await getAllContestantEntriesForDancer(eodsaId);
    const entriesNeedingMusic = contestantEntries.filter(
      (entry) => entry.entryType === 'live' && !entry.musicFileUrl
    );
    
    const events = await db.getAllEvents();

    const entriesWithDetails = entriesNeedingMusic.map((entry) => {
      try {
        const eventId = normalizeEntryEventId(entry);
        const event = events.find((e) => e.id === eventId);
        
        return {
          ...entry,
          eventId,
          eventName: event?.name || 'Unknown Event',
          eventDate: event?.eventDate || null,
          venue: event?.venue || 'TBD',
        };
      } catch (error) {
        console.error('Error getting event details for entry:', entry.id, error);
        return {
          ...entry,
          eventId: normalizeEntryEventId(entry),
          eventName: 'Unknown Event',
          eventDate: null,
          venue: 'TBD',
        };
      }
    });
    
    return NextResponse.json({
      success: true,
      entries: entriesWithDetails,
      total: entriesWithDetails.length,
    });
    
  } catch (error: unknown) {
    console.error('Error fetching contestant music entries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch entries' },
      { status: 500 }
    );
  }
}
