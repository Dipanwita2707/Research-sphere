import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  Switch,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useChatAuthStore } from '../../../shared/state/chatAuthStore';
import { serverConfig } from '../../../shared/config/serverConfig';
import { getPrivacySettings, updatePrivacySettings, getProfileImageUrl, uploadProfileImage } from '../../../shared/services/chat.service';
import { useTheme } from '../../../shared/hooks/useTheme';
import ImageViewer from '../components/ImageViewer';
import type { ProfileStackParamList } from '../../../types/chat.types';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'Profile'>;

export default function ProfileScreen() {
  const nav = useNavigation<Nav>();
  const { chatUser, logoutChat } = useChatAuthStore();
  const { colors, isDark, setThemeMode } = useTheme();

  const [lastSeenPrivacy, setLastSeenPrivacy] = useState<string>('everyone');
  const [loading, setLoading] = useState(true);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [currentServerUrl, setCurrentServerUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [viewingImage, setViewingImage] = useState(false);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [pendingPhotoData, setPendingPhotoData] = useState<{ fileName: string; mimeType: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const settings = await getPrivacySettings();
        setLastSeenPrivacy(settings.lastSeenVisibility || 'everyone');
      } catch {}

      if (chatUser?.id) {
        const url = getProfileImageUrl(chatUser.id);
        setProfileImageUri(url);
      }

      const savedUrl = await serverConfig.getServerUrl();
      if (savedUrl) setCurrentServerUrl(savedUrl);

      setLoading(false);
    })();
  }, [chatUser?.id]);

  const handleChangeServer = () => {
    Alert.prompt(
      'Change Server',
      `Current: ${currentServerUrl}\n\nEnter new server address (e.g. http://192.168.1.100:5001):`,
      async (newUrl) => {
        if (!newUrl) return;
        await serverConfig.setServerUrl(newUrl);
        setCurrentServerUrl(newUrl.trim().replace(/\/$/, ''));
        Alert.alert('Updated', 'Server URL saved. Restart the app to reconnect.');
      },
      'plain-text',
      currentServerUrl,
    );
  };

  const handlePrivacyChange = () => {
    const options = ['everyone', 'contacts', 'nobody'] as const;
    Alert.alert(
      'Last Seen Visibility',
      `Currently: ${lastSeenPrivacy}`,
      options.map((opt) => ({
        text: opt.charAt(0).toUpperCase() + opt.slice(1),
        onPress: async () => {
          try {
            await updatePrivacySettings(opt);
            setLastSeenPrivacy(opt);
          } catch (e: any) {
            Alert.alert('Error', 'Failed to update privacy');
          }
        },
      })),
      { cancelable: true },
    );
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => logoutChat(),
      },
    ]);
  };

  const handleUploadPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission', 'Camera roll permission is required to upload photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const fileName = asset.fileName || `photo-${Date.now()}.jpg`;
        const mimeType = asset.mimeType || 'image/jpeg';
        setPendingPhotoUri(asset.uri);
        setPendingPhotoData({ fileName, mimeType });
      }
    } catch (e: any) {
      Alert.alert('Error', 'Failed to pick image: ' + (e?.message || 'Unknown error'));
    }
  };

  const handleConfirmUpload = async () => {
    if (!pendingPhotoUri || !pendingPhotoData || !chatUser?.id) return;

    try {
      setUploading(true);
      await uploadProfileImage(pendingPhotoUri, pendingPhotoData.fileName, pendingPhotoData.mimeType);
      const newUrl = getProfileImageUrl(chatUser.id);
      setProfileImageUri(newUrl);
      setPendingPhotoUri(null);
      setPendingPhotoData(null);
      Alert.alert('Success', 'Profile photo updated');
    } catch (e: any) {
      Alert.alert('Error', 'Failed to upload photo: ' + (e?.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleCancelUpload = () => {
    setPendingPhotoUri(null);
    setPendingPhotoData(null);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
        {/* Profile Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => profileImageUri && setViewingImage(true)} disabled={!profileImageUri}>
            {profileImageUri ? (
              <Image
                source={{ uri: profileImageUri }}
                style={styles.avatar}
                defaultSource={undefined}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.primaryBg }]}>
                <Text style={[styles.avatarText, { color: colors.primary }]}>
                  {(chatUser?.firstName || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: colors.primary }]} onPress={handleUploadPhoto} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="camera" size={18} color="#fff" />
            )}
          </TouchableOpacity>
          <Text style={[styles.name, { color: colors.text }]}>
            {chatUser?.firstName} {chatUser?.lastName}
          </Text>
          <Text style={[styles.uid, { color: colors.textSub }]}>{chatUser?.uid}</Text>
          <View style={[styles.roleBadge, { backgroundColor: colors.primaryBg }]}>
            <Text style={[styles.roleText, { color: colors.primary }]}>{chatUser?.role}</Text>
          </View>
        </View>

      {/* Settings */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={handlePrivacyChange}>
          <Ionicons name="eye-outline" size={20} color={colors.primary} />
          <View style={styles.menuInfo}>
            <Text style={[styles.menuLabel, { color: colors.text }]}>Last Seen</Text>
            <Text style={[styles.menuValue, { color: colors.textSub }]}>{lastSeenPrivacy}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={[styles.menuItem, { borderBottomColor: colors.border }]}>
          <Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={20} color={colors.primary} />
          <View style={styles.menuInfo}>
            <Text style={[styles.menuLabel, { color: colors.text }]}>Theme</Text>
            <Text style={[styles.menuValue, { color: colors.textSub }]}>{isDark ? 'Dark' : 'Light'}</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={(value) => setThemeMode(value ? 'dark' : 'light')}
            trackColor={{ false: colors.switchTrackFalse, true: colors.switchTrackTrue }}
            thumbColor={isDark ? colors.surface : '#f8fafc'}
            ios_backgroundColor={colors.switchTrackFalse}
          />
        </View>

        <TouchableOpacity
          style={[styles.menuItem, { borderBottomColor: colors.border }]}
          onPress={() => nav.navigate('Sessions')}
        >
          <Ionicons name="phone-portrait-outline" size={20} color={colors.primary} />
          <View style={styles.menuInfo}>
            <Text style={[styles.menuLabel, { color: colors.text }]}>Active Sessions</Text>
            <Text style={[styles.menuValue, { color: colors.textSub }]}>Manage devices</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={handleChangeServer}>
          <Ionicons name="server-outline" size={20} color={colors.primary} />
          <View style={styles.menuInfo}>
            <Text style={[styles.menuLabel, { color: colors.text }]}>Server Address</Text>
            <Text style={[styles.menuValue, { color: colors.textSub }]} numberOfLines={1}>{currentServerUrl || 'Not set'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: colors.surface }]} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={[styles.logoutText, { color: colors.danger }]}>Sign Out</Text>
      </TouchableOpacity>

      {/* App Info */}
      <Text style={[styles.version, { color: colors.textMuted }]}>SGT Connect v1.0.0</Text>
    </ScrollView>

    <ImageViewer visible={viewingImage} imageUri={profileImageUri || ''} onClose={() => setViewingImage(false)} />

    {/* Photo Upload Confirmation Modal */}
    <Modal visible={!!pendingPhotoUri} transparent animationType="fade" onRequestClose={handleCancelUpload}>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Confirm Profile Photo</Text>
          
          {pendingPhotoUri && (
            <Image source={{ uri: pendingPhotoUri }} style={styles.previewImage} />
          )}

          <View style={styles.modalButtonRow}>
            <TouchableOpacity
              style={[styles.modalButton, { borderColor: colors.border, borderWidth: 1 }]}
              onPress={handleCancelUpload}
              disabled={uploading}
            >
              <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={handleConfirmUpload}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>Upload</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
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
  content: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700',
  },
  uploadBtn: {
    position: 'absolute',
    bottom: 16,
    right: '35%',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
  },
  uid: {
    fontSize: 13,
    marginTop: 4,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginTop: 10,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  card: {
    borderWidth: 1,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    gap: 12,
  },
  menuInfo: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  menuValue: {
    fontSize: 13,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
    paddingVertical: 14,
    marginHorizontal: 16,
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    fontSize: 13,
    marginTop: 24,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 24,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
