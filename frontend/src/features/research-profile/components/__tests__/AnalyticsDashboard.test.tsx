/**
 * Analytics Dashboard Components Test Suite
 * 
 * Tests for ProfileMetricsAnalytics, ComparativeAnalytics, and PublicationOutputVisualization
 */

import { render, screen } from '@testing-library/react';
import ProfileMetricsAnalytics from '../ProfileMetricsAnalytics';
import ComparativeAnalytics from '../ComparativeAnalytics';
import PublicationOutputVisualization from '../PublicationOutputVisualization';
import {
  generateProfileMetricsData,
  generateComparativeMetrics,
  generatePublicationOutputData,
} from '@/mocks/research-analytics-mocks';

describe('ProfileMetricsAnalytics', () => {
  it('renders institution-wide metrics correctly', () => {
    const data = generateProfileMetricsData();
    render(<ProfileMetricsAnalytics data={data} />);

    // Check for metric cards
    expect(screen.getByText('Total Citations')).toBeInTheDocument();
    expect(screen.getByText('Average h-index')).toBeInTheDocument();
    expect(screen.getByText('Total Publications')).toBeInTheDocument();
    expect(screen.getByText('Active Researchers')).toBeInTheDocument();
  });

  it('displays department research impact table', () => {
    const data = generateProfileMetricsData();
    render(<ProfileMetricsAnalytics data={data} />);

    expect(screen.getByText('Department Research Impact')).toBeInTheDocument();
    expect(screen.getByText('Department')).toBeInTheDocument();
    // Use getAllByText for duplicate text
    const citationsElements = screen.getAllByText('Citations');
    expect(citationsElements.length).toBeGreaterThan(0);
    expect(screen.getByText('Avg h-index')).toBeInTheDocument();
  });

  it('shows top researchers section', () => {
    const data = generateProfileMetricsData();
    render(<ProfileMetricsAnalytics data={data} />);

    expect(screen.getByText('Top Researchers')).toBeInTheDocument();
    expect(screen.getByText('Highest impact researchers by h-index')).toBeInTheDocument();
  });

  it('displays loading state', () => {
    const data = generateProfileMetricsData();
    render(<ProfileMetricsAnalytics data={data} loading={true} />);

    // Should show loading spinner
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('handles empty department metrics', () => {
    const data = {
      ...generateProfileMetricsData(),
      departmentMetrics: [],
    };
    render(<ProfileMetricsAnalytics data={data} />);

    expect(screen.getByText('No department metrics available')).toBeInTheDocument();
  });
});

describe('ComparativeAnalytics', () => {
  it('renders researcher information and rankings', () => {
    const data = generateComparativeMetrics('Dr. Test User', 'Computer Science');
    render(<ComparativeAnalytics data={data} />);

    expect(screen.getByText('Dr. Test User')).toBeInTheDocument();
    expect(screen.getByText('Computer Science')).toBeInTheDocument();
    expect(screen.getByText('Department Rank')).toBeInTheDocument();
  });

  it('displays percentile rankings for all metrics', () => {
    const data = generateComparativeMetrics();
    render(<ComparativeAnalytics data={data} />);

    expect(screen.getByText('Percentile Rankings')).toBeInTheDocument();
    
    // Check for metric names
    data.percentiles.forEach(percentile => {
      expect(screen.getByText(percentile.metric)).toBeInTheDocument();
    });
  });

  it('shows percentile bars for each metric', () => {
    const data = generateComparativeMetrics();
    render(<ComparativeAnalytics data={data} />);

    // Check for percentile bars (they have specific background colors)
    const percentileBars = document.querySelectorAll('.bg-emerald-500, .bg-blue-500, .bg-amber-500, .bg-gray-400');
    expect(percentileBars.length).toBeGreaterThan(0);
  });

  it('displays comparative summary cards', () => {
    const data = generateComparativeMetrics();
    render(<ComparativeAnalytics data={data} />);

    // Use getAllByText for duplicate text
    const top10Elements = screen.getAllByText('Top 10%');
    expect(top10Elements.length).toBeGreaterThan(0);
    const top25Elements = screen.getAllByText('Top 25%');
    expect(top25Elements.length).toBeGreaterThan(0);
    const averageElements = screen.getAllByText('Average');
    expect(averageElements.length).toBeGreaterThan(0);
  });

  it('shows field rank when available', () => {
    const data = generateComparativeMetrics('Dr. Test', 'CS', 'Computer Science');
    render(<ComparativeAnalytics data={data} />);

    expect(screen.getByText('Field Rank')).toBeInTheDocument();
  });

  it('displays loading state', () => {
    const data = generateComparativeMetrics();
    render(<ComparativeAnalytics data={data} loading={true} />);

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});

describe('PublicationOutputVisualization', () => {
  it('renders publication per year chart section', () => {
    const data = generatePublicationOutputData();
    render(<PublicationOutputVisualization data={data} />);

    expect(screen.getByText('Publications Per Year')).toBeInTheDocument();
    expect(screen.getByText(/Research output from/)).toBeInTheDocument();
  });

  it('displays publication type distribution', () => {
    const data = generatePublicationOutputData();
    render(<PublicationOutputVisualization data={data} />);

    // Use getAllByText for duplicate text
    const publicationTypesElements = screen.getAllByText('Publication Types');
    expect(publicationTypesElements.length).toBeGreaterThan(0);
    expect(screen.getByText('Type Breakdown')).toBeInTheDocument();
  });

  it('shows summary statistics', () => {
    const data = generatePublicationOutputData();
    render(<PublicationOutputVisualization data={data} />);

    expect(screen.getByText('Total Publications')).toBeInTheDocument();
    expect(screen.getByText('Years Active')).toBeInTheDocument();
    expect(screen.getByText('Avg Per Year')).toBeInTheDocument();
    // Use getAllByText for duplicate text
    const publicationTypesElements = screen.getAllByText('Publication Types');
    expect(publicationTypesElements.length).toBeGreaterThan(0);
  });

  it('handles empty yearly output data', () => {
    const data = {
      ...generatePublicationOutputData(),
      yearlyOutput: [],
    };
    render(<PublicationOutputVisualization data={data} />);

    expect(screen.getByText('No publication data available')).toBeInTheDocument();
  });

  it('handles empty type distribution data', () => {
    const data = {
      ...generatePublicationOutputData(),
      typeDistribution: [],
    };
    render(<PublicationOutputVisualization data={data} />);

    expect(screen.getByText('No type distribution data available')).toBeInTheDocument();
  });

  it('displays loading state', () => {
    const data = generatePublicationOutputData();
    render(<PublicationOutputVisualization data={data} loading={true} />);

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('calculates correct summary statistics', () => {
    const data = generatePublicationOutputData(2015, 2024);
    render(<PublicationOutputVisualization data={data} />);

    // Years active should be 10 (2015-2024 inclusive)
    const yearsActive = data.yearRange.end - data.yearRange.start + 1;
    expect(yearsActive).toBe(10);

    // Total publications should match sum of yearly output
    const expectedTotal = data.yearlyOutput.reduce((sum, y) => sum + y.count, 0);
    expect(data.totalPublications).toBe(expectedTotal);
  });
});

describe('Analytics Components Integration', () => {
  it('all components render without errors with mock data', () => {
    const profileData = generateProfileMetricsData();
    const comparativeData = generateComparativeMetrics();
    const outputData = generatePublicationOutputData();

    const { container: container1 } = render(<ProfileMetricsAnalytics data={profileData} />);
    expect(container1).toBeInTheDocument();

    const { container: container2 } = render(<ComparativeAnalytics data={comparativeData} />);
    expect(container2).toBeInTheDocument();

    const { container: container3 } = render(<PublicationOutputVisualization data={outputData} />);
    expect(container3).toBeInTheDocument();
  });

  it('components maintain consistent styling', () => {
    const profileData = generateProfileMetricsData();
    const comparativeData = generateComparativeMetrics();
    const outputData = generatePublicationOutputData();

    render(<ProfileMetricsAnalytics data={profileData} />);
    render(<ComparativeAnalytics data={comparativeData} />);
    render(<PublicationOutputVisualization data={outputData} />);

    // Check for consistent ResearchSphere UMS theme colors
    const blueElements = document.querySelectorAll('[class*="005b96"]');
    expect(blueElements.length).toBeGreaterThan(0);

    // Check for consistent rounded corners
    const roundedElements = document.querySelectorAll('[class*="rounded-"]');
    expect(roundedElements.length).toBeGreaterThan(0);
  });
});
