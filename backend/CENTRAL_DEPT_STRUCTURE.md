# Central Department Structure - DRD vs IPR Cell

## Current Setup

Your system has **two separate research-related departments**:

### 1. Director of Research and Development (DRD)
- **Code**: `DRD`
- **Type**: `drd`
- **Typical Responsibilities**:
  - Research project approvals
  - Grant applications
  - Research paper publications
  - Conference presentations
  - Research collaborations
  - Book chapter publications
  - Overall research strategy

### 2. Intellectual Property Rights Cell (IPR)
- **Code**: `IPR`
- **Type**: `drd` (shares DRD permissions)
- **Typical Responsibilities**:
  - Patent filing and management
  - Trademark registration
  - Copyright protection
  - IP commercialization
  - Technology transfer
  - Licensing agreements

## Current Permission Mapping

Both departments currently share the **same permission set** (`drd`), which includes:

```javascript
// IPR-related permissions (20 total)
- ipr_file_new, ipr_review, ipr_approve, ipr_assign_school
- research_file_new, research_approve, research_review, research_assign_school
- book_file_new, book_approve, book_review, book_assign_school
- conference_file_new, conference_review, conference_approve, conference_assign_school
- grant_file_new, grant_review, grant_approve, grant_assign_school
```

## Recommendations

### Option A: Keep Both Departments (Current State) ✅
**When to use**: If your university has separate administrative offices

**Pros**:
- Reflects actual organizational structure
- Different heads/staff for each office
- Clear separation of responsibilities

**Cons**:
- Both share same permissions (might be confusing)
- Users might not know which department to assign

### Option B: Create Separate Permission Sets ⭐ **RECOMMENDED**
Split permissions into two distinct sets:

**DRD Permissions**:
- Research papers, books, conferences, grants
- General research activities
- Research collaboration management

**IPR Permissions**:
- Patent filing, review, approve
- Trademark management
- Copyright handling
- Technology transfer

**Implementation**:
```javascript
// Update permissionDefinitions.js
export const CENTRAL_DEPARTMENT_PERMISSIONS = {
  drd: [ /* research, book, conference, grant permissions */ ],
  ipr: [ /* patent, trademark, copyright permissions */ ],  // NEW
  // ... other departments
};
```

### Option C: Merge into Single Department
Combine into "Research & IPR Office"

**Pros**:
- Simpler structure
- One-stop-shop for all research activities

**Cons**:
- May not reflect actual organizational structure
- Single head of department for diverse responsibilities

## What I Updated

### 1. Database Fix Script
Created `/backend/scripts/fix-central-dept-types.js` which updated:
- `DRD`: `research` → `drd`
- `IPR`: `research` → `drd`
- `Registrar`: `administrative` → `registrar`
- `Admissions`: `administrative` → `admissions`
- `HR`: `administrative` → `hr`
- `Finance`: `administrative` → `finance`

### 2. Seed File Update
Updated `/backend/src/shared/database/seed.js` with correct department types so future database resets will use the right values.

## Next Steps

If you want to implement **Option B** (separate permission sets):

1. Update `permissionDefinitions.js` to add `ipr` key
2. Move IPR-specific permissions from `drd` to `ipr`
3. Update IPR Cell's `departmentType` from `drd` to `ipr`
4. Run the fix script again

**Do you want me to implement Option B?** This would give you:
- DRD: Research, books, conferences, grants
- IPR: Patents, trademarks, IP management
