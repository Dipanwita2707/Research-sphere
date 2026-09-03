/**
 * Tests for PublicationList Component
 * Task 2.3: Create publication list component with bibliographic formatting
 * 
 * Requirements:
 * - Display publications with title, authors, venue, year, citations
 * - Add sorting and filtering controls
 * - Format bibliographic data like Google Scholar
 * 
 * Validates: Requirements 1.3, 8.7
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import PublicationList from '../PublicationList';
import type { Publication } from '@/shared/types/research-profile.types';

// Mock data factory
const createMockPublication = (overrides?: Partial<Publication>): Publication => ({
  id: `pub-${Math.random()}`,
  profileId: 'profile-1',
  researchContributionId: null,
  title: 'Sample Research Paper',
  authors: [
    { name: 'John Doe', affiliation: 'ResearchSphere', email: null, isCorresponding: true, authorOrder: 1 },
    { name: 'Jane Smith', affiliation: 'MIT', email: null, isCorresponding: false, authorOrder: 2 },
  ],
  venue: 'Journal of Computer Science',
  publicationType: 'journal',
  year: 2023,
  volume: '10',
  issue: '2',
  pages: '123-145',
  doi: '10.1234/jcs.2023.001',
  isbn: null,
  issn: null,
  arxivId: null,
  pubmedId: null,
  citationCount: 15,
  citationsPerYear: { 2023: 10, 2024: 5 },
  source: 'google_scholar',
  externalId: 'scholar-123',
  pdfUrl: null,
  publicationUrl: 'https://example.com/paper',
  abstract: null,
  keywords: ['machine learning', 'AI'],
  isVerified: true,
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  ...overrides,
});

describe('PublicationList Component', () => {
  describe('Empty State', () => {
    it('should display empty state when no publications', () => {
      render(<PublicationList publications={[]} />);
      
      expect(screen.getByText('No publications yet')).toBeInTheDocument();
      expect(screen.getByText('Publications will appear here once added to the profile.')).toBeInTheDocument();
    });
  });

  describe('Bibliographic Display - Requirements 1.3, 8.7', () => {
    it('should display all required bibliographic fields', () => {
      const publication = createMockPublication({
        title: 'Machine Learning in Healthcare',
        authors: [
          { name: 'Dr. Smith', affiliation: 'ResearchSphere', email: null, isCorresponding: true, authorOrder: 1 },
          { name: 'Dr. Jones', affiliation: 'MIT', email: null, isCorresponding: false, authorOrder: 2 },
        ],
        venue: 'Nature Medicine',
        year: 2024,
        citationCount: 42,
      });

      render(<PublicationList publications={[publication]} />);

      // Title
      expect(screen.getByText('Machine Learning in Healthcare')).toBeInTheDocument();
      
      // Authors
      expect(screen.getByText(/Dr. Smith, Dr. Jones/)).toBeInTheDocument();
      
      // Venue
      expect(screen.getByText('Nature Medicine')).toBeInTheDocument();
      
      // Year (use getAllByText since year appears in filter dropdown too)
      const yearElements = screen.getAllByText('2024');
      expect(yearElements.length).toBeGreaterThan(0);
      
      // Citation count
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('citations')).toBeInTheDocument();
    });

    it('should display volume, issue, and pages when available', () => {
      const publication = createMockPublication({
        volume: '15',
        issue: '3',
        pages: '200-215',
      });

      render(<PublicationList publications={[publication]} />);

      expect(screen.getByText('Vol. 15')).toBeInTheDocument();
      expect(screen.getByText('Issue 3')).toBeInTheDocument();
      expect(screen.getByText('pp. 200-215')).toBeInTheDocument();
    });

    it('should display DOI link when available', () => {
      const publication = createMockPublication({
        doi: '10.1234/test.2024.001',
      });

      render(<PublicationList publications={[publication]} />);

      const doiLink = screen.getByText(/DOI: 10.1234\/test.2024.001/);
      expect(doiLink).toBeInTheDocument();
      expect(doiLink.closest('a')).toHaveAttribute('href', 'https://doi.org/10.1234/test.2024.001');
    });

    it('should display publication type badge', () => {
      const publication = createMockPublication({
        publicationType: 'conference',
      });

      render(<PublicationList publications={[publication]} />);

      expect(screen.getByText('conference')).toBeInTheDocument();
    });

    it('should display verification badge when verified', () => {
      const publication = createMockPublication({
        isVerified: true,
      });

      render(<PublicationList publications={[publication]} />);

      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('should display keywords when available', () => {
      const publication = createMockPublication({
        keywords: ['neural networks', 'deep learning', 'computer vision'],
      });

      render(<PublicationList publications={[publication]} />);

      expect(screen.getByText('neural networks')).toBeInTheDocument();
      expect(screen.getByText('deep learning')).toBeInTheDocument();
      expect(screen.getByText('computer vision')).toBeInTheDocument();
    });

    it('should truncate author list with "et al." for more than 3 authors', () => {
      const publication = createMockPublication({
        authors: [
          { name: 'Author 1', affiliation: null, email: null, isCorresponding: false, authorOrder: 1 },
          { name: 'Author 2', affiliation: null, email: null, isCorresponding: false, authorOrder: 2 },
          { name: 'Author 3', affiliation: null, email: null, isCorresponding: false, authorOrder: 3 },
          { name: 'Author 4', affiliation: null, email: null, isCorresponding: false, authorOrder: 4 },
        ],
      });

      render(<PublicationList publications={[publication]} />);

      expect(screen.getByText(/Author 1, Author 2, Author 3, et al\./)).toBeInTheDocument();
    });

    it('should make title clickable when publication URL is available', () => {
      const publication = createMockPublication({
        title: 'Clickable Paper',
        publicationUrl: 'https://example.com/paper',
      });

      render(<PublicationList publications={[publication]} />);

      const titleLink = screen.getByText('Clickable Paper').closest('a');
      expect(titleLink).toHaveAttribute('href', 'https://example.com/paper');
      expect(titleLink).toHaveAttribute('target', '_blank');
      expect(titleLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Sorting Controls - Requirements 1.3', () => {
    const publications = [
      createMockPublication({ id: 'pub-1', title: 'Paper A', year: 2022, citationCount: 10 }),
      createMockPublication({ id: 'pub-2', title: 'Paper B', year: 2024, citationCount: 5 }),
      createMockPublication({ id: 'pub-3', title: 'Paper C', year: 2023, citationCount: 20 }),
    ];

    it('should display sorting controls', () => {
      render(<PublicationList publications={publications} />);

      expect(screen.getByText('Sort by:')).toBeInTheDocument();
      const sortSelect = screen.getByDisplayValue('Year (newest first)');
      expect(sortSelect).toBeInTheDocument();
    });

    it('should sort by year (newest first) by default', () => {
      render(<PublicationList publications={publications} />);

      const titles = screen.getAllByRole('heading', { level: 4 }).map(h => h.textContent);
      expect(titles[0]).toContain('Paper B'); // 2024
      expect(titles[1]).toContain('Paper C'); // 2023
      expect(titles[2]).toContain('Paper A'); // 2022
    });

    it('should sort by citations when selected', () => {
      render(<PublicationList publications={publications} />);

      const sortSelect = screen.getByDisplayValue('Year (newest first)');
      fireEvent.change(sortSelect, { target: { value: 'citations' } });

      const titles = screen.getAllByRole('heading', { level: 4 }).map(h => h.textContent);
      expect(titles[0]).toContain('Paper C'); // 20 citations
      expect(titles[1]).toContain('Paper A'); // 10 citations
      expect(titles[2]).toContain('Paper B'); // 5 citations
    });
  });

  describe('Filtering Controls - Requirements 1.3', () => {
    const publications = [
      createMockPublication({ id: 'pub-1', title: 'Paper 2022', year: 2022 }),
      createMockPublication({ id: 'pub-2', title: 'Paper 2023', year: 2023 }),
      createMockPublication({ id: 'pub-3', title: 'Paper 2024', year: 2024 }),
    ];

    it('should display year filter controls', () => {
      render(<PublicationList publications={publications} />);

      expect(screen.getByText('Year:')).toBeInTheDocument();
      const yearSelect = screen.getByDisplayValue('All years');
      expect(yearSelect).toBeInTheDocument();
    });

    it('should show all publications by default', () => {
      render(<PublicationList publications={publications} />);

      expect(screen.getByText('3 publications')).toBeInTheDocument();
      expect(screen.getByText('Paper 2022')).toBeInTheDocument();
      expect(screen.getByText('Paper 2023')).toBeInTheDocument();
      expect(screen.getByText('Paper 2024')).toBeInTheDocument();
    });

    it('should filter publications by selected year', () => {
      render(<PublicationList publications={publications} />);

      const yearSelect = screen.getByDisplayValue('All years');
      fireEvent.change(yearSelect, { target: { value: '2023' } });

      expect(screen.getByText('1 publication')).toBeInTheDocument();
      expect(screen.getByText('Paper 2023')).toBeInTheDocument();
      expect(screen.queryByText('Paper 2022')).not.toBeInTheDocument();
      expect(screen.queryByText('Paper 2024')).not.toBeInTheDocument();
    });

    it('should populate year filter with unique years from publications', () => {
      render(<PublicationList publications={publications} />);

      const yearSelect = screen.getByDisplayValue('All years');
      const options = within(yearSelect as HTMLSelectElement).getAllByRole('option');
      
      // Should have "All years" + 3 unique years
      expect(options).toHaveLength(4);
      expect(options[0]).toHaveTextContent('All years');
      expect(options[1]).toHaveTextContent('2024'); // Sorted descending
      expect(options[2]).toHaveTextContent('2023');
      expect(options[3]).toHaveTextContent('2022');
    });
  });

  describe('Result Count Display - Requirements 8.7', () => {
    it('should display correct count for single publication', () => {
      const publications = [createMockPublication()];
      render(<PublicationList publications={publications} />);

      expect(screen.getByText('1 publication')).toBeInTheDocument();
    });

    it('should display correct count for multiple publications', () => {
      const publications = [
        createMockPublication({ id: 'pub-1' }),
        createMockPublication({ id: 'pub-2' }),
        createMockPublication({ id: 'pub-3' }),
      ];
      render(<PublicationList publications={publications} />);

      expect(screen.getByText('3 publications')).toBeInTheDocument();
    });

    it('should update count when filtering', () => {
      const publications = [
        createMockPublication({ id: 'pub-1', year: 2022 }),
        createMockPublication({ id: 'pub-2', year: 2023 }),
        createMockPublication({ id: 'pub-3', year: 2023 }),
      ];
      render(<PublicationList publications={publications} />);

      expect(screen.getByText('3 publications')).toBeInTheDocument();

      const yearSelect = screen.getByDisplayValue('All years');
      fireEvent.change(yearSelect, { target: { value: '2023' } });

      expect(screen.getByText('2 publications')).toBeInTheDocument();
    });
  });

  describe('Google Scholar-Style Formatting - Requirements 1.3, 8.7', () => {
    it('should use appropriate styling classes for academic appearance', () => {
      const publication = createMockPublication();
      const { container } = render(<PublicationList publications={[publication]} />);

      // Check for hover effects on publication items
      const publicationItem = container.querySelector('.hover\\:bg-gray-50');
      expect(publicationItem).toBeInTheDocument();

      // Check for proper text sizing on title's parent h4
      const titleHeading = screen.getByText(publication.title).closest('h4');
      expect(titleHeading).toHaveClass('text-base', 'font-medium');
    });

    it('should display citation icon with count', () => {
      const publication = createMockPublication({ citationCount: 25 });
      render(<PublicationList publications={[publication]} />);

      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText('citations')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible form controls', () => {
      const publications = [createMockPublication()];
      render(<PublicationList publications={publications} />);

      const sortLabel = screen.getByText('Sort by:');
      const yearLabel = screen.getByText('Year:');
      
      expect(sortLabel).toBeInTheDocument();
      expect(yearLabel).toBeInTheDocument();
    });

    it('should have accessible external links', () => {
      const publication = createMockPublication({
        publicationUrl: 'https://example.com/paper',
        doi: '10.1234/test',
      });
      render(<PublicationList publications={[publication]} />);

      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        if (link.getAttribute('target') === '_blank') {
          expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        }
      });
    });
  });
});
