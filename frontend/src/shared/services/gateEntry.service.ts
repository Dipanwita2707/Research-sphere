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

class GateEntryService {
  /**
   * Create a new gate pass
   */
  async createPass(data: CreateGatePassData): Promise<GatePassCreateResponse> {
    // For now, send as JSON (photo upload will be added later)
    // Remove photo from data as it can't be sent as JSON
    const { photo, ...jsonData } = data;
    
    const response = await api.post<GatePassCreateResponse>(
      '/gate-entry/create-pass',
      jsonData
    );
    return response.data;
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
    const response = await api.get<GatePassListResponse>('/gate-entry/passes', {
      params,
    });
    return response.data;
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
  async verifyPass(searchTerm: string, searchType: 'passId' | 'mobile' | 'visitorName' | 'vehicleNumber'): Promise<{ success: boolean; pass: GatePass }> {
    // Map frontend searchType to backend format
    const backendSearchType = searchType === 'visitorName' ? 'name' : searchType === 'vehicleNumber' ? 'vehicle' : searchType;
    
    const response = await api.post<{ success: boolean; data: { pass: GatePass } }>(
      '/gate-entry/verify',
      { searchTerm, searchType: backendSearchType }
    );
    
    return { success: response.data.success, pass: response.data.data.pass };
  }

  /**
   * Allow entry for a verified pass
   */
  async allowEntry(passId: string, data: { gate?: string; remarks?: string; verificationCode?: string }): Promise<{ success: boolean; pass: GatePass }> {
    const response = await api.post<{ success: boolean; data: { pass: GatePass } }>(
      `/gate-entry/allow-entry/${passId}`,
      data
    );
    return { success: response.data.success, pass: response.data.data.pass };
  }

  /**
   * Deny entry for a pass
   */
  async denyEntry(passId: string, denialReason: string): Promise<{ success: boolean; pass: GatePass }> {
    const response = await api.post<{ success: boolean; data: { pass: GatePass } }>(
      `/gate-entry/deny-entry/${passId}`,
      { denialReason }
    );
    return { success: response.data.success, pass: response.data.data.pass };
  }

  /**
   * Record exit for a pass
   */
  async recordExit(passId: string, data: { gate?: string; remarks?: string }): Promise<{ success: boolean; pass: GatePass }> {
    const response = await api.post<{ success: boolean; data: { pass: GatePass } }>(
      `/gate-entry/record-exit/${passId}`,
      data
    );
    return { success: response.data.success, pass: response.data.data.pass };
  }

  /**
   * Cancel a gate pass
   */
  async cancelPass(passId: string, reason: string): Promise<{ success: boolean; pass: GatePass }> {
    const response = await api.post<{ success: boolean; data: { pass: GatePass } }>(
      `/gate-entry/cancel/${passId}`,
      { reason }
    );
    return { success: response.data.success, pass: response.data.data.pass };
  }
}

export const gateEntryService = new GateEntryService();
export default gateEntryService;
