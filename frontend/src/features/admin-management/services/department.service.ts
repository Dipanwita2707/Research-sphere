import api from '@/shared/api/api';

export interface Department {
  id: string;
  facultyId: string;
  departmentCode: string;
  departmentName: string;
  shortName?: string;
  description?: string;
  establishedYear?: number;
  headOfDepartmentId?: string;
  contactEmail?: string;
  contactPhone?: string;
  officeLocation?: string;
  isActive: boolean;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  faculty?: {
    id: string;
    facultyCode: string;
    facultyName: string;
  };
  headOfDepartment?: {
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
    primaryEmployees: number;
    programs: number;
  };
  programs?: Array<{
    id: string;
    programCode: string;
    programName: string;
    programType: string;
    isActive: boolean;
  }>;
}

export interface CreateDepartmentDto {
  facultyId: string;
  departmentCode: string;
  departmentName: string;
  shortName?: string;
  description?: string;
  establishedYear?: number;
  headOfDepartmentId?: string;
  contactEmail?: string;
  contactPhone?: string;
  officeLocation?: string;
  metadata?: any;
}

export interface UpdateDepartmentDto extends Partial<CreateDepartmentDto> {}

class DepartmentService {
  private baseUrl = '/departments';

  async getAllDepartments(params?: { 
    isActive?: boolean; 
    schoolId?: string;
  }): Promise<{ success: boolean; data: Department[] }> {
    const response = await api.get<{ success: boolean; data: Department[] }>(this.baseUrl, { params });
    return response.data;
  }

  async getDepartmentById(id: string): Promise<{ success: boolean; data: Department }> {
    const response = await api.get<{ success: boolean; data: Department }>(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async getDepartmentsBySchool(schoolId: string): Promise<{ success: boolean; data: Department[] }> {
    const response = await api.get<{ success: boolean; data: Department[] }>(
      `${this.baseUrl}/by-school/${schoolId}`
    );
    return response.data;
  }

  async createDepartment(data: CreateDepartmentDto): Promise<{ success: boolean; message: string; data: Department }> {
    const response = await api.post<{ success: boolean; message: string; data: Department }>(
      this.baseUrl,
      data
    );
    return response.data;
  }

  async updateDepartment(id: string, data: UpdateDepartmentDto): Promise<{ success: boolean; message: string; data: Department }> {
    const response = await api.put<{ success: boolean; message: string; data: Department }>(
      `${this.baseUrl}/${id}`,
      data
    );
    return response.data;
  }

  async deleteDepartment(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async toggleDepartmentStatus(id: string): Promise<{ success: boolean; message: string; data: Department }> {
    const response = await api.patch<{ success: boolean; message: string; data: Department }>(
      `${this.baseUrl}/${id}/toggle-status`
    );
    return response.data;
  }
}

export const departmentService = new DepartmentService();
