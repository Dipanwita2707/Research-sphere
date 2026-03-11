const prisma = require('../../../shared/config/database');
const QRCode = require('qrcode');

/**
 * Guest House Billing Rules:
 * - Standard checkout: 12:00 PM (noon)
 * - Grace checkout:    17:00 (5 PM) — no extra charge
 * - After grace:       extra day charged
 *
 * Billable days formula:
 *   base = calendar days between checkIn.date and checkOut.date
 *   if checkOut.time > 17:00 → billable_days = base + 1
 *   else                     → billable_days = base
 */
const GRACE_CHECKOUT_HOUR = 17; // 5 PM

/**
 * Calculate billable days based on Guest House schedule rules.
 * @param {Date} checkInDatetime  - Full check-in datetime
 * @param {Date} checkOutDatetime - Full check-out datetime
 * @returns {{ billableDays: number, checkoutTier: string }}
 */
const calculateBillableDays = (checkInDatetime, checkOutDatetime) => {
  const checkIn  = new Date(checkInDatetime);
  const checkOut = new Date(checkOutDatetime);

  // Calendar day difference (ignoring time)
  const checkInDay  = new Date(checkIn.getFullYear(),  checkIn.getMonth(),  checkIn.getDate());
  const checkOutDay = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
  const baseDays = Math.round((checkOutDay - checkInDay) / (1000 * 60 * 60 * 24));

  const checkOutHour = checkOut.getHours() + checkOut.getMinutes() / 60;

  if (checkOutHour > GRACE_CHECKOUT_HOUR) {
    // After 5 PM grace → extra day
    return { billableDays: baseDays + 1, checkoutTier: 'after_grace' };
  }
  // Standard (≤ 12 PM) or grace (≤ 5 PM) → no extra
  return { billableDays: Math.max(baseDays, 1), checkoutTier: checkOutHour <= 12 ? 'standard' : 'grace' };
};

/**
 * Get booking cutoff for availability overlap detection.
 * A booking whose checkout is in the past no longer blocks availability.
 */
const getBookingCutoffDate = () => {
  const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()));
};

class HostelBookingService {
  /**
   * Get all available hostels with their rooms for a given date range
   * @param {Date} checkInDate
   * @param {Date} checkOutDate
   * @returns {Promise<Array>}
   */
  async getAvailableHostels(checkInDate, checkOutDate) {
    try {
      const checkInDt  = new Date(checkInDate);
      const checkOutDt = new Date(checkOutDate);
      const hostels = await prisma.hostel.findMany({
        where: {
          is_active: true
        },
        include: {
          rooms: {
            where: {
              is_available: true
            },
            include: {
              bookings: {
                where: {
                  booking_status: { in: ['confirmed', 'pending'] },
                  AND: [
                    { check_out_datetime: { gte: getBookingCutoffDate() } },
                    { check_in_datetime:  { lt: checkOutDt } },
                    { check_out_datetime: { gte: checkInDt } }
                  ]
                }
              }
            }
          }
        }
      });

      // Filter out rooms that have overlapping bookings
      const availableHostels = hostels.map(hostel => {
        const availableRooms = hostel.rooms.filter(room => {
          return room.bookings.length === 0;
        });

        return {
          ...hostel,
          available_rooms_count: availableRooms.length,
          rooms: availableRooms.map(room => {
            const { bookings, ...roomData } = room;
            return roomData;
          })
        };
      }).filter(hostel => hostel.available_rooms_count > 0);

      return availableHostels;
    } catch (error) {
      console.error('Error fetching available hostels:', error);
      throw new Error('Failed to fetch available hostels');
    }
  }

  /**
   * Get available rooms for a specific hostel
   * @param {string} hostelId
   * @param {Date} checkInDate
   * @param {Date} checkOutDate
   * @returns {Promise<Array>}
   */
  async getRoomsByHostel(hostelId, checkInDate, checkOutDate) {
    try {
      const checkInDt  = new Date(checkInDate);
      const checkOutDt = new Date(checkOutDate);
      const rooms = await prisma.hostelRoom.findMany({
        where: {
          hostel_id: hostelId,
          is_available: true
        },
        include: {
          bookings: {
            where: {
              booking_status: { in: ['confirmed', 'pending'] },
              AND: [
                { check_out_datetime: { gte: getBookingCutoffDate() } },
                { check_in_datetime:  { lt: checkOutDt } },
                { check_out_datetime: { gte: checkInDt } }
              ]
            }
          }
        }
      });

      // Filter out rooms with overlapping bookings
      const availableRooms = rooms
        .filter(room => room.bookings.length === 0)
        .map(room => {
          const { bookings, ...roomData } = room;
          return roomData;
        });

      return availableRooms;
    } catch (error) {
      console.error('Error fetching rooms by hostel:', error);
      throw new Error('Failed to fetch rooms');
    }
  }

  /**
   * Generate payment QR code for hostel booking
   * TODO: Future integration with Razorpay QR API
   * @param {string} bookingId
   * @param {number} amount
   * @returns {Promise<string>} Base64 QR code
   */
  async generatePaymentQR(bookingId, amount) {
    try {
      // For now, generate static QR with booking reference
      // In future: Integrate with Razorpay to generate dynamic payment QR
      const paymentData = {
        type: 'HOSTEL_BOOKING_PAYMENT',
        bookingId: bookingId,
        amount: amount,
        reference: `HSTEL-${bookingId.substring(0, 8).toUpperCase()}`,
        timestamp: new Date().toISOString()
      };

      // Generate QR code as base64 Data URL
      const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(paymentData), {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 2
      });

      return qrCodeDataUrl;
    } catch (error) {
      console.error('Error generating payment QR:', error);
      throw new Error('Failed to generate payment QR code');
    }
  }

  /**
   * Create a new hostel booking
   * @param {Object} bookingData
   * @returns {Promise<Object>}
   */
  async createBooking(bookingData) {
    const {
      passId,
      hostelId,
      roomId,
      checkInDatetime,
      checkOutDatetime,
      checkInRemarks,
      guestCount,
      createdById
    } = bookingData;

    try {
      // Validate and convert guestCount to integer
      const guestCountInt = parseInt(guestCount, 10);
      if (isNaN(guestCountInt) || guestCountInt < 1) {
        throw new Error('Invalid guest count. Please provide a valid number of guests.');
      }

      // Resolve pass_id (formatted string) to UUID
      const gatePass = await prisma.gate_pass.findUnique({
        where: { pass_id: passId },
        select: { id: true }
      });

      if (!gatePass) {
        throw new Error('Gate pass not found');
      }

      const gatePassUUID = gatePass.id;

      // Check if pass already has a booking
      const existingBooking = await prisma.hostelBooking.findUnique({
        where: { gate_pass_id: gatePassUUID }
      });

      if (existingBooking) {
        throw new Error('This pass already has a hostel booking');
      }

      // Validate datetimes
      const checkIn  = new Date(checkInDatetime);
      const checkOut = new Date(checkOutDatetime);

      if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
        throw new Error('Invalid check-in or check-out datetime');
      }
      if (checkOut <= checkIn) {
        throw new Error('Check-out must be after check-in');
      }

      // Check room availability
      const room = await prisma.hostelRoom.findUnique({
        where: { id: roomId },
        include: {
          bookings: {
            where: {
              booking_status: { in: ['confirmed', 'pending'] },
              AND: [
                { check_out_datetime: { gte: getBookingCutoffDate() } },
                { check_in_datetime:  { lt: checkOut } },
                { check_out_datetime: { gte: checkIn } }
              ]
            }
          }
        }
      });

      if (!room) {
        throw new Error('Room not found');
      }

      if (room.bookings.length > 0) {
        throw new Error('Room is not available for the selected dates');
      }

      if (!room.is_available) {
        throw new Error('Room is currently unavailable');
      }

      if (guestCountInt > room.max_occupancy) {
        throw new Error(`Room can accommodate maximum ${room.max_occupancy} guests`);
      }

      // Calculate billable days using Guest House schedule rules
      const { billableDays, checkoutTier } = calculateBillableDays(checkIn, checkOut);
      const pricePerDay = parseFloat(room.price_per_night);
      const totalPrice  = pricePerDay * billableDays;

      // Create booking
      const booking = await prisma.hostelBooking.create({
        data: {
          gate_pass:        { connect: { id: gatePassUUID } },
          room:             { connect: { id: roomId } },
          check_in_datetime:  checkIn,
          check_out_datetime: checkOut,
          check_in_remarks:   checkInRemarks || null,
          guest_count:        guestCountInt,
          billable_days:      billableDays,
          price_per_day:      pricePerDay,
          total_price:        totalPrice,
          booking_status:     'pending',
          payment_status:     'pending',
          created_by:         { connect: { id: createdById } }
        },
        include: {
          room: {
            include: {
              hostel: true
            }
          }
        }
      });

      // Generate payment QR
      const paymentQR = await this.generatePaymentQR(booking.id, totalPrice);

      // Mark gate pass as requiring hostel stay so cancelBeforeCheckIn can find the booking
      await prisma.gate_pass.update({
        where: { id: gatePassUUID },
        data: { stay_required: true }
      });

      // Update booking with payment QR
      const updatedBooking = await prisma.hostelBooking.update({
        where: { id: booking.id },
        data: {
          payment_qr_code: paymentQR,
          payment_reference: `HSTEL-${booking.id.substring(0, 8).toUpperCase()}`
        },
        include: {
          room: {
            include: {
              hostel: true
            }
          },
          gate_pass: {
            select: {
              pass_id       : true,
              visitor_name  : true,
              mobile_number : true,
              email         : true,
              qr_code       : true,
              verification_code: true
            }
          }
        }
      });

      // Note: gate_pass relation is auto-established via gate_pass_id
      return updatedBooking;
    } catch (error) {
      console.error('Error creating booking:', error);
      throw error;
    }
  }

  /**
   * Confirm payment for a booking
   * @param {string} bookingId
   * @param {string} paymentReference
   * @param {string} verifiedByUserId
   * @returns {Promise<Object>}
   */
  async confirmPayment(bookingId, paymentReference, verifiedByUserId) {
    try {
      const booking = await prisma.hostelBooking.findUnique({
        where: { id: bookingId },
        include: {
          gate_pass: {
            select: {
              created_by_id: true
            }
          }
        }
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.payment_status === 'completed') {
        throw new Error('Payment already confirmed');
      }

      // Check if user is the creator of the associated pass
      const user = await prisma.userLogin.findUnique({
        where: { id: verifiedByUserId },
        select: { role: true }
      });
      
      const isAdmin = user?.role?.toLowerCase() === 'admin';
      const isCreator = booking.gate_pass?.created_by_id === verifiedByUserId;
      
      if (!isAdmin && !isCreator) {
        throw new Error('Only the pass creator or admin can confirm payment');
      }

      const updatedBooking = await prisma.hostelBooking.update({
        where: { id: bookingId },
        data: {
          payment_status: 'completed',
          verified_by_id: verifiedByUserId,
          payment_reference: paymentReference,
          booking_status: 'confirmed'
        },
        include: {
          room: {
            include: {
              hostel: true
            }
          },
          gate_pass: {
            select: {
              pass_id      : true,
              visitor_name : true,
              mobile_number: true,
              email        : true,
              qr_code      : true,
              verification_code: true
            }
          }
        }
      });

      return updatedBooking;
    } catch (error) {
      console.error('Error confirming payment:', error);
      throw error;
    }
  }

  /**
   * Cancel a hostel booking
   * @param {string} bookingId
   * @returns {Promise<Object>}
   */
  async cancelBooking(bookingId) {
    try {
      const booking = await prisma.hostelBooking.findUnique({
        where: { id: bookingId }
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.booking_status === 'completed') {
        throw new Error('Cannot cancel completed booking');
      }

      const updatedBooking = await prisma.hostelBooking.update({
        where: { id: bookingId },
        data: {
          booking_status: 'cancelled'
        },
        include: {
          room: {
            include: {
              hostel: true
            }
          }
        }
      });

      // Note: gate_pass relation is maintained via gate_pass_id
      return updatedBooking;
    } catch (error) {
      console.error('Error cancelling booking:', error);
      throw error;
    }
  }

  /**
   * Get booking by pass ID
   * @param {string} passId
   * @returns {Promise<Object|null>}
   */
  async getBookingByPass(passId) {
    try {
      // Resolve formatted pass_id to UUID
      const gatePass = await prisma.gate_pass.findUnique({
        where: { pass_id: passId },
        select: { id: true }
      });

      if (!gatePass) {
        return null;
      }

      const booking = await prisma.hostelBooking.findUnique({
        where: { gate_pass_id: gatePass.id },
        include: {
          room: {
            include: {
              hostel: true
            }
          },
          created_by: {
            select: {
              id: true,
              email: true,
              employeeDetails: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        }
      });

      return booking;
    } catch (error) {
      console.error('Error fetching booking:', error);
      throw new Error('Failed to fetch booking');
    }
  }

  /**
   * Link existing booking to pass
   * @param {string} passId
   * @param {string} hostelId
   * @param {string} roomNumber
   * @returns {Promise<Object>}
   */
  async linkExistingBooking(passId, hostelId, roomNumber) {
    try {
      // Find the room
      const room = await prisma.hostelRoom.findFirst({
        where: {
          hostel_id: hostelId,
          room_number: roomNumber
        }
      });

      if (!room) {
        throw new Error('Room not found');
      }

      // Update gate_pass with hostel information (without creating booking)
      const updatedPass = await prisma.gate_pass.update({
        where: { id: passId },
        data: {
          special_instructions: `Has existing hostel booking: ${roomNumber}`,
          stay_required: true
        }
      });

      return {
        success: true,
        message: 'Existing booking linked to pass',
        hostel_id: hostelId,
        room_number: roomNumber
      };
    } catch (error) {
      console.error('Error linking existing booking:', error);
      throw error;
    }
  }
}

module.exports = new HostelBookingService();
