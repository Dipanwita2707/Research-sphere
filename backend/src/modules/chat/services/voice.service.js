/**
 * Voice Message Service
 * Handles voice note processing with waveform generation
 */
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const fileService = require('./file.service');

// Configuration
const MAX_VOICE_DURATION = 5 * 60; // 5 minutes in seconds
const MAX_VOICE_SIZE = 10 * 1024 * 1024; // 10MB
const WAVEFORM_SAMPLES = 50; // Number of waveform data points

/**
 * Validate voice message
 */
const validateVoiceMessage = (buffer, mimeType) => {
  const allowedTypes = ['audio/webm', 'audio/ogg', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm;codecs=opus'];
  
  // Check mime type (allow codecs suffix)
  const baseMimeType = mimeType.split(';')[0];
  if (!allowedTypes.includes(baseMimeType) && !allowedTypes.includes(mimeType)) {
    throw new Error(`Audio type not allowed: ${mimeType}`);
  }

  if (buffer.length > MAX_VOICE_SIZE) {
    throw new Error(`Voice message too large. Maximum size is ${MAX_VOICE_SIZE / 1024 / 1024}MB`);
  }

  return true;
};

/**
 * Generate simplified waveform data from audio buffer
 * This is a simplified version that creates mock waveform data
 * For production, you'd use ffmpeg or a proper audio processing library
 */
const generateWaveform = (buffer, samples = WAVEFORM_SAMPLES) => {
  // Simple algorithm: sample the buffer at regular intervals
  // and normalize to 0-1 range. This creates a visual representation
  // that looks like a waveform but isn't acoustically accurate.
  
  const waveform = [];
  const chunkSize = Math.floor(buffer.length / samples);
  
  for (let i = 0; i < samples; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, buffer.length);
    
    // Calculate average amplitude in this chunk
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += Math.abs(buffer[j] - 128); // Assuming 8-bit audio centered at 128
    }
    
    const avg = sum / (end - start);
    // Normalize to 0-1 range with some randomization for visual interest
    const normalized = Math.min(1, (avg / 128) + (Math.random() * 0.3));
    waveform.push(parseFloat(normalized.toFixed(2)));
  }
  
  // Ensure there's some variation for visual appeal
  return waveform.map((v, i) => {
    const variation = Math.sin(i * 0.5) * 0.2 + 0.5;
    return parseFloat(Math.min(1, Math.max(0.1, v * variation + 0.2)).toFixed(2));
  });
};

/**
 * Estimate audio duration from file size and mime type
 * This is an approximation - for accurate duration, use ffprobe
 */
const estimateDuration = (buffer, mimeType) => {
  const sizeInBytes = buffer.length;
  
  // Approximate bitrates for different formats (in bytes per second)
  const bitrates = {
    'audio/webm': 16000, // ~128kbps
    'audio/ogg': 16000,
    'audio/mp3': 16000,
    'audio/mpeg': 16000,
    'audio/wav': 176400, // 44.1kHz 16-bit stereo
    'audio/mp4': 16000,
  };
  
  const baseMimeType = mimeType.split(';')[0];
  const bytesPerSecond = bitrates[baseMimeType] || 16000;
  
  const estimatedSeconds = Math.round(sizeInBytes / bytesPerSecond);
  return Math.min(estimatedSeconds, MAX_VOICE_DURATION);
};

/**
 * Process and save voice message
 */
const processVoiceMessage = async (buffer, mimeType, contextType, contextId, userId) => {
  // Validate
  validateVoiceMessage(buffer, mimeType);

  // Generate waveform data
  const waveformData = generateWaveform(buffer);

  // Estimate duration
  const duration = estimateDuration(buffer, mimeType);

  // Check duration limit
  if (duration > MAX_VOICE_DURATION) {
    throw new Error(`Voice message too long. Maximum duration is ${MAX_VOICE_DURATION / 60} minutes`);
  }

  // Determine file extension
  const extensions = {
    'audio/webm': '.webm',
    'audio/ogg': '.ogg',
    'audio/mp3': '.mp3',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/mp4': '.m4a',
  };
  const baseMimeType = mimeType.split(';')[0];
  const ext = extensions[baseMimeType] || '.webm';
  const fileName = `voice-${Date.now()}${ext}`;

  // Save file
  const savedFile = await fileService.saveFile(
    buffer,
    fileName,
    mimeType,
    contextType,
    contextId,
    userId
  );

  return {
    ...savedFile,
    duration,
    waveformData,
    messageType: 'voice',
  };
};

/**
 * Process voice message for group chat
 */
const processGroupVoiceMessage = async (buffer, mimeType, groupId, userId) => {
  return processVoiceMessage(buffer, mimeType, 'groups', groupId, userId);
};

/**
 * Process voice message for direct message
 */
const processDirectVoiceMessage = async (buffer, mimeType, senderId, receiverId) => {
  const conversationId = [senderId, receiverId].sort().join('-');
  return processVoiceMessage(buffer, mimeType, 'direct', conversationId, senderId);
};

module.exports = {
  MAX_VOICE_DURATION,
  MAX_VOICE_SIZE,
  WAVEFORM_SAMPLES,
  validateVoiceMessage,
  generateWaveform,
  estimateDuration,
  processVoiceMessage,
  processGroupVoiceMessage,
  processDirectVoiceMessage,
};
