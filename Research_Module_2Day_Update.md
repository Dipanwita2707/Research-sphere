# 2-Day Sprint — Functional Update Report
**Module: Research Publication & Profile System**
**Period: Day 1–2 | No UI or SaaS-level changes included**

---

## 1. Automated Research Publication Fetching (Multi-Source Sync Engine)

### What was built
A full automated publication discovery engine (`PublicationSyncService`) that fetches a faculty member's research output from **three external academic databases** simultaneously and merges results into a single deduplicated list.

### Sources Integrated

| Source | Trigger | Identifier Used |
|---|---|---|
| **Scopus** (Elsevier API) | Scopus Author ID | `AU-ID(scopusAuthorId)` query |
| **ORCID** | ORCID iD | Per-work detail fetch using `put-code` |
| **OpenAlex** (free) | Faculty display name + institution | Author name search + institution scoring |

### How the Merge Works
- Each source returns a list of `candidate` publications.
- Candidates are keyed by `doi:` → `external_id:` → `title+year:` (in priority order).
- If the same paper appears in multiple sources (e.g., both Scopus and OpenAlex), they are **merged** — the richer field value wins, and both `sourceSystems` are retained.
- Final candidates are sorted by `publicationDate` descending before processing.

### Sync Triggers
| Trigger Type | When it fires |
|---|---|
| `manual` | Faculty clicks "Sync Now" |
| `auto_on_identity_update` | ORCID is added/changed on the profile → sync fires automatically |
| `scheduled` | Daily cron job runs `runScheduledSync()` — only fires for identities whose `syncFrequencyDays` has elapsed since `lastSyncedAt` |

### Concurrent Sync Guard
A running-sync lock was implemented to prevent duplicate imports:
```
If a sync run with status='running' exists for this identity
AND it started within the last 30 minutes
→ Skip the new sync trigger entirely (return early with a warning)
```
This prevents duplicate contributions from being created during race conditions.

---

## 2. Identity Verification — Scopus ID & ORCID Ownership Check

### Problem solved
Previously, any faculty could input someone else's Scopus Author ID and pull that person's publications under their own profile.

### What was implemented
When a faculty member saves their research profile identity (Scopus Author ID or ORCID), the system **cross-verifies** the ID against OpenAlex before saving:

**For Scopus Author ID:**
```
GET https://api.openalex.org/authors?filter=ids.scopus:{scopusAuthorId}
→ Fetch the author's display name from OpenAlex
→ Compare against the logged-in faculty's display name (fuzzy match)
→ If names don't match → reject with 400 error
```

**For ORCID:**
```
GET https://api.openalex.org/authors?filter=orcid:{orcid}
→ Same name verification process
```

**Name matching algorithm**: Uses a token-by-token fuzzy comparison with Levenshtein edit distance to handle:
- Initial vs full name (`"Prateek A."` vs `"Prateek Agrawal"`)
- Spelling variants (`"Dipanwita"` vs `"Dipanwitha"`)
- Title prefixes (Dr., Prof., Mr. are stripped before comparison)

---

## 3. SGT Affiliation Detection (Dual-Method)

### Method A — Name-based matching
A curated list of **18 affiliation name variants** is maintained in the service:
```
"SGT University", "SGTU", "Shree Guru Gobind Singh Tricentenary University",
"Shri Guru Gobind Singhji Tricentenary University", "SGT University Gurugram",
"SGT University Haryana", "SGT University Budhera", ... (and more variants)
```
All affiliation strings from papers are normalized (lowercased, punctuation stripped) and checked against this list.

### Method B — Scopus AFID matching (fast path)
Four known **Scopus Institution IDs** for SGT University are hardcoded in a `Set`:
```
'60113772'  → Shree Guru Gobind Singh Tricentenary University, Gurugram
'124037491' → SGT University Gurugram
'123581218' → SGT University
'133421016' → Shree Guru Gobind Singh Tricentenary (SGT) University
```
Each Scopus author record carries an `afid[]` array. If any of the author's `afid` values are in this set, they are immediately flagged as `isSgtByAfid = true` — **without needing the affiliation text to match**.

### What this powers
- `sgtAffiliatedAuthors` count on every contribution (used in incentive calculation)
- `affiliationSummary` JSON stored in `indexingDetails` (per-author breakdown of SGT vs non-SGT vs international)
- The `filterSgtOnly` flag on a profile identity: if enabled, papers where the faculty member's affiliation is **not** SGT are automatically skipped during import

---

## 4. H-Index & Citation Count — Now Stored in the Module

### What was added
Every auto-imported contribution now captures and stores **citation count** from the source API response:

| Source | Field mapped | Storage |
|---|---|---|
| Scopus | `citedby-count` | `citationCount` on candidate → stored in `indexingDetails.citationCount` |
| OpenAlex | `cited_by_count` | Same path |
| Manual import | `citationCount` field (optional) | Same path |

### Where it is stored
Citation count is written into `indexingDetails` (a JSON column on `ResearchContribution`):
```json
{
  "citationCount": 42,
  "sourceSystems": ["scopus", "openalex"],
  "importConfidence": 85,
  "affiliationSummary": { ... }
}
```

### On re-sync (updates)
The `_updateExistingContribution` method checks `indexingDetails` and updates `citationCount` on every sync so it stays fresh without faculty intervention.

> **Note:** H-index itself is a derived metric across all publications (not per-paper). The individual citation counts are now stored per-contribution so that H-index can be computed client-side or in analytics queries by ranking contributions by `citationCount`.

---

## 5. Smart Author Matching & Deduplication

### Internal author resolution (4-tier cascade)
When a paper is imported, each co-author is matched against the internal user database:

| Priority | Signal | Confidence |
|---|---|---|
| 1 | Scopus Author ID (`authid`) matches a user's `researchProfileIdentity.scopusAuthorId` | 1.0 (definitive) |
| 2 | Email match against `UserLogin.email` | 1.0 (definitive) |
| 3 | UID / registration number match | 1.0 (definitive) |
| 4 | Display name (case-insensitive) + SGT affiliation flag | 0.55–0.7 (fuzzy) |

### Deduplication within a paper
- A `seenUserIds` Set prevents the same person from appearing twice (e.g., as "Prateek Agrawal" in Scopus and "P. Agrawal" in ORCID).
- An `_authorMatchCache` (Map, cleared after each sync) caches lookup results per sync run to avoid repeated DB queries for the same co-author across multiple papers.

### Author role assignment
Author roles are derived automatically:
- `order === 1 && isCorresponding` → `first_and_corresponding_author`
- `order === 1` → `first_author`
- `isCorresponding` → `corresponding_author`
- Otherwise → `co_author`

---

## 6. Duplicate Contribution Detection (4-Level Lookup)

Before creating a new contribution from a synced paper, the system checks for an existing one using:

1. **Publication import index** → `publicationImport` table lookup by `sourceSystem + externalId` (fastest — direct FK)
2. **DOI field match** → `researchContribution.doi = candidate.doi`
3. **externalIds JSON scan** → Catches orphaned duplicates where the import link wasn't created (e.g., during a failed concurrent sync)
4. **Title + year match** → Normalized title comparison (lowercased, punctuation removed) + publication year range

If a duplicate is found → **update** (smart merge, never overwrite user-edited fields).
If not found → **create** new contribution and immediately auto-submit it.

---

## 7. Research Progress Tracker — Full CRUD & Status Lifecycle

### What was built
A standalone module `progressTracker.controller.js` for faculty to track research from writing phase to publication, **before** it reaches the formal incentive submission stage.

### Status Flow
```
writing → communicated → submitted → accepted → published
                     ↘ rejected → (back to any earlier stage)
```

### Key functional behaviors
- **Tracking number generated** on creation: format `TRP-YYYYMM-0001` (e.g., `TRP-202605-0023`)
- **Monthly progress reports**: Faculty can submit updates **without changing status** (flagged as `isMonthlyReport`)
- **Status history**: Every transition (and every monthly update) is recorded in `ResearchProgressStatusHistory` with timestamp, notes, and attached status-specific JSON data
- **Tracker → Contribution link**: Once a tracker reaches `published`, it can be directly submitted for incentive — the tracker ID is attached to the created `ResearchContribution`
- **Cache invalidation**: On every create/update/status-change, the DRD analytics cache (`drd:tracker:*`) is invalidated so dashboards reflect current state immediately
- **Audit logged**: All creates, updates, status changes, and deletions are recorded in the audit log

---

## 8. Block-Based Role Permission System — Analytics Scope Added

### What changed in `roleManagement.controller.js`
Role permissions were extended to include an **analytics scope** layer on top of module-level access. When a role is assigned to a user, the system now also resolves and stores which schools/departments that role is allowed to see analytics data for:

```javascript
analyticsScope: {
  research: { schools: [...schoolIds], departments: [...deptIds] },
  ipr:      { schools: [...], departments: [...] },
  book:     { schools: [...], departments: [...] },
  conference: { ... },
  grants:   { ... }
}
```

These values are written into `CentralDepartmentPermission` columns:
- `assignedResearchAnalyticsSchoolIds`
- `assignedIprAnalyticsSchoolIds`
- `assignedBookAnalyticsSchoolIds`
- `assignedConferenceAnalyticsSchoolIds`
- `assignedGrantAnalyticsSchoolIds`

This means a DRD officer can now have **granular, field-level access** to research analytics — scoped to only the schools and departments they are responsible for.

---

## 9. Auto-Import → Auto-Submit Pipeline

When the sync engine creates a new contribution from an external source, it automatically moves it through the workflow:

```
_upsertCandidate()
    │
    ├── createContribution(payload, {})   ← creates in 'draft' status
    │
    └── submitContribution(id, userId)    ← immediately moves to 'submitted'
                                            (bypassing manual submit step)
```

**Edge case handled**: If a concurrent sync already advanced the status beyond `draft`, the `submitContribution` call throws a 400. This is explicitly caught and swallowed — the contribution is still valid, just already further in the workflow.

---

## Summary of Backend Files Changed

| File | Change |
|---|---|
| `backend/src/modules/research/services/publicationSync.service.js` | Full sync engine: Scopus, ORCID, OpenAlex fetch + merge + affiliation detection + citation count |
| `backend/src/modules/research/controllers/profileIdentity.controller.js` | Identity update with auto-sync trigger on ORCID change; identity verification |
| `backend/src/modules/research/services/contribution.service.js` | Auto-import source type bypass of manual validation; batch author insert; student school/dept fallback |
| `backend/src/modules/research/controllers/progressTracker.controller.js` | Full CRUD for research progress tracker with status lifecycle, monthly reports, audit logging |
| `backend/src/modules/core/controllers/roleManagement.controller.js` | Analytics scope builder added to role permissions — block-level school/dept access control |
| `backend/src/jobs/publicationSync.job.js` | Scheduled sync job wiring `runScheduledSync()` |
