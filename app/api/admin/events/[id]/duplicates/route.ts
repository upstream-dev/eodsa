import { NextRequest, NextResponse } from 'next/server';
import { db, unifiedDb } from '@/lib/database';
import { findDuplicateGroupsForEvent } from '@/lib/duplicate-entry-cleanup';

async function verifyAdmin(adminId: string) {
  const admin = await db.getJudgeById(adminId);
  if (!admin?.isAdmin) {
    return null;
  }
  return admin;
}

/** GET — list duplicate entry groups for this event */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const adminId = request.nextUrl.searchParams.get('adminId');
    if (!adminId || !(await verifyAdmin(adminId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const groups = await findDuplicateGroupsForEvent(eventId);
    const totalToDelete = groups.reduce((n, g) => n + g.deleteEntryIds.length, 0);

    return NextResponse.json({
      success: true,
      eventId,
      groupCount: groups.length,
      entriesToDelete: totalToDelete,
      likelyDoubleChargeGroups: groups.filter((g) => g.likelyDoubleCharge).length,
      groups,
    });
  } catch (error) {
    console.error('List duplicates error:', error);
    return NextResponse.json({ success: false, error: 'Failed to list duplicates' }, { status: 500 });
  }
}

/** POST — remove duplicate entries (keeps best row per group) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const body = await request.json();
    const { adminId, dryRun } = body as { adminId?: string; dryRun?: boolean };

    if (!adminId || !(await verifyAdmin(adminId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const groups = await findDuplicateGroupsForEvent(eventId);
    const deleted: string[] = [];
    const errors: Array<{ entryId: string; error: string }> = [];

    for (const group of groups) {
      for (const entryId of group.deleteEntryIds) {
        if (dryRun) {
          deleted.push(entryId);
          continue;
        }
        try {
          await unifiedDb.deleteEntryAsAdmin(adminId, entryId);
          deleted.push(entryId);
        } catch (e) {
          errors.push({
            entryId,
            error: e instanceof Error ? e.message : 'Delete failed',
          });
        }
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      dryRun: !!dryRun,
      eventId,
      groupCount: groups.length,
      deletedCount: deleted.length,
      deleted,
      errors,
      groups: groups.map((g) => ({
        itemName: g.itemName,
        keepEntryId: g.keepEntryId,
        deleteEntryIds: g.deleteEntryIds,
        likelyDoubleCharge: g.likelyDoubleCharge,
      })),
    });
  } catch (error) {
    console.error('Remove duplicates error:', error);
    return NextResponse.json({ success: false, error: 'Failed to remove duplicates' }, { status: 500 });
  }
}
