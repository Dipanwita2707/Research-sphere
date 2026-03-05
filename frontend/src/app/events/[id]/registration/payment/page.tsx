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
} from 'lucide-react';
import { eventService } from '@/features/event-management/services/event.service';
import { usePayment } from '@/features/event-management/hooks/usePayment';
import { useAuthStore } from '@/shared/auth/authStore';
import { useToast } from '@/shared/ui-components/Toast';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import type { PaymentStatusResponse } from '@/features/event-management/types/event.types';

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

  // Fetch event info and payment status
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [formData, status] = await Promise.all([
        eventService.getRegistrationForm(eventId),
        eventService.getPaymentStatus(eventId).catch(() => null),
      ]);
      setEventData({
        name: formData.event.name,
        registrationFee: formData.event.registrationFee || 0,
        amountPaid: formData.existingRegistration?.amountPaid,
        paymentType: formData.event.paymentType,
        participationType: formData.event.participationType || 'individual',
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-gray-500">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (!eventData || eventData.paymentType !== 'paid') {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Payment Required</h2>
          <p className="text-gray-500 mb-6">This event does not require payment.</p>
          <Link
            href={`/events/${eventId}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
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
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors mb-3 group"
          >
            <div className="p-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 group-hover:border-blue-200 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
            </div>
            Back to Event
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            Complete Payment
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Pay to confirm your registration for <span className="font-semibold text-gray-900 dark:text-white">{eventData.name}</span>
          </p>
        </div>

        {/* Payment Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
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
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium"
              >
                View Event <ArrowLeft className="w-4 h-4 rotate-180" />
              </Link>
            </div>
          ) : (
            <>
              {/* Fee Summary */}
              <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  Payment Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Event</span>
                    <span className="font-medium text-gray-900 dark:text-white">{eventData.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Type</span>
                    <span className="font-medium text-gray-900 dark:text-white capitalize">Individual Registration</span>
                  </div>
                  <div className="h-px bg-gray-200 dark:bg-gray-700" />
                  {/* Show discount row if coupon was applied */}
                  {eventData.amountPaid != null && eventData.amountPaid < eventData.registrationFee && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Original Fee</span>
                        <span className="text-gray-400 line-through">₹{eventData.registrationFee.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Coupon Discount</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          −₹{(eventData.registrationFee - eventData.amountPaid).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="h-px bg-gray-200 dark:bg-gray-700" />
                    </>
                  )}
                  <div className="flex items-center justify-between text-lg">
                    <span className="font-semibold text-gray-900 dark:text-white">Total Amount</span>
                    <span className="flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 text-2xl">
                      <IndianRupee className="w-5 h-5" />
                      {(eventData.amountPaid ?? eventData.registrationFee).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
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
                  onClick={initiateIndividualPayment}
                  disabled={isProcessing || rzpLoading}
                  className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl
                    transition-all duration-200 flex items-center justify-center gap-3 text-lg shadow-lg shadow-blue-200/50 dark:shadow-blue-900/30
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
                      Pay ₹{(eventData.amountPaid ?? eventData.registrationFee).toLocaleString('en-IN')}
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
