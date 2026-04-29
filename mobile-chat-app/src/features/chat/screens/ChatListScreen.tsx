import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useChatStore } from '../../../shared/state/chatStore';
import { useChatAuthStore } from '../../../shared/state/chatAuthStore';
import { useSocket } from '../../../shared/socket/useSocket';
import { useTheme } from '../../../shared/hooks/useTheme';
import { getMyGroups, getConversations } from '../../../shared/services/chat.service';
import ChatListItem from '../components/ChatListItem';
import type { ChatsStackParamList, ChatGroup, Conversation } from '../../../types/chat.types';

type Nav = NativeStackNavigationProp<ChatsStackParamList, 'ChatList'>;

type UnifiedItem = { type: 'group'; data: ChatGroup; sortKey: number } | { type: 'dm'; data: Conversation; sortKey: number };

export default function ChatListScreen() {
  const nav = useNavigation<Nav>();
  const { colors, isDark } = useTheme();
  const groups = useChatStore((s) => s.groups);
  const conversations = useChatStore((s) => s.conversations);
  const setGroups = useChatStore((s) => s.setGroups);
  const setConversations = useChatStore((s) => s.setConversations);
  const [refreshing, setRefreshing] = useState(false);

  // Mount socket
  useSocket();

  const loadData = useCallback(async () => {
    try {
      const [g, c] = await Promise.all([getMyGroups(), getConversations()]);
      setGroups(g);
      setConversations(c);
    } catch (e) {
      console.warn('Failed to load chats:', e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Merge groups + conversations into a unified list sorted by last activity
  const unified: UnifiedItem[] = [
    ...groups.map((g) => ({
      type: 'group' as const,
      data: g,
      sortKey: g.lastMessageAt ? new Date(g.lastMessageAt).getTime() : new Date(g.createdAt).getTime(),
    })),
    ...conversations.map((c) => ({
      type: 'dm' as const,
      data: c,
      sortKey: c.lastMessage?.createdAt ? new Date(c.lastMessage.createdAt).getTime() : 0,
    })),
  ].sort((a, b) => b.sortKey - a.sortKey);

  const renderItem = ({ item }: { item: UnifiedItem }) => {
    if (item.type === 'group') {
      return (
        <ChatListItem
          type="group"
          item={item.data}
          onPress={() => nav.navigate('GroupConversation', { groupId: item.data.id, groupName: item.data.name })}
        />
      );
    }
    return (
      <ChatListItem
        type="dm"
        item={item.data}
        onPress={() =>
          nav.navigate('DMConversation', {
            userId: item.data.user.id,
            userName: `${item.data.user.firstName} ${item.data.user.lastName}`,
          })
        }
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={unified}
        renderItem={renderItem}
        keyExtractor={(item) => (item.type === 'group' ? `g-${item.data.id}` : `dm-${(item.data as Conversation).user.id}`)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No conversations yet</Text>
          </View>
        }
      />

      {/* FABs */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => nav.navigate('NewChat')}>
          <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fab, styles.fabSecondary, { backgroundColor: colors.primary }]} onPress={() => nav.navigate('NewGroup')}>
          <Ionicons name="people-circle" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 120,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
  },
  fabContainer: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    gap: 12,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
});
