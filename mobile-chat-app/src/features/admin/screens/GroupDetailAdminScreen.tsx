import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Pressable,
  Switch,
  RefreshControl,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  getGroup,
  removeMember,
  updateMemberRole,
  muteMember,
  unmuteMember,
  addMember,
  searchUsersToAdd,
  updateMemberPermissions,
} from '../../../shared/services/chat.service';
import { useChatAuthStore } from '../../../shared/state/chatAuthStore';
import type { AdminStackParamList, ChatGroup, ChatGroupMember, ChatUser } from '../../../types/chat.types';
import { useTheme } from '../../../shared/hooks/useTheme';

type RouteT = RouteProp<AdminStackParamList, 'GroupDetailAdmin'>;

const PERMISSION_KEYS: { key: string; label: string }[] = [
  { key: 'canSendMessages', label: 'Send Messages' },
  { key: 'canSendMedia', label: 'Send Media / Files' },
  { key: 'canAddMembers', label: 'Add Members' },
  { key: 'canRemoveMembers', label: 'Remove Members' },
  { key: 'canEditGroupInfo', label: 'Edit Group Info' },
  { key: 'canPinMessages', label: 'Pin Messages' },
  { key: 'canDeleteMessages', label: 'Delete Messages' },
];

// Permissions editor modal
function MemberPermissionsModal({
  member,
  groupId,
  onClose,
  onSaved,
}: {
  member: ChatGroupMember | null;
  groupId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { colors } = useTheme();
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!member) return;
    const current: Record<string, boolean> = {};
    PERMISSION_KEYS.forEach(({ key }) => {
      current[key] = (member.permissions as any)?.[key] ?? true;
    });
    setPerms(current);
  }, [member]);

  if (!member) return null;

  const name = member.user
    ? `${member.user.firstName} ${member.user.lastName}`.trim() || member.userId
    : member.userId;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMemberPermissions(groupId, member.userId, perms);
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to save permissions');
    }
    setSaving(false);
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.profileCard, { backgroundColor: colors.surface, width: 340, gap: 0 }]} onPress={() => {}}>
          <Text style={[styles.profileName, { color: colors.text, marginBottom: 4 }]}>Permissions</Text>
          <Text style={[styles.profileEmail, { color: colors.textMuted }]}>{name}</Text>
          <View style={{ width: '100%', marginTop: 16 }}>
            {PERMISSION_KEYS.map(({ key, label }) => (
              <View key={key} style={[styles.permRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.permLabel, { color: colors.text }]}>{label}</Text>
                <Switch
                  value={perms[key] ?? true}
                  onValueChange={(v) => setPerms((p) => ({ ...p, [key]: v }))}
                  trackColor={{ false: colors.switchTrackFalse, true: colors.switchTrackTrue }}
                  thumbColor={perms[key] ? colors.primary : colors.textMuted}
                />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <TouchableOpacity
              style={[styles.profileCloseBtn, { flex: 1, backgroundColor: colors.surface2, borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.profileCloseBtnText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.profileCloseBtn, { flex: 1, backgroundColor: colors.primary }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={[styles.profileCloseBtnText, { color: '#fff' }]}>Save</Text>}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Profile popup shown when you tap a member avatar
function MemberProfileModal({
  member,
  onClose,
  onRoleChange,
  onMuteToggle,
  onRemove,
  onManagePerms,
  currentUserRole,
}: {
  member: ChatGroupMember | null;
  onClose: () => void;
  onRoleChange: (m: ChatGroupMember) => void;
  onMuteToggle: (m: ChatGroupMember) => void;
  onRemove: (m: ChatGroupMember) => void;
  onManagePerms: (m: ChatGroupMember) => void;
  currentUserRole: string;
}) {
  const { colors } = useTheme();
  if (!member) return null;
  const name = member.user
    ? `${member.user.firstName} ${member.user.lastName}`.trim() || member.userId
    : member.userId;
  const initial = (member.user?.firstName || '?').charAt(0).toUpperCase();
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'superadmin';

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.profileCard, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <View style={[styles.profileAvatarLarge, { backgroundColor: colors.primary }]}>
            <Text style={styles.profileAvatarInitial}>{initial}</Text>
          </View>
          <Text style={[styles.profileName, { color: colors.text }]}>{name}</Text>
          {member.user?.email ? (
            <Text style={[styles.profileEmail, { color: colors.textMuted }]}>{member.user.email}</Text>
          ) : null}
          <View style={[styles.profileRoleBadge, { backgroundColor: colors.primaryBg }]}>
            <Text style={[styles.profileRoleBadgeText, { color: colors.primary }]}>{member.role}</Text>
          </View>
          {member.isMuted && (
            <View style={styles.profileMutedBadge}>
              <Ionicons name="volume-mute" size={12} color="#f59e0b" />
              <Text style={styles.profileMutedText}>Muted</Text>
            </View>
          )}
          {isAdmin && (
            <View style={styles.profileActions}>
              <TouchableOpacity
                style={[styles.profileActionBtn, { backgroundColor: colors.surface2 }]}
                onPress={() => { onClose(); setTimeout(() => onRoleChange(member), 100); }}
              >
                <Ionicons name="shield-outline" size={18} color={colors.primary} />
                <Text style={[styles.profileActionLabel, { color: colors.primary }]}>Role</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.profileActionBtn, { backgroundColor: colors.surface2 }]}
                onPress={() => { onClose(); setTimeout(() => onManagePerms(member), 100); }}
              >
                <Ionicons name="key-outline" size={18} color="#22d3ee" />
                <Text style={[styles.profileActionLabel, { color: '#22d3ee' }]}>Perms</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.profileActionBtn, { backgroundColor: colors.surface2 }]}
                onPress={() => { onClose(); setTimeout(() => onMuteToggle(member), 100); }}
              >
                <Ionicons
                  name={member.isMuted ? 'volume-high' : 'volume-mute'}
                  size={18}
                  color={member.isMuted ? colors.success : colors.warning}
                />
                <Text style={[styles.profileActionLabel, { color: member.isMuted ? colors.success : colors.warning }]}>
                  {member.isMuted ? 'Unmute' : 'Mute'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.profileActionBtn, { backgroundColor: colors.surface2 }]}
                onPress={() => { onClose(); setTimeout(() => onRemove(member), 100); }}
              >
                <Ionicons name="person-remove-outline" size={18} color={colors.danger} />
                <Text style={[styles.profileActionLabel, { color: colors.danger }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity
            style={[styles.profileCloseBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]}
            onPress={onClose}
          >
            <Text style={[styles.profileCloseBtnText, { color: colors.text }]}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function GroupDetailAdminScreen() {
  const route = useRoute<RouteT>();
  const { groupId } = route.params;
  const myRole = useChatAuthStore((s) => s.chatUser?.role) ?? '';
  const isSystemAdmin = myRole === 'admin' || myRole === 'superadmin';
  const { colors } = useTheme();

  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add member search state
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<ChatUser[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);

  // Profile modal state
  const [selectedMember, setSelectedMember] = useState<ChatGroupMember | null>(null);
  const [permsMember, setPermsMember] = useState<ChatGroupMember | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getGroup(groupId);
      setGroup(data);
    } catch (e) {
      console.warn('Failed to load group:', e);
    }
    setLoading(false);
    setRefreshing(false);
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = useCallback(async (text: string) => {
    setAddQuery(text);
    if (text.trim().length < 2) {
      setAddResults([]);
      return;
    }
    setAddSearching(true);
    try {
      const results = await searchUsersToAdd(groupId, text.trim());
      setAddResults(results);
    } catch {
      setAddResults([]);
    }
    setAddSearching(false);
  }, [groupId]);

  const handleAddMember = async (user: ChatUser) => {
    try {
      await addMember(groupId, user.id);
      setAddQuery('');
      setAddResults([]);
      setShowAddSection(false);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to add member');
    }
  };

  const handleRoleChange = (member: ChatGroupMember) => {
    const roles = ['admin', 'moderator', 'member'] as const;
    Alert.alert(
      'Change Role',
      `${member.user?.firstName || 'User'}: currently ${member.role}`,
      [
        ...roles.map((role) => ({
          text: role.charAt(0).toUpperCase() + role.slice(1),
          onPress: async () => {
            try {
              await updateMemberRole(groupId, member.userId, role);
              load();
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.message || 'Failed to update role');
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  const handleMuteToggle = async (member: ChatGroupMember) => {
    try {
      if (member.isMuted) {
        await unmuteMember(groupId, member.userId);
      } else {
        await muteMember(groupId, member.userId);
      }
      load();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed');
    }
  };

  const handleRemoveMember = (member: ChatGroupMember) => {
    Alert.alert(
      'Remove Member',
      `Remove ${member.user?.firstName || 'user'} from this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember(groupId, member.userId);
              load();
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.message || 'Failed to remove');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text style={[styles.errorText, { color: colors.danger }]}>Group not found</Text>
      </View>
    );
  }

  const members = group.members || [];

  // Determine permission badge colour
  const roleBadgeColor = (role: string) => {
    if (role === 'owner') return '#7c3aed';
    if (role === 'admin') return '#312e81';
    if (role === 'moderator') return '#0e4f3e';
    return '#334155';
  };

  return (
    <>
      <MemberProfileModal
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
        onRoleChange={handleRoleChange}
        onMuteToggle={handleMuteToggle}
        onRemove={handleRemoveMember}
        onManagePerms={(m) => setPermsMember(m)}
        currentUserRole={myRole}
      />
      <MemberPermissionsModal
        member={permsMember}
        groupId={groupId}
        onClose={() => setPermsMember(null)}
        onSaved={load}
      />

      <ScrollView
        style={[styles.container, { backgroundColor: colors.bg }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Group Info */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryBg }]}>
            <Ionicons
              name={group.type === 'public' ? 'people' : 'lock-closed'}
              size={28}
              color={colors.primary}
            />
          </View>
          <Text style={[styles.groupName, { color: colors.text }]}>{group.name}</Text>
          {group.description ? (
            <Text style={[styles.groupDesc, { color: colors.textSub }]}>{group.description}</Text>
          ) : null}
          <Text style={[styles.groupMeta, { color: colors.textMuted }]}>
            {group.type} · {members.length} members · Max {group.maxMembers || '∞'}
          </Text>
        </View>

        {/* Add Member Section (admin only) */}
        {isSystemAdmin && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.addMemberToggle, { backgroundColor: colors.surface }]}
              onPress={() => {
                setShowAddSection((v) => !v);
                setAddQuery('');
                setAddResults([]);
              }}
            >
              <Ionicons name="person-add-outline" size={18} color={colors.primary} />
              <Text style={[styles.addMemberToggleText, { color: colors.primary }]}>Add Member</Text>
              <Ionicons
                name={showAddSection ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.textMuted}
                style={{ marginLeft: 'auto' }}
              />
            </TouchableOpacity>

            {showAddSection && (
              <View style={[styles.addMemberBox, { backgroundColor: colors.surface }]}>
                <View style={[styles.searchRow, { borderBottomColor: colors.border }]}>
                  <Ionicons name="search" size={16} color={colors.placeholder} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    value={addQuery}
                    onChangeText={handleSearch}
                    placeholder="Search by name, UID or email…"
                    placeholderTextColor={colors.placeholder}
                    autoCapitalize="none"
                  />
                  {addSearching && <ActivityIndicator size="small" color={colors.primary} />}
                </View>
                {addResults.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.searchResultRow, { borderBottomColor: colors.border }]}
                    onPress={() => handleAddMember(u)}
                  >
                    <View style={[styles.searchResultAvatar, { backgroundColor: colors.surface2 }]}>
                      <Text style={[styles.memberAvatarText, { color: colors.text }]}>
                        {(u.firstName || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.memberName, { color: colors.text }]}>
                        {u.firstName} {u.lastName}
                      </Text>
                      <Text style={[styles.searchResultSub, { color: colors.textMuted }]}>{u.email}</Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                ))}
                {addQuery.trim().length >= 2 && !addSearching && addResults.length === 0 && (
                  <Text style={[styles.noResults, { color: colors.textMuted }]}>No users found</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Members List */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Members ({members.length})</Text>
          {members.map((member) => {
            const name = member.user
              ? `${member.user.firstName} ${member.user.lastName}`.trim() || member.userId
              : member.userId;
            const initial = (member.user?.firstName || '?').charAt(0).toUpperCase();
            return (
              <View key={member.id} style={[styles.memberRow, { borderBottomColor: colors.border }]}>
                {/* Tappable avatar → opens profile modal */}
                <TouchableOpacity
                  style={[styles.memberAvatar, { backgroundColor: roleBadgeColor(member.role) }]}
                  onPress={() => setSelectedMember(member)}
                >
                  <Text style={styles.memberAvatarText}>{initial}</Text>
                </TouchableOpacity>

                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, { color: colors.text }]}>{name}</Text>
                  <View style={styles.memberMeta}>
                    <View style={[styles.roleBadge, { backgroundColor: roleBadgeColor(member.role) }]}>
                      <Text style={styles.roleBadgeText}>{member.role}</Text>
                    </View>
                    {member.user?.role ? (
                      <Text style={[styles.systemRoleText, { color: colors.textMuted }]}>{member.user.role}</Text>
                    ) : null}
                    {member.isMuted && (
                      <Ionicons name="volume-mute" size={14} color={colors.warning} style={{ marginLeft: 6 }} />
                    )}
                  </View>
                </View>

                {/* Action buttons — admin/owner only */}
                {isSystemAdmin && (
                  <View style={styles.memberActions}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleRoleChange(member)}
                    >
                      <Ionicons name="shield-outline" size={18} color="#6366f1" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => setPermsMember(member)}
                    >
                      <Ionicons name="key-outline" size={18} color="#22d3ee" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleMuteToggle(member)}
                    >
                      <Ionicons
                        name={member.isMuted ? 'volume-high' : 'volume-mute'}
                        size={18}
                        color={member.isMuted ? '#22c55e' : '#f59e0b'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleRemoveMember(member)}
                    >
                      <Ionicons name="close-circle-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingBottom: 40,
  },
  errorText: {
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 0.5,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupName: {
    fontSize: 20,
    fontWeight: '700',
  },
  groupDesc: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  groupMeta: {
    fontSize: 13,
    marginTop: 6,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  // Add member
  addMemberToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 2,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  addMemberToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addMemberBox: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 0.5,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    gap: 10,
  },
  searchResultAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultSub: {
    fontSize: 12,
    marginTop: 1,
  },
  noResults: {
    fontSize: 13,
    padding: 14,
    textAlign: 'center',
  },
  // Member row
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '500',
  },
  memberMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
    gap: 4,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleBadgeText: {
    color: '#c7d2fe',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  systemRoleText: {
    fontSize: 11,
    marginLeft: 4,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionBtn: {
    padding: 8,
  },
  // Profile modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: 300,
    gap: 8,
  },
  profileAvatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  profileAvatarInitial: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  profileEmail: {
    fontSize: 13,
    textAlign: 'center',
  },
  profileRoleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  profileRoleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  profileMutedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1c150a',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  profileMutedText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '600',
  },
  profileActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  profileActionBtn: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  profileActionLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  profileCloseBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 10,
    borderWidth: 1,
  },
  profileCloseBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  permLabel: {
    flex: 1,
    fontSize: 14,
  },
});
