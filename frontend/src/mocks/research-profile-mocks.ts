/**
 * Mock Data Generators for Research Profile System
 * 
 * Generates realistic mock data for profiles, publications, citations,
 * and co-author networks for development and testing.
 */

import type {
  ResearchProfile,
  ProfileData,
  Publication,
  CoAuthor,
  CitationMetrics,
  ImpactMetrics,
  YearlyCitations,
  NetworkNode,
  NetworkEdge,
  CoAuthorNetwork,
  ProfileVisibilitySettings,
  PublicationAuthor,
} from '@/shared/types/research-profile.types';

// ============================================================================
// Sample Data Pools
// ============================================================================

const RESEARCH_INTERESTS = [
  'Machine Learning',
  'Artificial Intelligence',
  'Computer Vision',
  'Natural Language Processing',
  'Deep Learning',
  'Data Mining',
  'Cybersecurity',
  'Cloud Computing',
  'Internet of Things',
  'Blockchain',
  'Quantum Computing',
  'Bioinformatics',
  'Software Engineering',
  'Human-Computer Interaction',
  'Distributed Systems',
];

const JOURNAL_NAMES = [
  'IEEE Transactions on Pattern Analysis and Machine Intelligence',
  'Nature Machine Intelligence',
  'Journal of Machine Learning Research',
  'ACM Computing Surveys',
  'IEEE Access',
  'Expert Systems with Applications',
  'Information Sciences',
  'Knowledge-Based Systems',
  'Neural Networks',
  'Pattern Recognition',
];

const CONFERENCE_NAMES = [
  'International Conference on Machine Learning (ICML)',
  'Conference on Neural Information Processing Systems (NeurIPS)',
  'IEEE Conference on Computer Vision and Pattern Recognition (CVPR)',
  'Association for Computational Linguistics (ACL)',
  'International Conference on Learning Representations (ICLR)',
  'AAAI Conference on Artificial Intelligence',
  'International Joint Conference on Artificial Intelligence (IJCAI)',
  'ACM SIGKDD Conference on Knowledge Discovery and Data Mining',
];

const AUTHOR_NAMES = [
  'Dr. Rajesh Kumar',
  'Dr. Priya Sharma',
  'Dr. Amit Patel',
  'Dr. Sneha Gupta',
  'Dr. Vikram Singh',
  'Dr. Anita Desai',
  'Dr. Rahul Verma',
  'Dr. Kavita Reddy',
  'Dr. Sanjay Mehta',
  'Dr. Neha Agarwal',
  'Dr. Arjun Malhotra',
  'Dr. Pooja Joshi',
  'Dr. Karan Kapoor',
  'Dr. Divya Nair',
  'Dr. Rohan Khanna',
];

const AFFILIATIONS = [
  'ResearchSphere',
  'Indian Institute of Technology Delhi',
  'Indian Institute of Science Bangalore',
  'Jawaharlal Nehru University',
  'University of Delhi',
  'Birla Institute of Technology and Science',
  'National Institute of Technology',
  'International Institute of Information Technology',
];

const DEPARTMENTS = [
  'Computer Science and Engineering',
  'Information Technology',
  'Electronics and Communication Engineering',
  'Artificial Intelligence and Data Science',
  'Software Engineering',
];

const SCHOOLS = [
  'School of Engineering and Technology',
  'School of Computer Science',
  'School of Information Technology',
];

// ============================================================================
// Helper Functions
// ============================================================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomChoice<T>(array: T[]): T {
  return array[randomInt(0, array.length - 1)];
}

function randomChoices<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, array.length));
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// Citation Metrics Generators
// ============================================================================

export function generateCitationMetrics(publicationCount: number): CitationMetrics {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 10;
  
  // Generate realistic citation trend
  const citationsPerYear: YearlyCitations[] = [];
  let totalCitations = 0;
  
  for (let year = startYear; year <= currentYear; year++) {
    const yearsSinceStart = year - startYear;
    // Citations tend to grow over time
    const baseCitations = Math.floor(publicationCount * yearsSinceStart * 2);
    const variance = randomInt(-10, 20);
    const count = Math.max(0, baseCitations + variance);
    
    citationsPerYear.push({ year, count });
    totalCitations += count;
  }
  
  // Calculate h-index (simplified)
  const hIndex = Math.min(
    publicationCount,
    Math.floor(Math.sqrt(totalCitations))
  );
  
  // Calculate i10-index (papers with at least 10 citations)
  const i10Index = Math.floor(publicationCount * 0.6); // Assume 60% have >10 citations
  
  const avgCitationsPerPaper = publicationCount > 0 
    ? parseFloat((totalCitations / publicationCount).toFixed(2))
    : 0;
  
  return {
    hIndex,
    i10Index,
    totalCitations,
    citationsPerYear,
    avgCitationsPerPaper,
  };
}

export function generateImpactMetrics(publications: Publication[]): ImpactMetrics {
  const citationCounts = publications.map(p => p.citationCount).sort((a, b) => a - b);
  
  const avgCitationsPerPaper = citationCounts.length > 0
    ? parseFloat((citationCounts.reduce((a, b) => a + b, 0) / citationCounts.length).toFixed(2))
    : 0;
  
  const medianCitations = citationCounts.length > 0
    ? citationCounts[Math.floor(citationCounts.length / 2)]
    : 0;
  
  const highlyCitedPapers = citationCounts.filter(c => c > 10).length;
  
  const citationDistribution = [
    { range: '0-5', count: citationCounts.filter(c => c >= 0 && c <= 5).length },
    { range: '6-10', count: citationCounts.filter(c => c >= 6 && c <= 10).length },
    { range: '11-20', count: citationCounts.filter(c => c >= 11 && c <= 20).length },
    { range: '21-50', count: citationCounts.filter(c => c >= 21 && c <= 50).length },
    { range: '51+', count: citationCounts.filter(c => c > 50).length },
  ];
  
  return {
    avgCitationsPerPaper,
    medianCitations,
    highlyCitedPapers,
    citationDistribution,
  };
}

// ============================================================================
// Publication Generators
// ============================================================================

export function generatePublicationAuthors(count: number, includeMainAuthor: boolean = true): PublicationAuthor[] {
  const authors: PublicationAuthor[] = [];
  
  if (includeMainAuthor) {
    authors.push({
      name: randomChoice(AUTHOR_NAMES),
      affiliation: 'ResearchSphere',
      email: null,
      isCorresponding: true,
      authorOrder: 1,
    });
  }
  
  for (let i = authors.length; i < count; i++) {
    authors.push({
      name: randomChoice(AUTHOR_NAMES),
      affiliation: randomChoice(AFFILIATIONS),
      email: null,
      isCorresponding: false,
      authorOrder: i + 1,
    });
  }
  
  return authors;
}

export function generatePublication(profileId: string, year?: number): Publication {
  const pubYear = year || randomInt(2015, new Date().getFullYear());
  const isJournal = Math.random() > 0.4;
  const venue = isJournal ? randomChoice(JOURNAL_NAMES) : randomChoice(CONFERENCE_NAMES);
  const publicationType = isJournal ? 'journal' : 'conference';
  
  const citationCount = randomInt(0, 150);
  const citationsPerYear: Record<number, number> = {};
  
  // Generate citation trend for this publication
  for (let y = pubYear; y <= new Date().getFullYear(); y++) {
    const yearsSincePublication = y - pubYear;
    if (yearsSincePublication === 0) {
      citationsPerYear[y] = 0;
    } else {
      const baseCitations = Math.floor(citationCount / (new Date().getFullYear() - pubYear + 1));
      citationsPerYear[y] = Math.max(0, baseCitations + randomInt(-5, 10));
    }
  }
  
  const authorCount = randomInt(2, 5);
  const authors = generatePublicationAuthors(authorCount);
  
  return {
    id: generateUUID(),
    profileId,
    researchContributionId: Math.random() > 0.5 ? generateUUID() : null,
    title: `${randomChoice(['A Novel', 'An Efficient', 'Deep Learning Based', 'Machine Learning Approach to', 'Automated'])} ${randomChoice(['Method', 'Framework', 'System', 'Approach', 'Algorithm'])} for ${randomChoice(['Classification', 'Detection', 'Recognition', 'Prediction', 'Analysis'])}`,
    authors,
    venue,
    publicationType,
    year: pubYear,
    volume: isJournal ? `${randomInt(1, 50)}` : null,
    issue: isJournal ? `${randomInt(1, 12)}` : null,
    pages: isJournal ? `${randomInt(1, 500)}-${randomInt(501, 600)}` : null,
    doi: `10.1${randomInt(100, 999)}/${randomInt(1000, 9999)}`,
    isbn: null,
    issn: isJournal ? `${randomInt(1000, 9999)}-${randomInt(1000, 9999)}` : null,
    arxivId: null,
    pubmedId: null,
    citationCount,
    citationsPerYear,
    source: randomChoice(['google_scholar', 'scopus', 'manual'] as const),
    externalId: `ext_${generateUUID().slice(0, 8)}`,
    pdfUrl: null,
    publicationUrl: `https://doi.org/10.1${randomInt(100, 999)}/${randomInt(1000, 9999)}`,
    abstract: null,
    keywords: randomChoices(RESEARCH_INTERESTS, randomInt(2, 4)),
    isVerified: Math.random() > 0.3,
    createdAt: new Date(pubYear, 0, 1).toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function generatePublications(profileId: string, count: number): Publication[] {
  const publications: Publication[] = [];
  const currentYear = new Date().getFullYear();
  
  for (let i = 0; i < count; i++) {
    const year = randomInt(currentYear - 10, currentYear);
    publications.push(generatePublication(profileId, year));
  }
  
  // Sort by year descending
  return publications.sort((a, b) => b.year - a.year);
}

// ============================================================================
// Co-Author Generators
// ============================================================================

export function generateCoAuthor(publications: Publication[]): CoAuthor {
  const name = randomChoice(AUTHOR_NAMES);
  const collaborationCount = randomInt(1, 10);
  const sharedPubs = randomChoices(publications, Math.min(collaborationCount, publications.length));
  
  const years = sharedPubs.map(p => p.year).sort((a, b) => a - b);
  
  return {
    id: generateUUID(),
    name,
    affiliation: randomChoice(AFFILIATIONS),
    email: null,
    profileId: Math.random() > 0.7 ? generateUUID() : null,
    collaborationCount,
    firstCollaboration: years[0] || new Date().getFullYear(),
    lastCollaboration: years[years.length - 1] || new Date().getFullYear(),
    sharedPublications: sharedPubs.map(p => p.id),
  };
}

export function generateCoAuthors(publications: Publication[], count: number): CoAuthor[] {
  const coAuthors: CoAuthor[] = [];
  
  for (let i = 0; i < count; i++) {
    coAuthors.push(generateCoAuthor(publications));
  }
  
  return coAuthors;
}

export function generateCoAuthorNetwork(mainAuthorName: string, coAuthors: CoAuthor[]): CoAuthorNetwork {
  const mainNodeId = 'main';
  
  const nodes: NetworkNode[] = [
    {
      id: mainNodeId,
      name: mainAuthorName,
      affiliation: 'ResearchSphere',
      collaborationCount: coAuthors.reduce((sum, ca) => sum + ca.collaborationCount, 0),
      isMainAuthor: true,
    },
  ];
  
  const edges: NetworkEdge[] = [];
  
  coAuthors.forEach((coAuthor, index) => {
    const nodeId = `coauthor_${index}`;
    
    nodes.push({
      id: nodeId,
      name: coAuthor.name,
      affiliation: coAuthor.affiliation || 'Unknown',
      collaborationCount: coAuthor.collaborationCount,
    });
    
    edges.push({
      source: mainNodeId,
      target: nodeId,
      weight: coAuthor.collaborationCount,
      publications: coAuthor.sharedPublications,
    });
  });
  
  // Add some edges between co-authors (they might collaborate with each other)
  for (let i = 0; i < Math.min(5, coAuthors.length - 1); i++) {
    const source = `coauthor_${randomInt(0, coAuthors.length - 1)}`;
    const target = `coauthor_${randomInt(0, coAuthors.length - 1)}`;
    
    if (source !== target && !edges.find(e => 
      (e.source === source && e.target === target) || 
      (e.source === target && e.target === source)
    )) {
      edges.push({
        source,
        target,
        weight: randomInt(1, 3),
        publications: [],
      });
    }
  }
  
  return { nodes, edges };
}

// ============================================================================
// Profile Generators
// ============================================================================

export function generateVisibilitySettings(): ProfileVisibilitySettings {
  return {
    profile: 'public',
    showEmail: true,
    showPhone: false,
    showResearchInterests: true,
    showPublications: true,
    showCoAuthors: true,
    showMetrics: true,
  };
}

export function generateResearchProfile(userId: string, publicationCount: number): ResearchProfile {
  const metrics = generateCitationMetrics(publicationCount);
  
  return {
    id: generateUUID(),
    userId,
    googleScholarId: `scholar_${generateUUID().slice(0, 12)}`,
    scopusAuthorId: Math.random() > 0.5 ? `${randomInt(10000000, 99999999)}` : null,
    webOfScienceId: null,
    orcid: Math.random() > 0.5 ? `0000-000${randomInt(1, 9)}-${randomInt(1000, 9999)}-${randomInt(1000, 9999)}` : null,
    researchInterests: randomChoices(RESEARCH_INTERESTS, randomInt(3, 6)),
    bio: 'Researcher specializing in advanced computing and artificial intelligence.',
    personalWebsite: Math.random() > 0.6 ? `https://example.com/~researcher${randomInt(1, 100)}` : null,
    metrics,
    visibility: generateVisibilitySettings(),
    lastSyncedAt: new Date(Date.now() - randomInt(1, 7) * 24 * 60 * 60 * 1000).toISOString(),
    syncStatus: 'success',
    syncError: null,
    autoSyncEnabled: true,
    filterSgtOnly: false,
    syncFrequencyDays: 7,
    profileCompleteness: randomInt(70, 100),
    isVerified: Math.random() > 0.3,
    verifiedAt: Math.random() > 0.3 ? new Date().toISOString() : null,
    verifiedBy: Math.random() > 0.3 ? generateUUID() : null,
    createdAt: new Date(Date.now() - randomInt(365, 1825) * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function generateProfileData(userId?: string, publicationCount: number = 15): ProfileData {
  const uid = userId || generateUUID();
  const name = randomChoice(AUTHOR_NAMES);
  
  const profile = generateResearchProfile(uid, publicationCount);
  const publications = generatePublications(profile.id, publicationCount);
  const coAuthors = generateCoAuthors(publications, randomInt(8, 15));
  const impactMetrics = generateImpactMetrics(publications);
  
  return {
    user: {
      uid,
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@researchsphere.app`,
      photo: null,
      designation: randomChoice(['Professor', 'Associate Professor', 'Assistant Professor', 'Senior Lecturer']),
      department: randomChoice(DEPARTMENTS),
      school: randomChoice(SCHOOLS),
    },
    profile,
    publications,
    coAuthors,
    impactMetrics,
  };
}

// ============================================================================
// Batch Generators
// ============================================================================

export function generateMultipleProfiles(count: number): ProfileData[] {
  const profiles: ProfileData[] = [];
  
  for (let i = 0; i < count; i++) {
    const publicationCount = randomInt(5, 30);
    profiles.push(generateProfileData(undefined, publicationCount));
  }
  
  return profiles;
}
