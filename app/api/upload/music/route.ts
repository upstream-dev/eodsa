import { NextRequest, NextResponse } from 'next/server';
import { cloudinary } from '@/lib/cloudinary';

// Lightweight signature generation for direct Cloudinary uploads
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename, fileSize } = body;
    
    if (!filename) {
      return NextResponse.json(
        { success: false, error: 'Filename is required' },
        { status: 400 }
      );
    }

    // Validate file size (200MB limit)
    if (fileSize && fileSize > 200000000) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 200MB.' },
        { status: 400 }
      );
    }

    // Validate file type
    const fileExtension = filename.toLowerCase().split('.').pop();
    const allowedExtensions = ['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'wma', 'webm'];
    
    if (!allowedExtensions.includes(fileExtension || '')) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Please upload audio files with extensions: MP3, WAV, AAC, M4A, FLAC, OGG, WMA, or WebM.' },
        { status: 400 }
      );
    }

    // Generate unique public ID
    const fileTimestamp = Date.now();
    const originalName = filename.replace(/\.[^/.]+$/, "").replace(/\s+/g, "_"); // Remove extension and replace spaces with underscores
    const publicId = `eodsa/music/${fileTimestamp}_${originalName}`;

    // Generate upload signature (no upload preset needed for signed uploads)
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = {
      public_id: publicId,
      timestamp: timestamp,
    };

    console.log('🔐 Generating signature with params:', paramsToSign);
    console.log(' API Key:', process.env.CLOUDINARY_API_KEY);
    console.log('☁️ Cloud Name:', process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET!
    );

    console.log('✍️ Generated signature:', signature);

    return NextResponse.json({
      success: true,
      data: {
        signature,
        timestamp,
        public_id: publicId,
        api_key: process.env.CLOUDINARY_API_KEY,
        cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        resource_type: 'video'
      }
    });

  } catch (error: any) {
    console.error('Signature generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate upload signature' },
      { status: 500 }
    );
  }
}
