import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

/**
 * POST /api/certificates/batch-generate
 * Batch generate certificates for all published performances in an event that don't have certificates
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { eventId, eventName } = body;

    if (!eventId && !eventName) {
      return NextResponse.json(
        { success: false, error: 'Event ID or Event Name is required' },
        { status: 400 }
      );
    }

    const sqlClient = getSql();

    // First, find the event if only name provided
    let finalEventId = eventId;
    if (!finalEventId && eventName) {
      const eventResult = await sqlClient`
        SELECT id FROM events WHERE name ILIKE ${'%' + eventName + '%'} LIMIT 1
      ` as any[];
      
      if (eventResult.length === 0) {
        return NextResponse.json(
          { success: false, error: `Event not found: ${eventName}` },
          { status: 404 }
        );
      }
      
      finalEventId = eventResult[0].id;
    }

    // Get all published performances for this event that don't have certificates
    const performancesNeedingCertificates = await sqlClient`
      SELECT 
        p.id as performance_id,
        p.title,
        p.item_number,
        p.scores_published,
        p.item_style,
        p.participant_names,
        e.name as event_name,
        e.event_date,
        e.certificate_template_url,
        ee.performance_type,
        ee.contestant_id,
        ee.id as event_entry_id,
        c.name as contestant_name,
        c.studio_name,
        COUNT(DISTINCT s.id) as score_count
      FROM performances p
      JOIN events e ON e.id = p.event_id
      LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
      LEFT JOIN contestants c ON c.id = ee.contestant_id
      LEFT JOIN scores s ON s.performance_id = p.id
      LEFT JOIN certificates cert ON cert.performance_id = p.id
      WHERE p.scores_published = true
      AND p.event_id = ${finalEventId}
      AND cert.id IS NULL
      GROUP BY p.id, p.title, p.item_number, p.scores_published, p.item_style, p.participant_names,
               e.name, e.event_date, e.certificate_template_url, ee.performance_type, 
               ee.contestant_id, ee.id, c.name, c.studio_name
      HAVING COUNT(DISTINCT s.id) > 0
      ORDER BY p.item_number
    ` as any[];

    if (performancesNeedingCertificates.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All published performances already have certificates',
        generated: 0,
        failed: 0,
        performances: []
      });
    }

    console.log(`📋 Found ${performancesNeedingCertificates.length} performances needing certificates for event ${finalEventId}`);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const generateUrl = `${baseUrl}/api/certificates/regenerate`;

    const results = [];
    let successCount = 0;
    let failCount = 0;

    // Import required functions
    const { getTotalJudgesForEvent } = await import('@/lib/database');
    const { getMedalFromPercentage } = await import('@/lib/certificate-generator');

    for (const perf of performancesNeedingCertificates) {
      try {
        // Get scores for this performance
        const { db } = await import('@/lib/database');
        const scores = await db.getScoresByPerformance(perf.performance_id);

        if (!scores || scores.length === 0) {
          results.push({
            performanceId: perf.performance_id,
            title: perf.title,
            itemNumber: perf.item_number,
            status: 'skipped',
            reason: 'No scores found'
          });
          continue;
        }

        // Calculate average percentage
        const totalJudgesAssigned = await getTotalJudgesForEvent(finalEventId, perf.performance_id);
        const totalPercentage = scores.reduce((sum: number, score: any) => {
          const technical = Number(score.technicalScore) || 0;
          const musical = Number(score.musicalScore) || 0;
          const performance = Number(score.performanceScore) || 0;
          const styling = Number(score.stylingScore) || 0;
          const overall = Number(score.overallImpressionScore) || 0;
          return sum + technical + musical + performance + styling + overall;
        }, 0);
        
        const judgeCount = totalJudgesAssigned > 0 ? totalJudgesAssigned : scores.length;
        const averagePercentage = judgeCount > 0 ? Math.round(totalPercentage / judgeCount) : 0;

        if (averagePercentage === 0) {
          results.push({
            performanceId: perf.performance_id,
            title: perf.title,
            itemNumber: perf.item_number,
            status: 'skipped',
            reason: 'Invalid percentage calculated'
          });
          continue;
        }

        // Get medallion
        const medallion = getMedalFromPercentage(averagePercentage) || 'Bronze';

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
        const isGroupPerformance = perf.performance_type && ['Duet', 'Trio', 'Group'].includes(perf.performance_type);
        let displayName = isGroupPerformance && perf.studio_name 
          ? perf.studio_name 
          : participantNames.join(', ');

        // Fallback if display name is empty
        if (!displayName || displayName.trim() === '') {
          displayName = perf.contestant_name || perf.studio_name || 'Participant';
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

        const dancerId = contestantId || perf.performance_id;
        const style = perf.item_style || 'Unknown';
        const title = perf.title || 'Untitled Performance';
        const eventDate = perf.event_date || new Date().toISOString().split('T')[0];

        // Call regenerate endpoint (which will generate the certificate)
        const regenerateResponse = await fetch(generateUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            performanceId: perf.performance_id,
            forceRegenerate: false // Don't force if certificate already exists
          })
        });

        if (regenerateResponse.ok) {
          const regenerateData = await regenerateResponse.json();
          successCount++;
          results.push({
            performanceId: perf.performance_id,
            title: title,
            itemNumber: perf.item_number,
            dancerName: displayName,
            percentage: averagePercentage,
            medallion: medallion,
            status: 'success',
            certificateId: regenerateData.certificateId
          });
          console.log(`✅ Generated certificate for ${title} (${displayName})`);
        } else {
          const errorData = await regenerateResponse.json().catch(() => ({ error: 'Unknown error' }));
          failCount++;
          results.push({
            performanceId: perf.performance_id,
            title: title,
            itemNumber: perf.item_number,
            dancerName: displayName,
            status: 'failed',
            error: errorData.error || errorData.details || 'Failed to generate certificate'
          });
          console.error(`❌ Failed to generate certificate for ${title}:`, errorData);
        }
      } catch (error) {
        failCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          performanceId: perf.performance_id,
          title: perf.title,
          itemNumber: perf.item_number,
          status: 'failed',
          error: errorMessage
        });
        console.error(`❌ Error processing ${perf.title}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Batch certificate generation completed`,
      generated: successCount,
      failed: failCount,
      total: performancesNeedingCertificates.length,
      performances: results
    });

  } catch (error) {
    console.error('Error in batch certificate generation:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to batch generate certificates',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
