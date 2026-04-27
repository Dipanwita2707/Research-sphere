import api from '@/shared/api/api';

export interface Specialization {
  id: string;
  programId: string;
  specializationCode: string;
  specializationName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProgramCreditRange {
  min?: number;
  max?: number;
}

export interface SpecializationChargeRule {
  specializationCode: string;
  specializationName: string;
  batchYear: number;
  startSemester: number;
  requireNonZeroCharge: boolean;
  isActive?: boolean;
}

export interface ProgramBatchYearDocument {
  batchYear: number;
  admissionCapacity?: number;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: string;
}

export interface ProgramMetadata {
  creditRange?: ProgramCreditRange;
  specializationChargeRules?: SpecializationChargeRule[];
  batchYearDocuments?: ProgramBatchYearDocument[];
  internshipApplicable?: boolean;
  internshipDurationMonths?: number;
  internshipSpecializations?: string[];
  [key: string]: any;
}

export interface Program {
  id: string;
  departmentId: string;
  programCode: string;
  programName: string;
  programType: string;
  shortName?: string;
  description?: string;
  durationYears?: number;
  durationMonths?: number;
  durationSemesters?: number;
  totalCredits?: number;
  admissionCapacity?: number;
  currentEnrollment?: number;
  programCoordinatorId?: string;
  accreditationBody?: string;
  accreditationStatus?: string;
  isActive: boolean;
  metadata?: ProgramMetadata;
  createdAt: string;
  updatedAt: string;
  specializations?: Specialization[];
  department?: {
    id: string;
    departmentCode: string;
    departmentName: string;
    faculty?: {
      id: string;
      facultyCode: string;
      facultyName: string;
    };
  };
  programCoordinator?: {
    id: string;
    uid: string;
    employeeDetails?: {
      firstName: string;
      lastName?: string;
      displayName?: string;
      empId?: string;
      designation?: string;
    };
  };
  _count?: {
    sections: number;
    students: number;
  };
}

export interface ProgramType {
  value: string;
  label: string;
}

export interface CreateProgramDto {
  departmentId: string;
  programCode: string;
  programName: string;
  programType: string;
  shortName?: string;
  description?: string;
  durationYears?: number;
  durationMonths?: number;
  durationSemesters?: number;
  totalCredits?: number;
  admissionCapacity?: number;
  programCoordinatorId?: string;
  accreditationBody?: string;
  accreditationStatus?: string;
  metadata?: ProgramMetadata;
  specializations?: string[];
}

export interface UploadedProgramDocument {
  fileName: string;
  originalName: string;
  filePath: string;
  s3Key: string;
  fileSize: number;
  mimeType: string;
  location?: string | null;
}

export interface UpdateProgramDto extends Partial<CreateProgramDto> {
  currentEnrollment?: number;
}

class ProgramService {
  private baseUrl = '/programs';

  async getAllPrograms(params?: {
    isActive?: boolean;
    departmentId?: string;
    schoolId?: string;
    programType?: string;
  }): Promise<{ success: boolean; data: Program[] }> {
    const response = await api.get<{ success: boolean; data: Program[] }>(this.baseUrl, { params });
    return response.data;
  }

  async getProgramById(id: string): Promise<{ success: boolean; data: Program }> {
    const response = await api.get<{ success: boolean; data: Program }>(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async getProgramsByDepartment(departmentId: string): Promise<{ success: boolean; data: Program[] }> {
    const response = await api.get<{ success: boolean; data: Program[] }>(
      `${this.baseUrl}/by-department/${departmentId}`
    );
    return response.data;
  }

  async getProgramTypes(): Promise<{ success: boolean; data: ProgramType[] }> {
    const response = await api.get<{ success: boolean; data: ProgramType[] }>(`${this.baseUrl}/types`);
    return response.data;
  }

  async createProgram(data: CreateProgramDto): Promise<{ success: boolean; message: string; data: Program }> {
    const response = await api.post<{ success: boolean; message: string; data: Program }>(
      this.baseUrl,
      data
    );
    return response.data;
  }

  async uploadProgramDocument(file: File, folder = 'programmes/documents'): Promise<UploadedProgramDocument> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const response = await api.post<{ success: boolean; data: UploadedProgramDocument }>(
      '/file-upload/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );

    return response.data.data;
  }

  getProgramDocumentUrl(filePath: string): string {
    return `${api.defaults.baseURL}/file-upload/download/${filePath}`;
  }

  async updateProgram(id: string, data: UpdateProgramDto): Promise<{ success: boolean; message: string; data: Program }> {
    const response = await api.put<{ success: boolean; message: string; data: Program }>(
      `${this.baseUrl}/${id}`,
      data
    );
    return response.data;
  }

  async deleteProgram(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async toggleProgramStatus(id: string): Promise<{ success: boolean; message: string; data: Program }> {
    const response = await api.patch<{ success: boolean; message: string; data: Program }>(
      `${this.baseUrl}/${id}/toggle-status`
    );
    return response.data;
  }

  async addSpecialization(programId: string, specializationName: string): Promise<{ success: boolean; message: string; data: Specialization }> {
    const response = await api.post<{ success: boolean; message: string; data: Specialization }>(
      `${this.baseUrl}/${programId}/specializations`,
      { specializationName }
    );
    return response.data;
  }

  async updateSpecialization(programId: string, specId: string, data: { specializationName?: string; isActive?: boolean }): Promise<{ success: boolean; message: string; data: Specialization }> {
    const response = await api.put<{ success: boolean; message: string; data: Specialization }>(
      `${this.baseUrl}/${programId}/specializations/${specId}`,
      data
    );
    return response.data;
  }

  async deleteSpecialization(programId: string, specId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(
      `${this.baseUrl}/${programId}/specializations/${specId}`
    );
    return response.data;
  }

  async getSpecializations(programId: string): Promise<{ success: boolean; data: Specialization[] }> {
    const response = await api.get<{ success: boolean; data: Specialization[] }>(
      `${this.baseUrl}/${programId}/specializations`
    );
    return response.data;
  }
}

export const programService = new ProgramService();
