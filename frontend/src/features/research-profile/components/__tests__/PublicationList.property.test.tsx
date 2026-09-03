/**
 * Property-Based Tests for PublicationList Component
 * Task 2.4: Write property test for publication display
 * 
 * Property 2: Publication Display Completeness
 * For any publication in a researcher's profile, the rendered publication list 
 * SHALL include all required bibliographic fields: title, authors, venue, year, 
 * and citation count.
 * 
 * **Validates: Requirements 1.3**
 */

import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import * as fc from 'fast-check';
import PublicationList from '../PublicationList';
import type { Publication, PublicationAuthor } from '@/shared/types/research-profile.types';

// Clean up after each test
afterEach(() => {
  cleanup();
});

// ============================================================================
// Fast-Check Arbitraries (Data Generators)
// ============================================================================

/**
 * Generates a valid publication author with realistic names
 */
const authorArbitrary = (): fc.Arbitrary<PublicationAuthor> =>
  fc.record({
    name: fc.constantFrom(
      'John Doe',
      'Jane Smith',
      'Dr. Robert Johnson',
      'Prof. Maria Garcia',
      'Alice Williams',
      'Bob Chen',
      'Carol Martinez',
      'David Lee'
    ),
    affiliation: fc.oneof(
      fc.constant(null),
      fc.constantFrom('ResearchSphere', 'MIT', 'Stanford', 'Harvard')
    ),
    email: fc.oneof(fc.constant(null), fc.emailAddress()),
    isCorresponding: fc.boolean(),
    authorOrder: fc.integer({ min: 1, max: 10 }),
  });

/**
 * Generates a valid publication with all required bibliographic fields
 */
const publicationArbitrary = (): fc.Arbitrary<Publication> =>
  fc.record({
    id: fc.uuid(),
    profileId: fc.uuid(),
    researchContributionId: fc.oneof(fc.constant(null), fc.uuid()),
    
    // Required bibliographic fields
    title: fc.constantFrom(
      'Machine Learning in Healthcare',
      'Deep Neural Networks for Image Recognition',
      'Quantum Computing Applications',
      'Blockchain Technology and Security',
      'Natural Language Processing Advances'
    ),
    authors: fc.array(authorArbitrary(), { minLength: 1, maxLength: 5 }),
    venue: fc.constantFrom(
      'Nature',
      'Science',
      'IEEE Transactions',
      'ACM Computing Surveys',
      'Journal of Computer Science'
    ),
    year: fc.integer({ min: 2000, max: 2024 }),
    citationCount: fc.integer({ min: 0, max: 500 }),
    
    // Optional fields
    publicationType: fc.constantFrom('journal', 'conference', 'book_chapter'),
    volume: fc.oneof(fc.constant(null), fc.constantFrom('10', '15', '20')),
    issue: fc.oneof(fc.constant(null), fc.constantFrom('1', '2', '3')),
    pages: fc.oneof(fc.constant(null), fc.constantFrom('1-10', '100-120')),
    doi: fc.oneof(fc.constant(null), fc.constant('10.1234/example.2024.001')),
    isbn: fc.constant(null),
    issn: fc.constant(null),
    arxivId: fc.constant(null),
    pubmedId: fc.constant(null),
    citationsPerYear: fc.constant({}),
    source: fc.constantFrom('google_scholar', 'scopus', 'manual'),
    externalId: fc.oneof(fc.constant(null), fc.uuid()),
    pdfUrl: fc.oneof(fc.constant(null), fc.webUrl()),
    publicationUrl: fc.oneof(fc.constant(null), fc.webUrl()),
    abstract: fc.constant(null),
    keywords: fc.array(fc.constantFrom('AI', 'ML', 'Deep Learning'), { maxLength: 3 }),
    isVerified: fc.boolean(),
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
  });

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('Feature: research-profile-system, Property 2: Publication Display Completeness', () => {
  /**
   * Property 2: Publication Display Completeness
   * 
   * For ANY publication in a researcher's profile, the rendered publication list
   * SHALL include ALL required bibliographic fields:
   * - title
   * - authors
   * - venue
   * - year
   * - citation count
   */
  it('should display all required bibliographic fields for any valid publication', () => {
    fc.assert(
      fc.property(
        publicationArbitrary(),
        (publication) => {
          // Render the component with the generated publication
          render(<PublicationList publications={[publication]} />);

          try {
            // PROPERTY ASSERTION 1: Title must be displayed
            expect(screen.getByText(publication.title)).toBeInTheDocument();

            // PROPERTY ASSERTION 2: Authors must be displayed
            const authorNames = publication.authors.map(a => a.name);
            const expectedAuthorText = publication.authors.length <= 3
              ? authorNames.join(', ')
              : authorNames.slice(0, 3).join(', ') + ', et al.';
            expect(screen.getByText(expectedAuthorText)).toBeInTheDocument();

            // PROPERTY ASSERTION 3: Venue must be displayed
            expect(screen.getByText(publication.venue)).toBeInTheDocument();

            // PROPERTY ASSERTION 4: Year must be displayed
            const yearElements = screen.getAllByText(publication.year.toString());
            expect(yearElements.length).toBeGreaterThan(0);

            // PROPERTY ASSERTION 5: Citation count must be displayed
            expect(screen.getByText(publication.citationCount.toString())).toBeInTheDocument();
            
            const citationLabel = publication.citationCount === 1 ? 'citation' : 'citations';
            expect(screen.getByText(citationLabel)).toBeInTheDocument();
          } finally {
            cleanup();
          }
        }
      ),
      { 
        numRuns: 100,
        verbose: false,
      }
    );
  });
});
