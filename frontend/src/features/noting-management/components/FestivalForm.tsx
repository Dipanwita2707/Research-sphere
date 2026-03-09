'use client';

import React, { useState } from 'react';
import { Plus, Trash2, ChevronRight, ChevronLeft, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { StallConfigSection, StallConfig, defaultStallConfig } from './StallConfigSection';
import { EventFormFields } from './EventFormFields';
import dayjs from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type PrizeType = 'cash' | 'certificate' | 'trophy' | 'internship' | 'scholarship' | 'voucher' | 'merchandise' | 'custom';

export interface SubEventPrize {
  position: number | '';
  rank: string;
  title: string;
  prizeType: PrizeType;
  prizeAmount?: number | '';
  additionalPerks?: string;
}

export interface VenueFormData {
  eventName: string;
  eventType: string;
  eventStartDate: string; // ISO datetime string
  eventEndDate: string;   // ISO datetime string
  eventPaymentType: 'free' | 'paid';
  eventParticipationType: 'individual' | 'team';
  eventRegistrationFeeIndividual: number | '';
  eventRegistrationFeeTeam: number | '';
  eventApproxCapacity: number | '';
  eventCapacityFixed?: number | '';
  eventDutyLeaveAvailable: boolean | null;
  eventDutyLeaveEligibility: string[];
  eventDutyLeaveRoleType?: 'participants' | 'organizers' | 'both';
  eventHasSponsorship: boolean | null;
  eventSponsors: Array<{ name: string; amount: number | ''; type: 'cash' | 'in_kind'; notes: string }>;
  eventHasResources: boolean | null;
  eventResources: Array<{ type: string; description: string; pricePerPiece: number | ''; quantity: number | '' }>;
  eventCertification: boolean | null;
  eventHasPrizes: boolean | null;
  eventPrizesAwards: SubEventPrize[];
}

export const defaultVenueForm: VenueFormData = {
  eventName: '',
  eventType: '',
  eventStartDate: '',
  eventEndDate: '',
  eventPaymentType: 'free',
  eventParticipationType: 'individual',
  eventRegistrationFeeIndividual: '',
  eventRegistrationFeeTeam: '',
  eventApproxCapacity: '',
  eventCapacityFixed: '',
  eventDutyLeaveAvailable: null,
  eventDutyLeaveEligibility: [],
  eventDutyLeaveRoleType: undefined,
  eventHasSponsorship: null,
  eventSponsors: [],
  eventHasResources: null,
  eventResources: [],
  eventCertification: null,
  eventHasPrizes: null,
  eventPrizesAwards: [],
};

export interface SubEventData {
  id: string;
  eventType: 'venue' | 'stall';
  venueFormData: VenueFormData;
  stallConfig?: StallConfig;
}

export interface FestivalFormData {
  festivalName: string;
  startDate: string;
  endDate: string;
  description: string;
  coordinator: string;
  subEvents: SubEventData[];
}

export const defaultFestivalForm: FestivalFormData = {
  festivalName: '',
  startDate: '',
  endDate: '',
  description: '',
  coordinator: '',
  subEvents: [],
};

// ─────────────────────────────────────────────
// Constants & Helpers
// ─────────────────────────────────────────────

const cls = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');
const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-sgt-500 focus:border-sgt-500 outline-none';
const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1';
const TODAY = new Date().toISOString().slice(0, 10);

// ─────────────────────────────────────────────
// SubEventCard (collapsible)
// ─────────────────────────────────────────────

interface SubEventCardProps {
  index: number;
  data: SubEventData;
  onChange: (updated: SubEventData) => void;
  onRemove: () => void;
  disabled?: boolean;
  festivalStartDate?: string;
  festivalEndDate?: string;
}

const SubEventCard: React.FC<SubEventCardProps> = ({ index, data, onChange, onRemove, disabled, festivalStartDate, festivalEndDate }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg mb-4 bg-white dark:bg-gray-800 overflow-hidden">
      {/* Card Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex-1 truncate">
          #{index + 1} {data.venueFormData.eventName || <span className="text-gray-400 font-normal">(Unnamed Sub-Event)</span>}
        </span>
        <span className={cls('text-xs px-2 py-0.5 rounded-full font-medium', data.eventType === 'stall' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300')}>
          {data.eventType === 'stall' ? '🪄 Stall-Based' : '🏛️ Venue'}
        </span>
        {data.venueFormData.eventStartDate && (
          <span className="text-xs text-gray-400 hidden sm:block">{data.venueFormData.eventStartDate}</span>
        )}
        <button type="button" disabled={disabled} onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-red-400 hover:text-red-600 ml-1">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </div>

      {/* Card Body */}
      {expanded && (
        <div className="p-4 space-y-4">
          {/* Type selector */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Sub-Event Structure</p>
            <div className="flex gap-2">
              {(['venue', 'stall'] as const).map((t) => (
                <button
                  key={t} type="button" disabled={disabled}
                  onClick={() => onChange({ ...data, eventType: t, stallConfig: t === 'stall' ? { ...defaultStallConfig } : undefined })}
                  className={cls(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors',
                    data.eventType === t
                      ? 'border-sgt-500 bg-sgt-50 dark:bg-sgt-900/20 text-sgt-700 dark:text-sgt-300'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-sgt-300'
                  )}
                >
                  {t === 'venue' ? '🏛️ Venue Event' : '🪄 Stall-Based Event'}
                </button>
              ))}
            </div>
          </div>

          {/* Shared event form (same as venue/stall in main page) */}
          <EventFormFields
            data={data.venueFormData}
            onChange={(vf) => onChange({ ...data, venueFormData: vf })}
            disabled={disabled}
            fieldsetPrefix={data.id}
            festivalStartDate={festivalStartDate}
            festivalEndDate={festivalEndDate}
          />

          {/* Stall config (only for stall type) */}
          {data.eventType === 'stall' && data.stallConfig && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Stall Configuration</p>
              <StallConfigSection
                config={data.stallConfig}
                onChange={(sc) => onChange({ ...data, stallConfig: sc })}
                disabled={disabled}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// FestivalForm (3 stages: meta → subevents → review)
// ─────────────────────────────────────────────

type Stage = 'meta' | 'subevents' | 'review';

interface FestivalFormProps {
  data: FestivalFormData;
  onChange: (data: FestivalFormData) => void;
  disabled?: boolean;
  coordinatorReadOnly?: boolean;
}

const STAGE_LABELS: { id: Stage; label: string }[] = [
  { id: 'meta', label: 'Festival Details' },
  { id: 'subevents', label: 'Sub-Events' },
  { id: 'review', label: 'Review' },
];

const newSubEvent = (): SubEventData => ({
  id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  eventType: 'venue',
  venueFormData: { ...defaultVenueForm },
});

export const FestivalForm: React.FC<FestivalFormProps> = ({ data, onChange, disabled, coordinatorReadOnly = false }) => {
  const [stage, setStage] = useState<Stage>('meta');
  const [dateError, setDateError] = useState<string>('');

  const updateMeta = (field: keyof Omit<FestivalFormData, 'subEvents'>, val: string) =>
    onChange({ ...data, [field]: val });

  const updateSubEvents = (subEvents: SubEventData[]) => { setDateError(''); onChange({ ...data, subEvents }); };

  const stageIndex = STAGE_LABELS.findIndex((s) => s.id === stage);

  return (
    <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-800/50">
      {/* Stage indicator */}
      <div className="flex items-center gap-0 mb-6">
        {STAGE_LABELS.map((s, i) => {
          const active = s.id === stage;
          const done = stageIndex > i;
          return (
            <React.Fragment key={s.id}>
              <div className="flex items-center gap-2">
                <div className={cls(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors',
                  active ? 'border-sgt-500 bg-sgt-500 text-white' : done ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-400'
                )}>
                  {done ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={cls('text-xs font-medium', active ? 'text-sgt-600 dark:text-sgt-400' : 'text-gray-400 dark:text-gray-500')}>
                  {s.label}
                </span>
              </div>
              {i < STAGE_LABELS.length - 1 && (
                <div className={cls('flex-1 h-px mx-2', done ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700')} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── Stage 1: Festival Meta ── */}
      {stage === 'meta' && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={labelCls}>Festival Name <span className="text-red-500">*</span></label>
            <input type="text" disabled={disabled} value={data.festivalName} onChange={(e) => updateMeta('festivalName', e.target.value)} className={inputCls} placeholder="e.g. TechFest 2025" />
          </div>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <div>
              <label className={labelCls}>Start Date & Time <span className="text-red-500">*</span></label>
              <DateTimePicker
                disabled={disabled}
                format="DD/MM/YYYY hh:mm A"
                value={data.startDate ? dayjs(data.startDate) : null}
                minDateTime={dayjs(TODAY)}
                onChange={(val) => updateMeta('startDate', val ? val.toISOString() : '')}
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    sx: {
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        '& fieldset': { borderColor: 'rgb(229 231 235)' },
                        '&:hover fieldset': { borderColor: 'rgb(156 163 175)' },
                        '&.Mui-focused fieldset': { borderColor: 'rgb(99 102 241)', borderWidth: '2px' },
                      },
                      '& .MuiInputBase-input': { padding: '0.5rem 0.75rem', color: 'inherit' },
                    },
                  },
                }}
              />
            </div>
            <div>
              <label className={labelCls}>End Date & Time <span className="text-red-500">*</span></label>
              <DateTimePicker
                disabled={disabled}
                format="DD/MM/YYYY hh:mm A"
                value={data.endDate ? dayjs(data.endDate) : null}
                minDateTime={data.startDate ? dayjs(data.startDate) : dayjs(TODAY)}
                onChange={(val) => updateMeta('endDate', val ? val.toISOString() : '')}
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    sx: {
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        '& fieldset': { borderColor: 'rgb(229 231 235)' },
                        '&:hover fieldset': { borderColor: 'rgb(156 163 175)' },
                        '&.Mui-focused fieldset': { borderColor: 'rgb(99 102 241)', borderWidth: '2px' },
                      },
                      '& .MuiInputBase-input': { padding: '0.5rem 0.75rem', color: 'inherit' },
                    },
                  },
                }}
              />
            </div>
          </LocalizationProvider>
          <div>
            <label className={labelCls}>Overall Coordinator</label>
            <input type="text" disabled={disabled || coordinatorReadOnly} value={data.coordinator} onChange={(e) => !coordinatorReadOnly && updateMeta('coordinator', e.target.value)} className={inputCls} placeholder="Name / UID" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Description</label>
            <textarea rows={3} disabled={disabled} value={data.description} onChange={(e) => updateMeta('description', e.target.value)} className={cls(inputCls, 'resize-none')} placeholder="Brief description of the festival" />
          </div>
        </div>
      )}

      {/* ── Stage 2: Sub-Events ── */}
      {stage === 'subevents' && (
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Add all sub-events <span className="text-red-500">*</span>. Each can independently be venue-based or stall-based, with its own full details.
          </p>
          {data.subEvents.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg mb-4">
              No sub-events yet. Click below to add one.
            </div>
          )}
          {data.subEvents.map((evt, idx) => (
            <SubEventCard
              key={evt.id}
              index={idx}
              data={evt}
              onChange={(updated) => {
                const next = [...data.subEvents]; next[idx] = updated; updateSubEvents(next);
              }}
              onRemove={() => updateSubEvents(data.subEvents.filter((_, i) => i !== idx))}
              disabled={disabled}
              festivalStartDate={data.startDate || undefined}
              festivalEndDate={data.endDate || undefined}
            />
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={() => updateSubEvents([...data.subEvents, newSubEvent()])}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-sgt-600 dark:text-sgt-400 border border-sgt-300 dark:border-sgt-700 rounded-md hover:bg-sgt-50 dark:hover:bg-sgt-900/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Sub-Event
          </button>
        </div>
      )}

      {/* ── Stage 3: Review ── */}
      {stage === 'review' && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">🎪 {data.festivalName || 'Festival'}</h4>
            <div className="grid grid-cols-2 gap-y-1.5 text-xs">
              <div className="text-gray-500">Dates</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">{data.startDate && data.endDate ? `${data.startDate} – ${data.endDate}` : '—'}</div>
              <div className="text-gray-500">Coordinator</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">{data.coordinator || '—'}</div>
              <div className="text-gray-500">Sub-Events</div>
              <div className="font-medium text-gray-800 dark:text-gray-200">{data.subEvents.length}</div>
            </div>
          </div>
          {data.subEvents.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sub-Events</p>
              {data.subEvents.map((evt, i) => (
                <div key={evt.id} className="flex flex-wrap items-center gap-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md text-xs">
                  <span className="text-gray-400 font-medium">#{i + 1}</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200 flex-1">{evt.venueFormData.eventName || '(Unnamed)'}</span>
                  <span className={cls('px-2 py-0.5 rounded-full font-medium', evt.eventType === 'stall' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700')}>
                    {evt.eventType === 'stall' ? '🪄 Stall' : '🏛️ Venue'}
                  </span>
                  <span className="text-gray-400">{evt.venueFormData.eventType || '—'}</span>
                  {evt.venueFormData.eventStartDate && <span className="text-gray-400">{evt.venueFormData.eventStartDate}</span>}
                  {evt.venueFormData.eventPrizesAwards.length > 0 && <span className="text-yellow-600">🏆 {evt.venueFormData.eventPrizesAwards.length} prizes</span>}
                  {evt.venueFormData.eventCertification && <span className="text-green-600">📜 Cert</span>}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md text-xs text-amber-700 dark:text-amber-300">
            <span>⚠️</span>
            <span>All sub-events will be submitted as a single noting for approval. They will be approved or rejected together.</span>
          </div>
        </div>
      )}

      {/* Validation error */}
      {dateError && (stage === 'meta' || stage === 'subevents') && (
        <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-xs text-red-700 dark:text-red-300">
          <span>⚠️</span>
          <span>{dateError}</span>
        </div>
      )}

      {/* Stage navigation */}
      <div className="flex justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          disabled={stage === 'meta' || disabled}
          onClick={() => { if (stage === 'review') setStage('subevents'); else if (stage === 'subevents') setStage('meta'); }}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        {stage !== 'review' && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (stage === 'meta') {
                if (!data.festivalName?.trim()) { setDateError('Please enter the Festival Name.'); return; }
                if (!data.startDate) { setDateError('Please select the Festival Start Date.'); return; }
                if (!data.endDate) { setDateError('Please select the Festival End Date.'); return; }
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);
                if (data.startDate && new Date(data.startDate) < todayStart) {
                  setDateError('Festival Start Date cannot be in the past. Please select a future date.'); return;
                }
                if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
                  setDateError('Festival End Date should be after Start Date. Please correct the dates.'); return;
                }
                setDateError('');
                setStage('subevents');
              } else if (stage === 'subevents') {
                // Validate each sub-event has required fields
                for (let i = 0; i < data.subEvents.length; i++) {
                  const se = data.subEvents[i];
                  const v = se.venueFormData;
                  const label = `Sub-Event #${i + 1}`;
                  if (!v.eventName?.trim()) { setDateError(`${label}: Please enter the Event Name.`); return; }
                  if (!v.eventType) { setDateError(`${label}: Please select the Event Type.`); return; }
                  if (!v.eventStartDate) { setDateError(`${label}: Please select the Start Date.`); return; }
                  if (!v.eventEndDate) { setDateError(`${label}: Please select the End Date.`); return; }
                  const subToday = new Date();
                  subToday.setHours(0, 0, 0, 0);
                  if (v.eventStartDate && new Date(v.eventStartDate) < subToday) {
                    setDateError(`${label}: Start Date cannot be in the past. Please select a future date.`); return;
                  }
                  if (v.eventStartDate && v.eventEndDate && new Date(v.eventEndDate) < new Date(v.eventStartDate)) {
                    setDateError(`${label}: End Date should be after Start Date. Please correct the dates.`); return;
                  }
                  if (!v.eventPaymentType) { setDateError(`${label}: Please select Payment Type (Free or Paid).`); return; }
                  if (v.eventPaymentType === 'paid') {
                    if (v.eventParticipationType === 'individual' && (v.eventRegistrationFeeIndividual === '' || Number(v.eventRegistrationFeeIndividual) < 0)) {
                      setDateError(`${label}: Please enter the Participation Fee (₹) for paid events.`); return;
                    }
                    if (v.eventParticipationType === 'team' && (v.eventRegistrationFeeTeam === '' || Number(v.eventRegistrationFeeTeam) < 0)) {
                      setDateError(`${label}: Please enter the Fee per Team (₹) for paid events.`); return;
                    }
                  }
                }
                // Validate sub-event dates are within festival range
                if (data.startDate && data.endDate) {
                  const festStart = new Date(data.startDate);
                  const festEnd = new Date(data.endDate);
                  for (let i = 0; i < data.subEvents.length; i++) {
                    const ev = data.subEvents[i].venueFormData;
                    const name = ev.eventName || `Sub-Event #${i + 1}`;
                    if (ev.eventStartDate && new Date(ev.eventStartDate) < festStart) {
                      setDateError(`"${name}": Start date (${ev.eventStartDate}) is before festival start date (${data.startDate}). Sub-event dates must fall within the festival period.`);
                      return;
                    }
                    if (ev.eventStartDate && new Date(ev.eventStartDate) > festEnd) {
                      setDateError(`"${name}": Start date (${ev.eventStartDate}) is after festival end date (${data.endDate}). Sub-event dates must fall within the festival period.`);
                      return;
                    }
                    if (ev.eventEndDate && new Date(ev.eventEndDate) > festEnd) {
                      setDateError(`"${name}": End date (${ev.eventEndDate}) is after festival end date (${data.endDate}). Sub-event dates must fall within the festival period.`);
                      return;
                    }
                    if (ev.eventEndDate && new Date(ev.eventEndDate) < festStart) {
                      setDateError(`"${name}": End date (${ev.eventEndDate}) is before festival start date (${data.startDate}). Sub-event dates must fall within the festival period.`);
                      return;
                    }
                  }
                }
                setDateError('');
                setStage('review');
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-sgt-600 rounded-md hover:bg-sgt-700 transition-colors disabled:opacity-40"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
