'use client';

import React, { useEffect } from 'react';
import { useMailStore } from '../store/mailStore';
import Sidebar from './Sidebar';
import ThreadList from './ThreadList';
import DraftList from './DraftList';
import ConversationView from './ConversationView';
import ComposeModal from './ComposeModal';

export default function MailLayout() {
  const { currentView, fetchCounts, currentThreadId } = useMailStore();

  // Initial data load
  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const renderMiddlePanel = () => {
    if (currentView ===
   'drafts') {
      return <DraftList />;
    }
    return <ThreadList />;
  };

  return (
    <div className="flex h-full" style={{ background: '#f8fafc' }}>
      {/* Sidebar - fixed width */}
      <div className="w-56 xl:w-64 flex-shrink-0 hidden md:block">
        <Sidebar />
      </div>

      {/* Thread list / Drafts - responsive width */}
      <div
        className={`flex-shrink-0 overflow-hidden border-r ${
          currentThreadId
            ? 'hidden lg:block w-80 xl:w-96'
            : 'w-full lg:w-80 xl:w-96'
        }`}
        style={{ borderColor: '#e2e8f0' }}
      >
        {renderMiddlePanel()}
      </div>

      {/* Conversation / Empty state - fills remaining space */}
      <div
        className={`flex-1 min-w-0 overflow-hidden
          ${currentThreadId
            ? 'block'
            : 'hidden lg:block'
          }`}
      >
        <ConversationView />
      </div>

      {/* Mobile sidebar overlay */}
      <MobileSidebar />

      {/* Compose modal */}
      <ComposeModal />
    </div>
  );
}

function MobileSidebar() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      {/* Mobile menu trigger - shown at top */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-3 left-3 z-30 md:hidden p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700"
      >
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-gray-900 shadow-xl">
            <Sidebar />
          </div>
        </div>
      )}
    </>
  );
}
