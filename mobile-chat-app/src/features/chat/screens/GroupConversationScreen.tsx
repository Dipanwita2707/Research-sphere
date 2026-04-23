import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore } from '../../../shared/state/chatStore';
import { useChatAuthStore } from '../../../shared/state/chatAuthStore';
import { useTheme } from '../../../shared/hooks/useTheme';
import { useSocket } from '../../../shared/socket/useSocket';
import {
  getGroupMessages,
  editMessage,
  deleteMessage,
  togglePinMessage,
  getPinnedMessages,
  markMessagesAsRead,
  uploadGroupFile,
  uploadGroupVoice,
} from '../../../shared/services/chat.service';
import MessageBubble from '../components/MessageBubble';
import MessageInput from '../components/MessageInput';
import TypingIndicator from '../components/TypingIndicator';
import DateDivider from '../components/DateDivider';
import { buildChatData } from '../../../shared/utils/chatUtils';
import type { ChatListItem } from '../../../shared/utils/chatUtils';
import type { ChatsStackParamList, ChatMessage } from '../../../types/chat.types';

type RouteParams = RouteProp<ChatsStackParamList, 'GroupConversation'>;
type Nav = NativeStackNavigationProp<ChatsStackParamList, 'GroupConversation'>;

export default function GroupConversationScreen() {
  const route = useRoute<RouteParams>();
  const nav = useNavigation<Nav>();
  const { groupId, groupName } = route.params;
  const { colors } = useTheme();
  const messages = useChatStore((s) => s.messagesByGroup[groupId] || []);
  const hasMore = useChatStore((s) => s.hasMoreMessages[groupId] ?? true);
  const cursor = useChatStore((s) => s.messageCursors[groupId]);
  const setMessages = useChatStore((s) => s.setMessages);
  const prependMessages = useChatStore((s) => s.prependMessages);
  const replyingTo = useChatStore((s) => s.replyingTo);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const myId = useChatAuthStore((s) => s.chatUser?.id);

  const { emitSendMessage, emitTyping, emitStopTyping, emitJoinGroup, emitLeaveGroup, emitMarkAsRead } = useSocket();

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<ChatMessage[]>([]);

  const listData = useMemo(
    () => buildChatData<ChatMessage>(messages),
    [messages],
  );

  useEffect(() => {
    emitJoinGroup(groupId);
    loadMessages();
    loadPinned();
    return () => {
      emitLeaveGroup(groupId);
      setReplyingTo(null);
    };
  }, [groupId]);

  const loadPinned = async () => {
    try {
      const data = await getPinnedMessages(groupId);
      setPinnedMessages(data || []);
    } catch (e) {
      // silently ignore
    }
  };

  const loadMessages = async () => {
    setLoading(true);
    try {
      const data = await getGroupMessages(groupId, { limit: 50 });
      setMessages(groupId, data.messages, data.hasMore, data.nextCursor);
      emitMarkAsRead(groupId);
    } catch (e) {
      console.warn('Failed to load messages:', e);
    }
    setLoading(false);
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await getGroupMessages(groupId, { cursor, limit: 50 });
      prependMessages(groupId, data.messages, data.hasMore, data.nextCursor);
    } catch (e) {
      console.warn('Failed to load more:', e);
    }
    setLoadingMore(false);
  };

  const handleSendText = useCallback(async (text: string) => {
    if (editingMsg) {
      try {
        await editMessage(editingMsg.id, text);
      } catch (e) {
        Alert.alert('Error', 'Failed to edit message');
      }
      setEditingMsg(null);
      return;
    }

    emitSendMessage({
      groupId,
      content: text,
      messageType: 'text',
      replyToId: (replyingTo as ChatMessage)?.id,
    });
    setReplyingTo(null);
  }, [groupId, editingMsg, replyingTo]);

  const handleSendFile = useCallback(async (uri: string, name: string, type: string) => {
    try {
      const result = await uploadGroupFile(groupId, uri, name, type);
      emitSendMessage({
        groupId,
        messageType: type.startsWith('image/') ? 'image' : 'file',
        filePath: result.filePath,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to upload file');
    }
  }, [groupId]);

  const handleSendVoice = useCallback(async (uri: string, duration: number) => {
    try {
      const result = await uploadGroupVoice(groupId, uri);
      emitSendMessage({
        groupId,
        messageType: 'voice',
        filePath: result.filePath,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
        duration,
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to upload voice message');
    }
  }, [groupId]);

  const handleDelete = useCallback(async (messageId: string) => {
    Alert.alert('Delete Message', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMessage(messageId);
          } catch (e) {
            Alert.alert('Error', 'Failed to delete message');
          }
        },
      },
    ]);
  }, []);

  const handlePin = useCallback(async (messageId: string) => {
    try {
      await togglePinMessage(messageId);
      loadPinned();
    } catch (e) {
      Alert.alert('Error', 'Failed to pin message');
    }
  }, [groupId]);

  const handleReact = useCallback((messageId: string, emoji: string) => {
    // Reactions are local-state only (web also does local-state)
    // Socket emit can be added here if backend supports it in future
  }, []);

  React.useLayoutEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => nav.navigate('MessageSearch', { groupId, groupName })}
            style={{ padding: 8 }}
          >
            <Ionicons name="search-outline" size={22} color="#f1f5f9" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => nav.navigate('GroupInfo', { groupId })}
            style={{ padding: 8 }}
          >
            <Ionicons name="information-circle-outline" size={24} color="#f1f5f9" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [nav, groupId, groupName]);

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Pinned messages banner */}
      {pinnedMessages.length > 0 && (
        <TouchableOpacity
          style={[styles.pinnedBanner, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
          onPress={() => nav.navigate('MessageSearch', { groupId, groupName })}
          activeOpacity={0.8}
        >
          <Ionicons name="pin" size={14} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.pinnedBannerText, { color: colors.primary }]} numberOfLines={1}>
            {pinnedMessages.length === 1
              ? pinnedMessages[0].content || `[${pinnedMessages[0].messageType}]`
              : `${pinnedMessages.length} pinned messages`}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      )}

      <FlatList<ChatListItem<ChatMessage>>
        data={listData}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          if (item.type === 'divider') {
            return <DateDivider date={item.date} />;
          }
          return (
            <MessageBubble
              message={item.message}
              isMine={item.message.senderId === myId}
              onReply={() => setReplyingTo(item.message)}
              onEdit={() => setEditingMsg(item.message)}
              onDelete={() => handleDelete(item.message.id)}
              onPin={() => handlePin(item.message.id)}
              onReact={(emoji) => handleReact(item.message.id, emoji)}
            />
          );
        }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingMore ? <ActivityIndicator color="#6366f1" style={{ padding: 16 }} /> : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No messages yet. Say something!</Text>
          </View>
        }
        contentContainerStyle={messages.length === 0 ? { flex: 1, justifyContent: 'center' } : undefined}
      />

      <TypingIndicator groupId={groupId} />

      <MessageInput
        onSendText={handleSendText}
        onSendFile={handleSendFile}
        onSendVoice={handleSendVoice}
        replyingTo={replyingTo}
        onCancelReply={() => {
          setReplyingTo(null);
          setEditingMsg(null);
        }}
        onTypingStart={() => emitTyping(groupId)}
        onTypingStop={() => emitStopTyping(groupId)}
        editingText={editingMsg ? editingMsg.content : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pinnedBannerText: {
    fontSize: 13,
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 15,
  },
});
