import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export async function POST() {
  try {
    // Get all entries with item numbers
    const allEntries = await db.getAllEventEntries();
    const entriesWithItemNumbers = allEntries.filter(entry => entry.itemNumber);
    
    let syncedCount = 0;
    
    // For each entry with an item number, update its performance
    for (const entry of entriesWithItemNumbers) {
      // Ensure item number is defined
      if (!entry.itemNumber) continue;
      
      // Find the performance for this entry
      const allPerformances = await db.getAllPerformances();
      const performance = allPerformances.find(p => p.eventEntryId === entry.id);
      
      if (performance && performance.itemNumber !== entry.itemNumber) {
        // Update the performance's item number
        await db.updatePerformanceItemNumber(performance.id, entry.itemNumber);
        syncedCount++;
        console.log(`Synced item number ${entry.itemNumber} to performance ${performance.id}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Synced item numbers for ${syncedCount} performances`,
      syncedCount
    });
    
  } catch (error) {
    console.error('Error syncing item numbers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync item numbers' },
      { status: 500 }
    );
  }
} 