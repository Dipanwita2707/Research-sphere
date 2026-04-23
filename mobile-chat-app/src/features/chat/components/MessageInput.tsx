import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../../../shared/hooks/useTheme';
import VoiceRecorder from './VoiceRecorder';
import type { ChatMessage, DirectMessage } from '../../../types/chat.types';

// Common emojis grouped for quick access
const EMOJI_GROUPS = [
  { label: '😀', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','💫','🤯','🤠','🥳','🥸','😎','🤓','🧐'] },
  { label: '👍', emojis: ['👍','👎','👏','🙌','🤝','🤜','🤛','✊','👊','🤞','✌️','🤟','🤘','👌','🤌','🤏','👈','👉','👆','👇','☝️','✋','🤚','🖐','🖖','👋','🤙','💪','🦾','🦿','🖕','✍️','🤳','💅','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁','👅','👄','🫦'] },
  { label: '❤️', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','🕉','❄️','🔥','💯','💢','💥','💦','💬','💭','🗯️','♨️','🎵','🎶','⭐','🌟','💫','✨','🎉','🎊','🎈','🎁','🏆','🥇'] },
  { label: '😂', emojis: ['😂','🤣','😭','😩','😫','🥺','😢','😤','😠','😡','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'] },
];

interface Props {
  onSendText: (text: string) => void;
  onSendFile: (uri: string, name: string, type: string) => void;
  onSendVoice: (uri: string, duration: number) => void;
  replyingTo?: ChatMessage | DirectMessage | null;
  editingText?: string | null;
  onCancelReply?: () => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
}

export default function MessageInput({
  onSendText,
  onSendFile,
  onSendVoice,
  replyingTo,
  editingText,
  onCancelReply,
  onTypingStart,
  onTypingStop,
}: Props) {
  const [text, setText] = useState(editingText || '');
  const [isRecording, setIsRecording] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { colors } = useTheme();

  React.useEffect(() => {
    if (editingText !== undefined && editingText !== null) {
      setText(editingText);
    }
  }, [editingText]);

  const handleTextChange = (t: string) => {
    setText(t);
    if (t.length > 0) {
      onTypingStart?.();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => { onTypingStop?.(); }, 2000);
    } else {
      onTypingStop?.();
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendText(trimmed);
    setText('');
    onTypingStop?.();
  };

  const insertEmoji = (emoji: string) => {
    setText((t) => t + emoji);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onSendFile(asset.uri, asset.fileName || 'image.jpg', asset.mimeType || 'image/jpeg');
    }
  };

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onSendFile(asset.uri, asset.name, asset.mimeType || 'application/octet-stream');
    }
  };

  return (
    <>
      {/* Emoji Picker Modal */}
      <Modal transparent visible={showEmoji} animationType="slide" onRequestClose={() => setShowEmoji(false)}>
        <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' }} onPress={() => setShowEmoji(false)}>
          <Pressable style={[styles.emojiPicker, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <View style={[styles.emojiHandle, { backgroundColor: colors.textMuted }]} />
            {EMOJI_GROUPS.map((group) => (
              <View key={group.label} style={styles.group}>
                <View style={styles.emojiRow}>
                  {group.emojis.map((e) => (
                    <TouchableOpacity key={e} style={styles.emojiBtn} onPress={() => insertEmoji(e)}>
                      <Text style={styles.emoji}>{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.wrapper}>
        {/* Reply preview or edit banner */}
        {(replyingTo || editingText !== null) && (
          <View style={styles.replyPreview}>
            <View style={styles.replyBar}>
              <Text style={styles.replyLabel}>{editingText !== null ? '✏️ Editing' : '↩️ Replying to'}</Text>
              <Text style={styles.replyText} numberOfLines={1}>
                {editingText || replyingTo?.content || '[media]'}
              </Text>
            </View>
            <TouchableOpacity onPress={onCancelReply} style={styles.replyClose}>
              <Ionicons name="close" size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.container}>
          {isRecording ? (
            <VoiceRecorder
              onVoiceReady={(uri, dur) => { setIsRecording(false); onSendVoice(uri, dur); }}
              onCancel={() => setIsRecording(false)}
            />
          ) : (
            <>
              <TouchableOpacity style={styles.iconBtn} onPress={handlePickFile}>
                <Ionicons name="attach" size={22} color="#94a3b8" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowEmoji(true)}>
                <Ionicons name="happy-outline" size={22} color="#94a3b8" />
              </TouchableOpacity>

              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Message..."
                placeholderTextColor="#64748b"
                value={text}
                onChangeText={handleTextChange}
                multiline
                maxLength={4000}
              />

              <TouchableOpacity style={styles.iconBtn} onPress={handlePickImage}>
                <Ionicons name="image" size={22} color="#94a3b8" />
              </TouchableOpacity>

              {text.trim() ? (
                <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
                  <Ionicons name="send" size={18} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.iconBtn} onPress={() => setIsRecording(true)}>
                  <Ionicons name="mic" size={22} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: 0.5,
    borderTopColor: '#334155',
    backgroundColor: '#1e293b',
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#334155',
  },
  replyBar: {
    flex: 1,
    borderLeftWidth: 2,
    borderLeftColor: '#6366f1',
    paddingLeft: 8,
  },
  replyLabel: {
    color: '#6366f1',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  replyText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  replyClose: { padding: 4 },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
  },
  input: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#f1f5f9',
    fontSize: 15,
    maxHeight: 100,
  },
  iconBtn: { padding: 8 },
  sendBtn: {
    backgroundColor: '#6366f1',
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  emojiPicker: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    paddingHorizontal: 8,
    maxHeight: 320,
  },
  emojiHandle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 10,
  },
  group: { marginBottom: 8 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap' },
  emojiBtn: { padding: 5 },
  emoji: { fontSize: 24 },
});


