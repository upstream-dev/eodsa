import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/database';
import { calculateAgeCategoryForEntry } from '@/lib/age-category-calculator';

/**
 * Entries with NULL age_category or performance_type show on the dancer dashboard
 * but cannot be scored and may not appear in judge/announcer/rankings views.
 * This endpoint backfills those fields from participant_ids and event date.
 *
 * GET: List event_entries that have NULL age_category or performance_type
 * POST: Backfill age_category and performance_type for all such entries
 */

function performanceTypeFromParticipantCount(count: number): string {
  if (count <= 0) return 'Solo';
  if (count === 1) return 'Solo';
  if (count === 2) return 'Duet';
  if (count === 3) return 'Trio';
  return 'Group';
}

export async function GET() {
  try {
    const sqlClient = getSql();
    const rows = await sqlClient`
      SELECT ee.id, ee.item_name, ee.event_id, ee.participant_ids,
             ee.age_category, ee.performance_type,
             e.name as event_name, e.event_date
      FROM event_entries ee
      JOIN events e ON e.id = ee.event_id
      WHERE ee.age_category IS NULL OR ee.performance_type IS NULL
      ORDER BY ee.submitted_at DESC
    ` as any[];

    const entries = (Array.isArray(rows) ? rows : []) as any[];
    return NextResponse.json({
      success: true,
      count: entries.length,
      entries: entries.map((r) => ({
        id: r.id,
        itemName: r.item_name,
        eventId: r.event_id,
        eventName: r.event_name,
        eventDate: r.event_date,
        currentAgeCategory: r.age_category,
        currentPerformanceType: r.performance_type,
        participantCount: (() => {
          try {
            const ids = typeof r.participant_ids === 'string' ? JSON.parse(r.participant_ids) : r.participant_ids;
            return Array.isArray(ids) ? ids.length : 0;
          } catch {
            return 0;
          }
        })(),
      })),
    });
  } catch (error) {
    console.error('Backfill entry metadata GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to list entries' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sqlClient = getSql();

    const rows = await sqlClient`
      SELECT ee.id, ee.item_name, ee.event_id, ee.participant_ids,
             ee.age_category, ee.performance_type,
             e.event_date
      FROM event_entries ee
      JOIN events e ON e.id = ee.event_id
      WHERE ee.age_category IS NULL OR ee.performance_type IS NULL
      ORDER BY ee.submitted_at DESC
    ` as any[];

    const entries = (Array.isArray(rows) ? rows : []) as any[];
    if (entries.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No entries with NULL age_category or performance_type.',
        updated: 0,
        failed: 0,
        details: [],
      });
    }

    let updated = 0;
    let failed = 0;
    const details: Array<{ id: string; itemName: string; performanceType: string; ageCategory: string; error?: string }> = [];

    for (const row of entries) {
      let participantIds: string[] = [];
      try {
        participantIds =
          typeof row.participant_ids === 'string'
            ? JSON.parse(row.participant_ids)
            : Array.isArray(row.participant_ids)
              ? row.participant_ids
              : [];
      } catch {
        participantIds = [];
      }

      const performanceType = performanceTypeFromParticipantCount(participantIds.length);
      const eventDate =
        row.event_date instanceof Date
          ? row.event_date.toISOString().slice(0, 10)
          : String(row.event_date || '').slice(0, 10);

      let ageCategory = 'N/A';
      if (participantIds.length > 0 && eventDate) {
        try {
          ageCategory = await calculateAgeCategoryForEntry(participantIds, eventDate, sqlClient);
        } catch (err) {
          console.warn(`Age category calculation failed for entry ${row.id}:`, err);
        }
      }

      try {
        await sqlClient`
          UPDATE event_entries
          SET performance_type = ${performanceType},
              age_category = ${ageCategory}
          WHERE id = ${row.id}
        `;
        updated++;
        details.push({
          id: row.id,
          itemName: row.item_name,
          performanceType,
          ageCategory,
        });
      } catch (err) {
        failed++;
        details.push({
          id: row.id,
          itemName: row.item_name,
          performanceType,
          ageCategory,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Backfilled ${updated} entries. ${failed} failed.`,
      updated,
      failed,
      total: entries.length,
      details,
    });
  } catch (error) {
    console.error('Backfill entry metadata POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Backfill failed' },
      { status: 500 }
    );
  }
}
