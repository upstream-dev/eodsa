import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

/**
 * POST /api/certificates/batch-fix-participant-names
 * Batch regenerate all certificates that have "Participant 1" or similar invalid names
 * to ensure they use actual dancer names from participant_ids
 */
export async function POST(request: NextRequest) {
  try {
    const sqlClient = getSql();

    // Find all certificates with invalid participant names
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
      ORDER BY c.created_at DESC
    ` as any[];

    console.log(`🔍 Found ${allCertificatesResult.length} certificates with invalid participant names to fix`);

    const results = {
      total: allCertificatesResult.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ certificateId: string; performanceId: string; currentName: string; error: string }>,
      fixed: [] as Array<{ certificateId: string; performanceId: string; oldName: string; newName?: string }>
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
