'use client';

import React, { useState, useEffect } from 'react';
import { gateEntryService, Hostel, HostelRoom, HostelBooking } from '@/shared/services/gateEntry.service';
import { useToast } from '@/shared/ui-components/Toast';
import PaymentQRModal from './PaymentQRModal';
import { useLanguage } from '../context/LanguageContext';

interface HostelBookingFlowProps {
  passId: string;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  onClose: () => void;
  onSuccess: (bookingId?: string) => void;
}

type BookingStep = 'choice' | 'select_hostel' | 'select_room' | 'payment';

/**
 * Mirror of the backend calculateBillableDays logic.
 * - Standard (≤ 12:00): no extra charge
 * - Grace (12:00–17:00): no extra charge
 * - After 17:00: +1 extra day
 */
function calculateBillableDaysPreview(checkInDatetime: Date, checkOutDatetime: Date): number {
  const checkInDay  = new Date(checkInDatetime.getFullYear(),  checkInDatetime.getMonth(),  checkInDatetime.getDate());
  const checkOutDay = new Date(checkOutDatetime.getFullYear(), checkOutDatetime.getMonth(), checkOutDatetime.getDate());
  const baseDays = Math.round((checkOutDay.getTime() - checkInDay.getTime()) / (1000 * 60 * 60 * 24));
  const checkOutHour = checkOutDatetime.getHours() + checkOutDatetime.getMinutes() / 60;
  return Math.max(checkOutHour > 17 ? baseDays + 1 : baseDays, 1);
}

export default function HostelBookingFlow({
  passId,
  checkInDate,
  checkOutDate,
  guestCount,
  onClose,
  onSuccess
}: HostelBookingFlowProps) {
  const { error: showError, warning: showWarning, success: showSuccess, info: showInfo } = useToast();
  const { t } = useLanguage();
  const [step, setStep] = useState<BookingStep>('choice');
  const [bookingChoice, setBookingChoice] = useState<'existing' | 'new' | 'none' | null>(null);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostel, setSelectedHostel] = useState<Hostel | null>(null);
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<HostelRoom | null>(null);
  const [booking, setBooking] = useState<HostelBooking | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [checkInTime, setCheckInTime] = useState('10:00');
  const [checkOutTime, setCheckOutTime] = useState('12:00');
  const [checkInRemarks, setCheckInRemarks] = useState('');
  const [requestEarlyCheckin, setRequestEarlyCheckin] = useState(false);

  // Derived datetime objects
  const checkInDatetime  = new Date(`${checkInDate}T${checkInTime}:00`);
  const checkOutDatetime = new Date(`${checkOutDate}T${checkOutTime}:00`);
  const billableDays = calculateBillableDaysPreview(checkInDatetime, checkOutDatetime);
  const checkOutHourNum = checkOutDatetime.getHours() + checkOutDatetime.getMinutes() / 60;
  const checkoutTierNote = checkOutHourNum > 17
    ? { label: 'After 5 PM — 1 extra day charged', color: 'text-amber-700 bg-amber-50 border-amber-200' }
    : checkOutHourNum > 12
      ? { label: 'Grace period (12 PM–5 PM) — no extra charge', color: 'text-green-700 bg-green-50 border-green-200' }
      : { label: 'Standard checkout (≤ 12 PM) — no extra charge', color: 'text-green-700 bg-green-50 border-green-200' };

  // Keep nights for backwards-compat display
  const nights = billableDays;

  // Load available hostels when step changes to select_hostel
  useEffect(() => {
    if (step === 'select_hostel' && bookingChoice === 'new') {
      loadAvailableHostels();
    }
  }, [step, bookingChoice]);

  // Load rooms when hostel is selected
  useEffect(() => {
    if (selectedHostel && step === 'select_room') {
      loadHostelRooms(selectedHostel.id);
    }
  }, [selectedHostel, step]);

  const loadAvailableHostels = async () => {
    setIsLoading(true);
    try {
      const response = await gateEntryService.getAvailableHostels(checkInDate, checkOutDate);
      setHostels(response.hostels);
      if (response.hostels.length === 0) {
        showWarning(t('hostel.noHostels'));
      }
    } catch (error) {
      console.error('Error loading hostels:', error);
      showError(t('hostel.errLoadingHostels'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadHostelRooms = async (hostelId: string) => {
    setIsLoading(true);
    try {
      const response = await gateEntryService.getHostelRooms(hostelId, checkInDate, checkOutDate);
      setRooms(response.rooms);
      if (response.rooms.length === 0) {
        showWarning(t('hostel.noRooms'));
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      showError(t('hostel.errLoadingRooms'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChoiceSelection = (choice: 'existing' | 'new' | 'none') => {
    setBookingChoice(choice);
    if (choice === 'none') {
      onSuccess();
      onClose();
    } else if (choice === 'existing') {
      // For existing booking, just close - user should provide details in main form
      showInfo(t('hostel.infoExistingBooking'));
      onClose();
    } else if (choice === 'new') {
      setStep('select_hostel');
    }
  };

  const handleHostelSelect = (hostel: Hostel) => {
    setSelectedHostel(hostel);
    setStep('select_room');
  };

  const handleRoomSelect = async (room: HostelRoom) => {
    setSelectedRoom(room);
    
    // Create booking
    setIsLoading(true);
    try {
      const response = await gateEntryService.createBooking({
        passId,
        hostelId: selectedHostel!.id,
        roomId: room.id,
        checkInDatetime: checkInDatetime.toISOString(),
        checkOutDatetime: checkOutDatetime.toISOString(),
        checkInRemarks: checkInRemarks || undefined,
        guestCount
      });

      if (response.success) {
        setBooking(response.booking);
        setStep('payment');
        showSuccess(t('hostel.bookingCreated'));

        // Submit early check-in request if toggled on
        if (requestEarlyCheckin && parseInt(checkInTime.split(':')[0]) < 10) {
          try {
            await gateEntryService.requestEarlyCheckin(
              response.booking.id,
              checkInDatetime.toISOString()
            );
            showInfo(t('hostel.earlyCheckinSubmitted'));
          } catch (err: any) {
            console.error('Early check-in request error:', err);
            showWarning('Booking created, but early check-in request failed: ' + (err.response?.data?.message || err.message));
          }
        }
      } else {
        showError(t('hostel.errBookingFailed'));
      }
    } catch (error: any) {
      console.error('Error creating booking:', error);
      
      // Extract user-friendly error message
      let errorMessage = t('hostel.errUnableToCreateBooking');
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        // Don't show technical Prisma or database errors to users
        if (error.message.includes('Invalid `prisma') || 
            error.message.includes('Argument') || 
            error.message.includes('Expected')) {
          errorMessage = t('hostel.errBookingDetailsProblem');
        } else {
          errorMessage = error.message;
        }
      }
      
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const renderChoiceStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        {t('hostel.multiDayQuestion')}
      </h3>
      
      <div className="space-y-3">
        <button
          onClick={() => handleChoiceSelection('new')}
          className="w-full p-4 border-2 border-blue-500 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all text-left"
        >
          <div className="font-semibold text-blue-800">{t('hostel.needAccommodation')}</div>
          <div className="text-sm text-blue-600 mt-1">{t('hostel.browseHostels')}</div>
        </button>

        <button
          onClick={() => handleChoiceSelection('none')}
          className="w-full p-4 border-2 border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all text-left"
        >
          <div className="font-semibold text-gray-800">{t('hostel.noAccommodation')}</div>
          <div className="text-sm text-gray-600 mt-1">{t('hostel.continueWithout')}</div>
        </button>
      </div>
    </div>
  );

  const renderHostelSelection = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{t('hostel.selectHostel')}</h3>
        <button
          onClick={() => setStep('choice')}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {t('hostel.back')}
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">{t('hostel.loadingHostels')}</p>
        </div>
      ) : hostels.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600">{t('hostel.noHostels')}</p>
        </div>
      ) : (
        <div className="grid gap-4 max-h-96 overflow-y-auto">
          {hostels.map((hostel) => (
            <div
              key={hostel.id}
              onClick={() => handleHostelSelect(hostel)}
              className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all"
            >
              <h4 className="font-semibold text-gray-800">{hostel.name}</h4>
              <p className="text-sm text-gray-600 mt-1">{hostel.address}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {hostel.hostelType}
                </span>
                <span className="text-sm text-gray-600">
                  {hostel.availableRoomsCount} {t('hostel.roomsAvailable')}
                </span>
              </div>
              {hostel.facilities && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {(() => {
                    try {
                      const parsed = typeof hostel.facilities === 'string' ? JSON.parse(hostel.facilities) : hostel.facilities;
                      if (Array.isArray(parsed)) {
                        return parsed.map((facility: string, idx: number) => (
                          <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                            {facility}
                          </span>
                        ));
                      }
                      return <span className="text-xs text-gray-600">{String(hostel.facilities)}</span>;
                    } catch {
                      return <span className="text-xs text-gray-600">{String(hostel.facilities)}</span>;
                    }
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderRoomSelection = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{t('hostel.selectRoom')}</h3>
        <button
          onClick={() => {
            setStep('select_hostel');
            setSelectedRoom(null);
          }}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {t('hostel.back')}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <p className="text-sm text-blue-800">
          <span className="font-semibold">{selectedHostel?.name}</span>
        </p>

        {/* Time pickers */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs font-medium text-blue-800 mb-1">{t('hostel.checkInTime')}</label>
            <input
              type="time"
              value={checkInTime}
              onChange={e => setCheckInTime(e.target.value)}
              className="w-full text-sm border border-blue-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-blue-800 mb-1">{t('hostel.checkOutTime')}</label>
            <input
              type="time"
              value={checkOutTime}
              onChange={e => setCheckOutTime(e.target.value)}
              className="w-full text-sm border border-blue-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Remarks */}
        <div className="mt-3">
          <label className="block text-xs font-medium text-blue-800 mb-1">{t('hostel.remarksOptional')}</label>
          <input
            type="text"
            value={checkInRemarks}
            onChange={e => setCheckInRemarks(e.target.value)}
            placeholder={t('hostel.remarksPlaceholder')}
            className="w-full text-sm border border-blue-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Early check-in request (before 10 AM) */}
        {parseInt(checkInTime.split(':')[0]) < 10 && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <span className="text-amber-600 text-lg">⏰</span>
              <div className="flex-1">
                <p className="text-xs font-medium text-amber-800">{t('hostel.earlyCheckinNotice')}</p>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requestEarlyCheckin}
                    onChange={e => setRequestEarlyCheckin(e.target.checked)}
                    className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs text-amber-700 font-medium">
                    {t('hostel.earlyCheckinRequest')}
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Billing summary */}
        <div className={`mt-3 text-xs px-2 py-1.5 rounded border ${checkoutTierNote.color}`}>
          {checkoutTierNote.label}
        </div>
        <p className="text-xs text-blue-600 mt-2">
          <span className="font-semibold">{billableDays} billable {billableDays === 1 ? t('hostel.day') : t('hostel.days')}</span>{' '}
          &bull; {guestCount} {guestCount > 1 ? t('hostel.guests') : t('hostel.guest')}
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">{t('hostel.loadingRooms')}</p>
        </div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600">{t('hostel.noRooms')}</p>
        </div>
      ) : (
        <div className="grid gap-3 max-h-96 overflow-y-auto">
          {rooms.map((room) => {
            const totalPrice = room.pricePerNight * billableDays;
            return (
              <div
                key={room.id}
                onClick={() => handleRoomSelect(room)}
                className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-800">{t('hostel.room')} {room.roomNumber}</h4>
                      {/* AC / Non-AC badge */}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${room.isAc ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {room.isAc ? '❄️ AC' : 'Non-AC'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-gray-600 capitalize">{room.roomType}</p>
                      {/* Sharing Type */}
                      {room.sharingType && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                          {room.sharingType}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{t('hostel.maxGuests')} {room.maxOccupancy} {t('hostel.guests')}</p>
                    {/* Amenities */}
                    {room.amenities && room.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {room.amenities.map((amenity, idx) => (
                          <span key={idx} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200">
                            {amenity}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-lg font-bold text-blue-600">₹{totalPrice}</p>
                    <p className="text-xs text-gray-500">₹{room.pricePerNight}/day</p>
                    <p className="text-xs text-gray-400 mt-1">{billableDays} {billableDays === 1 ? t('hostel.day') : t('hostel.days')}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">{t('hostel.title')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        {step === 'choice' && renderChoiceStep()}
        {step === 'select_hostel' && renderHostelSelection()}
        {step === 'select_room' && renderRoomSelection()}
        {step === 'payment' && booking && (
          <PaymentQRModal
            booking={booking}
            onClose={() => {
              onSuccess(booking.id);
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}
