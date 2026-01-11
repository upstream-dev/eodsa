import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

/**
 * POST /api/certificates/regenerate
 * Manually regenerate certificates for performances with published scores
 * This is useful when:
 * - Template was uploaded after scores were published
 * - Certificate generation failed initially
 * - Need to update certificates with new template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { performanceId, forceRegenerate } = body;

    if (!performanceId) {
      return NextResponse.json(
        { success: false, error: 'Performance ID is required' },
        { status: 400 }
      );
    }

    const sqlClient = getSql();

    // Get performance details
    // CRITICAL: For Duet/Trio/Group, get studio_name from participants via studio_applications (same as dancers page)
    // For Solo, use dancer/participant name
    const perfResult = await sqlClient`
      SELECT 
        p.*,
        e.event_date,
        e.name as event_name,
        e.certificate_template_url,
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
        { success: false, error: 'Performance not found' },
        { status: 404 }
      );
    }

    const perf = perfResult[0];

    // Check if scores are published
    if (!perf.scores_published) {
      return NextResponse.json(
        { success: false, error: 'Scores not published for this performance' },
        { status: 400 }
      );
    }

    // Get scores - use the database method to ensure consistent format
    const { db } = await import('@/lib/database');
    const scores = await db.getScoresByPerformance(performanceId);

    if (!scores || scores.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No scores found for this performance' },
        { status: 400 }
      );
    }

    // Calculate average percentage
    const { getTotalJudgesForEvent } = await import('@/lib/database');
    const totalJudgesAssigned = await getTotalJudgesForEvent(perf.event_id, performanceId);
    
    const totalPercentage = scores.reduce((sum: number, score: any) => {
      // Use camelCase field names (from getScoresByPerformance)
      // Convert to numbers to ensure proper addition
      const technical = Number(score.technicalScore) || 0;
      const musical = Number(score.musicalScore) || 0;
      const performance = Number(score.performanceScore) || 0;
      const styling = Number(score.stylingScore) || 0;
      const overall = Number(score.overallImpressionScore) || 0;
      const scoreTotal = technical + musical + performance + styling + overall;
      return sum + scoreTotal;
    }, 0);
    
    const judgeCount = totalJudgesAssigned > 0 ? totalJudgesAssigned : scores.length;
    const averagePercentage = judgeCount > 0 ? Math.round(totalPercentage / judgeCount) : 0;

    console.log(`📊 Certificate regeneration - Score calculation:`, {
      totalPercentage,
      judgeCount,
      totalJudgesAssigned,
      scoresLength: scores.length,
      averagePercentage
    });

    // Validate percentage
    if (isNaN(averagePercentage) || averagePercentage < 0 || averagePercentage > 100) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid percentage calculated: ${averagePercentage}`,
          debug: {
            totalPercentage,
            judgeCount,
            averagePercentage,
            scoresCount: scores.length
          }
        },
        { status: 400 }
      );
    }

    // Get medallion
    const { getMedalFromPercentage } = await import('@/lib/certificate-generator');
    let medallion = getMedalFromPercentage(averagePercentage);
    
    // Ensure medallion is never empty (fallback to Bronze)
    if (!medallion || medallion.trim() === '') {
      console.warn(`⚠️ Medallion was empty for percentage ${averagePercentage}, defaulting to Bronze`);
      medallion = 'Bronze';
    }

    console.log(`🏅 Medallion calculated: ${medallion} for percentage ${averagePercentage}`);

    // Get participant names
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
      participantNames = [];
    }

    // Determine display name
    // CRITICAL: For Duet/Trio/Group, get studio_name from participants via studio_applications (SAME AS DANCERS PAGE)
    // For Solo, use participant/dancer names
    
    // Infer performance type from participant count if performance_type is null
    let inferredPerformanceType: string | null = perf.performance_type || null;
    if (!inferredPerformanceType && participantNames.length > 0) {
      // Infer from participant count
      if (participantNames.length === 1) {
        inferredPerformanceType = 'Solo';
      } else if (participantNames.length === 2) {
        inferredPerformanceType = 'Duet';
      } else if (participantNames.length === 3) {
        inferredPerformanceType = 'Trio';
      } else if (participantNames.length >= 4) {
        inferredPerformanceType = 'Group';
      }
      console.log(`📝 Inferred performance type from participant count (${participantNames.length}): ${inferredPerformanceType}`);
    } else if (!inferredPerformanceType && perf.participant_ids) {
      // Try to infer from participant_ids if participantNames not available
      let participantIds: string[] = [];
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
      
      if (participantIds.length > 0) {
        if (participantIds.length === 1) {
          inferredPerformanceType = 'Solo';
        } else if (participantIds.length === 2) {
          inferredPerformanceType = 'Duet';
        } else if (participantIds.length === 3) {
          inferredPerformanceType = 'Trio';
        } else if (participantIds.length >= 4) {
          inferredPerformanceType = 'Group';
        }
        console.log(`📝 Inferred performance type from participant_ids count (${participantIds.length}): ${inferredPerformanceType}`);
      }
    }
    
    const isGroupPerformance = inferredPerformanceType && ['Duet', 'Trio', 'Group'].includes(inferredPerformanceType);
    
    // Get studio name using the SAME pattern as dancers page: studio_applications -> studios join
    let studioName: string | null = perf.event_entry_studio_name || null;
    
    // If studio_name not in event_entries, get it from participants (same way dancers page does it)
    if (isGroupPerformance && (!studioName || studioName.trim() === '') && perf.participant_ids) {
      try {
        // Handle JSONB participant_ids - parse if it's a string
        let participantIds: string[] = [];
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
        
        if (participantIds.length > 0) {
          console.log(`🔍 Looking up studio for participant IDs: ${JSON.stringify(participantIds)}`);
          console.log(`🔍 Participant IDs type: ${typeof participantIds[0]}, length: ${participantIds.length}`);
          
          // Use SAME query pattern as dancers page: studio_applications -> studios
          // Handle both dancer IDs and EODSA IDs - try each participant individually if needed
          let foundStudio = false;
          
          for (const participantId of participantIds) {
            if (foundStudio) break;
            
            console.log(`🔍 Trying participant ID: ${participantId} (type: ${typeof participantId})`);
            
            // Try by dancer ID first
            const studioResultById = await sqlClient`
              SELECT DISTINCT s.name as studio_name
              FROM dancers d
              LEFT JOIN studio_applications sa ON d.id = sa.dancer_id AND sa.status = 'accepted'
              LEFT JOIN studios s ON sa.studio_id = s.id
              WHERE d.id = ${participantId}
                AND s.name IS NOT NULL
                AND s.name != ''
              LIMIT 1
            ` as any[];
            
            if (studioResultById.length > 0 && studioResultById[0].studio_name) {
              studioName = studioResultById[0].studio_name;
              foundStudio = true;
              console.log(`✅ Found studio name by dancer ID: ${studioName}`);
              break;
            }
            
            // Try by EODSA ID
            const studioResultByEodsa = await sqlClient`
              SELECT DISTINCT s.name as studio_name
              FROM dancers d
              LEFT JOIN studio_applications sa ON d.id = sa.dancer_id AND sa.status = 'accepted'
              LEFT JOIN studios s ON sa.studio_id = s.id
              WHERE d.eodsa_id = ${participantId}
                AND s.name IS NOT NULL
                AND s.name != ''
              LIMIT 1
            ` as any[];
            
            if (studioResultByEodsa.length > 0 && studioResultByEodsa[0].studio_name) {
              studioName = studioResultByEodsa[0].studio_name;
              foundStudio = true;
              console.log(`✅ Found studio name by EODSA ID: ${studioName}`);
              break;
            }
          }
          
          if (!foundStudio) {
            console.warn(`⚠️ No studio found for any participant. Tried ${participantIds.length} participants.`);
            console.warn(`⚠️ Participant IDs were: ${JSON.stringify(participantIds)}`);
          }
        } else {
          console.warn(`⚠️ No participant IDs found for group performance`);
        }
      } catch (error) {
        console.error('❌ Error fetching studio name from participants:', error);
      }
    }
    
    // HARD-ENFORCE: For groups/duos/trios, displayName MUST be studioName, NEVER participant names
    let displayName: string;
    if (isGroupPerformance) {
      // ABSOLUTE PRIORITY: Studio name for groups/duos/trios
      if (studioName && studioName.trim() !== '') {
        displayName = studioName;
        console.log(`📝 Group performance - Using studio name: ${displayName}`);
      } else {
        // Last resort fallback - but NEVER use participant names
        displayName = 'Studio Name';
        console.error(`❌ Group performance - Studio name not found! Using fallback.`);
        console.error(`❌ Performance ID: ${performanceId}, Event Entry ID: ${perf.event_entry_id}`);
        console.error(`❌ Tried: event_entries.studio_name and participants via studio_applications`);
      }
    } else {
      // For solo performances ONLY, use participant names
      if (participantNames.length > 0) {
        displayName = participantNames.join(', ');
        console.log(`📝 Solo performance - Using participant names: ${displayName}`);
      } else {
        displayName = perf.contestant_name || 'Participant';
        console.warn(`⚠️ No participant names found, using fallback: ${displayName}`);
      }
    }

    // Get contestant_id from event_entry if not in performance
    let contestantId = perf.contestant_id;
    if (!contestantId && perf.event_entry_id) {
      try {
        const entryResult = await sqlClient`
          SELECT contestant_id FROM event_entries WHERE id = ${perf.event_entry_id} LIMIT 1
        ` as any[];
        if (entryResult.length > 0) {
          contestantId = entryResult[0].contestant_id;
        }
      } catch (err) {
        console.warn('Could not fetch contestant_id from event_entry:', err);
      }
    }

    // Validate required fields before generating
    const dancerId = contestantId || performanceId; // Use performanceId as fallback if no contestant_id
    const style = perf.item_style || 'Unknown';
    const title = perf.title || 'Untitled Performance';
    const eventDate = perf.event_date || new Date().toISOString().split('T')[0];

    // Validate all required fields
    if (!dancerId) {
      return NextResponse.json(
        { success: false, error: 'Missing dancer/contestant ID' },
        { status: 400 }
      );
    }

    if (!displayName || displayName.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Missing dancer/studio name' },
        { status: 400 }
      );
    }

    if (!style || style.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Missing performance style' },
        { status: 400 }
      );
    }

    if (!title || title.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Missing performance title' },
        { status: 400 }
      );
    }

    if (!medallion || medallion.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Missing medallion' },
        { status: 400 }
      );
    }

    console.log(`🔄 Regenerating certificate for performance ${performanceId}:`);
    console.log(`   - Dancer ID: ${dancerId}`);
    console.log(`   - Display Name: ${displayName}`);
    console.log(`   - Studio Name: ${studioName || 'N/A'}`);
    console.log(`   - Is Group: ${isGroupPerformance}`);
    console.log(`   - Performance Type (from DB): ${perf.performance_type || 'null'}`);
    console.log(`   - Inferred Performance Type: ${inferredPerformanceType || 'null'}`);
    console.log(`   - Participant Count: ${participantNames.length}`);
    console.log(`   - Style: ${style}`);
    console.log(`   - Title: ${title}`);
    console.log(`   - Percentage: ${averagePercentage} (type: ${typeof averagePercentage})`);
    console.log(`   - Medallion: ${medallion}`);
    console.log(`   - Event Date: ${eventDate}`);

    // Check if certificate already exists
    const existingCert = await sqlClient`
      SELECT id FROM certificates WHERE performance_id = ${performanceId} LIMIT 1
    ` as any[];

    // Delete existing certificate if forceRegenerate is true
    if (forceRegenerate && existingCert.length > 0) {
      await sqlClient`
        DELETE FROM certificates WHERE performance_id = ${performanceId}
      `;
      console.log(`🗑️ Deleted existing certificate for performance ${performanceId} (force regenerate)`);
    }

    // Generate certificate via API
    // Derive base URL from request URL to ensure it works in all environments
    let baseUrl: string;
    try {
      const requestUrl = new URL(request.url);
      baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    } catch (urlError) {
      // Fallback to environment variables if URL parsing fails
      console.warn('⚠️ Could not parse request URL, using environment variables:', urlError);
      baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    }
    
    console.log(`🔄 Regenerating certificate - Base URL: ${baseUrl}`);
    
    // HARD-ENFORCE: For groups/duos/trios, dancerName MUST be studioName from event_entries
    // For solo, dancerName is the participant name
    const finalDancerName = displayName; // displayName is already correct (studio name for groups, dancer name for solo)
    const finalStudioName = isGroupPerformance ? studioName : undefined;
    
    console.log(`📝 Final names for certificate generation:`);
    console.log(`   - isGroupPerformance: ${isGroupPerformance}`);
    console.log(`   - finalDancerName: ${finalDancerName} (from event_entries.studio_name for groups, participant names for solo)`);
    console.log(`   - finalStudioName: ${finalStudioName || 'N/A'}`);
    console.log(`   - event_entries.studio_name: ${studioName || 'NULL'}`);
    
    const certResponse = await fetch(`${baseUrl}/api/certificates/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dancerId: dancerId,
        dancerName: finalDancerName, // Studio name for groups, dancer name for solo
        eodsaId: perf.eodsa_id || undefined,
        performanceId: performanceId,
        eventEntryId: perf.event_entry_id,
        eventId: perf.event_id,
        performanceType: inferredPerformanceType || perf.performance_type,
        studioName: finalStudioName, // Studio name from event_entries for groups
        percentage: averagePercentage,
        style: style,
        title: title,
        medallion: medallion,
        eventDate: eventDate,
        createdBy: 'system-regenerate'
      })
    });

    if (!certResponse.ok) {
      let errorText = '';
      let errorData = null;
      try {
        errorText = await certResponse.text();
        try {
          errorData = JSON.parse(errorText);
        } catch {
          // Not JSON, use as text
        }
      } catch {
        errorText = 'Unknown error';
      }

      console.error(`❌ Certificate generation failed:`, errorData || errorText);
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to generate certificate',
          details: errorData || errorText,
          debug: {
            performanceId,
            dancerId,
            dancerName: displayName,
            style,
            title,
            percentage: averagePercentage,
            medallion,
            eventDate
          }
        },
        { status: 500 }
      );
    }

    const certData = await certResponse.json();

    // Send email notifications if certificate was successfully generated
    if (certData.certificateId) {
      const certificateUrl = `${baseUrl}/certificates/${performanceId}`;
      
      // Trigger email notifications (fire and forget)
      fetch(`${baseUrl}/api/certificates/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          performanceId: performanceId,
          eventEntryId: perf.event_entry_id,
          certificateUrl: certificateUrl,
          dancerName: displayName,
          performanceTitle: perf.title || '',
          percentage: averagePercentage,
          medallion: medallion
        })
      }).catch((emailError) => {
        console.error('Error triggering certificate email notifications:', emailError);
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Certificate regenerated successfully',
      certificateId: certData.certificateId,
      performanceId: performanceId,
      dancerName: displayName,
      percentage: averagePercentage,
      medallion: medallion
    });

  } catch (error) {
    console.error('Error regenerating certificate:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to regenerate certificate',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/certificates/regenerate?eventId=XXX
 * List all performances with published scores that don't have certificates
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    const sqlClient = getSql();

    let query;
    if (eventId && eventId !== 'all') {
      query = sqlClient`
        SELECT 
          p.id as performance_id,
          p.title,
          p.item_number,
          p.scores_published,
          e.name as event_name,
          e.certificate_template_url,
          c.name as contestant_name,
          c.studio_name,
          COUNT(DISTINCT s.id) as score_count,
          CASE 
            WHEN cert.id IS NULL THEN false
            ELSE true
          END as has_certificate
        FROM performances p
        JOIN events e ON e.id = p.event_id
        LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
        LEFT JOIN contestants c ON c.id = ee.contestant_id
        LEFT JOIN scores s ON s.performance_id = p.id
        LEFT JOIN certificates cert ON cert.performance_id = p.id
        WHERE p.scores_published = true
        AND p.event_id = ${eventId}
        GROUP BY p.id, p.title, p.item_number, p.scores_published, e.name, e.certificate_template_url, c.name, c.studio_name, cert.id
        HAVING COUNT(DISTINCT s.id) > 0
        ORDER BY p.item_number
      `;
    } else {
      query = sqlClient`
        SELECT 
          p.id as performance_id,
          p.title,
          p.item_number,
          p.scores_published,
          e.name as event_name,
          e.certificate_template_url,
          c.name as contestant_name,
          c.studio_name,
          COUNT(DISTINCT s.id) as score_count,
          CASE 
            WHEN cert.id IS NULL THEN false
            ELSE true
          END as has_certificate
        FROM performances p
        JOIN events e ON e.id = p.event_id
        LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
        LEFT JOIN contestants c ON c.id = ee.contestant_id
        LEFT JOIN scores s ON s.performance_id = p.id
        LEFT JOIN certificates cert ON cert.performance_id = p.id
        WHERE p.scores_published = true
        GROUP BY p.id, p.title, p.item_number, p.scores_published, e.name, e.certificate_template_url, c.name, c.studio_name, cert.id
        HAVING COUNT(DISTINCT s.id) > 0
        ORDER BY e.name, p.item_number
      `;
    }

    const results = await query as any[];

    const performances = results.map((row: any) => ({
      performanceId: row.performance_id,
      title: row.title,
      itemNumber: row.item_number,
      eventName: row.event_name,
      contestantName: row.contestant_name,
      studioName: row.studio_name,
      scoreCount: parseInt(row.score_count) || 0,
      hasCertificate: row.has_certificate,
      hasTemplate: !!row.certificate_template_url
    }));

    return NextResponse.json({
      success: true,
      performances,
      summary: {
        total: performances.length,
        withCertificates: performances.filter(p => p.hasCertificate).length,
        withoutCertificates: performances.filter(p => !p.hasCertificate).length,
        withTemplates: performances.filter(p => p.hasTemplate).length
      }
    });

  } catch (error) {
    console.error('Error listing performances:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list performances',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

