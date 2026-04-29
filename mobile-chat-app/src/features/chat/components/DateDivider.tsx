import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../shared/hooks/useTheme';

interface Props {
  date: string; // ISO date string from message.createdAt
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

export default function DateDivider({ date }: Props) {
  const { isDark } = useTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.line, { backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />
      <View
        style={[
          styles.pill,
          {
            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
            borderColor: isDark ? 'rgba(51, 65, 85, 0.8)' : 'rgba(255, 255, 255, 0.8)',
          },
        ]}
      >
        <Text style={[styles.label, { color: isDark ? '#cbd5e1' : '#64748b' }]}>
          {formatDateLabel(date)}
        </Text>
      </View>
      <View style={[styles.line, { backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    paddingHorizontal: 16,
  },
  line: {
    flex: 1,
    height: 0.5,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    marginHorizontal: 12,
    borderWidth: 1.5,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
