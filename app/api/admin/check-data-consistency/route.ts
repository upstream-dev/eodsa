import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const sqlClient = getSql();
    
    // Check for dancers without contestant records
    const orphanedDancers = await sqlClient`
      SELECT d.id, d.name, d.eodsa_id, d.approved
      FROM dancers d 
      LEFT JOIN contestants c ON d.id = c.id 
      WHERE c.id IS NULL
      ORDER BY d.approved DESC, d.created_at DESC
    ` as any[];
    
    // Check for contestants without dancer records (should be rare but let's check)
    const orphanedContestants = await sqlClient`
      SELECT c.id, c.name, c.eodsa_id, c.type
      FROM contestants c 
      LEFT JOIN dancers d ON c.id = d.id 
      WHERE d.id IS NULL AND c.type = 'private'
      ORDER BY c.registration_date DESC
    ` as any[];
    
    // Check for dancers with mismatched EODSA IDs (data integrity issue)
    const mismatchedEodsaIds = await sqlClient`
      SELECT d.id, d.name, d.eodsa_id as dancer_eodsa_id, c.eodsa_id as contestant_eodsa_id
      FROM dancers d 
      JOIN contestants c ON d.id = c.id 
      WHERE d.eodsa_id != c.eodsa_id
      ORDER BY d.created_at DESC
    ` as any[];
    
    const summary = {
      orphanedDancers: orphanedDancers.length,
      orphanedContestants: orphanedContestants.length,
      mismatchedEodsaIds: mismatchedEodsaIds.length,
      totalInconsistencies: orphanedDancers.length + orphanedContestants.length + mismatchedEodsaIds.length
    };
    
    return NextResponse.json({
      success: true,
      summary,
      details: {
        orphanedDancers: orphanedDancers.slice(0, 10), // Limit to first 10
        orphanedContestants: orphanedContestants.slice(0, 10),
        mismatchedEodsaIds: mismatchedEodsaIds.slice(0, 10)
      },
      recommendations: generateRecommendations(summary)
    });
    
  } catch (error) {
    console.error('Error checking data consistency:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check data consistency',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function generateRecommendations(summary: any): string[] {
  const recommendations: string[] = [];
  
  if (summary.orphanedDancers > 0) {
    recommendations.push(`Found ${summary.orphanedDancers} dancers without contestant records. Run sync migration to fix.`);
  }
  
  if (summary.orphanedContestants > 0) {
    recommendations.push(`Found ${summary.orphanedContestants} contestants without dancer records. This may indicate data corruption.`);
  }
  
  if (summary.mismatchedEodsaIds > 0) {
    recommendations.push(`Found ${summary.mismatchedEodsaIds} records with mismatched EODSA IDs. This needs immediate attention.`);
  }
  
  if (summary.totalInconsistencies === 0) {
    recommendations.push('All data is consistent! No action required.');
  }
  
  return recommendations;
} 