import api from '@/shared/api/api';

export interface LoanLetterBankDetails {
  accountName: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  ifscCode: string;
  micrCode: string;
}

export interface LoanLetterTemplate {
  id: string;
  universityName: string;
  universityShort: string;
  universityAddr: string;
  universityLegal: string;
  branchTitle: string;
  refPrefix: string;
  headerImageUrl: string | null;
  headerImageWidth: number;
  watermarkImageUrl: string | null;
  watermarkOpacity: number;
  watermarkWidth: number;
  templateBody: string | null;
  footerNotes: string[];
  bankDetails: LoanLetterBankDetails;
  signatoryTitle: string;
  signatoryDept: string;
  signatoryOrg: string;
  updatedAt?: string;
}

export interface TemplateAuditEntry {
  id: string;
  version: number;
  changedAt: string;
  changedByName: string | null;
  changedByUid: string | null;
  changes: Record<string, { label: string; from: string; to: string }>;
}

export interface TemplateAuditLog {
  rows: TemplateAuditEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type LoanLetterTemplateUpdate = Partial<Omit<LoanLetterTemplate, 'id' | 'updatedAt'>>;

const BASE = '/finance/loan-letters/template';

class LoanLetterTemplateService {
  async get(): Promise<{ success: boolean; data: LoanLetterTemplate }> {
    const res = await api.get<{ success: boolean; data: LoanLetterTemplate }>(BASE);
    return res.data;
  }

  async update(data: LoanLetterTemplateUpdate): Promise<{ success: boolean; message: string; data: LoanLetterTemplate }> {
    const res = await api.put<{ success: boolean; message: string; data: LoanLetterTemplate }>(BASE, data);
    return res.data;
  }

  async uploadHeaderImage(file: File): Promise<{ success: boolean; message: string; data: { url: string } }> {
    const form = new FormData();
    form.append('headerImage', file);
    const res = await api.post<{ success: boolean; message: string; data: { url: string } }>(
      `${BASE}/header-image`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data;
  }

  async uploadWatermarkImage(file: File): Promise<{ success: boolean; message: string; data: { url: string } }> {
    const form = new FormData();
    form.append('watermarkImage', file);
    const res = await api.post<{ success: boolean; message: string; data: { url: string } }>(
      `${BASE}/watermark-image`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data;
  }

  async getAuditLog(page = 1, limit = 20): Promise<{ success: boolean; data: TemplateAuditLog }> {
    const res = await api.get<{ success: boolean; data: TemplateAuditLog }>(`${BASE}/audit`, { params: { page, limit } });
    return res.data;
  }
}

export const loanLetterTemplateService = new LoanLetterTemplateService();

export const TEMPLATE_DEFAULTS: LoanLetterTemplate = {
  id: 'default',
  universityName: 'SHREE GURU GOBIND SINGH TRICENTENARY UNIVERSITY (SGT UNIVERSITY \u00ae)',
  universityShort: 'SGT University \u00ae',
  universityAddr: 'Gurugram, Haryana',
  universityLegal: '(Established by State Legislature Act 2013 & Recognized by UGC)',
  branchTitle: 'Accounts Branch',
  refPrefix: 'SGTU/Bank Loan',
  headerImageUrl: null,
  headerImageWidth: 100,
  watermarkImageUrl: null,
  watermarkOpacity: 20,
  watermarkWidth: 30,
  templateBody: null,
  footerNotes: [
    'Fee for Transport/Hostel/Mess/Medical is not included in the above, but will be a part of the bank loan and the same will be intimated to the bank from time to time.',
  ],
  bankDetails: {
    accountName: 'SGT University',
    bankName: '',
    branchName: '',
    accountNumber: '',
    ifscCode: '',
    micrCode: '',
  },
  signatoryTitle: 'Authorized Signatory',
  signatoryDept: '(Finance Department)',
  signatoryOrg: 'SGT University, Gurugram',
};
