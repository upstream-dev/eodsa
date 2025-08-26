import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb, db, getSql } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting dancer-to-contestant synchronization...');
    
    // Get all approved dancers from unified system
    const allDancers = await unifiedDb.getAllDancers('approved');
    
    // Check which dancers don't have contestant records
    const orphanedDancers = [];
    
    for (const dancer of allDancers) {
      // Try to get contestant record
      const contestant = await db.getContestantById(dancer.id);
      if (!contestant) {
        orphanedDancers.push(dancer);
      }
    }
    
    console.log(`📊 Found ${orphanedDancers.length} unified dancers without contestant records`);
    
    if (orphanedDancers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All unified dancers already have contestant records',
        processed: 0
      });
    }
    
    // Create contestant records for each orphaned dancer
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];
    
    for (const dancer of orphanedDancers) {
      try {
        // Create a contestant record manually using the db.createContestant method
        const contestantData = {
          name: dancer.name,
          email: dancer.email || `temp-${dancer.id}@example.com`,
          phone: dancer.phone || '0000000000',
          type: 'private' as const,
          dateOfBirth: dancer.dateOfBirth,
          dancers: [{
            id: dancer.id,
            name: dancer.name,
            age: dancer.age,
            dateOfBirth: dancer.dateOfBirth,
            style: dancer.nationalId,
            nationalId: dancer.nationalId
          }]
        };
        
        // Create the contestant but override the ID to match the dancer's ID
        // This is a bit of a hack, but necessary for consistency
        const sqlClient = getSql();
        
        await sqlClient`
          INSERT INTO contestants (id, eodsa_id, name, email, phone, type, date_of_birth, registration_date)
          VALUES (
            ${dancer.id}, 
            ${dancer.eodsaId}, 
            ${dancer.name}, 
            ${dancer.email || `temp-${dancer.id}@example.com`}, 
            ${dancer.phone || '0000000000'}, 
            'private', 
            ${dancer.dateOfBirth}, 
            ${dancer.createdAt || new Date().toISOString()}
          )
          ON CONFLICT (id) DO NOTHING
        `;
        
        console.log(`✅ Created contestant record for dancer: ${dancer.name} (${dancer.eodsaId})`);
        successCount++;
        
      } catch (error: any) {
        console.error(`❌ Failed to create contestant record for dancer ${dancer.name}:`, error.message);
        errors.push(`${dancer.name}: ${error.message}`);
        errorCount++;
      }
    }
    
    // Verify the sync worked by checking how many still don't have records
    let remainingCount = 0;
    for (const dancer of allDancers) {
      const contestant = await db.getContestantById(dancer.id);
      if (!contestant) {
        remainingCount++;
      }
    }
    
    console.log(`🔍 Verification: ${remainingCount} dancers still without contestant records`);
    
    return NextResponse.json({
      success: true,
      message: `Migration completed successfully`,
      processed: successCount,
      errors: errorCount,
      errorDetails: errors,
      remaining: remainingCount
    });
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Migration failed', 
        details: error.message 
      },
      { status: 500 }
    );
  }
} 