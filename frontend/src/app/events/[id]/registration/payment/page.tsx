'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Shield,
  IndianRupee,
  Loader2,
  RefreshCw,
  XCircle,
  Tag,
  X as XIcon,
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import { usePayment } from '@/features/event-management/hooks/usePayment';
import { useAuthStore } from '@/shared/auth/authStore';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import type { CouponValidationResult, PaymentStatusResponse } from '@/features/event-management/types/event.types';

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const eventId = params.id as string;
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState<{
    name: string;
    registrationFee: number;
    amountPaid?: number | null;
    paymentType: string;
    participationType: string;
  } | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusResponse | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponResult, setCouponResult] = useState<CouponValidationResult | null>(null);
  const [couponValidating, setCouponValidating] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponMode, setCouponMode] = useState<'untouched' | 'applied' | 'cleared'>('untouched');

  // Fetch event info and payment status
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [paymentContext, status] = await Promise.all([
        eventService.getPaymentContext(eventId),
        eventService.getPaymentStatus(eventId).catch(() => null),
      ]);
      setEventData({
        name: paymentContext.event.name,
        registrationFee: paymentContext.event.registrationFee || 0,
        amountPaid: paymentContext.existingRegistration?.amountPaid,
        paymentType: paymentContext.event.paymentType,
        participationType: paymentContext.event.participationType || 'individual',
      });
      setPaymentStatus(status);
    } catch (err) {
      toast({ type: 'error', message: getErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const {
    initiateIndividualPayment,
    isProcessing,
    isLoading: rzpLoading,
    error: paymentError,
    clearError,
  } = usePayment({
    eventId,
    eventName: eventData?.name || 'Event',
    user: user
      ? {
          name: user.employee?.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          email: user.email || '',
          phone: user.employeeDetails?.phone || '',
        }
      : undefined,
    onSuccess: () => {
      toast({ type: 'success', message: 'Payment successful! Registration confirmed.' });
      setTimeout(() => router.push(`/events/${eventId}`), 1500);
    },
    onError: (msg) => {
      toast({ type: 'error', message: msg });
    },
    onDismiss: () => {
      toast({ type: 'info', message: 'Payment cancelled. You can try again.' });
    },
  });

  // Already paid?
  const isPaid = paymentStatus?.isPaid;

  // Coupon covered 100%: amountPaid is 0 and no Razorpay payment exists
  const isCouponFree = eventData?.amountPaid === 0;
  const savedDiscountAmount = eventData && eventData.amountPaid != null && eventData.amountPaid < eventData.registrationFee
    ? eventData.registrationFee - eventData.amountPaid
    : 0;
  const effectiveAmount = couponMode === 'applied' && couponResult
    ? couponResult.finalAmount
    : (eventData?.amountPaid ?? eventData?.registrationFee ?? 0);
  const effectiveDiscountAmount = couponMode === 'applied' && couponResult
    ? couponResult.discountAmount
    : savedDiscountAmount;

  const handleValidateCoupon = async () => {
    if (!couponInput.trim() || !eventData) return;

    setCouponValidating(true);
    setCouponError(null);

    try {
      const result = await eventService.validateCoupon(eventId, couponInput.trim(), eventData.registrationFee);
      setCouponInput(result.code);
      setCouponCode(result.code);
      setCouponResult(result);
      setCouponMode('applied');
    } catch (err) {
      setCouponCode(null);
      setCouponResult(null);
      setCouponMode('untouched');
      setCouponError(getErrorMessage(err));
    } finally {
      setCouponValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponInput('');
    setCouponCode(null);
    setCouponResult(null);
    setCouponError(null);
    setCouponMode('cleared');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc]/50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-ev-700" />
          <p className="text-gray-500">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (!eventData || eventData.paymentType !== 'paid') {
    return (
      <div className="min-h-screen bg-[#f8fafc]/50 dark:bg-gray-950 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-ev-900 dark:text-white mb-2">No Payment Required</h2>
          <p className="text-gray-500 mb-6">This event does not require payment.</p>
          <Link
            href={`/events/${eventId}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-ev-700 text-white rounded-xl hover:bg-ev-800 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Event
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/events/${eventId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-ev-700 transition-colors mb-3 group"
          >
            <div className="p-1.5 rounded-full bg-white dark:bg-gray-800 border border-[#b3cde0] dark:border-gray-700 group-hover:border-ev-200 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
            </div>
            Back to Event
          </Link>
          <h1 className="text-3xl font-bold text-ev-900 dark:text-white tracking-tight">
            Complete Payment
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Pay to confirm your registration for <span className="font-semibold text-ev-900 dark:text-white">{eventData.name}</span>
          </p>
        </div>

        {/* Payment Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-ev border border-[#b3cde0] dark:border-gray-800 overflow-hidden">
          {/* Success State */}
          {isPaid || isCouponFree ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">
                {isCouponFree ? 'Registration Confirmed!' : 'Payment Complete!'}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-1">
                {isCouponFree ? 'Coupon covered the full amount.' : 'Your registration has been confirmed.'}
              </p>
              {paymentStatus?.latestPayment?.razorpayPaymentId && (
                <p className="text-sm text-gray-400 mb-6">
                  Payment ID: {paymentStatus.latestPayment.razorpayPaymentId}
                </p>
              )}
              <Link
                href={`/events/${eventId}`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-ev-700 text-white rounded-xl hover:bg-ev-800 transition font-medium"
              >
                View Event <ArrowLeft className="w-4 h-4 rotate-180" />
              </Link>
            </div>
          ) : (
            <>
              {/* Fee Summary */}
              <div className="p-6 border-b border-[#b3cde0]/30 dark:border-gray-800">
                <h3 className="text-lg font-semibold text-ev-900 dark:text-white mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-ev-700" />
                  Payment Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Event</span>
                    <span className="font-medium text-ev-900 dark:text-white">{eventData.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Type</span>
                    <span className="font-medium text-ev-900 dark:text-white capitalize">Individual Registration</span>
                  </div>
                  <div className="h-px bg-gray-200 dark:bg-gray-700" />
                  {/* Show discount row if coupon was applied */}
                  {effectiveDiscountAmount > 0 && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Original Fee</span>
                        <span className="text-gray-400 line-through">₹{eventData.registrationFee.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Coupon Discount</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          −₹{effectiveDiscountAmount.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="h-px bg-gray-200 dark:bg-gray-700" />
                    </>
                  )}
                  <div className="flex items-center justify-between text-lg">
                    <span className="font-semibold text-ev-900 dark:text-white">Total Amount</span>
                    <span className="flex items-center gap-1 font-bold text-ev-700 dark:text-ev-400 text-2xl">
                      <IndianRupee className="w-5 h-5" />
                      {effectiveAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 border-b border-[#b3cde0]/30 dark:border-gray-800 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-ev-900 dark:text-white flex items-center gap-2">
                    <Tag className="w-5 h-5 text-emerald-600" />
                    Apply Coupon
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Add your coupon here before creating the payment order.
                  </p>
                </div>

                {couponMode === 'untouched' && savedDiscountAmount > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                    A discount is already attached to this registration and will be used unless you replace or remove it.
                  </div>
                )}

                {couponMode === 'applied' && couponResult ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        <div>
                          <p className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300">{couponResult.code}</p>
                          {couponResult.description && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">{couponResult.description}</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="p-1 text-emerald-600 transition-colors hover:text-red-500 dark:text-emerald-400"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2 rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800/60">
                      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                        <span>Original Amount</span>
                        <span>₹{couponResult.originalAmount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        <span>Discount</span>
                        <span>−₹{couponResult.discountAmount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-[#b3cde0] pt-2 text-sm font-semibold text-ev-900 dark:border-gray-700 dark:text-white">
                        <span>Payable</span>
                        <span>₹{couponResult.finalAmount.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase());
                        setCouponError(null);
                        if (couponMode === 'cleared') {
                          setCouponMode('untouched');
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleValidateCoupon();
                        }
                      }}
                      placeholder="Enter coupon code"
                      className="flex-1 rounded-xl border border-[#b3cde0] bg-white px-4 py-3 font-mono uppercase text-ev-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleValidateCoupon}
                      disabled={couponValidating || !couponInput.trim()}
                      className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {couponValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                    </button>
                  </div>
                )}

                {couponError && (
                  <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{couponError}</span>
                  </div>
                )}

                {couponMode === 'cleared' && savedDiscountAmount > 0 && (
                  <div className="text-sm text-amber-600 dark:text-amber-400">
                    Saved coupon discount will be removed when you proceed with payment.
                  </div>
                )}
              </div>

              {/* Security Badge */}
              <div className="px-6 py-3 bg-green-50 dark:bg-green-950/30 flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                <Shield className="w-4 h-4 flex-shrink-0" />
                <span>Secured by Razorpay. Your payment information is encrypted.</span>
              </div>

              {/* Error Display */}
              {paymentError && (
                <div className="px-6 py-3 bg-red-50 dark:bg-red-950/30 flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                  <XCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{paymentError}</span>
                  <button onClick={clearError} className="text-red-500 hover:text-red-700 text-xs underline">
                    Dismiss
                  </button>
                </div>
              )}

              {/* Pay Button */}
              <div className="p-6">
                <button
                  onClick={() => initiateIndividualPayment(
                    couponMode === 'applied'
                      ? couponCode
                      : couponMode === 'cleared'
                        ? null
                        : undefined
                  )}
                  disabled={isProcessing || rzpLoading}
                  className="w-full py-4 px-6 bg-ev-700 hover:bg-ev-800 disabled:bg-ev-400 text-white font-semibold rounded-xl
                    transition-all duration-200 flex items-center justify-center gap-3 text-lg shadow-lg shadow-ev-200/50 dark:shadow-ev-900/30
                    disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verifying Payment...
                    </>
                  ) : rzpLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Preparing Payment...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      Pay ₹{effectiveAmount.toLocaleString('en-IN')}
                    </>
                  )}
                </button>

                {/* Retry hint */}
                {paymentStatus?.latestPayment?.status === 'failed' && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-4 py-3">
                    <RefreshCw className="w-4 h-4 flex-shrink-0" />
                    <span>Your previous payment attempt failed. Please try again.</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-gray-400">
          <p>Having trouble? Contact the event organizer for assistance.</p>
          <p className="mt-1">Payment powered by <span className="font-medium text-gray-600 dark:text-gray-300">Razorpay</span></p>
        </div>
      </div>
    </div>
  );
}
