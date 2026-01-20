import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

/**
 * POST /api/certificates/batch-fix-groups
 * Batch regenerate all certificates for Duet, Trio, and Group performances
 * to ensure they use studio names and dynamic font scaling
 */
export async function POST(request: NextRequest) {
  try {
    const sqlClient = getSql();

    // CRITICAL: First fix corrupted participant_names in performances table
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
        c.name as contestant_name
      FROM performances p
      LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
      LEFT JOIN contestants c ON c.id = p.contestant_id
      WHERE 
        (p.participant_names::text ILIKE '%Participant 1%' OR p.participant_names::text = '[]')
        AND (
          ee.performance_type IN ('Duet', 'Trio', 'Group')
          OR (ee.performance_type IS NULL AND ee.participant_ids IS NOT NULL)
        )
      ORDER BY p.created_at DESC
    ` as any[];

    console.log(`🔍 Found ${corruptedPerformances.length} group performances with corrupted participant_names`);

    // Fix the database first
    const dbFixes = {
      total: corruptedPerformances.length,
      fixed: 0,
      failed: 0,
      errors: [] as Array<{ performanceId: string; error: string }>
    };

    for (const perf of corruptedPerformances) {
      try {
        // For groups: Use studio_name from event_entries
        let correctedNames: string[] = [];
        
        if (perf.event_entry_studio_name && perf.event_entry_studio_name.trim() !== '') {
          correctedNames = [perf.event_entry_studio_name];
        } else {
          // Try to get studio name from participants
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
            console.error(`Error parsing participant_ids:`, error);
          }

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
          console.log(`✅ Fixed group performance ${perf.performance_id}: ${JSON.stringify(correctedNames)}`);
        } else {
          console.warn(`⚠️ Could not determine studio name for performance ${perf.performance_id}`);
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

    // Find all certificates - we'll filter to group performances in application code
    const allCertificatesResult = await sqlClient`
      SELECT 
        c.id as certificate_id,
        c.performance_id,
        c.dancer_name,
        p.title as performance_title,
        ee.performance_type,
        ee.id as event_entry_id,
        ee.participant_ids,
        ee.studio_name as event_entry_studio_name,
        e.id as event_id
      FROM certificates c
      JOIN performances p ON p.id = c.performance_id
      LEFT JOIN event_entries ee ON ee.id = p.event_entry_id
      LEFT JOIN events e ON e.id = p.event_id
      ORDER BY c.created_at DESC
    ` as any[];

    // Filter to only group performances (Duet, Trio, Group)
    // Also include certificates where performance_type is null but has multiple participants
    const certificatesResult = allCertificatesResult.filter(cert => {
      // Explicitly group performance types
      if (cert.performance_type && ['Duet', 'Trio', 'Group'].includes(cert.performance_type)) {
        return true;
      }
      
      // If performance_type is null, check participant count
      if (!cert.performance_type && cert.participant_ids) {
        try {
          let participantIds: string[] = [];
          if (Array.isArray(cert.participant_ids)) {
            participantIds = cert.participant_ids;
          } else if (typeof cert.participant_ids === 'string') {
            try {
              participantIds = JSON.parse(cert.participant_ids);
            } catch {
              participantIds = cert.participant_ids.includes(',') 
                ? cert.participant_ids.split(',').map((id: string) => id.trim())
                : [cert.participant_ids];
            }
          }
          // Include if 2 or more participants (Duet, Trio, or Group)
          return participantIds.length >= 2;
        } catch {
          return false;
        }
      }
      
      return false;
    });

    console.log(`🔍 Found ${certificatesResult.length} certificates for group performances to fix`);

    const results = {
      total: certificatesResult.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ certificateId: string; performanceId: string; error: string }>,
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
    for (const cert of certificatesResult) {
      try {
        results.processed++;
        
        console.log(`\n🔄 Processing certificate ${results.processed}/${results.total}:`);
        console.log(`   Certificate ID: ${cert.certificate_id}`);
        console.log(`   Performance ID: ${cert.performance_id}`);
        console.log(`   Current dancer_name: ${cert.dancer_name}`);
        console.log(`   Performance Type: ${cert.performance_type || 'null'}`);

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
          results.succeeded++;
          console.log(`   ✅ Successfully regenerated`);
        } else {
          const errorText = await regenerateResponse.text();
          results.failed++;
          results.errors.push({
            certificateId: cert.certificate_id,
            performanceId: cert.performance_id,
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

