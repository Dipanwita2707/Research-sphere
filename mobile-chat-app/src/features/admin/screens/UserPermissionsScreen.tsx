import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  getAuthorizedUsers,
  searchUnaddedUsers,
  addChatUser,
  toggleChatUser,
} from '../../../shared/services/chat.service';
import type { AdminStackParamList, ChatUserPermission, ChatUser } from '../../../types/chat.types';
import { useTheme } from '../../../shared/hooks/useTheme';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'UserPermissions'>;

export default function UserPermissionsScreen() {
  const nav = useNavigation<Nav>();
  const { colors } = useTheme();
  const [tab, setTab] = useState<'users' | 'add'>('users');
  const [users, setUsers] = useState<ChatUserPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  // Add tab
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<ChatUser[]>([]);
  const [addLoading, setAddLoading] = useState(false);

  const loadUsers = useCallback(async (p = 1, s = '') => {
    setLoading(true);
    try {
      const data = await getAuthorizedUsers({ page: p, limit: 20, search: s || undefined });
      setUsers(data.users);
      setTotalPages(data.pagination.totalPages);
      setPage(p);
    } catch (e) {
      console.warn('Failed to load users:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, []);

  const handleToggle = async (userId: string, enabled: boolean) => {
    try {
      await toggleChatUser(userId, enabled);
      setUsers((prev) =>
        prev.map((u) => (u.userId === userId ? { ...u, chatEnabled: enabled } : u)),
      );
    } catch {
      Alert.alert('Error', 'Failed to toggle user');
    }
  };

  const handleSearchAdd = async (q: string) => {
    setAddQuery(q);
    if (q.trim().length < 2) {
      setAddResults([]);
      return;
    }
    setAddLoading(true);
    try {
      const results = await searchUnaddedUsers(q.trim());
      setAddResults(results);
    } catch {
      setAddResults([]);
    }
    setAddLoading(false);
  };

  const handleAddUser = async (user: ChatUser) => {
    Alert.alert('Add User', `Add ${user.firstName} ${user.lastName} to chat?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Add',
        onPress: async () => {
          try {
            await addChatUser({ uid: user.uid });
            setAddResults((prev) => prev.filter((u) => u.id !== user.id));
            Alert.alert('Success', `${user.firstName} added to chat`);
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to add user');
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[styles.tab, tab === 'users' && { backgroundColor: colors.primary }]}
          onPress={() => setTab('users')}
        >
          <Text style={[styles.tabText, { color: tab === 'users' ? '#fff' : colors.textSub }]}>Users</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'add' && { backgroundColor: colors.primary }]}
          onPress={() => setTab('add')}
        >
          <Text style={[styles.tabText, { color: tab === 'add' ? '#fff' : colors.textSub }]}>Add Users</Text>
        </TouchableOpacity>
      </View>

      {tab === 'users' ? (
        <>
          {/* Search */}
          <View style={[styles.searchBar, { backgroundColor: colors.inputBg }]}>
            <Ionicons name="search" size={18} color={colors.placeholder} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search users..."
              placeholderTextColor={colors.placeholder}
              value={search}
              onChangeText={(t) => {
                setSearch(t);
                loadUsers(1, t);
              }}
            />
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={users}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.userRow, { borderBottomColor: colors.border }]}
                  onPress={() =>
                    nav.navigate('UserPermissionDetail', {
                      userId: item.userId,
                      userName: item.user ? `${item.user.firstName} ${item.user.lastName}` : item.userId,
                    })
                  }
                >
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: colors.text }]}>
                      {item.user ? `${item.user.firstName} ${item.user.lastName}` : item.userId}
                    </Text>
                    <Text style={[styles.userUid, { color: colors.textMuted }]}>{item.user?.uid || ''}</Text>
                  </View>
                  <Switch
                    value={item.chatEnabled}
                    onValueChange={(v) => handleToggle(item.userId, v)}
                    trackColor={{ false: colors.switchTrackFalse, true: colors.switchTrackTrue }}
                    thumbColor={item.chatEnabled ? colors.primary : colors.textMuted}
                  />
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>No users found</Text>}
            />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <View style={styles.pagination}>
              <TouchableOpacity
                style={styles.pageBtn}
                onPress={() => loadUsers(page - 1, search)}
                disabled={page <= 1}
              >
                <Ionicons name="chevron-back" size={18} color={page <= 1 ? colors.textMuted : colors.text} />
              </TouchableOpacity>
              <Text style={[styles.pageText, { color: colors.textSub }]}>{page} / {totalPages}</Text>
              <TouchableOpacity
                style={styles.pageBtn}
                onPress={() => loadUsers(page + 1, search)}
                disabled={page >= totalPages}
              >
                <Ionicons name="chevron-forward" size={18} color={page >= totalPages ? colors.textMuted : colors.text} />
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        <>
          <View style={[styles.searchBar, { backgroundColor: colors.inputBg }]}>
            <Ionicons name="search" size={18} color={colors.placeholder} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search users to add..."
              placeholderTextColor={colors.placeholder}
              value={addQuery}
              onChangeText={handleSearchAdd}
              autoFocus
            />
          </View>

          {addLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={addResults}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.userRow, { borderBottomColor: colors.border }]}
                  onPress={() => handleAddUser(item)}
                >
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: colors.text }]}>
                      {item.firstName} {item.lastName}
                    </Text>
                    <Text style={[styles.userUid, { color: colors.textMuted }]}>{item.uid} · {item.role}</Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color={colors.primary} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={[styles.empty, { color: colors.textMuted }]}>
                  {addQuery.length >= 2 ? 'No unadded users found' : 'Type to search'}
                </Text>
              }
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  userName: {
    fontSize: 15,
    fontWeight: '500',
  },
  userUid: {
    fontSize: 13,
    marginTop: 2,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  pageBtn: {
    padding: 8,
  },
  pageText: {
    fontSize: 14,
  },
});
