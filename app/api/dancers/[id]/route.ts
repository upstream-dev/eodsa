import { NextResponse } from 'next/server';
import { unifiedDb } from '@/lib/database';
import { withCompetitionAges } from '@/lib/competition-age';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const eventDate = new URL(request.url).searchParams.get('eventDate');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Dancer ID is required' },
        { status: 400 }
      );
    }

    const dancer = await unifiedDb.getDancerById(id);
    
    if (!dancer) {
      return NextResponse.json(
        { success: false, error: 'Dancer not found' },
        { status: 404 }
      );
    }

    const ages = withCompetitionAges(dancer, eventDate ? { eventDate } : {});
    const detailedDancer = {
      ...dancer,
      ...ages,
      age: ages.competitionAge ?? dancer.age,
      studioAffiliations: [],
      entries: []
    };

    return NextResponse.json({
      success: true,
      dancer: detailedDancer
    });
  } catch (error) {
    console.error('Error fetching dancer details:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dancer details' },
      { status: 500 }
    );
  }
}

