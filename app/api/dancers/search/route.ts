import { NextRequest, NextResponse } from 'next/server';
import { unifiedDb } from '@/lib/database';
import { withCompetitionAges } from '@/lib/competition-age';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '20');
    const eventDate = searchParams.get('eventDate');

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        dancers: [],
        message: 'Please enter at least 2 characters to search'
      });
    }

    // Search for dancers by name, EODSA ID, or national ID
    const dancers = await unifiedDb.searchDancers(query, limit);
    const ageContext = eventDate ? { eventDate } : {};

    // Transform dancers for participant selection — expose competition age for eligibility UI
    const searchResults = dancers.map((dancer: any) => {
      const withAges = withCompetitionAges(
        {
          age: dancer.age,
          dateOfBirth: dancer.dateOfBirth,
        },
        ageContext
      );

      return {
        id: dancer.id,
        name: dancer.name,
        eodsaId: dancer.eodsaId,
        // Event entry UIs use `age` for eligibility — return competition age
        age: withAges.competitionAge ?? dancer.age,
        competitionAge: withAges.competitionAge,
        chronologicalAge: withAges.chronologicalAge,
        competitionAgeCategory: withAges.competitionAgeCategory,
        dateOfBirth: dancer.dateOfBirth,
        nationalId: dancer.nationalId,
        email: dancer.email,
        phone: dancer.phone,
        studioName: dancer.studioAssociation?.studioName || null,
        type: dancer.studioAssociation ? 'studio' : 'private',
        isActive: !dancer.rejectionReason,
        rejectionReason: dancer.rejectionReason,
        seasonYear: withAges.seasonYear,
        nationalsReferenceDate: withAges.nationalsReferenceDate,
      };
    });

    // Filter out rejected/disabled accounts
    const activeResults = searchResults.filter((dancer: any) => dancer.isActive);

    return NextResponse.json({
      success: true,
      dancers: activeResults,
      total: activeResults.length
    });

  } catch (error) {
    console.error('Error searching dancers:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to search dancers',
        dancers: []
      },
      { status: 500 }
    );
  }
}
