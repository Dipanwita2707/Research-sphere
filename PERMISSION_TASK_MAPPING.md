# Permission → Task Mapping

This document defines **exactly** which permissions allow which specific tasks/operations in the system.

## Research Module Permissions

### 1. `research_file_new` Permission

**Who Gets It:**
- Faculty (automatic/default)
- Student (automatic/default)
- Staff/Admin (must be granted via checkbox)

**Allowed Tasks:**
```javascript
// Route: POST /api/v1/research
router.post('/', protect, checkResearchFilePermission, createResearchContribution);

// Route: PUT /api/v1/research/:id
router.put('/:id', protect, updateResearchContribution);

// Route: POST /api/v1/research/:id/submit
router.post('/:id/submit', protect, submitResearchContribution);

// Route: POST /api/v1/research/:id/resubmit
router.post('/:id/resubmit', protect, resubmitResearchContribution);

// Route: DELETE /api/v1/research/:id
router.delete('/:id', protect, deleteResearchContribution);

// Route: POST /api/v1/research/:id/documents
router.post('/:id/documents', protect, upload.fields(...), uploadDocuments);

// Route: POST /api/v1/research/:id/authors
router.post('/:id/authors', protect, addAuthor);

// Route: PUT /api/v1/research/:id/authors/:authorId
router.put('/:id/authors/:authorId', protect, updateAuthor);

// Route: DELETE /api/v1/research/:id/authors/:authorId
router.delete('/:id/authors/:authorId', protect, removeAuthor);
```

**Actions Allowed:**
- ✅ Create new research contribution
- ✅ Edit draft contributions
- ✅ Submit contribution for review
- ✅ Resubmit after requested changes
- ✅ Delete draft contributions
- ✅ Upload research documents
- ✅ Add/Edit/Remove co-authors

---

### 2. `research_review` Permission

**Who Gets It:**
- DRD Team Members (granted by DRD Head)
- Staff assigned to review research papers

**Allowed Tasks:**
```javascript
// Route: GET /api/v1/research/review/pending
router.get('/review/pending', protect, requireResearchAccess, getPendingReviews);

// Route: GET /api/v1/research/review/statistics
router.get('/review/statistics', protect, requireResearchAccess, getReviewStatistics);

// Route: GET /api/v1/research/review/schools
router.get('/review/schools', protect, requireResearchAccess, getSchoolsForFilter);

// Route: POST /api/v1/research/:id/review/start
router.post('/:id/review/start', protect, 
  requirePermission('central-department', 'research_review'), startReview);

// Route: POST /api/v1/research/:id/review/request-changes
router.post('/:id/review/request-changes', protect, 
  requirePermission('central-department', 'research_review'), requestChanges);

// Route: POST /api/v1/research/:id/review/recommend
router.post('/:id/review/recommend', protect, 
  requirePermission('central-department', 'research_review'), recommendForApproval);
```

**Actions Allowed:**
- ✅ View pending research contributions (from assigned schools only)
- ✅ View review statistics and metrics
- ✅ Start reviewing a contribution
- ✅ Request changes from applicant
- ✅ Recommend contribution for approval (to DRD Head)
- ✅ Add comments and feedback
- ✅ View assigned schools

**Actions NOT Allowed:**
- ❌ Final approval/rejection (needs `research_approve`)
- ❌ Assign schools to reviewers (needs `research_assign_school`)

---

### 3. `research_approve` Permission

**Who Gets It:**
- DRD Head
- Registrar (if granted)

**Allowed Tasks:**
```javascript
// Route: GET /api/v1/research/review/pending (can also view)
router.get('/review/pending', protect, requireResearchAccess, getPendingReviews);

// Route: GET /api/v1/research/review/statistics (can also view)
router.get('/review/statistics', protect, requireResearchAccess, getReviewStatistics);

// Route: POST /api/v1/research/:id/review/approve
router.post('/:id/review/approve', protect, 
  requirePermission('central-department', 'research_approve'), approveContribution);

// Route: POST /api/v1/research/:id/review/reject
router.post('/:id/review/reject', protect, 
  requirePermission('central-department', 'research_approve'), rejectContribution);

// Route: POST /api/v1/research/:id/review/complete
router.post('/:id/review/complete', protect, 
  requirePermission('central-department', 'research_approve'), markCompleted);
```

**Actions Allowed:**
- ✅ View all pending contributions (all schools)
- ✅ View all review statistics
- ✅ **Final approval** of research contributions
- ✅ **Final rejection** of research contributions
- ✅ Mark contribution as completed
- ✅ Override reviewer recommendations
- ✅ All tasks that `research_review` can do

**Actions NOT Allowed:**
- ❌ Assign schools (needs `research_assign_school`)

---

### 4. `research_assign_school` Permission

**Who Gets It:**
- DRD Head only

**Allowed Tasks:**
```javascript
// Route: GET /api/v1/permission-management/drd-members/with-research-schools
router.get('/drd-members/with-research-schools', 
  permissionMgmt.getDrdMembersWithResearchSchools);

// Route: GET /api/v1/permission-management/schools/with-research-members
router.get('/schools/with-research-members', 
  permissionMgmt.getSchoolsWithResearchMembers);

// Route: POST /api/v1/permission-management/research-member/assign-schools
router.post('/research-member/assign-schools', 
  permissionMgmt.assignResearchMemberSchools);
```

**Actions Allowed:**
- ✅ View all DRD members with research review permission
- ✅ View school assignments for each reviewer
- ✅ Assign/unassign schools to DRD reviewers
- ✅ Manage reviewer workload distribution

---

## IPR Module Permissions

### 1. `ipr_file_new` Permission

**Who Gets It:**
- Faculty (automatic)
- Student (automatic)
- Staff/Admin (must be granted)

**Allowed Tasks:**
```javascript
// Route: POST /api/v1/ipr/applications
router.post('/applications', protect, checkIprFilePermission, createIPRApplication);

// Route: PUT /api/v1/ipr/applications/:id
router.put('/applications/:id', protect, updateIPRApplication);

// Route: POST /api/v1/ipr/applications/:id/submit
router.post('/applications/:id/submit', protect, submitIPRApplication);
```

**Actions Allowed:**
- ✅ File new IPR applications (Patent/Trademark/Copyright/Design)
- ✅ Edit draft applications
- ✅ Add inventors
- ✅ Upload documents
- ✅ Submit for DRD review

---

### 2. `ipr_review` Permission

**Who Gets It:**
- DRD Team Members

**Allowed Tasks:**
```javascript
// Route: GET /api/v1/ipr/drd/pending
router.get('/drd/pending', requireAnyPermission('central-department', 
  ['ipr_review', 'ipr_approve']), getPendingDrdReviews);

// Route: POST /api/v1/ipr/drd/review/:id
router.post('/drd/review/:id', requirePermission('central-department', 
  'ipr_review'), submitDrdReview);

// Route: POST /api/v1/ipr/drd/request-changes/:id
router.post('/drd/request-changes/:id', requirePermission('central-department', 
  'ipr_review'), requestChanges);

// Route: POST /api/v1/ipr/drd/recommend/:id
router.post('/drd/recommend/:id', requirePermission('central-department', 
  'ipr_review'), recommendToHead);

// Route: POST /api/v1/ipr/drd/govt-application/:id
router.post('/drd/govt-application/:id', requirePermission('central-department', 
  'ipr_review'), addGovtApplicationId);

// Route: POST /api/v1/ipr/drd/publication/:id
router.post('/drd/publication/:id', requirePermission('central-department', 
  'ipr_review'), addPublicationId);
```

**Actions Allowed:**
- ✅ View pending IPR applications (assigned schools only)
- ✅ Review applications
- ✅ Request changes from applicant
- ✅ Recommend to DRD Head for approval
- ✅ Add government application ID (after head approval)
- ✅ Add publication ID (for granted IPRs)
- ✅ Add status updates

**Actions NOT Allowed:**
- ❌ Final approval (needs `ipr_approve`)
- ❌ Assign applications to other reviewers

---

### 3. `ipr_approve` Permission

**Who Gets It:**
- DRD Head

**Allowed Tasks:**
```javascript
// Route: POST /api/v1/ipr/drd/head-approve/:id
router.post('/drd/head-approve/:id', requirePermission('central-department', 
  'ipr_approve'), headApproveAndSubmitToGovt);

// Route: POST /api/v1/ipr/drd/approve/:id
router.post('/drd/approve/:id', requirePermission('central-department', 
  'ipr_approve'), finalApproval);

// Route: POST /api/v1/ipr/drd/reject/:id
router.post('/drd/reject/:id', requirePermission('central-department', 
  'ipr_approve'), finalRejection);

// Route: POST /api/v1/ipr/drd/assign/:id
router.post('/drd/assign/:id', requirePermission('central-department', 
  'ipr_approve'), assignDrdReviewer);
```

**Actions Allowed:**
- ✅ View all pending IPR applications
- ✅ **Final approval** - approve and submit to government
- ✅ **Final rejection** - reject with reason
- ✅ Assign applications to specific reviewers
- ✅ Override reviewer recommendations
- ✅ System overrides

---

### 4. `ipr_assign_school` Permission

**Who Gets It:**
- DRD Head

**Allowed Tasks:**
```javascript
// Route: POST /api/v1/permission-management/drd-member/assign-schools
router.post('/drd-member/assign-schools', assignDrdMemberSchools);
```

**Actions Allowed:**
- ✅ Assign schools to DRD members for IPR review

---

## Book Module Permissions

### 1. `book_file_new` Permission
- Create book/chapter contributions
- Upload manuscripts
- Add co-authors

### 2. `book_review` Permission
- Review book contributions from assigned schools
- Request revisions
- Recommend for approval

### 3. `book_approve` Permission
- Final approval/rejection
- Mark as published

### 4. `book_assign_school` Permission
- Assign schools to book reviewers

---

## Conference Module Permissions

### 1. `conference_file_new` Permission
- Submit conference paper contributions
- Upload presentation files

### 2. `conference_review` Permission
- Review conference papers from assigned schools
- Verify conference details
- Request documentation

### 3. `conference_approve` Permission
- Final approval of conference papers
- Verify attendance

### 4. `conference_assign_school` Permission
- Assign schools to conference reviewers

---

## Grant Module Permissions

### 1. `grant_file_new` Permission
- File grant applications
- Upload grant proposals

### 2. `grant_review` Permission
- Review grant applications
- Verify budget details

### 3. `grant_approve` Permission
- Final approval of grants
- Release funds

### 4. `grant_assign_school` Permission
- Assign schools to grant reviewers

---

## Finance Module Permissions

### 1. `finance_review` Permission

**Allowed Tasks:**
```javascript
// Route: GET /api/v1/finance/pending
router.get('/pending', requireAnyPermission('research-patent', 
  ['finance_review', 'finance_approve']), getPendingFinanceReviews);

// Route: POST /api/v1/finance/request-audit/:id
router.post('/request-audit/:id', requirePermission('research-patent', 
  'finance_review'), requestAdditionalAudit);
```

**Actions Allowed:**
- ✅ View pending finance applications
- ✅ Review incentive requests
- ✅ Request additional audits
- ✅ Add comments

---

### 2. `finance_approve` Permission

**Allowed Tasks:**
```javascript
// Route: POST /api/v1/finance/approve/:id
router.post('/approve/:id', requireAnyPermission('research-patent', 
  ['finance_approve', 'finance_manage']), approveFinanceApplication);

// Route: POST /api/v1/finance/reject/:id
router.post('/reject/:id', requireAnyPermission('research-patent', 
  ['finance_approve', 'finance_manage']), rejectFinanceApplication);

// Route: POST /api/v1/finance/process-incentive/:id
router.post('/process-incentive/:id', requireAnyPermission('research-patent', 
  ['finance_approve', 'finance_manage']), processFinanceIncentive);
```

**Actions Allowed:**
- ✅ Approve finance applications
- ✅ Reject finance applications
- ✅ Process incentive payments
- ✅ All tasks `finance_review` can do

---

### 3. `finance_manage` Permission

**Actions Allowed:**
- ✅ All finance operations
- ✅ Configure finance policies
- ✅ View all financial reports

---

## Permission Hierarchy Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    PERMISSION LEVELS                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  LEVEL 1: FILE_NEW                                          │
│  ├─ Faculty/Student (automatic)                             │
│  ├─ Create contributions                                    │
│  └─ Upload documents                                        │
│                                                              │
│  LEVEL 2: REVIEW                                            │
│  ├─ DRD Team Members                                        │
│  ├─ Review assigned schools only                            │
│  ├─ Request changes                                         │
│  └─ Recommend for approval                                  │
│                                                              │
│  LEVEL 3: APPROVE                                           │
│  ├─ DRD Head                                                │
│  ├─ Final approval/rejection                                │
│  ├─ View all schools                                        │
│  └─ Override recommendations                                │
│                                                              │
│  LEVEL 4: ASSIGN_SCHOOL                                     │
│  ├─ DRD Head only                                           │
│  └─ Manage reviewer assignments                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Code Implementation Examples

### Checking Single Permission
```javascript
// Middleware: requirePermission
requirePermission('central-department', 'research_review')

// Example: Only users with research_review can start a review
router.post('/:id/review/start', 
  protect, 
  requirePermission('central-department', 'research_review'), 
  startReview
);
```

### Checking Multiple Permissions (ANY)
```javascript
// Middleware: requireAnyPermission
requireAnyPermission('central-department', ['research_review', 'research_approve'])

// Example: Users with either review OR approve can view pending items
router.get('/review/pending', 
  protect, 
  requireAnyPermission('central-department', ['research_review', 'research_approve']), 
  getPendingReviews
);
```

### Default Role Access
```javascript
// Middleware: checkResearchFilePermission
// Faculty and Student get automatic access, others need permission checkbox

router.post('/', 
  protect, 
  checkResearchFilePermission,  // Checks role OR permission
  createResearchContribution
);
```

---

## Permission Storage

Permissions are stored in two tables:

### 1. `UserCentralDeptPermission`
```json
{
  "userId": "user-id",
  "centralDeptId": "drd-dept-id",
  "permissions": {
    "research_review": true,
    "research_approve": false,
    "research_assign_school": false
  }
}
```

### 2. `UserSchoolAssignment` (School-scoped review access)
```json
{
  "userId": "reviewer-id",
  "schoolId": "school-of-engineering",
  "permissionType": "research_review"
}
```

---

## Quick Reference Table

| Permission | View Pending | Review/Comment | Approve/Reject | Assign Schools | All Schools |
|-----------|--------------|----------------|----------------|----------------|-------------|
| `_file_new` | ✅ Own only | ❌ | ❌ | ❌ | ❌ |
| `_review` | ✅ Assigned | ✅ | ❌ | ❌ | ❌ |
| `_approve` | ✅ All | ✅ | ✅ | ❌ | ✅ |
| `_assign_school` | ✅ All | ✅ | ✅ | ✅ | ✅ |

