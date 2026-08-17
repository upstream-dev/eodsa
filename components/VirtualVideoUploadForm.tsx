'use client';

import { useEffect, useState } from 'react';

interface VirtualVideoUploadFormProps {
  entryId: string;
  eodsaId: string;
  initialVideoUrl?: string | null;
  onSuccess?: () => void;
  compact?: boolean;
}

function convertGoogleDriveUrl(url: string): string {
  if (!url || !url.includes('drive.google.com')) return url;

  const fileIdPattern = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
  const match = url.match(fileIdPattern);
  if (match?.[1]) {
    return `https://drive.google.com/file/d/${match[1]}/preview`;
  }

  const openPattern = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
  const openMatch = url.match(openPattern);
  if (openMatch?.[1]) {
    return `https://drive.google.com/file/d/${openMatch[1]}/preview`;
  }

  return url;
}

function detectVideoType(url: string): 'youtube' | 'vimeo' | 'other' {
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('vimeo.com')) return 'vimeo';
  return 'other';
}

async function validateGoogleDriveUrl(url: string): Promise<{ isValid: boolean; error?: string }> {
  if (!url || !url.includes('drive.google.com')) {
    return { isValid: true };
  }

  try {
    const response = await fetch('/api/validate/google-drive-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await response.json();

    if (data.success && data.isValid) {
      return { isValid: true };
    }

    if (data.success && !data.isValid) {
      return {
        isValid: false,
        error: data.error || 'This Drive link is private. Please set it to "Anyone with the link" before saving.',
      };
    }

    return {
      isValid: true,
      error: data.message || 'Could not verify access. Please ensure the file is shared with "Anyone with the link".',
    };
  } catch {
    return {
      isValid: true,
      error: 'Could not verify access. Please ensure the file is shared with "Anyone with the link".',
    };
  }
}

export default function VirtualVideoUploadForm({
  entryId,
  eodsaId,
  initialVideoUrl,
  onSuccess,
  compact = false,
}: VirtualVideoUploadFormProps) {
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl || '');
  const [error, setError] = useState('');
  const [urlError, setUrlError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [savedUrl, setSavedUrl] = useState(initialVideoUrl || '');

  useEffect(() => {
    setVideoUrl(initialVideoUrl || '');
    setSavedUrl(initialVideoUrl || '');
  }, [initialVideoUrl, entryId]);

  const handleChange = (url: string) => {
    setVideoUrl(url);
    setUrlError('');

    if (url.includes('drive.google.com')) {
      const convertedUrl = convertGoogleDriveUrl(url);
      if (convertedUrl !== url) {
        setVideoUrl(convertedUrl);
      }
    }
  };

  const handleBlur = async (url: string) => {
    if (!url.includes('drive.google.com')) return;

    setIsValidating(true);
    const validation = await validateGoogleDriveUrl(url);
    setIsValidating(false);

    if (!validation.isValid && validation.error) {
      setUrlError(validation.error);
    }
  };

  const handleSubmit = async () => {
    const url = videoUrl.trim();
    if (!url) {
      setError('Please enter a video URL');
      return;
    }

    if (url.includes('drive.google.com')) {
      setIsValidating(true);
      const validation = await validateGoogleDriveUrl(url);
      setIsValidating(false);

      if (!validation.isValid && validation.error) {
        setUrlError(validation.error);
        return;
      }
    }

    try {
      setIsUploading(true);
      setError('');

      const processedUrl = url.includes('drive.google.com') ? convertGoogleDriveUrl(url) : url;
      const response = await fetch('/api/contestants/upload-video', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId,
          videoExternalUrl: processedUrl,
          videoExternalType: detectVideoType(processedUrl),
          eodsaId,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        setError(result.error || 'Failed to save video URL');
        return;
      }

      setSavedUrl(processedUrl);
      onSuccess?.();
    } catch {
      setError('Failed to save video URL');
    } finally {
      setIsUploading(false);
    }
  };

  const activeUrl = savedUrl || initialVideoUrl || '';

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {activeUrl && (
        <div className="p-3 bg-green-900/20 border border-[rgba(192,192,192,0.22)] rounded-lg">
          <div className="flex items-center justify-between gap-3">
            <span className="text-green-300 text-sm font-medium">Video link submitted</span>
            <a
              href={activeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--chrome-mid)] hover:text-green-300 text-sm underline"
            >
              View Video
            </a>
          </div>
        </div>
      )}

      {!compact && (
        <p className="text-sm text-gray-400">
          {activeUrl
            ? 'Update your video link below if needed:'
            : 'Submit a video link (YouTube, Vimeo, or Google Drive) for this virtual performance:'}
        </p>
      )}

      <input
        type="url"
        value={videoUrl}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={(e) => handleBlur(e.target.value)}
        placeholder="https://www.youtube.com/watch?v=... or https://drive.google.com/..."
        disabled={isUploading}
        className={`w-full p-3 bg-gray-800 border-2 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${
          urlError
            ? 'border-red-500 focus:ring-red-500'
            : 'border-gray-600 focus:ring-[rgba(192,192,192,0.45)] focus:border-[rgba(192,192,192,0.5)]'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      />

      {isValidating && (
        <div className="text-sm text-blue-400 flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400" />
          <span>Checking Google Drive access...</span>
        </div>
      )}

      {urlError && (
        <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
          {urlError}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!videoUrl.trim() || isUploading || !!urlError || isValidating}
        className="w-full px-4 py-2 btn-chrome !rounded-full text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
      >
        {isUploading ? 'Saving...' : 'Save Video Link'}
      </button>
    </div>
  );
}
