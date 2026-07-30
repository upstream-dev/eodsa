import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

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

    // Validate file size (100MB limit for videos)
    if (fileSize && fileSize > 100000000) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 100MB.' },
        { status: 400 }
      );
    }

    // Validate file type
    const fileExtension = filename.toLowerCase().split('.').pop();
    const allowedExtensions = ['mp4', 'mov', 'avi', 'wmv', 'webm', 'flv', 'm4v', '3gp'];
    
    if (!allowedExtensions.includes(fileExtension || '')) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Please upload video files with extensions: MP4, MOV, AVI, WMV, WebM, FLV, or M4V.' },
        { status: 400 }
      );
    }

    // Generate unique public ID (Cloudinary rejects chars like &, #, ?, %, etc.)
    const fileTimestamp = Date.now();
    const originalName = filename
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 80) || 'video';
    const publicId = `eodsa/videos/${fileTimestamp}_${originalName}`;

    // Generate upload signature for video
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = {
      public_id: publicId,
      timestamp: timestamp,
      resource_type: 'video'
    };

    console.log('🔐 Generating video signature with params:', paramsToSign);
    console.log(' API Key:', process.env.CLOUDINARY_API_KEY);
    console.log('☁️ Cloud Name:', process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET!
    );

    console.log('✍️ Generated video signature:', signature);

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
    console.error('Error generating video upload signature:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
