/**
 * Script to generate all missing certificates for "Odyssey of dance - Virtual International championship"
 * 
 * Usage: node scripts/generate-odyssey-certificates.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
});

async function generateOdysseyCertificates() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Finding Odyssey event...');
    
    // Find the Odyssey event
    const eventResult = await client.query(`
      SELECT id, name FROM events 
      WHERE name ILIKE '%Odyssey%' OR name ILIKE '%Virtual International%'
      ORDER BY name
    `);
    
    if (eventResult.rows.length === 0) {
      console.error('❌ Odyssey event not found');
      return;
    }
    
    const event = eventResult.rows[0];
    console.log(`✅ Found event: ${event.name} (ID: ${event.id})`);
    
    // Find all published performances without certificates
    const performancesResult = await client.query(`
      SELECT 
        p.id as performance_id,
        p.title,
        p.item_number,
        e.name as event_name
      FROM performances p
      JOIN events e ON e.id = p.event_id
      LEFT JOIN certificates cert ON cert.performance_id = p.id
      WHERE p.scores_published = true
      AND p.event_id = $1
      AND cert.id IS NULL
      AND EXISTS (
        SELECT 1 FROM scores s WHERE s.performance_id = p.id
      )
      ORDER BY p.item_number
    `, [event.id]);
    
    console.log(`\n📋 Found ${performancesResult.rows.length} performances needing certificates\n`);
    
    if (performancesResult.rows.length === 0) {
      console.log('✅ All performances already have certificates!');
      return;
    }
    
    // Display list of performances
    performancesResult.rows.forEach((perf, index) => {
      console.log(`${index + 1}. Item ${perf.item_number || 'N/A'}: ${perf.title}`);
    });
    
    console.log('\n💡 To generate certificates, use the admin panel:');
    console.log('   1. Go to Admin Dashboard → Certificates');
    console.log('   2. Switch to "View Certificates" tab');
    console.log('   3. Select "Odyssey of dance - Virtual International championship" from the event filter');
    console.log('   4. Click "🚀 Generate All Missing Certificates for This Event" button');
    console.log('\n   OR use the API endpoint:');
    console.log(`   POST /api/certificates/batch-generate`);
    console.log(`   Body: { "eventId": "${event.id}" }`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

generateOdysseyCertificates();

