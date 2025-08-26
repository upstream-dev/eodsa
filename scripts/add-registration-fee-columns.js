const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

async function addRegistrationFeeColumns() {
  try {
    console.log('🚀 Starting registration fee columns migration...');
    
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    const sql = neon(databaseUrl);
    
    console.log('🔍 Checking existing columns...');
    
    // Check for registration_fee_paid column
    const paidColumnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'dancers' 
      AND column_name = 'registration_fee_paid'
    `;
    
    if (paidColumnCheck.length === 0) {
      await sql`
        ALTER TABLE dancers 
        ADD COLUMN registration_fee_paid BOOLEAN DEFAULT FALSE
      `;
      console.log('✅ Added registration_fee_paid column');
    } else {
      console.log('✅ registration_fee_paid column already exists');
    }
    
    // Check for registration_fee_paid_at column
    const paidAtColumnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'dancers' 
      AND column_name = 'registration_fee_paid_at'
    `;
    
    if (paidAtColumnCheck.length === 0) {
      await sql`
        ALTER TABLE dancers 
        ADD COLUMN registration_fee_paid_at TEXT
      `;
      console.log('✅ Added registration_fee_paid_at column');
    } else {
      console.log('✅ registration_fee_paid_at column already exists');
    }
    
    // Check for registration_fee_mastery_level column
    const masteryColumnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'dancers' 
      AND column_name = 'registration_fee_mastery_level'
    `;
    
    if (masteryColumnCheck.length === 0) {
      await sql`
        ALTER TABLE dancers 
        ADD COLUMN registration_fee_mastery_level TEXT
      `;
      console.log('✅ Added registration_fee_mastery_level column');
    } else {
      console.log('✅ registration_fee_mastery_level column already exists');
    }
    
    // Verify all columns exist
    const allColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'dancers' 
      AND column_name IN ('registration_fee_paid', 'registration_fee_paid_at', 'registration_fee_mastery_level')
      ORDER BY column_name
    `;
    
    console.log('\n📊 Registration fee columns in dancers table:');
    allColumns.forEach(col => {
      console.log(`   ✅ ${col.column_name}`);
    });
    
    if (allColumns.length === 3) {
      console.log('\n🎉 All registration fee columns successfully added!');
      console.log('💡 Admin approval workflow should now work properly.');
    } else {
      console.log('\n❌ Some columns may be missing. Please check manually.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
addRegistrationFeeColumns(); 