/**
 * Option C: Backfill dancer_nationals_qualifications table
 *
 * Populates the stored qualification from existing Regional performances.
 * Water and Fire only; Air and Earth never qualify.
 *
 * Run after deploying Option C: node scripts/backfill-nationals-qualification.js
 */

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

async function backfill() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  console.log('🔄 Backfilling dancer_nationals_qualifications (Option C, Water/Fire only)...\n');

  try {
    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS dancer_nationals_qualifications (
        dancer_id TEXT PRIMARY KEY,
        best_qualifying_score REAL,
        updated_at TEXT NOT NULL DEFAULT (now()::text)
      )
    `;

    // Get all dancers (process everyone for complete coverage)
    const dancers = await sql`SELECT id as dancer_id FROM dancers`;

    console.log(`Found ${dancers.length} dancers with entries. Computing qualification...\n`);

    let qualified = 0;
    let notQualified = 0;

    for (const row of dancers) {
      const dancerId = row.dancer_id;

      // Compute best qualifying score (Water/Fire Regional only)
      const scores = await sql`
        SELECT AVG(
          s.technical_score + s.musical_score + s.performance_score +
          s.styling_score + s.overall_impression_score
        )::real as avg_score
        FROM performances p
        JOIN event_entries ee ON ee.id = p.event_entry_id
        JOIN events e ON e.id = ee.event_id
        JOIN scores s ON s.performance_id = p.id
        JOIN dancers d ON d.id = ${dancerId}
        WHERE (
          ee.eodsa_id = d.eodsa_id
          OR ee.participant_ids::text LIKE '%' || d.id || '%'
          OR ee.participant_ids::text LIKE '%' || d.eodsa_id || '%'
        )
        AND e.event_type = 'REGIONAL_EVENT'
        AND p.scores_published = true
        AND COALESCE(NULLIF(TRIM(p.mastery), ''), ee.mastery) IN ('Water (Competitive)', 'Fire (Advanced)')
        GROUP BY p.id
      `;

      const bestScore =
        scores.length > 0
          ? Math.max(...scores.map((r) => Number(r.avg_score) || 0))
          : null;

      const updatedAt = new Date().toISOString();

      await sql`
        INSERT INTO dancer_nationals_qualifications (dancer_id, best_qualifying_score, updated_at)
        VALUES (${dancerId}, ${bestScore}, ${updatedAt})
        ON CONFLICT (dancer_id) DO UPDATE SET
          best_qualifying_score = EXCLUDED.best_qualifying_score,
          updated_at = EXCLUDED.updated_at
      `;

      if (bestScore != null && bestScore > 0) {
        qualified++;
      } else {
        notQualified++;
      }
    }

    console.log('✅ Backfill complete\n');
    console.log(`   Qualified (Water/Fire Regional ≥ score): ${qualified}`);
    console.log(`   Not qualified: ${notQualified}`);
    console.log(`   Total processed: ${dancers.length}`);
  } catch (err) {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
  }
}

backfill().then(() => process.exit(0)).catch(() => process.exit(1));
