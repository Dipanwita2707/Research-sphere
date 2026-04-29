'use client';

/**
 * Chat Page
 * Main page for the chat feature
 * Bootstraps chat auth session before rendering chat layout.
 */
import { useEffect, useState } from 'react';
import { ChatLayout } from '@/features/chat';
import { useChatAuthStore } from '@/shared/auth/chatAuthStore';
import { useAuthStore } from '@/shared/auth/authStore';

export default function ChatPage() {
  const { isAuthenticated: chatReady, bootstrap, exchangeForChatToken, clearChat } = useChatAuthStore();
  const { user, token } = useAuthStore();
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const initialState = useChatAuthStore.getState();

        // Persisted chat auth can belong to a previous UMS user. Clear it before bootstrapping
        // so chat permission checks run against the current signed-in account.
        if (user && initialState.chatUser && initialState.chatUser.id !== user.id) {
          clearChat();
        }

        // Try bootstrapping from persisted refresh token first
        await bootstrap();

        // If still not authenticated but UMS session is active, use token exchange
        const state = useChatAuthStore.getState();
        if (!state.isAuthenticated && user && token) {
          await exchangeForChatToken(token);
        }
      } catch (err) {
        console.error('Chat bootstrap error:', err);
      } finally {
        setBootstrapping(false);
      }
    };
    init();
  }, [bootstrap, clearChat, user, token, exchangeForChatToken]);

  if (bootstrapping) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Initializing chat...</div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <ChatLayout />
    </div>
  );
}
