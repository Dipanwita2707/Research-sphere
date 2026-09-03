/**
 * Example Usage of Research Profile Mock Data
 * 
 * This file demonstrates how to use the mock data generators and API functions.
 * These examples can be used as reference when building components.
 */

import {
  generateProfileData,
  generateMultipleProfiles,
  generatePublication,
  generateCoAuthorNetwork,
  mockResearchProfileAPI,
} from './index';

// ============================================================================
// Example 1: Generate a Single Profile
// ============================================================================

export async function exampleGenerateSingleProfile() {
  // Generate a profile with default settings (15 publications)
  const profile = generateProfileData();
  
  console.log('Generated Profile:', {
    name: profile.user.name,
    department: profile.user.department,
    hIndex: profile.profile.metrics.hIndex,
    totalCitations: profile.profile.metrics.totalCitations,
    publicationCount: profile.publications.length,
    coAuthorCount: profile.coAuthors.length,
  });
  
  return profile;
}

// ============================================================================
// Example 2: Generate Multiple Profiles
// ============================================================================

export async function exampleGenerateMultipleProfiles() {
  // Generate 5 profiles for testing list views
  const profiles = generateMultipleProfiles(5);
  
  console.log(`Generated ${profiles.length} profiles`);
  profiles.forEach((profile, index) => {
    console.log(`${index + 1}. ${profile.user.name} - h-index: ${profile.profile.metrics.hIndex}`);
  });
  
  return profiles;
}

// ============================================================================
// Example 3: Fetch Profile via Mock API
// ============================================================================

export async function exampleFetchProfile(userId: string) {
  try {
    const response = await mockResearchProfileAPI.getProfile(userId);
    
    console.log('Fetched Profile:', {
      name: response.profile.user.name,
      canEdit: response.permissions.canEdit,
      metrics: response.profile.profile.metrics,
    });
    
    return response;
  } catch (error) {
    console.error('Error fetching profile:', error);
    throw error;
  }
}

// ============================================================================
// Example 4: Search Profiles
// ============================================================================

export async function exampleSearchProfiles() {
  try {
    const searchResults = await mockResearchProfileAPI.searchProfiles({
      query: 'machine learning',
      filters: {
        department: 'Computer Science and Engineering',
        minCitations: 50,
      },
      page: 1,
      limit: 10,
    });
    
    console.log('Search Results:', {
      total: searchResults.total,
      page: searchResults.page,
      hasMore: searchResults.hasMore,
      results: searchResults.results.length,
    });
    
    searchResults.results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.name} - Citations: ${result.totalCitations}`);
    });
    
    return searchResults;
  } catch (error) {
    console.error('Error searching profiles:', error);
    throw error;
  }
}

// ============================================================================
// Example 5: Sync Profile with External Database
// ============================================================================

export async function exampleSyncProfile(userId: string) {
  try {
    const syncResult = await mockResearchProfileAPI.syncProfile(userId, {
      source: 'google_scholar',
      profileId: 'scholar-id-123',
    });
    
    console.log('Sync Result:', {
      status: syncResult.status,
      newPublications: syncResult.newPublications,
      updatedCitations: syncResult.updatedCitations,
      message: syncResult.message,
    });
    
    return syncResult;
  } catch (error) {
    console.error('Error syncing profile:', error);
    throw error;
  }
}

// ============================================================================
// Example 6: Add Publication Manually
// ============================================================================

export async function exampleAddPublication(userId: string) {
  try {
    const newPublication = await mockResearchProfileAPI.addPublication(userId, {
      title: 'A Novel Approach to Deep Learning',
      authors: [
        {
          name: 'Dr. John Doe',
          affiliation: 'ResearchSphere',
          email: null,
          isCorresponding: true,
          authorOrder: 1,
        },
        {
          name: 'Dr. Jane Smith',
          affiliation: 'IIT Delhi',
          email: null,
          isCorresponding: false,
          authorOrder: 2,
        },
      ],
      venue: 'IEEE Transactions on Neural Networks',
      year: 2024,
      doi: '10.1109/TNNLS.2024.12345',
      citations: 5,
    });
    
    console.log('Added Publication:', {
      id: newPublication.id,
      title: newPublication.title,
      year: newPublication.year,
      citations: newPublication.citationCount,
    });
    
    return newPublication;
  } catch (error) {
    console.error('Error adding publication:', error);
    throw error;
  }
}

// ============================================================================
// Example 7: Get Co-Author Network
// ============================================================================

export async function exampleGetCoAuthorNetwork(userId: string) {
  try {
    const network = await mockResearchProfileAPI.getCoAuthorNetwork(userId);
    
    console.log('Co-Author Network:', {
      nodeCount: network.nodes.length,
      edgeCount: network.edges.length,
      mainAuthor: network.nodes.find(n => n.isMainAuthor)?.name,
    });
    
    // Log top collaborators
    const sortedNodes = network.nodes
      .filter(n => !n.isMainAuthor)
      .sort((a, b) => b.collaborationCount - a.collaborationCount)
      .slice(0, 5);
    
    console.log('Top Collaborators:');
    sortedNodes.forEach((node, index) => {
      console.log(`${index + 1}. ${node.name} - ${node.collaborationCount} collaborations`);
    });
    
    return network;
  } catch (error) {
    console.error('Error fetching co-author network:', error);
    throw error;
  }
}

// ============================================================================
// Example 8: Update Research Interests
// ============================================================================

export async function exampleUpdateResearchInterests(userId: string) {
  try {
    const updatedProfile = await mockResearchProfileAPI.updateResearchInterests(userId, [
      'Machine Learning',
      'Deep Learning',
      'Computer Vision',
      'Natural Language Processing',
    ]);
    
    console.log('Updated Research Interests:', updatedProfile.profile.researchInterests);
    
    return updatedProfile;
  } catch (error) {
    console.error('Error updating research interests:', error);
    throw error;
  }
}

// ============================================================================
// Example 9: Get Citation Metrics
// ============================================================================

export async function exampleGetCitationMetrics(userId: string) {
  try {
    const metricsData = await mockResearchProfileAPI.getCitationMetrics(userId);
    
    console.log('Citation Metrics:', {
      hIndex: metricsData.metrics.hIndex,
      i10Index: metricsData.metrics.i10Index,
      totalCitations: metricsData.metrics.totalCitations,
      avgCitationsPerPaper: metricsData.metrics.avgCitationsPerPaper,
      highlyCitedPapers: metricsData.impactMetrics.highlyCitedPapers,
    });
    
    // Log citation trend
    console.log('Citation Trend (last 5 years):');
    metricsData.metrics.citationsPerYear.slice(-5).forEach(({ year, count }) => {
      console.log(`${year}: ${count} citations`);
    });
    
    return metricsData;
  } catch (error) {
    console.error('Error fetching citation metrics:', error);
    throw error;
  }
}

// ============================================================================
// Example 10: Get Trending Researchers
// ============================================================================

export async function exampleGetTrendingResearchers() {
  try {
    const trending = await mockResearchProfileAPI.getTrendingResearchers(5);
    
    console.log('Trending Researchers:');
    trending.forEach((researcher, index) => {
      console.log(
        `${index + 1}. ${researcher.name} - ` +
        `${researcher.recentPublications} recent publications, ` +
        `h-index: ${researcher.hIndex}`
      );
    });
    
    return trending;
  } catch (error) {
    console.error('Error fetching trending researchers:', error);
    throw error;
  }
}

// ============================================================================
// Run All Examples
// ============================================================================

export async function runAllExamples() {
  console.log('='.repeat(80));
  console.log('Research Profile Mock Data - Example Usage');
  console.log('='.repeat(80));
  
  // Generate a profile first
  const profile = await exampleGenerateSingleProfile();
  const userId = profile.user.uid;
  
  console.log('\n' + '='.repeat(80));
  await exampleGenerateMultipleProfiles();
  
  console.log('\n' + '='.repeat(80));
  await exampleFetchProfile(userId);
  
  console.log('\n' + '='.repeat(80));
  await exampleSearchProfiles();
  
  console.log('\n' + '='.repeat(80));
  await exampleSyncProfile(userId);
  
  console.log('\n' + '='.repeat(80));
  await exampleAddPublication(userId);
  
  console.log('\n' + '='.repeat(80));
  await exampleGetCoAuthorNetwork(userId);
  
  console.log('\n' + '='.repeat(80));
  await exampleUpdateResearchInterests(userId);
  
  console.log('\n' + '='.repeat(80));
  await exampleGetCitationMetrics(userId);
  
  console.log('\n' + '='.repeat(80));
  await exampleGetTrendingResearchers();
  
  console.log('\n' + '='.repeat(80));
  console.log('All examples completed successfully!');
  console.log('='.repeat(80));
}

// Uncomment to run examples:
// runAllExamples().catch(console.error);
