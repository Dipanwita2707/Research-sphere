# Research, IPR, and DRD Backend Performance Audit

## Scope

This is a read-only backend audit of the API surface related to:

- research
- IPR
- DRD workflow
- DRD analytics
- research progress tracker
- related collaboration and document-review flows used by these modules

This report focuses on:

- endpoint inventory
- query-path review
- N+1 query risks
- repeated-scan risks
- indexing gaps
- likely causes of slow loading at larger data volumes

No code changes were made as part of this audit.

---

## Primary Backend Mounts

Main route mounts:

- `/api/v1/research`
- `/api/v1/ipr`
- `/api/v1/drd-analytics`

Relevant mount files:

- [backend/src/modules/research/index.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/index.js)
- [backend/src/modules/ipr/index.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/index.js)
- [backend/src/modules/drd-analytics/index.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/drd-analytics/index.js)

---

## API Inventory

### 1. Research APIs

Base path:

- `/api/v1/research`

Contribution and review endpoints:

- `GET /my-contributions`
- `GET /contributed`
- `GET /lookup/:registrationNumber`
- `GET /incentive-policies`
- `POST /`
- `GET /:id`
- `PUT /:id`
- `POST /:id/submit`
- `POST /:id/resubmit`
- `DELETE /:id`
- `GET /mentor/pending`
- `POST /:id/mentor-approve`
- `POST /:id/mentor-reject`
- `POST /:id/documents`
- `GET /:id/documents/:type/:filename`
- `POST /:id/authors`
- `PUT /:id/authors/:authorId`
- `DELETE /:id/authors/:authorId`
- `GET /review/pending`
- `GET /review/statistics`
- `GET /review/health`
- `GET /review/schools`
- `POST /:id/review/start`
- `POST /:id/review/request-changes`
- `POST /:id/review/recommend`
- `POST /:id/review/approve`
- `POST /:id/review/reject`
- `POST /:id/review/complete`
- `POST /suggestions/:suggestionId/respond`

Route file:

- [backend/src/modules/research/routes/contribution.routes.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/routes/contribution.routes.js)

Main controller/service files:

- [backend/src/modules/research/controllers/contribution.controller.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/controllers/contribution.controller.js)
- [backend/src/modules/research/controllers/review.controller.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/controllers/review.controller.js)
- [backend/src/modules/research/services/contribution.service.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/services/contribution.service.js)
- [backend/src/modules/research/services/review.service.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/services/review.service.js)

### 2. Research Progress Tracker APIs

Base path:

- `/api/v1/research/progress`

Endpoints:

- `POST /`
- `GET /my`
- `GET /stats`
- `GET /:id`
- `PUT /:id`
- `DELETE /:id`
- `POST /:id/status`
- `GET /:id/for-submission`
- `POST /:id/link-contribution`
- `GET /contribution/:contributionId/history`
- `POST /:id/upload`

Route/controller files:

- [backend/src/modules/research/routes/progressTracker.routes.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/routes/progressTracker.routes.js)
- [backend/src/modules/research/controllers/progressTracker.controller.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/controllers/progressTracker.controller.js)

### 3. IPR APIs

Base path:

- `/api/v1/ipr`

Applicant, mentor, and DRD/admin endpoints:

- `GET /my-applications`
- `GET /my-applications/:id`
- `GET /my-published-provisionals`
- `GET /contributed`
- `GET /contributed/:id`
- `POST /create`
- `POST /:id/submit`
- `POST /:id/resubmit`
- `PUT /:id`
- `DELETE /:id`
- `GET /mentor/pending`
- `GET /mentor/history`
- `GET /mentor/application/:id`
- `POST /mentor/:id/approve`
- `POST /mentor/:id/reject`
- `GET /statistics`
- `GET /stats`
- `GET /:id`
- `GET /`

Route/controller/service files:

- [backend/src/modules/ipr/routes/ipr.routes.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/routes/ipr.routes.js)
- [backend/src/modules/ipr/controllers/ipr.controller.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/controllers/ipr.controller.js)
- [backend/src/modules/ipr/services/ipr.service.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/services/ipr.service.js)

### 4. Legacy / Secondary IPR Management APIs

Base path:

- `/api/v1/ipr/management`

Observed capabilities:

- list
- get by id
- create
- update
- submit
- review
- analytics dashboard
- delete

Route file:

- [backend/src/modules/ipr/routes/iprManagement.routes.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/routes/iprManagement.routes.js)

Important note:

- this route set appears to use a separate legacy `iPR` model path and should be treated as a separate performance surface

### 5. DRD Review / IPR Workflow APIs

Base path:

- `/api/v1/research/drd-review`

Endpoints:

- `GET /pending`
- `GET /statistics`
- `POST /assign/:id`
- `POST /review/:id`
- `POST /accept-edits/:id`
- `POST /request-changes/:id`
- `POST /recommend/:id`
- `POST /head-approve/:id`
- `POST /approve/:id`
- `POST /reject/:id`
- `POST /govt-application/:id`
- `POST /publication/:id`
- `POST /mark-govt-rejected/:id`
- `POST /status-update/:id`
- `GET /status-updates/:id`
- `DELETE /status-update/:updateId`
- `POST /system-override/:id`

Route/controller files:

- [backend/src/modules/research/routes/drdReview.routes.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/routes/drdReview.routes.js)
- [backend/src/modules/research/controllers/drdReview.controller.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/controllers/drdReview.controller.js)

### 6. Collaborative Editing APIs

Base path:

- `/api/v1/research/collaborative-editing`

Observed capabilities:

- collaborative session start/get/end
- single suggestion submission
- suggestion response
- batch suggestion submission and response
- review history
- mentor suggestion endpoints

Route/controller files:

- [backend/src/modules/research/routes/collaborativeEditing.routes.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/routes/collaborativeEditing.routes.js)
- [backend/src/modules/research/controllers/collaborativeEditing.controller.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/controllers/collaborativeEditing.controller.js)

### 7. Google Docs Review APIs

Base path:

- `/api/v1/research/google-docs`

Endpoints:

- `GET /document/:iprApplicationId/:fieldName`
- `POST /submit-change`
- `POST /accept-change/:changeId`
- `POST /reject-change/:changeId`
- `GET /pending-changes/:iprApplicationId`
- `POST /save-draft`
- `GET /status/:iprApplicationId`

Route/controller files:

- [backend/src/modules/research/routes/googleDocs.routes.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/routes/googleDocs.routes.js)
- [backend/src/modules/research/controllers/googleDocs.controller.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/controllers/googleDocs.controller.js)

### 8. DRD Analytics APIs

Base path:

- `/api/v1/drd-analytics`

Applicant analytics endpoints:

- `GET /applicant`
- `GET /applicant/category-breakdown`
- `GET /applicant/schools/:schoolId`
- `GET /applicant/departments/:departmentId`
- `GET /applicant/people/:personId`
- `GET /applicant/people/:personId/submissions`

DRD member analytics endpoints:

- `GET /drd-member`
- `GET /drd-member/reviewers/:reviewerId`
- `GET /drd-member/performance`
- `GET /drd-member/performance/:reviewerId`

Progress tracker analytics endpoints:

- `GET /progress-tracker`
- `GET /progress-tracker/records`

Route/controller/service files:

- [backend/src/modules/drd-analytics/routes/drdAnalytics.routes.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/drd-analytics/routes/drdAnalytics.routes.js)
- [backend/src/modules/drd-analytics/controllers/drdAnalytics.controller.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/drd-analytics/controllers/drdAnalytics.controller.js)
- [backend/src/modules/drd-analytics/services/drdAnalytics.service.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/drd-analytics/services/drdAnalytics.service.js)

---

## Main Findings

### High Severity

#### 1. DRD applicant analytics loads raw rows for multiple categories and aggregates in memory

Risk:

- high memory usage
- slow response times as data volume grows
- multi-category requests become increasingly expensive

Why:

- `category=all` resolves multiple categories
- each category fetches raw rows with `findMany`
- results are merged and aggregated in Node.js rather than at the database layer

Key references:

- [backend/src/modules/drd-analytics/services/drdAnalytics.service.js#L992](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/drd-analytics/services/drdAnalytics.service.js#L992)
- [backend/src/modules/drd-analytics/services/drdAnalytics.service.js#L996](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/drd-analytics/services/drdAnalytics.service.js#L996)
- [backend/src/modules/drd-analytics/services/drdAnalytics.service.js#L1011](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/drd-analytics/services/drdAnalytics.service.js#L1011)

#### 2. Research author creation is a write-side N+1 pattern

Risk:

- slow submission latency on contributions with many authors
- multiple serial DB round-trips per author

Why:

- each author may trigger:
  - user lookup
  - author insert
  - notification insert

Key references:

- [backend/src/modules/research/services/contribution.service.js#L496](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/services/contribution.service.js#L496)
- [backend/src/modules/research/services/contribution.service.js#L499](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/services/contribution.service.js#L499)
- [backend/src/modules/research/services/contribution.service.js#L526](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/services/contribution.service.js#L526)
- [backend/src/modules/research/services/contribution.service.js#L563](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/services/contribution.service.js#L563)

#### 3. IPR contributor creation and contributor notification are also N+1 patterns

Risk:

- slow create and submit paths for IPR applications with many inventors/contributors

Why:

- contributor creation loop performs per-contributor user lookup and insert
- contributor notification loop performs per-contributor user lookup and insert

Key references:

- [backend/src/modules/ipr/services/ipr.service.js#L212](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/services/ipr.service.js#L212)
- [backend/src/modules/ipr/services/ipr.service.js#L218](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/services/ipr.service.js#L218)
- [backend/src/modules/ipr/services/ipr.service.js#L222](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/services/ipr.service.js#L222)
- [backend/src/modules/ipr/services/ipr.service.js#L237](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/services/ipr.service.js#L237)
- [backend/src/modules/ipr/services/ipr.service.js#L550](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/services/ipr.service.js#L550)
- [backend/src/modules/ipr/services/ipr.service.js#L554](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/services/ipr.service.js#L554)

#### 4. Mentor queue and mentor history flows rely on `mentorUid` without indexes

Risk:

- mentor pending/history endpoints will get slower as tables grow

Why:

- both Research and IPR query applicant-details rows by `mentorUid`
- `mentorUid` is present in schema but not indexed

Key references:

- [backend/src/modules/research/repositories/contribution.repository.js#L128](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/repositories/contribution.repository.js#L128)
- [backend/src/modules/ipr/services/ipr.service.js#L1090](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/services/ipr.service.js#L1090)
- [backend/prisma/schema.prisma#L1402](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/prisma/schema.prisma#L1402)
- [backend/prisma/schema.prisma#L891](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/prisma/schema.prisma#L891)

#### 5. Review queue logic depends on review decisions, but review decision is not indexed

Risk:

- slower approval/recommendation queue queries
- slower relation-filter queries as review history grows

Why:

- queries depend on `reviews.some({ decision: ... })`
- review tables index the parent FK and reviewer
- no visible index on `decision`
- no visible composite on parent FK plus decision

Key references:

- [backend/src/modules/research/services/review.service.js#L1040](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/services/review.service.js#L1040)
- [backend/src/modules/research/services/review.service.js#L1065](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/services/review.service.js#L1065)
- [backend/prisma/schema.prisma#L1485](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/prisma/schema.prisma#L1485)
- [backend/prisma/schema.prisma#L1486](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/prisma/schema.prisma#L1486)
- [backend/prisma/schema.prisma#L951](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/prisma/schema.prisma#L951)
- [backend/prisma/schema.prisma#L952](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/prisma/schema.prisma#L952)

### Medium Severity

#### 6. Review endpoints re-fetch DRD permission data on hot paths

Risk:

- extra per-request queries on hot review queue endpoints

Why:

- review queue services query DRD department and permission records each time
- some of this could be reused from auth context or cached more aggressively

Key references:

- [backend/src/modules/research/services/review.service.js#L1000](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/services/review.service.js#L1000)
- [backend/src/modules/research/services/review.service.js#L1004](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/services/review.service.js#L1004)
- [backend/src/modules/research/services/review.service.js#L1132](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/services/review.service.js#L1132)
- [backend/src/modules/research/services/review.service.js#L1134](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/services/review.service.js#L1134)

#### 7. Workflow-health queries filter on `currentReviewerId` and stale `updatedAt` without supporting indexes

Risk:

- counts may degrade into broader scans at scale

Why:

- several health checks filter by:
  - `status`
  - `currentReviewerId`
  - `updatedAt`
- current schema does not show dedicated indexes for these patterns

Key references:

- [backend/src/modules/research/services/review.service.js#L912](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/services/review.service.js#L912)
- [backend/src/modules/research/services/review.service.js#L919](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/services/review.service.js#L919)
- [backend/src/modules/research/services/review.service.js#L925](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/services/review.service.js#L925)
- [backend/src/modules/research/services/review.service.js#L940](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/services/review.service.js#L940)
- [backend/prisma/schema.prisma#L1283](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/prisma/schema.prisma#L1283)
- [backend/prisma/schema.prisma#L1330](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/prisma/schema.prisma#L1330)
- [backend/prisma/schema.prisma#L819](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/prisma/schema.prisma#L819)
- [backend/prisma/schema.prisma#L828](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/prisma/schema.prisma#L828)

#### 8. Stats endpoints use repeated `count()` scans instead of more consolidated aggregation

Risk:

- repeated work against the same filtered dataset

Why:

- main IPR stats path uses multiple separate counts plus groupBy
- legacy `ipr/management` route follows a similar pattern

Key references:

- [backend/src/modules/ipr/services/ipr.service.js#L914](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/services/ipr.service.js#L914)
- [backend/src/modules/ipr/services/ipr.service.js#L926](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/services/ipr.service.js#L926)
- [backend/src/modules/ipr/routes/iprManagement.routes.js#L96](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/routes/iprManagement.routes.js#L96)

#### 9. Unpaginated list branches still exist in some hot user-facing endpoints

Risk:

- very large user histories can produce large payloads and slow responses

Examples:

- research my-contributions non-paginated path
- IPR my-applications without pagination
- IPR mentor history loads all mentor-linked applications

Key references:

- [backend/src/modules/research/controllers/contribution.controller.js#L236](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/controllers/contribution.controller.js#L236)
- [backend/src/modules/ipr/services/ipr.service.js#L746](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/services/ipr.service.js#L746)
- [backend/src/modules/ipr/services/ipr.service.js#L1090](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/services/ipr.service.js#L1090)

### Low to Medium Severity

#### 10. DRD review controller has multiple notification fan-out loops

Risk:

- slower write actions for review status changes
- less impact on read latency than the issues above

Key references:

- [backend/src/modules/research/controllers/drdReview.controller.js#L4](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/controllers/drdReview.controller.js#L4)
- [backend/src/modules/research/controllers/drdReview.controller.js#L16](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/controllers/drdReview.controller.js#L16)
- [backend/src/modules/research/controllers/drdReview.controller.js#L1368](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/controllers/drdReview.controller.js#L1368)
- [backend/src/modules/research/controllers/drdReview.controller.js#L1818](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/controllers/drdReview.controller.js#L1818)

---

## Existing Index Coverage

### ResearchContribution

Observed useful indexes:

- `applicantUserId`
- `status`
- `publicationType`
- `schoolId`
- `departmentId`
- `submittedAt`
- `schoolId, submittedAt`
- `departmentId, submittedAt`
- `publicationType, schoolId, submittedAt`
- `conferenceSubType`

Reference:

- [backend/prisma/schema.prisma#L1379](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/prisma/schema.prisma#L1379)

### IprApplication

Observed useful indexes:

- `applicantUserId`
- `iprType`
- `schoolId`
- `departmentId`
- `status`
- `submittedAt`
- `schoolId, submittedAt`
- `sourceProvisionalId`

Reference:

- [backend/prisma/schema.prisma#L855](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/prisma/schema.prisma#L855)

### Related tables with existing FK indexes

- `ResearchContributionAuthor.userId`
- `ResearchContributionAuthor.researchContributionId`
- `ResearchContributionReview.reviewerId`
- `ResearchContributionReview.researchContributionId`
- `ResearchContributionEditSuggestion.reviewerId`
- `ResearchContributionEditSuggestion.researchContributionId`
- `IprContributor.iprApplicationId`
- `IprContributor.userId`
- `IprReview.iprApplicationId`
- `IprReview.reviewerId`
- `IprEditSuggestion.iprApplicationId`
- `IprEditSuggestion.reviewerId`
- `IprEditSuggestion.status`

References:

- [backend/prisma/schema.prisma#L1463](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/prisma/schema.prisma#L1463)
- [backend/prisma/schema.prisma#L1485](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/prisma/schema.prisma#L1485)
- [backend/prisma/schema.prisma#L1524](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/prisma/schema.prisma#L1524)
- [backend/prisma/schema.prisma#L917](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/prisma/schema.prisma#L917)
- [backend/prisma/schema.prisma#L951](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/prisma/schema.prisma#L951)
- [backend/prisma/schema.prisma#L974](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/prisma/schema.prisma#L974)

---

## Likely Missing Indexes For Current Query Patterns

Highest-value candidates based on observed queries:

- `ResearchContributionApplicantDetails.mentorUid`
- `IprApplicantDetails.mentorUid`
- `ResearchContribution.currentReviewerId`
- `IprApplication.currentReviewerId`
- `ResearchContributionReview.decision`
- `IprReview.decision`
- composite `(researchContributionId, decision)`
- composite `(iprApplicationId, decision)`
- possibly composite `(status, currentReviewerId)` for workflow-health and reviewer dashboards

Why these matter:

- mentor queues filter by `mentorUid`
- review queues filter by current reviewer ownership and recommendation decisions
- workflow-health scans filter by `status`, `currentReviewerId`, and freshness windows

---

## Highest-Value Optimization Targets

### P0

- DRD applicant analytics endpoints
- mentor queue and mentor history endpoints
- review queue filters that rely on recommendation decision scans

### P1

- research author creation path
- IPR contributor creation path
- IPR contributor notification path
- repeated stats endpoints using many `count()` calls

### P2

- legacy `ipr/management` analytics route
- remaining notification fan-out loops in DRD/IPR workflow controllers

---

## Practical Summary

The biggest read-side risk is not a classic per-row N+1 on list pages. The largest current slowdown risk is:

- analytics paths loading too many raw rows
- mentor and review queues relying on unindexed lookup fields
- repeated count scans for dashboards and stats

The clearest true N+1 patterns are on write paths:

- research author creation
- IPR contributor creation
- contributor/inventor notification fan-out

If this system feels slow in production, the most likely first bottlenecks are:

1. `/api/v1/drd-analytics/applicant`
2. mentor pending/history endpoints
3. DRD review queue endpoints
4. contribution or IPR submission flows with many collaborators

---

## Audit Basis

Main files reviewed during this audit include:

- [backend/src/modules/research/routes/contribution.routes.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/routes/contribution.routes.js)
- [backend/src/modules/research/routes/progressTracker.routes.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/routes/progressTracker.routes.js)
- [backend/src/modules/research/routes/drdReview.routes.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/routes/drdReview.routes.js)
- [backend/src/modules/research/routes/collaborativeEditing.routes.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/routes/collaborativeEditing.routes.js)
- [backend/src/modules/research/routes/googleDocs.routes.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/routes/googleDocs.routes.js)
- [backend/src/modules/research/controllers/contribution.controller.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/controllers/contribution.controller.js)
- [backend/src/modules/research/controllers/review.controller.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/controllers/review.controller.js)
- [backend/src/modules/research/controllers/progressTracker.controller.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/controllers/progressTracker.controller.js)
- [backend/src/modules/research/controllers/drdReview.controller.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/controllers/drdReview.controller.js)
- [backend/src/modules/research/services/contribution.service.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/services/contribution.service.js)
- [backend/src/modules/research/services/review.service.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/research/services/review.service.js)
- [backend/src/modules/ipr/routes/ipr.routes.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/routes/ipr.routes.js)
- [backend/src/modules/ipr/routes/iprManagement.routes.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/routes/iprManagement.routes.js)
- [backend/src/modules/ipr/controllers/ipr.controller.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/controllers/ipr.controller.js)
- [backend/src/modules/ipr/services/ipr.service.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/ipr/services/ipr.service.js)
- [backend/src/modules/drd-analytics/routes/drdAnalytics.routes.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/drd-analytics/routes/drdAnalytics.routes.js)
- [backend/src/modules/drd-analytics/services/drdAnalytics.service.js](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/src/modules/drd-analytics/services/drdAnalytics.service.js)
- [backend/prisma/schema.prisma](/c:/Users/MY/Desktop/ums/Sgt-Ums/backend/prisma/schema.prisma)
