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
  TextInput,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getGroup, updateGroup, updateGroupPermissions } from '../../../shared/services/chat.service';
import type { ChatsStackParamList, GroupPermissions } from '../../../types/chat.types';

type RouteParams = RouteProp<ChatsStackParamList, 'GroupSettings'>;

type PermKey = keyof GroupPermissions;

const PERMISSION_GROUPS: { title: string; icon: string; items: { key: PermKey; label: string; desc: string }[] }[] = [
  {
    title: 'Messaging',
    icon: 'chatbubbles-outline',
    items: [
      { key: 'canSendMessage', label: 'Send Messages', desc: 'Members can send text messages' },
      { key: 'canEditMessage', label: 'Edit Messages', desc: 'Members can edit their own messages' },
      { key: 'canDeleteMessage', label: 'Delete Messages', desc: 'Members can delete their own messages' },
      { key: 'canPinMessage', label: 'Pin Messages', desc: 'Members can pin important messages' },
      { key: 'adminOnlyMessaging', label: 'Admin-Only Messaging', desc: 'Only admins can send messages' },
      { key: 'readOnlyMode', label: 'Read-Only Mode', desc: 'Members can only read, not send' },
    ],
  },
  {
    title: 'Media & Files',
    icon: 'attach-outline',
    items: [
      { key: 'canUploadFiles', label: 'Upload Files', desc: 'Members can share files and documents' },
      { key: 'canSendVoice', label: 'Voice Messages', desc: 'Members can send voice recordings' },
      { key: 'canSendVideo', label: 'Video Messages', desc: 'Members can share videos' },
      { key: 'canSendEmoji', label: 'Emoji Reactions', desc: 'Members can use emoji reactions' },
    ],
  },
  {
    title: 'Group Management',
    icon: 'people-outline',
    items: [
      { key: 'canAddMembers', label: 'Add Members', desc: 'Members can invite others' },
      { key: 'canRemoveMembers', label: 'Remove Members', desc: 'Members can remove others' },
      { key: 'canMentionAll', label: 'Mention All (@all)', desc: 'Members can notify everyone' },
      { key: 'privateDMAllowed', label: 'Private DMs', desc: 'Members can DM each other' },
      { key: 'searchMembers', label: 'Search Members', desc: 'Members can search the member list' },
    ],
  },
];

const DEFAULTS: GroupPermissions = {
  canSendMessage: true,
  canEditMessage: true,
  canDeleteMessage: false,
  canPinMessage: false,
  adminOnlyMessaging: false,
  readOnlyMode: false,
  canUploadFiles: true,
  canSendVoice: true,
  canSendVideo: true,
  canSendEmoji: true,
  canAddMembers: false,
  canRemoveMembers: false,
  canMentionAll: false,
  privateDMAllowed: true,
  searchMembers: true,
};

export default function GroupSettingsScreen() {
  const route = useRoute<RouteParams>();
  const nav = useNavigation();
  const { groupId, groupName } = route.params;

  const [activeTab, setActiveTab] = useState<'general' | 'permissions'>('general');
  const [name, setName] = useState(groupName);
  const [description, setDescription] = useState('');
  const [perms, setPerms] = useState<GroupPermissions>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  const loadGroup = async () => {
    try {
      const g = await getGroup(groupId);
      setName(g.name);
      setDescription(g.description || '');
      if (g.permissions) {
        setPerms({ ...DEFAULTS, ...g.permissions });
      }
    } catch (e) {
      console.warn('Failed to load group settings:', e);
    }
    setLoading(false);
  };

  const handleSaveGeneral = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Group name cannot be empty'); return; }
    setSaving(true);
    try {
      await updateGroup(groupId, { name: name.trim(), description: description.trim() || undefined });
      Alert.alert('Success', 'Group info updated');
    } catch (e) {
      Alert.alert('Error', 'Failed to update group');
    }
    setSaving(false);
  };

  const handleSavePermissions = async () => {
    setSaving(true);
    try {
      await updateGroupPermissions(groupId, perms);
      Alert.alert('Success', 'Permissions updated');
    } catch (e) {
      Alert.alert('Error', 'Failed to update permissions');
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

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'general' && styles.tabActive]}
          onPress={() => setActiveTab('general')}
        >
          <Text style={[styles.tabText, activeTab === 'general' && styles.tabTextActive]}>General</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'permissions' && styles.tabActive]}
          onPress={() => setActiveTab('permissions')}
        >
          <Text style={[styles.tabText, activeTab === 'permissions' && styles.tabTextActive]}>Permissions</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 40 }}>
        {activeTab === 'general' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Group Name</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholderTextColor="#64748b"
              placeholder="Group name"
            />

            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Description</Text>
            <TextInput
              style={[styles.textInput, { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 }]}
              value={description}
              onChangeText={setDescription}
              placeholderTextColor="#64748b"
              placeholder="Group description (optional)"
              multiline
            />

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSaveGeneral}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'permissions' && (
          <>
            {PERMISSION_GROUPS.map((group) => (
              <View key={group.title} style={styles.permGroup}>
                <View style={styles.permGroupHeader}>
                  <Ionicons name={group.icon as any} size={16} color="#6366f1" />
                  <Text style={styles.permGroupTitle}>{group.title}</Text>
                </View>
                {group.items.map((item, idx) => (
                  <View
                    key={item.key}
                    style={[
                      styles.permRow,
                      idx < group.items.length - 1 && styles.permRowBorder,
                    ]}
                  >
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
            ))}

            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSavePermissions}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save Permissions</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderBottomWidth: 0.5,
    borderBottomColor: '#334155',
  },
  tab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#6366f1',
  },
  tabText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#6366f1' },
  scroll: { flex: 1 },
  section: { padding: 16 },
  sectionLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  textInput: {
    backgroundColor: '#1e293b',
    color: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 0.5,
    borderColor: '#334155',
  },
  saveBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  permGroup: {
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  permGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#0f172a',
    borderBottomWidth: 0.5,
    borderBottomColor: '#334155',
  },
  permGroupTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  permRowBorder: { borderBottomWidth: 0.5, borderBottomColor: '#0f172a' },
  permInfo: { flex: 1 },
  permLabel: { color: '#e2e8f0', fontSize: 14, fontWeight: '500' },
  permDesc: { color: '#64748b', fontSize: 12, marginTop: 1 },
});
