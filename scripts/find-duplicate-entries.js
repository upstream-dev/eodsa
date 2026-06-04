/**
 * Find duplicate event_entries (same event + item + participants).
 * Reports whether each duplicate pair has separate payments (double charge risk).
 *
 * Usage:
 *   node scripts/find-duplicate-entries.js [eventId]
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

function normalizeItemName(name) {
  return (name || '').trim().toLowerCase();
}

function parseParticipantIds(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.filter(Boolean).map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function fingerprint(itemName, participantIds) {
  const ids = [...participantIds].map(String).filter(Boolean).sort();
  return `${normalizeItemName(itemName)}|${ids.join(',')}`;
}

async function main() {
  const eventIdFilter = process.argv[2];
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  const entries = eventIdFilter
    ? await sql`
        SELECT ee.*, e.name AS event_name
        FROM event_entries ee
        JOIN events e ON e.id = ee.event_id
        WHERE ee.event_id = ${eventIdFilter}
        ORDER BY ee.submitted_at DESC
      `
    : await sql`
        SELECT ee.*, e.name AS event_name
        FROM event_entries ee
        JOIN events e ON e.id = ee.event_id
        WHERE ee.submitted_at::timestamptz >= NOW() - INTERVAL '30 days'
        ORDER BY ee.submitted_at::timestamptz DESC
      `;

  const groups = new Map();
  for (const row of entries) {
    const fp = `${row.event_id}::${fingerprint(row.item_name, parseParticipantIds(row.participant_ids))}`;
    if (!groups.has(fp)) groups.set(fp, []);
    groups.get(fp).push(row);
  }

  const dupGroups = [...groups.values()].filter((g) => g.length > 1);
  console.log(`\n📊 Scanned ${entries.length} entries — ${dupGroups.length} duplicate groups\n`);

  if (dupGroups.length === 0) {
    console.log('✅ No duplicates found in scope.');
    return;
  }

  let doubleChargeSuspects = 0;

  for (const group of dupGroups) {
    const sample = group[0];
    const paymentIds = new Set(group.map((r) => r.payment_id).filter(Boolean));
    const paidCount = group.filter((r) => r.payment_status === 'paid').length;
    const totalFees = group.reduce((s, r) => s + parseFloat(r.calculated_fee || 0), 0);
    const likelyDoubleCharge = paymentIds.size > 1 && paidCount > 1;

    if (likelyDoubleCharge) doubleChargeSuspects++;

    console.log('─'.repeat(70));
    console.log(`Event: ${sample.event_name} (${sample.event_id})`);
    console.log(`Item: ${sample.item_name}`);
    console.log(`Duplicates: ${group.length} | Paid rows: ${paidCount} | Distinct payment_ids: ${paymentIds.size}`);
    console.log(`Sum of calculated_fee on all rows: R${totalFees.toFixed(2)}`);
    console.log(likelyDoubleCharge ? '🚨 LIKELY DOUBLE CHARGE (multiple completed payments)' : '⚠️  Duplicate rows (same payment or EFT resubmit — verify manually)');

    for (const row of group) {
      console.log(`   • ${row.id} | ${row.payment_status} | ${row.payment_method || '—'} | R${row.calculated_fee} | payment_id=${row.payment_id || '—'} | ref=${row.payment_reference || '—'} | ${row.submitted_at}`);
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`Summary: ${dupGroups.length} duplicate groups, ${doubleChargeSuspects} with multiple payment_ids (investigate refunds)\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
