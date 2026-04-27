# Bug Report Validators

This module provides comprehensive validation for bug report endpoints, including file upload validation for screenshots.

## Overview

The validators module exports validation middleware and utility functions for:
- Bug report submission validation
- Screenshot file validation (type, size, count)
- Resolution status validation
- Admin dashboard query parameter validation

## Exported Functions

### Validation Middleware

#### `validateBugReportSubmission`
Validates bug report submission data using express-validator.

**Validates:**
- `description`: 10-2000 characters (required)
- `pageUrl`: 1-2048 characters (required)
- `routePath`: 1-512 characters (required)
- `userIdentifier`: 1-64 characters (required)
- `userRole`: 1-32 characters (required)
- `userEmail`: Valid email format, max 255 characters (optional)

**Usage:**
```javascript
router.post('/api/bug-reports',
  authenticate,
  validateBugReportSubmission,
  checkValidationResult,
  bugReportController.create
);
```

#### `validateScreenshots`
Validates uploaded screenshot files after multer processes them.

**Validates:**
- File count: Maximum 5 files
- File size: Maximum 5MB per file
- File type: image/png, image/jpeg, image/jpg, image/gif, image/webp

**Usage:**
```javascript
const upload = multer({ dest: 'uploads/' });

router.post('/api/bug-reports',
  authenticate,
  upload.array('screenshots', 5),
  validateBugReportSubmission,
  validateScreenshots,  // Must come after multer
  checkValidationResult,
  bugReportController.create
);
```

#### `validateResolutionStatusUpdate`
Validates resolution status update requests.

**Validates:**
- `id` (param): Valid UUID
- `status` (body): Must be 'resolved' or 'unresolved'

**Usage:**
```javascript
router.patch('/api/admin/bug-reports/:id/status',
  authenticate,
  requireAdmin,
  validateResolutionStatusUpdate,
  checkValidationResult,
  adminController.updateStatus
);
```

#### `validateBugReportId`
Validates bug report ID parameter.

**Validates:**
- `id` (param): Valid UUID

**Usage:**
```javascript
router.get('/api/bug-reports/:id',
  authenticate,
  validateBugReportId,
  checkValidationResult,
  bugReportController.getById
);
```

#### `validateScreenshotId`
Validates screenshot ID parameter.

**Validates:**
- `screenshotId` (param): Valid UUID

**Usage:**
```javascript
router.get('/api/bug-reports/screenshots/:screenshotId',
  authenticate,
  validateScreenshotId,
  checkValidationResult,
  bugReportController.getScreenshot
);
```

#### `validateBugReportListing`
Validates admin dashboard query parameters.

**Validates:**
- `status`: 'all', 'resolved', or 'unresolved' (optional)
- `search`: Max 255 characters (optional)
- `sortBy`: 'createdAt', 'resolutionStatus', or 'userRole' (optional)
- `order`: 'asc' or 'desc' (optional)
- `page`: Positive integer (optional)
- `limit`: 1-100 (optional)

**Usage:**
```javascript
router.get('/api/admin/bug-reports',
  authenticate,
  requireAdmin,
  validateBugReportListing,
  checkValidationResult,
  adminController.list
);
```

#### `checkValidationResult`
Middleware that checks validation results and returns errors if any.

**Usage:**
Always use after validation middleware:
```javascript
router.post('/api/bug-reports',
  validateBugReportSubmission,
  checkValidationResult,  // Checks results from previous validators
  controller.create
);
```

### Utility Functions

#### `isValidScreenshotType(mimetype)`
Checks if a MIME type is allowed for screenshots.

**Parameters:**
- `mimetype` (string): MIME type to validate

**Returns:** `boolean`

**Example:**
```javascript
const { isValidScreenshotType } = require('./validators/bugReport.validators');

if (isValidScreenshotType(file.mimetype)) {
  // Process file
}
```

#### `isValidScreenshotSize(fileSize)`
Checks if a file size is within the allowed limit.

**Parameters:**
- `fileSize` (number): File size in bytes

**Returns:** `boolean`

**Example:**
```javascript
const { isValidScreenshotSize } = require('./validators/bugReport.validators');

if (isValidScreenshotSize(file.size)) {
  // Process file
}
```

#### `isValidScreenshotCount(count)`
Checks if the screenshot count is within allowed limits.

**Parameters:**
- `count` (number): Number of screenshots

**Returns:** `boolean`

**Example:**
```javascript
const { isValidScreenshotCount } = require('./validators/bugReport.validators');

if (isValidScreenshotCount(files.length)) {
  // Process files
}
```

## Exported Constants

### `MAX_FILE_SIZE`
Maximum file size for screenshots: `5 * 1024 * 1024` (5MB)

### `MAX_SCREENSHOT_COUNT`
Maximum number of screenshots per bug report: `5`

### `ALLOWED_MIME_TYPES`
Array of allowed MIME types:
```javascript
[
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
]
```

## Error Response Format

All validation errors return a 400 status code with the following format:

```json
{
  "error": "Validation Error",
  "details": [
    {
      "field": "description",
      "message": "Description must be between 10 and 2000 characters"
    }
  ]
}
```

### Screenshot Validation Errors

**File count exceeded:**
```json
{
  "error": "Validation Error",
  "details": [
    {
      "field": "screenshots",
      "message": "Maximum 5 screenshots allowed. You uploaded 6 files."
    }
  ]
}
```

**File size exceeded:**
```json
{
  "error": "Validation Error",
  "details": [
    {
      "field": "screenshots[0]",
      "message": "File \"large-image.png\" exceeds maximum size of 5MB. File size: 6.50MB"
    }
  ]
}
```

**Invalid file type:**
```json
{
  "error": "Validation Error",
  "details": [
    {
      "field": "screenshots[0]",
      "message": "File \"document.pdf\" has invalid type \"application/pdf\". Allowed types: PNG, JPEG, JPG, GIF, WebP"
    }
  ]
}
```

## Complete Route Example

Here's a complete example of setting up a bug report submission route with all validations:

```javascript
const express = require('express');
const multer = require('multer');
const { authenticate } = require('../../middleware/auth');
const bugReportController = require('../controllers/bugReport.controller');
const {
  validateBugReportSubmission,
  validateScreenshots,
  checkValidationResult,
  MAX_SCREENSHOT_COUNT,
} = require('../validators/bugReport.validators');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/bug-reports/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Bug report submission with screenshots
router.post(
  '/api/bug-reports',
  authenticate,
  upload.array('screenshots', MAX_SCREENSHOT_COUNT),
  validateBugReportSubmission,
  validateScreenshots,
  checkValidationResult,
  bugReportController.create
);

module.exports = router;
```

## Testing

Run the validator tests:

```bash
npm test -- bugReport.validators.test.js
```

All validators have comprehensive unit tests covering:
- Valid inputs
- Invalid inputs
- Edge cases
- Multiple validation errors
- All allowed file types

## Requirements Mapping

This implementation satisfies the following requirements from the Bug Report System specification:

- **Requirement 4.2-4.3**: Description length validation (10-2000 characters)
- **Requirement 7.1-7.5**: Form validation and error handling
- **Requirement 14.2-14.7**: Screenshot file validation (type, size, count)
- **Requirement 31.1**: Resolution status validation ('resolved' or 'unresolved')
