'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Users, Building2, School, User, Layers } from 'lucide-react';
import type { MailRecipientOption, RecipientSearchType } from '../types';
import * as mailService from '../services/mail.service';

interface MailGroup {
  id: string;
  uid: string;
  displayName: string;
  displayLabel: string;
  code?: string;
  schoolName?: string;
  schoolId?: string | null;
  type: RecipientSearchType;
}

interface AllGroups {
  centralDepts: MailGroup[];
  schools: MailGroup[];
  departments: MailGroup[];
}

interface RecipientSelectorProps {
  label: string;
  recipients: MailRecipientOption[];
  onChange: (recipients: MailRecipientOption[]) => void;
  placeholder?: string;
  allowGroups?: boolean;
  disabled?: boolean;
}

export default function RecipientSelector({
  label,
  recipients,
  onChange,
  placeholder = 'Type 3+ characters to search...',
  allowGroups = false,
  disabled = false,
}: RecipientSelectorProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<MailRecipientOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showGroupPanel, setShowGroupPanel] = useState(false);
  const [groupTab, setGroupTab] = useState<'central' | 'schools' | 'departments'>('central');
  const [allGroups, setAllGroups] = useState<AllGroups | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedDeptSchoolId, setSelectedDeptSchoolId] = useState<string | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const groupPanelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inDropdown = dropdownRef.current?.contains(target);
      const inInput = inputRef.current?.contains(target);
      const inGroupPanel = groupPanelRef.current?.contains(target);
      if (!inDropdown && !inInput && !inGroupPanel) {
        setShowDropdown(false);
        setShowGroupPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load groups lazily when panel opens
  const loadGroups = useCallback(async () => {
    if (allGroups || loadingGroups) return;
    setLoadingGroups(true);
    try {
      const res = await mailService.getMailGroups();
      const data = (res as any)?.data || res;
      setAllGroups(data);
    } catch { /* ignore */ }
    finally { setLoadingGroups(false); }
  }, [allGroups, loadingGroups]);

  // Debounced search
  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      setHighlightIndex(-1);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (value.length < 3) { setSuggestions([]); setShowDropdown(false); return; }
      debounceRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const res = await mailService.searchUsersForMail(value, allowGroups);
          const data = (res as any)?.data || res;
          const results = Array.isArray(data) ? data : [];
          const existing = new Set(recipients.map((r) => r.id));
          setSuggestions(results.filter((r: MailRecipientOption) => !existing.has(r.id)));
          setShowDropdown(true);
        } catch { setSuggestions([]); }
        finally { setIsSearching(false); }
      }, 300);
    },
    [recipients, allowGroups]
  );

  const addRecipient = (option: MailRecipientOption | MailGroup) => {
    const rec: MailRecipientOption = {
      id: option.id,
      uid: option.uid,
      displayName: option.displayName,
      displayLabel: option.displayLabel,
      email: option.uid,
      type: option.type,
    };
    if (!recipients.find((r) => r.id ===
   rec.id)) onChange([...recipients, rec]);
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const removeRecipient = (id: string) => onChange(recipients.filter((r) => r.id !== id));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key ===
   'Backspace' && query ===
   '' && recipients.length > 0) {
      removeRecipient(recipients[recipients.length - 1].id); return;
    }
    if (!showDropdown || suggestions.length ===
   0) return;
    if (e.key ===
   'ArrowDown') { e.preventDefault(); setHighlightIndex((i) => (i + 1) % suggestions.length); }
    else if (e.key ===
   'ArrowUp') { e.preventDefault(); setHighlightIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1)); }
    else if (e.key ===
   'Enter' && highlightIndex >= 0) { e.preventDefault(); addRecipient(suggestions[highlightIndex]); }
    else if (e.key ===
   'Escape') { setShowDropdown(false); setShowGroupPanel(false); }
  };

  const getTypeIcon = (type: RecipientSearchType, size = 14) => {
    switch (type) {
      case 'central_department': case 'centralDepartment':
        return <Building2 size={size} style={{ color: '#7c3aed' }} />;
      case 'school':
        return <School size={size} style={{ color: '#005b96' }} />;
      case 'department':
        return <Users size={size} style={{ color: '#059669' }} />;
      default:
        return <User size={size} style={{ color: '#6b7280' }} />;
    }
  };

  const chipStyle = (type: RecipientSearchType): React.CSSProperties => {
    switch (type) {
      case 'central_department': case 'centralDepartment':
        return { background: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd' };
      case 'school':
        return { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' };
      case 'department':
        return { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' };
      default:
        return { background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' };
    }
  };

  return (
    <div className="relative">
      {/* Label row */}
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium" style={{ color: '#6497b1' }}>{label}</label>
        {allowGroups && (
          <button
            type="button"
            onClick={() => {
              setShowGroupPanel((v) => !v);
              setShowDropdown(false);
              if (!allGroups) loadGroups();
            }}
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-colors"
            style={{
              background: showGroupPanel ? '#e8f0fe' : 'transparent',
              color: showGroupPanel ? '#005b96' : '#6497b1',
              border: '1px solid #b3cde0',
            }}
            title="Browse departments, schools, and central departments"
          >
            <Layers size={11} />
            Browse Groups
          </button>
        )}
      </div>

      {/* Input box */}
      <div
        className="flex flex-wrap items-center gap-1 px-2 py-1.5 rounded-lg"
        style={{
          border: '1px solid #b3cde0',
          background: disabled ? '#f8fafc' : '#fff',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {recipients.map((r) => (
          <span
            key={r.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={chipStyle(r.type)}
          >
            {getTypeIcon(r.type, 11)}
            <span className="max-w-[150px] truncate">{r.displayLabel}</span>
            {!disabled && (
              <button type="button" onClick={() => removeRecipient(r.id)} className="ml-0.5 hover:opacity-60">
                <X size={11} />
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          placeholder={recipients.length ===
   0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
          style={{ color: '#011f4b' }}
        />
        {isSearching && (
          <div className="animate-spin w-3.5 h-3.5 border-2 rounded-full"
            style={{ borderColor: '#b3cde0', borderTopColor: '#005b96' }} />
        )}
      </div>

      {/* Typeahead dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          style={{ background: '#fff', border: '1px solid #b3cde0' }}
        >
          {suggestions.map((option, i) => (
            <button
              key={option.id}
              type="button"
              onClick={() => addRecipient(option)}
              className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
              style={{ background: i ===
   highlightIndex ? '#e8f0fe' : 'transparent' }}
              onMouseEnter={(e) => { if (i !== highlightIndex) (e.currentTarget as HTMLButtonElement).style.background = '#f0f4f8'; }}
              onMouseLeave={(e) => { if (i !== highlightIndex) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <div className="flex-shrink-0">{getTypeIcon(option.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: '#011f4b' }}>
                  {option.displayLabel || option.displayName}
                </div>
                <div className="text-xs truncate" style={{ color: '#6497b1' }}>
                  {option.type !== 'user'
                    ? '📣 Group — every member will receive this mail'
                    : option.email || `${option.uid}@ums.sgtu`}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Group browse panel */}
      {showGroupPanel && allowGroups && (
        <div
          ref={groupPanelRef}
          className="absolute z-50 w-full mt-1 rounded-xl shadow-2xl"
          style={{ background: '#fff', border: '1px solid #b3cde0', minWidth: '320px' }}
        >
          {/* Panel header */}
          <div className="px-4 py-3 rounded-t-xl" style={{ background: '#011f4b' }}>
            <p className="text-sm font-semibold text-white">Send to Group / Department</p>
            <p className="text-xs mt-0.5" style={{ color: '#b3cde0' }}>
              Mail is delivered to every individual in the selected group
            </p>
          </div>

          {/* Tabs */}
          <div className="flex" style={{ borderBottom: '1px solid #e2e8f0' }}>
            {[
              { key: 'central', label: 'Central Depts', icon: <Building2 size={12} /> },
              { key: 'schools', label: 'Schools', icon: <School size={12} /> },
              { key: 'departments', label: 'Departments', icon: <Users size={12} /> },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setGroupTab(tab.key as typeof groupTab)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors"
                style={{
                  color: groupTab ===
   tab.key ? '#005b96' : '#6497b1',
                  borderBottom: groupTab ===
   tab.key ? '2px solid #005b96' : '2px solid transparent',
                }}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="max-h-56 overflow-y-auto py-1">
            {loadingGroups && (
              <div className="flex items-center justify-center py-6 gap-2" style={{ color: '#6497b1' }}>
                <div className="animate-spin w-4 h-4 border-2 rounded-full"
                  style={{ borderColor: '#b3cde0', borderTopColor: '#005b96' }} />
                <span className="text-xs">Loading groups...</span>
              </div>
            )}

            {!loadingGroups && groupTab ===
   'central' && (
              (allGroups?.centralDepts || []).length ===
   0
                ? <p className="px-4 py-3 text-xs text-center" style={{ color: '#6497b1' }}>No central departments found</p>
                : (allGroups?.centralDepts || []).map((g) => (
                    <GroupRow key={g.id} group={g} icon={getTypeIcon('central_department')} onAdd={addRecipient} recipients={recipients} />
                  ))
            )}

            {!loadingGroups && groupTab ===
   'schools' && (
              (allGroups?.schools || []).length ===
   0
                ? <p className="px-4 py-3 text-xs text-center" style={{ color: '#6497b1' }}>No schools found</p>
                : (allGroups?.schools || []).map((school) => (
                    <GroupRow
                      key={school.id}
                      group={school}
                      icon={getTypeIcon('school')}
                      onAdd={addRecipient}
                      recipients={recipients}
                      subtitle={`All staff & faculty · ${school.code || ''}`}
                    />
                  ))
            )}

            {!loadingGroups && groupTab ===
   'departments' && (() => {
              const allDepts = allGroups?.departments || [];
              if (allDepts.length ===
   0) return (
                <p className="px-4 py-3 text-xs text-center" style={{ color: '#6497b1' }}>No departments found</p>
              );
              // Schools that actually have departments
              const schoolsWithDepts = (allGroups?.schools || []).filter(
                (s) => allDepts.some((d) => d.schoolId ===
   s.id)
              );
              const filteredDepts = selectedDeptSchoolId
                ? allDepts.filter((d) => d.schoolId ===
   selectedDeptSchoolId)
                : [];
              return (
                <>
                  {/* Step 1 — pick a school */}
                  <div className="px-3 pt-2 pb-2" style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: '#6497b1' }}>1. Select School</p>
                    <div className="flex flex-wrap gap-1.5">
                      {schoolsWithDepts.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSelectedDeptSchoolId(
                            selectedDeptSchoolId ===
   s.id ? null : s.id
                          )}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                          style={selectedDeptSchoolId ===
   s.id
                            ? { background: '#005b96', color: '#fff', border: '1px solid #005b96' }
                            : { background: '#f0f4f8', color: '#011f4b', border: '1px solid #b3cde0' }
                          }
                        >
                          <School size={10} />
                          {s.displayName}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Step 2 — departments for selected school */}
                  <div className="pt-1">
                    {!selectedDeptSchoolId && (
                      <p className="px-4 py-4 text-xs text-center" style={{ color: '#6497b1' }}>
                        ☝️ Select a school above to see its departments
                      </p>
                    )}
                    {selectedDeptSchoolId && filteredDepts.length ===
   0 && (
                      <p className="px-4 py-3 text-xs text-center" style={{ color: '#6497b1' }}>
                        No departments found in this school
                      </p>
                    )}
                    {filteredDepts.map((g) => (
                      <GroupRow
                        key={g.id}
                        group={g}
                        icon={getTypeIcon('department')}
                        onAdd={addRecipient}
                        recipients={recipients}
                      />
                    ))}
                  </div>
                </>
              );
            })()}
          </div>

          <div className="px-3 py-2 rounded-b-xl" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <p className="text-xs" style={{ color: '#6497b1' }}>
              💡 Each group expands to all its individual members on send
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper row ──────────────────────────────────────────────────────────────
function GroupRow({
  group,
  icon,
  onAdd,
  recipients,
  indent = false,
  subtitle,
}: {
  group: MailGroup;
  icon: React.ReactNode;
  onAdd: (g: MailGroup) => void;
  recipients: MailRecipientOption[];
  indent?: boolean;
  subtitle?: string;
}) {
  const isAdded = recipients.some((r) => r.id ===
   group.id);
  return (
    <button
      type="button"
      onClick={() => !isAdded && onAdd(group)}
      disabled={isAdded}
      className="w-full flex items-center gap-2 py-2 text-left transition-colors"
      style={{
        paddingLeft: indent ? '2.25rem' : '0.75rem',
        paddingRight: '0.75rem',
        background: isAdded ? '#f0f9ff' : 'transparent',
        cursor: isAdded ? 'default' : 'pointer',
      }}
      onMouseEnter={(e) => { if (!isAdded) (e.currentTarget as HTMLButtonElement).style.background = '#f0f4f8'; }}
      onMouseLeave={(e) => { if (!isAdded) (e.currentTarget as HTMLButtonElement).style.background = isAdded ? '#f0f9ff' : 'transparent'; }}
    >
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate" style={{ color: isAdded ? '#6497b1' : '#011f4b' }}>{group.displayName}</div>
        {subtitle && <div className="text-xs truncate" style={{ color: '#6497b1' }}>{subtitle}</div>}
      </div>
      {isAdded
        ? <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#dbeafe', color: '#1e40af' }}>Added</span>
        : <span className="text-xs" style={{ color: '#b3cde0' }}>+ Add</span>
      }
    </button>
  );
}
