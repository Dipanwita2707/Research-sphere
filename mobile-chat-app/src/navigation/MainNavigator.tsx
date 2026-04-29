import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useChatAuthStore } from '../shared/state/chatAuthStore';
import { useTheme } from '../shared/hooks/useTheme';

import ChatListScreen from '../features/chat/screens/ChatListScreen';
import GroupConversationScreen from '../features/chat/screens/GroupConversationScreen';
import DMConversationScreen from '../features/chat/screens/DMConversationScreen';
import NewChatScreen from '../features/chat/screens/NewChatScreen';
import NewGroupScreen from '../features/chat/screens/NewGroupScreen';
import GroupInfoScreen from '../features/chat/screens/GroupInfoScreen';
import GroupSettingsScreen from '../features/chat/screens/GroupSettingsScreen';
import MemberPermissionsScreen from '../features/chat/screens/MemberPermissionsScreen';
import MessageSearchScreen from '../features/chat/screens/MessageSearchScreen';

import AdminDashboardScreen from '../features/admin/screens/AdminDashboardScreen';
import UserPermissionsScreen from '../features/admin/screens/UserPermissionsScreen';
import UserPermissionDetailScreen from '../features/admin/screens/UserPermissionDetailScreen';
import GroupManagementScreen from '../features/admin/screens/GroupManagementScreen';
import GroupDetailAdminScreen from '../features/admin/screens/GroupDetailAdminScreen';

import ProfileScreen from '../features/profile/screens/ProfileScreen';
import SessionsScreen from '../features/profile/screens/SessionsScreen';

import type {
  ChatsStackParamList,
  AdminStackParamList,
  ProfileStackParamList,
} from '../types/chat.types';

// --- Chat Stack ---
const ChatsStack = createNativeStackNavigator<ChatsStackParamList>();

function ChatsNavigator() {
  const { colors } = useTheme();
  return (
    <ChatsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <ChatsStack.Screen name="ChatList" component={ChatListScreen} options={{ title: 'SGT Connect' }} />
      <ChatsStack.Screen
        name="GroupConversation"
        component={GroupConversationScreen}
        options={({ route }) => ({ title: route.params.groupName })}
      />
      <ChatsStack.Screen
        name="DMConversation"
        component={DMConversationScreen}
        options={({ route }) => ({ title: route.params.userName })}
      />
      <ChatsStack.Screen name="GroupInfo" component={GroupInfoScreen} options={{ title: 'Group Info' }} />
      <ChatsStack.Screen
        name="GroupSettings"
        component={GroupSettingsScreen}
        options={({ route }) => ({ title: route.params.groupName + ' Settings' })}
      />
      <ChatsStack.Screen
        name="MemberPermissions"
        component={MemberPermissionsScreen}
        options={({ route }) => ({ title: route.params.userName })}
      />
      <ChatsStack.Screen
        name="MessageSearch"
        component={MessageSearchScreen}
        options={({ route }) => ({ title: 'Search in ' + route.params.groupName })}
      />
      <ChatsStack.Screen name="NewChat" component={NewChatScreen} options={{ title: 'New Message' }} />
      <ChatsStack.Screen name="NewGroup" component={NewGroupScreen} options={{ title: 'New Group' }} />
    </ChatsStack.Navigator>
  );
}

// --- Admin Stack ---
const AdminStack = createNativeStackNavigator<AdminStackParamList>();

function AdminNavigator() {
  const { colors } = useTheme();
  return (
    <AdminStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <AdminStack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Admin Panel' }} />
      <AdminStack.Screen name="UserPermissions" component={UserPermissionsScreen} options={{ title: 'User Permissions' }} />
      <AdminStack.Screen
        name="UserPermissionDetail"
        component={UserPermissionDetailScreen}
        options={({ route }) => ({ title: route.params.userName })}
      />
      <AdminStack.Screen name="GroupManagement" component={GroupManagementScreen} options={{ title: 'Group Management' }} />
      <AdminStack.Screen
        name="GroupDetailAdmin"
        component={GroupDetailAdminScreen}
        options={({ route }) => ({ title: route.params.groupName })}
      />
    </AdminStack.Navigator>
  );
}

// --- Profile Stack ---
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function ProfileNavigator() {
  const { colors } = useTheme();
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <ProfileStack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      <ProfileStack.Screen name="Sessions" component={SessionsScreen} options={{ title: 'Active Sessions' }} />
    </ProfileStack.Navigator>
  );
}

// --- Bottom Tab ---
const Tab = createBottomTabNavigator();

export default function MainNavigator() {
  const chatUser = useChatAuthStore((s) => s.chatUser);
  const isAdmin = chatUser?.role === 'admin' || chatUser?.role === 'superadmin';
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.tabBg, borderTopColor: colors.tabBorder },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
      }}
    >
      <Tab.Screen
        name="ChatsTab"
        component={ChatsNavigator}
        options={{
          tabBarLabel: 'Chats',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
        }}
      />
      {isAdmin && (
        <Tab.Screen
          name="AdminTab"
          component={AdminNavigator}
          options={{
            tabBarLabel: 'Admin',
            tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark" size={size} color={color} />,
          }}
        />
      )}
      <Tab.Screen
        name="ProfileTab"
        component={ProfileNavigator}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
