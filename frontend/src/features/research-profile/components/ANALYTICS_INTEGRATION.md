# Research Profile Analytics Dashboard Integration

## Overview

This document describes the implementation of Task 4: Frontend Analytics Dashboard Integration for the Research Profile System. The implementation extends the existing ResearchSphere UMS analytics dashboard with research profile metrics, comparative analytics, and publication output visualization.

## Components Implemented

### 1. ProfileMetricsAnalytics Component

**File:** `ProfileMetricsAnalytics.tsx`

**Purpose:** Extends existing ResearchSphere UMS analytics with citation-based metrics and department-wide research impact visualization.

**Features:**
- Institution-wide citation metrics (Total Citations, Average h-index, Total Publications, Active Researchers)
- Department research impact table with citations, h-index, publications, and growth metrics
- Top researchers ranking by h-index and citations
- Integrates seamlessly with existing Research Activity Distribution and Monthly Submission Trend

**Props:**
```typescript
interface ProfileMetricsAnalyticsProps {
  data: ProfileMetricsData;
  loading?: boolean;
}
```

**Usage:**
```tsx
import { ProfileMetricsAnalytics } from '@/features/research-profile/components';
import { generateProfileMetricsData } from '@/mocks/research-analytics-mocks';

const data = generateProfileMetricsData();
<ProfileMetricsAnalytics data={data} />
```

### 2. ComparativeAnalytics Component

**File:** `ComparativeAnalytics.tsx`

**Purpose:** Displays percentile rankings within department or field and comparative metrics visualization.

**Features:**
- Department and field ranking display
- Percentile rankings for multiple metrics (h-index, citations, publications, i10-index, citations per paper)
- Visual percentile bars with color coding (Top 10%, Top 25%, Average, Below Average)
- Comparison with department and field averages
- Summary cards showing metric distribution

**Props:**
```typescript
interface ComparativeAnalyticsProps {
  data: ComparativeMetrics;
  loading?: boolean;
}
```

**Usage:**
```tsx
import { ComparativeAnalytics } from '@/features/research-profile/components';
import { generateComparativeMetrics } from '@/mocks/research-analytics-mocks';

const data = generateComparativeMetrics('Dr. Name', 'Department', 'Field');
<ComparativeAnalytics data={data} />
```

### 3. PublicationOutputVisualization Component

**File:** `PublicationOutputVisualization.tsx`

**Purpose:** Displays papers per year chart and publication type distribution.

**Features:**
- Interactive bar chart showing publications per year with citation data
- Pie chart showing publication type distribution
- Detailed type breakdown with progress bars
- Summary statistics (Total Publications, Years Active, Avg Per Year, Publication Types)
- Uses Recharts library for visualizations

**Props:**
```typescript
interface PublicationOutputVisualizationProps {
  data: PublicationOutputData;
  loading?: boolean;
}
```

**Usage:**
```tsx
import { PublicationOutputVisualization } from '@/features/research-profile/components';
import { generatePublicationOutputData } from '@/mocks/research-analytics-mocks';

const data = generatePublicationOutputData(2015, 2024);
<PublicationOutputVisualization data={data} />
```

## Mock Data Generators

**File:** `research-analytics-mocks.ts`

Provides mock data generators for all analytics components:

- `generateProfileMetricsData()` - Generates institution and department metrics
- `generateComparativeMetrics(name, dept, field)` - Generates percentile data
- `generatePublicationOutputData(startYear, endYear)` - Generates yearly output and type distribution
- `generateAnalyticsDashboardData()` - Generates complete dashboard data

## Demo Page

**File:** `app/research/analytics/page.tsx`

A complete demo page showcasing all three analytics components with:
- Tab-based navigation (Overview, Comparative, Output)
- Loading states
- Empty states
- Integration note explaining backward compatibility
- Consistent ResearchSphere UMS styling

**Access:** Navigate to `/research/analytics` in the application

## Testing

**File:** `__tests__/AnalyticsDashboard.test.tsx`

Comprehensive test suite with 20 tests covering:
- Component rendering
- Data display
- Loading states
- Empty states
- Integration testing
- Styling consistency

**Run tests:**
```bash
npm test -- AnalyticsDashboard.test.tsx
```

**Test Results:** All 20 tests passing ✓

## Integration with Existing Analytics

### Backward Compatibility

The implementation maintains full backward compatibility with existing ResearchSphere UMS modules:

1. **No Breaking Changes:** All new components are additive and don't modify existing analytics
2. **Separate Routes:** Research analytics are on `/research/analytics`, existing DRD analytics remain on `/drd/analytics`
3. **Consistent Styling:** Uses the same ResearchSphere UMS color scheme and design patterns
4. **Independent Data:** Uses separate mock data generators that don't interfere with existing data

### Design Consistency

All components follow the existing ResearchSphere UMS design system:

- **Colors:** Primary blue (#005b96), accent colors (#6497b1, #03396c, #b3cde0)
- **Typography:** Consistent font sizes and weights
- **Spacing:** Rounded corners (rounded-2xl, rounded-[28px])
- **Cards:** Border, shadow, and hover effects matching existing dashboard
- **Dark Mode:** Full dark mode support with appropriate color variants

### Integration Points

The analytics dashboard can be integrated with existing ResearchSphere UMS analytics by:

1. **Adding a Tab:** Add a "Research Metrics" tab to the existing DRD analytics page
2. **Embedding Components:** Embed individual components in existing analytics sections
3. **API Integration:** Replace mock data with real API calls to backend services
4. **Permission System:** Use existing ResearchSphere UMS permission framework for access control

## Data Flow

```
Mock Data Generators
        ↓
Component Props
        ↓
Component Rendering
        ↓
User Interface
```

**Future:** Replace mock data with API calls:

```
Backend API
        ↓
Service Layer
        ↓
Component Props
        ↓
Component Rendering
        ↓
User Interface
```

## Styling Guidelines

All components use:

- **Container:** `rounded-[28px] border border-[#d8e6ef] dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm`
- **Headers:** `text-lg font-semibold text-[#011f4b] dark:text-white`
- **Subtext:** `text-sm text-gray-500 dark:text-gray-400`
- **Accent:** `text-[#005b96] dark:text-blue-400`
- **Gradients:** `bg-gradient-to-br from-[#005b96] to-[#03396c]`

## Dependencies

- **React:** Component framework
- **Recharts:** Chart library for visualizations
- **Lucide React:** Icon library
- **TailwindCSS:** Styling framework

## Next Steps

To complete the integration:

1. **Backend API:** Implement backend endpoints for analytics data
2. **Real Data:** Replace mock data with API calls
3. **Permissions:** Integrate with ResearchSphere UMS permission system
4. **Navigation:** Add links from main navigation to research analytics
5. **Filters:** Add date range and department filters
6. **Export:** Add CSV/PDF export functionality
7. **Caching:** Implement data caching for performance

## File Structure

```
frontend/src/
├── features/research-profile/components/
│   ├── ProfileMetricsAnalytics.tsx
│   ├── ComparativeAnalytics.tsx
│   ├── PublicationOutputVisualization.tsx
│   ├── index.ts (exports)
│   └── __tests__/
│       └── AnalyticsDashboard.test.tsx
├── mocks/
│   └── research-analytics-mocks.ts
└── app/research/analytics/
    └── page.tsx
```

## Summary

Task 4 has been successfully implemented with:

✅ **Sub-task 4.1:** Extended existing analytics dashboard with profile metrics
✅ **Sub-task 4.2:** Created comparative analytics component
✅ **Sub-task 4.3:** Added publication output visualization

All components:
- Use mock data initially as specified
- Integrate with existing ResearchSphere UMS analytics design
- Display citation-based metrics
- Show department-wide research impact
- Provide comparative analytics with percentile rankings
- Visualize publication output over time
- Include comprehensive tests (20/20 passing)
- Maintain backward compatibility
- Follow ResearchSphere UMS design system
