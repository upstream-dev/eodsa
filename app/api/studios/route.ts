import { NextRequest, NextResponse } from 'next/server';
import { studioDb, initializeDatabase } from '@/lib/database';
import bcrypt from 'bcryptjs';
import { emailService } from '@/lib/email';

// Register a new studio
export async function POST(request: NextRequest) {
  try {
    // Initialize database tables if they don't exist
    // // // await initializeDatabase() // Commented out for performance - initialization happens once on server start; // Commented out for performance - initialization happens once on server start // Commented out for performance - initialization happens once on server start
    
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.email || !body.password || !body.contactPerson || !body.address || !body.phone) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, password, contactPerson, address, phone' },
        { status: 400 }
      );
    }

    // Check if studio already exists
    const existingStudio = await studioDb.getStudioByEmail(body.email);
    if (existingStudio) {
      return NextResponse.json(
        { error: 'Studio with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(body.password, 12);

    // Create studio
    const result = await studioDb.createStudio({
      name: body.name,
      email: body.email,
      password: hashedPassword,
      contactPerson: body.contactPerson,
      address: body.address,
      phone: body.phone
    });

    // Email system disabled for Phase 1
    // try {
    //   await emailService.sendStudioRegistrationEmail(
    //     body.name,
    //     body.contactPerson,
    //     body.email,
    //     result.registrationNumber
    //   );
    //   console.log('Studio registration email sent successfully to:', body.email);
    // } catch (emailError) {
    //   console.error('Failed to send studio registration email:', emailError);
    //   // Don't fail the registration if email fails
    // }

    return NextResponse.json({
      success: true,
      message: 'Studio registered successfully',
      studioId: result.id,
      registrationNumber: result.registrationNumber
    });
  } catch (error) {
    console.error('Error creating studio:', error);
    
    if (error instanceof Error && error.message) {
      if (error.message.includes('already exists') || error.message.includes('duplicate key') || error.message.includes('UNIQUE constraint')) {
        if (error.message.includes('email')) {
          return NextResponse.json(
            { error: 'A studio with this email already exists' },
            { status: 409 }
          );
        } else {
          return NextResponse.json(
            { error: 'A studio with this registration number already exists' },
            { status: 409 }
          );
        }
      }
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create studio' },
      { status: 500 }
    );
  }
}

// Get studio information
export async function GET(request: NextRequest) {
  try {
    // Initialize database tables if they don't exist
    // // // await initializeDatabase() // Commented out for performance - initialization happens once on server start; // Commented out for performance - initialization happens once on server start // Commented out for performance - initialization happens once on server start
    
    const { searchParams } = new URL(request.url);
    const studioId = searchParams.get('id');

    if (!studioId) {
      return NextResponse.json(
        { error: 'Studio ID is required' },
        { status: 400 }
      );
    }

    const studio = await studioDb.getStudioById(studioId);
    if (!studio) {
      return NextResponse.json(
        { error: 'Studio not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      studio: studio
    });
  } catch (error) {
    console.error('Get studio error:', error);
    return NextResponse.json(
      { error: 'Failed to get studio information' },
      { status: 500 }
    );
  }
}

// Update studio information
export async function PUT(request: NextRequest) {
  try {
    // Initialize database tables if they don't exist
    // // // await initializeDatabase() // Commented out for performance - initialization happens once on server start; // Commented out for performance - initialization happens once on server start // Commented out for performance - initialization happens once on server start
    
    const body = await request.json();
    const { studioId, ...updates } = body;

    if (!studioId) {
      return NextResponse.json(
        { error: 'Studio ID is required' },
        { status: 400 }
      );
    }

    await studioDb.updateStudio(studioId, updates);

    return NextResponse.json({
      success: true,
      message: 'Studio updated successfully'
    });
  } catch (error) {
    console.error('Update studio error:', error);
    return NextResponse.json(
      { error: 'Failed to update studio' },
      { status: 500 }
    );
  }
} 