# Research Profile System - Mock Data

This directory contains mock data generators and API functions for the Research Profile System. These mocks are used for frontend development and testing before the backend APIs are ready.

## Files

### `research-profile.types.ts`
Located in `src/shared/types/research-profile.types.ts`, this file contains all TypeScript type definitions for the Research Profile System, including:
- Profile data structures
- Citation metrics
- Publications
- Co-author networks
- API request/response types

### `research-profile-mocks.ts`
Mock data generators that create realistic research profile data:
- `generateProfileData()` - Generate a complete profile with publications and co-authors
- `generatePublications()` - Generate multiple publications
- `generateCitationMetrics()` - Generate citation metrics (h-index, i10-index, etc.)
- `generateCoAuthors()` - Generate co-author data
- `generateCoAuthorNetwork()` - Generate network visualization data
- `generateMultipleProfiles()` - Generate multiple profiles for testing

### `research-profile-api.ts`
Mock API layer that simulates backend endpoints:
- `getProfile(userId)` - Get a researcher's profile
- `searchProfiles(request)` - Search for researchers
- `syncProfile(userId, request)` - Sync profile with external database
- `addPublication(userId, request)` - Add a publication manually
- `getCoAuthorNetwork(userId)` - Get co-author network
- `getPublications(userId)` - Get all publications
- `updateVisibilitySettings(userId, settings)` - Update privacy settings
- `updateResearchInterests(userId, interests)` - Update research interests
- `getCitationMetrics(userId)` - Get citation metrics
- `getTrendingResearchers(limit)` - Get trending researchers

## Usage

### Import Mock Data Generators

```typescript
import { generateProfileData, generateMultipleProfiles } from '@/mocks';

// Generate a single profile
const profile = generateProfileData();

// Generate multiple profiles
const profiles = generateMultipleProfiles(10);
```

### Import Mock API Functions

```typescript
import { mockResearchProfileAPI } from '@/mocks';

// Get a profile
const response = await mockResearchProfileAPI.getProfile('user-123');

// Search profiles
const searchResults = await mockResearchProfileAPI.searchProfiles({
  query: 'machine learning',
  filters: { department: 'Computer Science' },
  page: 1,
  limit: 10,
});

// Sync profile
const syncResult = await mockResearchProfileAPI.syncProfile('user-123', {
  source: 'google_scholar',
  profileId: 'scholar-id-123',
});
```

### Using in React Components

```typescript
import { useEffect, useState } from 'react';
import { mockResearchProfileAPI } from '@/mocks';
import type { ProfileData } from '@/shared/types';

function ProfilePage({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await mockResearchProfileAPI.getProfile(userId);
        setProfile(response.profile);
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (!profile) return <div>Profile not found</div>;

  return (
    <div>
      <h1>{profile.user.name}</h1>
      <p>h-index: {profile.profile.metrics.hIndex}</p>
      <p>Total Citations: {profile.profile.metrics.totalCitations}</p>
      {/* ... rest of profile UI */}
    </div>
  );
}
```

## Mock Data Characteristics

### Profiles
- 20 pre-generated profiles in the data store
- Realistic researcher names, affiliations, and departments
- Citation metrics based on publication counts
- Research interests from common CS/AI topics

### Publications
- 5-30 publications per profile
- Mix of journal and conference papers
- Publication years from 2015 to present
- Realistic citation counts and trends
- Complete bibliographic information

### Citation Metrics
- h-index calculated based on publication citations
- i10-index (papers with ≥10 citations)
- Total citations with yearly breakdown
- Average citations per paper

### Co-Author Networks
- 8-15 co-authors per profile
- Collaboration counts and time ranges
- Network visualization data with nodes and edges

## Network Simulation

All mock API functions include simulated network delays (200-800ms) to mimic real API behavior. This helps test loading states and async behavior in the UI.

## Data Persistence

The mock data store keeps data in memory during the session. Refreshing the page will reset all data. This is intentional for development purposes.

## Switching to Real API

When the backend is ready, replace mock API imports with real API calls:

```typescript
// Before (mock)
import { mockResearchProfileAPI } from '@/mocks';
const response = await mockResearchProfileAPI.getProfile(userId);

// After (real API)
import { researchProfileAPI } from '@/shared/api';
const response = await researchProfileAPI.getProfile(userId);
```

The type definitions remain the same, ensuring type safety across the transition.
