/**
 * usePayment — Custom hook for Razorpay payment flow
 *
 * Handles:
 *   - Individual event payments
 *   - Team event payments (leader only)
 *   - Loading Razorpay Checkout script
 *   - Creating orders via backend
 *   - Opening Razorpay Checkout modal
 *   - Verifying payment signatures via backend
 *   - Error handling and loading states
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { eventService } from '@/features/event-management/services/event.service';
import { loadRazorpayScript } from '@/shared/utils/razorpay';
import type {
  RazorpayOrderResponse,
  PaymentVerificationRequest,
  RazorpayCheckoutOptions,
} from '@/features/event-management/types/event.types';

interface UsePaymentOptions {
  eventId: string;
  eventName: string;
  /** User info for Razorpay prefill */
  user?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  /** Callback on successful payment verification */
  onSuccess?: (data: { message: string }) => void;
  /** Callback on payment failure */
  onError?: (error: string) => void;
  /** Callback when user dismisses checkout modal */
  onDismiss?: () => void;
}

interface UsePaymentReturn {
  /** Initiate individual payment flow */
  initiateIndividualPayment: () => Promise<void>;
  /** Initiate team payment flow */
  initiateTeamPayment: (teamId: string, couponCode?: string) => Promise<void>;
  /** Whether payment is in progress */
  isProcessing: boolean;
  /** Whether Razorpay script is loading */
  isLoading: boolean;
  /** Current error message */
  error: string | null;
  /** Clear error */
  clearError: () => void;
}

export const usePayment = ({
  eventId,
  eventName,
  user,
  onSuccess,
  onError,
  onDismiss,
}: UsePaymentOptions): UsePaymentReturn => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false); // Prevent double-clicks

  const clearError = useCallback(() => setError(null), []);

  /**
   * Open Razorpay Checkout modal and handle the response.
   */
  const openCheckout = useCallback(
    (
      orderData: RazorpayOrderResponse,
      verifyFn: (payload: PaymentVerificationRequest) => Promise<{ message: string }>,
      description: string,
    ) => {
      const options: RazorpayCheckoutOptions = {
        key: orderData.key,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'SGT University',
        description,
        order_id: orderData.order.id,
        handler: async (response: PaymentVerificationRequest) => {
          try {
            setIsProcessing(true);
            const result = await verifyFn(response);
            onSuccess?.(result);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Payment verification failed';
            setError(msg);
            onError?.(msg);
          } finally {
            setIsProcessing(false);
            processingRef.current = false;
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        notes: {
          eventId,
          eventName,
        },
        theme: {
          color: '#1e40af', // Blue-800
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            processingRef.current = false;
            onDismiss?.();
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    },
    [eventId, eventName, user, onSuccess, onError, onDismiss],
  );

  /**
   * Individual Payment Flow
   */
  const initiateIndividualPayment = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setError(null);
    setIsLoading(true);

    try {
      // 1. Load Razorpay Checkout script
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        throw new Error('Failed to load payment gateway. Please check your internet connection.');
      }

      // 2. Create order on backend
      const orderData: RazorpayOrderResponse = await eventService.createIndividualPaymentOrder(eventId);

      // 2b. If coupon covered 100% → no Razorpay needed, already confirmed
      if ((orderData as any).couponFullyFree) {
        setIsLoading(false);
        setIsProcessing(false);
        processingRef.current = false;
        onSuccess?.({ message: (orderData as any).message || 'Registration confirmed — coupon covered the full amount!' });
        return;
      }

      setIsLoading(false);
      setIsProcessing(true);

      // 3. Open Razorpay Checkout
      openCheckout(
        orderData,
        (payload) => eventService.verifyIndividualPayment(eventId, payload),
        `Registration: ${eventName}`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create payment order';
      setError(msg);
      onError?.(msg);
      setIsLoading(false);
      setIsProcessing(false);
      processingRef.current = false;
    }
  }, [eventId, eventName, openCheckout, onError]);

  /**
   * Team Payment Flow
   */
  const initiateTeamPayment = useCallback(
    async (teamId: string, couponCode?: string) => {
      if (processingRef.current) return;
      processingRef.current = true;
      setError(null);
      setIsLoading(true);

      try {
        // 1. Load Razorpay Checkout script
        const loaded = await loadRazorpayScript();
        if (!loaded) {
          throw new Error('Failed to load payment gateway. Please check your internet connection.');
        }

        // 2. Create team order on backend
        const orderData: RazorpayOrderResponse = await eventService.createTeamPaymentOrder(eventId, teamId, couponCode);

        // 2b. If coupon covered 100% → no Razorpay needed, backend already confirmed
        if ((orderData as any).couponFullyFree) {
          setIsLoading(false);
          setIsProcessing(false);
          processingRef.current = false;
          onSuccess?.({ message: (orderData as any).message || 'Registration confirmed — coupon covered the full amount!' });
          return;
        }

        setIsLoading(false);
        setIsProcessing(true);

        // 3. Open Razorpay Checkout
        openCheckout(
          orderData,
          (payload) => eventService.verifyTeamPayment(eventId, teamId, payload),
          `Team Registration: ${eventName}`,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create team payment order';
        setError(msg);
        onError?.(msg);
        setIsLoading(false);
        setIsProcessing(false);
        processingRef.current = false;
      }
    },
    [eventId, eventName, openCheckout, onError],
  );

  return {
    initiateIndividualPayment,
    initiateTeamPayment,
    isProcessing,
    isLoading,
    error,
    clearError,
  };
};
