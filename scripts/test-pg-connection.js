#!/usr/bin/env node

/**
 * Test pg library connection to database
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function testPgConnection() {
  console.log('🔍 Testing pg library connection...\n');

  const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL or DATABASE_URL_UNPOOLED is not set');
    process.exit(1);
  }

  console.log('✅ Database URL is set');
  console.log(`   URL: ${databaseUrl.substring(0, 50)}...\n`);

  try {
    console.log('🔄 Creating pg Pool...');
    const pool = new Pool({ 
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
    
    console.log('🔄 Testing connection with SELECT 1...');
    const startTime = Date.now();
    const result = await pool.query('SELECT 1 as test, NOW() as current_time');
    const duration = Date.now() - startTime;
    
    console.log('✅ Connection successful!');
    console.log(`   Response time: ${duration}ms`);
    console.log(`   Result:`, result.rows);
    
    console.log('\n🔄 Testing clients table query...');
    const clientsStart = Date.now();
    const clients = await pool.query(`
      SELECT id, name, email 
      FROM clients 
      LIMIT 5
    `);
    const clientsDuration = Date.now() - clientsStart;
    
    console.log('✅ Clients query successful!');
    console.log(`   Response time: ${clientsDuration}ms`);
    console.log(`   Found ${clients.rows.length} clients`);
    
    await pool.end();
    console.log('\n✅ All tests passed with pg library!');
    
  } catch (error) {
    console.error('\n❌ Test failed!');
    console.error('   Error:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Error type:', error.constructor.name);
    if (error.stack) {
      console.error('\n   Stack:', error.stack.split('\n').slice(0, 10).join('\n'));
    }
    process.exit(1);
  }
}

testPgConnection();

