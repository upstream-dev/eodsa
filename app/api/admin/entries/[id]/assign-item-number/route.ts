import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entryId = id;
    const { itemNumber, programType } = await request.json();

    // Validate input
    if (!itemNumber || itemNumber < 1) {
      return NextResponse.json(
        { error: 'Valid item number is required' },
        { status: 400 }
      );
    }

    const allEntries = await db.getAllEventEntries();
    const currentEntry = allEntries.find(entry => entry.id === entryId);

    if (!currentEntry) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }

    // Item numbers are unique per event, not globally across all events.
    const existingEntry = allEntries.find(entry => entry.eventId === currentEntry.eventId &&
      entry.itemNumber === itemNumber &&
      entry.id !== entryId
    );

    if (existingEntry) {
      return NextResponse.json(
        { error: `Item number ${itemNumber} is already assigned to another entry` },
        { status: 400 }
      );
    }

    // Update the entry with the item number (support separate numbering for virtual program)
    const entryUpdates: any = { itemNumber };
    if (programType === 'virtual') {
      entryUpdates.virtualItemNumber = itemNumber;
    }
    await db.updateEventEntry(entryId, entryUpdates);

    // AUTO-SYNC: Update/create the corresponding performance so it appears on
    // backstage / judge / announcer dashboards (not just the admin entries list).
    try {
      const { ensurePerformanceForEntry } = await import('@/lib/ensure-performance');
      const { getSql } = await import('@/lib/database');
      const sqlClient = getSql();
      const entryRows = await sqlClient`
        SELECT
          id, event_id, item_name, contestant_id, participant_ids,
          choreographer, mastery, item_style, estimated_duration, item_number,
          entry_type, music_file_url, music_file_name,
          video_external_url, video_external_type, approved
        FROM event_entries
        WHERE id = ${entryId}
        LIMIT 1
      ` as any[];

      if (entryRows.length > 0 && entryRows[0].approved) {
        const result = await ensurePerformanceForEntry(entryRows[0], {
          itemNumberOverride: itemNumber
        });
        if (result?.created) {
          console.log(`Created missing performance ${result.performanceId} for entry ${entryId} with item #${itemNumber}`);
        } else if (result) {
          console.log(`Auto-synced item number ${itemNumber} to performance ${result.performanceId}`);
        }
      }
    } catch (syncError) {
      console.warn('Failed to auto-sync/create performance:', syncError);
      // Don't fail the whole request if sync fails
    }

    return NextResponse.json({
      success: true,
      message: `Item number ${itemNumber} assigned successfully`
    });

  } catch (error) {
    console.error('Error assigning item number:', error);
    return NextResponse.json(
      { error: 'Failed to assign item number' },
      { status: 500 }
    );
  }
} 