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
  expectedEntryTime: string;
  expectedExitTime: string;
  
  // Vehicle Details
  bringingVehicle?: boolean;
  vehicleType?: string;
  vehicleNumber?: string;
  vehicleModel?: string;
  
  // Stay Details
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
  expectedEntryTime: string;
  expectedExitTime: string;
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
  status: string;
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

// Helper function to convert snake_case keys to camelCase
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Transform object keys from snake_case to camelCase
function transformPass(pass: any): GatePass {
  // Extract creator info from the relation
  const creatorData = pass.user_login_gate_pass_created_by_idTouser_login;
  const creatorName = creatorData?.employeeDetails?.displayName || creatorData?.uid || 'Unknown';
  
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
    expectedEntryTime: pass.expected_entry_time,
    expectedExitTime: pass.expected_exit_time,
    hasVehicle: pass.has_vehicle,
    vehicleType: pass.vehicle_type,
    vehicleNumber: pass.vehicle_number,
    vehicleModel: pass.vehicle_model,
    stayRequired: pass.stay_required,
    checkInDate: pass.check_in_date,
    checkOutDate: pass.check_out_date,
    hostelName: pass.hostel_name,
    roomNumber: pass.room_number,
    numberOfPersons: pass.number_of_persons,
    specialInstructions: pass.special_instructions,
    itemsCarrying: pass.items_carrying,
    status: pass.status,
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
   * Verify a gate pass (by ID, mobile, name, or vehicle number)
   */
  async verifyPass(searchTerm: string, searchType: 'passId' | 'mobile' | 'visitorName' | 'vehicleNumber'): Promise<{ success: boolean; pass: GatePass | null }> {
    // Map frontend searchType to backend format
    const backendSearchType = searchType === 'visitorName' ? 'name' : searchType === 'vehicleNumber' ? 'vehicle' : searchType === 'passId' ? 'pass_id' : searchType;
    
    const response = await api.post<any>(
      '/gate-entry/verify',
      { searchTerm, searchType: backendSearchType }
    );
    
    const rawPass = response.data?.data?.pass;
    return { success: response.data.success, pass: rawPass ? transformPass(rawPass) : null };
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
  async recordExit(passId: string, data: { gate?: string; remarks?: string }): Promise<{ success: boolean; pass: GatePass }> {
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
}

export const gateEntryService = new GateEntryService();
export default gateEntryService;
