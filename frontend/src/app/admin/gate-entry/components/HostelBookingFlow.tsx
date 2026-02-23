'use client';

import React, { useState, useEffect } from 'react';
import { gateEntryService, Hostel, HostelRoom, HostelBooking } from '@/shared/services/gateEntry.service';
import { useToast } from '@/shared/ui-components/Toast';
import PaymentQRModal from './PaymentQRModal';

interface HostelBookingFlowProps {
  passId: string;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  onClose: () => void;
  onSuccess: (bookingId?: string) => void;
}

type BookingStep = 'choice' | 'select_hostel' | 'select_room' | 'payment';

export default function HostelBookingFlow({
  passId,
  checkInDate,
  checkOutDate,
  guestCount,
  onClose,
  onSuccess
}: HostelBookingFlowProps) {
  const { error: showError, warning: showWarning, success: showSuccess, info: showInfo } = useToast();
  const [step, setStep] = useState<BookingStep>('choice');
  const [bookingChoice, setBookingChoice] = useState<'existing' | 'new' | 'none' | null>(null);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [selectedHostel, setSelectedHostel] = useState<Hostel | null>(null);
  const [rooms, setRooms] = useState<HostelRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<HostelRoom | null>(null);
  const [booking, setBooking] = useState<HostelBooking | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const nights = Math.ceil((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24));

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
        showWarning('No hostels available for selected dates');
      }
    } catch (error) {
      console.error('Error loading hostels:', error);
      showError('Failed to load hostels');
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
        showWarning('No rooms available in this hostel');
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      showError('Failed to load rooms');
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
      showInfo('Please provide your existing hostel details in the form');
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
        checkInDate,
        checkOutDate,
        guestCount
      });

      if (response.success) {
        setBooking(response.booking);
        setStep('payment');
        showSuccess('Booking created. Please complete payment.');
      } else {
        showError('Failed to create booking');
      }
    } catch (error: any) {
      console.error('Error creating booking:', error);
      
      // Extract user-friendly error message
      let errorMessage = 'Unable to create booking. Please try again.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        // Don't show technical Prisma or database errors to users
        if (error.message.includes('Invalid `prisma') || 
            error.message.includes('Argument') || 
            error.message.includes('Expected')) {
          errorMessage = 'There was a problem with your booking details. Please check and try again.';
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
        Your visit is multi-day. Do you need accommodation?
      </h3>
      
      <div className="space-y-3">
        <button
          onClick={() => handleChoiceSelection('new')}
          className="w-full p-4 border-2 border-blue-500 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all text-left"
        >
          <div className="font-semibold text-blue-800">I need to book accommodation</div>
          <div className="text-sm text-blue-600 mt-1">Browse available hostels and rooms</div>
        </button>

        <button
          onClick={() => handleChoiceSelection('none')}
          className="w-full p-4 border-2 border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all text-left"
        >
          <div className="font-semibold text-gray-800">No accommodation needed</div>
          <div className="text-sm text-gray-600 mt-1">Continue without hostel booking</div>
        </button>
      </div>
    </div>
  );

  const renderHostelSelection = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Select Hostel</h3>
        <button
          onClick={() => setStep('choice')}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          ← Back
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading hostels...</p>
        </div>
      ) : hostels.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600">No hostels available for selected dates</p>
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
                  {hostel.availableRoomsCount} rooms available
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
        <h3 className="text-lg font-semibold text-gray-800">Select Room</h3>
        <button
          onClick={() => {
            setStep('select_hostel');
            setSelectedRoom(null);
          }}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          ← Back
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <p className="text-sm text-blue-800">
          <span className="font-semibold">{selectedHostel?.name}</span>
        </p>
        <p className="text-xs text-blue-600 mt-1">
          {nights} night{nights > 1 ? 's' : ''} • {guestCount} guest{guestCount > 1 ? 's' : ''}
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading rooms...</p>
        </div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600">No rooms available in this hostel</p>
        </div>
      ) : (
        <div className="grid gap-3 max-h-96 overflow-y-auto">
          {rooms.map((room) => {
            const totalPrice = room.pricePerNight * nights;
            return (
              <div
                key={room.id}
                onClick={() => handleRoomSelect(room)}
                className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-800">Room {room.roomNumber}</h4>
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
                    <p className="text-xs text-gray-500 mt-1">Max {room.maxOccupancy} guests</p>
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
                    <p className="text-xs text-gray-500">₹{room.pricePerNight}/night</p>
                    <p className="text-xs text-gray-400 mt-1">{nights} night{nights > 1 ? 's' : ''}</p>
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
          <h2 className="text-2xl font-bold text-gray-800">Hostel Booking</h2>
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
