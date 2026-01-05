import { NextRequest, NextResponse } from 'next/server';
import { db, unifiedDb, getSql } from '@/lib/database';
import { isPhase2Enabled, getFeatureUnavailableMessage } from '@/lib/feature-flags';

export async function GET(request: NextRequest) {
  // Check Phase 2 feature flag - block Media Upload Tracking
  if (!isPhase2Enabled()) {
    return NextResponse.json(
      { success: false, error: getFeatureUnavailableMessage() },
      { status: 403 }
    );
  }

  try {
    console.log('🎼 Admin Music Tracking: Fetching approved entries...');

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url);
    const entryTypeFilter = searchParams.get('entryType') as 'live' | 'virtual' | null;
    const eventIdFilter = searchParams.get('eventId');

    console.log(`🔍 Filters applied - entryType: ${entryTypeFilter}, eventId: ${eventIdFilter}`);

    // Get all approved entries
    const allEntries = await db.getAllEventEntries();
    let approvedEntries = allEntries.filter(entry => entry.approved === true);

    // Apply filters
    if (entryTypeFilter) {
      approvedEntries = approvedEntries.filter(entry => entry.entryType === entryTypeFilter);
      console.log(`📋 Filtered to ${entryTypeFilter} entries: ${approvedEntries.length}`);
    }

    if (eventIdFilter) {
      approvedEntries = approvedEntries.filter(entry => entry.eventId === eventIdFilter);
      console.log(`📅 Filtered to event ${eventIdFilter}: ${approvedEntries.length}`);
    }

    console.log(`📊 Found ${approvedEntries.length} approved entries`);

    // Get additional data for each entry
    const entriesWithDetails = await Promise.all(
      approvedEntries.map(async (entry) => {
        try {
          // Get event details
          const events = await db.getAllEvents();
          const event = events.find(e => e.id === entry.eventId);

          // Get dancer names using participantIds
          let contestantName = 'Unknown Contestant';
          let studioName = 'Independent';
          
          try {
            const sqlClient = getSql();
            
            console.log(`🔍 DEBUG: Entry ${entry.id} participantIds:`, entry.participantIds);
            console.log(`🔍 DEBUG: participantIds type:`, typeof entry.participantIds);
            console.log(`🔍 DEBUG: participantIds isArray:`, Array.isArray(entry.participantIds));
            
            if (entry.participantIds && Array.isArray(entry.participantIds) && entry.participantIds.length > 0) {
              console.log(`🔍 DEBUG: Looking for dancers with IDs: ${entry.participantIds.join(', ')}`);
              
              // Try as dancer IDs first
              const dancerResults = await sqlClient`
                SELECT id, name FROM dancers WHERE id = ANY(${entry.participantIds})
              ` as any[];
              
              console.log(`🔍 DEBUG: Found ${dancerResults.length} dancers by ID`);
              
              if (dancerResults.length > 0) {
                const names = dancerResults.map(d => d.name);
                contestantName = names.join(', ');
                console.log(`✅ Found dancer names: ${contestantName}`);
              } else {
                // Try as EODSA IDs
                console.log(`🔍 DEBUG: Trying as EODSA IDs...`);
                const eodsaResults = await sqlClient`
                  SELECT id, name, eodsa_id FROM dancers WHERE eodsa_id = ANY(${entry.participantIds})
                ` as any[];
                
                console.log(`🔍 DEBUG: Found ${eodsaResults.length} dancers by EODSA ID`);
                
                if (eodsaResults.length > 0) {
                  const names = eodsaResults.map(d => d.name);
                  contestantName = names.join(', ');
                  console.log(`✅ Found dancer names by EODSA ID: ${contestantName}`);
                } else {
                  console.warn(`❌ No dancers found with IDs or EODSA IDs: ${entry.participantIds.join(', ')}`);
                }
              }
            } else {
              console.warn(`❌ No valid participantIds for entry ${entry.id}`);
            }
          } catch (error) {
            console.error(`❌ Error fetching dancers for entry ${entry.id}:`, error);
          }

          return {
            ...entry,
            eventName: event?.name || 'Unknown Event',
            eventDate: event?.eventDate || null,
            venue: event?.venue || 'TBD',
            contestantName,
            studioName
          };
        } catch (error) {
          console.error('Error getting details for entry:', entry.id, error);
          return {
            ...entry,
            eventName: 'Unknown Event',
            eventDate: null,
            venue: 'TBD',
            contestantName: 'Unknown Contestant',
            studioName: 'Independent'
          };
        }
      })
    );

    // Sort by event date and entry type (live entries first, then by missing music)
    const sortedEntries = entriesWithDetails.sort((a, b) => {
      // Prioritize live entries without music first
      if (a.entryType === 'live' && !a.musicFileUrl && (b.entryType !== 'live' || b.musicFileUrl)) {
        return -1;
      }
      if (b.entryType === 'live' && !b.musicFileUrl && (a.entryType !== 'live' || a.musicFileUrl)) {
        return 1;
      }
      
      // Then sort by event date
      const dateA = a.eventDate ? new Date(a.eventDate).getTime() : 0;
      const dateB = b.eventDate ? new Date(b.eventDate).getTime() : 0;
      return dateA - dateB;
    });

    console.log(`✅ Returning ${sortedEntries.length} entries with details`);

    return NextResponse.json({
      success: true,
      entries: sortedEntries,
      summary: {
        total: sortedEntries.length,
        withMusic: sortedEntries.filter(entry => entry.musicFileUrl).length,
        missingMusic: sortedEntries.filter(entry => !entry.musicFileUrl && entry.entryType === 'live').length,
        virtual: sortedEntries.filter(entry => entry.entryType === 'virtual').length
      }
    });

  } catch (error: any) {
    console.error('Error in music tracking API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch music tracking data',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
