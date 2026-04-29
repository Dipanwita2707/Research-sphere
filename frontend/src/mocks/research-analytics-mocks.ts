/**
 * Mock Data Generators for Research Analytics Components
 * 
 * Provides mock data for ProfileMetricsAnalytics, ComparativeAnalytics,
 * and PublicationOutputVisualization components.
 */

import type {
  ProfileMetricsData,
  DepartmentMetrics,
} from '@/features/research-profile/components/ProfileMetricsAnalytics';

import type {
  ComparativeMetrics,
  PercentileData,
} from '@/features/research-profile/components/ComparativeAnalytics';

import type {
  PublicationOutputData,
  YearlyOutput,
  PublicationTypeData,
} from '@/features/research-profile/components/PublicationOutputVisualization';

// ============================================================================
// Department Names
// ============================================================================

const DEPARTMENTS = [
  'Computer Science & Engineering',
  'Electronics & Communication Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Biotechnology',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Management Studies',
  'English Literature',
];

// ============================================================================
// Profile Metrics Analytics Mock Data
// ============================================================================

function generateDepartmentMetrics(): DepartmentMetrics[] {
  return DEPARTMENTS.map((dept, index) => ({
    departmentId: `dept-${index + 1}`,
    departmentName: dept,
    totalCitations: Math.floor(Math.random() * 5000) + 1000,
    avgHIndex: Math.floor(Math.random() * 20) + 5,
    totalPublications: Math.floor(Math.random() * 300) + 50,
    activeResearchers: Math.floor(Math.random() * 30) + 10,
    citationGrowth: (Math.random() * 40) - 10, // -10% to +30%
  })).sort((a, b) => b.totalCitations - a.totalCitations);
}

export function generateProfileMetricsData(): ProfileMetricsData {
  const departmentMetrics = generateDepartmentMetrics();
  
  const institutionTotals = {
    totalCitations: departmentMetrics.reduce((sum, d) => sum + d.totalCitations, 0),
    avgHIndex: departmentMetrics.reduce((sum, d) => sum + d.avgHIndex, 0) / departmentMetrics.length,
    totalPublications: departmentMetrics.reduce((sum, d) => sum + d.totalPublications, 0),
    totalResearchers: departmentMetrics.reduce((sum, d) => sum + d.activeResearchers, 0),
  };

  const topResearchers = [
    {
      name: 'Dr. Rajesh Kumar',
      department: 'Computer Science & Engineering',
      hIndex: 42,
      totalCitations: 3250,
    },
    {
      name: 'Dr. Priya Sharma',
      department: 'Biotechnology',
      hIndex: 38,
      totalCitations: 2890,
    },
    {
      name: 'Dr. Amit Patel',
      department: 'Electronics & Communication Engineering',
      hIndex: 35,
      totalCitations: 2650,
    },
    {
      name: 'Dr. Sunita Verma',
      department: 'Physics',
      hIndex: 33,
      totalCitations: 2420,
    },
    {
      name: 'Dr. Vikram Singh',
      department: 'Mechanical Engineering',
      hIndex: 31,
      totalCitations: 2180,
    },
  ];

  return {
    departmentMetrics,
    institutionTotals,
    topResearchers,
  };
}

// ============================================================================
// Comparative Analytics Mock Data
// ============================================================================

function generatePercentileData(): PercentileData[] {
  return [
    {
      metric: 'h-index',
      value: 28,
      percentile: 85,
      departmentAvg: 18,
      fieldAvg: 22,
    },
    {
      metric: 'Total Citations',
      value: 1850,
      percentile: 78,
      departmentAvg: 1200,
      fieldAvg: 1400,
    },
    {
      metric: 'Publications',
      value: 45,
      percentile: 82,
      departmentAvg: 32,
      fieldAvg: 38,
    },
    {
      metric: 'i10-index',
      value: 22,
      percentile: 88,
      departmentAvg: 14,
      fieldAvg: 16,
    },
    {
      metric: 'Citations per Paper',
      value: 41.1,
      percentile: 72,
      departmentAvg: 37.5,
      fieldAvg: 36.8,
    },
  ];
}

export function generateComparativeMetrics(
  researcherName: string = 'Dr. Rajesh Kumar',
  department: string = 'Computer Science & Engineering',
  field?: string
): ComparativeMetrics {
  return {
    researcherName,
    department,
    field: field || 'Computer Science',
    percentiles: generatePercentileData(),
    rank: {
      inDepartment: 3,
      totalInDepartment: 28,
      inField: 45,
      totalInField: 320,
    },
  };
}

// ============================================================================
// Publication Output Visualization Mock Data
// ============================================================================

function generateYearlyOutput(startYear: number, endYear: number): YearlyOutput[] {
  const output: YearlyOutput[] = [];
  
  for (let year = startYear; year <= endYear; year++) {
    // Simulate increasing publication trend with some variation
    const baseCount = Math.floor((year - startYear) * 0.8) + 2;
    const variation = Math.floor(Math.random() * 4) - 1;
    const count = Math.max(1, baseCount + variation);
    
    output.push({
      year,
      count,
      citations: count * (Math.floor(Math.random() * 30) + 10),
    });
  }
  
  return output;
}

function generateTypeDistribution(): PublicationTypeData[] {
  const types = [
    { type: 'Journal Articles', baseCount: 35 },
    { type: 'Conference Papers', baseCount: 28 },
    { type: 'Book Chapters', baseCount: 8 },
    { type: 'Patents', baseCount: 5 },
    { type: 'Technical Reports', baseCount: 4 },
  ];
  
  const distribution = types.map(t => ({
    type: t.type,
    count: t.baseCount + Math.floor(Math.random() * 10),
    percentage: 0, // Will be calculated below
  }));
  
  const total = distribution.reduce((sum, d) => sum + d.count, 0);
  distribution.forEach(d => {
    d.percentage = (d.count / total) * 100;
  });
  
  return distribution;
}

export function generatePublicationOutputData(
  startYear?: number,
  endYear?: number
): PublicationOutputData {
  const currentYear = new Date().getFullYear();
  const start = startYear || currentYear - 10;
  const end = endYear || currentYear;
  
  const yearlyOutput = generateYearlyOutput(start, end);
  const typeDistribution = generateTypeDistribution();
  
  return {
    yearlyOutput,
    typeDistribution,
    totalPublications: yearlyOutput.reduce((sum, y) => sum + y.count, 0),
    yearRange: {
      start,
      end,
    },
  };
}

// ============================================================================
// Combined Mock Data for Analytics Dashboard
// ============================================================================

export interface AnalyticsDashboardData {
  profileMetrics: ProfileMetricsData;
  comparativeMetrics: ComparativeMetrics;
  publicationOutput: PublicationOutputData;
}

export function generateAnalyticsDashboardData(
  researcherName?: string,
  department?: string,
  field?: string
): AnalyticsDashboardData {
  return {
    profileMetrics: generateProfileMetricsData(),
    comparativeMetrics: generateComparativeMetrics(researcherName, department, field),
    publicationOutput: generatePublicationOutputData(),
  };
}
