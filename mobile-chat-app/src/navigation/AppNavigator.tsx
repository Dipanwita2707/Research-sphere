import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useChatAuthStore } from '../shared/state/chatAuthStore';
import { serverConfig } from '../shared/config/serverConfig';
import { updateBaseUrl } from '../shared/api/chatApi';
import { useTheme } from '../shared/hooks/useTheme';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import ServerSetupScreen from '../features/setup/screens/ServerSetupScreen';
import type { RootStackParamList } from '../types/chat.types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const isAuthenticated = useChatAuthStore((s) => s.isAuthenticated);
  const isLoading = useChatAuthStore((s) => s.isLoading);
  const bootstrap = useChatAuthStore((s) => s.bootstrap);
  const { colors, isDark } = useTheme();

  // null = checking, false = not set, true = configured
  const [serverReady, setServerReady] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const url = await serverConfig.getServerUrl();
      if (url) {
        // Apply saved URL to axios + socket before anything else
        updateBaseUrl(url + '/api/v1');
        const { updateSocketUrl } = require('../shared/socket/useSocket');
        updateSocketUrl(url);
      }
      setServerReady(!!url);
    })();
  }, []);

  useEffect(() => {
    if (serverReady) bootstrap();
  }, [serverReady]);

  if (serverReady === null || (serverReady && isLoading)) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!serverReady) {
    return <ServerSetupScreen onConfigured={() => { setServerReady(true); bootstrap(); }} />;
  }

  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        dark: isDark,
        colors: {
          ...DefaultTheme.colors,
          primary: colors.primary,
          background: colors.bg,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
          notification: colors.primary,
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
