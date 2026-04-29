import React, { useEffect, useState, useCallback, useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { getMyGroups, deleteGroup } from '../../../shared/services/chat.service';
import type { AdminStackParamList, ChatGroup } from '../../../types/chat.types';
import { useTheme } from '../../../shared/hooks/useTheme';
import CreateGroupAdminModal from '../components/CreateGroupAdminModal';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'GroupManagement'>;

export default function GroupManagementScreen() {
  const nav = useNavigation<Nav>();
  const { colors } = useTheme();
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getMyGroups();
      setGroups(data);
    } catch (e) {
      console.warn('Failed to load groups:', e);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Add a "+" button in the header
  useLayoutEffect(() => {
    nav.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setShowCreate(true)}
          style={{ marginRight: 8, padding: 6 }}
        >
          <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [nav, colors]);

  const handleDelete = (group: ChatGroup) => {
    Alert.alert('Delete Group', `Delete "${group.name}" permanently?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGroup(group.id);
            setGroups((prev) => prev.filter((g) => g.id !== group.id));
          } catch (e: any) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to delete');
          }
        },
      },
    ]);
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <CreateGroupAdminModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(group) => {
          setShowCreate(false);
          setGroups((prev) => [group, ...prev]);
          nav.navigate('GroupDetailAdmin', { groupId: group.id, groupName: group.name });
        }}
      />

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => nav.navigate('GroupDetailAdmin', { groupId: item.id, groupName: item.name })}
            onLongPress={() => handleDelete(item)}
          >
            <View style={[styles.avatar, { backgroundColor: colors.primaryBg }]}>
              <Ionicons
                name={item.type === 'public' ? 'people' : 'lock-closed'}
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.info}>
              <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {item.memberCount || 0} members · {item.type} · {formatDate(item.createdAt)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.empty, { color: colors.textMuted }]}>No groups yet</Text>
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowCreate(true)}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.createBtnText}>Create First Group</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={groups.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    gap: 12,
  },
  empty: {
    fontSize: 15,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
