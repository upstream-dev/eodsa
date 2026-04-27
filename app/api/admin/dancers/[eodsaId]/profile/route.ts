import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';
import { getAgeCategoryFromAge, getMedalFromPercentage } from '@/lib/types';

// Types for DB rows
interface DancerRow {
  id: string;
  eodsa_id: string;
  name: string;
  age: number | null;
  date_of_birth: string | null;
  approved: boolean | null;
  registration_fee_mastery_level?: string | null;
  studio_id?: string | null; // if present in schema
}

interface StudioRow {
  id: string;
  name: string;
  registration_number: string | null;
}

interface ContestantRow {
  id: string;
  eodsa_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: string | null;
  studio_name: string | null;
  studio_registration_number: string | null;
}

interface EventEntryRow {
  id: string;
  event_id: string;
  contestant_id: string;
  eodsa_id: string;
  payment_reference?: string | null;
  item_name: string | null;
  entry_type: 'live' | 'virtual' | null;
  performance_type: string | null;
  mastery: string | null;
  submitted_at: string | null;
  payment_status: string | null;
  item_number: number | null;
  virtual_item_number: number | null;
  qualified_for_nationals: boolean | null;
  music_file_url?: string | null;
  video_file_url?: string | null;
  calculated_fee?: number | null;
}

interface EventRow {
  id: string;
  name: string;
  event_date: string | null;
  region: string | null;
}

interface PerformanceRow {
  id: string;
  event_entry_id: string | null;
  event_id: string;
  title: string | null;
  scores_published: boolean | null;
  event_type?: string | null;
}

interface RankingRow {
  performance_id: string;
  rank: number | null;
  final_score: number | null;
  medal_awarded: string | null;
}

type SupportedEventType =
  | 'REGIONAL_EVENT'
  | 'NATIONAL_EVENT'
  | 'QUALIFIER_EVENT'
  | 'INTERNATIONAL_VIRTUAL_EVENT';

function normalizeEventType(eventType?: string | null): SupportedEventType {
  if (
    eventType === 'REGIONAL_EVENT' ||
    eventType === 'NATIONAL_EVENT' ||
    eventType === 'QUALIFIER_EVENT' ||
    eventType === 'INTERNATIONAL_VIRTUAL_EVENT'
  ) {
    return eventType;
  }

  return 'NATIONAL_EVENT';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eodsaId: string }> }
) {
  try {
    const { eodsaId } = await params;
    if (!eodsaId) {
      return NextResponse.json({ success: false, error: 'eodsaId is required' }, { status: 400 });
    }

    const sql = getSql();

    // 1) Fetch Dancer Details (by dancers.eodsa_id) with Studio Information
    let dancerRows: any[];
    try {
      dancerRows = (await sql`
        SELECT 
          d.id, 
          d.eodsa_id, 
          d.name, 
          d.age, 
          d.date_of_birth, 
          d.approved,
          d.registration_fee_mastery_level,
          s.id as studio_id,
          s.name as studio_name,
          s.registration_number as studio_registration_number
        FROM dancers d
        LEFT JOIN studio_applications sa ON d.id = sa.dancer_id AND sa.status = 'accepted'
        LEFT JOIN studios s ON sa.studio_id = s.id
        WHERE d.eodsa_id = ${eodsaId}
        LIMIT 1
      `) as unknown as any[];
    } catch (dbError: any) {
      console.error('Database error fetching dancer:', dbError);
      return NextResponse.json(
        { success: false, error: 'Database error: ' + (dbError?.message || 'Unknown error') },
        { status: 500 }
      );
    }

    if (dancerRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Dancer not found' }, { status: 404 });
    }
    const dancer = dancerRows[0];

    // 2) Fetch contestant record (for legacy entries and studio fallback)
    let contestant: ContestantRow | null = null;
    try {
      const contestantRows = (await sql`
        SELECT id, eodsa_id, name, email, phone, type, studio_name, studio_registration_number
        FROM contestants
        WHERE eodsa_id = ${eodsaId}
        LIMIT 1
      `) as unknown as ContestantRow[];
      contestant = contestantRows.length > 0 ? contestantRows[0] : null;
    } catch (dbError: any) {
      console.error('Database error fetching contestant:', dbError);
      // Continue without contestant data - not critical
    }

    // 3) Resolve Studio (from initial query or fallback to contestants record)
    let studio: { id: string | null; name: string | null; registrationNumber: string | null } | null =
      null;

    // Use studio information from the initial query if available
    if (dancer.studio_id && dancer.studio_name) {
      studio = {
        id: dancer.studio_id,
        name: dancer.studio_name,
        registrationNumber: dancer.studio_registration_number,
      };
    } else if (contestant?.studio_name) {
      // Fallback: Try contestants record to infer studio linkage
      // Try find studio row by name or registration number
      const studioRows = (await sql`
        SELECT id, name, registration_number
        FROM studios
        WHERE name = ${contestant.studio_name}
           OR registration_number = ${contestant.studio_registration_number || ''}
        LIMIT 1
      `) as unknown as StudioRow[];

      if (studioRows.length > 0) {
        const s = studioRows[0];
        studio = { id: s.id, name: s.name, registrationNumber: s.registration_number };
      } else {
        studio = {
          id: null,
          name: contestant.studio_name,
          registrationNumber: contestant.studio_registration_number,
        };
      }
    }

    // 4) Fetch Event History (event_entries joined with events)
    // Check multiple relationships: contestant_id, eodsa_id, and participant_ids array
    const history: Array<
      EventEntryRow & {
        event_name: string | null;
        event_date: string | null;
        event_year: number | null;
        region: string | null;
        performance: {
          id: string;
          title: string | null;
          scoresPublished: boolean;
        } | null;
        ranking: {
          rank: number | null;
          score: number | null;
          medal: string | null;
        } | null;
      }
    > = [];

    try {
      console.log(`[Dancer Profile] Fetching entries for dancer: ${dancer.name} (${eodsaId})`);
      
      // Import db to use getAllEventEntries and getAllNationalsEventEntries (more reliable)
      const { db } = await import('@/lib/database');
      
      // Get ALL entries from both tables (more reliable than complex SQL queries)
      const regularEntries = await db.getAllEventEntries();
      const nationalsEntries = await db.getAllNationalsEventEntries();
      const allEntries = [...regularEntries, ...nationalsEntries];
      
      console.log(`[Dancer Profile] Total entries in DB: ${allEntries.length} (regular: ${regularEntries.length}, nationals: ${nationalsEntries.length})`);
      
      // Filter entries for this dancer - check both EODSA ID and internal dancer ID
      const dancerEntries = allEntries.filter(entry => {
        // Include if dancer owns the entry
        if (entry.eodsaId === eodsaId || entry.eodsaId === dancer.eodsa_id) {
          return true;
        }
        
        // Include if dancer is a participant in group entries
        if (entry.participantIds && Array.isArray(entry.participantIds)) {
          // Check both EODSA ID formats and internal dancer ID
          const isParticipantByEodsaId = entry.participantIds.includes(eodsaId) || entry.participantIds.includes(dancer.eodsa_id);
          const isParticipantByInternalId = entry.participantIds.includes(dancer.id);
          
          if (isParticipantByEodsaId || isParticipantByInternalId) {
            return true;
          }
        }
        
        // Also check contestant_id matches
        if (entry.contestantId === dancer.id || entry.contestantId === eodsaId || entry.contestantId === dancer.eodsa_id) {
          return true;
        }
        
        return false;
      });
      
      console.log(`[Dancer Profile] Found ${dancerEntries.length} entries for this dancer`);
      
      // Get all events for lookup
      const allEvents = await db.getAllEvents();
      
      // Process each entry to get event details, performance, and ranking data
      for (const entry of dancerEntries) {
        try {
          // Get event ID (could be eventId or nationalsEventId)
          const eventId = (entry as any).eventId || (entry as any).nationalsEventId;
          const event = allEvents.find(e => e.id === eventId);
          
          // Extract year from event date
          let eventYear = null;
          if (event?.eventDate) {
            try {
              const date = new Date(event.eventDate);
              eventYear = date.getFullYear();
            } catch {
              const yearMatch = event.eventDate.match(/\d{4}/);
              if (yearMatch) {
                eventYear = parseInt(yearMatch[0]);
              }
            }
          }
          
          // Get performance and ranking data
          let performanceData = null;
          let rankingData = null;
          
          try {
            // Find performance linked to this entry
            const performanceRows = (await sql`
                SELECT id, event_entry_id, event_id, title, scores_published, event_type
              FROM performances
                LEFT JOIN events ON events.id = performances.event_id
              WHERE event_entry_id = ${entry.id}
              LIMIT 1
            `) as PerformanceRow[];
            
            if (performanceRows.length === 0) {
              // For nationals, try by performance ID matching entry ID
              const performanceRowsById = (await sql`
                SELECT id, event_entry_id, event_id, title, scores_published, event_type
                FROM performances
                LEFT JOIN events ON events.id = performances.event_id
                WHERE id = ${entry.id}
                LIMIT 1
              `) as PerformanceRow[];
              
              if (performanceRowsById.length > 0) {
                performanceRows.push(performanceRowsById[0]);
              }
            }
            
            if (performanceRows.length > 0) {
              const performance = performanceRows[0];
              performanceData = {
                id: performance.id,
                title: performance.title,
                scoresPublished: performance.scores_published || false,
              };
              
              // Get ranking data if scores are published
              if (performance.scores_published) {
                const rankingRows = (await sql`
                  SELECT performance_id, rank, final_score, medal_awarded
                  FROM rankings
                  WHERE performance_id = ${performance.id}
                  LIMIT 1
                `) as RankingRow[];
                
                if (rankingRows.length > 0) {
                  const ranking = rankingRows[0];
                  
                  // If no medal but we have a score, calculate it
                  let medal = ranking.medal_awarded;
                  if (!medal && ranking.final_score !== null) {
                    const medalInfo = getMedalFromPercentage(
                      ranking.final_score,
                      normalizeEventType(performance.event_type)
                    );
                    medal = medalInfo.label;
                  }
                  
                  rankingData = {
                    rank: ranking.rank,
                    score: ranking.final_score,
                    medal: medal,
                  };
                } else {
                  // Try to get score from scores table if no ranking exists
                  const scoreRows = (await sql`
                    SELECT 
                      AVG(technical_score + musical_score + performance_score + styling_score + overall_impression_score) as avg_score,
                      COUNT(*) as judge_count
                    FROM scores
                    WHERE performance_id = ${performance.id}
                  `) as any[];
                  
                  if (scoreRows.length > 0 && scoreRows[0].avg_score !== null) {
                    const avgScore = parseFloat(scoreRows[0].avg_score);
                    const medalInfo = getMedalFromPercentage(
                      avgScore,
                      normalizeEventType(performance.event_type)
                    );
                    rankingData = {
                      rank: null,
                      score: avgScore,
                      medal: medalInfo.label,
                    };
                  }
                }
              }
            }
          } catch (perfError) {
            console.error(`[Dancer Profile] Error fetching performance data for entry ${entry.id}:`, perfError);
            // Continue without performance data
          }
          
          // Type assertion to access all properties safely
          const entryAny = entry as any;
          
          history.push({
            id: entry.id,
            event_id: eventId || null,
            contestant_id: entry.contestantId || null,
            eodsa_id: entry.eodsaId || null,
            payment_reference: entryAny.paymentReference || null,
            item_name: entry.itemName || null,
            entry_type: entryAny.entryType || null,
            performance_type: entry.performanceType || null,
            mastery: entry.mastery || null,
            submitted_at: entry.submittedAt || null,
            payment_status: entry.paymentStatus || null,
            item_number: entryAny.itemNumber || null,
            virtual_item_number: entryAny.virtualItemNumber || null,
            qualified_for_nationals: entry.qualifiedForNationals || null,
            music_file_url: entryAny.musicFileUrl || null,
            video_file_url: entryAny.videoFileUrl || null,
            calculated_fee: entry.calculatedFee || null,
            event_name: event?.name || null,
            event_date: event?.eventDate || null,
            event_year: eventYear,
            region: event?.region || null,
            performance: performanceData,
            ranking: rankingData,
          });
        } catch (entryError) {
          console.error(`[Dancer Profile] Error processing entry ${entry.id}:`, entryError);
          // Continue with next entry
        }
      }
      
      console.log(`[Dancer Profile] Successfully processed ${history.length} entries`);
    } catch (dbError: any) {
      console.error('[Dancer Profile] Error fetching event history:', dbError);
      console.error('[Dancer Profile] Error message:', dbError?.message);
      console.error('[Dancer Profile] Error stack:', dbError?.stack);
      // Continue with empty history - not critical
    }
    
    console.log(`[Dancer Profile] Final history array length: ${history.length}`);

    // 5) Calculate age category from dancer age
    let ageCategory = null;
    if (dancer.age !== null && dancer.age !== undefined) {
      ageCategory = getAgeCategoryFromAge(dancer.age);
    }

    // 6) Structure the Response
    try {
      const response = {
        dancer: {
          id: dancer.id,
          eodsaId: dancer.eodsa_id,
          name: dancer.name,
          age: dancer.age,
          ageCategory: ageCategory,
          dateOfBirth: dancer.date_of_birth,
          approved: dancer.approved,
          registrationFeeMasteryLevel: dancer.registration_fee_mastery_level ?? null,
          studioId: dancer.studio_id ?? null,
          studioName: dancer.studio_name ?? null,
        },
        studio: studio,
        history: history.map((h) => ({
          id: h.id,
          eventId: h.event_id,
          contestantId: h.contestant_id,
          eodsaId: h.eodsa_id,
          paymentReference: h.payment_reference ?? null,
          itemName: h.item_name,
          performanceType: h.performance_type,
          mastery: h.mastery,
          entryType: h.entry_type,
          submittedAt: h.submitted_at,
          paymentStatus: h.payment_status,
          itemNumber: h.item_number,
          virtualItemNumber: h.virtual_item_number,
          qualifiedForNationals: h.qualified_for_nationals,
          musicFileUrl: h.music_file_url ?? null,
          videoFileUrl: h.video_file_url ?? null,
          calculatedFee: h.calculated_fee ?? null,
          event: {
            name: h.event_name,
            date: h.event_date,
            year: h.event_year,
            region: h.region,
          },
          performance: h.performance || null,
          ranking: h.ranking || null,
        })),
      };

      return NextResponse.json({ success: true, profile: response });
    } catch (responseError: any) {
      console.error('Error structuring response:', responseError);
      return NextResponse.json(
        { success: false, error: 'Error formatting response: ' + (responseError?.message || 'Unknown error') },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Admin dancer profile aggregation error:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack
    });
    return NextResponse.json(
      { 
        success: false, 
        error: error?.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      }, 
      { status: 500 }
    );
  }
}


