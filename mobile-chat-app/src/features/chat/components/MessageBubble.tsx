import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Linking,
  Clipboard,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { getChatFileUrl, getProfileImageUrl } from '../../../shared/services/chat.service';
import { useTheme } from '../../../shared/hooks/useTheme';
import type { ChatMessage, DirectMessage } from '../../../types/chat.types';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface Props {
  message: ChatMessage | DirectMessage;
  isMine: boolean;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPin?: () => void;
  onReact?: (emoji: string) => void;
}

export default function MessageBubble({ message, isMine, onReply, onEdit, onDelete, onPin, onReact }: Props) {
  const { colors, isDark } = useTheme();
  const [playing, setPlaying] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  // ── derived theme colors ────────────────────────────────────────────────
  const mineBg       = isDark ? '#4f46e5' : '#6366f1';
  const theirsBg     = isDark ? '#334155' : '#e2e8f0';
  const mineText     = '#ffffff';
  const theirsText   = isDark ? '#f1f5f9' : '#1e293b';
  const mineSubText  = 'rgba(255,255,255,0.6)';
  const theirsSubText = isDark ? '#94a3b8' : '#64748b';
  const replyBg      = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.08)';
  const reactionBg   = isDark ? '#1e293b' : '#ffffff';
  const reactionBorder = isDark ? '#475569' : '#cbd5e1';

  const voiceUri = message.messageType === 'voice' && message.filePath
    ? getChatFileUrl(message.filePath)
    : null;
  const player = useAudioPlayer(voiceUri ? { uri: voiceUri } : null);
  const playerStatus = useAudioPlayerStatus(player);

  React.useEffect(() => {
    if (playerStatus.didJustFinish) setPlaying(false);
  }, [playerStatus.didJustFinish]);

  const playVoice = useCallback(() => {
    if (!voiceUri) return;
    try {
      if (playing) { player.pause(); setPlaying(false); }
      else { player.play(); setPlaying(true); }
    } catch (e) { console.warn('Voice playback error:', e); }
  }, [voiceUri, playing, player]);

  const handleLongPress = () => {
    const options: { text: string; onPress: () => void; style?: 'destructive' | 'cancel' }[] = [];

    options.push({ text: '😊 React', onPress: () => setShowReactions(true) });
    if (onReply) options.push({ text: '↩️ Reply', onPress: onReply });
    if (message.content) {
      options.push({ text: '📋 Copy', onPress: () => Clipboard.setString(message.content!) });
    }
    if (isMine && onEdit && message.messageType === 'text') {
      options.push({ text: '✏️ Edit', onPress: onEdit });
    }
    if (onPin && 'isPinned' in message) {
      options.push({ text: (message as ChatMessage).isPinned ? '📌 Unpin' : '📌 Pin', onPress: onPin });
    }
    if (onDelete) options.push({ text: '🗑️ Delete', onPress: onDelete, style: 'destructive' });
    options.push({ text: 'Cancel', onPress: () => {}, style: 'cancel' });

    Alert.alert('Message', undefined, options);
  };

  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const readCount = 'readBy' in message ? (message.readBy?.length || 0) : 0;
  const isRead = 'readAt' in message ? !!message.readAt : readCount > 0;
  const replyTo = message.replyTo;
  const reactions = (message as any).reactions as Record<string, string[]> | undefined;

  return (
    <>
      {/* Reaction picker modal */}
      <Modal transparent visible={showReactions} animationType="fade" onRequestClose={() => setShowReactions(false)}>
        <Pressable style={styles.reactionOverlay} onPress={() => setShowReactions(false)}>
          <View style={[styles.reactionPicker, { backgroundColor: reactionBg, borderColor: reactionBorder }]}>
            {QUICK_REACTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionBtn}
                onPress={() => { onReact?.(emoji); setShowReactions(false); }}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      <TouchableOpacity
        style={[
          styles.container,
          isMine ? styles.mine : styles.theirs,
          { backgroundColor: isMine ? mineBg : theirsBg },
          !isMine && !isDark && styles.theirsBorderLight,
        ]}
        onLongPress={handleLongPress}
        activeOpacity={0.8}
      >
        {/* Sender name (group messages only) */}
        {!isMine && 'sender' in message && message.sender && (
          <Text style={[styles.senderName, { color: colors.primary }]}>
            {message.sender.firstName} {message.sender.lastName}
          </Text>
        )}

        {/* Reply preview */}
        {replyTo && (
          <View style={[styles.replyBar, { backgroundColor: replyBg, borderLeftColor: colors.primary }]}>
            <Text style={[styles.replyText, { color: isMine ? mineSubText : theirsSubText }]} numberOfLines={1}>
              {replyTo.content || '[media]'}
            </Text>
          </View>
        )}

        {/* Image */}
        {message.messageType === 'image' && message.filePath && (
          <Image source={{ uri: getChatFileUrl(message.filePath) }} style={styles.image} resizeMode="cover" />
        )}

        {/* File */}
        {message.messageType === 'file' && (
          <TouchableOpacity
            style={[styles.fileRow, { backgroundColor: isMine ? 'rgba(255,255,255,0.12)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)') }]}
            onPress={() => { if (message.filePath) Linking.openURL(getChatFileUrl(message.filePath)); }}
          >
            <Ionicons name="document" size={20} color={isMine ? mineSubText : theirsSubText} />
            <Text style={[styles.fileName, { color: isMine ? mineText : theirsText }]} numberOfLines={1}>
              {message.fileName || 'File'}
            </Text>
            <Ionicons name="download-outline" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* Voice */}
        {message.messageType === 'voice' && (
          <TouchableOpacity style={styles.voiceRow} onPress={playVoice}>
            <Ionicons name={playing ? 'pause-circle' : 'play-circle'} size={28} color={isMine ? mineText : colors.primary} />
            <View style={[styles.voiceBar, { backgroundColor: isMine ? 'rgba(255,255,255,0.3)' : (isDark ? '#334155' : '#cbd5e1') }]}>
              <View style={[styles.voiceBarFill, { backgroundColor: isMine ? 'rgba(255,255,255,0.8)' : colors.primary, width: playing ? '60%' : '35%' }]} />
            </View>
            <Text style={[styles.voiceDuration, { color: isMine ? mineSubText : theirsSubText }]}>
              {message.duration ? `${Math.floor(message.duration / 60)}:${String(message.duration % 60).padStart(2, '0')}` : '0:00'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Text content */}
        {message.content && (
          <Text style={[styles.text, { color: isMine ? mineText : theirsText }]}>
            {message.content}
          </Text>
        )}

        {/* Reactions */}
        {reactions && Object.keys(reactions).length > 0 && (
          <View style={styles.reactionsRow}>
            {Object.entries(reactions).map(([emoji, users]) => (
              <TouchableOpacity
                key={emoji}
                style={[styles.reactionChip, { backgroundColor: isMine ? 'rgba(255,255,255,0.15)' : (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)'), borderColor: isMine ? 'rgba(255,255,255,0.3)' : colors.primary }]}
                onPress={() => onReact?.(emoji)}
              >
                <Text style={styles.reactionChipEmoji}>{emoji}</Text>
                <Text style={[styles.reactionChipCount, { color: isMine ? mineSubText : colors.primary }]}>{(users as string[]).length}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Footer: time + edited + ticks */}
        <View style={styles.footer}>
          {(message as any).isEdited && (
            <Text style={[styles.edited, { color: isMine ? mineSubText : theirsSubText }]}>edited</Text>
          )}
          <Text style={[styles.time, { color: isMine ? mineSubText : theirsSubText }]}>{time}</Text>
          {isMine && (
            <Ionicons
              name={isRead ? 'checkmark-done' : 'checkmark'}
              size={14}
              color={isRead ? (isDark ? '#a5b4fc' : '#818cf8') : mineSubText}
              style={{ marginLeft: 3 }}
            />
          )}
        </View>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: '82%',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 18,
    marginVertical: 1,
    marginHorizontal: 12,
  },
  mine: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 3,
  },
  theirs: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 3,
  },
  theirsBorderLight: {
    borderWidth: 0.5,
    borderColor: '#cbd5e1',
  },
  senderName: {
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 3,
  },
  replyBar: {
    borderLeftWidth: 3,
    borderRadius: 3,
    paddingLeft: 9,
    marginBottom: 6,
    paddingVertical: 5,
  },
  replyText: {
    fontSize: 12.5,
  },
  text: {
    fontSize: 15.5,
    lineHeight: 22,
  },
  image: {
    width: 220,
    height: 160,
    borderRadius: 10,
    marginBottom: 4,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 8,
    marginBottom: 2,
  },
  fileName: {
    fontSize: 13.5,
    flex: 1,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
    minWidth: 160,
  },
  voiceBar: {
    flex: 1,
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  voiceBarFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  voiceDuration: {
    fontSize: 12,
    minWidth: 35,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
    gap: 3,
  },
  edited: {
    fontSize: 9.5,
    fontStyle: 'italic',
  },
  time: {
    fontSize: 10.5,
  },
  reactionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionPicker: {
    flexDirection: 'row',
    borderRadius: 32,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  reactionBtn: { padding: 5 },
  reactionEmoji: { fontSize: 26 },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    borderWidth: 1,
  },
  reactionChipEmoji: { fontSize: 14 },
  reactionChipCount: { fontSize: 11, fontWeight: '600' },
});
