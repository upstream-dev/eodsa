import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

/**
 * GET /api/certificates/debug-participant-name?performanceId=xxx
 * Debug endpoint to investigate why participant names aren't being resolved correctly
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const performanceId = searchParams.get('performanceId');

    if (!performanceId) {
      return NextResponse.json(
        { error: 'performanceId parameter is required' },
        { status: 400 }
      );
    }

    const sqlClient = getSql();

    // Get performance details
    const perfResult = await sqlClient`
      SELECT 
        p.*,
        e.event_date,
        e.name as event_name,
        ee.performance_type,
        ee.contestant_id,
        ee.id as event_entry_id,
        ee.participant_ids,
        ee.studio_name as event_entry_studio_name,
        c.name as contestant_name,
        c.type as contestant_type
      FROM performances p
      JOIN events e ON e.id = p.event_id
      LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
      LEFT JOIN contestants c ON c.id = ee.contestant_id
      WHERE p.id = ${performanceId}
    ` as any[];

    if (perfResult.length === 0) {
      return NextResponse.json(
        { error: 'Performance not found' },
        { status: 404 }
      );
    }

    const perf = perfResult[0];

    // Parse participant_ids
    let participantIds: string[] = [];
    try {
      if (perf.participant_ids) {
        if (Array.isArray(perf.participant_ids)) {
          participantIds = perf.participant_ids;
        } else if (typeof perf.participant_ids === 'string') {
          try {
            participantIds = JSON.parse(perf.participant_ids);
          } catch {
            participantIds = perf.participant_ids.includes(',') 
              ? perf.participant_ids.split(',').map((id: string) => id.trim())
              : [perf.participant_ids];
          }
        }
      }
    } catch (error) {
      console.error('Error parsing participant_ids:', error);
    }

    // Parse participant_names
    let participantNames: string[] = [];
    try {
      if (perf.participant_names) {
        if (typeof perf.participant_names === 'string') {
          try {
            participantNames = JSON.parse(perf.participant_names);
          } catch {
            participantNames = perf.participant_names.includes(',') 
              ? perf.participant_names.split(',').map((n: string) => n.trim())
              : [perf.participant_names];
          }
        } else if (Array.isArray(perf.participant_names)) {
          participantNames = perf.participant_names;
        }
      }
    } catch (error) {
      console.error('Error parsing participant_names:', error);
    }

    // Try to look up dancers
    const dancerLookups: any[] = [];
    for (const participantId of participantIds) {
      const lookup: any = {
        participantId,
        found: false,
        dancer: null,
        errors: []
      };

      try {
        // Try by dancer ID first
        const dancerResultById = await sqlClient`
          SELECT id, eodsa_id, name FROM dancers WHERE id = ${participantId} LIMIT 1
        ` as any[];
        
        if (dancerResultById.length > 0) {
          lookup.found = true;
          lookup.dancer = dancerResultById[0];
          lookup.method = 'dancer_id';
        } else {
          // Try by EODSA ID
          const dancerResultByEodsa = await sqlClient`
            SELECT id, eodsa_id, name FROM dancers WHERE eodsa_id = ${participantId} LIMIT 1
          ` as any[];
          
          if (dancerResultByEodsa.length > 0) {
            lookup.found = true;
            lookup.dancer = dancerResultByEodsa[0];
            lookup.method = 'eodsa_id';
          } else {
            lookup.errors.push(`No dancer found with id=${participantId} or eodsa_id=${participantId}`);
          }
        }
      } catch (error) {
        lookup.errors.push(error instanceof Error ? error.message : String(error));
      }

      dancerLookups.push(lookup);
    }

    // Check existing certificate
    const existingCert = await sqlClient`
      SELECT * FROM certificates WHERE performance_id = ${performanceId} ORDER BY created_at DESC LIMIT 1
    ` as any[];

    return NextResponse.json({
      success: true,
      performance: {
        id: perf.id,
        title: perf.title,
        event_name: perf.event_name,
        performance_type: perf.performance_type,
        event_entry_studio_name: perf.event_entry_studio_name
      },
      participant_ids: {
        raw: perf.participant_ids,
        parsed: participantIds,
        count: participantIds.length
      },
      participant_names: {
        raw: perf.participant_names,
        parsed: participantNames,
        count: participantNames.length,
        hasInvalidNames: participantNames.length === 0 || 
          participantNames.some(name => name === 'Participant 1' || name.startsWith('Participant ') || name === 'Unknown Dancer')
      },
      dancerLookups,
      existingCertificate: existingCert.length > 0 ? {
        id: existingCert[0].id,
        dancer_name: existingCert[0].dancer_name,
        created_at: existingCert[0].created_at
      } : null,
      recommendations: {
        shouldRegenerate: participantNames.some(name => name === 'Participant 1' || name.startsWith('Participant ')) || 
          (participantNames.length === 0 && participantIds.length > 0),
        resolvedNames: dancerLookups.filter(l => l.found).map(l => l.dancer.name)
      }
    });

  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to debug participant name',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
