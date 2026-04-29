import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  getGroup,
  leaveGroup,
  deleteGroup,
  removeMember,
  updateMemberRole,
  muteMember,
  unmuteMember,
  addMember,
  searchUsersToAdd,
} from '../../../shared/services/chat.service';
import { useChatAuthStore } from '../../../shared/state/chatAuthStore';
import OnlineStatus from '../components/OnlineStatus';
import type { ChatsStackParamList, ChatGroup, ChatGroupMember, ChatUser } from '../../../types/chat.types';

type RouteParams = RouteProp<ChatsStackParamList, 'GroupInfo'>;
type Nav = NativeStackNavigationProp<ChatsStackParamList, 'GroupInfo'>;

export default function GroupInfoScreen() {
  const route = useRoute<RouteParams>();
  const nav = useNavigation<Nav>();
  const { groupId } = route.params;
  const [group, setGroup] = useState<ChatGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<ChatUser[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const myId = useChatAuthStore((s) => s.chatUser?.id);
  const myRole = useChatAuthStore((s) => s.chatUser?.role);

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  const loadGroup = async () => {
    setLoading(true);
    try {
      const g = await getGroup(groupId);
      setGroup(g);
    } catch (e) {
      console.warn('Failed to load group:', e);
    }
    setLoading(false);
  };

  const myMember = group?.members?.find((m) => m.userId === myId);
  const isAdmin = myMember?.role === 'admin' || myRole === 'superadmin' || myRole === 'admin';

  const handleSearchToAdd = async (text: string) => {
    setAddQuery(text);
    if (text.trim().length < 2) { setAddResults([]); return; }
    setAddSearching(true);
    try {
      const results = await searchUsersToAdd(groupId, text.trim());
      setAddResults(results || []);
    } catch {
      setAddResults([]);
    }
    setAddSearching(false);
  };

  const handleAddMember = async (user: ChatUser) => {
    try {
      await addMember(groupId, user.id);
      Alert.alert('Added', `${user.firstName} ${user.lastName} added to group`);
      setAddQuery('');
      setAddResults([]);
      setShowAddSection(false);
      loadGroup();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to add member');
    }
  };

  const handleLeave = () => {
    Alert.alert('Leave Group', `Leave "${group?.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveGroup(groupId);
            nav.goBack();
            nav.goBack();
          } catch {
            Alert.alert('Error', 'Failed to leave group');
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete Group', `Permanently delete "${group?.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGroup(groupId);
            nav.goBack();
            nav.goBack();
          } catch {
            Alert.alert('Error', 'Failed to delete group');
          }
        },
      },
    ]);
  };

  const handleMemberAction = (member: ChatGroupMember) => {
    if (!isAdmin || member.userId === myId) return;

    const options: { text: string; onPress: () => void; style?: 'destructive' | 'cancel' }[] = [];

    options.push({
      text: 'Manage Permissions',
      onPress: () =>
        nav.navigate('MemberPermissions', {
          groupId,
          userId: member.userId,
          userName: `${member.user.firstName} ${member.user.lastName}`,
          currentRole: member.role,
        }),
    });

    if (member.role !== 'admin') {
      options.push({ text: 'Make Admin', onPress: () => updateMemberRole(groupId, member.userId, 'admin').then(loadGroup) });
    }
    if (member.role !== 'moderator') {
      options.push({ text: 'Make Moderator', onPress: () => updateMemberRole(groupId, member.userId, 'moderator').then(loadGroup) });
    }
    if (member.role !== 'member') {
      options.push({ text: 'Make Member', onPress: () => updateMemberRole(groupId, member.userId, 'member').then(loadGroup) });
    }

    if (member.isMuted) {
      options.push({ text: 'Unmute', onPress: () => unmuteMember(groupId, member.userId).then(loadGroup) });
    } else {
      options.push({ text: 'Mute', onPress: () => muteMember(groupId, member.userId).then(loadGroup) });
    }

    options.push({
      text: 'Remove',
      style: 'destructive',
      onPress: () => {
        Alert.alert('Remove Member', `Remove ${member.user.firstName}?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => removeMember(groupId, member.userId).then(loadGroup),
          },
        ]);
      },
    });

    options.push({ text: 'Cancel', onPress: () => {}, style: 'cancel' });

    Alert.alert(`${member.user.firstName} ${member.user.lastName}`, `Role: ${member.role}`, options);
  };

  if (loading || !group) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Group Header */}
      <View style={styles.header}>
        <View style={styles.groupAvatar}>
          <Ionicons name="people" size={40} color="#94a3b8" />
        </View>
        <Text style={styles.groupName}>{group.name}</Text>
        {group.description && <Text style={styles.description}>{group.description}</Text>}
        <Text style={styles.meta}>
          {group.memberCount} members · {group.type} · Created {new Date(group.createdAt).toLocaleDateString()}
        </Text>
      </View>

      {/* Admin Actions */}
      {isAdmin && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.adminAction}
            onPress={() => nav.navigate('GroupSettings', { groupId, groupName: group.name })}
          >
            <Ionicons name="settings-outline" size={20} color="#6366f1" />
            <Text style={styles.adminActionText}>Group Settings & Permissions</Text>
            <Ionicons name="chevron-forward" size={16} color="#64748b" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.adminAction}
            onPress={() => setShowAddSection((v) => !v)}
          >
            <Ionicons name="person-add-outline" size={20} color="#34d399" />
            <Text style={[styles.adminActionText, { color: '#34d399' }]}>Add Member</Text>
            <Ionicons
              name={showAddSection ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="#64748b"
              style={{ marginLeft: 'auto' }}
            />
          </TouchableOpacity>

          {/* Add Member Search */}
          {showAddSection && (
            <View style={styles.addMemberSection}>
              <View style={styles.addSearchBar}>
                <Ionicons name="search" size={16} color="#64748b" />
                <TextInput
                  style={styles.addSearchInput}
                  placeholder="Search by name or email..."
                  placeholderTextColor="#64748b"
                  value={addQuery}
                  onChangeText={handleSearchToAdd}
                  autoFocus
                />
                {addSearching && <ActivityIndicator size="small" color="#6366f1" />}
              </View>
              {addResults.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={styles.addResultRow}
                  onPress={() => handleAddMember(user)}
                >
                  <View style={styles.addResultAvatar}>
                    <Text style={styles.addResultAvatarText}>
                      {user.firstName?.[0]}{user.lastName?.[0]}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addResultName}>{user.firstName} {user.lastName}</Text>
                    <Text style={styles.addResultEmail}>{user.email}</Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color="#34d399" />
                </TouchableOpacity>
              ))}
              {addQuery.length >= 2 && addResults.length === 0 && !addSearching && (
                <Text style={styles.noResults}>No users found</Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* Members */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Members ({group.members?.length || 0})</Text>
        {group.members?.map((member) => (
          <TouchableOpacity
            key={member.id}
            style={styles.memberRow}
            onPress={() => handleMemberAction(member)}
            disabled={!isAdmin || member.userId === myId}
          >
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>
                {member.user.firstName?.[0]}{member.user.lastName?.[0]}
              </Text>
            </View>
            <View style={styles.memberInfo}>
              <View style={styles.memberNameRow}>
                <Text style={styles.memberName}>
                  {member.user.firstName} {member.user.lastName}
                  {member.userId === myId ? ' (You)' : ''}
                </Text>
                <OnlineStatus userId={member.userId} size={8} />
              </View>
              <View style={styles.memberBadges}>
                <View style={[styles.roleBadge, member.role === 'admin' && styles.adminBadge]}>
                  <Text style={styles.roleBadgeText}>{member.role}</Text>
                </View>
                {member.isMuted && (
                  <Ionicons name="volume-mute" size={14} color="#f87171" />
                )}
              </View>
            </View>
            {isAdmin && member.userId !== myId && (
              <Ionicons name="chevron-forward" size={16} color="#334155" />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLeave}>
          <Ionicons name="exit-outline" size={20} color="#f87171" />
          <Text style={styles.actionBtnTextDanger}>Leave Group</Text>
        </TouchableOpacity>

        {isAdmin && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color="#f87171" />
            <Text style={styles.actionBtnTextDanger}>Delete Group</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1e293b',
  },
  groupAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupName: { color: '#f1f5f9', fontSize: 22, fontWeight: '700', marginBottom: 4 },
  description: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  meta: { color: '#64748b', fontSize: 13 },
  section: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1e293b',
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  adminAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  adminActionText: { color: '#6366f1', fontSize: 15, fontWeight: '500' },
  addMemberSection: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    overflow: 'hidden',
  },
  addSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#334155',
  },
  addSearchInput: { flex: 1, color: '#f1f5f9', fontSize: 14 },
  addResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#334155',
  },
  addResultAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addResultAvatarText: { color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
  addResultName: { color: '#f1f5f9', fontSize: 14, fontWeight: '500' },
  addResultEmail: { color: '#64748b', fontSize: 12 },
  noResults: { color: '#64748b', fontSize: 13, padding: 12, textAlign: 'center' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberName: { color: '#f1f5f9', fontSize: 15, fontWeight: '500' },
  memberBadges: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  roleBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  adminBadge: { backgroundColor: '#312e81' },
  roleBadgeText: { color: '#94a3b8', fontSize: 11, textTransform: 'capitalize' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionBtnTextDanger: { color: '#f87171', fontSize: 16 },
});
