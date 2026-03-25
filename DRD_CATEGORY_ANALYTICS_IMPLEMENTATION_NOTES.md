# DRD Category-Wise Analytics Implementation Notes

## Purpose
This document captures:

1. what has already been implemented for granular DRD analytics
2. what still needs to be applied for rollout
3. the next plan for safe completion and validation

## Requirement Implemented
The analytics model has been changed from a shared DRD analytics scope to a more granular category-wise model.

The requested direction was:
- allow analytics permission assignment category by category
- support multiple categories for the same user
- allow separate school selection per category
- allow separate department selection per category
- keep analytics focused on DRD university analytics

## What Was Changed

## Performance and Hardening Work Already Implemented

Before the granular analytics permission pass, a broader optimization and production-hardening pass was also completed across DRD analytics, research, IPR, and grant flows. That work should be tracked together because it affects rollout readiness.

### A. DRD analytics performance improvements
The DRD analytics dashboard was improved beyond the first basic implementation.

Completed:
- drilldown views for school, department, applicant, and reviewer detail
- monthly trend data and trend panels
- CSV export for the current analytics view
- UI polish to match the existing university theme
- better filter UX and scoped dashboard behavior

Related files include:
- [frontend/src/app/drd/analytics/page.tsx](/Users/souravmukhopadhyay/UMS/Sgt-Ums/frontend/src/app/drd/analytics/page.tsx)
- [frontend/src/features/ipr-management/services/drdAnalytics.service.ts](/Users/souravmukhopadhyay/UMS/Sgt-Ums/frontend/src/features/ipr-management/services/drdAnalytics.service.ts)
- [backend/src/modules/drd-analytics/services/drdAnalytics.service.js](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/src/modules/drd-analytics/services/drdAnalytics.service.js)

### B. Research module production hardening
The research workflow was hardened to reduce inconsistency and race-condition risk.

Completed:
- transactional review flow hardening
- reviewer ownership enforcement
- terminal-state cleanup of `currentReviewerId`
- idempotent handling for repeated approve/reject/complete actions
- research workflow background queue support
- workflow health summary endpoint support
- service-level lifecycle test coverage for major research flows

Related files include:
- [backend/src/modules/research/services/review.service.js](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/src/modules/research/services/review.service.js)
- [backend/src/modules/research/services/contribution.service.js](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/src/modules/research/services/contribution.service.js)
- [backend/src/jobs/researchWorkflowQueue.js](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/src/jobs/researchWorkflowQueue.js)
- [backend/src/__tests__/unit/research/review.service.test.js](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/src/__tests__/unit/research/review.service.test.js)
- [backend/src/__tests__/unit/research/workflow.lifecycle.test.js](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/src/__tests__/unit/research/workflow.lifecycle.test.js)

### C. Slow research / IPR / grant list optimizations
Several slow pages were optimized without changing their feature set or response contracts.

Completed:
- reduced heavy list payloads
- trimmed nested includes on list endpoints
- removed some repeated in-memory aggregation work
- improved DRD review list loading
- improved grant list and review payload shaping
- improved IPR list payload shaping
- reduced avoidable frontend-side sorting and repeated client-side summary work

This optimization work targeted areas such as:
- `Research Dashboard`
- `Research My Contributions`
- `Research Contributed`
- `DRD Research Review`
- `Grant Review`
- `IPR My Applications`
- `IPR DRD Review`

Related files include:
- [backend/src/modules/research/controllers/contribution.controller.js](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/src/modules/research/controllers/contribution.controller.js)
- [backend/src/modules/research/services/review.service.js](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/src/modules/research/services/review.service.js)
- [backend/src/modules/grants/controllers/grant.controller.js](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/src/modules/grants/controllers/grant.controller.js)
- [backend/src/modules/grants/services/grant.service.js](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/src/modules/grants/services/grant.service.js)
- [backend/src/modules/ipr/controllers/ipr.controller.js](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/src/modules/ipr/controllers/ipr.controller.js)
- [backend/src/modules/ipr/services/ipr.service.js](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/src/modules/ipr/services/ipr.service.js)
- [frontend/src/app/research/page.tsx](/Users/souravmukhopadhyay/UMS/Sgt-Ums/frontend/src/app/research/page.tsx)
- [frontend/src/app/research/my-contributions/page.tsx](/Users/souravmukhopadhyay/UMS/Sgt-Ums/frontend/src/app/research/my-contributions/page.tsx)
- [frontend/src/features/ipr-management/components/DrdReviewDashboard.tsx](/Users/souravmukhopadhyay/UMS/Sgt-Ums/frontend/src/features/ipr-management/components/DrdReviewDashboard.tsx)

### D. Database/index optimization work
Hot-path indexes were also added for high-traffic workflow patterns.

Completed:
- workflow-related index additions in Prisma schema
- manual SQL migration added for environments not using fully baselined Prisma migrations

Related files include:
- [backend/prisma/schema.prisma](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/prisma/schema.prisma)
- [backend/prisma/migrations/20260317000000_workflow_perf_indexes/migration.sql](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/prisma/migrations/20260317000000_workflow_perf_indexes/migration.sql)

### E. Monitoring and workflow health
Operational monitoring support was also added for workflow visibility.

Completed:
- workflow health monitor job
- slow/stuck workflow detection support
- research workflow queue startup integration

Related files include:
- [backend/src/jobs/workflowHealthMonitor.job.js](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/src/jobs/workflowHealthMonitor.job.js)
- [backend/src/server.js](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/src/server.js)

### 1. New category-wise applicant analytics permissions
Added category-specific applicant analytics permissions:

- `ipr_applicant_analytics`
- `research_applicant_analytics`
- `book_applicant_analytics`
- `conference_applicant_analytics`
- `grant_applicant_analytics`

Existing generic permissions were kept for backward compatibility:

- `applicant_analytics`
- `drd_member_analytics`

Files updated:
- [backend/src/modules/core/config/permissionDefinitions.js](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/src/modules/core/config/permissionDefinitions.js)

### 2. Data model extended for category-wise school scope
Added new central department permission fields for analytics school assignment:

- `assignedIprAnalyticsSchoolIds`
- `assignedResearchAnalyticsSchoolIds`
- `assignedBookAnalyticsSchoolIds`
- `assignedConferenceAnalyticsSchoolIds`
- `assignedGrantAnalyticsSchoolIds`

Files updated:
- [backend/prisma/schema.prisma](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/prisma/schema.prisma)
- [backend/prisma/migrations/20260317110000_add_category_analytics_scope_fields/migration.sql](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/prisma/migrations/20260317110000_add_category_analytics_scope_fields/migration.sql)

### 3. Permission-management backend extended
The central department permission grant flow now accepts and stores the new analytics school arrays.

The user permission payload returned to the frontend now includes the new analytics school arrays, so the admin assignment page can preload and edit them.

Files updated:
- [backend/src/modules/core/controllers/permissionManagement.controller.js](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/src/modules/core/controllers/permissionManagement.controller.js)

### 4. Admin assignment UI redesigned
The DRD analytics assignment manager was reworked to support:

- one DRD Member Analytics block
- separate applicant analytics blocks for:
  - IPR
  - Research
  - Book / Chapter
  - Conference
  - Grant
- school selection per category
- department selection per category
- reviewer school scope
- reviewer department scope

Backward compatibility behavior was also added:
- if a user only has legacy `applicant_analytics`, the UI treats that as broad applicant analytics access when preloading

Files updated:
- [frontend/src/features/admin-management/components/DrdAnalyticsAssignmentManager.tsx](/Users/souravmukhopadhyay/UMS/Sgt-Ums/frontend/src/features/admin-management/components/DrdAnalyticsAssignmentManager.tsx)
- [frontend/src/features/admin-management/services/permissionManagement.service.ts](/Users/souravmukhopadhyay/UMS/Sgt-Ums/frontend/src/features/admin-management/services/permissionManagement.service.ts)

### 5. DRD analytics backend made category-aware
The backend analytics service was updated so applicant analytics now resolves scope per category instead of using one shared scope.

New behavior:
- category-specific permission check
- category-specific school scope
- category-specific department scope
- `all` category combines only the categories the user is allowed to view
- no leakage from one category into another category’s scope

Applicant analytics now supports:
- `research`
- `book`
- `conference`
- `ipr`
- `grants`

DRD member analytics was also updated to understand:
- `research`
- `book`
- `conference`
- `ipr`
- `grants`

Files updated:
- [backend/src/modules/drd-analytics/services/drdAnalytics.service.js](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/src/modules/drd-analytics/services/drdAnalytics.service.js)

### 6. DRD analytics frontend updated
The DRD analytics dashboard category filter was extended to include:

- Research
- Book / Chapter
- Conference
- Patent / IPR
- Grants

The dashboard display was updated so applicant and reviewer breakdowns now include the new categories where relevant.

Files updated:
- [frontend/src/app/drd/analytics/page.tsx](/Users/souravmukhopadhyay/UMS/Sgt-Ums/frontend/src/app/drd/analytics/page.tsx)

### 7. DRD navigation and permission visibility updated
Users with the new category-wise analytics permissions can now still see the DRD analytics area.

Files updated:
- [frontend/src/shared/layouts/nav/permissions.ts](/Users/souravmukhopadhyay/UMS/Sgt-Ums/frontend/src/shared/layouts/nav/permissions.ts)
- [frontend/src/shared/layouts/Sidebar.tsx](/Users/souravmukhopadhyay/UMS/Sgt-Ums/frontend/src/shared/layouts/Sidebar.tsx)
- [frontend/src/features/ipr-management/components/DrdMainDashboard.tsx](/Users/souravmukhopadhyay/UMS/Sgt-Ums/frontend/src/features/ipr-management/components/DrdMainDashboard.tsx)

### 8. Tests updated
The DRD analytics unit test suite was updated and now covers:

- school scope expansion
- department-only scope
- union scope
- self-view reviewer restriction
- monthly trend aggregation
- category-specific analytics permission and scope

Files updated:
- [backend/src/__tests__/unit/drd-analytics/drdAnalytics.service.test.js](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/src/__tests__/unit/drd-analytics/drdAnalytics.service.test.js)

## Validation Completed
These checks passed locally:

- `npx prisma generate`
- `npx prisma validate`
- `node --check backend/src/modules/drd-analytics/services/drdAnalytics.service.js`
- `node --check backend/src/modules/core/controllers/permissionManagement.controller.js`
- `npx jest src/__tests__/unit/drd-analytics/drdAnalytics.service.test.js --runInBand`
- `cd frontend && npx tsc --noEmit`

Additional validation completed in earlier optimization and hardening work:

- targeted research workflow unit tests
- grant service unit validation
- syntax checks on hardened backend workflow files

## Important Remaining Step
The new Prisma client was generated successfully, but the new database columns are not yet confirmed as applied to the real database.

Why:
- `prisma migrate deploy` failed because this database is not baselined for Prisma Migrate
- direct SQL apply through `prisma db execute` was attempted next
- that step was not completed because approval was not granted

This means:
- code is implemented
- Prisma client is updated
- schema file and SQL migration file are ready
- database rollout still needs to be applied

## Rollout Plan

### Phase 1. Apply database SQL
Apply:
- [backend/prisma/migrations/20260317110000_add_category_analytics_scope_fields/migration.sql](/Users/souravmukhopadhyay/UMS/Sgt-Ums/backend/prisma/migrations/20260317110000_add_category_analytics_scope_fields/migration.sql)

Recommended command:

```bash
cd /Users/souravmukhopadhyay/UMS/Sgt-Ums/backend
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20260317110000_add_category_analytics_scope_fields/migration.sql
```

### Phase 2. Restart backend
Restart the backend after the DB columns exist so the updated Prisma client and runtime queries use the new fields cleanly.

### Phase 3. Validate admin assignment flow
Validate in admin UI:

1. open DRD analytics assignment
2. select a user
3. enable two or more category-wise applicant analytics permissions
4. assign different schools per category
5. assign different departments per category
6. save
7. reopen and confirm the same selections reload correctly

### Phase 4. Validate analytics access behavior
Validate with scoped users:

1. user with only `ipr_applicant_analytics`
   expected: can only see IPR applicant analytics within assigned IPR scope
2. user with only `research_applicant_analytics`
   expected: can only see research paper applicant analytics within assigned research scope
3. user with mixed `research_applicant_analytics` and `grant_applicant_analytics`
   expected: sees both categories, each with its own scope
4. user with department-only assignment
   expected: only that department’s analytics is visible
5. user with DRD member analytics only
   expected: reviewer analytics works, applicant analytics is blocked

## Recommended Next Improvements
After the DB step and rollout validation, the next best improvements are:

- add explicit UI summaries showing selected schools and departments per category before save
- add API integration tests for permission-management save and readback
- add a migration/baseline note in deployment docs because this repo uses manual SQL migrations in some places
- optionally hide or de-emphasize legacy `applicant_analytics` in UI once all current assignments are migrated
- apply the pending manual SQL migrations in every target environment, not just local schema files
- move more large list flows to fully paginated UI consumption now that backend-side pagination support exists
- run production-like query profiling after the index migration is applied

## Current Status
Implementation status:
- backend code: done
- frontend code: done
- unit validation: done
- Prisma client generation: done
- production DB column rollout: pending
- previously implemented optimization pass: done in code, pending full environment rollout where SQL migrations are not yet applied
