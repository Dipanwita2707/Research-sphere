'use client';

import React, { useState } from 'react';
import { HostelBooking, gateEntryService } from '@/shared/services/gateEntry.service';

interface PaymentQRModalProps {
  booking: HostelBooking;
  onClose: () => void;
}

export default function PaymentQRModal({ booking, onClose }: PaymentQRModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePaymentComplete = () => {
    // In future, this will verify payment via Razorpay webhook
    // For now, just close the modal
    onClose();
  };

  // Test Mode: Mark payment as completed without actual payment
  const handleTestModePayment = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const testReference = `TEST-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
      const result = await gateEntryService.confirmPayment(booking.id, testReference);
      
      if (result.success) {
        setPaymentSuccess(true);
        // Auto-close after 2 seconds
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError(result.message || 'Payment confirmation failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to confirm payment');
    } finally {
      setIsProcessing(false);
    }
  };

  // Show success state
  if (paymentSuccess) {
    return (
      <div className="space-y-6 text-center">
        <div className="bg-green-100 border border-green-300 rounded-lg p-8">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-2xl font-bold text-green-800 mb-2">Payment Confirmed!</h3>
          <p className="text-green-700">
            Booking status updated to <strong>Confirmed</strong>
          </p>
          <p className="text-sm text-green-600 mt-2">
            Hostel: {booking.hostel?.name} | Room: {booking.room?.roomNumber}
          </p>
        </div>
        <p className="text-sm text-gray-500">Closing automatically...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="font-semibold text-green-800 mb-2">✓ Booking Created Successfully</h3>
        <p className="text-sm text-green-700">
          Your booking has been created. Please complete the payment to confirm your reservation.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Booking Details */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <h4 className="font-semibold text-gray-800 border-b border-gray-300 pb-2 mb-2">
          Booking Details
        </h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-gray-600">Hostel:</div>
          <div className="font-medium text-gray-800">{booking.hostel?.name}</div>
          
          <div className="text-gray-600">Room:</div>
          <div className="font-medium text-gray-800">{booking.room?.roomNumber}</div>

          <div className="text-gray-600">Room Type:</div>
          <div className="font-medium text-gray-800 capitalize">{booking.room?.roomType || 'Standard'}</div>
          
          <div className="text-gray-600">Check-in:</div>
          <div className="font-medium text-gray-800">
            {new Date(booking.checkInDate).toLocaleDateString()}
          </div>
          
          <div className="text-gray-600">Check-out:</div>
          <div className="font-medium text-gray-800">
            {new Date(booking.checkOutDate).toLocaleDateString()}
          </div>
          
          <div className="text-gray-600">Guests:</div>
          <div className="font-medium text-gray-800">{booking.guestCount}</div>
          
          <div className="text-gray-600">Price/Night:</div>
          <div className="font-medium text-gray-800">₹{booking.room?.pricePerNight || 0}</div>
          
          <div className="text-gray-600 font-semibold">Total Amount:</div>
          <div className="font-bold text-blue-600 text-lg">₹{booking.totalPrice}</div>
        </div>
      </div>

      {/* Payment QR Code */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <h4 className="font-semibold text-gray-800 mb-4">Scan to Pay</h4>
        
        {booking.paymentQrCode ? (
          <div className="flex flex-col items-center">
            <div className="bg-white p-4 rounded-lg shadow-md inline-block">
              <img
                src={booking.paymentQrCode}
                alt="Payment QR Code"
                className="w-48 h-48"
              />
            </div>
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded px-4 py-2">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Reference ID:</span> {booking.paymentReference}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-gray-500">Payment QR code not available</div>
        )}
      </div>

      {/* Test Mode Payment Button */}
      <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
        <h4 className="font-semibold text-orange-800 mb-2 flex items-center gap-2">
          🧪 Test Environment Mode
        </h4>
        <p className="text-sm text-orange-700 mb-3">
          Since Razorpay is not integrated yet, use this button to simulate payment completion.
        </p>
        <button
          onClick={handleTestModePayment}
          disabled={isProcessing}
          className="w-full px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <span className="animate-spin">⏳</span>
              Processing...
            </>
          ) : (
            <>
              💳 Mark as Paid (Test Mode)
            </>
          )}
        </button>
        <p className="text-xs text-orange-600 mt-2 text-center">
          This will instantly confirm the booking without actual payment
        </p>
      </div>

      {/* Payment Instructions */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-800 mb-2">📋 Payment Instructions (Production)</h4>
        <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
          <li>Scan the QR code using any UPI app (GPay, PhonePe, Paytm, etc.)</li>
          <li>Pay the exact amount shown above</li>
          <li>Save the payment confirmation screenshot</li>
          <li>Admin will verify and confirm your booking</li>
        </ol>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handlePaymentComplete}
          className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          I've Completed Payment
        </button>
        <button
          onClick={onClose}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
        >
          Cancel
        </button>
      </div>

      {/* Booking Status Info */}
      <div className="text-center">
        <p className="text-sm text-gray-600">
          Booking Status: <span className="font-semibold text-orange-600 capitalize">{booking.bookingStatus || 'Pending'}</span>
        </p>
        <p className="text-xs text-gray-500 mt-1">
          You will be notified once your payment is verified
        </p>
      </div>
    </div>
  );
}
