'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { gateEntryService, type HostelRoom, type ExtendPassOptions, type HostelBooking } from '@/shared/services/gateEntry.service';
import { useToast } from '@/shared/ui-components/Toast';
import { useLanguage } from '../context/LanguageContext';
import PaymentQRModal from './PaymentQRModal';

interface ExtendPassModalProps {
  passId: string;
  currentEntryTime: string;
  currentVisitDate: string;
  currentEndDate?: string;
  hasHostelBooking?: boolean;
  onClose: () => void;
  onSuccess: (updatedPass?: any) => void;
}

export default function ExtendPassModal({
  passId,
  currentEntryTime,
  currentVisitDate,
  currentEndDate,
  hasHostelBooking = false,
  onClose,
  onSuccess
}: ExtendPassModalProps) {
  const { error: showError, success: showSuccess } = useToast();
  const { t } = useLanguage();
  const [newEndDate, setNewEndDate] = useState(currentEndDate || currentVisitDate);
  const [extensionReason, setExtensionReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingOptions, setIsCheckingOptions] = useState(false);
  const [extensionOptions, setExtensionOptions] = useState<ExtendPassOptions | null>(null);
  const [useSameRoom, setUseSameRoom] = useState(true);
  const [selectedHostelId, setSelectedHostelId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentBooking, setPaymentBooking] = useState<HostelBooking | null>(null);
  const [extensionPaymentAmount, setExtensionPaymentAmount] = useState<number>(0);
  const [updatedPassAfterExtend, setUpdatedPassAfterExtend] = useState<any>(null);

  const isValidExtensionDate = useMemo(() => {
    const selectedDate = new Date(newEndDate);
    const currentDate = new Date(currentEndDate || currentVisitDate);
    currentDate.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate > currentDate;
  }, [newEndDate, currentEndDate, currentVisitDate]);

  const selectedHostel = useMemo(() => {
    return extensionOptions?.alternativeHostels?.find((h) => h.id === selectedHostelId) || null;
  }, [extensionOptions, selectedHostelId]);

  const selectedHostelRooms: HostelRoom[] = useMemo(() => {
    return selectedHostel?.hostelRooms || [];
  }, [selectedHostel]);

  useEffect(() => {
    const hostels = extensionOptions?.alternativeHostels || [];
    if (!hostels.length) {
      if (selectedHostelId) setSelectedHostelId('');
      return;
    }

    const exists = hostels.some((h) => h.id === selectedHostelId);
    if (!selectedHostelId || !exists) {
      setSelectedHostelId(hostels[0].id);
    }
  }, [extensionOptions, selectedHostelId]);

  useEffect(() => {
    let mounted = true;

    const checkOptions = async () => {
      if (!hasHostelBooking) {
        setExtensionOptions(null);
        return;
      }

      if (!newEndDate || !isValidExtensionDate) {
        setExtensionOptions(null);
        return;
      }

      setIsCheckingOptions(true);
      try {
        const response = await gateEntryService.checkExtendPassOptions(passId, newEndDate);
        if (!mounted) return;

        const opts = response.options;
        setExtensionOptions(opts);

        if (!opts.sameRoomAvailable) {
          setUseSameRoom(false);
        }

        if ((opts.alternativeHostels || []).length > 0) {
          setSelectedHostelId((prev) => prev || opts.alternativeHostels[0].id);
        } else {
          setSelectedHostelId('');
        }
      } catch (error: any) {
        if (!mounted) return;
        setExtensionOptions(null);
        showError(error?.response?.data?.message || 'Failed to check room availability');
      } finally {
        if (mounted) {
          setIsCheckingOptions(false);
        }
      }
    };

    checkOptions();
    return () => {
      mounted = false;
    };
  }, [hasHostelBooking, passId, newEndDate, isValidExtensionDate]);

  useEffect(() => {
    setSelectedRoomId('');
  }, [selectedHostelId, useSameRoom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEndDate) {
      showError(t('extend.errNoDate'));
      return;
    }

    if (!extensionReason.trim()) {
      showError(t('extend.errNoReason'));
      return;
    }

    // Validate new end date is not before current end date or visit date
    const selectedDate = new Date(newEndDate);
    const currentDate = new Date(currentEndDate || currentVisitDate);
    currentDate.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate <= currentDate) {
      showError(t('extend.errDateAfter'));
      return;
    }

    const mustChooseAlternate = !!(
      hasHostelBooking &&
      extensionOptions?.hasHostelBooking &&
      !extensionOptions.sameRoomAvailable
    );

    if (hasHostelBooking && extensionOptions?.hasHostelBooking) {
      if ((mustChooseAlternate || !useSameRoom) && !selectedRoomId) {
        showError('Please select an available room to continue');
        return;
      }
    }

    setIsLoading(true);
    try {
      const response = hasHostelBooking
        ? await gateEntryService.confirmExtendPass(passId, {
            newEndDate,
            extensionReason,
            useSameRoom: mustChooseAlternate ? false : useSameRoom,
            selectedRoomId: mustChooseAlternate || !useSameRoom ? selectedRoomId : undefined
          })
        : await gateEntryService.extendPass(passId, newEndDate, extensionReason);
      
      if (response.success) {
        const extension = (response as any).extension;

        if (hasHostelBooking && extension?.requiresPayment) {
          const amount = Number(extension?.additionalAmount || 0);
          const bookingResult = await gateEntryService.getBookingByPass(passId);

          if (bookingResult.success && bookingResult.booking) {
            setUpdatedPassAfterExtend((response as any).pass);
            setExtensionPaymentAmount(amount);
            setPaymentBooking(bookingResult.booking);
            setShowPaymentModal(true);
            showSuccess(`Pass extended. Please complete additional payment: INR ${amount}`);
            return;
          }

          showError('Pass extended but payment details could not be loaded. Please refresh and complete payment from booking section.');
          await onSuccess((response as any).pass);
          onClose();
          return;
        }

        showSuccess(t('extend.successMsg'));
        await onSuccess((response as any).pass);
        onClose();
      } else {
        showError(t('extend.errFailed'));
      }
    } catch (error: any) {
      console.error('Error extending pass:', error);
      showError(error.response?.data?.message || t('extend.errFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        <div className="p-6 pb-4 border-b border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {showPaymentModal ? 'Extension Payment' : t('extend.title')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        <div className={`rounded-lg p-4 ${showPaymentModal ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
          <p className={`text-sm ${showPaymentModal ? 'text-green-800' : 'text-blue-800'}`}>
            {showPaymentModal
              ? 'Review QR and complete additional payment for pass extension.'
              : t('extend.note')}
          </p>
        </div>
        </div>

        {showPaymentModal && paymentBooking ? (
          <div className="flex-1 overflow-y-auto p-6">
            <PaymentQRModal
              booking={{
                ...paymentBooking,
                totalPrice: extensionPaymentAmount > 0 ? extensionPaymentAmount : paymentBooking.totalPrice
              }}
              mode="extension"
              payableAmount={extensionPaymentAmount}
              onClose={async () => {
                if (updatedPassAfterExtend) {
                  await onSuccess(updatedPassAfterExtend);
                } else {
                  await onSuccess();
                }
                onClose();
              }}
            />
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Current Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">{t('extend.currentDetails')}</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">{t('extend.passId')}</span> {passId}</p>
              <p><span className="font-medium">{t('extend.visitStartDate')}</span> {new Date(currentVisitDate).toLocaleDateString()}</p>
              <p><span className="font-medium">{t('extend.currentEndDate')}</span> {currentEndDate ? new Date(currentEndDate).toLocaleDateString() : new Date(currentVisitDate).toLocaleDateString()}</p>
              <p><span className="font-medium">{t('extend.entryTime')}</span> {currentEntryTime}</p>
            </div>
          </div>

          {/* New End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('extend.newEndDate')} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              min={currentEndDate || currentVisitDate}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('extend.expireNote')}
            </p>
          </div>

          {/* Extension Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('extend.reasonLabel')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={extensionReason}
              onChange={(e) => setExtensionReason(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder={t('extend.reasonPlaceholder')}
              required
              disabled={isLoading}
            />
          </div>

          {hasHostelBooking && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-amber-900">Guest House Extension</h4>

              {isCheckingOptions && (
                <p className="text-sm text-amber-800">Checking room availability...</p>
              )}

              {!isCheckingOptions && extensionOptions?.hasHostelBooking && (
                <>
                  <div className="text-sm text-amber-900 space-y-1">
                    <p>
                      Current room: <span className="font-semibold">{extensionOptions.currentRoom?.roomNumber || 'N/A'}</span>
                      {extensionOptions.currentRoom?.hostelName ? ` (${extensionOptions.currentRoom.hostelName})` : ''}
                    </p>
                    <p>
                      Extra nights: <span className="font-semibold">{extensionOptions.additionalNights}</span>
                    </p>
                    <p>
                      Additional amount: <span className="font-semibold">INR {extensionOptions.additionalAmount}</span>
                    </p>
                  </div>

                  {extensionOptions.sameRoomAvailable ? (
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm text-gray-800">
                        <input
                          type="radio"
                          name="roomChoice"
                          checked={useSameRoom}
                          onChange={() => setUseSameRoom(true)}
                          disabled={isLoading}
                        />
                        Keep same room
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-800">
                        <input
                          type="radio"
                          name="roomChoice"
                          checked={!useSameRoom}
                          onChange={() => setUseSameRoom(false)}
                          disabled={isLoading}
                        />
                        Choose different room
                      </label>
                    </div>
                  ) : (
                    <p className="text-sm text-red-700 font-medium">
                      Current room is not available for selected extension date. Please select another room.
                    </p>
                  )}

                  {(!extensionOptions.sameRoomAvailable || !useSameRoom) && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Select Guest House</label>
                        <select
                          value={selectedHostelId}
                          onChange={(e) => setSelectedHostelId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          disabled={isLoading}
                        >
                          {!extensionOptions.alternativeHostels?.length && (
                            <option value="">No guest house available</option>
                          )}
                          {(extensionOptions.alternativeHostels || []).map((hostel) => (
                            <option key={hostel.id} value={hostel.id}>
                              {hostel.name} ({hostel.availableRoomsCount || hostel.hostelRooms?.length || 0} rooms)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Select Room</label>
                        <select
                          value={selectedRoomId}
                          onChange={(e) => setSelectedRoomId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          disabled={isLoading}
                        >
                          <option value="">Choose room</option>
                          {selectedHostelRooms.map((room) => (
                            <option key={room.id} value={room.id}>
                              {room.roomNumber} - {room.roomType} - INR {room.pricePerNight}/day
                            </option>
                          ))}
                        </select>
                        {selectedHostelId && selectedHostelRooms.length === 0 && (
                          <p className="mt-1 text-xs text-red-600">No rooms available for this guest house on selected extension dates.</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="sticky bottom-0 bg-white pt-4 pb-1 flex gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              {t('extend.cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? t('extend.submitting') : t('extend.submit')}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
