/**
 * Voice Message Component
 * WhatsApp-style voice message playback with waveform
 */
'use client';

import React, { useState, useRef, useEffect } from 'react';

interface VoiceMessageProps {
  audioUrl: string;
  duration?: number;
  waveformData?: number[];
  isOwnMessage?: boolean;
}

export function VoiceMessage({ audioUrl, duration, waveformData, isOwnMessage = false }: VoiceMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loadError, setLoadError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Generate placeholder waveform if not provided
  const bars = waveformData?.length 
    ? waveformData 
    : Array.from({ length: 30 }, () => Math.random() * 80 + 20);

  // Handle audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (!duration) {
        setAudioDuration(audio.duration);
      }
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setLoadError(true);
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [duration]);

  // Toggle play/pause
  const togglePlay = async () => {
    if (!audioRef.current || loadError) return;
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Audio playback error:', error);
      setLoadError(true);
    }
  };

  // Seek to position
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !audioRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * audioDuration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Toggle playback speed
  const toggleSpeed = () => {
    const speeds = [1, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  // Colors based on own message
  const buttonBg = isOwnMessage 
    ? 'bg-green-700/30 hover:bg-green-700/50' 
    : 'bg-white/20 hover:bg-white/30';
  const barPlayedColor = isOwnMessage ? 'bg-green-800' : 'bg-white';
  const barUnplayedColor = isOwnMessage ? 'bg-green-600/40' : 'bg-white/40';

  if (loadError) {
    return (
      <div className="flex items-center gap-2 min-w-[200px] text-sm opacity-70">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Audio unavailable</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-[200px]">
      {/* Hidden audio element */}
      <audio 
        ref={audioRef} 
        src={audioUrl} 
        preload="metadata"
        crossOrigin="anonymous"
      />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        disabled={isLoading}
        className={`w-10 h-10 flex-shrink-0 ${buttonBg} rounded-full flex items-center justify-center transition-colors disabled:opacity-50`}
      >
        {isLoading ? (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : isPlaying ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Waveform & Progress */}
      <div className="flex-1 flex flex-col gap-1">
        <div
          ref={progressRef}
          onClick={handleSeek}
          className="h-6 flex items-end gap-px cursor-pointer"
        >
          {bars.map((height, index) => {
            const barProgress = (index / bars.length) * 100;
            const isPlayed = barProgress <= progress;
            
            return (
              <div
                key={index}
                className={`w-1 rounded-full transition-all ${
                  isPlayed ? barPlayedColor : barUnplayedColor
                }`}
                style={{ height: `${Math.max(4, height * 0.25)}px` }}
              />
            );
          })}
        </div>

        {/* Time & Speed */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] opacity-70">
            {formatTime(isPlaying || currentTime > 0 ? currentTime : audioDuration)}
          </span>
          <button
            onClick={toggleSpeed}
            className="text-[10px] opacity-70 hover:opacity-100 transition-opacity px-1"
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
}
