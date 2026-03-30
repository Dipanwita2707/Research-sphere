# Research & IPR Analytics Dashboard - Detailed Feature Plan

## 1) Objective
Build a user-friendly, industry-grade analytics experience by avoiding a single cluttered page and introducing a structured, role-aware dashboard with progressive disclosure.

This plan targets:
- Clean overview-first UX
- School-wise and department-wise analytics
- Applicant analytics vs DRD review analytics split
- Unified multi-school view with detailed drilldown
- Strict scope access with **UNION** rules for multi-assignment users

---

## 2) Final Business Rules (Locked)

1. Per category, keep **two analytics permission types**:
   - `applicant_analytics`
   - `drd_review_analytics`
2. Multi-assigned user scope conflict rule = **UNION** (not intersection).
3. Multi-school access should show **one unified dashboard**, with school-wise and department-wise breakdowns.
4. `money_earned` means **approved amount only** (not estimated/pipeline).
5. Individual analytics profile should show **creator/applicant activity only**.
6. Reviewer activity appears only in **DRD review analytics**.

---

## 3) UX Standards to Follow (Industry Grade)

### 3.1 Information Architecture
Do not put all widgets on one page. Use 3-level IA:
1. **Overview** (executive summary)
2. **Domain Pages** (Applicant Analytics / DRD Review Analytics)
3. **Detail Views** (school, department, user-level drilldowns)

### 3.2 Progressive Disclosure
- Default: key KPIs + top insights + trend sparkline
- Expand only when needed via tabs/sections/drilldown links
- Advanced filters hidden behind “More filters” drawer

### 3.3 Visual Hierarchy
- Row 1: KPI cards (4–6 max)
- Row 2: time trends + approval funnel
- Row 3: school-wise and department-wise comparisons
- Row 4: detailed data table with export

### 3.4 Interaction Standards
- Sticky filter bar (date, school, department, type, status)
- URL state sync for filters (shareable links)
- Download CSV/Excel and print-friendly summary
- Empty states and no-access states per role/scope

---

## 4) Proposed Dashboard Structure

## 4.1 Overview Page
**Purpose:** One-screen summary for quick decisions.

Sections:
- KPI cards: submissions, approved, approval rate, approved amount
- Monthly trend (last 12 months)
- School performance snapshot (top/bottom movement)
- Pending workload snapshot (DRD side)
- Quick links to detail pages

## 4.2 Applicant Analytics Page
**Purpose:** Creator/applicant behavior and outcomes.

Sections:
- Submission trend by month
- Approval/rejection ratio
- Approved amount total (`money_earned`)
- School-wise and department-wise applicant contribution
- Applicant leaderboard (only creator metrics)

## 4.3 DRD Review Analytics Page
**Purpose:** Review flow performance.

Sections:
- Assigned vs completed reviews
- Turnaround time (avg/median)
- Approval/reject decisions trend
- School and department review load distribution
- Reviewer performance (only in DRD analytics)

## 4.4 Drilldown Views
- School detail page (all departments in that school)
- Department detail page (contributors + review outcomes)
- Optional individual profile page split by mode:
  - Applicant mode
  - Reviewer mode (DRD only)

---

## 5) Access Model & Scope Resolution

### 5.1 Permission Keys (Category-aware)
For each category (Research, IPR/Patent, Grants):
- `<category>.applicant_analytics.view`
- `<category>.drd_review_analytics.view`

### 5.2 Scope Inputs
Scope can come from role assignment:
- University-wide
- One school
- One department under a school
- Multiple schools

### 5.3 Scope Resolver Behavior
- Resolve all assigned scopes
- Apply **UNION** merge
- Deduplicate entities
- Return:
  - `allowedSchoolIds[]`
  - `allowedDepartmentIds[]`
  - `scopeLevel` summary

---

## 6) Data Contract (Canonical Response Shape)

All dashboard APIs should align to one base contract.

```json
{
  "meta": {
    "category": "research|ipr|grants",
    "analyticsType": "applicant|drd_review",
    "scopeApplied": {
      "schoolIds": [],
      "departmentIds": [],
      "resolution": "union"
    },
    "timeRange": {
      "from": "YYYY-MM-DD",
      "to": "YYYY-MM-DD"
    }
  },
  "kpis": {
    "totalSubmissions": 0,
    "totalApproved": 0,
    "approvalRate": 0,
    "approvedAmount": 0
  },
  "trends": {
    "monthly": []
  },
  "schoolWise": [
    {
      "schoolId": "",
      "schoolName": "",
      "totalSubmissions": 0,
      "totalApproved": 0,
      "approvedAmount": 0,
      "departments": [
        {
          "departmentId": "",
          "departmentName": "",
          "totalSubmissions": 0,
          "totalApproved": 0,
          "approvedAmount": 0
        }
      ]
    }
  ],
  "departmentWise": [],
  "table": {
    "rows": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0
    }
  }
}
```

Notes:
- `approvedAmount` must always use approved records only.
- `departmentWise` can be flat summary; nested detail remains under each school in `schoolWise[].departments`.

---

## 7) Implementation Breakdown

## 7.1 Backend

### A. Scope & Permission Layer
- Add/confirm centralized permission check helpers.
- Add shared scope resolver utility using UNION semantics.
- Use resolver in all analytics handlers (research, ipr, grants).

### B. Analytics Services
Create or standardize service methods:
- `getOverviewAnalytics(params)`
- `getApplicantAnalytics(params)`
- `getDrdReviewAnalytics(params)`
- `getSchoolDrilldown(schoolId, params)`
- `getDepartmentDrilldown(departmentId, params)`

### C. Aggregation Queries
- Aggregate by school and department in one pass where possible.
- Keep category-specific business logic isolated per module.
- Standardize status mapping and approved definition.

### D. API Routes
Recommended route pattern:
- `/analytics/:category/overview`
- `/analytics/:category/applicant`
- `/analytics/:category/drd-review`
- `/analytics/:category/schools/:schoolId`
- `/analytics/:category/departments/:departmentId`

### E. Preservation & Contract Tests
- Extend preservation tests to assert school-wise + department-wise fields.
- Add contract tests for canonical response shape.
- Add role/scope matrix tests (single scope + multi-scope UNION).

## 7.2 Frontend

### A. Navigation
- Add analytics landing + domain tabs.
- Keep sidebar clean with grouped items:
  - Dashboard
  - Applicant Analytics
  - DRD Review Analytics

### B. Page Composition
- Break current overloaded pages into:
  - `OverviewPage`
  - `ApplicantAnalyticsPage`
  - `DrdReviewAnalyticsPage`
  - `SchoolDetailPage`
  - `DepartmentDetailPage`

### C. Shared Components
Create reusable blocks:
- `AnalyticsFilterBar`
- `KpiCardGrid`
- `TrendChartPanel`
- `SchoolDepartmentBreakdown`
- `AnalyticsDataTable`
- `ExportActions`

### D. State & Performance
- Debounced filters and query caching
- Skeleton loaders and partial section loading
- URL query params for shareable filtered views

---

## 8) File-Level Change Map (Expected)

### Backend (likely)
- `backend/src/modules/analytics/*` (new/updated services/controllers/routes)
- `backend/src/modules/research/*analytics*` (if existing stats methods are adapted)
- `backend/src/modules/ipr/*analytics*`
- `backend/src/modules/grants/*analytics*`
- `backend/src/__tests__/preservation/api-response-shapes.test.js`
- `backend/src/__tests__/**` for role/scope and contract tests

### Frontend (likely)
- `frontend/src/app/**/analytics/**` pages split by IA
- `frontend/src/shared/layouts/Sidebar.tsx` (navigation grouping)
- `frontend/src/components/**/analytics/**` reusable blocks

---

## 9) Phased Delivery Plan

### Phase 1: Foundation (Backend Contract + Scope)
- Canonical response contract finalized
- Scope resolver with UNION implemented
- Overview endpoint available for all categories

### Phase 2: Applicant Analytics
- Applicant analytics endpoint + page
- School/department breakdown + table exports

### Phase 3: DRD Review Analytics
- Review flow metrics endpoint + page
- Reviewer-specific metrics separated cleanly

### Phase 4: Drilldown & Hardening
- School and department detail pages
- Full preservation + regression + performance tests
- Documentation + monitoring metrics

---

## 10) Acceptance Criteria

1. Dashboard is split into overview + detail pages (not cluttered single page).
2. School-wise analytics visible where permission allows.
3. Department-wise analytics visible where permission allows.
4. Multi-school users get one unified view with per-school and per-department detail.
5. Applicant analytics excludes reviewer activity.
6. DRD review analytics contains reviewer workload/performance.
7. `approvedAmount` is computed from approved records only.
8. API response shape is stable and validated by tests.
9. Role/scope enforcement passes single-scope and multi-scope UNION tests.

---

## 11) Risks & Mitigations

- Risk: Inconsistent existing status enums across modules
  - Mitigation: central status normalization mapping
- Risk: Over-fetching on drilldown pages
  - Mitigation: lazy loading and paginated tables
- Risk: Scope leakage in mixed role assignments
  - Mitigation: contract tests for access matrix + audit logs

---

## 12) Operational Metrics (Post-Release)

Track:
- Dashboard load time (p50/p95)
- Filter interaction latency
- Drilldown click-through rate
- Export usage
- Error rate by endpoint
- Permission denied events (expected vs unexpected)

---

## 13) Out of Scope (for this feature cycle)

- Predictive analytics / ML scoring
- Cross-tenant benchmarking
- Custom report builder
- Real-time streaming dashboards

---

## 14) Definition of Done

- Backend + frontend implementation merged
- Preservation tests pass
- New contract/scope tests pass
- UX review approved (no cluttered single-page dashboard)
- Stakeholder sign-off for school/department breakdown behavior
