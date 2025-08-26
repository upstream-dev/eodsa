const { neon } = require('@neondatabase/serverless');

const testMigration = async () => {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      console.error('❌ DATABASE_URL environment variable not found');
      console.log('Make sure your .env.local file contains DATABASE_URL');
      return;
    }
    
    const sql = neon(databaseUrl);
    
    console.log('🔄 Testing event_end_date migration...');
    
    // Check if column exists
    const columnCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'events' 
      AND column_name = 'event_end_date'
    `;
    
    console.log('Column check result:', columnCheck);
    
    if (columnCheck.length === 0) {
      console.log('❌ Column does not exist, adding it...');
      await sql`
        ALTER TABLE events 
        ADD COLUMN event_end_date TEXT
      `;
      console.log('✅ Added event_end_date column to events table');
    } else {
      console.log('✅ event_end_date column already exists');
    }
    
    // Verify the column was added
    const verifyCheck = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'events' 
      AND column_name = 'event_end_date'
    `;
    
    console.log('Verification result:', verifyCheck);
    
    if (verifyCheck.length > 0) {
      console.log('🎉 Migration successful! event_end_date column exists.');
    } else {
      console.log('❌ Migration failed! Column still missing.');
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error);
  }
};

testMigration(); 