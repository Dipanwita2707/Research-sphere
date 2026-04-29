import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { serverConfig } from '../../../shared/config/serverConfig';

interface Props {
  onConfigured: () => void;
}

export default function ServerSetupScreen({ onConfigured }: Props) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('5001');
  const [testing, setTesting] = useState(false);

  const buildUrl = () => {
    const h = host.trim();
    const p = port.trim() || '5001';
    if (!h) return null;
    if (h.startsWith('http')) return h;
    return `http://${h}:${p}`;
  };

  const handleConnect = async () => {
    const url = buildUrl();
    if (!url) {
      Alert.alert('Missing', 'Please enter the server IP address.');
      return;
    }

    setTesting(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${url}/api/v1/health`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await serverConfig.setServerUrl(url);
      onConfigured();
    } catch (e: any) {
      clearTimeout(timer);
      Alert.alert(
        'Cannot reach server',
        `Could not connect to ${url}\n\nMake sure:\n• Your phone is on the same Wi-Fi\n• The backend is running\n• Port ${port} firewall is open`,
      );
    } finally {
      setTesting(false);
    }
  };

  const handleSkip = async () => {
    const url = buildUrl();
    if (url) {
      await serverConfig.setServerUrl(url);
    }
    onConfigured();
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>SGT Connect</Text>
        <Text style={styles.subtitle}>Enter the server address to get started</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Server IP Address</Text>
          <TextInput
            style={styles.input}
            placeholder="192.168.1.100"
            placeholderTextColor="#64748b"
            value={host}
            onChangeText={setHost}
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Port</Text>
          <TextInput
            style={styles.input}
            placeholder="5001"
            placeholderTextColor="#64748b"
            value={port}
            onChangeText={setPort}
            keyboardType="numeric"
          />

          <Text style={styles.hint}>
            Find the server IP by running{' '}
            <Text style={styles.code}>ipconfig</Text> on the server machine and look for the Wi-Fi IPv4 address.
          </Text>
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleConnect} disabled={testing}>
          {testing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Test &amp; Connect</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} disabled={testing}>
          <Text style={styles.skipText}>Skip (use without testing)</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#f1f5f9', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 32 },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  label: { fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: '600', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 12,
    color: '#f1f5f9',
    fontSize: 16,
  },
  hint: { marginTop: 16, fontSize: 12, color: '#64748b', lineHeight: 18 },
  code: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#6366f1' },
  btn: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  skipBtn: { alignItems: 'center', padding: 12 },
  skipText: { color: '#475569', fontSize: 13 },
});
