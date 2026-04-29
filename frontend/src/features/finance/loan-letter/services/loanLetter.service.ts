import api from '@/shared/api/api';

export interface LoanLetter {
  id: string;
  uniqueNumber: string;
  applicationNumber: string;
  studentEmail?: string | null;
  studentPhone?: string | null;
  studentName: string;
  relationPrefix: string;
  relationName: string;
  programId: string;
  programCode: string;
  programName: string;
  selectedSemesters: number[];
  transportIncluded: boolean;
  hostelIncluded: boolean;
  specializationId?: string | null;
  specialization?: {
    id: string;
    specializationCode: string;
    specializationName: string;
  } | null;
  issuedAt: string;
  createdAt: string;
  printedBy?: {
    id: string;
    uid: string;
    employeeDetails?: {
      firstName: string;
      lastName?: string;
      displayName?: string;
    };
  };
  reprintCount?: number;
  reprints?: Array<{
    id: string;
    printedAt: string;
    printedBy: {
      id: string | null;
      uid: string;
      name: string;
    };
  }>;
  lastReprintedAt?: string | null;
  lastReprintedBy?: {
    id: string | null;
    uid: string;
    name: string;
  } | null;
  program?: {
    id: string;
    programCode: string;
    programName: string;
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
  };
  feeBreakdown?: {
    academic: { headName: string; semesterAmounts: Record<number, number>; total: number }[];
    specialization: { headName: string; semesterAmounts: Record<number, number>; total: number }[];
    transport: { headName: string; amount: number; yearlyTotal?: number; years?: number; months?: number }[];
    hostel: { headName: string; amount: number; yearlyTotal?: number; years?: number; months?: number }[];
    grandTotal: number;
    selectedSemesters: number[];
    selectedYears?: number;
    selectedAccommodationMonths?: number;
  };
}

export interface CreateLoanLetterDto {
  applicationNumber: string;
  studentEmail?: string | null;
  studentPhone?: string | null;
  studentName: string;
  relationPrefix: string;
  relationName: string;
  programId: string;
  specializationId?: string | null;
  selectedSemesters: number[];
  transportIncluded: boolean;
  hostelIncluded: boolean;
}

class LoanLetterService {
  private baseUrl = '/finance/loan-letters';

  async create(data: CreateLoanLetterDto): Promise<{ success: boolean; message: string; data: LoanLetter }> {
    const response = await api.post<{ success: boolean; message: string; data: LoanLetter }>(this.baseUrl, data);
    return response.data;
  }

  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    ownOnly?: boolean;
    departmentId?: string;
    programId?: string;
  }): Promise<{ success: boolean; data: LoanLetter[]; total: number; page: number; limit: number }> {
    const response = await api.get<{ success: boolean; data: LoanLetter[]; total: number; page: number; limit: number }>(this.baseUrl, { params });
    return response.data;
  }

  async getById(id: string): Promise<{ success: boolean; data: LoanLetter }> {
    const response = await api.get<{ success: boolean; data: LoanLetter }>(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async recordReprint(id: string): Promise<{ success: boolean; message: string; data: LoanLetter }> {
    const response = await api.post<{ success: boolean; message: string; data: LoanLetter }>(`${this.baseUrl}/${id}/reprint`);
    return response.data;
  }
}

export const loanLetterService = new LoanLetterService();
