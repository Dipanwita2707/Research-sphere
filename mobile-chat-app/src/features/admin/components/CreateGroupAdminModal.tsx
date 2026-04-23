import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createGroup, updateGroupPermissions, searchUnaddedUsers } from '../../../shared/services/chat.service';
import type { ChatGroup, ChatUser, GroupPermissions } from '../../../types/chat.types';
import { useTheme } from '../../../shared/hooks/useTheme';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: (group: ChatGroup) => void;
}

type GroupType = 'public' | 'private' | 'restricted';

const DEFAULT_PERMISSIONS: GroupPermissions = {
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

const PRESETS: { label: string; icon: string; apply: () => Partial<GroupPermissions> }[] = [
  {
    label: 'Open Group',
    icon: 'earth-outline',
    apply: () => ({
      canSendMessage: true, canEditMessage: true, canDeleteMessage: true,
      canPinMessage: true, adminOnlyMessaging: false, readOnlyMode: false,
      canUploadFiles: true, canSendVoice: true, canSendVideo: true, canSendEmoji: true,
      canAddMembers: true, canRemoveMembers: false, canMentionAll: true,
      privateDMAllowed: true, searchMembers: true,
    }),
  },
  {
    label: 'Moderated',
    icon: 'shield-checkmark-outline',
    apply: () => ({
      canSendMessage: true, canEditMessage: true, canDeleteMessage: false,
      canPinMessage: false, adminOnlyMessaging: false, readOnlyMode: false,
      canUploadFiles: true, canSendVoice: false, canSendVideo: false, canSendEmoji: true,
      canAddMembers: false, canRemoveMembers: false, canMentionAll: false,
      privateDMAllowed: true, searchMembers: true,
    }),
  },
  {
    label: 'Announcement',
    icon: 'megaphone-outline',
    apply: () => ({
      canSendMessage: false, canEditMessage: false, canDeleteMessage: false,
      canPinMessage: false, adminOnlyMessaging: true, readOnlyMode: true,
      canUploadFiles: false, canSendVoice: false, canSendVideo: false, canSendEmoji: false,
      canAddMembers: false, canRemoveMembers: false, canMentionAll: false,
      privateDMAllowed: false, searchMembers: true,
    }),
  },
  {
    label: 'Reset',
    icon: 'refresh-outline',
    apply: () => ({ ...DEFAULT_PERMISSIONS }),
  },
];

const PERM_SECTIONS: { title: string; icon: string; keys: (keyof GroupPermissions)[] }[] = [
  {
    title: 'Messaging',
    icon: 'chatbubble-outline',
    keys: ['canSendMessage', 'canEditMessage', 'canDeleteMessage', 'canPinMessage', 'adminOnlyMessaging', 'readOnlyMode'],
  },
  {
    title: 'Media',
    icon: 'image-outline',
    keys: ['canUploadFiles', 'canSendVoice', 'canSendVideo', 'canSendEmoji'],
  },
  {
    title: 'Group Management',
    icon: 'people-outline',
    keys: ['canAddMembers', 'canRemoveMembers', 'canMentionAll', 'privateDMAllowed', 'searchMembers'],
  },
];

const PERM_LABELS: Record<keyof GroupPermissions, string> = {
  canSendMessage: 'Send Messages',
  canEditMessage: 'Edit Messages',
  canDeleteMessage: 'Delete Messages',
  canPinMessage: 'Pin Messages',
  adminOnlyMessaging: 'Admin-Only Messaging',
  readOnlyMode: 'Read-Only Mode',
  canUploadFiles: 'Upload Files',
  canSendVoice: 'Voice Messages',
  canSendVideo: 'Video Messages',
  canSendEmoji: 'Use Emoji',
  canAddMembers: 'Add Members',
  canRemoveMembers: 'Remove Members',
  canMentionAll: 'Mention All (@all)',
  privateDMAllowed: 'Allow Private DMs',
  searchMembers: 'Search Members',
};

// ─── Step 1: Basic Info ─────────────────────────────────────────────────────

function StepBasicInfo({
  name, setName,
  description, setDescription,
  type, setType,
  maxMembers, setMaxMembers,
  colors,
}: {
  name: string; setName: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  type: GroupType; setType: (v: GroupType) => void;
  maxMembers: string; setMaxMembers: (v: string) => void;
  colors: ReturnType<typeof import('../../../shared/hooks/useTheme').useTheme>['colors'];
}) {
  const types: { value: GroupType; label: string; icon: string }[] = [
    { value: 'public', label: 'Public', icon: 'earth-outline' },
    { value: 'private', label: 'Private', icon: 'lock-closed-outline' },
    { value: 'restricted', label: 'Restricted', icon: 'eye-off-outline' },
  ];

  return (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={[s.fieldLabel, { color: colors.textSub }]}>Group Name *</Text>
      <TextInput
        style={[s.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
        value={name}
        onChangeText={setName}
        placeholder="Enter group name"
        placeholderTextColor={colors.placeholder}
        maxLength={100}
        autoFocus
      />

      <Text style={[s.fieldLabel, { color: colors.textSub }]}>Description</Text>
      <TextInput
        style={[s.input, s.inputMulti, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
        value={description}
        onChangeText={setDescription}
        placeholder="Optional description…"
        placeholderTextColor={colors.placeholder}
        multiline
        numberOfLines={3}
        maxLength={500}
      />

      <Text style={[s.fieldLabel, { color: colors.textSub }]}>Group Type</Text>
      <View style={s.typeRow}>
        {types.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[
              s.typeBtn,
              { borderColor: colors.border, backgroundColor: colors.surface },
              type === t.value && { borderColor: colors.primary, backgroundColor: colors.primaryBg },
            ]}
            onPress={() => setType(t.value)}
          >
            <Ionicons
              name={t.icon as any}
              size={20}
              color={type === t.value ? colors.primary : colors.textMuted}
            />
            <Text style={[s.typeBtnText, { color: type === t.value ? colors.primary : colors.textSub }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[s.fieldLabel, { color: colors.textSub }]}>Max Members</Text>
      <TextInput
        style={[s.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
        value={maxMembers}
        onChangeText={setMaxMembers}
        placeholder="Leave blank for unlimited"
        placeholderTextColor={colors.placeholder}
        keyboardType="number-pad"
        maxLength={6}
      />
    </ScrollView>
  );
}

// ─── Step 2: Add Members ────────────────────────────────────────────────────

function StepMembers({
  members, setMembers, colors,
}: {
  members: ChatUser[];
  setMembers: React.Dispatch<React.SetStateAction<ChatUser[]>>;
  colors: ReturnType<typeof import('../../../shared/hooks/useTheme').useTheme>['colors'];
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatUser[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchUnaddedUsers(text.trim());
        // filter out already-added members
        setResults(r.filter((u) => !members.some((m) => m.id === u.id)));
      } catch { setResults([]); }
      setSearching(false);
    }, 350);
  }, [members]);

  const addMember = (u: ChatUser) => {
    setMembers((prev) => [...prev, u]);
    setResults((prev) => prev.filter((r) => r.id !== u.id));
    setQuery('');
    setResults([]);
  };

  const removeMember = (id: string) => setMembers((prev) => prev.filter((m) => m.id !== id));

  return (
    <View style={{ flex: 1 }}>
      {/* Search box */}
      <View style={[s.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
        <Ionicons name="search" size={16} color={colors.placeholder} />
        <TextInput
          style={[s.searchBoxInput, { color: colors.text }]}
          value={query}
          onChangeText={handleSearch}
          placeholder="Search by name, UID, or email…"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
        />
        {searching && <ActivityIndicator size="small" color={colors.primary} />}
        {query.length > 0 && !searching && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
            <Ionicons name="close-circle" size={16} color={colors.placeholder} />
          </TouchableOpacity>
        )}
      </View>

      {/* Search results */}
      {results.length > 0 && (
        <View style={[s.resultsBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {results.slice(0, 6).map((u) => (
            <TouchableOpacity
              key={u.id}
              style={[s.resultRow, { borderBottomColor: colors.border }]}
              onPress={() => addMember(u)}
            >
              <View style={[s.resultAvatar, { backgroundColor: colors.primaryBg }]}>
                <Text style={[s.resultAvatarText, { color: colors.primary }]}>
                  {(u.firstName || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.resultName, { color: colors.text }]}>
                  {u.firstName} {u.lastName}
                </Text>
                <Text style={[s.resultSub, { color: colors.textMuted }]}>{u.uid} · {u.role}</Text>
              </View>
              <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          ))}
        </View>
      )}
      {query.trim().length >= 2 && !searching && results.length === 0 && (
        <Text style={[s.emptyNote, { color: colors.textMuted }]}>No users found</Text>
      )}

      {/* Selected members list */}
      {members.length > 0 ? (
        <View style={{ marginTop: 12 }}>
          <Text style={[s.sectionLabel, { color: colors.textSub }]}>
            Selected ({members.length})
          </Text>
          <FlatList
            data={members}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={[s.selectedRow, { borderBottomColor: colors.border }]}>
                <View style={[s.resultAvatar, { backgroundColor: colors.primaryBg }]}>
                  <Text style={[s.resultAvatarText, { color: colors.primary }]}>
                    {(item.firstName || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.resultName, { color: colors.text }]}>
                    {item.firstName} {item.lastName}
                  </Text>
                  <Text style={[s.resultSub, { color: colors.textMuted }]}>{item.uid}</Text>
                </View>
                <TouchableOpacity onPress={() => removeMember(item.id)}>
                  <Ionicons name="close-circle" size={20} color={colors.danger} />
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      ) : (
        <View style={s.emptyMembersWrap}>
          <Ionicons name="people-outline" size={36} color={colors.textMuted} />
          <Text style={[s.emptyNote, { color: colors.textMuted, marginTop: 8 }]}>
            Search to add initial members{'\n'}(optional — you can add later)
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Step 3: Permissions ────────────────────────────────────────────────────

function StepPermissions({
  permissions, setPermissions, colors,
}: {
  permissions: GroupPermissions;
  setPermissions: React.Dispatch<React.SetStateAction<GroupPermissions>>;
  colors: ReturnType<typeof import('../../../shared/hooks/useTheme').useTheme>['colors'];
}) {
  const toggle = (key: keyof GroupPermissions) =>
    setPermissions((p) => ({ ...p, [key]: !p[key] }));

  const applyPreset = (preset: typeof PRESETS[number]) => {
    setPermissions((p) => ({ ...p, ...preset.apply() }));
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Presets */}
      <Text style={[s.sectionLabel, { color: colors.textSub }]}>Quick Presets</Text>
      <View style={s.presetsRow}>
        {PRESETS.map((preset) => (
          <TouchableOpacity
            key={preset.label}
            style={[s.presetBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => applyPreset(preset)}
          >
            <Ionicons name={preset.icon as any} size={16} color={colors.primary} />
            <Text style={[s.presetText, { color: colors.text }]}>{preset.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Permission sections */}
      {PERM_SECTIONS.map((section) => (
        <View
          key={section.title}
          style={[s.permCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[s.permCardHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface2 }]}>
            <Ionicons name={section.icon as any} size={15} color={colors.primary} />
            <Text style={[s.permCardTitle, { color: colors.textSub }]}>{section.title}</Text>
          </View>
          {section.keys.map((key, idx) => (
            <View
              key={key}
              style={[
                s.permRow,
                idx < section.keys.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: colors.border },
              ]}
            >
              <Text style={[s.permLabel, { color: colors.text }]}>{PERM_LABELS[key]}</Text>
              <Switch
                value={permissions[key] as boolean}
                onValueChange={() => toggle(key)}
                trackColor={{ false: colors.switchTrackFalse, true: colors.switchTrackTrue }}
                thumbColor={permissions[key] ? colors.primary : colors.textMuted}
              />
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Main Modal ─────────────────────────────────────────────────────────────

export default function CreateGroupAdminModal({ visible, onClose, onCreated }: Props) {
  const { colors } = useTheme();

  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);

  // Step 1
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<GroupType>('public');
  const [maxMembers, setMaxMembers] = useState('');

  // Step 2
  const [members, setMembers] = useState<ChatUser[]>([]);

  // Step 3
  const [permissions, setPermissions] = useState<GroupPermissions>({ ...DEFAULT_PERMISSIONS });

  const STEPS = ['Basic Info', 'Members', 'Permissions'];

  const reset = () => {
    setStep(0);
    setName('');
    setDescription('');
    setType('public');
    setMaxMembers('');
    setMembers([]);
    setPermissions({ ...DEFAULT_PERMISSIONS });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const canProceed = () => {
    if (step === 0) return name.trim().length >= 2;
    return true;
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      handleCreate();
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const group = await createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        maxMembers: maxMembers ? parseInt(maxMembers, 10) : undefined,
        memberIds: members.map((m) => m.id),
      });

      // Apply non-default permissions
      const hasCustomPerms = (Object.keys(DEFAULT_PERMISSIONS) as (keyof GroupPermissions)[]).some(
        (k) => permissions[k] !== DEFAULT_PERMISSIONS[k],
      );
      if (hasCustomPerms) {
        try {
          await updateGroupPermissions(group.id, permissions);
        } catch {
          // Non-critical — group was created, just permissions update failed
        }
      }

      onCreated(group);
      reset();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to create group');
    }
    setCreating(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.overlay}
      >
        <Pressable style={s.overlayBg} onPress={handleClose} />
        <View style={[s.sheet, { backgroundColor: colors.bg }]}>
          {/* Header */}
          <View style={[s.header, { borderBottomColor: colors.border }]}>
            <Text style={[s.title, { color: colors.text }]}>Create Group</Text>
            <TouchableOpacity onPress={handleClose} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textSub} />
            </TouchableOpacity>
          </View>

          {/* Step indicator */}
          <View style={s.stepRow}>
            {STEPS.map((label, idx) => (
              <React.Fragment key={label}>
                <TouchableOpacity
                  style={s.stepItem}
                  onPress={() => { if (idx < step) setStep(idx); }}
                  disabled={idx >= step}
                >
                  <View
                    style={[
                      s.stepCircle,
                      {
                        backgroundColor: idx <= step ? colors.primary : colors.surface,
                        borderColor: idx <= step ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    {idx < step ? (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    ) : (
                      <Text style={[s.stepNum, { color: idx === step ? '#fff' : colors.textMuted }]}>
                        {idx + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[s.stepLabel, { color: idx === step ? colors.primary : colors.textMuted }]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
                {idx < STEPS.length - 1 && (
                  <View
                    style={[s.stepLine, { backgroundColor: idx < step ? colors.primary : colors.border }]}
                  />
                )}
              </React.Fragment>
            ))}
          </View>

          {/* Step content */}
          <View style={s.content}>
            {step === 0 && (
              <StepBasicInfo
                name={name} setName={setName}
                description={description} setDescription={setDescription}
                type={type} setType={setType}
                maxMembers={maxMembers} setMaxMembers={setMaxMembers}
                colors={colors}
              />
            )}
            {step === 1 && (
              <StepMembers members={members} setMembers={setMembers} colors={colors} />
            )}
            {step === 2 && (
              <StepPermissions
                permissions={permissions}
                setPermissions={setPermissions}
                colors={colors}
              />
            )}
          </View>

          {/* Footer buttons */}
          <View style={[s.footer, { borderTopColor: colors.border }]}>
            {step > 0 ? (
              <TouchableOpacity
                style={[s.backBtn, { borderColor: colors.border }]}
                onPress={() => setStep((s) => s - 1)}
                disabled={creating}
              >
                <Ionicons name="chevron-back" size={18} color={colors.text} />
                <Text style={[s.backBtnText, { color: colors.text }]}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            <TouchableOpacity
              style={[
                s.nextBtn,
                { backgroundColor: canProceed() ? colors.primary : colors.border },
              ]}
              onPress={handleNext}
              disabled={!canProceed() || creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={s.nextBtnText}>
                    {step === STEPS.length - 1 ? 'Create Group' : 'Next'}
                  </Text>
                  {step < STEPS.length - 1 && (
                    <Ionicons name="chevron-forward" size={18} color="#fff" />
                  )}
                  {step === STEPS.length - 1 && (
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  )}
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },

  // Step indicator
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 4,
    marginBottom: 18,
    borderRadius: 1,
  },

  // Content area
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 0.5,
    gap: 10,
    marginTop: 4,
  },
  backBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  nextBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // Form fields
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputMulti: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 4,
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Search (step 2)
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 4,
  },
  searchBoxInput: {
    flex: 1,
    fontSize: 15,
  },
  resultsBox: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 0.5,
  },
  resultAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultAvatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  resultName: {
    fontSize: 14,
    fontWeight: '500',
  },
  resultSub: {
    fontSize: 12,
    marginTop: 1,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  emptyNote: {
    textAlign: 'center',
    fontSize: 14,
    marginTop: 12,
  },
  emptyMembersWrap: {
    alignItems: 'center',
    marginTop: 40,
  },

  // Permissions (step 3)
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  presetText: {
    fontSize: 13,
    fontWeight: '600',
  },
  permCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  permCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  permCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  permLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
});
