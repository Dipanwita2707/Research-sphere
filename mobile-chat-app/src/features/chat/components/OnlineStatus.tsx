import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useChatStore } from '../../../shared/state/chatStore';

interface Props {
  userId: string;
  size?: number;
}

export default function OnlineStatus({ userId, size = 10 }: Props) {
  const isOnline = useChatStore((s) => s.onlineUsers.has(userId));

  return (
    <View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isOnline ? '#22c55e' : '#64748b',
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {},
});
