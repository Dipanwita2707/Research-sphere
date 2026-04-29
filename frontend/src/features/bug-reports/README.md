# Bug Report System - Frontend

This feature enables users to report bugs from any authenticated page and provides administrators with a comprehensive dashboard for managing bug reports.

## Features

### User Features
- **Fixed Bug Icon Widget**: Always visible in the bottom-right corner of authenticated pages
- **Bug Report Form**: Modal form with description input and screenshot upload
- **Screenshot Upload**: Drag-and-drop or click-to-browse, supports up to 5 images (5MB each)
- **Automatic Context Capture**: Page URL, route path, and user identification

### Admin Features
- **Bug Report Dashboard**: View all bug reports with filtering, search, and sorting
- **Status Management**: Mark reports as resolved/unresolved
- **Detailed View**: View complete bug information including screenshots
- **Search & Filter**: Search by user, description, or URL; filter by status
- **Pagination**: Handle large numbers of bug reports efficiently

## Directory Structure

```
features/bug-reports/
├── components/
│   ├── BugReportWidget.tsx      # Fixed bug icon button
│   ├── BugReportForm.tsx        # Bug report submission form
│   ├── ScreenshotUpload.tsx     # Screenshot upload component
│   ├── ScreenshotPreview.tsx    # Screenshot thumbnail display
│   └── index.ts                 # Component exports
├── hooks/
│   ├── useBugReport.ts          # Bug report submission logic
│   └── index.ts                 # Hook exports
├── types/
│   └── bugReport.types.ts       # TypeScript type definitions
└── README.md                    # This file

app/admin/bug-reports/
├── page.tsx                     # Admin dashboard main page
├── [id]/
│   └── page.tsx                 # Bug report detail page
└── components/
    ├── BugReportTable.tsx       # Report listing table
    ├── BugReportFilters.tsx     # Status filter controls
    ├── BugReportSearch.tsx      # Search functionality
    └── BugReportDetail.tsx      # Detailed view component
```

## Usage

### For Users

The bug report widget is automatically available on all authenticated pages. Click the red bug icon in the bottom-right corner to report a bug.

### For Developers

#### Importing Components

```typescript
import { BugReportWidget } from '@/features/bug-reports/components';
```

#### Using the Hook

```typescript
import { useBugReport } from '@/features/bug-reports/hooks';

function MyComponent() {
  const {
    description,
    setDescription,
    screenshots,
    setScreenshots,
    errors,
    isSubmitting,
    submitBugReport,
    resetForm,
  } = useBugReport();

  // Use the hook methods...
}
```

#### Type Definitions

```typescript
import type {
  BugReport,
  Screenshot,
  BugReportSubmission,
  BugReportFilters,
  ResolutionStatus,
} from '@/features/bug-reports/types/bugReport.types';
```

## Configuration

### Environment Variables

- `NEXT_PUBLIC_BUG_REPORT_ENABLED`: Set to `'false'` to hide the bug report widget (default: enabled)

### API Endpoints

The feature uses the following API endpoints:

- `POST /api/v1/bug-reports` - Submit a bug report
- `GET /api/v1/admin/bug-reports` - List all bug reports (admin only)
- `GET /api/v1/admin/bug-reports/:id` - Get bug report details (admin only)
- `PATCH /api/v1/admin/bug-reports/:id/status` - Update resolution status (admin only)
- `GET /api/v1/bug-reports/screenshots/:screenshotId` - Download screenshot

## Validation Rules

### Bug Description
- Minimum: 10 characters
- Maximum: 2000 characters
- Required field

### Screenshots
- Maximum: 5 files per report
- Maximum file size: 5MB per file
- Accepted formats: PNG, JPEG, JPG, GIF, WebP

## Responsive Design

The feature is fully responsive and works on:
- Desktop (1920x1080+)
- Laptop (1366x768+)
- Tablet landscape (1024x768+)

## Accessibility

- Keyboard navigation support (Tab, Enter, Escape)
- ARIA labels and attributes
- Screen reader friendly
- Focus management in modals

## Integration

The bug report widget is integrated into the `AuthenticatedLayout` component and appears on all authenticated pages automatically.

Admin navigation includes a "Bug Reports" link in the Administration section.

## Testing

To test the feature:

1. **User Flow**:
   - Log in as any user
   - Click the bug icon in the bottom-right corner
   - Fill out the form and submit
   - Verify success message

2. **Admin Flow**:
   - Log in as an admin
   - Navigate to Administration > Bug Reports
   - View, filter, search, and manage reports
   - Click on a report to view details
   - Mark reports as resolved/unresolved

## Future Enhancements

Potential improvements for future versions:
- Email notifications for users when reports are resolved
- Bug report comments/notes
- Priority levels
- Bug categories
- Duplicate detection
- Export functionality
- Analytics dashboard
