import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { searchMessages } from '../../../shared/services/chat.service';
import type { ChatsStackParamList, ChatMessage } from '../../../types/chat.types';

type RouteParams = RouteProp<ChatsStackParamList, 'MessageSearch'>;

export default function MessageSearchScreen() {
  const route = useRoute<RouteParams>();
  const nav = useNavigation();
  const { groupId } = route.params;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await searchMessages(groupId, q, 30);
      setResults(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('Search failed:', e);
      setResults([]);
    }
    setLoading(false);
  }, [groupId, query]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const highlight = (text: string, q: string) => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      text.slice(0, idx) +
      '【' + text.slice(idx, idx + q.length) + '】' +
      text.slice(idx + q.length)
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#64748b" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search messages..."
          placeholderTextColor="#64748b"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoFocus
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
            <Ionicons name="close-circle" size={18} color="#64748b" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>Go</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      )}

      {!loading && searched && results.length === 0 && (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={48} color="#334155" />
          <Text style={styles.emptyText}>No messages found for "{query}"</Text>
        </View>
      )}

      {!loading && !searched && (
        <View style={styles.center}>
          <Ionicons name="chatbubble-ellipses-outline" size={48} color="#334155" />
          <Text style={styles.emptyText}>Type to search messages in this group</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.resultRow} onPress={() => nav.goBack()}>
            <View style={styles.senderAvatar}>
              <Text style={styles.senderAvatarText}>
                {item.sender?.firstName?.[0]}{item.sender?.lastName?.[0]}
              </Text>
            </View>
            <View style={styles.resultBody}>
              <View style={styles.resultHeader}>
                <Text style={styles.senderName}>
                  {item.sender?.firstName} {item.sender?.lastName}
                </Text>
                <Text style={styles.resultDate}>{formatDate(item.createdAt)}</Text>
              </View>
              <Text style={styles.resultContent} numberOfLines={3}>
                {item.content || `[${item.messageType}]`}
              </Text>
              {item.isPinned && (
                <View style={styles.pinnedTag}>
                  <Ionicons name="pin" size={11} color="#f59e0b" />
                  <Text style={styles.pinnedTagText}>Pinned</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    margin: 12,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  searchIcon: { marginRight: 4 },
  searchInput: {
    flex: 1,
    color: '#f1f5f9',
    fontSize: 15,
    paddingVertical: 4,
  },
  searchBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 7,
  },
  searchBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  emptyText: { color: '#64748b', fontSize: 14, textAlign: 'center' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  senderAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  senderAvatarText: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  resultBody: { flex: 1 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  senderName: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
  resultDate: { color: '#64748b', fontSize: 12 },
  resultContent: { color: '#94a3b8', fontSize: 14, lineHeight: 20 },
  pinnedTag: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  pinnedTagText: { color: '#f59e0b', fontSize: 11 },
  separator: { height: 0.5, backgroundColor: '#1e293b', marginLeft: 66 },
});
