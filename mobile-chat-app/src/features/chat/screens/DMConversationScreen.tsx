import React, { useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Text,
  Alert,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useChatStore } from '../../../shared/state/chatStore';
import { useChatAuthStore } from '../../../shared/state/chatAuthStore';
import { useTheme } from '../../../shared/hooks/useTheme';
import { useSocket } from '../../../shared/socket/useSocket';
import {
  getDirectMessages,
  sendDirectMessage as sendDM,
  editDirectMessage,
  deleteDirectMessage,
  markDirectMessagesAsRead,
  uploadDirectFile,
  uploadDirectVoice,
} from '../../../shared/services/chat.service';
import MessageBubble from '../components/MessageBubble';
import MessageInput from '../components/MessageInput';
import TypingIndicator from '../components/TypingIndicator';
import OnlineStatus from '../components/OnlineStatus';
import DateDivider from '../components/DateDivider';
import { buildChatData } from '../../../shared/utils/chatUtils';
import type { ChatListItem } from '../../../shared/utils/chatUtils';
import type { ChatsStackParamList, DirectMessage } from '../../../types/chat.types';

type RouteParams = RouteProp<ChatsStackParamList, 'DMConversation'>;

export default function DMConversationScreen() {
  const route = useRoute<RouteParams>();
  const { userId, userName } = route.params;
  const { colors } = useTheme();
  const messages = useChatStore((s) => s.directMessagesByUser[userId] || []);
  const hasMore = useChatStore((s) => s.hasMoreDMs[userId] ?? true);
  const cursor = useChatStore((s) => s.dmCursors[userId]);
  const setDirectMessages = useChatStore((s) => s.setDirectMessages);
  const prependDirectMessages = useChatStore((s) => s.prependDirectMessages);
  const replyingTo = useChatStore((s) => s.replyingTo);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const myId = useChatAuthStore((s) => s.chatUser?.id);

  const { emitSendDM, emitTypingDM, emitStopTypingDM, emitMarkDMAsRead } = useSocket();

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editingMsg, setEditingMsg] = useState<DirectMessage | null>(null);

  const listData = useMemo(
    () => buildChatData<DirectMessage>(messages),
    [messages],
  );

  useEffect(() => {
    loadMessages();
    return () => {
      setReplyingTo(null);
    };
  }, [userId]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const data = await getDirectMessages(userId, { limit: 50 });
      setDirectMessages(userId, data.messages, data.hasMore, data.nextCursor);
      emitMarkDMAsRead(userId);
    } catch (e) {
      console.warn('Failed to load DMs:', e);
    }
    setLoading(false);
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await getDirectMessages(userId, { cursor, limit: 50 });
      prependDirectMessages(userId, data.messages, data.hasMore, data.nextCursor);
    } catch (e) {
      console.warn('Failed to load more DMs:', e);
    }
    setLoadingMore(false);
  };

  const handleSendText = useCallback(async (text: string) => {
    if (editingMsg) {
      try {
        await editDirectMessage(editingMsg.id, text);
      } catch {
        Alert.alert('Error', 'Failed to edit message');
      }
      setEditingMsg(null);
      return;
    }

    emitSendDM({
      receiverId: userId,
      content: text,
      messageType: 'text',
      replyToId: (replyingTo as DirectMessage)?.id,
    });
    setReplyingTo(null);
  }, [userId, editingMsg, replyingTo]);

  const handleSendFile = useCallback(async (uri: string, name: string, type: string) => {
    try {
      const result = await uploadDirectFile(userId, uri, name, type);
      emitSendDM({
        receiverId: userId,
        messageType: type.startsWith('image/') ? 'image' : 'file',
        filePath: result.filePath,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
      });
    } catch {
      Alert.alert('Error', 'Failed to upload file');
    }
  }, [userId]);

  const handleSendVoice = useCallback(async (uri: string, duration: number) => {
    try {
      const result = await uploadDirectVoice(userId, uri);
      emitSendDM({
        receiverId: userId,
        messageType: 'voice',
        filePath: result.filePath,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
        duration,
      });
    } catch {
      Alert.alert('Error', 'Failed to upload voice message');
    }
  }, [userId]);

  const handleDelete = useCallback(async (messageId: string) => {
    Alert.alert('Delete Message', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDirectMessage(messageId);
          } catch {
            Alert.alert('Error', 'Failed to delete message');
          }
        },
      },
    ]);
  }, []);

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList<ChatListItem<DirectMessage>>
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
            />
          );
        }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingMore ? <ActivityIndicator color="#6366f1" style={{ padding: 16 }} /> : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Start the conversation!</Text>
          </View>
        }
        contentContainerStyle={messages.length === 0 ? { flex: 1, justifyContent: 'center' } : undefined}
      />

      <TypingIndicator dmUserId={userId} />

      <MessageInput
        onSendText={handleSendText}
        onSendFile={handleSendFile}
        onSendVoice={handleSendVoice}
        replyingTo={replyingTo}
        editingText={editingMsg ? editingMsg.content : null}
        onCancelReply={() => { setReplyingTo(null); setEditingMsg(null); }}
        onTypingStart={() => emitTypingDM(userId)}
        onTypingStop={() => emitStopTypingDM(userId)}
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
  empty: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 15,
  },
});
