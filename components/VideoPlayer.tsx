'use client';

import React from 'react';

interface VideoPlayerProps {
  videoUrl: string;
  videoType: 'youtube' | 'vimeo' | 'other';
  title?: string;
  className?: string;
}

export default function VideoPlayer({ 
  videoUrl, 
  videoType, 
  title = "Performance Video",
  className = '' 
}: VideoPlayerProps) {
  
  // Extract video ID from URLs for embedding
  const getEmbedUrl = (url: string, type: string) => {
    try {
      if (type === 'youtube') {
        // Handle various YouTube URL formats
        const videoId = extractYouTubeId(url);
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
      } else if (type === 'vimeo') {
        // Handle Vimeo URLs
        const videoId = extractVimeoId(url);
        return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
      }
      return null;
    } catch (error) {
      console.error('Error creating embed URL:', error);
      return null;
    }
  };

  const extractYouTubeId = (url: string) => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  };

  const extractVimeoId = (url: string) => {
    const regExp = /vimeo\.com\/(?:video\/)?(\d+)/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  };

  const embedUrl = getEmbedUrl(videoUrl, videoType);

  if (!videoUrl) {
    return (
      <div className={`bg-gray-100 border border-gray-300 rounded-lg p-4 ${className}`}>
        <p className="text-gray-500 text-center">No video provided</p>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-black flex items-center">
          <span className="mr-2">📹</span>
          Performance Video ({videoType?.toUpperCase()})
        </h3>
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          Open in New Tab
        </a>
      </div>

      {embedUrl ? (
        <div className="relative w-full" style={{ paddingBottom: '56.25%' /* 16:9 aspect ratio */ }}>
          <iframe
            src={embedUrl}
            title={title}
            className="absolute top-0 left-0 w-full h-full rounded-lg"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">
                {videoType?.toUpperCase()} Video Link
              </p>
              <p className="text-xs text-blue-700 truncate max-w-md">
                {videoUrl}
              </p>
            </div>
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              Watch Video
            </a>
          </div>
        </div>
      )}

      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-700">
          <strong>Judge Instructions:</strong> Review the complete performance video before scoring. 
          You can pause, rewind, and rewatch as needed for accurate evaluation.
        </p>
      </div>
    </div>
  );
}
