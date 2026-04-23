import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useChatAuthStore } from '../../../shared/state/chatAuthStore';

export default function LoginScreen() {
  const [uid, setUid] = useState('');
  const [password, setPassword] = useState('');
  const loginChat = useChatAuthStore((s) => s.loginChat);
  const isLoading = useChatAuthStore((s) => s.isLoading);
  const error = useChatAuthStore((s) => s.error);

  const handleLogin = async () => {
    if (!uid.trim() || !password.trim()) return;
    try {
      await loginChat(uid.trim(), password.trim());
    } catch {
      // error is set in store
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <View style={styles.branding}>
          <Text style={styles.logo}>💬</Text>
          <Text style={styles.title}>SGT Connect</Text>
          <Text style={styles.subtitle}>Chat securely with your campus</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="UID or Email"
            placeholderTextColor="#64748b"
            value={uid}
            onChangeText={setUid}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
            onSubmitEditing={handleLogin}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Use your UMS credentials to sign in</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  branding: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 64,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#334155',
  },
  error: {
    color: '#f87171',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 32,
  },
});
