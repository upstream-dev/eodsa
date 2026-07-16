import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb } from '@/lib/database';
import { withCompetitionAges } from '@/lib/competition-age';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eodsaId: string }> }
) {
  try {
    const { eodsaId } = await params;
    const eventDate = request.nextUrl.searchParams.get('eventDate');

    if (!eodsaId) {
      return NextResponse.json(
        { error: 'EODSA ID is required' },
        { status: 400 }
      );
    }

    const dancer = await unifiedDb.getDancerByEodsaId(eodsaId);

    if (!dancer) {
      return NextResponse.json(
        { error: 'Dancer not found with this EODSA ID' },
        { status: 404 }
      );
    }

    const applications = await unifiedDb.getDancerApplications(dancer.id);
    const acceptedApplication = applications.find(app => app.status === 'accepted');
    const ages = withCompetitionAges(dancer, eventDate ? { eventDate } : {});

    const enhancedDancer = {
      ...dancer,
      ...ages,
      // Event dashboards historically read `age` for eligibility — use competition age
      age: ages.competitionAge ?? dancer.age,
      studioAssociation: acceptedApplication ? {
        studioId: acceptedApplication.studioId,
        studioName: acceptedApplication.studio.name,
        joinedAt: acceptedApplication.respondedAt
      } : null
    };

    return NextResponse.json({
      success: true,
      dancer: enhancedDancer
    });
  } catch (error) {
    console.error('Error getting dancer by EODSA ID:', error);
    return NextResponse.json(
      { error: 'Failed to get dancer data' },
      { status: 500 }
    );
  }
} 