import { NextResponse } from 'next/server';
import { db, unifiedDb } from '@/lib/database';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventId = id;
    
    // First check if the event exists
    const event = await db.getEventById(eventId);
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Get all event entries for this event
    const allEntries = await db.getAllEventEntries();
    const eventEntries = allEntries.filter(entry => entry.eventId === eventId);
    
    // Enhance entries with contestant/dancer information
    const enhancedEntries = await Promise.all(
      eventEntries.map(async (entry) => {
        try {
          // First try to get as unified system dancer
          const dancer = await unifiedDb.getDancerById(entry.contestantId);
          
          if (dancer) {
            // This is a unified system dancer
            console.log(`Found unified dancer: ${dancer.name} (${dancer.eodsaId})`);
            
            // Get all participant names for this entry
            const participantNames = await Promise.all(
              entry.participantIds.map(async (participantId) => {
                try {
                  const participant = await unifiedDb.getDancerById(participantId);
                  return participant ? participant.name : 'Unknown Dancer';
                } catch (error) {
                  console.error(`Error fetching participant ${participantId}:`, error);
                  return 'Unknown Dancer';
                }
              })
            );
            
            return {
              ...entry,
              contestantName: dancer.name,
              contestantEmail: dancer.email || '',
              participantNames: participantNames
            };
          } else {
            // Try legacy contestant system
            const contestant = await db.getContestantById(entry.contestantId);
            if (contestant) {
              console.log(`Found legacy contestant: ${contestant.name} (${contestant.eodsaId})`);
              return {
                ...entry,
                contestantName: contestant.name,
                contestantEmail: contestant.email || '',
                participantNames: entry.participantIds.map(id => {
                  const dancer = contestant.dancers.find(d => d.id === id);
                  return dancer?.name || 'Unknown Dancer';
                })
              };
            } else {
              console.error(`Could not find contestant or dancer for ID: ${entry.contestantId}`);
              return {
                ...entry,
                contestantName: 'Unknown (Not Found)',
                contestantEmail: '',
                participantNames: ['Unknown Dancer']
              };
            }
          }
        } catch (error) {
          console.error(`Error loading contestant/dancer ${entry.contestantId}:`, error);
          return {
            ...entry,
            contestantName: 'Error loading',
            contestantEmail: '',
            participantNames: ['Error loading dancers']
          };
        }
      })
    );

    console.log(`Enhanced ${enhancedEntries.length} entries for event ${eventId}`);
    
    return NextResponse.json({
      success: true,
      entries: enhancedEntries
    });
  } catch (error) {
    console.error('Error fetching event entries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch event entries' },
      { status: 500 }
    );
  }
} 