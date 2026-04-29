# Research Profile System - Frontend Components

## Overview

This directory contains the frontend components for the Research Profile System, implementing a Google Scholar-style researcher profile interface.

## Implemented Components (Task 2.1)

### ProfilePage (`/research/profile/[userId]`)

Main profile page component that displays a researcher's complete profile with:

- **Header Section**
  - Profile photo (or generated avatar)
  - Researcher name, designation, and department
  - Email (if visibility allows)
  - Research interests as clickable tags
  - Bio text
  - External profile links (Google Scholar, ORCID, personal website)
  - Edit button (visible only to profile owner)

- **Citation Metrics Panel** (Left Sidebar)
  - Total citations with prominent display
  - h-index with explanation
  - i10-index with explanation
  - Average citations per paper
  - Impact metrics (median citations, highly cited papers)
  - Collaboration statistics (co-authors count)

- **Main Content Area**
  - Citation trend chart showing yearly citations
  - Publications list with filtering and sorting
  - Full bibliographic information for each publication

### Component Structure

```
research-profile/
├── components/
│   ├── CitationMetricsPanel.tsx    # Citation metrics display
│   ├── PublicationList.tsx         # Publications with filters
│   ├── CitationTrendChart.tsx      # Recharts line chart
│   ├── ResearchInterestsTags.tsx   # Research interest tags
│   └── index.ts                    # Component exports
└── README.md
```

## Features

### Professional Typography and Spacing

- Follows Google Scholar's clean, academic design aesthetic
- Uses Tailwind CSS for consistent spacing and typography
- Dark mode support throughout
- Responsive design for all screen sizes

### Citation Metrics Display

- Prominent total citations count
- Visual indicators for h-index and i10-index
- Explanatory text for each metric
- Color-coded metric cards

### Publication List

- Sortable by year (newest first) or citations (most cited)
- Filterable by publication year
- Full bibliographic formatting
- Citation counts with visual indicators
- DOI links and external publication links
- Publication type badges
- Verification status indicators
- Keyword tags

### Citation Trend Chart

- Interactive line chart using Recharts
- Shows yearly citation trends
- Custom tooltip with year and citation count
- Responsive design

### Mock Data Integration

- Uses mock API from Task 1
- Generates realistic profile data
- Simulates network delays
- Error handling and loading states

## Usage

```typescript
// Navigate to a researcher's profile
// URL: /research/profile/[userId]

// Example:
// /research/profile/123e4567-e89b-12d3-a456-426614174000
```

## Design Decisions

1. **Google Scholar Aesthetic**: Matched Google Scholar's layout with header, sidebar metrics, and main content area
2. **Component Separation**: Split into reusable components for maintainability
3. **Mock Data First**: Uses mock API to enable frontend development without backend
4. **Accessibility**: Proper semantic HTML and ARIA labels
5. **Performance**: Lazy loading and optimized rendering
6. **Dark Mode**: Full dark mode support using Tailwind's dark: variants

## Requirements Validated

- ✅ Requirement 1.1: Google Scholar-style layout
- ✅ Requirement 1.2: Citation metrics display (h-index, i10-index, total citations)
- ✅ Requirement 1.3: Publication list with bibliographic information
- ✅ Requirement 8.2: Professional typography and spacing
- ✅ Requirement 8.4: Clean, academic-style interface

## Next Steps

Task 2.2 will implement property-based tests for:
- Citation metrics display completeness
- Profile ownership edit control
- Publication display completeness
