import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';

// Get a specific judge's score for a performance (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ performanceId: string; judgeId: string }> }
) {
  try {
    const { performanceId, judgeId } = await params;

    if (!performanceId || !judgeId) {
      return NextResponse.json(
        { success: false, error: 'Performance ID and Judge ID are required' },
        { status: 400 }
      );
    }

    // Get the score
    const score = await db.getScoreByJudgeAndPerformance(judgeId, performanceId);

    return NextResponse.json({
      success: true,
      score
    });

  } catch (error) {
    console.error('Error fetching admin score:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch score' },
      { status: 500 }
    );
  }
}

// Update a specific judge's score (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ performanceId: string; judgeId: string }> }
) {
  try {
    const { performanceId, judgeId } = await params;
    const body = await request.json();
    const { technique, musicality, performance, styling, overallImpression, comments, adminReason } = body;

    if (!performanceId || !judgeId) {
      return NextResponse.json(
        { success: false, error: 'Performance ID and Judge ID are required' },
        { status: 400 }
      );
    }

    // Validate score ranges
    if (technique < 0 || technique > 20 || 
        musicality < 0 || musicality > 20 || 
        performance < 0 || performance > 20 ||
        styling < 0 || styling > 20 ||
        overallImpression < 0 || overallImpression > 20) {
      return NextResponse.json(
        { success: false, error: 'Scores must be between 0 and 20' },
        { status: 400 }
      );
    }

    // Check if score exists
    const existingScore = await db.getScoreByJudgeAndPerformance(judgeId, performanceId);
    
    if (!existingScore) {
      return NextResponse.json(
        { success: false, error: 'Score not found' },
        { status: 404 }
      );
    }

    // Update the score (admin override)
    await db.updateScore(existingScore.id, {
      technicalScore: Number(technique),
      musicalScore: Number(musicality),
      performanceScore: Number(performance),
      stylingScore: Number(styling),
      overallImpressionScore: Number(overallImpression),
      comments: comments || ''
    });

    // Log the admin action (you could add this to an audit log table)
    console.log(`Admin updated score for performance ${performanceId}, judge ${judgeId}. Reason: ${adminReason || 'No reason provided'}`);

    return NextResponse.json({
      success: true,
      message: 'Score updated successfully by admin',
      adminAction: true
    });

  } catch (error) {
    console.error('Error updating admin score:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update score' },
      { status: 500 }
    );
  }
}

// Delete a specific judge's score (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ performanceId: string; judgeId: string }> }
) {
  try {
    const { performanceId, judgeId } = await params;
    const { adminReason } = await request.json();

    if (!performanceId || !judgeId) {
      return NextResponse.json(
        { success: false, error: 'Performance ID and Judge ID are required' },
        { status: 400 }
      );
    }

    // Check if score exists
    const existingScore = await db.getScoreByJudgeAndPerformance(judgeId, performanceId);
    
    if (!existingScore) {
      return NextResponse.json(
        { success: false, error: 'Score not found' },
        { status: 404 }
      );
    }

    // Delete the score
    await db.deleteScore(existingScore.id);

    // Log the admin action
    console.log(`Admin deleted score for performance ${performanceId}, judge ${judgeId}. Reason: ${adminReason || 'No reason provided'}`);

    return NextResponse.json({
      success: true,
      message: 'Score deleted successfully by admin',
      adminAction: true
    });

  } catch (error) {
    console.error('Error deleting admin score:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete score' },
      { status: 500 }
    );
  }
} 