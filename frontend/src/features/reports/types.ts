/** Shapes returned by GET /reports/summary (backend/src/modules/reports). */

export interface Ratio {
  known: number;
  total: number;
  /** null when there is nothing to measure (total = 0). */
  percent: number | null;
}

export interface YearTotal {
  year: number;
  count: number;
  teachers: number;
  perTeacher: number | null;
}

export interface NaacSummary {
  fromYear: number;
  toYear: number;
  paperBasis: PaperYearBasis;
  teachers: { total: number; active: number; perYear: Array<{ year: number; teachers: number }> };
  grants: {
    count: number;
    totalSanctioned: number;
    receivedTotal: number;
    fundingRows: number;
    fundingFallbackRows: number;
    excludedProposals: number;
  };
  papers: { count: number; ugcCareListed: number; perYear: YearTotal[]; withoutTeacher: number };
  booksChapters: { count: number; books: number; chapters: number; proceedings: number; perYear: YearTotal[] };
  undatedPublications: number;
  completeness: {
    ugcCareKnown: Ratio;
    paperIssn: Ratio;
    paperLink: Ratio;
    grantSanctionedAmount: Ratio;
    grantSanctionDate: Ratio;
    fundingFromReceipts: Ratio;
  };
}

export interface NirfSummary {
  financialYears: string[];
  publications: {
    total: number;
    perYear: Array<{ year: number; total: number; scopus: number; wos: number; pubmed: number; others: number; citations: number; withCitations: number }>;
  };
  citations: { total: number; papersWithData: number };
  patents: {
    filed: number;
    published: number;
    granted: number;
    perYear: Array<{ year: number; filed: number; published: number; granted: number }>;
    records: number;
    grantedRecords: number;
    filedWithoutDate: number;
    publishedWithoutDate: number;
  };
  sponsoredResearch: {
    projects: number;
    amountReceived: number;
    fallbackAmount: number;
    perYear: Array<{ year: number; projects: number; agencies: number; amount: number; fallbackAmount: number; fallbackProjects: number }>;
  };
  phd: {
    records: number;
    enrolledLatest: number;
    graduated: number;
    perYear: Array<{ year: number; enrolled: number; graduated: number }>;
    withoutRegistrationDate: number;
    inactiveWithoutAward: number;
  };
  completeness: {
    citationCoverage: Ratio;
    fundingFromReceipts: Ratio;
    patentFilingDate: Ratio;
    phdRegistrationDate: Ratio;
  };
}

export interface ReportSummary {
  university: { name: string; code: string };
  generatedAt: string;
  naac: NaacSummary;
  nirf: NirfSummary;
}

export type PaperYearBasis = 'calendar' | 'academic';

export interface NaacParams {
  fromYear: number;
  toYear: number;
  paperYearBasis: PaperYearBasis;
}

export interface ReportParams extends NaacParams {
  /** Financial years like "2024-25". */
  financialYears: string[];
}

/** Download progress: null total when the server sent no length. */
export interface DownloadProgress {
  loaded: number;
  total: number | null;
}
