'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  Clock,
  Calendar,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import { useRounds } from '@/features/event-management/hooks/useEvents';
import type { EventRound, RoundFormData, RoundType } from '@/features/event-management/types/event.types';

interface RoundsSectionProps {
  eventId: string;
  eventStartDate: string;
  eventEndDate: string;
  toast: (opts: { type: 'success' | 'error' | 'info'; message: string }) => void;
}

const ROUND_TYPE_OPTIONS: { value: RoundType; label: string; color: string }[] = [
  { value: 'general', label: 'General', color: 'bg-blue-50 text-blue-700 ring-blue-200' },
  { value: 'elimination', label: 'Elimination Round', color: 'bg-amber-50 text-amber-700 ring-amber-200' },
  { value: 'final', label: 'Final Round', color: 'bg-purple-50 text-purple-700 ring-purple-200' },
];

function getRoundStatus(round: EventRound): { label: string; color: string } {
  const now = new Date();
  const start = new Date(round.startTime);
  const end = new Date(round.endTime);
  if (now < start) return { label: 'Upcoming', color: 'bg-sky-50 text-sky-700 ring-sky-200' };
  if (now >= start && now <= end) return { label: 'Ongoing', color: 'bg-red-50 text-red-600 ring-red-200' };
  return { label: 'Completed', color: 'bg-gray-100 text-gray-500 ring-gray-200' };
}

function formatDT(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function toLocalDatetimeValue(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

const emptyForm: RoundFormData = { name: '', description: '', startTime: '', endTime: '', roundType: 'general' };

export default function RoundsSection({ eventId, eventStartDate, eventEndDate, toast }: RoundsSectionProps) {
  const { data: rounds = [], isLoading: loading, refetch, isError, error } = useRounds(eventId);
  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (isError && error) {
      const msg = (error as Error)?.message || 'Failed to load rounds';
      if (lastErrorRef.current !== msg) {
        lastErrorRef.current = msg;
        toast({ type: 'error', message: msg });
      }
    } else {
      lastErrorRef.current = null;
    }
  }, [isError, error, toast]);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoundFormData>({ ...emptyForm });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Round name is required';
    if (!form.startTime) errors.startTime = 'Start time is required';
    if (!form.endTime) errors.endTime = 'End time is required';
    if (form.startTime && form.endTime && new Date(form.startTime) >= new Date(form.endTime)) {
      errors.endTime = 'End time must be after start time';
    }
    if (form.startTime && new Date(form.startTime) < new Date(eventStartDate)) {
      errors.startTime = 'Cannot start before event start';
    }
    if (form.endTime && new Date(form.endTime) > new Date(eventEndDate)) {
      errors.endTime = 'Cannot end after event end';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const checkOverlap = (): EventRound | null => {
    if (!form.startTime || !form.endTime) return null;
    const rStart = new Date(form.startTime);
    const rEnd = new Date(form.endTime);
    for (const existing of rounds) {
      if (editingId && existing.id === editingId) continue;
      const exStart = new Date(existing.startTime);
      const exEnd = new Date(existing.endTime);
      if (rStart < exEnd && rEnd > exStart) return existing;
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const overlapping = checkOverlap();
    if (overlapping) {
      const confirmed = confirm(
        `This round overlaps with "${overlapping.name}". Are you sure you want to add an overlapping round?`
      );
      if (!confirmed) return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await eventService.updateRound(eventId, editingId, form);
        toast({ type: 'success', message: 'Round updated' });
      } else {
        await eventService.createRound(eventId, form);
        toast({ type: 'success', message: 'Round created' });
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ ...emptyForm });
      setFormErrors({});
      refetch();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save round';
      toast({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (round: EventRound) => {
    setForm({
      name: round.name,
      description: round.description || '',
      startTime: toLocalDatetimeValue(round.startTime),
      endTime: toLocalDatetimeValue(round.endTime),
      roundType: (round.roundType as RoundType) || 'general',
    });
    setEditingId(round.id);
    setShowForm(true);
    setFormErrors({});
  };

  const handleDelete = async (round: EventRound) => {
    if (!confirm(`Delete round "${round.name}"?`)) return;
    try {
      await eventService.deleteRound(eventId, round.id);
      toast({ type: 'success', message: 'Round deleted' });
      refetch();
    } catch (err: any) {
      toast({ type: 'error', message: err?.response?.data?.message || 'Failed to delete round' });
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormErrors({});
  };

  const inputClass = 'w-full px-3 py-2.5 text-sm border border-[#b3cde0] rounded-md bg-white text-gray-900 focus:ring-1 focus:ring-[#005b96] focus:border-[#005b96] outline-none';
  const errorInputClass = 'border-red-400 focus:ring-red-400 focus:border-red-400';

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="h-20 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Round cards */}
      {rounds.length > 0 && (
        <div className="space-y-3">
          {rounds.map((round, idx) => {
            const status = getRoundStatus(round);
            const typeInfo = ROUND_TYPE_OPTIONS.find(t => t.value === round.roundType) || ROUND_TYPE_OPTIONS[0];
            return (
              <div
                key={round.id}
                className="group relative rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-[#b3cde0] bg-[#edf4f8] text-[#005b96]">
                      <span className="text-sm font-bold leading-none">{idx + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-bold text-gray-900 truncate">{round.name}</h4>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${status.color}`}>
                          {status.label === 'Ongoing' && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />}
                          {status.label}
                        </span>
                      </div>
                      {round.description && (
                        <p className="mt-1 text-xs text-gray-500 line-clamp-1">{round.description}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {formatDT(round.startTime)}
                        </span>
                        <span className="text-gray-300">→</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {formatDT(round.endTime)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleEdit(round)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                      title="Edit"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(round)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rounds.length === 0 && !showForm && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
          <Clock className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-500">No rounds created yet</p>
          <p className="text-xs text-gray-400">Add rounds to define your event schedule</p>
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="rounded-lg border border-[#b3cde0] bg-[#f8fafc] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-800">
              {editingId ? 'Edit Round' : 'Add New Round'}
            </h4>
            <button onClick={handleCancel} className="rounded-md p-1 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Round Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Preliminary Round"
                className={`${inputClass} ${formErrors.name ? errorInputClass : ''}`}
              />
              {formErrors.name && <p className="mt-0.5 text-[11px] text-red-500">{formErrors.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Round Type</label>
              <select
                value={form.roundType || 'general'}
                onChange={(e) => setForm(f => ({ ...f, roundType: e.target.value as RoundType }))}
                className={inputClass}
              >
                {ROUND_TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => setForm(f => ({ ...f, startTime: e.target.value }))}
                min={toLocalDatetimeValue(eventStartDate)}
                max={toLocalDatetimeValue(eventEndDate)}
                className={`${inputClass} ${formErrors.startTime ? errorInputClass : ''}`}
              />
              {formErrors.startTime && <p className="mt-0.5 text-[11px] text-red-500">{formErrors.startTime}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.endTime}
                onChange={(e) => setForm(f => ({ ...f, endTime: e.target.value }))}
                min={form.startTime || toLocalDatetimeValue(eventStartDate)}
                max={toLocalDatetimeValue(eventEndDate)}
                className={`${inputClass} ${formErrors.endTime ? errorInputClass : ''}`}
              />
              {formErrors.endTime && <p className="mt-0.5 text-[11px] text-red-500">{formErrors.endTime}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
            <textarea
              rows={2}
              value={form.description || ''}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief instructions or description for this round..."
              className={inputClass}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#005b96] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#004a80] disabled:opacity-50 transition"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {editingId ? 'Update Round' : 'Create Round'}
            </button>
            <button
              onClick={handleCancel}
              className="rounded-md border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add round button */}
      {!showForm && (
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...emptyForm }); }}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[#b3cde0] px-3.5 py-2 text-xs font-semibold text-[#005b96] hover:bg-[#edf4f8] transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Round
        </button>
      )}
    </div>
  );
}
