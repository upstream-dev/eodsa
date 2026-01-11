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

    // Find all certificates for group performances (Duet, Trio, Group)
    const certificatesResult = await sqlClient`
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
      WHERE ee.performance_type IN ('Duet', 'Trio', 'Group')
        OR (ee.performance_type IS NULL AND (
          SELECT COUNT(*) FROM jsonb_array_elements_text(ee.participant_ids) > 1
        ))
      ORDER BY c.created_at DESC
    ` as any[];

    console.log(`🔍 Found ${certificatesResult.length} certificates for group performances to fix`);

    const results = {
      total: certificatesResult.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ certificateId: string; performanceId: string; error: string }>
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
      message: `Batch fix completed: ${results.succeeded} succeeded, ${results.failed} failed`,
      results
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

