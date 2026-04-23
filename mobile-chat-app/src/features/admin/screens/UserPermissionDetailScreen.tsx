import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  getAuthorizedUsers,
  updateChatUserPermissions,
  removeChatUser,
} from '../../../shared/services/chat.service';
import type { AdminStackParamList, ChatUserPermission } from '../../../types/chat.types';
import { useTheme } from '../../../shared/hooks/useTheme';

type RouteT = RouteProp<AdminStackParamList, 'UserPermissionDetail'>;

const PERMISSION_GROUPS = [
  {
    title: 'Chat Access',
    icon: 'chatbubble-outline' as const,
    permissions: [
      { key: 'chatEnabled', label: 'Chat Enabled', desc: 'User can access the chat application' },
    ],
  },
  {
    title: 'Messaging',
    icon: 'paper-plane-outline' as const,
    permissions: [
      { key: 'canPrivateMessage', label: 'Private Messages', desc: 'Can send direct messages to other users' },
    ],
  },
  {
    title: 'Group Management',
    icon: 'people-outline' as const,
    permissions: [
      { key: 'canCreateGroup', label: 'Create Groups', desc: 'Can create new chat groups' },
    ],
  },
  {
    title: 'Profile & Media',
    icon: 'person-circle-outline' as const,
    permissions: [
      { key: 'canUploadProfilePhoto', label: 'Upload Profile Photo', desc: 'Can upload or change profile photo' },
    ],
  },
  {
    title: 'Privacy Settings',
    icon: 'shield-checkmark-outline' as const,
    permissions: [
      { key: 'canSetLastSeen', label: 'Last Seen', desc: 'Can control last seen visibility' },
      { key: 'canSetOnlineStatus', label: 'Online Status', desc: 'Can control online status visibility' },
      { key: 'canSetProfilePrivacy', label: 'Profile Privacy', desc: 'Can set profile picture privacy' },
      { key: 'canSetAboutPrivacy', label: 'About Privacy', desc: 'Can set about info privacy' },
      { key: 'canSetStatusPrivacy', label: 'Status Privacy', desc: 'Can set status update privacy' },
      { key: 'canSetReadReceipts', label: 'Read Receipts', desc: 'Can toggle read receipts on/off' },
      { key: 'canSetMessageTimer', label: 'Message Timer', desc: 'Can set disappearing message timers' },
      { key: 'canSetGroupsPrivacy', label: 'Groups Privacy', desc: 'Can control who adds them to groups' },
      { key: 'canBlockContacts', label: 'Block Contacts', desc: 'Can block other users' },
    ],
  },
  {
    title: 'Customization',
    icon: 'color-palette-outline' as const,
    permissions: [
      { key: 'canChangeTheme', label: 'Change Theme', desc: 'Can customize chat theme' },
      { key: 'canChangeWallpaper', label: 'Change Wallpaper', desc: 'Can set custom chat wallpaper' },
    ],
  },
  {
    title: 'Notifications',
    icon: 'notifications-outline' as const,
    permissions: [
      { key: 'canToggleNotifications', label: 'Toggle Notifications', desc: 'Can control notification preferences' },
    ],
  },
];

type PermState = Record<string, boolean>;

const DEFAULT_PERMS: PermState = {
  chatEnabled: true,
  canPrivateMessage: true,
  canCreateGroup: true,
  canUploadProfilePhoto: true,
  canSetLastSeen: true,
  canSetOnlineStatus: true,
  canSetProfilePrivacy: true,
  canSetAboutPrivacy: true,
  canSetStatusPrivacy: true,
  canSetReadReceipts: true,
  canSetMessageTimer: true,
  canSetGroupsPrivacy: true,
  canBlockContacts: true,
  canChangeTheme: true,
  canChangeWallpaper: true,
  canToggleNotifications: true,
};

export default function UserPermissionDetailScreen() {
  const nav = useNavigation();
  const route = useRoute<RouteT>();
  const { userId, userName } = route.params;
  const { colors } = useTheme();

  const [perm, setPerm] = useState<ChatUserPermission | null>(null);
  const [perms, setPerms] = useState<PermState>({ ...DEFAULT_PERMS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getAuthorizedUsers({ search: userId, limit: 50 });
        const found = data.users.find((u: ChatUserPermission) => u.userId === userId);
        if (found) {
          setPerm(found);
          const loaded: PermState = {};
          Object.keys(DEFAULT_PERMS).forEach((k) => {
            loaded[k] = (found as any)[k] ?? DEFAULT_PERMS[k];
          });
          setPerms(loaded);
        }
      } catch (e) {
        console.warn('Failed to load user permissions:', e);
      }
      setLoading(false);
    })();
  }, [userId]);

  const toggle = (key: string, val: boolean) => setPerms((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateChatUserPermissions(userId, perms);
      Alert.alert('Success', 'Permissions updated successfully');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to save permissions');
    }
    setSaving(false);
  };

  const handleRevokeAll = () => {
    Alert.alert('Revoke All', 'Disable all permissions for this user?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke All',
        style: 'destructive',
        onPress: () => {
          const allOff: PermState = {};
          Object.keys(DEFAULT_PERMS).forEach((k) => { allOff[k] = false; });
          setPerms(allOff);
        },
      },
    ]);
  };

  const handleGrantAll = () => {
    const allOn: PermState = {};
    Object.keys(DEFAULT_PERMS).forEach((k) => { allOn[k] = true; });
    setPerms(allOn);
  };

  const handleRemove = () => {
    Alert.alert('Remove User', `Remove ${userName} from the chat system?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeChatUser(userId);
            nav.goBack();
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to remove user');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.primaryBg }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{userName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{userName}</Text>
        <Text style={[styles.uid, { color: colors.textMuted }]}>{perm?.user?.uid || userId}</Text>
        <Text style={[styles.role, { color: colors.primary }]}>{perm?.user?.role || ''}</Text>
      </View>

      {/* Quick actions */}
      <View style={styles.quickRow}>
        <TouchableOpacity style={[styles.quickBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleGrantAll}>
          <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
          <Text style={[styles.quickBtnText, { color: colors.success }]}>Grant All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={handleRevokeAll}>
          <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
          <Text style={[styles.quickBtnText, { color: colors.danger }]}>Revoke All</Text>
        </TouchableOpacity>
      </View>

      {/* Permission groups */}
      {PERMISSION_GROUPS.map((group) => (
        <View key={group.title} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.cardHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface2 }]}>
            <Ionicons name={group.icon} size={16} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.textSub }]}>{group.title}</Text>
          </View>
          {group.permissions.map((p, idx) => (
            <View
              key={p.key}
              style={[styles.row, idx < group.permissions.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.border }]}
            >
              <View style={styles.rowInfo}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{p.label}</Text>
                <Text style={[styles.rowDesc, { color: colors.textMuted }]}>{p.desc}</Text>
              </View>
              <Switch
                value={perms[p.key] ?? true}
                onValueChange={(val) => toggle(p.key, val)}
                trackColor={{ false: colors.switchTrackFalse, true: colors.switchTrackTrue }}
                thumbColor={perms[p.key] ? colors.primary : colors.textMuted}
              />
            </View>
          ))}
        </View>
      ))}

      {/* Save */}
      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Save Changes</Text>
        )}
      </TouchableOpacity>

      {/* Remove user */}
      <TouchableOpacity style={styles.removeBtn} onPress={handleRemove}>
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
        <Text style={[styles.removeBtnText, { color: colors.danger }]}>Remove from Chat System</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingBottom: 48 },
  header: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 24, fontWeight: '700' },
  name: { fontSize: 18, fontWeight: '600' },
  uid: { fontSize: 13, marginTop: 4 },
  role: { fontSize: 12, marginTop: 4, textTransform: 'capitalize' },
  quickRow: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, gap: 10,
  },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1,
  },
  quickBtnText: { fontSize: 13, fontWeight: '600' },
  card: {
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 12, overflow: 'hidden', borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  cardTitle: {
    fontSize: 12, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  rowInfo: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowDesc: { fontSize: 12, marginTop: 2 },
  saveBtn: {
    marginHorizontal: 16, marginTop: 8,
    borderRadius: 12, paddingVertical: 15, alignItems: 'center',
    backgroundColor: '#6366f1',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  removeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 14, gap: 8, paddingVertical: 12,
  },
  removeBtnText: { fontSize: 14, fontWeight: '500' },
});
