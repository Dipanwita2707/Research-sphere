'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SubMenuItem, MenuItem } from './types';

interface NavDropdownProps {
  item: MenuItem;
  onClose: () => void;
}

function MenuItemCard({ subItem, onDrillDown, onClose }: {
  subItem: SubMenuItem;
  onDrillDown: (name: string) => void;
  onClose: () => void;
}) {
  const isComingSoon = subItem.href ===
   '#' || subItem.description?.includes('Coming Soon');

  if (isComingSoon && !subItem.children) {
    return (
      <div className="group flex items-center justify-between py-2.5 px-3 rounded-lg bg-gray-50 cursor-not-allowed opacity-60">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-400 truncate flex items-center gap-2">
            {subItem.name}
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Coming Soon</span>
          </div>
          {subItem.description && <div className="text-xs text-gray-400 mt-0.5 truncate">{subItem.description}</div>}
        </div>
      </div>
    );
  }

  const chevron = (
    <div className="ml-3 flex-shrink-0">
      <svg className="w-4 h-4 text-[#005b96]/60 group-hover:text-[#005b96] group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );

  if (subItem.children) {
    return (
      <button onClick={() => onDrillDown(subItem.name)} className="group flex items-center justify-between py-2.5 px-3 rounded-lg transition-all duration-200 hover:bg-[#005b96]/10 text-left w-full">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[#005b96] group-hover:text-[#003d66] transition-colors truncate">{subItem.name}</div>
          {subItem.description && <div className="text-xs text-[#005b96]/70 mt-0.5 truncate">{subItem.description}</div>}
        </div>
        {chevron}
      </button>
    );
  }

  if (!subItem.href) return null;

  return (
    <Link href={subItem.href} onClick={onClose} className="group flex items-center justify-between py-2.5 px-3 rounded-lg transition-all duration-200 hover:bg-[#005b96]/10">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[#005b96] group-hover:text-[#003d66] transition-colors truncate">{subItem.name}</div>
        {subItem.description && <div className="text-xs text-[#005b96]/70 mt-0.5 truncate">{subItem.description}</div>}
      </div>
      {chevron}
    </Link>
  );
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="mb-3">
      <button onClick={onClick} className="flex items-center gap-2 text-[#005b96] hover:text-[#003d66] font-medium transition-colors text-sm">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {label}
      </button>
    </div>
  );
}

export function NavDropdown({ item, onClose }: NavDropdownProps) {
  const [level2, setLevel2] = useState<string | null>(null);
  const [level3, setLevel3] = useState<string | null>(null);
  const [level4, setLevel4] = useState<string | null>(null);

  const resetAndClose = () => { setLevel2(null); setLevel3(null); setLevel4(null); onClose(); };

  const level2Items = item.subItems ?? [];
  const level3Items = level2Items.find(s => s.name ===
   level2)?.children ?? [];
  const level4Items = level3Items.find(s => s.name ===
   level3)?.children ?? [];
  const level5Items = level4Items.find(s => s.name ===
   level4)?.children ?? [];

  return (
    <div
      className="fixed left-0 right-0 mt-2 shadow-2xl border-t border-gray-200 z-50 max-h-[80vh] overflow-y-auto"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.92) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px 0 rgba(0,69,120,0.15)',
      }}
      onMouseLeave={resetAndClose}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 relative">
        {/* Level 1 */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 transition-all duration-300 ${level2 ? 'invisible pointer-events-none' : 'visible'}`}>
          {level2Items.map(subItem => (
            <MenuItemCard key={subItem.name} subItem={subItem} onDrillDown={setLevel2} onClose={resetAndClose} />
          ))}
        </div>

        {/* Level 2 */}
        {level2 && !level3 && (
          <div className="absolute inset-0 px-6 py-4 bg-white/95" style={{ backdropFilter: 'blur(12px)' }}>
            <BackButton label="Back" onClick={() => setLevel2(null)} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {level3Items.map(child => (
                <MenuItemCard key={child.name} subItem={child} onDrillDown={setLevel3} onClose={resetAndClose} />
              ))}
            </div>
          </div>
        )}

        {/* Level 3 */}
        {level2 && level3 && !level4 && (
          <div className="absolute inset-0 px-6 py-4 bg-white/95" style={{ backdropFilter: 'blur(12px)' }}>
            <BackButton label={`Back to ${level2}`} onClick={() => setLevel3(null)} />
            <div className="mb-3 pb-2 border-b border-gray-200">
              <h3 className="text-lg font-bold text-[#005b96]">{level3}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {level4Items.map(child => (
                <MenuItemCard key={child.name} subItem={child} onDrillDown={setLevel4} onClose={resetAndClose} />
              ))}
            </div>
          </div>
        )}

        {/* Level 4 */}
        {level2 && level3 && level4 && (
          <div className="absolute inset-0 px-6 py-4 bg-white/95" style={{ backdropFilter: 'blur(12px)' }}>
            <BackButton label={`Back to ${level3}`} onClick={() => setLevel4(null)} />
            <div className="mb-3 pb-2 border-b border-gray-200">
              <h3 className="text-lg font-bold text-[#005b96]">{level4}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {level5Items.map(child => (
                <MenuItemCard key={child.name} subItem={child} onDrillDown={() => {}} onClose={resetAndClose} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
