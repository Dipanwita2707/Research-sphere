import React, { useEffect, useState, useCallback } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { getChatSessions, logoutAllSessions } from '../../../shared/services/chat.service';
import { useChatAuthStore } from '../../../shared/state/chatAuthStore';

interface Session {
  id: string;
  platform: string;
  deviceName: string;
  ipAddress: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent?: boolean;
}

export default function SessionsScreen() {
  const { chatSessionId, logoutChat } = useChatAuthStore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getChatSessions();
      const marked = data.map((s: Session) => ({
        ...s,
        isCurrent: s.id === chatSessionId,
      }));
      // Current session first
      marked.sort((a: Session, b: Session) => (a.isCurrent ? -1 : b.isCurrent ? 1 : 0));
      setSessions(marked);
    } catch (e) {
      console.warn('Failed to load sessions:', e);
    }
    setLoading(false);
    setRefreshing(false);
  }, [chatSessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleLogoutAll = () => {
    Alert.alert('Logout All Devices', 'This will sign you out from all devices.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout All',
        style: 'destructive',
        onPress: async () => {
          try {
            await logoutAllSessions();
            logoutChat();
          } catch (e: any) {
            Alert.alert('Error', 'Failed to logout all sessions');
          }
        },
      },
    ]);
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getPlatformIcon = (platform: string): keyof typeof Ionicons.glyphMap => {
    switch (platform?.toLowerCase()) {
      case 'ios':
        return 'phone-portrait';
      case 'android':
        return 'phone-portrait';
      case 'web':
        return 'globe';
      default:
        return 'desktop';
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6366f1" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor="#6366f1"
          />
        }
        ListHeaderComponent={
          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark" size={20} color="#6366f1" />
            <Text style={styles.infoText}>
              {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.sessionRow, item.isCurrent && styles.sessionCurrent]}>
            <View style={styles.sessionIcon}>
              <Ionicons name={getPlatformIcon(item.platform)} size={22} color="#c7d2fe" />
            </View>
            <View style={styles.sessionInfo}>
              <View style={styles.sessionNameRow}>
                <Text style={styles.sessionName}>
                  {item.deviceName || item.platform || 'Unknown'}
                </Text>
                {item.isCurrent && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>This device</Text>
                  </View>
                )}
              </View>
              <Text style={styles.sessionMeta}>
                {item.platform} · {item.ipAddress || 'Unknown IP'}
              </Text>
              <Text style={styles.sessionTime}>
                Active {formatDate(item.lastActiveAt)}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No active sessions</Text>}
        ListFooterComponent={
          sessions.length > 1 ? (
            <TouchableOpacity style={styles.logoutAllBtn} onPress={handleLogoutAll}>
              <Ionicons name="log-out-outline" size={18} color="#ef4444" />
              <Text style={styles.logoutAllText}>Logout All Other Devices</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  center: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  infoText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1e293b',
  },
  sessionCurrent: {
    backgroundColor: '#1e293b40',
  },
  sessionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#312e81',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionName: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '500',
  },
  currentBadge: {
    backgroundColor: '#065f46',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentBadgeText: {
    color: '#6ee7b7',
    fontSize: 10,
    fontWeight: '600',
  },
  sessionMeta: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 2,
  },
  sessionTime: {
    color: '#475569',
    fontSize: 12,
    marginTop: 2,
  },
  empty: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
  logoutAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    gap: 8,
  },
  logoutAllText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
});
