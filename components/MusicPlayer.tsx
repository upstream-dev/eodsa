'use client';

import React, { useState, useRef, useEffect } from 'react';

interface MusicPlayerProps {
  musicUrl: string;
  filename: string;
  publicId?: string;
  className?: string;
  showDownload?: boolean;
  compact?: boolean;
}

export default function MusicPlayer({ 
  musicUrl, 
  filename, 
  publicId,
  className = '',
  showDownload = true,
  compact = false
}: MusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newVolume = parseFloat(e.target.value);
    audio.volume = newVolume;
    setVolume(newVolume);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleDownload = () => {
    // Create download link
    const link = document.createElement('a');
    link.href = musicUrl;
    link.download = filename;
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <audio ref={audioRef} src={musicUrl} preload="metadata" />
        
        <button
          onClick={togglePlayPause}
          disabled={isLoading}
          className="w-8 h-8 bg-purple-600 hover:bg-purple-700 text-white rounded-full flex items-center justify-center transition-colors disabled:bg-gray-400"
        >
          {isLoading ? (
            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
          ) : isPlaying ? (
            <span className="text-xs">⏸️</span>
          ) : (
            <span className="text-xs">▶️</span>
          )}
        </button>

        <span className="text-sm text-gray-600 min-w-0 truncate">{filename}</span>

        {showDownload && (
          <button
            onClick={handleDownload}
            className="text-gray-500 hover:text-purple-600 transition-colors"
            title="Download music file"
          >
            <span className="text-sm">⬇️</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <audio ref={audioRef} src={musicUrl} preload="metadata" />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <span className="text-purple-600">🎵</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900 truncate">{filename}</p>
            <p className="text-sm text-gray-500">Music File</p>
          </div>
        </div>
        
        {showDownload && (
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors flex items-center space-x-1"
            title="Download music file"
          >
            <span>⬇️</span>
            <span>Download</span>
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-3">
        {/* Play/Pause & Time */}
        <div className="flex items-center space-x-3">
          <button
            onClick={togglePlayPause}
            disabled={isLoading}
            className="w-10 h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-full flex items-center justify-center transition-colors disabled:bg-gray-400"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : isPlaying ? (
              <span>⏸️</span>
            ) : (
              <span>▶️</span>
            )}
          </button>

          <div className="flex-1 space-y-1">
            {/* Progress Bar */}
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #7c3aed 0%, #7c3aed ${(currentTime / duration) * 100}%, #e5e7eb ${(currentTime / duration) * 100}%, #e5e7eb 100%)`
              }}
            />
            
            {/* Time Display */}
            <div className="flex justify-between text-xs text-gray-500">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        {/* Volume Control */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">🔊</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #7c3aed 0%, #7c3aed ${volume * 100}%, #e5e7eb ${volume * 100}%, #e5e7eb 100%)`
            }}
          />
          <span className="text-xs text-gray-500 w-8">{Math.round(volume * 100)}%</span>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #7c3aed;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #7c3aed;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
      `}</style>
    </div>
  );
}
