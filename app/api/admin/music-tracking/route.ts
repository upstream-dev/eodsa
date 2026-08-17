import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { isPhase2Enabled, getFeatureUnavailableMessage } from '@/lib/feature-flags';
import { resolveEntryDisplay } from '@/lib/resolve-entry-display';

export async function GET(request: NextRequest) {
  if (!isPhase2Enabled()) {
    return NextResponse.json(
      { success: false, error: getFeatureUnavailableMessage() },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const entryTypeFilter = searchParams.get('entryType') as 'live' | 'virtual' | null;
    const eventIdFilter = searchParams.get('eventId');

    const allEntries = await db.getAllEventEntries();
    let approvedEntries = allEntries.filter((entry) => entry.approved === true);

    if (entryTypeFilter) {
      approvedEntries = approvedEntries.filter((entry) => entry.entryType === entryTypeFilter);
    }

    if (eventIdFilter) {
      approvedEntries = approvedEntries.filter((entry) => entry.eventId === eventIdFilter);
    }

    const events = await db.getAllEvents();

    const entriesWithDetails = await Promise.all(
      approvedEntries.map(async (entry) => {
        try {
          const event = events.find((e) => e.id === entry.eventId);
          const display = await resolveEntryDisplay(entry);

          return {
            ...entry,
            eventName: event?.name || 'Unknown Event',
            eventDate: event?.eventDate || null,
            venue: event?.venue || 'TBD',
            contestantName: display.contestantName,
            participantNames: display.participantNames,
            studioName: display.studioName,
            displayEodsaId: display.displayEodsaId,
          };
        } catch (error) {
          console.error('Error getting details for entry:', entry.id, error);
          return {
            ...entry,
            eventName: 'Unknown Event',
            eventDate: null,
            venue: 'TBD',
            contestantName: 'Unknown Contestant',
            participantNames: ['Unknown Contestant'],
            studioName: 'Independent',
            displayEodsaId: entry.eodsaId || 'Unknown',
          };
        }
      })
    );

    const sortedEntries = entriesWithDetails.sort((a, b) => {
      if (a.entryType === 'live' && !a.musicFileUrl && (b.entryType !== 'live' || b.musicFileUrl)) {
        return -1;
      }
      if (b.entryType === 'live' && !b.musicFileUrl && (a.entryType !== 'live' || a.musicFileUrl)) {
        return 1;
      }

      const dateA = a.eventDate ? new Date(a.eventDate).getTime() : 0;
      const dateB = b.eventDate ? new Date(b.eventDate).getTime() : 0;
      return dateA - dateB;
    });

    return NextResponse.json({
      success: true,
      entries: sortedEntries,
      summary: {
        total: sortedEntries.length,
        withMusic: sortedEntries.filter((entry) => entry.musicFileUrl).length,
        missingMusic: sortedEntries.filter((entry) => !entry.musicFileUrl && entry.entryType === 'live').length,
        virtual: sortedEntries.filter((entry) => entry.entryType === 'virtual').length,
      },
    });
  } catch (error: unknown) {
    console.error('Error in music tracking API:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch music tracking data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
