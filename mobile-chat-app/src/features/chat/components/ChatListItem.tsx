import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore } from '../../../shared/state/chatStore';
import { useTheme } from '../../../shared/hooks/useTheme';
import { getProfileImageUrl } from '../../../shared/services/chat.service';
import ImageViewer from '../../profile/components/ImageViewer';
import type { ChatGroup, Conversation } from '../../../types/chat.types';

interface Props {
  type: 'group' | 'dm';
  item: ChatGroup | Conversation;
  onPress: () => void;
}

export default function ChatListItem({ type, item, onPress }: Props) {
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const { colors } = useTheme();
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  if (type === 'group') {
    const group = item as ChatGroup;
    const members = group.members?.slice(0, 4) || [];
    const hasMoreMembers = (group.members?.length || 0) > 4;

    return (
      <>
        <TouchableOpacity style={[styles.container, { borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.7}>
          <View style={styles.groupAvatarGrid}>
            {members.length > 0 ? (
              members.map((member, idx) => {
                const imgUrl = getProfileImageUrl(member.user?.profileImage);
                return (
                  <TouchableOpacity
                    key={member.id ?? `m-${idx}`}
                    style={[
                      styles.groupAvatarSmall,
                      {
                        position: 'absolute',
                        left: (idx % 2) * 26,
                        top: Math.floor(idx / 2) * 26,
                        zIndex: members.length - idx,
                      },
                    ]}
                    onPress={() => imgUrl && setViewingImage(imgUrl)}
                  >
                    {imgUrl ? (
                      <Image source={{ uri: imgUrl }} style={styles.groupAvatarImage} />
                    ) : (
                      <View style={[styles.groupAvatarPlaceholder, { backgroundColor: colors.primaryBg }]}>
                        <Text style={[styles.groupAvatarText, { color: colors.primary }]}>
                          {member.user?.firstName?.[0]}{member.user?.lastName?.[0]}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.primaryBg }]}>
                <Ionicons name="people" size={24} color={colors.primary} />
              </View>
            )}
            {hasMoreMembers && (
              <View
                style={[
                  styles.groupAvatarSmall,
                  {
                    position: 'absolute',
                    left: 26,
                    top: 26,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    zIndex: 10,
                  },
                ]}
              >
                <Text style={[styles.moreCountText, { color: colors.text }]}>
                  +{(group.members?.length || 0) - 4}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.content}>
            <View style={styles.topRow}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{group.name}</Text>
              {group.lastMessageAt && (
                <Text style={[styles.time, { color: colors.textMuted }]}>{formatTime(group.lastMessageAt)}</Text>
              )}
            </View>
            <View style={styles.bottomRow}>
              <Text style={[styles.preview, { color: colors.textSub }]} numberOfLines={1}>
                {group.lastMessage?.content || 'No messages yet'}
              </Text>
              <Text style={[styles.memberCount, { color: colors.textMuted }]}>{group.memberCount} members</Text>
            </View>
          </View>
        </TouchableOpacity>
        <ImageViewer visible={!!viewingImage} imageUri={viewingImage || ''} onClose={() => setViewingImage(null)} />
      </>
    );
  }

  const conv = item as Conversation;
  const isOnline = onlineUsers.has(conv.user.id);
  const imgUrl = getProfileImageUrl(conv.user.profileImage);

  return (
    <>
      <TouchableOpacity style={[styles.container, { borderBottomColor: colors.border }]} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.avatarContainer}>
          {imgUrl ? (
            <TouchableOpacity onPress={() => setViewingImage(imgUrl)}>
              <Image source={{ uri: imgUrl }} style={styles.avatarImage} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => {}}>
              <View style={[styles.avatar, { backgroundColor: colors.primaryBg }]}>
                <Text style={[styles.avatarText, { color: colors.primary }]}>
                  {conv.user.firstName?.[0]}{conv.user.lastName?.[0]}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          {isOnline && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {conv.user.firstName} {conv.user.lastName}
            </Text>
            {conv.lastMessage?.createdAt && (
              <Text style={[styles.time, { color: colors.textMuted }]}>{formatTime(conv.lastMessage.createdAt)}</Text>
            )}
          </View>
          <View style={styles.bottomRow}>
            <Text style={[styles.preview, { color: colors.textSub }]} numberOfLines={1}>
              {conv.lastMessage?.content || 'Start a conversation'}
            </Text>
            {conv.unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                <Text style={styles.badgeText}>{conv.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
      <ImageViewer visible={!!viewingImage} imageUri={viewingImage || ''} onClose={() => setViewingImage(null)} />
    </>
  );
}

function formatTime(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 604800000) {
    return d.toLocaleDateString([], { weekday: 'short' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 14,
    alignItems: 'center',
    borderBottomWidth: 0.5,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
  },
  groupAvatarGrid: {
    position: 'relative',
    width: 52,
    height: 52,
    marginRight: 2,
  },
  groupAvatarSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  groupAvatarImage: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  groupAvatarPlaceholder: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupAvatarText: {
    fontSize: 10,
    fontWeight: '600',
  },
  moreCountText: {
    fontSize: 10,
    fontWeight: '600',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#0f172a',
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  time: {
    fontSize: 13,
    marginLeft: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  preview: {
    flex: 1,
    fontSize: 13,
  },
  memberCount: {
    fontSize: 12,
    marginLeft: 8,
  },
  badge: {
    marginLeft: 8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
