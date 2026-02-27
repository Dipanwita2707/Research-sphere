'use client';

import React from 'react';
import {
  Inbox,
  Send,
  Star,
  Trash2,
  FileText,
  PenSquare,
  Search,
} from 'lucide-react';
import { useMailStore, useMailCounts } from '../store/mailStore';
import LabelManager from './LabelManager';
import type { MailView } from '../types';

interface NavItem {
  view: MailView;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

export default function Sidebar() {
  const { currentView, setCurrentView, openCompose, fetchLabels } = useMailStore();
  const counts = useMailCounts();
  const inboxTotal = useMailStore((s) => s.inboxPagination.total);

  React.useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  const navItems: NavItem[] = [
    { view: 'inbox',   label: 'Inbox',   icon: <Inbox size={17} />,   count: inboxTotal > 0 ? inboxTotal : counts.unreadCount },
    { view: 'sent',    label: 'Sent',    icon: <Send size={17} /> },
    { view: 'starred', label: 'Starred', icon: <Star size={17} />,    count: counts.starredCount },
    { view: 'drafts',  label: 'Drafts',  icon: <FileText size={17} />, count: counts.draftCount },
    { view: 'trash',   label: 'Trash',   icon: <Trash2 size={17} />,   count: counts.trashCount },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: 'linear-gradient(180deg, #011f4b 0%, #03396c 100%)' }}>
      {/* Logo / Brand area */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#005b96' }}>
            <Inbox size={16} className="text-white" />
          </div>
          <span className="text-white font-semibold text-sm tracking-wide">SGT Mail</span>
        </div>

        {/* Compose button */}
        <button
          onClick={() => openCompose('new')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 active:scale-95"
          style={{ background: '#005b96', color: 'white', boxShadow: '0 2px 8px rgba(0,91,150,0.4)' }}
        >
          <PenSquare size={16} />
          <span>Compose</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
              style={
                isActive
                  ? { background: 'rgba(255,255,255,0.15)', color: 'white', backdropFilter: 'blur(4px)' }
                  : { color: 'rgba(255,255,255,0.7)' }
              }
              onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <span style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.6)' }}>
                {item.icon}
              </span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.count !== undefined && item.count > 0 && (
                <span
                  className="text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center"
                  style={
                    isActive
                      ? { background: 'white', color: '#011f4b' }
                      : { background: 'rgba(255,255,255,0.2)', color: 'white' }
                  }
                >
                  {item.count > 99 ? '99+' : item.count}
                </span>
              )}
            </button>
          );
        })}

        {/* Divider */}
        <div className="my-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }} />

        {/* Labels */}
        <LabelManager />
      </nav>

      {/* Search shortcut */}
      <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <button
          onClick={() => setCurrentView('search')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150"
          style={
            currentView === 'search'
              ? { background: 'rgba(255,255,255,0.15)', color: 'white' }
              : { color: 'rgba(255,255,255,0.6)' }
          }
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; }}
          onMouseLeave={(e) => { if (currentView !== 'search') (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          <Search size={15} />
          <span>Search mail</span>
        </button>
      </div>
    </div>
  );
}

