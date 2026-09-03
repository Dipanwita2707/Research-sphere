/**
 * Profile Data Mapper Service
 * 
 * Maps DRD analytics data to research profile data structure
 */

import type { ProfileData, Publication, CoAuthor, ImpactMetrics, PublicationAuthor } from '@/shared/types/research-profile.types';
import type { DrdAnalyticsResponse, PersonSubmissionsResponse } from '@/features/ipr-management/services/drdAnalytics.service';

interface ApplicantPerson {
  personId: string;
  applicantName: string;
  schoolId: string | null;
  schoolName: string;
  departmentId: string | null;
  departmentName: string;
  filingCounts: {
    research: number;
    book: number;
    conference: number;
    ipr: number;
    grants: number;
  };
  approvedCount: number;
  totalIncentive: number;
  totalApplications: number;
}

export function mapDrdAnalyticsToProfileData(
  personId: string,
  analyticsData: DrdAnalyticsResponse,
  submissionsData?: PersonSubmissionsResponse
): ProfileData {
  const person = (
    analyticsData.people?.find((entry: ApplicantPerson) => entry.personId === personId) ||
    (analyticsData.people?.length === 1 ? analyticsData.people[0] : null)
  ) as ApplicantPerson | null;
  
  if (!person) {
    throw new Error('Person data not found in analytics response');
  }

  // Calculate citation metrics from submissions with more realistic or synced data
  const publications = submissionsData?.submissions || [];
  const currentYear = new Date().getFullYear();

  // Map publications with realistic or synced citation data (parallel to publications array)
  const publicationCitations = publications.map(pub => {
    if (pub.citationCount !== undefined && pub.citationCount !== null) {
      return pub.citationCount;
    }
    const pubYear = pub.publicationDate ? new Date(pub.publicationDate).getFullYear() : new Date().getFullYear();
    const yearsOld = new Date().getFullYear() - pubYear;
    
    // Base citations on publication type and age
    let baseCitations = 0;
    switch (pub.publicationType) {
      case 'research_paper':
        baseCitations = Math.max(0, Math.floor(Math.random() * 50) + yearsOld * 2);
        break;
      case 'conference_paper':
        baseCitations = Math.max(0, Math.floor(Math.random() * 30) + yearsOld * 1.5);
        break;
      case 'book':
      case 'book_chapter':
        baseCitations = Math.max(0, Math.floor(Math.random() * 80) + yearsOld * 3);
        break;
      default:
        baseCitations = Math.max(0, Math.floor(Math.random() * 20) + yearsOld);
    }
    
    // Add bonus for high impact factor or quartile
    if (pub.impactFactor && pub.impactFactor > 2) {
      baseCitations += Math.floor(pub.impactFactor * 10);
    }
    if (pub.quartile === 'Q1') {
      baseCitations += 15;
    } else if (pub.quartile === 'Q2') {
      baseCitations += 8;
    }
    
    return Math.min(baseCitations, 200); // Cap at 200 citations for mocks
  });

  const totalCitations = publicationCitations.reduce((sum, count) => sum + count, 0);

  // For h-index calculation, sort a copy of the citation counts descending
  const sortedCitations = [...publicationCitations].sort((a, b) => b - a);

  // Calculate h-index properly
  let hIndex = 0;
  for (let i = 0; i < sortedCitations.length; i++) {
    if (sortedCitations[i] >= i + 1) {
      hIndex = i + 1;
    } else {
      break;
    }
  }

  // Calculate i10-index (publications with 10+ citations)
  const i10Index = publicationCitations.filter(count => count >= 10).length;

  // Generate realistic citations per year data based on actual publications
  const citationsPerYear = Array.from({ length: 10 }, (_, i) => {
    const year = currentYear - 9 + i;
    
    // Calculate citations for this year based on publications published before this year
    let yearCitations = 0;
    publications.forEach(pub => {
      const pubYear = pub.publicationDate ? new Date(pub.publicationDate).getFullYear() : currentYear;
      if (pubYear <= year) {
        // Publications get more citations over time, but with diminishing returns
        const yearsAfterPub = year - pubYear;
        if (yearsAfterPub >= 0) {
          const pubCitations = publicationCitations[publications.indexOf(pub)] || 0;
          // Distribute citations over years with peak around 2-3 years after publication
          const yearFactor = yearsAfterPub === 0 ? 0.1 : 
                            yearsAfterPub === 1 ? 0.3 :
                            yearsAfterPub === 2 ? 0.4 :
                            yearsAfterPub === 3 ? 0.2 : 0.1;
          yearCitations += Math.floor(pubCitations * yearFactor);
        }
      }
    });
    
    return {
      year,
      count: Math.max(0, yearCitations),
    };
  });

  // Map publications with realistic citation data
  const mappedPublications: Publication[] = publications.map((pub, index) => {
    const authors: PublicationAuthor[] = pub.authors?.map((author, idx) => ({
      name: author.name,
      affiliation: author.affiliation || person.schoolName,
      email: null,
      isCorresponding: author.isCorresponding,
      authorOrder: author.authorOrder,
    })) || [{
      name: person.applicantName,
      affiliation: person.schoolName,
      email: null,
      isCorresponding: true,
      authorOrder: 1,
    }];

    const pubYear = pub.publicationDate ? new Date(pub.publicationDate).getFullYear() : currentYear;
    const citationCount = publicationCitations[index] || 0;

    return {
      id: pub.id,
      profileId: personId,
      researchContributionId: pub.applicationNumber,
      title: pub.title,
      authors: authors,
      venue: pub.venue || getDefaultVenue(pub.publicationType),
      publicationType: mapPublicationType(pub.publicationType),
      year: pubYear,
      volume: pub.extra?.volume || null,
      issue: pub.extra?.issue || null,
      pages: pub.extra?.pages || null,
      doi: pub.doi,
      isbn: pub.extra?.isbn || null,
      issn: pub.extra?.issn || null,
      arxivId: null,
      pubmedId: null,
      citationCount: citationCount,
      citationsPerYear: generatePublicationCitationsPerYear(pubYear, citationCount),
      source: 'manual' as const,
      externalId: pub.applicationNumber,
      pdfUrl: pub.weblink,
      publicationUrl: pub.weblink,
      abstract: pub.extra?.abstract || null,
      keywords: pub.extra?.keywords ? pub.extra.keywords.split(',').map((k: string) => k.trim()) : [],
      isVerified: pub.isApproved,
      createdAt: pub.submittedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  // Helper function to normalize name for comparison and collapse phonetic variations
  const normalizeAuthorName = (name: string): string => {
    if (!name) return '';
    return name.toLowerCase()
      .replace(/[^a-z0-9]/g, '') // remove dots, spaces, commas
      .replace(/aa+/g, 'a')     // collapse double a's
      .replace(/ee+/g, 'e')     // collapse double e's
      .replace(/oo+/g, 'o')     // collapse double o's
      .trim();
  };

  const getEditDistance = (s1: string, s2: string): number => {
    if (s1.length === 0) return s2.length;
    if (s2.length === 0) return s1.length;
    const matrix = [];
    for (let i = 0; i <= s2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    return matrix[s2.length][s1.length];
  };

  const isSimilarWord = (w1: string, w2: string): boolean => {
    if (w1 === w2) return true;
    if (w1.length === 1 && w2.startsWith(w1)) return true;
    if (w2.length === 1 && w1.startsWith(w2)) return true;
    const dist = getEditDistance(w1, w2);
    const maxLen = Math.max(w1.length, w2.length);
    if (maxLen >= 5 && dist <= 2) return true;
    return false;
  };

  // Helper to check if two names are matching (including initials, transpositions and spelling variants)
  const isSamePerson = (nameA: string, nameB: string): boolean => {
    if (!nameA || !nameB) return false;
    
    // Collapse double characters and normalize
    const normalize = (n: string) => n.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/aa+/g, 'a')
      .replace(/ee+/g, 'e')
      .replace(/oo+/g, 'o')
      .split(/\s+/)
      .filter(Boolean);

    const normA = normalize(nameA);
    const normB = normalize(nameB);
    
    if (normA.length === 0 || normB.length === 0) return false;

    // Direct comparison
    if (normA.join(' ') === normB.join(' ')) return true;

    const shorter = normA.length < normB.length ? normA : normB;
    const longer = normA.length < normB.length ? normB : normA;
    
    let matchedParts = 0;
    const usedIndices = new Set<number>();
    
    shorter.forEach(sPart => {
      const matchedIdx = longer.findIndex((lPart, idx) => {
        if (usedIndices.has(idx)) return false;
        return isSimilarWord(sPart, lPart);
      });
      if (matchedIdx !== -1) {
        matchedParts++;
        usedIndices.add(matchedIdx);
      }
    });
    
    return matchedParts === shorter.length;
  };

  // Generate co-authors from publication data
  const coAuthorMap = new Map<string, CoAuthor>();
  const canonicalKeyMap = new Map<string, string>(); // maps normalized name/uid to the chosen canonical author name

  mappedPublications.forEach((pub) => {
    pub.authors?.forEach((author) => {
      // Don't include the main author (with smart spelling match)
      if (isSamePerson(author.name, person.applicantName)) {
        return;
      }

      // Group by user id if available, otherwise by normalized name
      let groupingKey = '';
      const authorUid = (author as PublicationAuthor & { uid?: string }).uid;
      if (authorUid) {
        groupingKey = `uid_${authorUid}`;
      } else {
        const normName = normalizeAuthorName(author.name);
        groupingKey = `name_${normName}`;
      }

      let activeName = canonicalKeyMap.get(groupingKey);

      if (!activeName) {
        // Find if any existing key in coAuthorMap has a matching name
        const existingKey = Array.from(coAuthorMap.keys()).find(k => 
          isSamePerson(k, author.name)
        );

        if (existingKey) {
          activeName = existingKey;
          canonicalKeyMap.set(groupingKey, existingKey);
        } else {
          activeName = author.name;
          canonicalKeyMap.set(groupingKey, author.name);
        }
      }

      if (!coAuthorMap.has(activeName)) {
        coAuthorMap.set(activeName, {
          id: authorUid || (author as { id?: string }).id || `coauthor_${activeName.replace(/\s+/g, '_').toLowerCase()}`,
          name: activeName,
          affiliation: author.affiliation || person.schoolName,
          email: null,
          profileId: authorUid || null,
          collaborationCount: 1,
          firstCollaboration: pub.year || currentYear,
          lastCollaboration: pub.year || currentYear,
          sharedPublications: [pub.id],
          scopusAuthorId: (author as any).scopusAuthorId || null,
          orcid: (author as any).orcid || null,
        });
      } else {
        const existing = coAuthorMap.get(activeName)!;
        existing.collaborationCount++;
        if (!existing.sharedPublications.includes(pub.id)) {
          existing.sharedPublications.push(pub.id);
        }
        const pubYear = pub.year || currentYear;
        existing.lastCollaboration = Math.max(existing.lastCollaboration, pubYear);
        existing.firstCollaboration = Math.min(existing.firstCollaboration, pubYear);
        
        if (authorUid && !existing.profileId) {
          existing.profileId = authorUid;
        }
        if ((author as any).scopusAuthorId && !existing.scopusAuthorId) {
          existing.scopusAuthorId = (author as any).scopusAuthorId;
        }
        if ((author as any).orcid && !existing.orcid) {
          existing.orcid = (author as any).orcid;
        }
      }
    });
  });

  const coAuthors = Array.from(coAuthorMap.values());

  // Generate impact metrics
  const impactMetrics: ImpactMetrics = {
    avgCitationsPerPaper: publications.length > 0 ? totalCitations / publications.length : 0,
    medianCitations: calculateMedian(publicationCitations),
    highlyCitedPapers: publicationCitations.filter(count => count >= 10).length,
    citationDistribution: [
      { range: '0-5', count: publicationCitations.filter(c => c >= 0 && c <= 5).length },
      { range: '6-10', count: publicationCitations.filter(c => c >= 6 && c <= 10).length },
      { range: '11-20', count: publicationCitations.filter(c => c >= 11 && c <= 20).length },
      { range: '21+', count: publicationCitations.filter(c => c >= 21).length },
    ],
  };

  return {
    user: {
      uid: personId,
      name: person.applicantName,
      email: generateRealisticEmail(person.applicantName),
      designation: generateDesignation(person.totalApplications, person.approvedCount),
      department: person.departmentName,
      school: person.schoolName,
      photo: null,
    },
    profile: {
      id: personId,
      userId: personId,
      bio: `Research faculty at ${person.schoolName}, ${person.departmentName}. Specializing in innovative research with ${person.totalApplications} submissions and ${person.approvedCount} approved publications.`,
      researchInterests: generateResearchInterests(publications, person.departmentName),
      googleScholarId: null,
      scopusAuthorId: null,
      webOfScienceId: null,
      orcid: null,
      personalWebsite: null,
      lastSyncedAt: new Date().toISOString(),
      syncStatus: 'success',
      syncError: null,
      autoSyncEnabled: false,
      filterSgtOnly: false,
      syncFrequencyDays: 30,
      visibility: {
        profile: 'public',
        showEmail: true,
        showPhone: false,
        showPublications: true,
        showMetrics: true,
        showCoAuthors: true,
        showResearchInterests: true,
      },
      metrics: {
        totalCitations: totalCitations,
        hIndex: hIndex,
        i10Index: i10Index,
        avgCitationsPerPaper: publications.length > 0 ? totalCitations / publications.length : 0,
        citationsPerYear: citationsPerYear,
      },
      profileCompleteness: calculateProfileCompleteness(person, publications),
      isVerified: false,
      verifiedAt: null,
      verifiedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    publications: mappedPublications,
    coAuthors: coAuthors,
    impactMetrics: impactMetrics,
  };
}

function generateRealisticEmail(name: string): string {
  const cleanName = name.toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, '.');
  return `${cleanName}@researchsphere.app`;
}

/**
 * Generates a realistic designation based on publication activity
 */
function generateDesignation(totalApplications: number, approvedCount: number): string {
  if (approvedCount >= 20) return 'Professor';
  if (approvedCount >= 10) return 'Associate Professor';
  if (approvedCount >= 5) return 'Assistant Professor';
  if (totalApplications >= 3) return 'Assistant Professor';
  return 'Faculty';
}

/**
 * Gets a default venue name based on publication type
 */
function getDefaultVenue(publicationType: string): string {
  switch (publicationType) {
    case 'research_paper':
      return 'International Journal of Research';
    case 'conference_paper':
      return 'International Conference Proceedings';
    case 'book':
      return 'Academic Publishers';
    case 'book_chapter':
      return 'Academic Book Series';
    case 'ipr_patent':
      return 'Patent Office';
    case 'grant_proposal':
      return 'Research Grant Agency';
    default:
      return 'Academic Publication';
  }
}

/**
 * Generates citations per year for a specific publication
 */
function generatePublicationCitationsPerYear(pubYear: number, totalCitations: number): Record<number, number> {
  const currentYear = new Date().getFullYear();
  const citationsPerYear: Record<number, number> = {};
  
  if (totalCitations === 0) return citationsPerYear;
  
  // Distribute citations over years since publication
  for (let year = pubYear; year <= currentYear; year++) {
    const yearsAfterPub = year - pubYear;
    let yearFactor = 0;
    
    if (yearsAfterPub === 0) yearFactor = 0.1;
    else if (yearsAfterPub === 1) yearFactor = 0.3;
    else if (yearsAfterPub === 2) yearFactor = 0.4;
    else if (yearsAfterPub === 3) yearFactor = 0.2;
    else yearFactor = Math.max(0, 0.1 - (yearsAfterPub - 3) * 0.02);
    
    const yearCitations = Math.floor(totalCitations * yearFactor);
    if (yearCitations > 0) {
      citationsPerYear[year] = yearCitations;
    }
  }
  
  return citationsPerYear;
}

/**
 * Maps DRD publication type to research profile publication type
 */
function mapPublicationType(drdType: string): string {
  switch (drdType) {
    case 'research_paper':
      return 'journal';
    case 'conference_paper':
      return 'conference';
    case 'book':
      return 'book';
    case 'book_chapter':
      return 'book_chapter';
    case 'ipr_patent':
    case 'ipr_copyright':
    case 'ipr_trademark':
    case 'ipr_design':
      return 'patent';
    case 'grant_proposal':
      return 'grant';
    default:
      return 'other';
  }
}

/**
 * Generates research interests based on publication data and department
 */
function generateResearchInterests(publications: any[], departmentName: string): string[] {
  const interests = new Set<string>();
  
  // Add department-based interests
  const deptLower = departmentName.toLowerCase();
  if (deptLower.includes('computer') || deptLower.includes('information')) {
    interests.add('Computer Science');
    interests.add('Information Technology');
    interests.add('Software Engineering');
  } else if (deptLower.includes('mechanical')) {
    interests.add('Mechanical Engineering');
    interests.add('Manufacturing');
    interests.add('Design Engineering');
  } else if (deptLower.includes('electrical') || deptLower.includes('electronics')) {
    interests.add('Electrical Engineering');
    interests.add('Electronics');
    interests.add('Signal Processing');
  } else if (deptLower.includes('civil')) {
    interests.add('Civil Engineering');
    interests.add('Structural Engineering');
    interests.add('Construction Management');
  } else if (deptLower.includes('management') || deptLower.includes('business')) {
    interests.add('Management Studies');
    interests.add('Business Administration');
    interests.add('Strategic Management');
  } else if (deptLower.includes('biotechnology') || deptLower.includes('biology')) {
    interests.add('Biotechnology');
    interests.add('Molecular Biology');
    interests.add('Bioengineering');
  }
  
  // Extract interests from publication types and venues
  publications.forEach(pub => {
    switch (pub.publicationType) {
      case 'research_paper':
        interests.add('Research Methodology');
        interests.add('Academic Publishing');
        break;
      case 'conference_paper':
        interests.add('Conference Presentations');
        interests.add('Academic Networking');
        break;
      case 'book':
      case 'book_chapter':
        interests.add('Academic Writing');
        interests.add('Knowledge Dissemination');
        break;
      case 'ipr_patent':
        interests.add('Innovation');
        interests.add('Intellectual Property');
        break;
      case 'grant':
        interests.add('Research Funding');
        interests.add('Grant Writing');
        break;
    }
    
    // Add venue-based interests
    if (pub.venue) {
      const venueLower = pub.venue.toLowerCase();
      if (venueLower.includes('artificial intelligence') || venueLower.includes('machine learning')) {
        interests.add('Artificial Intelligence');
        interests.add('Machine Learning');
      }
      if (venueLower.includes('data') || venueLower.includes('analytics')) {
        interests.add('Data Science');
        interests.add('Data Analytics');
      }
      if (venueLower.includes('network') || venueLower.includes('communication')) {
        interests.add('Computer Networks');
        interests.add('Communication Systems');
      }
      if (venueLower.includes('security') || venueLower.includes('cyber')) {
        interests.add('Cybersecurity');
        interests.add('Information Security');
      }
      if (venueLower.includes('sustainable') || venueLower.includes('environment')) {
        interests.add('Sustainable Development');
        interests.add('Environmental Engineering');
      }
    }
    
    // Add title-based interests
    if (pub.title) {
      const titleLower = pub.title.toLowerCase();
      if (titleLower.includes('iot') || titleLower.includes('internet of things')) {
        interests.add('Internet of Things');
      }
      if (titleLower.includes('blockchain')) {
        interests.add('Blockchain Technology');
      }
      if (titleLower.includes('cloud')) {
        interests.add('Cloud Computing');
      }
      if (titleLower.includes('mobile') || titleLower.includes('android') || titleLower.includes('ios')) {
        interests.add('Mobile Computing');
      }
    }
  });
  
  // Add default interests if none found
  if (interests.size === 0) {
    interests.add('Research and Development');
    interests.add('Academic Excellence');
    interests.add('Innovation');
    interests.add('Technology');
  }
  
  return Array.from(interests).slice(0, 8); // Limit to 8 interests
}

/**
 * Calculates median of an array of numbers
 */
function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Calculates profile completeness percentage
 */
function calculateProfileCompleteness(person: ApplicantPerson, publications: any[]): number {
  let score = 0;
  
  // Basic info (40 points)
  if (person.applicantName) score += 10;
  if (person.schoolName) score += 10;
  if (person.departmentName) score += 10;
  score += 10; // Always have basic profile
  
  // Publications (30 points)
  if (publications.length > 0) score += 15;
  if (publications.length >= 5) score += 15;
  
  // Activity (30 points)
  if (person.totalApplications > 0) score += 15;
  if (person.approvedCount > 0) score += 15;
  
  return Math.min(score, 100);
}
