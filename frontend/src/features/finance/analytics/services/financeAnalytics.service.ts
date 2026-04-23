import api from '@/shared/api/api';

export interface ProgramBreakdownItem {
  programId: string;
  programCode: string;
  programName: string;
  schoolId: string | null;
  schoolName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  totalStructures: number;
  totalAmount: number;
  specializations: {
    id: string | null;
    code: string | null;
    name: string | null;
    amount: number;
    batchYear?: number;
    semesters: number[];
    heads: { headName: string; amount: number; semesterAmounts: Record<string, number> | null }[];
  }[];
}

export interface LoanLetterSummary {
  id: string;
  uniqueNumber: string;
  applicationNumber: string;
  studentName: string;
  relationPrefix?: string;
  relationName?: string;
  programCode?: string;
  programName?: string;
  selectedSemesters: number[];
  transportIncluded: boolean;
  hostelIncluded: boolean;
  specialization?: { specializationCode: string; specializationName: string } | null;
  issuedAt: string;
  printedBy?: { uid: string; name: string };
}

export interface ProgramLetterGroup {
  programId: string;
  programCode: string;
  programName: string;
  count: number;
}

export interface StaffLetterGroup {
  staffId: string | null;
  uid: string;
  name: string;
  count: number;
}

export interface LoanLetterDetailPage {
  success: boolean;
  data: LoanLetterSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LoanLetterRegistryItem {
  id: string;
  uniqueNumber: string;
  applicationNumber: string;
  studentName: string;
  studentEmail?: string | null;
  relationPrefix: string;
  relationName: string;
  programCode: string;
  programName: string;
  selectedSemesters: number[];
  transportIncluded: boolean;
  hostelIncluded: boolean;
  issuedAt: string;
  reprintCount: number;
  reprints: Array<{
    id: string;
    printedAt: string;
    printedBy: {
      id: string | null;
      uid: string;
      name: string;
    };
  }>;
  printedBy?: {
    id: string;
    uid: string;
    employeeDetails?: {
      firstName: string;
      lastName?: string;
      displayName?: string;
    };
  };
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
}

export interface FinanceAnalyticsData {
  feeStructures: {
    TRANSPORT: number;
    HOSTEL: number;
    ACADEMIC: number;
  };
  loanLetters: {
    total: number;
    thisMonth: number;
    thisYear: number;
  };
  programBreakdown: ProgramBreakdownItem[];
  loanLettersByProgram: ProgramLetterGroup[];
  loanLettersBySchool: { schoolId: string | null; schoolCode: string; schoolName: string; count: number }[];
  loanLettersByStaff: StaffLetterGroup[];
  loanLetterMonthlyTrend: { month: string; count: number }[];
}

export type FinanceAnalyticsSection =
  | 'summary'
  | 'programBreakdown'
  | 'loanLettersByProgram'
  | 'loanLettersBySchool'
  | 'loanLettersByStaff'
  | 'loanLetterMonthlyTrend';

class FinanceAnalyticsService {
  private baseUrl = '/finance/analytics';

  async getAnalytics(sections?: FinanceAnalyticsSection[]): Promise<{ success: boolean; data: Partial<FinanceAnalyticsData> }> {
    const params = sections && sections.length > 0
      ? { sections: sections.join(',') }
      : undefined;

    const response = await api.get<{ success: boolean; data: Partial<FinanceAnalyticsData> }>(this.baseUrl, { params });
    return response.data;
  }

  async getLoanLetterRegistry(params?: {
    page?: number;
    limit?: number;
    search?: string;
    departmentId?: string;
    programId?: string;
  }): Promise<{ success: boolean; data: LoanLetterRegistryItem[]; total: number; page: number; limit: number; totalPages: number }> {
    const response = await api.get<{ success: boolean; data: LoanLetterRegistryItem[]; total: number; page: number; limit: number; totalPages: number }>(`${this.baseUrl}/loan-letters`, { params });
    return response.data;
  }

  async getProgramLoanLetters(programId: string, params?: { page?: number; limit?: number }): Promise<LoanLetterDetailPage> {
    const response = await api.get<LoanLetterDetailPage>(`${this.baseUrl}/programs/${programId}/loan-letters`, { params });
    return response.data;
  }

  async getStaffLoanLetters(staffId: string | null, params?: { page?: number; limit?: number }): Promise<LoanLetterDetailPage> {
    const response = await api.get<LoanLetterDetailPage>(`${this.baseUrl}/staff/${staffId || 'unknown'}/loan-letters`, { params });
    return response.data;
  }
}

export const financeAnalyticsService = new FinanceAnalyticsService();
