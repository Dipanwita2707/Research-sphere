'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, User, LogOut, ChevronDown, ChevronRight } from 'lucide-react';
import { MenuItem, SubMenuItem } from './types';

interface MobileMenuProps {
  menuItems: MenuItem[];
  unreadCount: number;
  pathname: string;
  onClose: () => void;
  onLogout: () => void;
}

function MobileSubItem({ item, onClose }: { item: SubMenuItem; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);

  if (item.href) {
    return (
      <Link href={item.href} onClick={onClose} className="flex items-center gap-2 px-6 py-2.5 text-white/80 hover:text-white hover:bg-white/10 text-sm transition-all">
        {item.name}
      </Link>
    );
  }

  if (item.children) {
    return (
      <>
        <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between px-6 py-2.5 text-white/80 hover:text-white hover:bg-white/10 text-sm transition-all">
          <span>{item.name}</span>
          <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
        {expanded && (
          <div className="bg-black/10">
            {item.children.map(child =>
              child.href ? (
                <Link key={child.name} href={child.href} onClick={onClose} className="flex items-center gap-2 px-8 py-2 text-white/70 hover:text-white hover:bg-white/10 text-xs transition-all">
                  {child.name}
                </Link>
              ) : child.children ? (
                <div key={child.name}>
                  <div className="px-8 py-2 text-white/60 text-xs font-medium">{child.name}</div>
                  {child.children.map(gc => gc.href && (
                    <Link key={gc.name} href={gc.href} onClick={onClose} className="flex items-center gap-2 px-10 py-2 text-white/70 hover:text-white hover:bg-white/10 text-xs transition-all">
                      {gc.name}
                    </Link>
                  ))}
                </div>
              ) : null
            )}
          </div>
        )}
      </>
    );
  }

  return null;
}

export function MobileMenu({ menuItems, unreadCount, pathname, onClose, onLogout }: MobileMenuProps) {
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  return (
    <>
      {/* Overlay */}
      <div className="lg:hidden fixed inset-0 bg-black/50 z-40 top-14" onClick={onClose} />

      {/* Drawer */}
      <div
        className="lg:hidden fixed left-0 top-14 bottom-0 w-[280px] z-50 overflow-y-auto"
        style={{ background: 'linear-gradient(180deg, #005b96 0%, #003d6b 100%)' }}
      >
        <Link href="/dashboard" onClick={onClose} className={`flex items-center gap-3 px-4 py-3 mx-2 mt-2 rounded-lg transition-all ${pathname === '/dashboard' ? 'bg-white/20 text-white' : 'text-white/90 hover:bg-white/10'}`}>
          <span className="font-medium">Dashboard</span>
        </Link>

        {menuItems.map(item => (
          <div key={item.name} className="border-t border-white/10">
            <button onClick={() => setExpandedMenu(expandedMenu === item.name ? null : item.name)} className="w-full flex items-center justify-between px-4 py-3 text-white/90 hover:bg-white/10 transition-all">
              <span className="font-medium text-sm">{item.name}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${expandedMenu === item.name ? 'rotate-180' : ''}`} />
            </button>
            {expandedMenu === item.name && item.subItems && (
              <div className="bg-black/10 pb-2">
                {item.subItems.map(subItem => (
                  <MobileSubItem key={subItem.name} item={subItem} onClose={onClose} />
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Quick Actions */}
        <div className="border-t border-white/10 mt-4 pt-4 px-4 space-y-2">
          <Link href="/notifications" onClick={onClose} className="flex items-center gap-3 px-3 py-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-sm transition-all">
            <Bell className="w-4 h-4" />
            <span>Notifications</span>
            {unreadCount > 0 && <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount}</span>}
          </Link>
          <Link href="/settings" onClick={onClose} className="flex items-center gap-3 px-3 py-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-sm transition-all">
            <User className="w-4 h-4" />
            <span>Profile Settings</span>
          </Link>
          <button onClick={() => { onLogout(); onClose(); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-red-300 hover:text-red-200 hover:bg-red-500/20 rounded-lg text-sm transition-all">
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
}
