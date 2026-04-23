import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';

interface Props {
  onVoiceReady: (uri: string, duration: number) => void;
  onCancel: () => void;
}

export default function VoiceRecorder({ onVoiceReady, onCancel }: Props) {
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  const startRecording = async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) return;

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.3, duration: 500, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      ).start();
    } catch (e) {
      console.warn('Failed to start recording:', e);
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    if (timerRef.current) clearInterval(timerRef.current);
    pulse.stopAnimation();

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      setIsRecording(false);

      if (uri && duration > 0) {
        onVoiceReady(uri, duration);
      }
    } catch (e) {
      console.warn('Failed to stop recording:', e);
    }
  };

  const cancelRecording = async () => {
    if (!isRecording) return;
    if (timerRef.current) clearInterval(timerRef.current);
    pulse.stopAnimation();

    try {
      await audioRecorder.stop();
    } catch { /* ignore */ }

    setIsRecording(false);
    setDuration(0);
    onCancel();
  };

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (isRecording) {
    return (
      <View style={styles.recording}>
        <TouchableOpacity onPress={cancelRecording} style={styles.cancelBtn}>
          <Ionicons name="close" size={22} color="#f87171" />
        </TouchableOpacity>

        <Animated.View style={[styles.redDot, { transform: [{ scale: pulse }] }]} />
        <Text style={styles.timer}>{formatDuration(duration)}</Text>

        <TouchableOpacity onPress={stopRecording} style={styles.sendBtn}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={startRecording} style={styles.micBtn}>
      <Ionicons name="mic" size={22} color="#94a3b8" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  micBtn: {
    padding: 8,
  },
  recording: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
  },
  cancelBtn: {
    padding: 4,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
  },
  timer: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  sendBtn: {
    backgroundColor: '#6366f1',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
