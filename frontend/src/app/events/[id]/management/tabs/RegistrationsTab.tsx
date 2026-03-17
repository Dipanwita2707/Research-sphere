'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import {
  Search, Filter, XCircle, X, Mail, Users, Crown,
  Eye, CreditCard, CheckCircle2, Loader2, Download,
  Award, LayoutList, LayoutGrid, Tag,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import type { Event } from '@/features/event-management/types/event.types';
import RegistrationFilters from '@/features/event-management/components/RegistrationFilters';
import type {
  RegistrationFilterParams,
  RegistrationFilterOptions,
  RegistrationRow,
} from '@/features/event-management/types/registrationFilter.types';
import {
  getRegistrationDisplayName,
  getRegistrationIdentifier,
  getRegistrationSchool,
  getRegistrationDepartment,
  getRegistrationProgram,
} from '@/features/event-management/types/registrationFilter.types';
import { useToast } from '@/shared/ui-components/Toast';
import { CARD, CARD_HEADER, STATUS_COLORS } from './constants';

const RegistrationDetailModal = dynamic(
  () => import('@/features/event-management/components/RegistrationDetailModal'),
  { loading: () => null }
);
const EmailSlider = dynamic(
  () => import('@/features/event-management/components/EmailSlider'),
  { loading: () => null }
);
const CertificateSlider = dynamic(
  () => import('@/features/event-management/components/CertificateSlider'),
  { loading: () => null }
);

// ── Props ────────────────────────────────────────────────────────
interface RegistrationsTabProps {
  eventId: string;
  event: Event;
}

export default function RegistrationsTab({ eventId, event }: RegistrationsTabProps) {
  const { toast } = useToast();

  // ── State ──────────────────────────────────────────────────────
  const [regFilters, setRegFilters] = useState<RegistrationFilterParams>({ page: 1, limit: 20 });
  const [regFilterOptions, setRegFilterOptions] = useState<RegistrationFilterOptions | null>(null);
  const [regFilterOptionsLoading, setRegFilterOptionsLoading] = useState(false);
  const [regData, setRegData] = useState<RegistrationRow[]>([]);
  const [regPagination, setRegPagination] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
  const [regLoading, setRegLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [regViewMode, setRegViewMode] = useState<'table' | 'teams' | 'guests'>('table');
  const regDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showEmailSlider, setShowEmailSlider] = useState(false);
  const [showCertificateSlider, setShowCertificateSlider] = useState(false);
  const [detailRegId, setDetailRegId] = useState<string | null>(null);
  const [selectedRegIds, setSelectedRegIds] = useState<Set<string>>(new Set());

  // ── Registrations Loader ───────────────────────────────────────
  const loadRegistrations = useCallback(async (f: RegistrationFilterParams) => {
    setRegLoading(true);
    try {
      const { page, limit, status, search, ...advancedFilters } = f;
      const result = await eventService.getEventRegistrations(
        eventId,
        page || 1,
        limit || 20,
        status,
        { search, ...advancedFilters } as Record<string, string | number | undefined>,
      );
      setRegData(result.registrations as RegistrationRow[]);
      setRegPagination(result.pagination);
    } catch {
      toast({ type: 'error', message: 'Failed to load registrations' });
    } finally {
      setRegLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    if (!eventId) return;
    // Load filter options once
    if (!regFilterOptions && !regFilterOptionsLoading) {
      setRegFilterOptionsLoading(true);
      eventService.getRegistrationFilterOptions(eventId)
        .then((opts: RegistrationFilterOptions) => setRegFilterOptions(opts))
        .catch(() => {})
        .finally(() => setRegFilterOptionsLoading(false));
    }
    if (regDebounceRef.current) clearTimeout(regDebounceRef.current);
    regDebounceRef.current = setTimeout(() => loadRegistrations(regFilters), 300);
    return () => { if (regDebounceRef.current) clearTimeout(regDebounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, regFilters]);

  // ── Selection helpers ──────────────────────────────────────────
  const toggleRegSelection = useCallback((id: string) => {
    setSelectedRegIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedRegIds(prev =>
      prev.size === regData.length ? new Set() : new Set(regData.map(r => r.id))
    );
  }, [regData]);

  const clearSelection = useCallback(() => setSelectedRegIds(new Set()), []);

  const guestRows = regData.flatMap((reg) =>
    (reg.guests || []).map((guest) => ({
      ...guest,
      registrationId: reg.registrationId,
      passHolderName: getRegistrationDisplayName(reg),
      passHolderEmail: reg.user_login?.email || 'N/A',
      teamName: reg.team?.name || '',
      teamId: reg.team?.teamId || '',
    })),
  );

  // ── Filter / Page handlers ─────────────────────────────────────
  const handleRegFilterChange = useCallback((newFilters: RegistrationFilterParams) => {
    setRegFilters(newFilters);
  }, []);

  const handleRegPageChange = useCallback((page: number) => {
    setRegFilters(prev => ({ ...prev, page }));
  }, []);

  // ── CSV Export ─────────────────────────────────────────────────
  const handleExportCSV = useCallback(async () => {
    toast({ type: 'info', message: 'Preparing CSV, please wait…' });
    try {
      const { search, status, ...advancedFilters } = regFilters;
      const { blob, filename } = await eventService.exportEventRegistrationsCsv(
        eventId,
        status,
        { search, ...advancedFilters } as Record<string, string | number | undefined>,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `${event.name.replace(/\s+/g, '_')}_registrations_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ type: 'success', message: 'CSV export started' });
    } catch {
      toast({ type: 'error', message: 'Failed to export CSV' });
    }
  }, [event, eventId, regFilters, toast]);

  // ── Payment formatter ──────────────────────────────────────────
  const formatPayment = (reg: RegistrationRow) => {
    const hasCoupon = !!reg.couponId;
    const discount = reg.discountAmount ?? 0;
    const originalAmt = reg.originalAmount ?? event?.registrationFee ?? 0;
    const paidViaGateway = reg.amountPaid ?? 0;
    const isPaid = reg.paymentStatus === 'completed' || !!reg.latestPayment?.razorpayPaymentId;

    if (isPaid && hasCoupon && paidViaGateway === 0) {
      return (
        <div className="group relative">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 cursor-default">
            <Tag className="w-3 h-3" /> Fully Paid via Coupon
          </span>
          <div className="absolute left-0 bottom-full mb-1.5 z-50 hidden group-hover:block w-52">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-gray-500">Total Fee</span><span className="font-semibold text-gray-800 dark:text-gray-200">₹{originalAmt.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Coupon Discount</span><span className="font-semibold text-violet-600 dark:text-violet-400">−₹{discount.toLocaleString('en-IN')}</span></div>
              <div className="border-t border-gray-100 dark:border-gray-700 pt-1.5 flex justify-between"><span className="text-gray-500">Paid via Coupon</span><span className="font-semibold text-emerald-600">₹{discount.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Paid via Gateway</span><span className="font-semibold text-gray-400">₹0</span></div>
            </div>
          </div>
        </div>
      );
    }
    if (isPaid && hasCoupon && paidViaGateway > 0) {
      return (
        <div className="group relative">
          <div className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3 h-3" /> Paid ₹{paidViaGateway.toLocaleString('en-IN')}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-violet-500 dark:text-violet-400">
              <Tag className="w-2.5 h-2.5" /> Coupon −₹{discount.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="absolute left-0 bottom-full mb-1.5 z-50 hidden group-hover:block w-56">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-gray-500">Total Fee</span><span className="font-semibold text-gray-800 dark:text-gray-200">₹{originalAmt.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Coupon Discount</span><span className="font-semibold text-violet-600 dark:text-violet-400">−₹{discount.toLocaleString('en-IN')}</span></div>
              <div className="border-t border-gray-100 dark:border-gray-700 pt-1.5 flex justify-between"><span className="text-gray-500">Paid via Coupon</span><span className="font-semibold text-violet-600">₹{discount.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Paid via Gateway</span><span className="font-semibold text-blue-600 dark:text-blue-400">₹{paidViaGateway.toLocaleString('en-IN')}</span></div>
              {reg.latestPayment?.razorpayPaymentId && (
                <div className="pt-1 border-t border-gray-100 dark:border-gray-700"><span className="text-[10px] font-mono text-gray-400 break-all">{reg.latestPayment.razorpayPaymentId}</span></div>
              )}
            </div>
          </div>
        </div>
      );
    }
    if (isPaid) {
      return (
        <div className="flex flex-col gap-0.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> Paid{paidViaGateway ? ` ₹${paidViaGateway.toLocaleString('en-IN')}` : ''}
          </span>
          {reg.latestPayment?.razorpayPaymentId && (
            <span className="text-[10px] font-mono text-gray-400 break-all">{reg.latestPayment.razorpayPaymentId}</span>
          )}
        </div>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-500 dark:text-red-400">
        <XCircle className="w-3 h-3" /> Not Paid
      </span>
    );
  };

  // ── Action buttons (exposed via header-area — rendered inside tab) ──
  const ActionButtons = () => (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={handleExportCSV}
        className="inline-flex items-center gap-2 px-3 py-2 min-h-[40px] text-sm font-medium text-white bg-ev-700 rounded-lg hover:bg-ev-800 transition-colors"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Export CSV</span>
      </button>
      <button
        onClick={() => setShowEmailSlider(true)}
        className="inline-flex items-center gap-2 px-3 py-2 min-h-[40px] text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
      >
        <Mail className="w-4 h-4" />
        <span className="hidden sm:inline">Email</span>
      </button>
      <button
        onClick={() => setShowCertificateSlider(true)}
        className="inline-flex items-center gap-2 px-3 py-2 min-h-[40px] text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
      >
        <Award className="w-4 h-4" />
        <span className="hidden sm:inline">Certificate</span>
      </button>
    </div>
  );

  // ── TEAM PALETTE ──────────────────────────────────────────────
  const TEAM_PALETTE = [
    { bg: 'bg-blue-500', light: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-300 dark:border-blue-700', text: 'text-blue-700 dark:text-blue-300', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    { bg: 'bg-violet-500', light: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-300 dark:border-violet-700', text: 'text-violet-700 dark:text-violet-300', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
    { bg: 'bg-emerald-500', light: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-300 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    { bg: 'bg-orange-500', light: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-300 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-300', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
    { bg: 'bg-rose-500', light: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-300 dark:border-rose-700', text: 'text-rose-700 dark:text-rose-300', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
    { bg: 'bg-amber-500', light: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-300', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    { bg: 'bg-cyan-500', light: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-300 dark:border-cyan-700', text: 'text-cyan-700 dark:text-cyan-300', badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
    { bg: 'bg-pink-500', light: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-300 dark:border-pink-700', text: 'text-pink-700 dark:text-pink-300', badge: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
  ];

  const renderMemberRow = (reg: RegistrationRow, color: typeof TEAM_PALETTE[0], isLast: boolean) => {
    const name = getRegistrationDisplayName(reg);
    const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
    const identifier = getRegistrationIdentifier(reg);
    const school = getRegistrationSchool(reg);
    const dept = getRegistrationDepartment(reg);
    const isSelected = selectedRegIds.has(reg.id);
    return (
      <div
        key={reg.id}
        onClick={() => setDetailRegId(reg.id)}
        className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 cursor-pointer ${!isLast ? 'border-b border-gray-100 dark:border-gray-700' : ''} hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${isSelected ? 'bg-ev-50 dark:bg-ev-900/20' : ''}`}
      >
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-gray-300 text-ev-700 focus:ring-ev-700 cursor-pointer flex-shrink-0"
          checked={isSelected}
          onChange={() => toggleRegSelection(reg.id)}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-8 h-8 rounded-full ${color.bg} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{name}</p>
              {reg.isTeamLeader && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  <Crown className="w-2.5 h-2.5" /> Leader
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {reg.user_login?.email} {identifier ? `· ${identifier}` : ''}
            </p>
            {school && <p className="text-[11px] text-gray-400 truncate">{school}{dept ? ` · ${dept}` : ''}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-11 sm:ml-0">
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${STATUS_COLORS[reg.status as keyof typeof STATUS_COLORS]?.bg || 'bg-gray-100'} ${STATUS_COLORS[reg.status as keyof typeof STATUS_COLORS]?.text || 'text-gray-600'}`}>
            {reg.status}
          </span>
          {formatPayment(reg)}
          {reg.hasEntered
            ? <span title="Attended"><CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" /></span>
            : <span title="Not attended"><XCircle className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" /></span>
          }
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Action Buttons Row */}
      <ActionButtons />

      {/* Search + Filter + View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={regFilters.search || ''}
            onChange={(e) => setRegFilters(prev => ({ ...prev, search: e.target.value || undefined, page: 1 }))}
            placeholder="Search by name, email, UID, reg ID, team, or transaction ID..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-ev-700 focus:border-ev-700 transition-all"
          />
        </div>
        {/* View Mode Toggle */}
        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          <button
            type="button"
            onClick={() => setRegViewMode('table')}
            title="Table view"
            className={`px-3.5 py-2.5 flex items-center gap-1.5 text-sm font-medium transition-all ${regViewMode === 'table' ? 'bg-ev-700 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <LayoutList className="w-4 h-4" />
            <span className="hidden sm:inline">Table</span>
          </button>
          <button
            type="button"
            onClick={() => setRegViewMode('teams')}
            title="Team groups view"
            className={`px-3.5 py-2.5 flex items-center gap-1.5 text-sm font-medium border-l border-gray-300 dark:border-gray-600 transition-all ${regViewMode === 'teams' ? 'bg-ev-700 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">Teams</span>
          </button>
          <button
            type="button"
            onClick={() => setRegViewMode('guests')}
            title="Guest passes view"
            className={`px-3.5 py-2.5 flex items-center gap-1.5 text-sm font-medium border-l border-gray-300 dark:border-gray-600 transition-all ${regViewMode === 'guests' ? 'bg-ev-700 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Guests</span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
            showFilters
              ? 'bg-ev-50 dark:bg-ev-900/30 border-ev-700 text-ev-800 dark:text-ev-200'
              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {(() => {
            let cnt = 0;
            if (regFilters.role) cnt++;
            if (regFilters.gender) cnt++;
            if (regFilters.schoolId) cnt++;
            if (regFilters.departmentId) cnt++;
            if (regFilters.programId) cnt++;
            if (regFilters.passOutYear) cnt++;
            if (regFilters.uid) cnt++;
            if (regFilters.empId) cnt++;
            if (regFilters.status && regFilters.status !== 'all') cnt++;
            if (regFilters.paymentStatus && regFilters.paymentStatus !== 'all') cnt++;
            if (regFilters.teamSearch) cnt++;
            return cnt > 0 ? (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ev-700 text-white text-[10px] font-bold">{cnt}</span>
            ) : null;
          })()}
        </button>
      </div>

      {/* Payment Status + Team Quick Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">Payment:</span>
        {([
          { value: 'all', label: 'All', color: '#6366f1' },
          { value: 'completed', label: 'Paid', color: '#10b981' },
          { value: 'pending', label: 'Pending', color: '#f59e0b' },
          { value: 'failed', label: 'Failed', color: '#ef4444' },
        ] as const).map((ps) => {
          const active = (regFilters.paymentStatus || 'all') === ps.value;
          return (
            <button
              key={ps.value}
              type="button"
              onClick={() => setRegFilters(prev => ({ ...prev, paymentStatus: ps.value === 'all' ? undefined : ps.value, page: 1 }))}
              className="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
              style={active
                ? { backgroundColor: ps.color, color: 'white', borderColor: ps.color }
                : { backgroundColor: 'transparent', borderColor: '#d1d5db' }
              }
            >
              {ps.label}
            </button>
          );
        })}
        <div className="ml-2 h-4 w-px bg-gray-300 dark:bg-gray-600" />
        <div className="relative">
          <input
            type="text"
            value={regFilters.teamSearch || ''}
            onChange={(e) => setRegFilters(prev => ({ ...prev, teamSearch: e.target.value || undefined, page: 1 }))}
            placeholder="Filter by team name..."
            className="pl-3 pr-8 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-ev-700 focus:border-ev-700 transition-all w-44"
          />
          {regFilters.teamSearch && (
            <button
              type="button"
              onClick={() => setRegFilters(prev => ({ ...prev, teamSearch: undefined, page: 1 }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Selected participants bar */}
      {selectedRegIds.size > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-ev-50 dark:bg-ev-900/30 border border-sgt-200 dark:border-ev-800 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-medium text-ev-800 dark:text-ev-200">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ev-700 text-white text-xs font-bold">{selectedRegIds.size}</span>
            participant{selectedRegIds.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEmailSlider(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-ev-700 text-white rounded-md hover:bg-ev-800 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              Email selected
            </button>
            <button
              type="button"
              onClick={() => setShowCertificateSlider(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
            >
              <Award className="w-3.5 h-3.5" />
              Send Certificate
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        </div>
      )}

      {/* Layout: Filters sidebar (if open) + Content */}
      <div className={`flex gap-4 ${showFilters ? 'flex-col lg:flex-row' : ''}`}>
        {showFilters && (
          <div className="w-full lg:w-72 lg:min-w-[18rem] flex-shrink-0">
            <div className="lg:sticky lg:top-24">
              <RegistrationFilters
                filters={regFilters}
                options={regFilterOptions}
                optionsLoading={regFilterOptionsLoading}
                onFilterChange={handleRegFilterChange}
                onClose={() => setShowFilters(false)}
              />
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          {/* ── TEAM GROUPS VIEW ─────────────────────────────────── */}
          {regViewMode === 'teams' && (() => {
            const teamMap = new Map<string, typeof regData>();
            const soloRegs: typeof regData = [];
            regData.forEach(r => {
              if (r.teamId && r.team) {
                const key = r.teamId;
                if (!teamMap.has(key)) teamMap.set(key, []);
                teamMap.get(key)!.push(r);
              } else {
                soloRegs.push(r);
              }
            });
            const teamEntries = Array.from(teamMap.entries());
            const teamColorMap = new Map<string, typeof TEAM_PALETTE[0]>();
            teamEntries.forEach(([tid], idx) => { teamColorMap.set(tid, TEAM_PALETTE[idx % TEAM_PALETTE.length]); });

            return (
              <div className="space-y-4">
                {regLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-ev-700" /></div>}
                {teamEntries.map(([teamId, members], idx) => {
                  const color = teamColorMap.get(teamId)!;
                  const teamInfo = members[0]?.team;
                  const paidCount = members.filter(m => m.paymentStatus === 'completed' || m.latestPayment?.razorpayPaymentId).length;
                  const txId = members.find(m => m.latestPayment?.razorpayPaymentId)?.latestPayment?.razorpayPaymentId;
                  return (
                    <div key={teamId} className={`${CARD} overflow-hidden border-l-4 ${color.border}`}>
                      <div className={`px-4 py-3 ${color.light} flex flex-col sm:flex-row sm:items-center justify-between gap-2`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg ${color.bg} flex items-center justify-center text-white text-xs font-bold`}>
                            {(teamInfo?.name || 'T').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${color.text}`}>{teamInfo?.name || 'Unknown Team'}</p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{teamInfo?.teamId}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap ml-11 sm:ml-0">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${color.badge}`}>
                            <Users className="w-3 h-3 inline mr-1" />{members.length} members
                          </span>
                          {teamInfo?.isComplete
                            ? <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Finalized</span>
                            : <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Forming</span>
                          }
                          {paidCount > 0
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><CreditCard className="w-3 h-3" /> Paid</span>
                            : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"><CreditCard className="w-3 h-3" /> Unpaid</span>
                          }
                          {txId && <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 hidden lg:inline">TXN: {txId}</span>}
                        </div>
                      </div>
                      <div>{members.map((reg, mIdx) => renderMemberRow(reg, color, mIdx === members.length - 1))}</div>
                    </div>
                  );
                })}
                {soloRegs.length > 0 && (
                  <div className={`${CARD} overflow-hidden`}>
                    <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/40 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-500" />
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Individual Registrations ({soloRegs.length})</p>
                    </div>
                    {soloRegs.map((reg, idx) => renderMemberRow(reg, TEAM_PALETTE[7], idx === soloRegs.length - 1))}
                  </div>
                )}
                {!regLoading && regData.length === 0 && (
                  <div className={`${CARD} px-5 py-12 text-center`}>
                    <p className="text-gray-500 dark:text-gray-400">No registrations found</p>
                  </div>
                )}
                {regPagination && regPagination.totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Showing {((regPagination.page - 1) * regPagination.limit) + 1}–{Math.min(regPagination.page * regPagination.limit, regPagination.total)} of {regPagination.total}
                    </p>
                    <div className="flex items-center gap-1">
                      <button type="button" disabled={regPagination.page <= 1} onClick={() => handleRegPageChange(regPagination.page - 1)} className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
                      <button type="button" disabled={regPagination.page >= regPagination.totalPages} onClick={() => handleRegPageChange(regPagination.page + 1)} className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── TABLE VIEW ───────────────────────────────────────── */}
          {regViewMode === 'table' && (
            <div className={CARD}>
              <div className={`${CARD_HEADER} flex items-center justify-between`}>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Registrations {regPagination ? `(${regPagination.total})` : ''}
                </h3>
                {regLoading && <Loader2 className="w-4 h-4 animate-spin text-ev-700" />}
              </div>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-ev-700 focus:ring-ev-700 cursor-pointer"
                          checked={regData.length > 0 && selectedRegIds.size === regData.length}
                          ref={(el) => { if (el) el.indeterminate = selectedRegIds.size > 0 && selectedRegIds.size < regData.length; }}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Participant</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">ID / Reg No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">School / Dept</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Team</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Payment</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Registered</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Entry</th>
                      <th className="w-10 px-2 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {regData.length > 0 ? (
                      regData.map((reg) => (
                        <tr key={reg.id} onClick={() => setDetailRegId(reg.id)} className={`group hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer ${selectedRegIds.has(reg.id) ? 'bg-ev-50 dark:bg-ev-900/20' : ''}`}>
                          <td className="w-10 px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-ev-700 focus:ring-ev-700 cursor-pointer" checked={selectedRegIds.has(reg.id)} onChange={() => toggleRegSelection(reg.id)} />
                          </td>
                          <td className="px-4 py-3.5">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{getRegistrationDisplayName(reg)}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{reg.user_login?.email || reg.user_login?.uid || 'N/A'}</p>
                              {reg.user_login?.role && (
                                <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 capitalize">{reg.user_login.role}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="text-sm font-mono text-gray-900 dark:text-white">{getRegistrationIdentifier(reg)}</p>
                            <p className="text-[10px] font-mono text-gray-400 mt-0.5">{reg.registrationId}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="text-xs text-gray-700 dark:text-gray-300">{getRegistrationSchool(reg) || '—'}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{getRegistrationDepartment(reg)}</p>
                            {getRegistrationProgram(reg) && <p className="text-[10px] text-gray-400">{getRegistrationProgram(reg)}</p>}
                          </td>
                          <td className="px-4 py-3.5">
                            {reg.team ? (
                              <div>
                                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{reg.team.name}</p>
                                <p className="text-[10px] font-mono text-gray-400">{reg.team.teamId}</p>
                                {reg.isTeamLeader && (
                                  <span className="inline-flex items-center gap-0.5 mt-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                    <Crown className="w-2.5 h-2.5" /> Leader
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">{formatPayment(reg)}</td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[reg.status as keyof typeof STATUS_COLORS]?.bg || 'bg-gray-100'} ${STATUS_COLORS[reg.status as keyof typeof STATUS_COLORS]?.text || 'text-gray-600'}`}>
                              {reg.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {reg.registeredAt ? new Date(reg.registeredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                            </p>
                          </td>
                          <td className="px-4 py-3.5">
                            {reg.hasEntered ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-gray-400" />}
                          </td>
                          <td className="w-10 px-2 py-3.5">
                            <Eye className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-ev-700 transition-colors" />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={10} className="px-5 py-12 text-center">
                          <p className="text-gray-500 dark:text-gray-400">{regLoading ? 'Loading registrations...' : 'No registrations found'}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {regPagination && regPagination.totalPages > 1 && (
                <div className="px-3 sm:px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Showing {((regPagination.page - 1) * regPagination.limit) + 1}–{Math.min(regPagination.page * regPagination.limit, regPagination.total)} of {regPagination.total}
                  </p>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={regPagination.page <= 1} onClick={() => handleRegPageChange(regPagination.page - 1)} className="px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Prev</button>
                    {Array.from({ length: Math.min(regPagination.totalPages, 5) }, (_, i) => {
                      let pageNum: number;
                      if (regPagination.totalPages <= 5) { pageNum = i + 1; }
                      else if (regPagination.page <= 3) { pageNum = i + 1; }
                      else if (regPagination.page >= regPagination.totalPages - 2) { pageNum = regPagination.totalPages - 4 + i; }
                      else { pageNum = regPagination.page - 2 + i; }
                      return (
                        <button key={pageNum} type="button" onClick={() => handleRegPageChange(pageNum)} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${regPagination.page === pageNum ? 'bg-ev-700 text-white' : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>{pageNum}</button>
                      );
                    })}
                    <button type="button" disabled={regPagination.page >= regPagination.totalPages} onClick={() => handleRegPageChange(regPagination.page + 1)} className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">Next</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── GUESTS VIEW ─────────────────────────────────────── */}
          {regViewMode === 'guests' && (
            <div className={CARD}>
              <div className={`${CARD_HEADER} flex items-center justify-between`}>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Guest Passes ({guestRows.length})
                </h3>
                {regLoading && <Loader2 className="w-4 h-4 animate-spin text-ev-700" />}
              </div>
              <div className="overflow-x-auto -mx-1">
                <table className="w-full min-w-[980px]">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Guest Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Guest Email</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Mobile</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Relationship</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Pass Holder</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Reg ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Team</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Added On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {guestRows.length > 0 ? (
                      guestRows.map((guest) => (
                        <tr key={guest.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                          <td className="px-4 py-3.5">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{guest.guestName}</p>
                          </td>
                          <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-gray-300">{guest.guestEmail}</td>
                          <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-gray-300">{guest.mobileNumber}</td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 capitalize">
                              {guest.relationship}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{guest.passHolderName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{guest.passHolderEmail}</p>
                          </td>
                          <td className="px-4 py-3.5 text-xs font-mono text-gray-600 dark:text-gray-300">{guest.registrationId}</td>
                          <td className="px-4 py-3.5">
                            {guest.teamName ? (
                              <div>
                                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{guest.teamName}</p>
                                <p className="text-[10px] font-mono text-gray-400">{guest.teamId}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-gray-600 dark:text-gray-400">
                            {guest.createdAt
                              ? new Date(guest.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                              : '—'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-5 py-12 text-center">
                          <p className="text-gray-500 dark:text-gray-400">{regLoading ? 'Loading guests...' : 'No guest passes found'}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Email Slider */}
      <EmailSlider
        open={showEmailSlider}
        onClose={() => setShowEmailSlider(false)}
        eventId={eventId}
        eventName={event?.name || ''}
        selectedRegistrationIds={selectedRegIds.size > 0 ? Array.from(selectedRegIds) : undefined}
      />

      {/* Certificate Slider */}
      <CertificateSlider
        open={showCertificateSlider}
        onClose={() => setShowCertificateSlider(false)}
        eventId={eventId}
        eventName={event?.name || ''}
        selectedRegistrationIds={selectedRegIds.size > 0 ? Array.from(selectedRegIds) : undefined}
      />

      {/* Registration Detail Modal */}
      <RegistrationDetailModal
        eventId={eventId}
        registrationId={detailRegId}
        onClose={() => setDetailRegId(null)}
      />
    </div>
  );
}
