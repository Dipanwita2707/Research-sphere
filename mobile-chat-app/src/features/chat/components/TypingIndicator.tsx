import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useChatStore } from '../../../shared/state/chatStore';

interface Props {
  groupId?: string;
  dmUserId?: string;
}

export default function TypingIndicator({ groupId, dmUserId }: Props) {
  const typingUsers = useChatStore((s) =>
    groupId ? s.typingByGroup[groupId] || [] : [],
  );
  const dmTyping = useChatStore((s) =>
    dmUserId ? s.typingDM[dmUserId] : null,
  );

  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  const isTyping = groupId ? typingUsers.length > 0 : !!dmTyping;

  useEffect(() => {
    if (!isTyping) return;

    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      );

    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 150);
    const a3 = animate(dot3, 300);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [isTyping]);

  if (!isTyping) return null;

  const label = groupId
    ? typingUsers.length === 1
      ? `${typingUsers[0].userName} is typing`
      : `${typingUsers.length} people are typing`
    : `${dmTyping!.userName} is typing`;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{label}</Text>
      <View style={styles.dots}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              { opacity: dot, transform: [{ scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  text: {
    color: '#94a3b8',
    fontSize: 12,
    fontStyle: 'italic',
    marginRight: 6,
  },
  dots: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#94a3b8',
  },
});
