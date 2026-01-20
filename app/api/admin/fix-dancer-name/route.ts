import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

/**
 * POST /api/admin/fix-dancer-name
 * Fix a typo in a dancer's name across the entire database
 * Updates: dancers table, performances.participant_names, certificates, and regenerates certificates
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { oldName, newName, dancerId, eodsaId } = body;

    if (!oldName || !newName) {
      return NextResponse.json(
        { error: 'oldName and newName are required' },
        { status: 400 }
      );
    }

    const sqlClient = getSql();
    const results = {
      dancersUpdated: 0,
      performancesUpdated: 0,
      certificatesFound: 0,
      certificatesRegenerated: 0,
      errors: [] as Array<{ type: string; error: string }>
    };

    // Step 1: Find and update dancer(s) in dancers table
    try {
      let dancerQuery;
      if (dancerId) {
        dancerQuery = sqlClient`
          SELECT id, eodsa_id, name FROM dancers WHERE id = ${dancerId} AND name = ${oldName}
        `;
      } else if (eodsaId) {
        dancerQuery = sqlClient`
          SELECT id, eodsa_id, name FROM dancers WHERE eodsa_id = ${eodsaId} AND name = ${oldName}
        `;
      } else {
        dancerQuery = sqlClient`
          SELECT id, eodsa_id, name FROM dancers WHERE name = ${oldName}
        `;
      }

      const dancers = await dancerQuery as any[];

      if (dancers.length === 0) {
        return NextResponse.json(
          { 
            error: `No dancer found with name "${oldName}"`,
            searchedBy: dancerId ? 'dancerId' : eodsaId ? 'eodsaId' : 'name'
          },
          { status: 404 }
        );
      }

      // Update each dancer found
      for (const dancer of dancers) {
        try {
          await sqlClient`
            UPDATE dancers 
            SET name = ${newName}
            WHERE id = ${dancer.id}
          `;
          results.dancersUpdated++;
          console.log(`✅ Updated dancer ${dancer.id} (${dancer.eodsa_id}): "${oldName}" → "${newName}"`);
        } catch (error) {
          results.errors.push({
            type: 'dancer_update',
            error: `Failed to update dancer ${dancer.id}: ${error instanceof Error ? error.message : String(error)}`
          });
        }
      }
    } catch (error) {
      results.errors.push({
        type: 'dancer_lookup',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Step 2: Update participant_names in performances table
    try {
      const performances = await sqlClient`
        SELECT id, participant_names, title
        FROM performances
        WHERE participant_names::text ILIKE ${`%${oldName}%`}
      ` as any[];

      for (const perf of performances) {
        try {
          let participantNames: string[] = [];
          try {
            if (typeof perf.participant_names === 'string') {
              participantNames = JSON.parse(perf.participant_names);
            } else if (Array.isArray(perf.participant_names)) {
              participantNames = perf.participant_names;
            }
          } catch {
            participantNames = perf.participant_names.includes(',') 
              ? perf.participant_names.split(',').map((n: string) => n.trim())
              : [perf.participant_names];
          }

          // Replace old name with new name
          const updatedNames = participantNames.map(name => 
            name === oldName ? newName : name
          );

          if (JSON.stringify(participantNames) !== JSON.stringify(updatedNames)) {
            await sqlClient`
              UPDATE performances 
              SET participant_names = ${JSON.stringify(updatedNames)}
              WHERE id = ${perf.id}
            `;
            results.performancesUpdated++;
            console.log(`✅ Updated performance ${perf.id} (${perf.title}): participant_names`);
          }
        } catch (error) {
          results.errors.push({
            type: 'performance_update',
            error: `Failed to update performance ${perf.id}: ${error instanceof Error ? error.message : String(error)}`
          });
        }
      }
    } catch (error) {
      results.errors.push({
        type: 'performance_lookup',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Step 3: Find certificates with the wrong name and regenerate them
    try {
      const certificates = await sqlClient`
        SELECT c.id as certificate_id, c.performance_id, c.dancer_name
        FROM certificates c
        WHERE c.dancer_name = ${oldName}
           OR c.dancer_name ILIKE ${`%${oldName}%`}
      ` as any[];

      results.certificatesFound = certificates.length;

      // Derive base URL from request URL
      let baseUrl: string;
      try {
        const requestUrl = new URL(request.url);
        baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;
      } catch (urlError) {
        baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      }

      // Regenerate each certificate
      for (const cert of certificates) {
        try {
          const regenerateResponse = await fetch(`${baseUrl}/api/certificates/regenerate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              performanceId: cert.performance_id,
              forceRegenerate: true
            })
          });

          if (regenerateResponse.ok) {
            results.certificatesRegenerated++;
            console.log(`✅ Regenerated certificate for performance ${cert.performance_id}`);
          } else {
            const errorText = await regenerateResponse.text();
            results.errors.push({
              type: 'certificate_regeneration',
              error: `Performance ${cert.performance_id}: ${errorText}`
            });
          }
        } catch (error) {
          results.errors.push({
            type: 'certificate_regeneration',
            error: `Performance ${cert.performance_id}: ${error instanceof Error ? error.message : String(error)}`
          });
        }
      }
    } catch (error) {
      results.errors.push({
        type: 'certificate_lookup',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return NextResponse.json({
      success: true,
      message: `Name fix completed: "${oldName}" → "${newName}"`,
      results
    });

  } catch (error) {
    console.error('Error fixing dancer name:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fix dancer name',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
