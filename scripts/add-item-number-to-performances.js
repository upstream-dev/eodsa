const { neon } = require('@neondatabase/serverless');

// Database connection - hardcoded for migration
const sql = neon('postgres://neondb_owner:npg_Z0wdXg6knSvy@ep-blue-glitter-a4xc1mko-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require');

async function addItemNumberColumn() {
  try {
    console.log('🔧 Adding item_number column to performances table...');
    
    // Add the item_number column
    await sql`
      ALTER TABLE performances 
      ADD COLUMN IF NOT EXISTS item_number INTEGER
    `;
    
    console.log('✅ Successfully added item_number column to performances table');
    
    // Verify the column was added
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'performances' AND column_name = 'item_number'
    `;
    
    if (result.length > 0) {
      console.log('✅ Confirmed: item_number column exists');
      console.log('Column details:', result[0]);
    } else {
      console.log('❌ Warning: item_number column not found after creation');
    }
    
  } catch (error) {
    console.error('❌ Error adding item_number column:', error);
    process.exit(1);
  }
}

// Run the migration
addItemNumberColumn(); 