import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../shared/hooks/useTheme';
import { searchUsersForDM, getProfileImageUrl } from '../../../shared/services/chat.service';
import ImageViewer from '../../profile/components/ImageViewer';
import type { ChatsStackParamList, ChatUser } from '../../../types/chat.types';

type Nav = NativeStackNavigationProp<ChatsStackParamList, 'NewChat'>;

export default function NewChatScreen() {
  const nav = useNavigation<Nav>();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const users = await searchUsersForDM(text.trim(), 20);
        setResults(users);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 300);
  }, []);

  const renderUser = ({ item }: { item: ChatUser }) => {
    const imgUrl = getProfileImageUrl(item.profileImage);
    return (
      <TouchableOpacity
        style={[styles.userRow, { borderBottomColor: colors.border }]}
        onPress={() =>
          nav.navigate('DMConversation', {
            userId: item.id,
            userName: `${item.firstName} ${item.lastName}`,
          })
        }
      >
        <TouchableOpacity onPress={() => imgUrl && setViewingImage(imgUrl)}>
          {imgUrl ? (
            <Image source={{ uri: imgUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primaryBg }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>{item.firstName?.[0]}{item.lastName?.[0]}</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.text }]}>{item.firstName} {item.lastName}</Text>
          <Text style={[styles.userUid, { color: colors.textSub }]}>{item.uid}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name or UID..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={handleSearch}
            autoFocus
          />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={results}
            renderItem={renderUser}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              query.length >= 2 ? (
                <Text style={[styles.empty, { color: colors.textMuted }]}>No users found</Text>
              ) : (
                <Text style={[styles.empty, { color: colors.textMuted }]}>Type to search for users</Text>
              )
            }
          />
        )}
      </View>
      <ImageViewer visible={!!viewingImage} imageUri={viewingImage || ''} onClose={() => setViewingImage(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    padding: 14,
    borderBottomWidth: 0.5,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '600',
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
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
});
