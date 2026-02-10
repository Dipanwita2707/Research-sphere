# DSW (Dean of Students' Welfare) System

## Overview

The DSW module provides complete club lifecycle management for university student welfare, with strict governance through the Noting system. Every club must be created, approved, and modified through official Noting channels, ensuring complete auditability and compliance.

## Core Principles

1. **Noting System as Single Source of Truth**: No club can exist without Noting approval
2. **Immutability**: Core club data cannot be changed after approval without new Noting
3. **Role-Based Access Control**: Strict permissions at backend level
4. **Complete Audit Trail**: Every action is logged
5. **Backend Enforcement**: All business rules enforced server-side

## Architecture

### Database Schema

#### Club
- **Immutable Fields** (require Noting for changes):
  - name, categoryId, purpose, academicSession
  - facultyFacilitatorId, viceChairpersonId
  - targetStudentGroup, expectedActivityTypes
  - Governance and operational parameters
  
- **Editable Fields** (can change without Noting):
  - proposedEmail, socialMediaHandles
  - expectedStudentStrength, metadata

#### ClubMember
- Tracks all students in clubs
- Supports soft deletion with removal tracking
- Maintains full history of additions/removals

#### ClubCategory
- System-seeded categories (Cultural, Technical, Sports, etc.)
- Admin-manageable

#### ClubAuditLog
- Comprehensive logging of all club actions
- Tracks performer, timestamp, state changes
- Source tracking (noting/dsw_ui/api)

#### ClubChangeRequest
- Tracks requests to change immutable fields
- Links to Noting approval flow
- Records approval/rejection with reasons

## Workflow

### Club Creation Flow

```
Faculty Facilitator
    ↓
Create Club Creation Noting
    ↓
Submit with complete form data
    ↓
Noting Approval Hierarchy
    ↓
On Final Approval → Club Entity Created Automatically
    ↓
Club Status = Active
    ↓
Appears in DSW Dashboard
```

### Member Management Flow

```
Vice Chairperson / Faculty Facilitator
    ↓
Add/Remove Member (Direct Action)
    ↓
Backend Validation (role check, club status)
    ↓
Update ClubMember Table
    ↓
Create Audit Log
```

### Club Modification Flow (Immutable Fields)

```
Faculty Facilitator
    ↓
Create Club Change Request Noting
    ↓
Specify change type and justification
    ↓
Noting Approval Hierarchy
    ↓
On Approval → Changes Applied
    ↓
Create Audit Log
```

## API Endpoints

### Clubs

#### GET `/api/dsw/clubs`
Get all clubs with filtering, pagination, and search
- Query Parameters: `page`, `limit`, `status`, `categoryId`, `search`, `academicSession`, `myClubs`
- Authorization: Any authenticated user

#### GET `/api/dsw/clubs/:clubId`
Get club details by ID
- Authorization: Any authenticated user
- Returns: Full club details with members, facilitator, vice chairperson

#### GET `/api/dsw/clubs/my`
Get clubs where user is facilitator, vice chairperson, or member
- Authorization: Authenticated user

#### POST `/api/dsw/clubs/:clubId/members`
Add a member to the club
- Body: `{ studentId: UUID }`
- Authorization: Vice Chairperson or Faculty Facilitator
- Validation: Student role, no duplicates, club is active

#### DELETE `/api/dsw/clubs/:clubId/members/:memberId`
Remove a member from the club
- Body: `{ reason?: string }`
- Authorization: Vice Chairperson or Faculty Facilitator

#### PATCH `/api/dsw/clubs/:clubId`
Update editable fields only
- Body: Editable fields (email, social media, etc.)
- Authorization: Faculty Facilitator or Vice Chairperson
- Validation: Immutable fields rejected

### Noting Integration

#### POST `/api/dsw/noting/club-creation`
Create a Club Creation Noting (Multi-step form)
- Authorization: Faculty only
- Validation: Full form validation (see Club Creation Form section)
- Returns: Created noting object
- Note: Club entity NOT created until noting is approved

#### POST `/api/dsw/noting/club-change/:clubId`
Create a Club Change Request Noting
- Authorization: Faculty Facilitator of the club
- Body: `{ changeType, requestedChanges, justification }`
- Returns: Created noting and change request

#### POST `/api/dsw/noting/process-approval`
Process approved noting (Internal/Webhook)
- Called by Noting system when DSW noting is approved
- Automatically creates club or applies changes

### Categories

#### GET `/api/dsw/categories`
Get all categories
- Query: `activeOnly=true` (default)
- Authorization: Any authenticated user

#### POST `/api/dsw/categories`
Create new category
- Authorization: Admin only
- Body: `{ name, description?, sortOrder? }`

#### PATCH `/api/dsw/categories/:categoryId`
Update category
- Authorization: Admin only

#### DELETE `/api/dsw/categories/:categoryId`
Deactivate category (soft delete)
- Authorization: Admin only
- Validation: No active clubs using it

#### POST `/api/dsw/categories/seed/default`
Seed default categories
- Authorization: Admin only
- Idempotent operation

### Audit Logs

#### GET `/api/dsw/clubs/:clubId/audit-logs`
Get audit logs for a specific club
- Authorization: Admin only
- Query: `limit`, `offset`, `action`, `startDate`, `endDate`

#### GET `/api/dsw/audit-logs/action/:action`
Get audit logs by action type
- Authorization: Admin only

#### GET `/api/dsw/audit-logs/my`
Get current user's audit logs
- Authorization: Authenticated user

### Statistics

#### GET `/api/dsw/statistics`
Get DSW system statistics
- Returns: Total clubs, active clubs, members, clubs by category, clubs by session
- Authorization: Any authenticated user

## Club Creation Form (Step-by-Step)

### Step 1: Core Club Identity (Immutable)
```json
{
  "name": "String (3-256 chars, unique)",
  "categoryId": "UUID (from categories)",
  "purpose": "String (min 50 chars)",
  "academicSession": "String (format: YYYY-YYYY, e.g., 2025-2026)"
}
```

### Step 2: Authority & Membership Setup
```json
{
  "viceChairpersonId": "UUID (must be student)",
  "initialMembers": ["UUID", "UUID", ...] // Optional
}
```
**Note**: Faculty Facilitator is automatically the noting creator

### Step 3: Governance & Compliance
```json
{
  "targetStudentGroup": "all | ug | pg | phd",
  "expectedActivityTypes": ["Events", "Workshops", ...],
  "codeOfConductAccepted": true, // Required
  "antiDiscriminationAccepted": true // Required
}
```

### Step 4: Operational Planning
```json
{
  "meetingFrequency": "weekly | monthly | event_based",
  "estimatedAnnualActivityCount": 1-100,
  "infrastructureRequirements": ["Auditorium", "Lab", ...],
  "fundingRequired": boolean,
  "estimatedFundingAmount": number // Required if fundingRequired=true
}
```

### Step 5: Visibility & Collaboration
```json
{
  "visibility": "public | restricted",
  "allowInternalCollaboration": boolean (default: true),
  "allowExternalCollaboration": boolean (default: false)
}
```

### Step 6: Optional Metadata
```json
{
  "proposedEmail": "email@domain.com",
  "socialMediaHandles": {
    "instagram": "@clubname",
    "twitter": "@clubname",
    "linkedin": "linkedin.com/company/clubname"
  },
  "expectedStudentStrength": number
}
```

## Role-Based Access Control (RBAC)

### Roles
- **Student**: View clubs, join as member
- **Vice Chairperson**: Add/remove members of their club
- **Faculty Facilitator**: Add/remove members, request changes
- **Admin/SuperAdmin**: Full access, view audit logs, manage categories

### Permission Matrix

| Action | Student | Vice Chair | Faculty Facilitator | Admin |
|--------|---------|------------|---------------------|-------|
| View clubs | ✓ | ✓ | ✓ | ✓ |
| Create club noting | ✗ | ✗ | ✓ | ✓ |
| Add/remove members | ✗ | ✓ (own club) | ✓ (own club) | ✓ |
| Request club changes | ✗ | ✗ | ✓ (own club) | ✓ |
| View audit logs | ✗ | ✗ | ✗ | ✓ |
| Manage categories | ✗ | ✗ | ✗ | ✓ |

## Audit Actions

All these actions are automatically logged:
- `club_created`: Club entity created from noting
- `club_approved`: Noting approved
- `club_activated`: Club status changed to active
- `club_suspended`: Club suspended
- `member_added`: Student added to club
- `member_removed`: Student removed from club
- `change_requested`: Change request noting created
- `change_approved`: Change request approved
- `change_rejected`: Change request rejected
- `field_updated`: Editable field updated

## Error Handling

### Common Error Codes
- `400`: Validation error, bad request
- `401`: Authentication required
- `403`: Unauthorized (insufficient permissions)
- `404`: Resource not found
- `409`: Conflict (duplicate name, etc.)
- `500`: Internal server error

### Error Response Format
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error (development only)",
  "details": "Additional context"
}
```

## Integration with Noting System

### Noting Categories
- Category: `administrative`
- Subcategory: `DSW`
- Sub-subcategory: `Club Creation` or `Club Change`

### Noting Flow Integration

1. **DSW creates noting** with all club data in `metadata` field
2. **Noting system processes** through approval hierarchy
3. **On final approval**, Noting system calls:
   ```
   POST /api/dsw/noting/process-approval
   { notingId, approvedById }
   ```
4. **DSW processes** the approval and creates/updates club
5. **Noting updated** with club reference

### Noting Metadata Structure
```json
{
  "dswModule": "club_creation | club_change_request",
  "clubId": "UUID (for changes)",
  "clubName": "String",
  "submittedAt": "ISO datetime",
  // ... all form fields
}
```

## Database Setup

### Run Migration
```bash
cd backend
npx prisma migrate dev --name add_dsw_module
```

### Seed Categories
```bash
# Via API (requires admin auth)
POST /api/dsw/categories/seed/default

# Or via Prisma seed script
npx prisma db seed
```

## Testing

### Manual Testing Checklist

1. **Seed Categories**
   - Admin creates/seeds categories
   - Verify categories appear

2. **Club Creation**
   - Faculty logs in
   - Creates noting with club data
   - Submits for approval
   - Approver approves noting
   - Verify club appears in DSW dashboard
   - Verify club status is "active"

3. **Member Management**
   - Vice Chairperson adds member
   - Verify member appears
   - Faculty Facilitator removes member
   - Verify member marked inactive

4. **Permissions**
   - Student tries to add member → 403 Forbidden
   - Student tries to create noting → 403 Forbidden
   - Admin views audit logs → Success

5. **Immutability**
   - Try to update club name directly → Rejected
   - Update proposedEmail → Success
   - Create change request noting → Success

6. **Audit Logs**
   - Admin checks club audit logs
   - Verify all actions logged with correct details

## Security Considerations

1. **Backend Enforcement**: All permissions checked server-side
2. **No Direct DB Access**: Club creation only via Noting approval
3. **Audit Trail**: All actions logged with actor and timestamp
4. **Input Validation**: Comprehensive validation on all inputs
5. **Role Verification**: User roles verified from database, not from request

## Scalability

- **Pagination**: All list endpoints support pagination
- **Indexes**: Database indexes on frequently queried fields
- **Soft Deletes**: Members soft-deleted for data integrity
- **Caching Ready**: Static data (categories) can be cached

## Maintenance

### Regular Tasks
- Review audit logs periodically
- Archive old clubs (future feature)
- Clean up inactive members
- Update categories as needed

### Monitoring
- Track noting approval times
- Monitor club creation rate
- Alert on permission violations
- Track member churn rates

## Future Enhancements

1. **Club Events Module**: Link clubs to Event Management
2. **Club Budgets**: Track and approve club expenditures
3. **Club Elections**: Vice Chairperson election system
4. **Club Performance**: Metrics and reporting
5. **Club Collaboration**: Inter-club event coordination
6. **Club Archive**: Historical club data management

## Support

For issues or questions:
- Check audit logs for action history
- Review error messages for validation issues
- Contact system administrator for permission issues
- Refer to Noting module documentation for approval flows

---

**Version**: 1.0.0  
**Last Updated**: February 2026  
**Module Status**: Production Ready
