import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getGroup, updateMemberPermissions, updateMemberRole } from '../../../shared/services/chat.service';
import type { ChatsStackParamList, MemberPermissions } from '../../../types/chat.types';

type RouteParams = RouteProp<ChatsStackParamList, 'MemberPermissions'>;

type PermKey = keyof MemberPermissions;

const PERMISSION_ITEMS: { key: PermKey; label: string; desc: string; icon: string }[] = [
  { key: 'canSendMessages', label: 'Send Messages', desc: 'Can send text messages in this group', icon: 'chatbubble-outline' },
  { key: 'canSendMedia', label: 'Send Media & Files', desc: 'Can upload images, files, and voice', icon: 'attach-outline' },
  { key: 'canPinMessages', label: 'Pin Messages', desc: 'Can pin important messages', icon: 'pin-outline' },
  { key: 'canDeleteMessages', label: 'Delete Messages', desc: 'Can delete their own messages', icon: 'trash-outline' },
  { key: 'canAddMembers', label: 'Add Members', desc: 'Can invite new people to the group', icon: 'person-add-outline' },
  { key: 'canRemoveMembers', label: 'Remove Members', desc: 'Can remove other members', icon: 'person-remove-outline' },
  { key: 'canEditGroupInfo', label: 'Edit Group Info', desc: 'Can change name and description', icon: 'create-outline' },
];

const ROLES: { value: string; label: string; color: string }[] = [
  { value: 'admin', label: 'Admin', color: '#818cf8' },
  { value: 'moderator', label: 'Moderator', color: '#34d399' },
  { value: 'member', label: 'Member', color: '#94a3b8' },
];

const DEFAULTS: MemberPermissions = {
  canSendMessages: true,
  canSendMedia: true,
  canPinMessages: false,
  canDeleteMessages: false,
  canAddMembers: false,
  canRemoveMembers: false,
  canEditGroupInfo: false,
};

export default function MemberPermissionsScreen() {
  const route = useRoute<RouteParams>();
  const nav = useNavigation();
  const { groupId, userId, userName, currentRole } = route.params;

  const [perms, setPerms] = useState<MemberPermissions>({ ...DEFAULTS });
  const [role, setRole] = useState(currentRole);
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'role' | 'permissions'>('role');

  useEffect(() => {
    loadMember();
  }, []);

  const loadMember = async () => {
    try {
      const g = await getGroup(groupId);
      const member = g.members?.find((m) => m.userId === userId);
      if (member?.permissions) {
        setPerms({ ...DEFAULTS, ...member.permissions });
        setUseCustom(true);
      }
    } catch (e) {
      console.warn('Failed to load member:', e);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMemberRole(groupId, userId, role);
      if (useCustom) {
        await updateMemberPermissions(groupId, userId, perms as any);
      } else {
        await updateMemberPermissions(groupId, userId, {});
      }
      Alert.alert('Success', `${userName}'s permissions updated`);
      nav.goBack();
    } catch (e) {
      Alert.alert('Error', 'Failed to update member');
    }
    setSaving(false);
  };

  const toggle = (key: PermKey) => {
    setPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const roleObj = ROLES.find((r) => r.value === role);

  return (
    <View style={styles.container}>
      {/* Member header */}
      <View style={styles.memberHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={styles.memberName}>{userName}</Text>
          <View style={[styles.roleBadge, { borderColor: roleObj?.color || '#94a3b8' }]}>
            <Text style={[styles.roleBadgeText, { color: roleObj?.color || '#94a3b8' }]}>{roleObj?.label}</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'role' && styles.tabActive]}
          onPress={() => setActiveTab('role')}
        >
          <Text style={[styles.tabText, activeTab === 'role' && styles.tabTextActive]}>Role</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'permissions' && styles.tabActive]}
          onPress={() => setActiveTab('permissions')}
        >
          <Text style={[styles.tabText, activeTab === 'permissions' && styles.tabTextActive]}>Permissions</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 40 }}>
        {activeTab === 'role' && (
          <View style={{ paddingTop: 16 }}>
            <Text style={styles.sectionLabel}>Select Role</Text>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={[styles.roleRow, role === r.value && styles.roleRowSelected]}
                onPress={() => setRole(r.value)}
              >
                <View style={[styles.roleColor, { backgroundColor: r.color }]} />
                <Text style={styles.roleLabel}>{r.label}</Text>
                {role === r.value && <Ionicons name="checkmark-circle" size={20} color="#6366f1" style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'permissions' && (
          <View style={{ paddingTop: 16 }}>
            {/* Custom override toggle */}
            <View style={styles.customToggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.permLabel}>Custom Permissions</Text>
                <Text style={styles.permDesc}>Override group defaults for this member</Text>
              </View>
              <Switch
                value={useCustom}
                onValueChange={setUseCustom}
                trackColor={{ false: '#334155', true: '#4f46e5' }}
                thumbColor={useCustom ? '#a5b4fc' : '#94a3b8'}
              />
            </View>

            {useCustom && (
              <View style={styles.permGroup}>
                {PERMISSION_ITEMS.map((item, idx) => (
                  <View
                    key={item.key}
                    style={[styles.permRow, idx < PERMISSION_ITEMS.length - 1 && styles.permRowBorder]}
                  >
                    <Ionicons name={item.icon as any} size={18} color="#64748b" style={{ marginRight: 2 }} />
                    <View style={styles.permInfo}>
                      <Text style={styles.permLabel}>{item.label}</Text>
                      <Text style={styles.permDesc}>{item.desc}</Text>
                    </View>
                    <Switch
                      value={!!perms[item.key]}
                      onValueChange={() => toggle(item.key)}
                      trackColor={{ false: '#334155', true: '#4f46e5' }}
                      thumbColor={perms[item.key] ? '#a5b4fc' : '#94a3b8'}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 0.5,
    borderBottomColor: '#334155',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  memberName: { color: '#f1f5f9', fontSize: 17, fontWeight: '700' },
  roleBadge: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderBottomWidth: 0.5,
    borderBottomColor: '#334155',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#6366f1' },
  tabText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#6366f1' },
  scroll: { flex: 1 },
  sectionLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  roleRowSelected: { borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  roleColor: { width: 12, height: 12, borderRadius: 6 },
  roleLabel: { color: '#e2e8f0', fontSize: 15, fontWeight: '500', flex: 1 },
  customToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
  },
  permGroup: {
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  permRowBorder: { borderBottomWidth: 0.5, borderBottomColor: '#0f172a' },
  permInfo: { flex: 1 },
  permLabel: { color: '#e2e8f0', fontSize: 14, fontWeight: '500' },
  permDesc: { color: '#64748b', fontSize: 12, marginTop: 1 },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderTopColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  saveBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
