import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/database';
import { neon } from '@neondatabase/serverless';

export async function POST(request: NextRequest) {
  try {
    // // // await initializeDatabase() // Commented out for performance - initialization happens once on server start; // Commented out for performance - initialization happens once on server start // Commented out for performance - initialization happens once on server start
    
    console.log('🗑️ Starting studio data cleanup...');
    
    // Get database connection
    const sql = neon(process.env.DATABASE_URL!);
    
    // Get all studios first to see what we're deleting
    const studios = await sql`SELECT id, name, email, registration_number FROM studios`;
    console.log(`📊 Found ${studios.length} studios to delete`);
    
    if (studios.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No studios found to delete',
        deletedCount: 0
      });
    }
    
    // Collect studio info before deletion
    const deletedStudios = studios.map((studio: any) => ({
      name: studio.name,
      email: studio.email,
      registrationNumber: studio.registration_number
    }));
    
    for (const studio of studios) {
      console.log(`🗑️ Deleting studio: "${studio.name}" (${studio.email})`);
    }
    
    // Delete all studios (CASCADE will handle related data)
    await sql`DELETE FROM studios`;
    
    console.log(`✅ Successfully deleted ${deletedStudios.length} studios!`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedStudios.length} studios`,
      deletedStudios: deletedStudios,
      deletedCount: deletedStudios.length
    });
    
  } catch (error: any) {
    console.error('❌ Error cleaning studio data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to clean studio data',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 