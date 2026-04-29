import api from '@/shared/api/api';

export interface BulkUploadResult {
  success: boolean;
  message: string;
  totalRecords: number;
  successCount: number;
  failedCount: number;
  errors?: Array<{
    row: number;
    field: string;
    message: string;
    data: any;
  }>;
}

export interface PreviewData {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  previewRows: number;
  message: string;
}

export interface PreviewResponse {
  success: boolean;
  data: PreviewData;
}

export interface BulkUploadResponse {
  success: boolean;
  message: string;
  data: BulkUploadResult;
}

export interface UploadStats {
  schools: number;
  departments: number;
  programmes: number;
  employees: number;
  students: number;
}

class BulkUploadService {
  private baseUrl = '/bulk-upload';

  // Template downloads - returns blob for manual handling
  async downloadSchoolTemplate(): Promise<Blob> {
    const response = await api.get(`${this.baseUrl}/template/schools`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async downloadDepartmentTemplate(): Promise<Blob> {
    const response = await api.get(`${this.baseUrl}/template/departments`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async downloadProgrammeTemplate(): Promise<Blob> {
    const response = await api.get(`${this.baseUrl}/template/programmes`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async downloadEmployeeTemplate(): Promise<Blob> {
    const response = await api.get(`${this.baseUrl}/template/employees`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async downloadStudentTemplate(): Promise<Blob> {
    const response = await api.get(`${this.baseUrl}/template/students`, {
      responseType: 'blob',
    });
    return response.data;
  }

  // Bulk uploads - accepts File object
  async uploadSchools(file: File): Promise<{ data: BulkUploadResult }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<{ success: boolean; data: BulkUploadResult }>(`${this.baseUrl}/schools`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async uploadDepartments(file: File): Promise<{ data: BulkUploadResult }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<{ success: boolean; data: BulkUploadResult }>(`${this.baseUrl}/departments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async uploadProgrammes(file: File): Promise<{ data: BulkUploadResult }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<{ success: boolean; data: BulkUploadResult }>(`${this.baseUrl}/programmes`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async uploadEmployees(file: File): Promise<{ data: BulkUploadResult }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<{ success: boolean; data: BulkUploadResult }>(`${this.baseUrl}/employees`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  async uploadStudents(file: File): Promise<{ data: BulkUploadResult }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<{ success: boolean; data: BulkUploadResult }>(`${this.baseUrl}/students`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  // Data preview - server-side Excel parsing
  async previewData(file: File): Promise<PreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<PreviewResponse>(`${this.baseUrl}/preview`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  // Stats
  async getUploadStats(): Promise<{ data: UploadStats }> {
    const response = await api.get<{ success: boolean; data: UploadStats }>(`${this.baseUrl}/stats`);
    return response.data;
  }
}

export const bulkUploadService = new BulkUploadService();
