# DSW Module Setup Guide

## Quick Start

### 1. Database Migration

Run the Prisma migration to create DSW tables:

```powershell
cd backend
npx prisma migrate dev --name add_dsw_module
```

This will create:
- `club` table
- `club_category` table
- `club_member` table
- `club_change_request` table
- `club_audit_log` table
- All necessary enums
- Indexes for performance

### 2. Seed Default Categories

#### Option A: Via API (Recommended)
```powershell
# Start the server
cd backend
npm run dev

# Then call the seed endpoint (requires admin authentication)
POST http://localhost:5000/api/dsw/categories/seed/default
Authorization: Bearer <admin-token>
```

#### Option B: Via Prisma Script
Add to `backend/prisma/seed.js`:

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedDSWCategories() {
  const categories = [
    { name: 'Cultural', description: 'Arts, music, dance, theater, and cultural activities', sortOrder: 1 },
    { name: 'Technical', description: 'Technology, programming, robotics, and technical innovation', sortOrder: 2 },
    { name: 'Sports', description: 'Athletics, fitness, and sports-related clubs', sortOrder: 3 },
    { name: 'Literary', description: 'Writing, reading, debate, and literary activities', sortOrder: 4 },
    { name: 'Social Service', description: 'Community service, volunteering, and social awareness', sortOrder: 5 },
    { name: 'Innovation/Research', description: 'Research projects, innovation labs, and entrepreneurship', sortOrder: 6 },
    { name: 'Academic', description: 'Subject-specific academic clubs and learning groups', sortOrder: 7 },
    { name: 'Environment', description: 'Environmental awareness, sustainability, and green initiatives', sortOrder: 8 },
    { name: 'Photography & Media', description: 'Photography, videography, and media production', sortOrder: 9 },
  ];

  for (const cat of categories) {
    await prisma.clubCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  console.log('✓ DSW categories seeded');
}

// Add to main seed function
async function main() {
  // ... existing seed code
  await seedDSWCategories();
}
```

Then run:
```powershell
npx prisma db seed
```

### 3. Register DSW Routes in Main Server

Add to `backend/src/server.js`:

```javascript
const dswModule = require('./modules/dsw');

// After authentication middleware
app.use('/api/dsw', dswModule.routes);
```

### 4. Update Noting Approval Handler

Add DSW noting processing to your Noting approval handler:

```javascript
// In backend/src/modules/noting/services/notingService.js
// or wherever noting approval is handled

const dswModule = require('../../dsw');

async function handleNotingApproval(notingId, approvedById) {
  const noting = await prisma.note.findUnique({
    where: { id: notingId },
  });

  // Check if this is a DSW noting
  if (noting.category === 'administrative' && 
      noting.subcategory === 'DSW' &&
      noting.metadata?.dswModule === 'club_creation') {
    
    // Process club creation
    const club = await dswModule.services.notingIntegration.processApprovedClubCreationNoting(
      noting,
      approvedById
    );

    console.log('✓ Club created from noting:', club.name);
  }

  // ... rest of approval logic
}
```

### 5. Frontend Integration

Add DSW routes to your frontend router:

```javascript
// In frontend/src/app/(dashboard)/dsw/layout.tsx or similar
import DSWLayout from '@/features/dsw/layouts/DSWLayout';

export default function DSWLayoutRoute({ children }) {
  return <DSWLayout>{children}</DSWLayout>;
}
```

### 6. Verify Installation

#### Test Backend Health Check
```bash
curl http://localhost:5000/api/dsw/health
```

Expected response:
```json
{
  "success": true,
  "message": "DSW module is operational",
  "timestamp": "2026-02-09T..."
}
```

#### Test Categories
```bash
curl http://localhost:5000/api/dsw/categories \
  -H "Authorization: Bearer <token>"
```

Should return the seeded categories.

## Configuration

### Environment Variables

No additional environment variables required for basic DSW operation.

### Noting Configuration

Ensure your Noting system configuration includes DSW subcategories:

```javascript
// In noting configuration
const NOTING_CATEGORIES = {
  administrative: {
    subcategories: {
      DSW: {
        description: 'Dean of Students\' Welfare',
        allowedRoles: ['faculty', 'admin', 'superadmin'],
        fields: ['Club Creation', 'Club Change Request'],
      },
      // ... other subcategories
    },
  },
  // ... other categories
};
```

## Testing the Complete Flow

### 1. Create a Test Club

```bash
# As a faculty user
POST /api/dsw/noting/club-creation
{
  "name": "Tech Innovation Club",
  "categoryId": "<technical-category-id>",
  "purpose": "To foster innovation and technical skills among students through hackathons, workshops, and collaborative projects focusing on emerging technologies.",
  "academicSession": "2025-2026",
  "viceChairpersonId": "<student-user-id>",
  "targetStudentGroup": "all",
  "expectedActivityTypes": ["Workshops", "Competitions", "Collaborations"],
  "codeOfConductAccepted": true,
  "antiDiscriminationAccepted": true,
  "meetingFrequency": "monthly",
  "estimatedAnnualActivityCount": 12,
  "infrastructureRequirements": ["Lab", "Auditorium"],
  "fundingRequired": true,
  "estimatedFundingAmount": 50000,
  "visibility": "public",
  "allowInternalCollaboration": true,
  "allowExternalCollaboration": false
}
```

### 2. Approve the Noting

Use your existing noting approval flow to approve the created noting.

### 3. Verify Club Creation

```bash
GET /api/dsw/clubs?search=Tech%20Innovation
```

The club should now appear in the response with status "active".

### 4. Add a Member

```bash
POST /api/dsw/clubs/<club-id>/members
{
  "studentId": "<student-user-id>"
}
```

### 5. Check Audit Logs

```bash
GET /api/dsw/clubs/<club-id>/audit-logs
```

Should show:
- club_created
- club_approved
- member_added

## Troubleshooting

### Issue: Categories not showing

**Solution**: Run the seed script or manually create categories via admin API.

### Issue: 403 Forbidden when creating club noting

**Solution**: Ensure the user has role `faculty` in the database.

### Issue: Club not created after noting approval

**Solution**: 
1. Check if approval handler calls DSW integration
2. Check noting metadata contains all required fields
3. Check server logs for errors

### Issue: Cannot add members

**Solution**:
1. Verify club status is "active"
2. Verify requesting user is Vice Chairperson or Faculty Facilitator
3. Verify member has role "student"

## Performance Optimization

### Database Indexes

Already included in migration:
- `club.status`
- `club.lifecycleState`
- `club.categoryId`
- `club.facultyFacilitatorId`
- `club.viceChairpersonId`
- `club_member.clubId`
- `club_member.studentId`
- `club_audit_log.clubId`
- `club_audit_log.action`

### Recommended Caching

If using Redis or similar:
```javascript
// Cache categories (they rarely change)
const categories = await cache.get('dsw:categories', async () => {
  return await categoryService.getAllCategories();
}, { ttl: 3600 }); // 1 hour
```

## Security Checklist

- ✓ All routes protected with authentication
- ✓ RBAC enforced at controller level
- ✓ Input validation on all endpoints
- ✓ SQL injection protection (Prisma ORM)
- ✓ XSS protection (input sanitization)
- ✓ Audit logging for all mutations
- ✓ No direct database modification outside Noting

## Monitoring

### Key Metrics to Track

1. **Club Creation Rate**: Clubs created per month
2. **Approval Duration**: Time from noting submission to approval
3. **Member Activity**: Members added/removed per club
4. **Permission Violations**: 403 errors (indicates attempted unauthorized access)
5. **API Response Times**: Monitor club listing and detail endpoints

### Sample Monitoring Query
```sql
-- Clubs created in last 30 days
SELECT COUNT(*) as clubs_created
FROM club
WHERE approved_at > NOW() - INTERVAL '30 days';

-- Most active clubs (by member additions)
SELECT c.name, COUNT(cm.id) as member_count
FROM club c
LEFT JOIN club_member cm ON c.id = cm.club_id
WHERE cm.is_active = true
GROUP BY c.id, c.name
ORDER BY member_count DESC
LIMIT 10;

-- Audit log summary
SELECT action, COUNT(*) as count
FROM club_audit_log
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY action
ORDER BY count DESC;
```

## Next Steps

1. **Create Frontend UI** (see frontend setup guide)
2. **Configure Noting Hierarchy** for DSW approvals
3. **Train Users** on club creation process
4. **Set up Monitoring** dashboards
5. **Plan Events Integration** (future enhancement)

---

**Setup Complete!** 🎉

The DSW module is now ready for use. Faculty can create club notings, and upon approval, clubs will be automatically created and activated.
