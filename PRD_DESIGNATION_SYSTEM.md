# Product Requirements Document (PRD)
## Dynamic Designation & Hierarchy System

**Version:** 1.0  
**Created:** February 1, 2026  
**Status:** Draft for Review  

---

## 🎯 Executive Summary

This PRD outlines the design and implementation of a **flexible designation and hierarchy system** for the University Management System. The system separates **Roles** (login access) from **Designations** (authority/responsibility), introduces **dynamic hierarchy levels**, and provides **configurable relationships** between designations.

---

## 🚨 Critical Analysis of Current System

### What's Wrong Today?

#### 1. **Hardcoded Authority Relationships**
```prisma
// Current schema - PROBLEM!
model Department {
  headOfDepartmentId  String?   @map("head_of_department")
  headOfDepartment    UserLogin? @relation("HeadOfDepartment")
}

model FacultySchoolList {
  headOfFacultyId  String?    @map("head_of_faculty")
  headOfFaculty    UserLogin? @relation("HeadOfFaculty")
}
```
**Problem:** HOD, Dean, Head of Faculty are hardcoded as foreign keys. You can't add "Associate Dean" or "Deputy HOD" without schema changes.

#### 2. **Role Confusion**
- `role = faculty` in UserLogin - is this access control or job title?
- A Dean is still marked as `role = faculty` - this doesn't make sense
- Students who become class representatives have no way to reflect that authority

#### 3. **No Relationship Logic**
- Current system has `mentorUid` in `IprApplicantDetails`
- But there's no validation: Can a student mentor another student? No checks exist!

#### 4. **Inflexible Hierarchy**
- Currently: Dean → HOD → Faculty (hardcoded in code logic)
- Tomorrow: Add "Associate Dean" - requires code changes everywhere

---

## ✅ Proposed Solution

### Core Concepts

#### 1. **Role vs Designation - Clear Separation**

| **Role** | **Purpose** | **Examples** |
|----------|-------------|--------------|
| Login access & system permissions | Defines what you can access in the system | superadmin, admin, faculty, student, staff, parent |

| **Designation** | **Purpose** | **Examples** |
|-----------------|-------------|--------------|
| Authority & responsibility in university structure | Defines your position/authority | Dean, HOD, Mentor, Class Rep, Proctor |

**Key Rule:** One user, one role, multiple designations.

**Example:**
```
Dr. Sharma:
  - Role: faculty (login as faculty member)
  - Designations: [Dean, Professor, Mentor]
```

---

### 2. **Dynamic Designation System**

No hardcoding. Everything stored in database tables.

#### New Database Models

```prisma
// 1. Master table for all designations
model Designation {
  id               String   @id @default(uuid())
  code             String   @unique  // e.g., "DEAN", "HOD", "MENTOR"
  name             String              // e.g., "Dean", "Head of Department"
  description      String?
  hierarchyLevel   Int                 // 1 = highest, 10 = lowest
  isActive         Boolean  @default(true)
  isSystemDefined  Boolean  @default(false) // Can't be deleted if true
  canBeAssignedTo  Json     @default("[]")  // ["faculty", "staff"] - which roles can have this
  metadata         Json     @default("{}")
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  // Relations
  userDesignations      UserDesignation[]
  allowedRelationships  DesignationRelationship[] @relation("FromDesignation")
  
  @@map("designations")
}

// 2. User-to-Designation mapping (many-to-many)
model UserDesignation {
  id               String   @id @default(uuid())
  userId           String   @db.Uuid
  designationId    String
  
  // Context fields
  schoolId         String?  @db.Uuid  // Dean of which school?
  departmentId     String?  @db.Uuid  // HOD of which department?
  programId        String?  @db.Uuid  // Coordinator of which program?
  
  // Validity period
  assignedAt       DateTime @default(now())
  validFrom        DateTime @default(now())
  validUntil       DateTime?              // Null = permanent
  
  isActive         Boolean  @default(true)
  assignedBy       String?  @db.Uuid      // Who assigned this designation
  metadata         Json     @default("{}")
  
  user            UserLogin    @relation(fields: [userId], references: [id])
  designation     Designation  @relation(fields: [designationId], references: [id])
  assignedByUser  UserLogin?   @relation("AssignedDesignations", fields: [assignedBy], references: [id])
  school          FacultySchoolList?  @relation(fields: [schoolId], references: [id])
  department      Department?         @relation(fields: [departmentId], references: [id])
  program         Program?            @relation(fields: [programId], references: [id])
  
  @@unique([userId, designationId, schoolId, departmentId, programId])
  @@map("user_designations")
}

// 3. Designation Relationship Configuration
model DesignationRelationship {
  id                    String   @id @default(uuid())
  fromDesignationId     String   // e.g., "STUDENT"
  toDesignationId       String   // e.g., "MENTOR"
  relationshipType      String   // "reports_to", "mentored_by", "supervised_by"
  isAllowed             Boolean  @default(true)
  isRequired            Boolean  @default(false)  // e.g., every student MUST have a mentor
  maxCount              Int?     // e.g., a student can have max 2 mentors
  description           String?
  createdAt             DateTime @default(now())
  
  fromDesignation  Designation @relation("FromDesignation", fields: [fromDesignationId], references: [id])
  
  @@unique([fromDesignationId, toDesignationId, relationshipType])
  @@map("designation_relationships")
}

// 4. Actual User-to-User relationships based on designations
model UserDesignationLink {
  id               String   @id @default(uuid())
  fromUserId       String   @db.Uuid
  toUserId         String   @db.Uuid
  relationshipType String   // "reports_to", "mentored_by"
  
  // Which designations are involved
  fromUserDesignationId  String?  // e.g., Student designation ID
  toUserDesignationId    String?  // e.g., Mentor designation ID
  
  // Context
  schoolId      String?  @db.Uuid
  departmentId  String?  @db.Uuid
  
  validFrom     DateTime @default(now())
  validUntil    DateTime?
  isActive      Boolean  @default(true)
  metadata      Json     @default("{}")
  createdAt     DateTime @default(now())
  
  fromUser     UserLogin @relation("UserFrom", fields: [fromUserId], references: [id])
  toUser       UserLogin @relation("UserTo", fields: [toUserId], references: [id])
  
  @@unique([fromUserId, toUserId, relationshipType])
  @@map("user_designation_links")
}

// 5. Hierarchy Change History (Audit)
model DesignationChangeHistory {
  id              String   @id @default(uuid())
  userId          String   @db.Uuid
  designationId   String
  action          String   // "assigned", "removed", "updated"
  previousValue   Json?
  newValue        Json?
  changedBy       String   @db.Uuid
  reason          String?
  timestamp       DateTime @default(now())
  
  user       UserLogin @relation("DesignationChanges", fields: [userId], references: [id])
  changedByUser UserLogin @relation("DesignationChangesMadeBy", fields: [changedBy], references: [id])
  
  @@map("designation_change_history")
}
```

---

## 📋 Functional Requirements

### FR-1: Designation Management (Admin)

**User Story:** As a Super Admin, I want to create/edit/delete designations so that the system can adapt to university structure changes.

**Acceptance Criteria:**
- ✅ Admin can create new designation with:
  - Code (unique identifier)
  - Name (display name)
  - Hierarchy level (1-99, lower number = higher authority)
  - Which roles can have this designation
  - Active/Inactive status
- ✅ Admin can edit designation details except `code`
- ✅ Admin can deactivate (not delete) system-defined designations
- ✅ Admin can delete custom designations if no users have them
- ✅ System shows warning if deletion affects existing users

**API Endpoints:**
```
POST   /api/designations              - Create designation
GET    /api/designations              - List all designations
GET    /api/designations/:id          - Get designation details
PUT    /api/designations/:id          - Update designation
DELETE /api/designations/:id          - Delete designation
PATCH  /api/designations/:id/toggle   - Activate/Deactivate
```

---

### FR-2: Designation Assignment to Users

**User Story:** As an Admin, I want to assign/remove designations to users so that their authority level is reflected in the system.

**Acceptance Criteria:**
- ✅ Admin can assign multiple designations to a user
- ✅ System validates: designation `canBeAssignedTo` matches user's role
- ✅ Admin can specify context (school/department/program)
  - Example: "Dr. Sharma is HOD of Computer Science Department"
- ✅ Admin can set validity period (start date, end date)
- ✅ System auto-deactivates expired designations
- ✅ Audit log records all assignments/removals

**API Endpoints:**
```
POST   /api/users/:userId/designations           - Assign designation
GET    /api/users/:userId/designations           - List user's designations
DELETE /api/users/:userId/designations/:id       - Remove designation
PATCH  /api/users/:userId/designations/:id       - Update designation context
```

---

### FR-3: Designation Relationship Configuration

**User Story:** As a Super Admin, I want to configure which designation can relate to which other designation, so that illogical relationships are prevented.

**Acceptance Criteria:**
- ✅ Admin defines relationship rules:
  - FROM: Student designation
  - TO: Mentor designation
  - TYPE: "mentored_by"
  - ALLOWED: Yes
  - REQUIRED: Optional (can make mandatory)
  - MAX COUNT: 2 (student can have max 2 mentors)
- ✅ System prevents creating relationships not configured
- ✅ System shows relationship validation errors in UI
- ✅ Admin can view relationship matrix (which can link to which)

**Examples:**
```
✅ Student → Mentor (mentored_by) - ALLOWED
✅ Student → Class Teacher (taught_by) - ALLOWED
❌ HOD → Mentor (mentored_by) - NOT ALLOWED
❌ Dean → Student (reports_to) - NOT ALLOWED
```

**API Endpoints:**
```
POST   /api/designation-relationships            - Create relationship rule
GET    /api/designation-relationships            - List all rules
GET    /api/designation-relationships/matrix     - Relationship matrix view
PUT    /api/designation-relationships/:id        - Update rule
DELETE /api/designation-relationships/:id        - Delete rule
```

---

### FR-4: User-to-User Designation Links

**User Story:** As a user, when I select a mentor/supervisor, the system should validate if that relationship is allowed based on our designations.

**Acceptance Criteria:**
- ✅ When creating a relationship (e.g., student selecting mentor):
  - System checks if relationship is configured as allowed
  - System checks max count limit
  - System validates context (same department/school if required)
- ✅ System prevents invalid relationships with clear error messages
- ✅ Users can view their relationship chain (who reports to whom)
- ✅ System supports hierarchical queries (get all under a Dean)

**API Endpoints:**
```
POST   /api/user-links                          - Create user relationship
GET    /api/user-links/:userId                  - Get user's relationships
GET    /api/user-links/:userId/hierarchy        - Get hierarchy tree
DELETE /api/user-links/:id                      - Remove relationship
```

---

### FR-5: Hierarchy Level & Authority Queries

**User Story:** As a developer, I need APIs to check hierarchy levels so that workflow logic can determine who can approve what.

**Acceptance Criteria:**
- ✅ API to get user's highest hierarchy level
- ✅ API to check if User A has higher authority than User B
- ✅ API to get all users above/below a certain level
- ✅ Hierarchy comparison considers context (school/dept)

**API Endpoints:**
```
GET /api/hierarchy/user/:userId/level           - Get user's hierarchy level
GET /api/hierarchy/compare/:userId1/:userId2    - Compare two users
GET /api/hierarchy/above/:level                 - Get users above level
GET /api/hierarchy/below/:level                 - Get users below level
```

---

## 🎨 UI Requirements

### UI-1: Designation Management Screen (Admin)
- List view with search, filter, sort
- Create/Edit modal with form validation
- Hierarchy level indicator (visual badge: 1=red, 5=orange, 10=green)
- Active/Inactive toggle
- Bulk actions (activate/deactivate multiple)

### UI-2: User Designation Assignment Screen
- User profile page shows "Designations" tab
- Add designation modal:
  - Select designation dropdown (filtered by user's role)
  - Context fields (school/dept/program) - auto-complete
  - Validity date range picker
- Display designation cards with context and validity
- Remove button with confirmation

### UI-3: Relationship Configuration Screen
- Matrix view (FROM designations × TO designations)
- Cell colors: Green (allowed), Red (blocked), Gray (not configured)
- Click cell to edit rules (relationship type, required, max count)
- Search/filter designations
- Export configuration as JSON

### UI-4: User Hierarchy View
- Org chart visualization
- User card shows:
  - Name, Photo, Role
  - Primary designation (highest level)
  - Context (school/dept)
- Drill down/up navigation
- Search user to highlight in tree

---

## 🔧 Technical Architecture

### Database Migration Strategy

**Phase 1: Add New Tables** (Non-breaking)
- Create new tables: Designation, UserDesignation, DesignationRelationship, etc.
- Keep existing columns (headOfDepartmentId) for backward compatibility

**Phase 2: Data Migration**
- Script to migrate existing HOD/Dean relationships to new tables
- Create default designations: Dean, HOD, Mentor, etc.
- Create UserDesignation entries from existing data

**Phase 3: Update Application Logic**
- Update controllers to use new designation system
- Add fallback to old columns if designation not found

**Phase 4: Deprecate Old Columns** (Breaking change - Phase 2 release)
- Remove old columns after ensuring 100% migration
- Update schema to remove relations

### API Design Principles

1. **RESTful** - Standard HTTP methods
2. **Versioned** - `/api/v1/designations`
3. **Paginated** - All list endpoints support pagination
4. **Filtered** - Support query params: `?role=faculty&level=<5`
5. **Validated** - Use express-validator for input validation
6. **Logged** - All mutations logged to audit trail

### Performance Considerations

- **Indexes:**
  ```sql
  CREATE INDEX idx_user_designations_user ON user_designations(user_id);
  CREATE INDEX idx_user_designations_designation ON user_designations(designation_id);
  CREATE INDEX idx_designation_level ON designations(hierarchy_level);
  ```
- **Caching:** User designation lookup cached in Redis (TTL: 5 min)
- **Hierarchy queries:** Use recursive CTEs for organization tree

---

## 🚧 Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Database schema design & review
- [ ] Create Prisma models
- [ ] Write migration script
- [ ] Seed default designations
- [ ] Basic CRUD APIs for Designation

### Phase 2: Core Features (Week 3-4)
- [ ] User designation assignment APIs
- [ ] Relationship configuration APIs
- [ ] Validation middleware
- [ ] Admin UI for designation management

### Phase 3: Relationships (Week 5-6)
- [ ] User-to-user links implementation
- [ ] Relationship matrix UI
- [ ] Hierarchy query APIs
- [ ] Validation logic for link creation

### Phase 4: Migration & Integration (Week 7-8)
- [ ] Data migration from old system
- [ ] Update existing IPR/Research modules to use new system
- [ ] Replace hardcoded mentor/HOD logic
- [ ] Testing & bug fixes

### Phase 5: Advanced Features (Week 9-10)
- [ ] Hierarchy visualization UI
- [ ] Bulk operations
- [ ] Import/Export configuration
- [ ] Reporting & analytics

---

## ⚠️ Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing workflows | High | Maintain backward compatibility for 2 months |
| Complex hierarchy queries slow | Medium | Optimize with indexes, caching, materialized views |
| Users confused by new concept | Medium | Training videos, in-app tooltips, gradual rollout |
| Data migration errors | High | Dry-run migration on staging, rollback plan ready |

---

## 📊 Success Metrics

- **Flexibility:** Time to add new designation < 5 minutes (vs 2 hours schema change)
- **Adoption:** 80% of users have at least one designation assigned within 1 month
- **Reliability:** 0 invalid relationships created after validation is live
- **Performance:** Hierarchy queries < 500ms for 10,000 users

---

## 🧠 Critical Feedback & Recommendations

### ✅ What's Good About Your Idea:
1. **Clear separation of Role vs Designation** - This is fundamentally correct and needed
2. **Dynamic hierarchy** - Excellent for scalability
3. **Relationship configuration** - Very smart, prevents logical errors

### ⚠️ What Needs Improvement:

#### 1. **Context is Critical**
Your idea mentions designations but doesn't address context enough.

**Problem:** 
- Dr. Sharma is Dean of School of Engineering
- Dr. Patel is Dean of School of Management
- Both are "Dean" designation but in different contexts

**Solution Added:** 
- `UserDesignation` table has `schoolId`, `departmentId`, `programId`
- This allows designation to be scoped correctly

#### 2. **Temporal Validity**
You didn't mention time-based designations.

**Problem:**
- Dr. Kumar was HOD from 2023-2025
- Now Dr. Singh is HOD from 2025 onwards
- Historical data queries will break

**Solution Added:**
- `validFrom` and `validUntil` columns
- Audit history table for all changes

#### 3. **Migration Strategy Missing**
You can't just flip a switch - existing system has 27 hardcoded head relationships.

**Solution Added:**
- Phased migration plan
- Backward compatibility period
- Data migration scripts

#### 4. **Relationship Cardinality**
You mentioned "relationships" but not constraints.

**Problem:**
- Can a student have 5 mentors? 0 mentors?
- Can a mentor guide 100 students?

**Solution Added:**
- `isRequired` flag (must have relationship)
- `maxCount` limit per relationship type

#### 5. **Performance Not Considered**
Hierarchy queries on 10,000 users will be SLOW without optimization.

**Solution Added:**
- Database indexes
- Redis caching layer
- Materialized views for common queries

---

## 🎯 Final Recommendation

**Your core idea is SOLID ✅** - but the devil is in implementation details.

### Must-Have for Success:
1. ✅ Context-aware designations (school/dept/program)
2. ✅ Time-bound validity periods
3. ✅ Careful migration strategy
4. ✅ Relationship cardinality rules
5. ✅ Performance optimization from day 1

### Start Small:
Don't try to solve everything at once.

**MVP Scope:**
- 5 base designations (Dean, HOD, Mentor, Faculty Coordinator, Student)
- Basic CRUD for Designation and UserDesignation
- 3 relationship types (mentored_by, reports_to, coordinated_by)
- Admin UI only (no student UI yet)

**Phase 2:**
- More designations
- Complex hierarchy visualizations
- Student-facing features

---

## 📝 Open Questions for Discussion

1. **Who can assign designations?**
   - Only Super Admin? Or can HOD assign Class Rep?
   - Delegation model needed?

2. **Designation inheritance?**
   - If someone is Dean, are they automatically a Faculty too?
   - Or explicit assignment needed?

3. **Approval workflow?**
   - Should designation assignment require approval?
   - Or instant activation?

4. **Notification strategy?**
   - Notify user when designation assigned?
   - Notify when designation expires?

5. **Multi-tenancy?**
   - Different universities = different designation sets?
   - Or shared global designation list?

---

## 🤝 Next Steps

1. **Review this PRD** - Team discussion, gather feedback
2. **Refine scope** - Agree on MVP vs Phase 2 features
3. **Technical design** - Detailed API contracts, database schema finalization
4. **Prototype** - Build designation CRUD + basic assignment (1 week)
5. **User testing** - Get feedback from 5 admin users
6. **Full implementation** - Follow phased rollout plan

---

**Document Owner:** System Architect  
**Reviewers Needed:** Product Manager, Lead Developer, University Admin Representative  
**Status:** Ready for Review  

---

*This is a living document. Update as requirements evolve.*
