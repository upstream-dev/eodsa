'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Pause, Play, Volume2 } from 'lucide-react';

interface MusicPlayerProps {
  musicUrl: string;
  filename: string;
  publicId?: string;
  className?: string;
  showDownload?: boolean;
  compact?: boolean;
  onPlayingChange?: (isPlaying: boolean) => void;
  /** When true, never preload until the user presses play (default: true — required for mobile lists) */
  lazyLoad?: boolean;
}

/** Rewrite Cloudinary URLs to deliver MP3 (iOS-safe). Leaves non-Cloudinary URLs alone. */
export function toPlayableAudioUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('res.cloudinary.com') || !url.includes('/video/upload/')) return url;
  // Already has a format transform
  if (/\/upload\/(?:[^/]+,)*f_/.test(url)) return url;
  return url.replace('/video/upload/', '/video/upload/f_mp3,q_auto/');
}

export default function MusicPlayer({
  musicUrl,
  filename,
  publicId,
  className = '',
  showDownload = true,
  compact = false,
  onPlayingChange,
  lazyLoad = true,
}: MusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [srcReady, setSrcReady] = useState(!lazyLoad);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playableUrl = toPlayableAudioUrl(musicUrl);

  const stopPlaying = useCallback(() => {
    setIsPlaying(false);
    onPlayingChange?.(false);
  }, [onPlayingChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const handleEnded = () => stopPlaying();
    const handleLoadStart = () => {
      setIsLoading(true);
      setError(null);
    };
    const handleCanPlay = () => setIsLoading(false);
    const handleError = () => {
      setIsLoading(false);
      stopPlaying();
      setError('Failed to load track. Try Download or open the file in a new tab.');
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
    };
  }, [stopPlaying, srcReady]);

  // Reset when URL changes
  useEffect(() => {
    setSrcReady(!lazyLoad);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError(null);
    setIsLoading(false);
  }, [playableUrl, lazyLoad]);

  const ensureLoaded = async () => {
    const audio = audioRef.current;
    if (!audio) return false;

    // Always set src on the element (don't wait on React) — critical for iOS Safari
    if (!srcReady) setSrcReady(true);
    if (audio.src !== playableUrl) {
      audio.src = playableUrl;
    }

    try {
      audio.load();
    } catch {
      /* ignore */
    }

    // Give the browser a moment to begin fetching before play()
    await new Promise((r) => setTimeout(r, 50));
    return true;
  };

  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      stopPlaying();
      return;
    }

    setError(null);
    setIsLoading(true);
    await ensureLoaded();

    try {
      await audio.play();
      setIsPlaying(true);
      onPlayingChange?.(true);
    } catch (err) {
      console.error('Audio play failed:', err);
      stopPlaying();
      setError('Could not play this track on this device. Try Download.');
    } finally {
      setIsLoading(false);
    }
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
    if (isNaN(time) || !Number.isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = musicUrl;
    link.download = filename;
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const accent = '#00E6FF';
  const trackBg = 'rgba(192,192,192,0.2)';

  if (compact) {
    return (
      <div className={`flex items-center gap-2 min-w-0 ${className}`}>
        <audio
          ref={audioRef}
          src={srcReady ? playableUrl : undefined}
          preload="none"
          playsInline
        />
        <button
          type="button"
          onClick={togglePlayPause}
          disabled={isLoading}
          className="w-9 h-9 shrink-0 btn-chrome !rounded-full !p-0 !gap-0 flex items-center justify-center disabled:opacity-50"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <div className="w-3.5 h-3.5 border-2 border-[#050505] border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-3.5 h-3.5 text-[#050505]" strokeWidth={2} />
          ) : (
            <Play className="w-3.5 h-3.5 text-[#050505] ml-0.5" strokeWidth={2} />
          )}
        </button>
        <span className="text-sm text-[#c0c0c0] min-w-0 truncate">{filename}</span>
        {showDownload && (
          <button
            type="button"
            onClick={handleDownload}
            className="shrink-0 text-[#9a9a9a] hover:text-[var(--electric-cyan)] transition-colors p-1"
            title="Download music file"
          >
            <Download className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}
        {error && <span className="text-[10px] text-red-400 truncate max-w-[120px]">{error}</span>}
      </div>
    );
  }

  return (
    <div
      className={`glass-panel border border-[rgba(192,192,192,0.22)] rounded-xl p-3 sm:p-4 w-full max-w-full ${className}`}
    >
      <audio
        ref={audioRef}
        src={srcReady ? playableUrl : undefined}
        preload="none"
        playsInline
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-lg border border-[rgba(0,230,255,0.3)] bg-[rgba(0,230,255,0.08)] flex items-center justify-center">
            <Volume2 className="w-4 h-4 text-[var(--electric-cyan)]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-white truncate text-sm sm:text-base">{filename}</p>
            <p className="text-xs text-[#9a9a9a]">Music File</p>
          </div>
        </div>
        {showDownload && (
          <button
            type="button"
            onClick={handleDownload}
            className="btn-outline-chrome !py-2 !px-3 !text-[10px] w-full sm:w-auto justify-center"
            title="Download music file"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
            Download
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/40 bg-red-900/20 px-3 py-2 text-xs text-red-300">
          {error}{' '}
          <a
            href={musicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-[var(--electric-cyan)]"
          >
            Open file
          </a>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlayPause}
            disabled={isLoading}
            className="w-11 h-11 shrink-0 btn-chrome !rounded-full !p-0 flex items-center justify-center disabled:opacity-50"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-[#050505] border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-4 h-4 text-[#050505]" strokeWidth={2} />
            ) : (
              <Play className="w-4 h-4 text-[#050505] ml-0.5" strokeWidth={2} />
            )}
          </button>

          <div className="flex-1 min-w-0 space-y-1">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${accent} 0%, ${accent} ${progressPct}%, ${trackBg} ${progressPct}%, ${trackBg} 100%)`,
              }}
            />
            <div className="flex justify-between text-xs text-[#9a9a9a]">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-[#9a9a9a] shrink-0" strokeWidth={1.75} />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            className="flex-1 h-1 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, ${accent} 0%, ${accent} ${volume * 100}%, ${trackBg} ${volume * 100}%, ${trackBg} 100%)`,
            }}
          />
          <span className="text-xs text-[#9a9a9a] w-8 text-right">{Math.round(volume * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
