'use client';

import React, { useState } from 'react';
import { Plus, X, Edit2 } from 'lucide-react';
import { useMailStore, useMailLabels } from '../store/mailStore';
import type { MailLabel } from '../types';

const LABEL_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#64748b', '#78716c',
];

export default function LabelManager() {
  const labels = useMailLabels();
  const { currentView, currentLabelId, createLabel, updateLabel, deleteLabel, fetchLabelThreads } = useMailStore();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(LABEL_COLORS[5]);

  const customLabels = labels.filter((l) => !l.isSystem);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createLabel(name.trim(), color);
    setName('');
    setColor(LABEL_COLORS[5]);
    setIsCreating(false);
  };

  const handleUpdate = async (labelId: string) => {
    if (!name.trim()) return;
    await updateLabel(labelId, { name: name.trim(), color });
    setEditingId(null);
    setName('');
  };

  const startEdit = (label: MailLabel) => {
    setEditingId(label.id);
    setName(label.name);
    setColor(label.color || LABEL_COLORS[5]);
    setIsCreating(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    setName('');
    setColor(LABEL_COLORS[5]);
  };

  const ColorPicker = ({ selected, onChange }: { selected: string; onChange: (c: string) => void }) => (
    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
      {LABEL_COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className="w-4 h-4 rounded-full transition-transform"
          style={{
            backgroundColor: c,
            outline: selected ===
   c ? '2px solid white' : 'none',
            outlineOffset: '1px',
            boxShadow: selected ===
   c ? `0 0 0 3px ${c}80` : 'none',
            transform: selected ===
   c ? 'scale(1.2)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="py-1">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 mb-1">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Labels
        </span>
        {!isCreating && !editingId && (
          <button
            onClick={() => { setIsCreating(true); setEditingId(null); }}
            className="p-0.5 rounded transition-colors"
            style={{ color: 'rgba(255,255,255,0.5)' }}
            title="Create label"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Label list */}
      {customLabels.map((label) => {
        const isActive = currentView ===
   'label' && currentLabelId ===
   label.id;
        return (
          <div key={label.id} className="group">
            {editingId ===
   label.id ? (
              <div className="px-3 py-1.5 rounded-lg mx-1 mb-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key ===
   'Enter') handleUpdate(label.id);
                    if (e.key ===
   'Escape') cancelEdit();
                  }}
                  className="w-full px-2 py-1 text-xs rounded border bg-transparent text-white placeholder-white/40"
                  style={{ borderColor: 'rgba(255,255,255,0.25)' }}
                  autoFocus
                />
                <ColorPicker selected={color} onChange={setColor} />
                <div className="flex gap-2 mt-1.5">
                  <button onClick={() => handleUpdate(label.id)} className="text-xs font-medium" style={{ color: '#b3cde0' }}>Save</button>
                  <button onClick={cancelEdit} className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fetchLabelThreads(label.id, label.name)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
                style={
                  isActive
                    ? { background: 'rgba(255,255,255,0.15)', color: 'white', backdropFilter: 'blur(4px)' }
                    : { color: 'rgba(255,255,255,0.7)' }
                }
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; }}
                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: label.color || '#6b7280' }} />
                <span className="flex-1 text-left truncate">{label.name}</span>
                <span className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); startEdit(label); }}
                    className="p-0.5 rounded cursor-pointer"
                    style={{ color: 'rgba(255,255,255,0.6)' }}
                  >
                    <Edit2 size={11} />
                  </span>
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); deleteLabel(label.id); }}
                    className="p-0.5 rounded cursor-pointer"
                    style={{ color: '#fca5a5' }}
                  >
                    <X size={11} />
                  </span>
                </span>
              </button>
            )}
          </div>
        );
      })}

      {/* Create form */}
      {isCreating && (
        <div className="px-3 py-1.5 rounded-lg mx-1 mb-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key ===
   'Enter') handleCreate();
              if (e.key ===
   'Escape') cancelEdit();
            }}
            placeholder="Label name..."
            className="w-full px-2 py-1 text-xs rounded border bg-transparent text-white placeholder-white/40"
            style={{ borderColor: 'rgba(255,255,255,0.25)' }}
            autoFocus
          />
          <ColorPicker selected={color} onChange={setColor} />
          <div className="flex gap-2 mt-1.5">
            <button onClick={handleCreate} className="text-xs font-medium" style={{ color: '#b3cde0' }}>Create</button>
            <button onClick={cancelEdit} className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Cancel</button>
          </div>
        </div>
      )}

      {customLabels.length ===
   0 && !isCreating && (
        <p className="px-3 py-1 text-xs italic" style={{ color: 'rgba(255,255,255,0.35)' }}>No labels yet</p>
      )}
    </div>
  );
}