const { neon } = require('@neondatabase/serverless');

// Hardcoded database URL
const DATABASE_URL = 'postgres://neondb_owner:npg_Z0wdXg6knSvy@ep-blue-glitter-a4xc1mko-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function addWithdrawalColumn() {
  console.log('🚀 Starting withdrawal column migration...');
  
  try {
    // Create database connection
    const sql = neon(DATABASE_URL);
    
    console.log('📝 Adding withdrawn_from_judging column to performances table...');
    
    // Add the column with default value false
    await sql`
      ALTER TABLE performances 
      ADD COLUMN IF NOT EXISTS withdrawn_from_judging BOOLEAN DEFAULT FALSE
    `;
    
    console.log('✅ Successfully added withdrawn_from_judging column');
    
    // Verify the column was added
    console.log('🔍 Verifying column was added...');
    const result = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'performances' 
      AND column_name = 'withdrawn_from_judging'
    `;
    
    if (result.length > 0) {
      console.log('✅ Column verification successful:');
      console.log(`   - Column: ${result[0].column_name}`);
      console.log(`   - Type: ${result[0].data_type}`);
      console.log(`   - Default: ${result[0].column_default}`);
      console.log(`   - Nullable: ${result[0].is_nullable}`);
    } else {
      console.log('❌ Column verification failed - column not found');
    }
    
    // Check current performance count to show impact
    const performanceCount = await sql`SELECT COUNT(*) as count FROM performances`;
    console.log(`📊 Total performances in database: ${performanceCount[0].count}`);
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
addWithdrawalColumn(); 