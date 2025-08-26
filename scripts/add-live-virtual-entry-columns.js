/**
 * Migration Script: Add Live/Virtual Entry Support Columns
 * Adds columns for entry type and file storage to event_entries table
 */

const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function addLiveVirtualEntryColumns() {
  try {
    console.log('🚀 Starting Live/Virtual Entry columns migration...\n');

    // Add new columns to event_entries table
    console.log('📝 Adding entry_type column...');
    await sql`
      ALTER TABLE event_entries 
      ADD COLUMN IF NOT EXISTS entry_type VARCHAR(10) DEFAULT 'live' CHECK (entry_type IN ('live', 'virtual'))
    `;

    console.log('📝 Adding music file columns...');
    await sql`
      ALTER TABLE event_entries 
      ADD COLUMN IF NOT EXISTS music_file_url TEXT,
      ADD COLUMN IF NOT EXISTS music_file_name TEXT
    `;

    console.log('📝 Adding video file columns...');
    await sql`
      ALTER TABLE event_entries 
      ADD COLUMN IF NOT EXISTS video_file_url TEXT,
      ADD COLUMN IF NOT EXISTS video_file_name TEXT,
      ADD COLUMN IF NOT EXISTS video_external_url TEXT,
      ADD COLUMN IF NOT EXISTS video_external_type VARCHAR(20) CHECK (video_external_type IN ('youtube', 'vimeo', 'other'))
    `;

    // Update existing entries to have 'live' as default entry type
    console.log('📝 Setting default entry_type for existing entries...');
    const updateResult = await sql`
      UPDATE event_entries 
      SET entry_type = 'live' 
      WHERE entry_type IS NULL
    `;

    console.log(`✅ Updated ${updateResult.length} existing entries to 'live' type`);

    // Verify the changes
    console.log('🔍 Verifying table structure...');
    const tableInfo = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'event_entries' 
      AND column_name IN ('entry_type', 'music_file_url', 'music_file_name', 'video_file_url', 'video_file_name', 'video_external_url', 'video_external_type')
      ORDER BY column_name
    `;

    console.log('\n📊 New columns added:');
    tableInfo.forEach(col => {
      console.log(`  • ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
    });

    console.log('\n🎉 Live/Virtual Entry columns migration completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('  1. Set up Cloudinary for file storage');
    console.log('  2. Update API endpoints to handle new fields');
    console.log('  3. Add Live/Virtual toggle to entry forms');
    console.log('  4. Implement file upload components');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\n🔍 Troubleshooting:');
    console.error('  • Check DATABASE_URL is correct');
    console.error('  • Ensure database is accessible');
    console.error('  • Verify event_entries table exists');
    process.exit(1);
  }
}

// Run migration
addLiveVirtualEntryColumns();
