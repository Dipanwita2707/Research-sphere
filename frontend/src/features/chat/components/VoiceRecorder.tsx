/**
 * Voice Recorder Component
 * WhatsApp-style voice message recording
 */
'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob) => void;
  onCancel: () => void;
  isUploading: boolean;
}

export function VoiceRecorder({ onSend, onCancel, isUploading }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout>();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>();
  const isRecordingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      stopMediaStream();
    };
  }, [audioUrl]);

  const stopMediaStream = () => {
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup audio context for visualization
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyserRef.current = analyser;

      // Setup media recorder with fallback mime types
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/ogg;codecs=opus';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = ''; // Let browser choose default
          }
        }
      }

      const mediaRecorder = mimeType 
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        audioContext.close();
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      isRecordingRef.current = true;
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      // Start waveform visualization
      updateWaveform();

    } catch (error) {
      console.error('Failed to start recording:', error);
      const errorMessage = error instanceof DOMException 
        ? error.name ===
   'NotAllowedError' 
          ? 'Microphone access denied. Please allow microphone access in your browser settings.'
          : error.name ===
   'NotFoundError'
          ? 'No microphone found. Please connect a microphone and try again.'
          : 'Could not access microphone. Please check your browser settings.'
        : 'Failed to start recording. Please try again.';
      alert(errorMessage);
      onCancel();
    }
  };

  // Update waveform visualization
  const updateWaveform = () => {
    if (!analyserRef.current || !isRecordingRef.current) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Get average for a single bar
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const normalized = Math.round((average / 255) * 100);

    setWaveformData((prev) => {
      const newData = [...prev, normalized];
      // Keep last 50 samples for visualization
      return newData.slice(-50);
    });

    animationRef.current = requestAnimationFrame(updateWaveform);
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      isRecordingRef.current = false;
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      stopMediaStream();
    }
  };

  // Pause/Resume recording
  const togglePause = () => {
    if (mediaRecorderRef.current) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setDuration((prev) => prev + 1);
        }, 1000);
        updateWaveform();
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) clearInterval(timerRef.current);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
      }
      setIsPaused(!isPaused);
    }
  };

  // Cancel recording
  const handleCancel = () => {
    stopRecording();
    setAudioBlob(null);
    setAudioUrl(null);
    setWaveformData([]);
    setDuration(0);
    onCancel();
  };

  // Send recording
  const handleSend = () => {
    if (audioBlob) {
      onSend(audioBlob);
    }
  };

  // Delete and re-record
  const handleDelete = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setWaveformData([]);
    setDuration(0);
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3">
      {/* Cancel Button */}
      <button
        onClick={handleCancel}
        disabled={isUploading}
        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors disabled:opacity-50"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>

      {/* Waveform / Recording Indicator */}
      <div className="flex-1 h-12 bg-gray-100 dark:bg-gray-700 rounded-full px-4 flex items-center gap-2">
        {/* Recording indicator */}
        {isRecording && !isPaused && (
          <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        )}

        {/* Waveform visualization */}
        <div className="flex-1 flex items-center justify-center gap-0.5 h-8">
          {(isRecording || audioBlob) && waveformData.length > 0 ? (
            waveformData.map((value, index) => (
              <div
                key={index}
                className="w-1 bg-blue-500 rounded-full transition-all duration-75"
                style={{ height: `${Math.max(4, value * 0.3)}px` }}
              />
            ))
          ) : (
            <span className="text-gray-500 dark:text-gray-400 text-sm">
              {audioBlob ? 'Ready to send' : 'Tap to record'}
            </span>
          )}
        </div>

        {/* Duration */}
        <span className="text-sm font-mono text-gray-600 dark:text-gray-300 min-w-[40px]">
          {formatDuration(duration)}
        </span>
      </div>

      {/* Action buttons */}
      {!isRecording && !audioBlob ? (
        // Start Recording
        <button
          onClick={startRecording}
          disabled={isUploading}
          className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors disabled:opacity-50"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93h2c0 3.31 2.69 6 6 6s6-2.69 6-6h2c0 4.08-3.06 7.44-7 7.93V19h-2v-3.07z" />
          </svg>
        </button>
      ) : isRecording ? (
        // Recording controls
        <div className="flex items-center gap-2">
          <button
            onClick={togglePause}
            className="p-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-full transition-colors"
          >
            {isPaused ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            )}
          </button>
          <button
            onClick={stopRecording}
            className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z" />
            </svg>
          </button>
        </div>
      ) : audioBlob ? (
        // Preview controls
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            disabled={isUploading}
            className="p-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-full transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            onClick={handleSend}
            disabled={isUploading}
            className="p-3 bg-green-600 hover:bg-green-700 text-white rounded-full transition-colors disabled:opacity-50"
          >
            {isUploading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}
