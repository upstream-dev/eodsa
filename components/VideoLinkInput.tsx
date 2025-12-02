'use client';

import { useState } from 'react';

interface VideoLinkInputProps {
  entryId: string;
  currentLink?: string;
  onLinkSubmit: (entryId: string, videoUrl: string, videoType: 'youtube' | 'vimeo' | 'other') => Promise<void>;
  disabled?: boolean;
}

export default function VideoLinkInput({ entryId, currentLink = '', onLinkSubmit, disabled = false }: VideoLinkInputProps) {
  const [videoUrl, setVideoUrl] = useState(currentLink);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const detectVideoType = (url: string): 'youtube' | 'vimeo' | 'other' | null => {
    if (!url) return null;
    
    // YouTube patterns
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/') || url.includes('youtube.com/embed')) {
      return 'youtube';
    }
    
    // Vimeo patterns
    if (url.includes('vimeo.com/')) {
      return 'vimeo';
    }

    // Google Drive or other direct links
    if (url.includes('drive.google.com')) {
      return 'other';
    }
    
    return 'other';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!videoUrl.trim()) {
      setError('Please enter a video URL');
      return;
    }

    const videoType = detectVideoType(videoUrl);
    if (!videoType) {
      setError('Please enter a valid YouTube or Vimeo URL');
      return;
    }

    try {
      setIsSubmitting(true);
      await onLinkSubmit(entryId, videoUrl.trim(), videoType);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to save video link');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Video URL (YouTube, Vimeo or Google Drive)
          </label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => {
              setVideoUrl(e.target.value);
              setError('');
            }}
            placeholder="YouTube, Vimeo or Google Drive link (e.g. https://www.youtube.com/watch?v=..., https://vimeo.com/..., or a Google Drive share link)"
            disabled={disabled || isSubmitting}
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {error && (
            <p className="mt-2 text-sm text-red-400">{error}</p>
          )}
          <p className="mt-2 text-xs text-gray-400">
            💡 Supported formats: YouTube (youtube.com/watch?v=..., youtu.be/...), Vimeo (vimeo.com/...), or Google Drive (drive.google.com file links)
          </p>
        </div>
        
        {currentLink && (
          <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
            <p className="text-sm text-green-300">
              ✓ Current video link: <a href={currentLink} target="_blank" rel="noopener noreferrer" className="underline hover:text-green-200">{currentLink}</a>
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={disabled || isSubmitting || !videoUrl.trim() || videoUrl === currentLink}
          className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <span>💾</span>
              <span>Save Video Link</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

