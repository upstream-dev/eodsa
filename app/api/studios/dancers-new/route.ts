import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb, initializeDatabase } from '@/lib/database';
import { withCompetitionAges } from '@/lib/competition-age';

// Get all accepted dancers for a studio in the new unified system
export async function GET(request: NextRequest) {
  try {
    await initializeDatabase(); // Temporarily enabled to run schema migrations - will disable after columns are added
    
    const { searchParams } = new URL(request.url);
    const studioId = searchParams.get('studioId');
    const eventDate = searchParams.get('eventDate');
    // competition: event entry UIs; chronological (default): studio legal/minors filters
    const ageMode = searchParams.get('ageMode') || 'chronological';

    if (!studioId) {
      return NextResponse.json(
        { error: 'Studio ID is required' },
        { status: 400 }
      );
    }

    const dancers = await unifiedDb.getStudioDancers(studioId);
    const ageContext = eventDate ? { eventDate } : {};
    const enriched = dancers.map((dancer: any) => {
      const ages = withCompetitionAges(dancer, ageContext);
      return {
        ...dancer,
        ...ages,
        // Studio dashboard keeps chronological `age` for under-18 filters.
        // Event dashboards pass ageMode=competition so `age` is competition age.
        age:
          ageMode === 'competition'
            ? (ages.competitionAge ?? dancer.age)
            : (ages.chronologicalAge ?? dancer.age),
      };
    });

    return NextResponse.json({
      success: true,
      dancers: enriched
    });
  } catch (error) {
    console.error('Error getting studio dancers:', error);
    return NextResponse.json(
      { error: 'Failed to get studio dancers' },
      { status: 500 }
    );
  }
} 