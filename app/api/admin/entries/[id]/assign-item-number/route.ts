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
    const existingEntry = allEntries.find(entry =>
      entry.eventId === currentEntry.eventId &&
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

    // AUTO-SYNC: Update the corresponding performance as well (or create if missing)
    try {
      const allPerformances = await db.getAllPerformances();
      let performance = allPerformances.find(p => p.eventEntryId === entryId);

      if (performance) {
        await db.updatePerformanceItemNumber(performance.id, itemNumber);
        console.log(`Auto-synced item number ${itemNumber} to performance ${performance.id}`);
      } else {
        // Performance doesn't exist yet - create it (happens for virtual entries)
        const entry = allEntries.find(e => e.id === entryId);
        if (entry && entry.approved) {
          console.log(`Creating missing performance for entry ${entryId} (${entry.entryType})`);

          // Build participant names
          const { unifiedDb } = await import('@/lib/database');
          const participantNames: string[] = [];
          for (let i = 0; i < entry.participantIds.length; i++) {
            const pid = entry.participantIds[i];
            try {
              const dancer = await unifiedDb.getDancerById(pid);
              if (dancer?.name) {
                participantNames.push(dancer.name);
                continue;
              }
            } catch {}
            participantNames.push(`Participant ${i + 1}`);
          }

          await db.createPerformance({
            eventId: entry.eventId,
            eventEntryId: entry.id,
            contestantId: entry.contestantId,
            title: entry.itemName,
            participantNames,
            duration: entry.estimatedDuration || 0,
            itemNumber: itemNumber,
            choreographer: entry.choreographer,
            mastery: entry.mastery,
            itemStyle: entry.itemStyle,
            status: 'scheduled',
            entryType: entry.entryType || 'live',
            videoExternalUrl: entry.videoExternalUrl,
            videoExternalType: entry.videoExternalType,
            musicFileUrl: entry.musicFileUrl,
            musicFileName: entry.musicFileName
          } as any);
          console.log(`✅ Created performance for virtual entry ${entryId}`);
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