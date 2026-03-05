'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Loader2, Copy, CheckCircle2, XCircle, User, CreditCard, Tag, Users,
  LogIn, LogOut, Clock, Shield, Hash, Mail, Phone, Crown, ArrowUpRight,
  Calendar, IndianRupee, AlertCircle, FileText,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import { getRegistrationDisplayName, getRegistrationIdentifier } from '@/features/event-management/types/registrationFilter.types';

// ── Types ────────────────────────────────────────────────────────
interface PaymentRecord {
  id: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  razorpaySignature?: string | null;
  amount?: number;
  currency?: string;
  status?: string;
  paymentFor?: string;
  receipt?: string;
  attempts?: number;
  paidAt?: string | null;
  failedAt?: string | null;
  refundedAt?: string | null;
  webhookVerified?: boolean;
  metadata?: Record<string, any> | null;
  createdAt?: string;
  updatedAt?: string;
}

interface TeamMember {
  id: string;
  registrationId: string;
  status: string;
  paymentStatus?: string;
  amountPaid?: number;
  isTeamLeader?: boolean;
  registeredAt?: string;
  user_login?: {
    id: string;
    uid: string;
    email?: string;
    role: string;
    studentLogin?: { firstName: string; lastName?: string; displayName?: string; registrationNo?: string; studentId?: string };
    employeeDetails?: { firstName: string; lastName?: string; displayName?: string; empId?: string };
  };
}

interface EntryLog {
  id: string;
  entryType: string;
  gateLocation?: string | null;
  scannedAt: string;
  remarks?: string | null;
  scannedBy?: { uid: string; email?: string } | null;
}

interface CouponDetail {
  id: string;
  code?: string;
  discountType?: string;
  discountValue?: number;
  isActive?: boolean;
  usedAt?: string;
}

interface RegistrationDetail {
  id: string;
  registrationId: string;
  eventId: string;
  userId: string;
  status: string;
  paymentStatus?: string;
  amountPaid?: number;
  couponId?: string | null;
  discountAmount?: number | null;
  originalAmount?: number | null;
  formData?: Record<string, any> | null;
  qrCode?: string;
  isTeamLeader?: boolean;
  hasEntered: boolean;
  enteredAt?: string;
  registeredAt: string;
  updatedAt: string;
  user_login?: any;
  team?: {
    id: string;
    teamId: string;
    name: string;
    status: string;
    isComplete: boolean;
    isLocked: boolean;
    leaderId: string;
    members?: TeamMember[];
  } | null;
  payments: PaymentRecord[];
  entries: EntryLog[];
  couponDetails: CouponDetail | null;
}

interface RegistrationDetailModalProps {
  eventId: string;
  registrationId: string | null; // null = closed
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────
const PAYMENT_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  captured: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400' },
  authorized: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400' },
  created: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400' },
  failed: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400' },
  refunded: { bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-700 dark:text-violet-400' },
};

const REG_STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400' },
  pending: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400' },
  cancelled: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400' },
  INCOMPLETE_TEAM: { bg: 'bg-gray-50 dark:bg-gray-700/30', text: 'text-gray-600 dark:text-gray-400' },
};

function formatDate(d?: string | null, withTime = false): string {
  if (!d) return '—';
  const date = new Date(d);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  if (withTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
  return date.toLocaleString('en-IN', opts);
}

function getMemberName(m: TeamMember): string {
  const u = m.user_login;
  if (!u) return 'Unknown';
  if (u.studentLogin) return u.studentLogin.displayName || `${u.studentLogin.firstName} ${u.studentLogin.lastName || ''}`.trim();
  if (u.employeeDetails) return u.employeeDetails.displayName || `${u.employeeDetails.firstName} ${u.employeeDetails.lastName || ''}`.trim();
  return u.uid;
}

// ── Component ────────────────────────────────────────────────────
export default function RegistrationDetailModal({ eventId, registrationId, onClose }: RegistrationDetailModalProps) {
  const [data, setData] = useState<RegistrationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Fetch data on open
  useEffect(() => {
    if (!registrationId) { setData(null); return; }
    setLoading(true);
    setError(null);
    eventService.getRegistrationDetails(eventId, registrationId)
      .then(setData)
      .catch((err: any) => setError(err?.response?.data?.message || 'Failed to load registration details'))
      .finally(() => setLoading(false));
  }, [eventId, registrationId]);

  // ESC to close
  useEffect(() => {
    if (!registrationId) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [registrationId, onClose]);

  // Click outside
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  }, [onClose]);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch { /* ignore */ }
  }, []);

  if (!registrationId) return null;

  const user = data?.user_login;
  const userName = data ? getRegistrationDisplayName(data as any) : '';
  const userIdentifier = data ? getRegistrationIdentifier(data as any) : '';
  const successfulPayment = data?.payments?.find(p => p.status === 'captured' || p.status === 'authorized');

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl flex flex-col max-h-[90vh] animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* ── Header ──────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800 rounded-t-xl">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Registration Details</h2>
            {data && (
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{data.registrationId}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-sgt-600 mr-2" />
              <span className="text-gray-500">Loading details...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {data && !loading && (
            <>
              {/* ── 1. User Info ───────────────────────── */}
              <Section icon={User} title="Participant Info">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <InfoRow label="Name" value={userName} />
                  <InfoRow label="ID / Reg No" value={userIdentifier} mono />
                  <InfoRow label="Email" value={user?.email || '—'} />
                  <InfoRow label="UID" value={user?.uid || '—'} mono />
                  <InfoRow label="Role" value={user?.role || '—'} capitalize />
                  {user?.phone && <InfoRow label="Phone" value={user.phone} />}
                  {user?.studentLogin?.gender && <InfoRow label="Gender" value={user.studentLogin.gender} capitalize />}
                  {user?.studentLogin?.program && (
                    <InfoRow
                      label="Program"
                      value={`${user.studentLogin.program.programName}${user.studentLogin.program.department ? ` — ${user.studentLogin.program.department.departmentName}` : ''}`}
                    />
                  )}
                  {(user?.studentLogin?.program?.department?.faculty || user?.employeeDetails?.primarySchool) && (
                    <InfoRow
                      label="School"
                      value={user.studentLogin?.program?.department?.faculty?.facultyName || user.employeeDetails?.primarySchool?.facultyName || '—'}
                    />
                  )}
                </div>
              </Section>

              {/* ── 2. Registration Status ─────────────── */}
              <Section icon={FileText} title="Registration">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <InfoRow label="Status">
                    <StatusBadge value={data.status} styles={REG_STATUS_STYLES} />
                  </InfoRow>
                  <InfoRow label="Payment Status">
                    <StatusBadge value={data.paymentStatus || 'N/A'} styles={PAYMENT_STATUS_STYLES} />
                  </InfoRow>
                  <InfoRow label="Registered" value={formatDate(data.registeredAt, true)} />
                  <InfoRow label="Last Updated" value={formatDate(data.updatedAt, true)} />
                  <InfoRow label="Entry">
                    {data.hasEntered ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Entered {data.enteredAt ? `at ${formatDate(data.enteredAt, true)}` : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Not entered yet</span>
                    )}
                  </InfoRow>
                </div>
              </Section>

              {/* ── 3. Payment Details ─────────────────── */}
              <Section icon={CreditCard} title="Payment Details">
                {data.payments.length === 0 ? (
                  <p className="text-sm text-gray-400">No payment records</p>
                ) : (
                  <div className="space-y-4">
                    {/* Payment summary */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                      <InfoRow label="Original Fee" value={data.originalAmount != null ? `₹${data.originalAmount.toLocaleString('en-IN')}` : '—'} />
                      <InfoRow label="Discount" value={data.discountAmount ? `−₹${data.discountAmount.toLocaleString('en-IN')}` : '—'} />
                      <InfoRow label="Amount Paid" value={data.amountPaid != null ? `₹${data.amountPaid.toLocaleString('en-IN')}` : '—'} />
                    </div>

                    {/* Individual payment records */}
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-3">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Transaction Records</p>
                      {data.payments.map((p, idx) => (
                        <div key={p.id} className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <StatusBadge value={p.status || 'unknown'} styles={PAYMENT_STATUS_STYLES} />
                              <span className="text-xs text-gray-400">#{data.payments.length - idx}</span>
                            </div>
                            {p.amount != null && (
                              <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                ₹{(p.amount / 100).toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                            {p.razorpayPaymentId && (
                              <CopyableField label="Payment ID" value={p.razorpayPaymentId} fieldKey={`pay-${p.id}`} copiedField={copiedField} onCopy={copyToClipboard} />
                            )}
                            {p.razorpayOrderId && (
                              <CopyableField label="Order ID" value={p.razorpayOrderId} fieldKey={`ord-${p.id}`} copiedField={copiedField} onCopy={copyToClipboard} />
                            )}
                            {p.receipt && <InfoRow label="Receipt" value={p.receipt} mono small />}
                            {p.paidAt && <InfoRow label="Paid At" value={formatDate(p.paidAt, true)} small />}
                            {p.failedAt && <InfoRow label="Failed At" value={formatDate(p.failedAt, true)} small />}
                            {p.refundedAt && <InfoRow label="Refunded At" value={formatDate(p.refundedAt, true)} small />}
                            {p.paymentFor && <InfoRow label="Payment For" value={p.paymentFor} capitalize small />}
                            {p.webhookVerified != null && (
                              <InfoRow label="Webhook Verified" small>
                                {p.webhookVerified ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Shield className="w-3 h-3" /> Yes</span>
                                ) : (
                                  <span className="text-xs text-gray-400">No</span>
                                )}
                              </InfoRow>
                            )}
                            {p.attempts != null && p.attempts > 0 && <InfoRow label="Attempts" value={String(p.attempts)} small />}
                          </div>
                          {p.metadata && Object.keys(p.metadata).length > 0 && (
                            <div className="pt-1.5 border-t border-gray-200 dark:border-gray-600">
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Metadata</p>
                              <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded p-2 max-h-20 overflow-y-auto">
                                {Object.entries(p.metadata).map(([k, v]) => (
                                  <div key={k}><span className="text-gray-400">{k}:</span> {String(v)}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              {/* ── 4. Coupon Info ─────────────────────── */}
              {data.couponDetails && (
                <Section icon={Tag} title="Coupon">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {data.couponDetails.code && <InfoRow label="Code" value={data.couponDetails.code} mono />}
                    {data.couponDetails.discountType && (
                      <InfoRow
                        label="Discount"
                        value={
                          data.couponDetails.discountType === 'percentage'
                            ? `${data.couponDetails.discountValue}%`
                            : `₹${data.couponDetails.discountValue?.toLocaleString('en-IN')}`
                        }
                      />
                    )}
                    <InfoRow label="Applied Discount" value={data.discountAmount ? `₹${data.discountAmount.toLocaleString('en-IN')}` : '—'} />
                    {data.couponDetails.usedAt && <InfoRow label="Used At" value={formatDate(data.couponDetails.usedAt, true)} />}
                  </div>
                </Section>
              )}

              {/* ── 5. Team Info ───────────────────────── */}
              {data.team && (
                <Section icon={Users} title="Team">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-3">
                    <InfoRow label="Team Name" value={data.team.name} />
                    <InfoRow label="Team ID" value={data.team.teamId} mono />
                    <InfoRow label="Status">
                      <StatusBadge value={data.team.status} styles={REG_STATUS_STYLES} />
                    </InfoRow>
                    <InfoRow label="Complete">
                      {data.team.isComplete ? (
                        <span className="text-xs text-emerald-600 font-semibold">Yes</span>
                      ) : (
                        <span className="text-xs text-amber-600 font-semibold">No</span>
                      )}
                    </InfoRow>
                  </div>
                  {data.team.members && data.team.members.length > 0 && (
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Members ({data.team.members.length})</p>
                      <div className="space-y-1.5">
                        {data.team.members.map(m => (
                          <div key={m.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/30 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{getMemberName(m)}</span>
                              {m.isTeamLeader && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                  <Crown className="w-2.5 h-2.5" /> Leader
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusBadge value={m.status} styles={REG_STATUS_STYLES} />
                              {m.paymentStatus && <StatusBadge value={m.paymentStatus} styles={PAYMENT_STATUS_STYLES} />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Section>
              )}

              {/* ── 6. Entry Logs ──────────────────────── */}
              {data.entries.length > 0 && (
                <Section icon={LogIn} title="Entry / Exit Logs">
                  <div className="space-y-1.5">
                    {data.entries.map(e => (
                      <div key={e.id} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/30 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          {e.entryType === 'entry' ? (
                            <LogIn className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <LogOut className="w-3.5 h-3.5 text-red-500" />
                          )}
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">{e.entryType}</span>
                          {e.gateLocation && <span className="text-xs text-gray-400">@ {e.gateLocation}</span>}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">{formatDate(e.scannedAt, true)}</p>
                          {e.scannedBy && <p className="text-[10px] text-gray-400">by {e.scannedBy.uid}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* ── 7. Form Data (custom fields) ──────── */}
              {data.formData && Object.keys(data.formData).length > 0 && (
                <Section icon={FileText} title="Form Responses">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {Object.entries(data.formData).map(([key, val]) => (
                      <InfoRow key={key} label={key} value={String(val ?? '—')} />
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<any>; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-sgt-600 dark:text-sgt-400" />
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  capitalize: cap,
  small,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  capitalize?: boolean;
  small?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={small ? 'flex flex-col' : ''}>
      <span className={`${small ? 'text-[10px]' : 'text-xs'} text-gray-500 dark:text-gray-400`}>{label}</span>
      {children || (
        <p className={`${small ? 'text-xs' : 'text-sm'} font-medium text-gray-800 dark:text-gray-200 ${mono ? 'font-mono' : ''} ${cap ? 'capitalize' : ''} break-all`}>
          {value || '—'}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ value, styles }: { value: string; styles: Record<string, { bg: string; text: string }> }) {
  const s = styles[value] || { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${s.bg} ${s.text}`}>
      {value}
    </span>
  );
}

function CopyableField({
  label,
  value,
  fieldKey,
  copiedField,
  onCopy,
}: {
  label: string;
  value: string;
  fieldKey: string;
  copiedField: string | null;
  onCopy: (text: string, field: string) => void;
}) {
  const isCopied = copiedField === fieldKey;
  return (
    <div>
      <span className="text-[10px] text-gray-500 dark:text-gray-400">{label}</span>
      <div className="flex items-center gap-1.5 group">
        <p className="text-xs font-mono font-medium text-gray-800 dark:text-gray-200 break-all">{value}</p>
        <button
          type="button"
          onClick={() => onCopy(value, fieldKey)}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-all flex-shrink-0"
          title="Copy to clipboard"
        >
          {isCopied ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-gray-400" />
          )}
        </button>
      </div>
    </div>
  );
}
