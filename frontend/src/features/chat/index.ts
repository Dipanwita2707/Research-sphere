'use client';

/**
 * Chat Feature Module
 * Exports all chat-related components, hooks, and services
 */

// Components
export * from './components';

// Hooks
export { useSocket } from './hooks/useSocket';
export { useChatStore } from './store/chatStore';

// Services
export * from './services/chat.service';

// Types
export * from './types';
