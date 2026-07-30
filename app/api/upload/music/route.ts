import { NextRequest, NextResponse } from 'next/server';
import { cloudinary } from '@/lib/cloudinary';

// Lightweight signature generation for direct Cloudinary uploads
export const dynamic = 'force-dynamic';

const ALLOWED_EXTENSIONS = ['mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'wma', 'webm'];
const ALLOWED_EXTENSIONS_LABEL = 'MP3, WAV, AAC, M4A, FLAC, OGG, WMA, or WebM';
const MAX_FILE_SIZE_BYTES = 200000000; // 200MB

const REJECTED_EXTENSION_MESSAGES: Record<string, string> = {
  mpeg: 'MPEG files are not supported. Please convert your track to MP3 or WAV and try again.',
  mpg: 'MPG/MPEG files are not supported. Please convert your track to MP3 or WAV and try again.',
  mpga: 'MPEG audio files are not supported. Please convert your track to MP3 or WAV and try again.',
  mp2: 'MP2 files are not supported. Please convert your track to MP3 or WAV and try again.',
  aiff: 'AIFF files are not supported. Please convert your track to MP3 or WAV and try again.',
  aif: 'AIFF files are not supported. Please convert your track to MP3 or WAV and try again.',
  mid: 'MIDI files are not supported. Please upload an audio recording (MP3 or WAV).',
  midi: 'MIDI files are not supported. Please upload an audio recording (MP3 or WAV).',
  mov: 'Video files are not allowed for music upload. Please upload an audio file instead.',
  mp4: 'MP4 video files are not allowed for music upload. Please use M4A audio, or convert to MP3/WAV.',
  avi: 'Video files are not allowed for music upload. Please upload an audio file instead.',
  mkv: 'Video files are not allowed for music upload. Please upload an audio file instead.',
};

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
    if (fileSize && fileSize > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size is 200MB.` },
        { status: 400 }
      );
    }

    // Validate file type
    const fileExtension = filename.toLowerCase().split('.').pop() || '';

    if (REJECTED_EXTENSION_MESSAGES[fileExtension]) {
      return NextResponse.json(
        { success: false, error: REJECTED_EXTENSION_MESSAGES[fileExtension] },
        { status: 400 }
      );
    }
    
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json(
        {
          success: false,
          error: `“${filename}” (.${fileExtension.toUpperCase() || 'UNKNOWN'}) is not supported. Allowed formats: ${ALLOWED_EXTENSIONS_LABEL}.`
        },
        { status: 400 }
      );
    }

    // Generate unique public ID (Cloudinary rejects chars like &, #, ?, %, etc.)
    const fileTimestamp = Date.now();
    const originalName = filename
      .replace(/\.[^/.]+$/, '') // strip extension
      .replace(/[^a-zA-Z0-9_-]+/g, '_') // only Cloudinary-safe chars
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 80) || 'track';
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
