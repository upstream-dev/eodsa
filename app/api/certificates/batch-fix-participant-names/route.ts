import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

/**
 * POST /api/certificates/batch-fix-participant-names
 * Batch fix data corruption: Find performances with "Participant 1" in participant_names,
 * fix the database, then regenerate certificates
 */
export async function POST(request: NextRequest) {
  try {
    const sqlClient = getSql();

    // CRITICAL: First, find all PERFORMANCES with corrupted participant_names
    // This fixes the root cause in the database
    const corruptedPerformances = await sqlClient`
      SELECT 
        p.id as performance_id,
        p.participant_names,
        p.title as performance_title,
        p.event_entry_id,
        p.contestant_id,
        ee.performance_type,
        ee.participant_ids,
        ee.studio_name as event_entry_studio_name,
        c.name as contestant_name,
        c.type as contestant_type,
        e.id as event_id,
        e.name as event_name
      FROM performances p
      LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
      LEFT JOIN contestants c ON c.id = p.contestant_id
      LEFT JOIN events e ON e.id = p.event_id
      WHERE 
        p.participant_names::text ILIKE '%Participant 1%'
        OR p.participant_names::text ILIKE '%participant 1%'
        OR p.participant_names::text = '[]'
        OR p.participant_names IS NULL
      ORDER BY p.created_at DESC
    ` as any[];

    console.log(`🔍 Found ${corruptedPerformances.length} performances with corrupted participant_names`);

    // Fix the database first
    const dbFixes = {
      total: corruptedPerformances.length,
      fixed: 0,
      failed: 0,
      errors: [] as Array<{ performanceId: string; error: string }>
    };

    for (const perf of corruptedPerformances) {
      try {
        // Parse participant_ids to determine if it's a group performance
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
          console.error(`Error parsing participant_ids for ${perf.performance_id}:`, error);
        }

        // Infer performance type
        let inferredPerformanceType: string | null = perf.performance_type || null;
        if (!inferredPerformanceType && participantIds.length > 0) {
          if (participantIds.length === 1) {
            inferredPerformanceType = 'Solo';
          } else if (participantIds.length === 2) {
            inferredPerformanceType = 'Duet';
          } else if (participantIds.length === 3) {
            inferredPerformanceType = 'Trio';
          } else if (participantIds.length >= 4) {
            inferredPerformanceType = 'Group';
          }
        }

        const isGroupPerformance = inferredPerformanceType && ['Duet', 'Trio', 'Group'].includes(inferredPerformanceType);
        
        let correctedNames: string[] = [];

        if (isGroupPerformance) {
          // For groups: Use studio_name from event_entries
          if (perf.event_entry_studio_name && perf.event_entry_studio_name.trim() !== '') {
            // Store studio name as the participant name for groups
            correctedNames = [perf.event_entry_studio_name];
            console.log(`📝 Group performance ${perf.performance_id}: Using studio name "${perf.event_entry_studio_name}"`);
          } else {
            // Try to get studio name from participants
            let studioName: string | null = null;
            for (const pid of participantIds) {
              try {
                const studioResult = await sqlClient`
                  SELECT DISTINCT s.name as studio_name
                  FROM dancers d
                  LEFT JOIN studio_applications sa ON d.id = sa.dancer_id AND sa.status = 'accepted'
                  LEFT JOIN studios s ON sa.studio_id = s.id
                  WHERE (d.id = ${pid} OR d.eodsa_id = ${pid})
                    AND s.name IS NOT NULL
                    AND s.name != ''
                  LIMIT 1
                ` as any[];
                
                if (studioResult.length > 0 && studioResult[0].studio_name) {
                  studioName = studioResult[0].studio_name;
                  break;
                }
              } catch (error) {
                console.error(`Error looking up studio for participant ${pid}:`, error);
              }
            }
            
            if (studioName) {
              correctedNames = [studioName];
              console.log(`📝 Group performance ${perf.performance_id}: Found studio name "${studioName}" from participants`);
            } else {
              // Fallback: try to get actual participant names
              for (const pid of participantIds) {
                try {
                  const dancerResult = await sqlClient`
                    SELECT name FROM dancers WHERE id = ${pid} OR eodsa_id = ${pid} LIMIT 1
                  ` as any[];
                  if (dancerResult.length > 0 && dancerResult[0].name) {
                    correctedNames.push(dancerResult[0].name);
                  }
                } catch (error) {
                  console.error(`Error looking up dancer ${pid}:`, error);
                }
              }
            }
          }
        } else {
          // For solos: Use contestant_name from contestants table
          if (perf.contestant_name && perf.contestant_name.trim() !== '') {
            correctedNames = [perf.contestant_name];
            console.log(`📝 Solo performance ${perf.performance_id}: Using contestant name "${perf.contestant_name}"`);
          } else if (participantIds.length > 0) {
            // Fallback: Look up actual dancer names from participant_ids
            for (const pid of participantIds) {
              try {
                const dancerResult = await sqlClient`
                  SELECT name FROM dancers WHERE id = ${pid} OR eodsa_id = ${pid} LIMIT 1
                ` as any[];
                if (dancerResult.length > 0 && dancerResult[0].name) {
                  correctedNames.push(dancerResult[0].name);
                }
              } catch (error) {
                console.error(`Error looking up dancer ${pid}:`, error);
              }
            }
          }
        }

        // Update the database if we found corrected names
        if (correctedNames.length > 0) {
          await sqlClient`
            UPDATE performances 
            SET participant_names = ${JSON.stringify(correctedNames)}
            WHERE id = ${perf.performance_id}
          `;
          dbFixes.fixed++;
          console.log(`✅ Fixed performance ${perf.performance_id}: ${JSON.stringify(correctedNames)}`);
        } else {
          console.warn(`⚠️ Could not determine corrected names for performance ${perf.performance_id}`);
          dbFixes.failed++;
        }
      } catch (error) {
        dbFixes.failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        dbFixes.errors.push({
          performanceId: perf.performance_id,
          error: errorMessage
        });
        console.error(`❌ Error fixing performance ${perf.performance_id}:`, errorMessage);
      }
    }

    console.log(`\n📊 Database fixes completed:`);
    console.log(`   Fixed: ${dbFixes.fixed}`);
    console.log(`   Failed: ${dbFixes.failed}`);

    // Now find certificates that need regeneration
    const allCertificatesResult = await sqlClient`
      SELECT 
        c.id as certificate_id,
        c.performance_id,
        c.dancer_name,
        p.title as performance_title,
        p.event_id,
        ee.performance_type,
        ee.id as event_entry_id,
        ee.participant_ids,
        ee.studio_name as event_entry_studio_name,
        e.id as event_id,
        e.name as event_name
      FROM certificates c
      JOIN performances p ON p.id = c.performance_id
      LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
      LEFT JOIN events e ON e.id = p.event_id
      WHERE 
        c.dancer_name ILIKE '%participant%' 
        OR c.dancer_name ILIKE '%particant%'
        OR c.dancer_name = 'Unknown Dancer'
        OR c.dancer_name = 'Studio Name'
        OR c.dancer_name = 'Participant'
        OR p.participant_names::text ILIKE '%Participant 1%'
      ORDER BY c.created_at DESC
    ` as any[];

    console.log(`🔍 Found ${allCertificatesResult.length} certificates to regenerate`);

    const results = {
      total: allCertificatesResult.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ certificateId: string; performanceId: string; currentName: string; error: string }>,
      fixed: [] as Array<{ certificateId: string; performanceId: string; oldName: string; newName?: string }>,
      databaseFixes: dbFixes
    };

    // Derive base URL from request URL
    let baseUrl: string;
    try {
      const requestUrl = new URL(request.url);
      baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
    } catch (urlError) {
      baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    }

    // Process each certificate
    for (const cert of allCertificatesResult) {
      try {
        results.processed++;
        
        console.log(`\n🔄 Processing certificate ${results.processed}/${results.total}:`);
        console.log(`   Certificate ID: ${cert.certificate_id}`);
        console.log(`   Performance ID: ${cert.performance_id}`);
        console.log(`   Performance Title: ${cert.performance_title}`);
        console.log(`   Current dancer_name: ${cert.dancer_name}`);
        console.log(`   Event: ${cert.event_name || 'N/A'}`);

        // Call the regenerate endpoint for each certificate
        const regenerateResponse = await fetch(`${baseUrl}/api/certificates/regenerate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            performanceId: cert.performance_id,
            forceRegenerate: true
          })
        });

        if (regenerateResponse.ok) {
          const regenerateData = await regenerateResponse.json();
          results.succeeded++;
          
          // Try to get the new name from the regenerated certificate
          let newName = cert.dancer_name; // Default to old name if we can't fetch new one
          try {
            const updatedCert = await sqlClient`
              SELECT dancer_name FROM certificates WHERE performance_id = ${cert.performance_id} ORDER BY created_at DESC LIMIT 1
            ` as any[];
            if (updatedCert.length > 0) {
              newName = updatedCert[0].dancer_name;
            }
          } catch {
            // Ignore error fetching new name
          }
          
          results.fixed.push({
            certificateId: cert.certificate_id,
            performanceId: cert.performance_id,
            oldName: cert.dancer_name,
            newName: newName
          });
          
          console.log(`   ✅ Successfully regenerated`);
          console.log(`   Old name: "${cert.dancer_name}" → New name: "${newName}"`);
        } else {
          const errorText = await regenerateResponse.text();
          results.failed++;
          results.errors.push({
            certificateId: cert.certificate_id,
            performanceId: cert.performance_id,
            currentName: cert.dancer_name,
            error: errorText
          });
          console.error(`   ❌ Failed to regenerate: ${errorText}`);
        }
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.errors.push({
          certificateId: cert.certificate_id,
          performanceId: cert.performance_id,
          currentName: cert.dancer_name,
          error: errorMessage
        });
        console.error(`   ❌ Error processing certificate: ${errorMessage}`);
      }
    }

    console.log(`\n✅ Batch fix completed:`);
    console.log(`   Total: ${results.total}`);
    console.log(`   Processed: ${results.processed}`);
    console.log(`   Succeeded: ${results.succeeded}`);
    console.log(`   Failed: ${results.failed}`);

    return NextResponse.json({
      success: true,
      message: `Batch fix completed: ${dbFixes.fixed} database records fixed, ${results.succeeded} certificates regenerated, ${results.failed} failed`,
      results: {
        ...results,
        databaseFixes: {
          total: dbFixes.total,
          fixed: dbFixes.fixed,
          failed: dbFixes.failed,
          errors: dbFixes.errors
        }
      }
    });

  } catch (error) {
    console.error('Error in batch fix:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to perform batch fix',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
