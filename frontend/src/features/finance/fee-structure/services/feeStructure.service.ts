import api from '@/shared/api/api';

export interface FeeHead {
  id?: string;
  headName: string;
  amount: number;
  semesterAmounts?: Record<number, number>;
}

export interface FeeStructure {
  id: string;
  type: 'TRANSPORT' | 'HOSTEL' | 'ACADEMIC';
  batchYear: number;
  programId: string | null;
  specializationId: string | null;
  isActive: boolean;
  heads: FeeHead[];
  program?: {
    id: string;
    programCode: string;
    programName: string;
  };
  specialization?: {
    id: string;
    specializationCode: string;
    specializationName: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeeStructureDto {
  type: 'TRANSPORT' | 'HOSTEL' | 'ACADEMIC';
  batchYear: number;
  programId?: string;
  specializationId?: string;
  heads: { headName: string; amount?: number; semesterAmounts?: Record<number, number> }[];
}

export interface CreateAcademicBatchDto {
  batchYear: number;
  programId: string;
  baseHeads?: { headName: string; amount?: number; semesterAmounts?: Record<number, number> }[];
  specializationStructures?: Array<{
    specializationId: string;
    heads: { headName: string; amount?: number; semesterAmounts?: Record<number, number> }[];
  }>;
}

export type BulkSemesterKey = `sem${number}`;

export interface BulkRow extends Partial<Record<BulkSemesterKey, number>> {
  programCode: string;
  batchYear: number;
  specializationCode?: string;
  headName: string;
  totalAmount?: number;
}

export interface BulkGroupResult {
  key: string;
  programCode: string;
  batchYear: number;
  specializationCode: string;
  headCount: number;
  status: 'created' | 'skipped' | 'error';
  message: string;
}

export interface BulkResult {
  created: number;
  skipped: number;
  errors: string[];
  groups: BulkGroupResult[];
}

export interface UpdateFeeStructureDto {
  heads?: { headName: string; amount?: number; semesterAmounts?: Record<number, number> }[];
  isActive?: boolean;
}

class FeeStructureService {
  private baseUrl = '/finance/fee-structure';

  async getAll(params?: {
    type?: string;
    batchYear?: number;
    programId?: string;
  }): Promise<{ success: boolean; data: FeeStructure[] }> {
    const response = await api.get<{ success: boolean; data: FeeStructure[] }>(this.baseUrl, { params });
    return response.data;
  }

  async getById(id: string): Promise<{ success: boolean; data: FeeStructure }> {
    const response = await api.get<{ success: boolean; data: FeeStructure }>(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async getForProgram(programId: string): Promise<{ success: boolean; data: FeeStructure[] }> {
    const response = await api.get<{ success: boolean; data: FeeStructure[] }>(`${this.baseUrl}/program/${programId}`);
    return response.data;
  }

  async downloadAcademicTemplate(): Promise<Blob> {
    const response = await api.get<Blob>(`${this.baseUrl}/template/academic`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async create(data: CreateFeeStructureDto): Promise<{ success: boolean; message: string; data: FeeStructure }> {
    const response = await api.post<{ success: boolean; message: string; data: FeeStructure }>(this.baseUrl, data);
    return response.data;
  }

  async createAcademicBatch(data: CreateAcademicBatchDto): Promise<{ success: boolean; message: string; data: FeeStructure[] }> {
    const response = await api.post<{ success: boolean; message: string; data: FeeStructure[] }>(`${this.baseUrl}/batch/academic`, data);
    return response.data;
  }

  async update(id: string, data: UpdateFeeStructureDto): Promise<{ success: boolean; message: string; data: FeeStructure }> {
    const response = await api.put<{ success: boolean; message: string; data: FeeStructure }>(`${this.baseUrl}/${id}`, data);
    return response.data;
  }

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async bulkCreate(rows: BulkRow[]): Promise<{ success: boolean; message: string; data: BulkResult }> {
    const response = await api.post<{ success: boolean; message: string; data: BulkResult }>(`${this.baseUrl}/bulk`, { rows });
    return response.data;
  }
}

export const feeStructureService = new FeeStructureService();
