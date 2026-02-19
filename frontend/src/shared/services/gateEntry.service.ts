import api from '@/shared/api/api';

// Types for Gate Entry (simplified form)
export interface CreateGatePassData {
  // Visitor Personal Details
  fullName: string;
  mobileNumber: string;
  visitorRelation?: string;
  
  // Visit Details
  purposeOfVisit: string;
  purposeOther?: string;
  visitDate: string;
  visitEndDate?: string; // For multi-day passes
  entryTime: string; // New: single entry time
  expectedEntryTime?: string; // Deprecated: for backward compatibility
  expectedExitTime?: string; // Optional for multi-day
  
  // Vehicle Details
  bringingVehicle?: boolean;
  vehicleType?: string;
  vehicleNumber?: string;
  vehicleModel?: string;
  
  // Stay Details (multi-day)
  stayRequired?: boolean;
  checkInDate?: string;
  checkOutDate?: string;
  hostelName?: string;
  roomNumber?: string;
  
  // Legacy fields (optional for backward compatibility)
  email?: string;
  idProofType?: string;
  idProofNumber?: string;
  photo?: File | null;
  gender?: string;
  age?: number;
  departmentToVisit?: string;
  personToMeetId?: string;
  numberOfPersons?: number;
  specialInstructions?: string;
  itemsCarrying?: string;
}

export interface GatePass {
  id: string;
  passId: string;
  visitorName: string;
  mobileNumber: string;
  visitorRelation?: string;
  email?: string;
  idProofType?: string;
  idProofNumber?: string;
  photoPath?: string;
  gender?: string;
  age?: number;
  purposeOfVisit: string;
  purposeOther?: string;
  departmentToVisit?: string;
  personToMeetId?: string;
  personToMeetName?: string;
  visitDate: string;
  entryTime?: string; // New field
  expectedEntryTime: string;
  expectedExitTime?: string;
  hasVehicle: boolean;
  vehicleType?: string;
  vehicleNumber?: string;
  vehicleModel?: string;
  stayRequired?: boolean;
  checkInDate?: string;
  checkOutDate?: string;
  hostelName?: string;
  roomNumber?: string;
  numberOfPersons?: number;
  specialInstructions?: string;
  itemsCarrying?: string;
  status: string; // Legacy field
  qrStatus?: 'inactive' | 'active' | 'cancelled' | 'expired';
  passStatus?: 'created' | 'checked_in' | 'cancelled' | 'checked_out' | 'expired';
  qrActivationTime?: string;
  visitEndDate?: string;
  extensionCount?: number;
  extensionReason?: string;
  cancellationTime?: string;
  checkoutUniqueId?: string;
  checkoutVerificationCode?: string;
  checkoutQrCode?: string;
  checkoutQrExpiresAt?: string;
  qrCode?: string;
  verificationCode?: string;
  actualEntryTime?: string;
  actualExitTime?: string;
  entryGuardId?: string;
  exitGuardId?: string;
  createdAt: string;
  updatedAt: string;
  creator?: {
    id: string;
    username: string;
  };
}

export interface GatePassStats {
  total: number;
  active: number;      // Active Today count
  pending: number;     // All non-completed passes
  completed: number;
  expired: number;
  checkedIn?: number;  // Optional
  cancelled?: number;  // Optional
}

export interface GatePassListResponse {
  success: boolean;
  data: {
    passes: GatePass[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface GatePassCreateResponse {
  success: boolean;
  message: string;
  data: {
    pass: GatePass;
  };
}

export interface VerifyPassResponse {
  success: boolean;
  pass: GatePass;
  isValid: boolean;
  message: string;
}

export interface Hostel {
  id: string;
  name: string;
  hostelType: 'boys' | 'girls' | 'coed';
  totalRooms: number;
  address?: string;
  facilities?: string[];
  isActive: boolean;
  availableRoomsCount?: number;
  hostelRooms?: HostelRoom[];
}

export interface HostelRoom {
  id: string;
  hostelId: string;
  roomNumber: string;
  roomType: 'single' | 'double' | 'triple' | 'suite';
  pricePerNight: number;
  maxOccupancy: number;
  isAvailable: boolean;
  isAc: boolean;
  sharingType: string | null;
  amenities: string[] | null;
}

export interface HostelBooking {
  id: string;
  linkedPassId: string;
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  totalPrice: number;
  bookingStatus: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentQrCode?: string;
  paymentReference?: string;
  hostel?: Hostel;
  room?: HostelRoom;
  createdAt: string;
  updatedAt: string;
}

// Helper function to convert snake_case keys to camelCase
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Transform hostel data from snake_case to camelCase
function transformHostel(hostel: any): Hostel {
  if (!hostel) return hostel;
  return {
    id: hostel.id,
    name: hostel.name,
    hostelType: hostel.hostel_type || hostel.hostelType,
    totalRooms: hostel.total_rooms || hostel.totalRooms,
    address: hostel.address,
    facilities: hostel.facilities,
    isActive: hostel.is_active ?? hostel.isActive ?? true,
    availableRoomsCount: hostel.available_rooms_count || hostel.availableRoomsCount || 0,
    hostelRooms: (hostel.rooms || hostel.hostelRooms || []).map((r: any) => transformRoom(r)),
  };
}

// Transform room data from snake_case to camelCase
function transformRoom(room: any): HostelRoom {
  if (!room) return room;
  // Parse amenities if it's a JSON string
  let amenities: string[] | null = null;
  if (room.amenities) {
    try {
      amenities = typeof room.amenities === 'string' ? JSON.parse(room.amenities) : room.amenities;
    } catch {
      amenities = null;
    }
  }
  return {
    id: room.id,
    hostelId: room.hostel_id || room.hostelId,
    roomNumber: room.room_number || room.roomNumber,
    roomType: room.room_type || room.roomType,
    pricePerNight: room.price_per_night || room.pricePerNight,
    maxOccupancy: room.max_occupancy || room.maxOccupancy,
    isAvailable: room.is_available ?? room.isAvailable ?? true,
    isAc: room.is_ac ?? room.isAc ?? false,
    sharingType: room.sharing_type || room.sharingType || null,
    amenities: amenities,
  };
}

// Transform booking data from snake_case to camelCase
function transformBooking(booking: any): HostelBooking {
  if (!booking) return booking;
  return {
    id: booking.id,
    linkedPassId: booking.linked_pass_id || booking.linkedPassId,
    roomId: booking.room_id || booking.roomId,
    checkInDate: booking.check_in_date || booking.checkInDate,
    checkOutDate: booking.check_out_date || booking.checkOutDate,
    guestCount: booking.guest_count || booking.guestCount,
    totalPrice: booking.total_price || booking.totalPrice,
    bookingStatus: booking.booking_status || booking.bookingStatus,
    paymentStatus: booking.payment_status || booking.paymentStatus,
    paymentQrCode: booking.payment_qr_code || booking.paymentQrCode,
    paymentReference: booking.payment_reference || booking.paymentReference,
    hostel: booking.room?.hostel ? transformHostel(booking.room.hostel) : (booking.hostel ? transformHostel(booking.hostel) : undefined),
    room: booking.room ? transformRoom(booking.room) : undefined,
    createdAt: booking.created_at || booking.createdAt,
    updatedAt: booking.updated_at || booking.updatedAt,
  };
}

// Transform object keys from snake_case to camelCase
function transformPass(pass: any): GatePass {
  // Extract creator info from the relation
  const creatorData = pass.user_login_gate_pass_created_by_idTouser_login;
  const creatorName = creatorData?.employeeDetails?.displayName || creatorData?.uid || 'Unknown';
7
  // Extract hostel booking details if available
  const hostelBooking = pass.hostel_booking;
  const hostelName = hostelBooking?.room?.hostel?.name || pass.hostel_name || null;
  const roomNumber = hostelBooking?.room?.room_number || pass.room_number || null;
  const checkInDate = hostelBooking?.check_in_date || pass.check_in_date || null;
  const checkOutDate = hostelBooking?.check_out_date || pass.check_out_date || null;
  
  return {
    id: pass.id,
    passId: pass.pass_id,
    visitorName: pass.visitor_name,
    mobileNumber: pass.mobile_number,
    visitorRelation: pass.visitor_relation,
    email: pass.email,
    idProofType: pass.id_proof_type,
    idProofNumber: pass.id_proof_number,
    photoPath: pass.photo_file_path,
    gender: pass.gender,
    age: pass.age,
    purposeOfVisit: pass.purpose_of_visit,
    purposeOther: pass.purpose_other,
    departmentToVisit: pass.department_to_visit,
    personToMeetId: pass.person_to_meet_id,
    personToMeetName: pass.person_to_meet_name,
    visitDate: pass.visit_date,
    entryTime: pass.entry_time,
    expectedEntryTime: pass.expected_entry_time || pass.entry_time,
    expectedExitTime: pass.expected_exit_time,
    hasVehicle: pass.has_vehicle,
    vehicleType: pass.vehicle_type,
    vehicleNumber: pass.vehicle_number,
    vehicleModel: pass.vehicle_model,
    stayRequired: pass.stay_required,
    checkInDate: checkInDate,
    checkOutDate: checkOutDate,
    hostelName: hostelName,
    roomNumber: roomNumber,
    numberOfPersons: pass.number_of_persons,
    specialInstructions: pass.special_instructions,
    itemsCarrying: pass.items_carrying,
    status: pass.status,
    qrStatus: pass.qrStatus || pass.qr_status,
    passStatus: pass.passStatus || pass.pass_status,
    qrActivationTime: pass.qrActivationTime || pass.qr_activation_time,
    extensionCount: pass.extensionCount || pass.extension_count || 0,
    extensionReason: pass.extensionReason || pass.extension_reason,
    visitEndDate: pass.visitEndDate || pass.visit_end_date,
    cancellationTime: pass.cancellationTime || pass.cancellation_time,
    checkoutUniqueId: pass.checkoutUniqueId || pass.checkout_unique_id,
    checkoutVerificationCode: pass.checkoutVerificationCode || pass.checkout_verification_code,
    checkoutQrCode: pass.checkoutQrCode || pass.checkout_qr_code,
    checkoutQrExpiresAt: pass.checkoutQrExpiresAt || pass.checkout_qr_expires_at,
    qrCode: pass.qr_code,
    verificationCode: pass.verification_code,
    actualEntryTime: pass.actual_entry_time,
    actualExitTime: pass.actual_exit_time,
    entryGuardId: pass.entry_guard_id,
    exitGuardId: pass.exit_guard_id,
    createdAt: pass.created_at,
    updatedAt: pass.updated_at,
    creator: creatorData ? {
      id: creatorData.id,
      username: creatorName,
    } : undefined,
  };
}

class GateEntryService {
  /**
   * Create a new gate pass
   */
  async createPass(data: CreateGatePassData): Promise<GatePassCreateResponse> {
    // For now, send as JSON (photo upload will be added later)
    // Remove photo from data as it can't be sent as JSON
    const { photo, ...jsonData } = data;
    
    const response = await api.post<any>(
      '/gate-entry/create-pass',
      jsonData
    );
    
    // Transform snake_case to camelCase
    const rawPass = response.data?.data?.pass;
    return {
      success: response.data.success,
      message: response.data.message,
      data: {
        pass: rawPass ? transformPass(rawPass) : null
      }
    } as GatePassCreateResponse;
  }

  /**
   * Get all gate passes with filters
   */
  async getAllPasses(params?: {
    search?: string;
    status?: string;
    date?: string;
    page?: number;
    limit?: number;
  }): Promise<GatePassListResponse> {
    const response = await api.get<any>('/gate-entry/passes', {
      params,
    });
    
    // Transform snake_case to camelCase for all passes
    const rawPasses = response.data?.data?.passes || [];
    const transformedPasses = rawPasses.map((pass: any) => transformPass(pass));
    
    return {
      success: response.data.success,
      data: {
        passes: transformedPasses,
        pagination: response.data?.data?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 }
      }
    } as GatePassListResponse;
  }

  /**
   * Get gate pass statistics
   */
  async getStats(): Promise<GatePassStats> {
    const response = await api.get<{ success: boolean; data: GatePassStats }>(
      '/gate-entry/stats'
    );
    return response.data.data;
  }

  /**
   * Verify a gate pass (by ID, mobile, name, vehicle number, or checkout QR)
   */
  async verifyPass(searchTerm: string, searchType: 'passId' | 'mobile' | 'visitorName' | 'vehicleNumber' | 'checkout_qr'): Promise<{ 
    success: boolean; 
    pass: GatePass | null;
    isCancelled?: boolean;
    checkoutQRRemaining?: number;
    message?: string;
  }> {
    // Map frontend searchType to backend format
    const backendSearchType = searchType === 'visitorName' ? 'name' 
      : searchType === 'vehicleNumber' ? 'vehicle' 
      : searchType === 'passId' ? 'pass_id' 
      : searchType; // checkout_qr stays as is
    
    const response = await api.post<any>(
      '/gate-entry/verify',
      { searchTerm, searchType: backendSearchType }
    );
    
    const rawPass = response.data?.data?.pass;
    return { 
      success: response.data.success, 
      pass: rawPass ? transformPass(rawPass) : null,
      isCancelled: response.data?.data?.isCancelled,
      checkoutQRRemaining: response.data?.data?.checkoutQRRemaining,
      message: response.data?.message
    };
  }

  /**
   * Allow entry for a verified pass
   */
  async allowEntry(passId: string, data: { gate?: string; remarks?: string; verificationCode?: string }): Promise<{ success: boolean; pass: GatePass }> {
    const response = await api.post<any>(
      `/gate-entry/allow-entry/${passId}`,
      data
    );
    const rawPass = response.data?.data?.pass;
    return { success: response.data.success, pass: rawPass ? transformPass(rawPass) : null as any };
  }

  /**
   * Deny entry for a pass
   */
  async denyEntry(passId: string, denialReason: string): Promise<{ success: boolean; pass: GatePass }> {
    const response = await api.post<any>(
      `/gate-entry/deny-entry/${passId}`,
      { denialReason }
    );
    const rawPass = response.data?.data?.pass;
    return { success: response.data.success, pass: rawPass ? transformPass(rawPass) : null as any };
  }

  /**
   * Record exit for a pass
   */
  async recordExit(passId: string, data: { gate?: string; remarks?: string; verificationCode?: string }): Promise<{ success: boolean; pass: GatePass }> {
    const response = await api.post<any>(
      `/gate-entry/record-exit/${passId}`,
      data
    );
    const rawPass = response.data?.data?.pass;
    return { success: response.data.success, pass: rawPass ? transformPass(rawPass) : null as any };
  }

  /**
   * Cancel a gate pass
   */
  async cancelPass(passId: string, reason: string): Promise<{ success: boolean; pass: GatePass }> {
    const response = await api.post<any>(
      `/gate-entry/cancel/${passId}`,
      { reason }
    );
    const rawPass = response.data?.data?.pass;
    return { success: response.data.success, pass: rawPass ? transformPass(rawPass) : null as any };
  }

  /**
   * Extend pass (modify entry time and date)
   */
  async extendPass(passId: string, newEndDate: string, extensionReason: string): Promise<{ success: boolean; pass: GatePass; message: string }> {
    const response = await api.post<any>(
      `/gate-entry/extend-pass/${passId}`,
      { newEndDate, extensionReason }
    );
    const rawPass = response.data?.data?.pass;
    return {
      success: response.data.success,
      message: response.data.message,
      pass: rawPass ? transformPass(rawPass) : null as any
    };
  }

  /**
   * Record checkout using checkout QR code
   */
  async recordCheckout(passId: string, data: { gate?: string; remarks?: string; verificationCode?: string }): Promise<{ success: boolean; pass: GatePass }> {
    const response = await api.post<any>(
      `/gate-entry/checkout/${passId}`,
      data
    );
    const rawPass = response.data?.data?.pass;
    return { success: response.data.success, pass: rawPass ? transformPass(rawPass) : null as any };
  }

  /**
   * Get available hostels for date range
   */
  async getAvailableHostels(checkIn: string, checkOut: string): Promise<{ success: boolean; hostels: Hostel[] }> {
    const response = await api.get<any>(
      '/gate-entry/hostels/available',
      { params: { checkIn, checkOut } }
    );
    const rawHostels = response.data?.data?.hostels || [];
    return {
      success: response.data.success,
      hostels: rawHostels.map((h: any) => transformHostel(h))
    };
  }

  /**
   * Get available rooms for a hostel
   */
  async getHostelRooms(hostelId: string, checkIn: string, checkOut: string): Promise<{ success: boolean; rooms: HostelRoom[] }> {
    const response = await api.get<any>(
      `/gate-entry/hostels/${hostelId}/rooms`,
      { params: { checkIn, checkOut } }
    );
    const rawRooms = response.data?.data?.rooms || [];
    return {
      success: response.data.success,
      rooms: rawRooms.map((r: any) => transformRoom(r))
    };
  }

  /**
   * Create hostel booking
   */
  async createBooking(data: {
    passId: string;
    hostelId: string;
    roomId: string;
    checkInDate: string;
    checkOutDate: string;
    guestCount: number;
  }): Promise<{ success: boolean; booking: HostelBooking; message: string }> {
    const response = await api.post<any>(
      '/gate-entry/bookings/create',
      data
    );
    const rawBooking = response.data?.data?.booking;
    return {
      success: response.data.success,
      message: response.data.message,
      booking: rawBooking ? transformBooking(rawBooking) : null as any
    };
  }

  /**
   * Confirm payment for hostel booking (Admin only)
   */
  async confirmPayment(bookingId: string, paymentReference: string): Promise<{ success: boolean; booking: HostelBooking; message: string }> {
    const response = await api.post<any>(
      `/gate-entry/bookings/${bookingId}/confirm-payment`,
      { paymentReference }
    );
    const rawBooking = response.data?.data?.booking;
    return {
      success: response.data.success,
      message: response.data.message,
      booking: rawBooking ? transformBooking(rawBooking) : null as any
    };
  }

  /**
   * Get booking details for a pass
   */
  async getBookingByPass(passId: string): Promise<{ success: boolean; booking: HostelBooking | null }> {
    try {
      const response = await api.get<any>(
        `/gate-entry/bookings/${passId}`
      );
      const rawBooking = response.data?.data?.booking;
      return {
        success: response.data.success,
        booking: rawBooking ? transformBooking(rawBooking) : null
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { success: false, booking: null };
      }
      throw error;
    }
  }
}

export const gateEntryService = new GateEntryService();
export default gateEntryService;
