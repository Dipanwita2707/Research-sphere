import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { createGroup } from '../../../shared/services/chat.service';
import type { ChatsStackParamList } from '../../../types/chat.types';

type Nav = NativeStackNavigationProp<ChatsStackParamList, 'NewGroup'>;

export default function NewGroupScreen() {
  const nav = useNavigation<Nav>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'public' | 'private'>('public');
  const [maxMembers, setMaxMembers] = useState('100');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Group name is required');
      return;
    }

    setCreating(true);
    try {
      const group = await createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        maxMembers: parseInt(maxMembers) || 100,
      });
      nav.replace('GroupConversation', { groupId: group.id, groupName: group.name });
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to create group');
    }
    setCreating(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Group Name *</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter group name"
        placeholderTextColor="#64748b"
        value={name}
        onChangeText={setName}
        maxLength={100}
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.inputMulti]}
        placeholder="What's this group about?"
        placeholderTextColor="#64748b"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={500}
      />

      <Text style={styles.label}>Type</Text>
      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'public' && styles.typeBtnActive]}
          onPress={() => setType('public')}
        >
          <Ionicons name="globe-outline" size={18} color={type === 'public' ? '#fff' : '#94a3b8'} />
          <Text style={[styles.typeText, type === 'public' && styles.typeTextActive]}>Public</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, type === 'private' && styles.typeBtnActive]}
          onPress={() => setType('private')}
        >
          <Ionicons name="lock-closed-outline" size={18} color={type === 'private' ? '#fff' : '#94a3b8'} />
          <Text style={[styles.typeText, type === 'private' && styles.typeTextActive]}>Private</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Max Members</Text>
      <TextInput
        style={styles.input}
        placeholder="100"
        placeholderTextColor="#64748b"
        value={maxMembers}
        onChangeText={setMaxMembers}
        keyboardType="number-pad"
      />

      <TouchableOpacity
        style={[styles.createBtn, creating && styles.createBtnDisabled]}
        onPress={handleCreate}
        disabled={creating}
      >
        {creating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.createBtnText}>Create Group</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 20,
    gap: 8,
  },
  label: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 12,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    color: '#f1f5f9',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 6,
  },
  inputMulti: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
  },
  typeBtnActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  typeText: {
    color: '#94a3b8',
    fontSize: 15,
  },
  typeTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  createBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  createBtnDisabled: {
    opacity: 0.6,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
