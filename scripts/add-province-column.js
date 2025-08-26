const { neon } = require('@neondatabase/serverless');

async function addProvinceColumn() {
  try {
    console.log('🚀 Starting province column migration...');
    
    // Hardcoded DATABASE_URL for migration
    const databaseUrl = 'postgres://neondb_owner:npg_Z0wdXg6knSvy@ep-blue-glitter-a4xc1mko-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
    
    const sql = neon(databaseUrl);
    
    console.log('🔍 Checking if province column exists...');
    
    // Check for province column
    const provinceColumnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'dancers' 
      AND column_name = 'province'
    `;
    
    if (provinceColumnCheck.length === 0) {
      await sql`
        ALTER TABLE dancers 
        ADD COLUMN province TEXT
      `;
      console.log('✅ Added province column to dancers table');
    } else {
      console.log('✅ Province column already exists');
    }
    
    // Verify the column exists
    const verifyColumn = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'dancers' 
      AND column_name = 'province'
    `;
    
    if (verifyColumn.length > 0) {
      console.log('\n🎉 Province column successfully added to dancers table!');
      console.log('💡 The system can now accept province data for dancer registrations.');
    } else {
      console.log('\n❌ Province column was not added. Please check manually.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

addProvinceColumn(); 