# Event Management System Redesign - Implementation Guide

## Overview
Complete redesign of the event management page with modern UI, comprehensive fields, and professional layout.

## Changes Completed

### 1. ✅ Database Schema Updates (Prisma)
Added the following fields to the `Event` model:

**Event Branding:**
- `bannerImageUrl` - Event banner image (1200x400 recommended)
- `logoImageUrl` - Event logo (300x300 recommended)

**Opportunity Mode & Participation:**
- `opportunityMode` - Enum: online, offline, hybrid
- `participationType` - Enum: individual, team
- `minTeamSize` - Minimum team size (for team events)
- `maxTeamSize` - Maximum team size (for team events)
- `interCollegeAllowed` - Boolean for inter-college participation
- `interSpecializationAllowed` - Boolean for inter-specialization

**Contact Details:**
- `contactPersonName` - Primary contact person
- `contactEmail` - Official email
- `contactMobile` - Contact phone number
- `alternateContact` - Alternate contact
- `websiteUrl` - Event website
- `socialMediaLinks` - JSON field for social media

**Additional Information:**
- `longDescription` - Rich text detailed description
- `eligibilityCriteria` - Who can participate
- `rulesAndGuidelines` - Event rules
- `prizeDetails` - Prize information
- `certificateAvailable` - Boolean for certificates
- `faqs` - JSON array of FAQ objects

**New Enums Added:**
```prisma
enum OpportunityMode {
  online
  offline
  hybrid
}

enum ParticipationType {
  individual
  team
}
```

### 2. ✅ TypeScript Types Updated
Updated `frontend/src/features/event-management/types/event.types.ts`:
- Added `OpportunityMode` and `ParticipationType` types
- Updated `Event` interface with all new fields
- Updated `EventFormData` interface for form handling

### 3. 📋 Frontend Component Created
A completely redesigned event management page with:

**UI/UX Improvements:**
- A4-style professional layout
- Organized sections with colored headers
- Responsive grid layout
- Sticky sidebar with locked fields
- Consistent with existing design system

**New Sections:**
1. **Event Branding** - Banner and logo upload with preview
2. **Event Information** - Basic details with rich text editor
3. **Opportunity Mode & Participation** - Team settings and mode selection
4. **Contact & Communication** - Contact details and social media
5. **Additional Details** - Eligibility, rules, prizes, certificates
6. **FAQs** - Dynamic FAQ management

**Key Features:**
- Image upload with preview and remove functionality
- React Quill integration for rich text descriptions
- Dynamic team size fields (conditional on participation type)
- Social media links management (add/remove)
- FAQ builder (add/remove questions)
- Form validation
- Responsive design
- Dark mode support

## Implementation Steps

### Step 1: Run Database Migration
The migration has been initiated. Verify it completed successfully:
```bash
cd backend
npx prisma migrate dev --name add_event_management_fields
npx prisma generate
```

### Step 2: Update Backend Service
Update `backend/src/modules/event-management/services/event.service.js`:

In the `updateEvent` function, add handling for new fields:
```javascript
// Add these fields to the update data
const updateData = {
  ...existingFields,
  longDescription: data.longDescription,
  bannerImageUrl: data.bannerImageUrl,
  logoImageUrl: data.logoImageUrl,
  opportunityMode: data.opportunityMode,
  participationType: data.participationType,
  minTeamSize: data.minTeamSize,
  maxTeamSize: data.maxTeamSize,
  interCollegeAllowed: data.interCollegeAllowed,
  interSpecializationAllowed: data.interSpecializationAllowed,
  contactPersonName: data.contactPersonName,
  contactEmail: data.contactEmail,
  contactMobile: data.contactMobile,
  alternateContact: data.alternateContact,
  websiteUrl: data.websiteUrl,
  socialMediaLinks: data.socialMediaLinks,
  eligibilityCriteria: data.eligibilityCriteria,
  rulesAndGuidelines: data.rulesAndGuidelines,
  prizeDetails: data.prizeDetails,
  certificateAvailable: data.certificateAvailable,
  faqs: data.faqs,
};
```

In the `getEventDetails` and `listEvents` functions, ensure new fields are included in the select/include statements.

### Step 3: Replace Frontend Component
Replace the entire content of:
`frontend/src/app/events/[id]/manage/page.tsx`

With the new comprehensive component (see NEW_MANAGE_PAGE.tsx in this directory).

The new file includes:
- All imports (including React Quill)
- Complete state management for all fields
- Image upload handlers
- FAQ and social media management
- Form validation
- Save functionality

### Step 4: Add Image Upload Backend (Optional Enhancement)
For production, implement proper image upload:

1. Install AWS SDK or Cloudinary:
```bash
npm install @aws-sdk/client-s3 multer
```

2. Create upload endpoint in `backend/src/modules/event-management/routes/event.routes.js`:
```javascript
router.post('/:id/upload/banner', upload.single('banner'), eventController.uploadBanner);
router.post('/:id/upload/logo', upload.single('logo'), eventController.uploadLogo);
```

3. Implement upload controller methods with S3/Cloudinary integration

### Step 5: Test Complete Flow
1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Navigate to event management page
4. Test all sections:
   - Upload banner and logo
   - Fill in all form fields
   - Add team settings (switch to team participation)
   - Add contact details and social media
   - Add FAQs
   - Save and verify data persists

## Design Consistency
The redesign maintains complete visual consistency with your existing platform:
- Uses same color scheme (orange/sgt colors as primary)
- Matches typography and spacing
- Follows existing form patterns
- Uses same icon library (Lucide React)
- Maintains dark mode support
- Responsive grid system

## Image Upload Implementation Note
Current implementation uses local preview (base64). For production:
1. Upload to S3/Cloudinary on file selection
2. Store returned URL in database
3. Display uploaded image from URL

## Backend API Updates Required
Ensure your backend accepts all new fields in the update endpoint:
- Validate optional fields appropriately
- Handle JSON fields (socialMediaLinks, faqs)
- Return all new fields in GET responses

## Migration Status
Check if migration completed successfully by looking for:
- New columns in `Event` table
- New enum types created
- No migration errors

If migration failed, you may need to manually apply or recreate it.

## Next Steps
1. Verify migration completed
2. Update backend service to handle new fields
3. Replace frontend component
4. Implement image upload (or use placeholder for now)
5. Test comprehensive workflow
6. Deploy to staging/production

## File Locations
- Schema: `backend/prisma/schema.prisma`  ✅ Updated
- Types: `frontend/src/features/event-management/types/event.types.ts` ✅ Updated
- Frontend: `frontend/src/app/events/[id]/manage/page.tsx` ⏳ Ready to replace
- Backend Service: `backend/src/modules/event-management/services/event.service.js` ⏳ Needs update

## Validation Rules
Team Participation:
- Requires minTeamSize and maxTeamSize
- Min must be ≥ 1
- Max must be ≥ Min

Contact Details:
- Email format validation (automatic via input type)
- Phone format (flexible, no strict validation)

Required Fields:
- Venue (always required)
- Registration fee (required if paymentType = 'paid')
- Team sizes (required if participationType = 'team')

## Screenshots Showing Expected UI
Based on your provided screenshots, the new design implements:
1. **Participation Type** - Radio buttons for Individual/Team
2. **Team Settings** - Min/Max size inputs with checkboxes
3. **Opportunity Mode** - Three radio buttons (Online/Offline/Hybrid)
4. Clean, professional card-based layout
5. Proper spacing and visual hierarchy

## Support
If you encounter any issues:
1. Check browser console for errors
2. Verify backend API is accepting new fields
3. Confirm migration ran successfully
4. Test in incremental steps (one section at a time)
