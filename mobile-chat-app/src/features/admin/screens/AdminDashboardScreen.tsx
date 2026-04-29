import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { getChatPermissionStats } from '../../../shared/services/chat.service';
import type { AdminStackParamList, ChatPermissionStats } from '../../../types/chat.types';
import { useTheme } from '../../../shared/hooks/useTheme';

type Nav = NativeStackNavigationProp<AdminStackParamList, 'AdminDashboard'>;

export default function AdminDashboardScreen() {
  const nav = useNavigation<Nav>();
  const { colors } = useTheme();
  const [stats, setStats] = useState<ChatPermissionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      const s = await getChatPermissionStats();
      setStats(s);
    } catch (e) {
      console.warn('Failed to load stats:', e);
    }
  };

  useEffect(() => {
    loadStats().then(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.primaryBg }]}>
          <Text style={styles.statNumber}>{stats?.totalUsers ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.text }]}>Total Users</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.successBg }]}>
          <Text style={styles.statNumber}>{stats?.enabledUsers ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.text }]}>Enabled</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.dangerBg }]}>
          <Text style={styles.statNumber}>{stats?.disabledUsers ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.text }]}>Disabled</Text>
        </View>
      </View>

      {/* Navigation Cards */}
      <TouchableOpacity
        style={[styles.navCard, { backgroundColor: colors.surface }]}
        onPress={() => nav.navigate('UserPermissions')}
      >
        <View style={[styles.navCardIcon, { backgroundColor: colors.surface2 }]}>
          <Ionicons name="people" size={28} color={colors.primary} />
        </View>
        <View style={styles.navCardContent}>
          <Text style={[styles.navCardTitle, { color: colors.text }]}>User Permissions</Text>
          <Text style={[styles.navCardDesc, { color: colors.textSub }]}>Manage chat access and permissions for users</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.navCard, { backgroundColor: colors.surface }]}
        onPress={() => nav.navigate('GroupManagement')}
      >
        <View style={[styles.navCardIcon, { backgroundColor: colors.surface2 }]}>
          <Ionicons name="chatbubbles" size={28} color={colors.primary} />
        </View>
        <View style={styles.navCardContent}>
          <Text style={[styles.navCardTitle, { color: colors.text }]}>Group Management</Text>
          <Text style={[styles.navCardDesc, { color: colors.textSub }]}>Create, manage, and delete chat groups</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center' },
  statNumber: { color: '#fff', fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 12, marginTop: 4 },
  navCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, gap: 12 },
  navCardIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  navCardContent: { flex: 1 },
  navCardTitle: { fontSize: 17, fontWeight: '600' },
  navCardDesc: { fontSize: 13, marginTop: 2 },
});
