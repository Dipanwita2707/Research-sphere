'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Plus, Trash2, IndianRupee, Award, Trophy, Medal, Briefcase, ShoppingBag, Ticket, Star, Settings, X, AlertCircle } from 'lucide-react';
import dayjs from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

import type { VenueFormData, SubEventPrize } from './FestivalForm';


type PrizeType = 'cash' | 'certificate' | 'trophy' | 'internship' | 'scholarship' | 'voucher' | 'merchandise' | 'custom';

// Venue form UI — same styling as original noting venue form
const EVENT_TYPE_OPTIONS = ['workshop', 'seminar', 'conference', 'competition', 'cultural', 'sports', 'tech_fest', 'hackathon', 'webinar', 'other'];
const PRIZE_TYPE_OPTIONS: { value: PrizeType; label: string; icon: React.ReactNode }[] = [
  { value: 'cash', label: 'Cash', icon: <IndianRupee className="w-4 h-4" /> },
  { value: 'certificate', label: 'Certificate', icon: <Award className="w-4 h-4" /> },
  { value: 'trophy', label: 'Trophy', icon: <Trophy className="w-4 h-4" /> },
  { value: 'internship', label: 'Internship', icon: <Briefcase className="w-4 h-4" /> },
  { value: 'scholarship', label: 'Scholarship', icon: <Medal className="w-4 h-4" /> },
  { value: 'merchandise', label: 'Merchandise', icon: <ShoppingBag className="w-4 h-4" /> },
  { value: 'voucher', label: 'Voucher', icon: <Ticket className="w-4 h-4" /> },
  { value: 'custom', label: 'Custom', icon: <Star className="w-4 h-4" /> },
];
const PERK_OPTIONS = ['Certificate', 'Pre-placement Interview', 'Pre-placement Offer', 'Goodies', 'Mentorship'];
// Duty leave: Only students (UG, PG, PhD) eligible. Faculty/Staff NOT eligible.
const DUTY_LEAVE_STUDENT_OPTIONS: { value: string; label: string }[] = [
  { value: 'ug', label: 'UG' },
  { value: 'pg', label: 'PG' },
  { value: 'phd', label: 'PhD' },
];
const DUTY_LEAVE_ROLE_OPTIONS: { value: 'participants' | 'organizers' | 'both'; label: string }[] = [
  { value: 'participants', label: 'Participants' },
  { value: 'organizers', label: 'Organizers' },
  { value: 'both', label: 'Both' },
];
const TODAY = new Date().toISOString().slice(0, 10);

// Venue form styles — consistent spacing, focus-visible, disabled states
const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:border-sgt-500 focus:ring-4 focus:ring-sgt-500/10 focus-visible:ring-2 focus-visible:ring-sgt-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 transition-all duration-200 outline-none hover:border-gray-300 dark:hover:border-gray-600 disabled:opacity-60 disabled:cursor-not-allowed';
const labelCls = 'block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1';
const sectionTitleCls = 'text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3 pl-4 border-l-4 border-sgt-500';
const helperTextCls = 'text-xs text-gray-500 dark:text-gray-400 mt-1.5 ml-1';

const radioLabelCls = (active: boolean) =>
  `relative flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-all duration-200 select-none outline-none focus-visible:ring-2 focus-visible:ring-sgt-500 focus-visible:ring-offset-2 ${active
    ? 'border-sgt-500 bg-sgt-50/50 dark:bg-sgt-500/10 ring-1 ring-sgt-500'
    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50'
  }`;

export interface EventFormFieldsProps {
  data: VenueFormData;
  onChange: (d: VenueFormData) => void;
  disabled?: boolean;
  showCapacityFixed?: boolean;
  fieldsetPrefix?: string;
  festivalStartDate?: string;
  festivalEndDate?: string;
}

export const EventFormFields: React.FC<EventFormFieldsProps> = ({
  data,
  onChange,
  disabled,
  showCapacityFixed = false,
  fieldsetPrefix = 'evt',
  festivalStartDate,
  festivalEndDate,
}) => {
  const dataRef = useRef(data);
  dataRef.current = data;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const set = useCallback(<K extends keyof VenueFormData>(k: K, v: VenueFormData[K]) => {
    onChangeRef.current({ ...dataRef.current, [k]: v });
  }, []);
  const ns = useCallback((n: string) => `${fieldsetPrefix}-${n}`, [fieldsetPrefix]);

  const addSponsor = useCallback(() => set('eventSponsors', [...dataRef.current.eventSponsors, { name: '', amount: '', type: 'cash', notes: '' }]), [set]);
  const removeSponsor = useCallback((i: number) => set('eventSponsors', dataRef.current.eventSponsors.filter((_, idx) => idx !== i)), [set]);
  const updateSponsor = useCallback((i: number, field: string, val: string | number) => {
    const next = [...dataRef.current.eventSponsors]; next[i] = { ...next[i], [field]: val }; set('eventSponsors', next);
  }, [set]);

  const addResource = useCallback(() => set('eventResources', [...dataRef.current.eventResources, { type: '', description: '', pricePerPiece: '', quantity: '' }]), [set]);
  const removeResource = useCallback((i: number) => set('eventResources', dataRef.current.eventResources.filter((_, idx) => idx !== i)), [set]);
  const updateResource = useCallback((i: number, field: string, val: string | number) => {
    const next = [...dataRef.current.eventResources]; next[i] = { ...next[i], [field]: val }; set('eventResources', next);
  }, [set]);

  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [editingPrize, setEditingPrize] = useState<SubEventPrize & { additionalPerksArr?: string[] } | null>(null);
  const [editingPrizeIndex, setEditingPrizeIndex] = useState<number | null>(null);

  const openAddPrize = useCallback(() => {
    const defaultRank = dataRef.current.eventPrizesAwards.length === 0 ? 'Winner' : dataRef.current.eventPrizesAwards.length === 1 ? 'First Runner Up' : dataRef.current.eventPrizesAwards.length === 2 ? 'Second Runner Up' : `Position ${dataRef.current.eventPrizesAwards.length + 1}`;
    setEditingPrize({ position: dataRef.current.eventPrizesAwards.length + 1, rank: defaultRank, title: '', prizeType: 'certificate', prizeAmount: '', additionalPerksArr: [] });
    setEditingPrizeIndex(null);
    setShowPrizeModal(true);
  }, []);
  const openEditPrize = useCallback((prize: SubEventPrize, idx: number) => {
    const perks = typeof prize.additionalPerks === 'string' && prize.additionalPerks
      ? prize.additionalPerks.split(',').map((p) => p.trim()).filter(Boolean)
      : [];
    setEditingPrize({ ...prize, additionalPerksArr: perks });
    setEditingPrizeIndex(idx);
    setShowPrizeModal(true);
  }, []);
  const savePrize = useCallback(() => {
    if (!editingPrize || !editingPrize.rank?.trim()) return;
    const { additionalPerksArr, ...rest } = editingPrize;
    const toSave: SubEventPrize = { ...rest, additionalPerks: additionalPerksArr?.length ? additionalPerksArr.join(', ') : undefined };
    if (editingPrizeIndex !== null) {
      const next = [...dataRef.current.eventPrizesAwards]; next[editingPrizeIndex] = toSave; set('eventPrizesAwards', next);
    } else {
      set('eventPrizesAwards', [...dataRef.current.eventPrizesAwards, toSave]);
    }
    setShowPrizeModal(false);
    setEditingPrize(null);
    setEditingPrizeIndex(null);
  }, [editingPrize, editingPrizeIndex, set]);
  const removePrize = useCallback((i: number) => set('eventPrizesAwards', dataRef.current.eventPrizesAwards.filter((_, idx) => idx !== i)), [set]);

  return (
    <div className="space-y-6">
      {useMemo(() => (
        <>
          {/* ─── Section 1: Event Details ─── */}
          <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className={sectionTitleCls}>
              <div className="p-1.5 bg-sgt-50 dark:bg-sgt-900/30 text-sgt-600 dark:text-sgt-400 rounded-lg shrink-0"><Star className="w-4 h-4" /></div>
              Event Details
            </h3>

            <div className="space-y-4">
              <div>
                <label className={labelCls}>Event Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  disabled={disabled}
                  value={data.eventName}
                  onChange={(e) => set('eventName', e.target.value)}
                  className={inputCls}
                  placeholder="e.g. Annual Tech Symposium 2024"
                />
              </div>

              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <div className="grid grid-cols-3 gap-4 items-start">
                  {/* Event Type */}
                  <div>
                    <label className={labelCls}>Event Type <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <select
                        disabled={disabled}
                        value={data.eventType}
                        onChange={(e) => set('eventType', e.target.value)}
                        className={`${inputCls} appearance-none cursor-pointer`}
                      >
                        <option value="">Select event type</option>
                        {EVENT_TYPE_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>

                  {/* Start Date & Time */}
                  <div>
                    <label className={labelCls}>Start Date & Time <span className="text-red-500">*</span></label>
                    <DateTimePicker
                      disabled={disabled}
                      value={data.eventStartDate ? dayjs(data.eventStartDate) : null}
                      minDateTime={festivalStartDate ? dayjs(festivalStartDate) : dayjs(TODAY)}
                      maxDateTime={festivalEndDate ? dayjs(festivalEndDate).endOf('day') : undefined}
                      onChange={(val) => set('eventStartDate', val ? val.toISOString() : '')}
                      slotProps={{
                        textField: {
                          size: 'small',
                          fullWidth: true,
                          sx: {
                            '& .MuiOutlinedInput-root': {
                              borderRadius: '0.5rem',
                              fontSize: '0.875rem',
                              backgroundColor: 'var(--dt-bg, white)',
                              '& fieldset': { borderColor: 'rgb(229 231 235)' },
                              '&:hover fieldset': { borderColor: 'rgb(156 163 175)' },
                              '&.Mui-focused fieldset': { borderColor: 'rgb(99 102 241)', borderWidth: '2px' },
                              '&.Mui-disabled': { opacity: 0.6 },
                            },
                            '& .MuiInputBase-input': { padding: '0.5rem 0.75rem', color: 'inherit' },
                          },
                        },
                      }}
                    />
                  </div>

                  {/* End Date & Time */}
                  <div>
                    <label className={labelCls}>End Date & Time <span className="text-red-500">*</span></label>
                    <DateTimePicker
                      disabled={disabled}
                      value={data.eventEndDate ? dayjs(data.eventEndDate) : null}
                      minDateTime={data.eventStartDate ? dayjs(data.eventStartDate) : (festivalStartDate ? dayjs(festivalStartDate) : dayjs(TODAY))}
                      maxDateTime={festivalEndDate ? dayjs(festivalEndDate).endOf('day') : undefined}
                      onChange={(val) => set('eventEndDate', val ? val.toISOString() : '')}
                      slotProps={{
                        textField: {
                          size: 'small',
                          fullWidth: true,
                          sx: {
                            '& .MuiOutlinedInput-root': {
                              borderRadius: '0.5rem',
                              fontSize: '0.875rem',
                              backgroundColor: 'var(--dt-bg, white)',
                              '& fieldset': { borderColor: 'rgb(229 231 235)' },
                              '&:hover fieldset': { borderColor: 'rgb(156 163 175)' },
                              '&.Mui-focused fieldset': { borderColor: 'rgb(99 102 241)', borderWidth: '2px' },
                              '&.Mui-disabled': { opacity: 0.6 },
                            },
                            '& .MuiInputBase-input': { padding: '0.5rem 0.75rem', color: 'inherit' },
                          },
                        },
                      }}
                    />
                  </div>
                </div>
              </LocalizationProvider>


              {(festivalStartDate && festivalEndDate) && (
                <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
                  <div className="mt-0.5 shrink-0">⚠️</div>
                  <p>Dates must be within the festival duration: <strong>{festivalStartDate}</strong> to <strong>{festivalEndDate}</strong></p>
                </div>
              )}
            </div>
          </div>
        </>
      ), [data.eventName, data.eventType, data.eventStartDate, data.eventEndDate, disabled, festivalStartDate, festivalEndDate, set])}
      {useMemo(() => (
        <>
          {/* ─── Section 2: Participation & Capacity ─── */}
          <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className={sectionTitleCls}>
              <div className="p-1.5 bg-sgt-50 dark:bg-sgt-900/30 text-sgt-600 dark:text-sgt-400 rounded-lg shrink-0"><Ticket className="w-4 h-4" /></div>
              Participation & Capacity
            </h3>

            <div className="space-y-4">
              {/* Payment & Participation Type Grid */}
              <div className="grid md:grid-cols-2 gap-4">

                {/* Payment Type */}
                <div>
                  <label className={labelCls}>Payment Type <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-2 gap-4">
                    <div role="button" tabIndex={0} className={radioLabelCls(data.eventPaymentType === 'free')} onClick={() => !disabled && set('eventPaymentType', 'free')} onKeyDown={(e) => e.key === 'Enter' && !disabled && set('eventPaymentType', 'free')}>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${data.eventPaymentType === 'free' ? 'border-sgt-500' : 'border-gray-300'}`}>
                        {data.eventPaymentType === 'free' && <div className="w-2 h-2 rounded-full bg-sgt-500" />}
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Free</span>
                    </div>
                    <div role="button" tabIndex={0} className={radioLabelCls(data.eventPaymentType === 'paid')} onClick={() => !disabled && set('eventPaymentType', 'paid')} onKeyDown={(e) => e.key === 'Enter' && !disabled && set('eventPaymentType', 'paid')}>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${data.eventPaymentType === 'paid' ? 'border-sgt-500' : 'border-gray-300'}`}>
                        {data.eventPaymentType === 'paid' && <div className="w-2 h-2 rounded-full bg-sgt-500" />}
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Paid</span>
                    </div>
                  </div>
                </div>

                {/* Participation Type */}
                <div>
                  <label className={labelCls}>Participation Mode</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div role="button" tabIndex={0} className={radioLabelCls(data.eventParticipationType === 'individual')} onClick={() => !disabled && set('eventParticipationType', 'individual')} onKeyDown={(e) => e.key === 'Enter' && !disabled && set('eventParticipationType', 'individual')}>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${data.eventParticipationType === 'individual' ? 'border-sgt-500' : 'border-gray-300'}`}>
                        {data.eventParticipationType === 'individual' && <div className="w-2 h-2 rounded-full bg-sgt-500" />}
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Individual</span>
                    </div>
                    <div role="button" tabIndex={0} className={radioLabelCls(data.eventParticipationType === 'team')} onClick={() => !disabled && set('eventParticipationType', 'team')} onKeyDown={(e) => e.key === 'Enter' && !disabled && set('eventParticipationType', 'team')}>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${data.eventParticipationType === 'team' ? 'border-sgt-500' : 'border-gray-300'}`}>
                        {data.eventParticipationType === 'team' && <div className="w-2 h-2 rounded-full bg-sgt-500" />}
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Team</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Conditional Fee Input */}
              {data.eventPaymentType === 'paid' && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className={labelCls}>{data.eventParticipationType === 'individual' ? 'Participation Fee (₹)' : 'Fee per Team (₹)'} <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                    <input
                      type="number" min={0} disabled={disabled}
                      value={data.eventParticipationType === 'team' ? data.eventRegistrationFeeTeam : data.eventRegistrationFeeIndividual}
                      onChange={(e) => {
                        const v = e.target.value === '' ? '' : Number(e.target.value);
                        if (data.eventParticipationType === 'team') set('eventRegistrationFeeTeam', v);
                        else set('eventRegistrationFeeIndividual', v);
                      }}
                      className={`${inputCls} pl-8`}
                      placeholder={data.eventParticipationType === 'individual' ? 'e.g. 500' : 'e.g. 2000'}
                    />
                  </div>
                </div>
              )}

              {/* Capacity Fields */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Approximate Capacity</label>
                    <input
                      type="number"
                      min={1}
                      disabled={disabled}
                      value={data.eventApproxCapacity}
                      onChange={(e) => set('eventApproxCapacity', e.target.value === '' ? '' : Number(e.target.value))}
                      className={inputCls}
                      placeholder="e.g. 100"
                    />
                    <p className={helperTextCls}>Used for venue estimation only</p>
                  </div>

                  {showCapacityFixed && (
                    <div>
                      <label className={labelCls}>Fixed Capacity Limit</label>
                      <input
                        type="number"
                        min={1}
                        disabled={disabled}
                        value={data.eventCapacityFixed ?? ''}
                        onChange={(e) => set('eventCapacityFixed', e.target.value === '' ? '' : Number(e.target.value))}
                        className={inputCls}
                        placeholder="e.g. 50 (Strict limit)"
                      />
                      <p className={`${helperTextCls} flex items-center gap-1 text-amber-600 dark:text-amber-400`}>
                        <AlertCircle className="w-3 h-3" /> Locked after approval
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ), [data.eventPaymentType, data.eventParticipationType, data.eventRegistrationFeeTeam, data.eventRegistrationFeeIndividual, data.eventApproxCapacity, data.eventCapacityFixed, disabled, showCapacityFixed, set])}

      {useMemo(() => (
        <>
          {/* ─── Section 3: Logistics & Requirements ─── */}
          <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className={sectionTitleCls}>
              <div className="p-1.5 bg-sgt-50 dark:bg-sgt-900/30 text-sgt-600 dark:text-sgt-400 rounded-lg shrink-0"><Briefcase className="w-4 h-4" /></div>
              Leave & Sponsorship
            </h3>

            <div className="space-y-5">
              {/* Duty Leave */}
              <div className="space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <label className={labelCls}>Duty Leave Required?</label>
                  <div className="inline-flex p-0.5 rounded-full bg-gray-100 dark:bg-gray-700 shrink-0">
                    <button type="button" onClick={() => !disabled && onChange({ ...data, eventDutyLeaveAvailable: true, eventDutyLeaveEligibility: data.eventDutyLeaveEligibility.length ? data.eventDutyLeaveEligibility : ['ug', 'pg', 'phd'], eventDutyLeaveRoleType: data.eventDutyLeaveRoleType || 'participants' })} disabled={disabled} className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-sgt-500 focus-visible:ring-offset-2 ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${data.eventDutyLeaveAvailable ? 'bg-white dark:bg-gray-600 text-sgt-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Yes</button>
                    <button type="button" onClick={() => !disabled && onChange({ ...data, eventDutyLeaveAvailable: false, eventDutyLeaveEligibility: [], eventDutyLeaveRoleType: undefined })} disabled={disabled} className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-sgt-500 focus-visible:ring-offset-2 ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${!data.eventDutyLeaveAvailable ? 'bg-white dark:bg-gray-600 text-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>No</button>
                  </div>
                </div>

                {data.eventDutyLeaveAvailable && (
                  <div className="p-4 bg-sgt-50/50 dark:bg-sgt-900/10 rounded-xl border border-sgt-100 dark:border-sgt-800/30 space-y-4 animate-in fade-in slide-in-from-top-1">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">Eligibility</span>
                      <div className="flex flex-wrap gap-2">
                        {DUTY_LEAVE_STUDENT_OPTIONS.map((opt) => (
                          <label key={opt.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${data.eventDutyLeaveEligibility.includes(opt.value) ? 'bg-sgt-100 dark:bg-sgt-900/30 border-sgt-300 dark:border-sgt-700 text-sgt-800 dark:text-sgt-300 font-medium' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'}`}>
                            <input type="checkbox" checked={data.eventDutyLeaveEligibility.includes(opt.value)} onChange={() => { const cur = data.eventDutyLeaveEligibility; const next = cur.includes(opt.value) ? cur.filter((x) => x !== opt.value) : [...cur, opt.value]; set('eventDutyLeaveEligibility', next); }} disabled={disabled} className="w-4 h-4 text-sgt-600 rounded border-gray-300 focus:ring-sgt-500 focus-visible:ring-2 focus-visible:ring-sgt-500" />
                            <span className="text-sm">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 block">Role Type</span>
                      <div className="flex flex-wrap gap-2">
                        {DUTY_LEAVE_ROLE_OPTIONS.map((opt) => (
                          <label key={opt.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${data.eventDutyLeaveRoleType === opt.value ? 'bg-sgt-100 dark:bg-sgt-900/30 border-sgt-300 dark:border-sgt-700 text-sgt-800 dark:text-sgt-300 font-medium' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'}`}>
                            <input type="radio" name={ns('dutyLeaveRole')} value={opt.value} checked={data.eventDutyLeaveRoleType === opt.value} onChange={() => !disabled && set('eventDutyLeaveRoleType', opt.value)} disabled={disabled} className="w-4 h-4 text-sgt-600 focus:ring-sgt-500 focus-visible:ring-2 focus-visible:ring-sgt-500" />
                            <span className="text-sm">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="w-full h-px bg-gray-100 dark:bg-gray-700" />

              {/* Sponsorship */}
              <div className="space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <label className={labelCls}>Sponsorship Available?</label>
                  <div className="inline-flex p-0.5 rounded-full bg-gray-100 dark:bg-gray-700 shrink-0">
                    <button type="button" onClick={() => !disabled && set('eventHasSponsorship', true)} disabled={disabled} className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-sgt-500 focus-visible:ring-offset-2 ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${data.eventHasSponsorship ? 'bg-white dark:bg-gray-600 text-sgt-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Yes</button>
                    <button type="button" onClick={() => !disabled && onChange({ ...data, eventHasSponsorship: false, eventSponsors: [] })} disabled={disabled} className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-sgt-500 focus-visible:ring-offset-2 ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${!data.eventHasSponsorship ? 'bg-white dark:bg-gray-600 text-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>No</button>
                  </div>
                </div>

                {data.eventHasSponsorship && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_1fr] gap-2 px-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      <span>Sponsor Name</span>
                      <span>Type</span>
                      <span>Amount / Details</span>
                    </div>
                    {data.eventSponsors.map((sp, i) => (
                      <div key={i} className="flex flex-col sm:flex-row gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-600 transition-all hover:border-gray-300 dark:hover:border-gray-500">
                        <div className="flex-1">
                          <input type="text" disabled={disabled} value={sp.name} onChange={(e) => updateSponsor(i, 'name', e.target.value)} placeholder="e.g. ABC Corp, XYZ Ltd" className={inputCls} />
                        </div>
                        <div className="sm:w-32">
                          <select disabled={disabled} value={sp.type} onChange={(e) => updateSponsor(i, 'type', e.target.value)} className={inputCls}>
                            <option value="cash">Cash</option>
                            <option value="in_kind">In-kind</option>
                          </select>
                        </div>
                        <div className="flex-1">
                          {sp.type === 'cash' ? (
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                              <input type="number" min={0} disabled={disabled} value={sp.amount} onChange={(e) => updateSponsor(i, 'amount', e.target.value === '' ? '' : Number(e.target.value))} placeholder="Amount" className={`${inputCls} pl-6`} />
                            </div>
                          ) : (
                            <input type="text" disabled={disabled} value={sp.notes} onChange={(e) => updateSponsor(i, 'notes', e.target.value)} placeholder="Items (e.g. food)" className={inputCls} />
                          )}
                        </div>
                        <button type="button" disabled={disabled} onClick={() => removeSponsor(i)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors self-start sm:self-center"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    ))}

                    <button type="button" disabled={disabled} onClick={addSponsor} className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-500 hover:text-sgt-600 hover:border-sgt-400 hover:bg-sgt-50/70 dark:hover:bg-sgt-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                      <Plus className="w-4 h-4" /> Add Sponsor
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ), [data.eventDutyLeaveAvailable, data.eventDutyLeaveEligibility, data.eventDutyLeaveRoleType, data.eventHasSponsorship, data.eventSponsors, disabled, ns, updateSponsor, removeSponsor, set, addSponsor])}

      {useMemo(() => (
        <>
          {/* ─── Section 4: Event Resources ─── */}
          <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className={sectionTitleCls}>
              <div className="p-1.5 bg-sgt-50 dark:bg-sgt-900/30 text-sgt-600 dark:text-sgt-400 rounded-lg shrink-0"><Settings className="w-4 h-4" /></div>
              Event Resources
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-start gap-4">
                <label className={labelCls}>Are any resources required?</label>
                <div className="inline-flex p-0.5 rounded-full bg-gray-100 dark:bg-gray-700 shrink-0">
                  <button type="button" onClick={() => !disabled && set('eventHasResources', true)} disabled={disabled} className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-sgt-500 focus-visible:ring-offset-2 ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${data.eventHasResources ? 'bg-white dark:bg-gray-600 text-sgt-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Yes</button>
                  <button type="button" onClick={() => !disabled && onChange({ ...data, eventHasResources: false, eventResources: [] })} disabled={disabled} className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-sgt-500 focus-visible:ring-offset-2 ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${!data.eventHasResources ? 'bg-white dark:bg-gray-600 text-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>No</button>
                </div>
              </div>

              {data.eventHasResources && (
                <div className="mt-4 animate-in fade-in slide-in-from-top-1">
                  <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Resource / Item</th>
                            <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">Description</th>
                            <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider w-32">Price/Unit</th>
                            <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider w-24">Qty</th>
                            <th className="px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider w-32">Total</th>
                            <th className="px-4 py-3 w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800/50">
                          {data.eventResources.map((r, i) => {
                            const computedCost = (r.pricePerPiece !== '' && r.quantity !== '') ? Number(r.pricePerPiece) * Number(r.quantity) : '';
                            return (
                              <tr key={i} className="group hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors even:bg-gray-50/30 dark:even:bg-gray-800/30">
                                <td className="p-2">
                                  <input type="text" disabled={disabled} value={r.type} onChange={(e) => updateResource(i, 'type', e.target.value)} placeholder="e.g. Mic, Podium" className={inputCls} />
                                </td>
                                <td className="p-2">
                                  <input type="text" disabled={disabled} value={r.description} onChange={(e) => updateResource(i, 'description', e.target.value)} placeholder="Details..." className={inputCls} />
                                </td>
                                <td className="p-2">
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                                    <input type="number" min={0} disabled={disabled} value={r.pricePerPiece} onChange={(e) => updateResource(i, 'pricePerPiece', e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" className={`${inputCls} pl-6`} />
                                  </div>
                                </td>
                                <td className="p-2">
                                  <input type="number" min={1} disabled={disabled} value={r.quantity} onChange={(e) => updateResource(i, 'quantity', e.target.value === '' ? '' : Number(e.target.value))} placeholder="1" className={inputCls} />
                                </td>
                                <td className="p-2">
                                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 text-right">
                                    {computedCost !== '' ? `₹${Number(computedCost).toLocaleString('en-IN')}` : '—'}
                                  </div>
                                </td>
                                <td className="p-2 text-center">
                                  <button type="button" disabled={disabled} onClick={() => removeResource(i)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </td>
                              </tr>
                            );
                          })}
                          {data.eventResources.length === 0 && (
                            <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">No resources added yet.</td></tr>
                          )}
                        </tbody>
                        {data.eventResources.length > 0 && (
                          <tfoot className="bg-gray-50/50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                            <tr>
                              <td colSpan={4} className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Total Estimated Cost</td>
                              <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-white text-right">
                                ₹{data.eventResources.reduce((sum, r) => sum + ((r.pricePerPiece !== '' && r.quantity !== '') ? Number(r.pricePerPiece) * Number(r.quantity) : 0), 0).toLocaleString('en-IN')}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                  <button type="button" disabled={disabled} onClick={addResource} className="mt-3 w-full py-2.5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-500 hover:text-sgt-600 hover:border-sgt-400 hover:bg-sgt-50/70 dark:hover:bg-sgt-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                    <Plus className="w-4 h-4" /> Add Resource
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      ), [data.eventHasResources, data.eventResources, disabled, set, updateResource, removeResource, addResource])}

      {useMemo(() => (
        <>
          {/* ─── Section 5: Awards & Recognition ─── */}
          <div className="bg-white dark:bg-gray-800/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className={sectionTitleCls}>
              <div className="p-1.5 bg-sgt-50 dark:bg-sgt-900/30 text-sgt-600 dark:text-sgt-400 rounded-lg shrink-0"><Trophy className="w-4 h-4" /></div>
              Awards & Recognition
            </h3>

            <div className="space-y-4">
              {/* Certificate Toggle */}
              <div className="flex justify-between items-center py-1 gap-4">
                <div>
                  <label className={labelCls + " mb-0"}>Participants receive certificates?</label>
                  <p className={helperTextCls}>Locked after event approval</p>
                </div>
                <div className="inline-flex p-0.5 rounded-full bg-gray-100 dark:bg-gray-700 shrink-0">
                  <button type="button" onClick={() => !disabled && set('eventCertification', true)} disabled={disabled} className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-sgt-500 focus-visible:ring-offset-2 ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${data.eventCertification ? 'bg-white dark:bg-gray-600 text-sgt-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Yes</button>
                  <button type="button" onClick={() => !disabled && set('eventCertification', false)} disabled={disabled} className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-sgt-500 focus-visible:ring-offset-2 ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${!data.eventCertification ? 'bg-white dark:bg-gray-600 text-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>No</button>
                </div>
              </div>

              <div className="h-px bg-gray-100 dark:bg-gray-700" />

              {/* Prizes Toggle */}
              <div className="flex justify-between items-start gap-4">
                <label className={labelCls}>Prizes & Winners</label>
                <div className="inline-flex p-0.5 rounded-full bg-gray-100 dark:bg-gray-700 shrink-0">
                  <button type="button" onClick={() => !disabled && onChange({ ...data, eventHasPrizes: true })} disabled={disabled} className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-sgt-500 focus-visible:ring-offset-2 ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${data.eventHasPrizes ? 'bg-white dark:bg-gray-600 text-sgt-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>Yes</button>
                  <button type="button" onClick={() => !disabled && onChange({ ...data, eventHasPrizes: false, eventPrizesAwards: [] })} disabled={disabled} className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-sgt-500 focus-visible:ring-offset-2 ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${!data.eventHasPrizes ? 'bg-white dark:bg-gray-600 text-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>No</button>
                </div>
              </div>

              {/* Prizes Grid — shown only when Yes */}
              {data.eventHasPrizes && (
                <div className="animate-in fade-in slide-in-from-top-1">
                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    {data.eventPrizesAwards.map((prize, idx) => (
                      <div key={idx} className="relative group p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 hover:border-sgt-200 dark:hover:border-sgt-800 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                        <div className="flex items-start justify-between mb-2">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${prize.prizeType === 'cash' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-sgt-100 dark:bg-sgt-900/30 text-sgt-600 dark:text-sgt-400'}`}>
                            {prize.prizeType === 'trophy' ? <Trophy className="w-5 h-5" /> : prize.prizeType === 'cash' ? <IndianRupee className="w-5 h-5" /> : <Award className="w-5 h-5" />}
                          </div>
                          <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button type="button" disabled={disabled} onClick={() => openEditPrize(prize, idx)} className="p-1.5 text-gray-400 hover:text-sgt-600 hover:bg-white rounded-md shadow-sm"><Settings className="w-4 h-4" /></button>
                            <button type="button" disabled={disabled} onClick={() => removePrize(idx)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded-md shadow-sm"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>

                        <h4 className="font-bold text-gray-900 dark:text-white">{prize.rank}</h4>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {prize.prizeType === 'cash' && prize.prizeAmount ? `₹${Number(prize.prizeAmount).toLocaleString()}` : prize.title || 'Prize'}
                        </p>

                        {prize.additionalPerks?.trim() && (
                          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50">
                            {prize.additionalPerks.split(',').filter((p) => p.trim()).map((p, i) => (
                              <span key={i} className="px-2 py-0.5 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-[10px] uppercase font-bold tracking-wide rounded shadow-sm">{p.trim()}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add Button */}
                    <button type="button" disabled={disabled} onClick={openAddPrize} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 hover:text-sgt-600 hover:border-sgt-400 hover:bg-sgt-50/70 dark:hover:bg-sgt-900/20 transition-all min-h-[100px] disabled:opacity-60 disabled:cursor-not-allowed">
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center group-hover:bg-sgt-100 dark:group-hover:bg-sgt-900/30 transition-colors">
                        <Plus className="w-5 h-5" />
                      </div>
                      <span className="font-semibold text-sm">Add New Prize</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ), [data.eventCertification, data.eventHasPrizes, data.eventPrizesAwards, disabled, set, openEditPrize, removePrize, openAddPrize])}

      {/* Prize Modal */}
      {showPrizeModal && editingPrize && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200" onClick={() => setShowPrizeModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 fade-in duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{editingPrizeIndex !== null ? 'Edit Prize' : 'Add Prize'}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Configure reward details for this position</p>
              </div>
              <button type="button" onClick={() => setShowPrizeModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className={labelCls}>Rank / Position <span className="text-red-500">*</span></label>
                <input type="text" value={editingPrize.rank} onChange={(e) => setEditingPrize({ ...editingPrize, rank: e.target.value })} className={inputCls} placeholder="e.g. Winner, First Runner Up" />
              </div>

              <div>
                <label className={labelCls}>Prize Type</label>
                <div className="grid grid-cols-4 gap-3">
                  {PRIZE_TYPE_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setEditingPrize({ ...editingPrize, prizeType: opt.value })} className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${editingPrize.prizeType === opt.value ? 'border-sgt-500 bg-sgt-50 dark:bg-sgt-900/20 text-sgt-700 dark:text-sgt-300 ring-2 ring-sgt-500 ring-offset-1 dark:ring-offset-gray-800' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300 hover:bg-gray-50'}`}>
                      <div className={editingPrize.prizeType === opt.value ? 'text-sgt-600' : 'text-gray-400'}>{opt.icon}</div>
                      <span className="text-[10px] font-bold uppercase tracking-wide">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Prize Title / Description</label>
                <input type="text" value={editingPrize.title} onChange={(e) => setEditingPrize({ ...editingPrize, title: e.target.value })} className={inputCls} placeholder="e.g. Gold Medal" />
              </div>

              {editingPrize.prizeType === 'cash' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className={labelCls}>Prize Amount (₹)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₹</span>
                    <input type="number" min={0} value={editingPrize.prizeAmount ?? ''} onChange={(e) => setEditingPrize({ ...editingPrize, prizeAmount: e.target.value === '' ? '' : Number(e.target.value) })} className={`${inputCls} pl-8 font-semibold text-lg`} placeholder="0" />
                  </div>
                </div>
              )}

              <div>
                <label className={labelCls}>Additional Perks</label>
                <div className="flex flex-wrap gap-2">
                  {PERK_OPTIONS.map((perk) => {
                    const isSelected = editingPrize.additionalPerksArr?.includes(perk) ?? false;
                    return (
                      <button key={perk} type="button" onClick={() => {
                        const current = editingPrize.additionalPerksArr || [];
                        setEditingPrize({ ...editingPrize, additionalPerksArr: isSelected ? current.filter((p) => p !== perk) : [...current, perk] });
                      }} className={`px-4 py-2 text-xs font-semibold rounded-full border transition-all ${isSelected ? 'bg-sgt-600 text-white border-sgt-600 shadow-sm' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-300'}`}>
                        {perk}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 rounded-b-xl">
              <button type="button" onClick={() => setShowPrizeModal(false)} className="px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 rounded-xl transition-all">Cancel</button>
              <button type="button" onClick={savePrize} className="px-6 py-2.5 text-sm font-semibold text-white bg-sgt-600 hover:bg-sgt-700 rounded-xl shadow-lg shadow-sgt-500/20 transition-all transform active:scale-95">{editingPrizeIndex !== null ? 'Save Changes' : 'Add Prize'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
