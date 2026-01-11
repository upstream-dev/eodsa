import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    const performanceId = searchParams.get('performanceId');

    if (!title && !performanceId) {
      return NextResponse.json(
        { error: 'Please provide title or performanceId' },
        { status: 400 }
      );
    }

    const sqlClient = getSql();

    // Find the performance
    let perf: any = null;
    if (performanceId) {
      const perfResult = await sqlClient`
        SELECT * FROM performances WHERE id = ${performanceId} LIMIT 1
      ` as any[];
      perf = perfResult.length > 0 ? perfResult[0] : null;
    } else if (title) {
      const perfResult = await sqlClient`
        SELECT * FROM performances WHERE title = ${title} LIMIT 1
      ` as any[];
      perf = perfResult.length > 0 ? perfResult[0] : null;
    }

    if (!perf) {
      return NextResponse.json(
        { error: 'Performance not found' },
        { status: 404 }
      );
    }

    const debug: any = {
      performance: {
        id: perf.id,
        title: perf.title,
        event_entry_id: perf.event_entry_id,
        participant_names: perf.participant_names,
      }
    };

    // Get event entry details
    if (perf.event_entry_id) {
      const entryResult = await sqlClient`
        SELECT 
          ee.*,
          e.name as event_name,
          e.region
        FROM event_entries ee
        LEFT JOIN events e ON e.id = ee.event_id
        WHERE ee.id = ${perf.event_entry_id}
        LIMIT 1
      ` as any[];

      if (entryResult.length > 0) {
        const entry = entryResult[0];
        debug.eventEntry = {
          id: entry.id,
          performance_type: entry.performance_type,
          contestant_id: entry.contestant_id,
          participant_ids: entry.participant_ids,
          eodsa_id: entry.eodsa_id,
          event_name: entry.event_name,
          event_region: entry.region,
        };

        // Get contestant details
        if (entry.contestant_id) {
          const contestantResult = await sqlClient`
            SELECT * FROM contestants WHERE id = ${entry.contestant_id} LIMIT 1
          ` as any[];

          if (contestantResult.length > 0) {
            const contestant = contestantResult[0];
            debug.contestant = {
              id: contestant.id,
              name: contestant.name,
              eodsa_id: contestant.eodsa_id,
              studio_name: contestant.studio_name,
              type: contestant.type,
              email: contestant.email,
            };

            // Try to find studio from studios table
            if (contestant.studio_name) {
              const studioResult = await sqlClient`
                SELECT * FROM studios WHERE name = ${contestant.studio_name} OR email = ${contestant.email} LIMIT 1
              ` as any[];
              if (studioResult.length > 0) {
                debug.studioFromContestant = {
                  id: studioResult[0].id,
                  name: studioResult[0].name,
                  email: studioResult[0].email,
                };
              }
            }
          }
        }

        // Get participant details and their studio associations
        if (entry.participant_ids) {
          let participantIds: string[] = [];
          try {
            if (Array.isArray(entry.participant_ids)) {
              participantIds = entry.participant_ids;
            } else if (typeof entry.participant_ids === 'string') {
              try {
                participantIds = JSON.parse(entry.participant_ids);
              } catch {
                participantIds = entry.participant_ids.includes(',') 
                  ? entry.participant_ids.split(',').map((id: string) => id.trim())
                  : [entry.participant_ids];
              }
            }
          } catch (error) {
            console.error('Error parsing participant_ids:', error);
          }

          debug.participantIds = participantIds;

          // Get participant details
          if (participantIds.length > 0) {
            const participantsResult = await sqlClient`
              SELECT 
                d.id,
                d.name,
                d.eodsa_id,
                d.email,
                s.id as studio_id,
                s.name as studio_name,
                s.email as studio_email,
                sa.status as studio_application_status
              FROM dancers d
              LEFT JOIN studio_applications sa ON d.id = sa.dancer_id AND sa.status = 'accepted'
              LEFT JOIN studios s ON sa.studio_id = s.id
              WHERE d.id = ANY(${participantIds}) OR d.eodsa_id = ANY(${participantIds})
            ` as any[];

            debug.participants = participantsResult.map((p: any) => ({
              id: p.id,
              name: p.name,
              eodsa_id: p.eodsa_id,
              email: p.email,
              studio: p.studio_name ? {
                id: p.studio_id,
                name: p.studio_name,
                email: p.studio_email,
                application_status: p.studio_application_status,
              } : null,
            }));

            // Get studio name from participants
            const studiosFromParticipants = participantsResult
              .filter((p: any) => p.studio_name)
              .map((p: any) => p.studio_name);

            if (studiosFromParticipants.length > 0) {
              debug.studioFromParticipants = studiosFromParticipants[0]; // First studio found
              debug.allStudiosFromParticipants = [...new Set(studiosFromParticipants)];
            }
          }
        }
      }
    }

    // Summary - what studio name should be used?
    debug.summary = {
      studioNameFromContestant: debug.contestant?.studio_name || null,
      studioNameFromStudiosTable: debug.studioFromContestant?.name || null,
      studioNameFromParticipants: debug.studioFromParticipants || null,
      recommendedStudioName: debug.studioFromParticipants 
        || debug.studioFromContestant?.name 
        || debug.contestant?.studio_name 
        || null,
      isGroupPerformance: debug.eventEntry?.performance_type && 
        ['Duet', 'Trio', 'Group'].includes(debug.eventEntry.performance_type),
    };

    return NextResponse.json({
      success: true,
      debug
    });

  } catch (error: any) {
    console.error('Error debugging studio name:', error);
    return NextResponse.json(
      { error: 'Failed to debug studio name', details: error.message },
      { status: 500 }
    );
  }
}

