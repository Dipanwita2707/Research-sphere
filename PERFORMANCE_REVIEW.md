# 🔍 Performance Review: Noting, DSW & Event Modules

> **Review Date:** June 2025
> **Problem:** Pages take 10-15 seconds to load data. Excessive buffering, slow page transitions, slow data display.
> **Scope:** Full backend + frontend review with focus on Noting, DSW, and Event modules.

---

## 📊 Executive Summary

The 10-15 second load times are caused by a **combination of factors** working together:

| Layer | Root Cause | Impact |
|-------|-----------|--------|
| **Database** | Neon serverless cold starts + tiny connection pool | 2-5s on first request |
| **Backend** | Heavy auth middleware query on every request | 0.5-2s per API call |
| **Backend** | Too many DB queries per endpoint (6-12 queries) | 1-5s per endpoint |
| **Backend** | Deep nested includes over-fetching data | 1-3s per query |
| **Backend** | Full table scans from `contains` + `insensitive` search | 1-5s per search |
| **Frontend** | No data prefetching, no skeleton loading | Perceived 100% of wait time |
| **Frontend** | DSW uses separate axios instance with no timeout | Unbounded wait time |
| **Network** | 30s timeout + 3 retries = 120s worst case | Compounds all delays |

**Total worst case: First page load after inactivity = 5s (cold start) + 2s (auth) + 3s (query) + 2s (network overhead) = ~12s**

---

## 🚨 CRITICAL (P0) — Root Causes of 10-15s Load Times

### 1. Neon Serverless Database Cold Starts

**File:** `backend/src/shared/config/database.js`

**Problem:** Neon PostgreSQL is serverless. After periods of inactivity, the compute endpoint "sleeps" and the first connection takes **2-5 seconds** to wake up. Your connection pool is tiny:
- Production: `connection_limit=10`
- Development: `connection_limit=5`

With multiple concurrent users, connections get exhausted and new requests queue behind the cold start.

**Fix:**
```
- Enable Neon "Always On" compute (paid feature) OR
- Add a keep-alive ping (cron job every 4 minutes hitting /health that does a simple DB query)
- Increase connection_limit to 20-25 in production
- Add pgbouncer connection pooling URL from Neon dashboard (pooled connection string)
```

---

### 2. Auth Middleware: Heavy Query on EVERY Request

**File:** `backend/src/shared/middleware/auth.js` → `protect()`

**Problem:** Every single API call triggers the `protect` middleware which, on cache miss, runs:
1. `userLogin.findUnique` with nested `centralDeptPermissions` + `schoolDeptPermissions`
2. `role.findMany` for all assigned roles
3. Complex JavaScript permission merging logic

Even with Redis cache, the first request after TTL expiry or cold start hits the full DB path. The cache key is per-user, so each unique user's first request is slow.

**Impact:** 0.5-2 seconds added to EVERY API call on cache miss.

**Fix:**
```
- Increase cache TTL for user sessions (currently CACHE_TTL.USER_SESSION — verify it's at least 15-30 minutes)
- Pre-warm cache on login: After successful login, immediately cache the user's full permission object
- Use a leaner select in the auth query — you don't need employeeDetails for auth, just permissions
- Consider storing permissions in the JWT token itself (signed, not encrypted) to eliminate the DB/cache lookup entirely
- Add a "warming" endpoint that pre-loads frequently accessed users into cache on server startup
```

---

### 3. Noting "Handled" Tab: 6 Database Queries Per Load

**File:** `backend/src/modules/noting/controllers/noting.controller.js` → `list()` with `filter=handled`

**Problem:** When the "Handled by Me" tab loads (which is the default `includeCounts=true`), it fires:

| # | Query | Purpose |
|---|-------|---------|
| 1 | Raw SQL `COUNT(DISTINCT note_id)` | Total handled count for pagination |
| 2 | Raw SQL with `ROW_NUMBER()` window function | Get paginated handled note IDs |
| 3 | `prisma.note.findMany` with nested includes | Fetch actual note data |
| 4 | `prisma.note.count` (mine) | Tab badge count |
| 5 | Raw SQL `COUNT(DISTINCT note_id)` (handled) | Tab badge count |
| 6 | `prisma.note.count` (pending) | Tab badge count |

**Total: 6 DB queries per page load.** Queries 4-6 are ADDITIONAL to the main data fetch just for tab badge counts.

**Fix:**
```
- Move tab counts to a SEPARATE lightweight endpoint called once on page mount, not on every filter/page change
- Cache the counts on the frontend with a longer staleTime (e.g., 5 minutes) — counts don't need to be real-time
- For the "handled" query, create a database VIEW or materialized view for the handled notes subquery
- Add a composite index: CREATE INDEX idx_note_history_user_action ON note_history(performed_by_id, action)
- Consider denormalizing: add a "lastHandledAt" timestamp on the Note model to avoid the window function
```

---

### 4. Event `getEventDetails()`: Fetches ALL Registrations + Volunteers

**File:** `backend/src/modules/event-management/services/event.service.js` → `getEventDetails()`

**Problem:** The detail view fetches:
- **ALL** `EventRegistration` records (no pagination, no limit)
- **ALL** `EventVolunteer` records with deeply nested user details
- **ALL** `EventCustomField` records
- **ALL** `EventPrize` records
- Plus 2 additional parallel queries (registration count, user's own registration)

For a popular event with 500+ registrations, this returns a massive JSON payload.

**Fix:**
```
- DON'T include EventRegistration in the detail query — it's not shown on the detail page
- Only fetch the registration COUNT (you already do this with a separate count query)
- Paginate volunteers if there are more than 20
- Use select instead of include for EventCustomField and EventPrize (only return needed fields)
- The user's own registration is a good parallel query — keep that
```

---

### 5. Event `getEventStatistics()`: 12 Queries + Full Table Scan

**File:** `backend/src/modules/event-management/services/event.service.js` → `getEventStatistics()`

**Problem:** Fires **12 parallel database queries** including:
- 8 separate `count()` queries
- 1 `aggregate()` query for revenue
- 1 `findMany` on ALL registrations (no limit!) just to group by date in JavaScript
- 1 `findMany` on recent 50 registrations with nested user includes

The registrations `findMany` without limit is a **full table scan** — for events with thousands of registrations, this alone takes seconds.

**Fix:**
```
- Replace the full table scan with a SQL GROUP BY query:
  SELECT DATE(registered_at) as date, COUNT(*) as count
  FROM event_registration WHERE event_id = $1
  GROUP BY DATE(registered_at) ORDER BY date
- Combine the 8 count queries into a single raw SQL query with CASE WHEN:
  SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
    COUNT(*) FILTER (WHERE status = 'waitlisted') as waitlisted,
    COUNT(*) FILTER (WHERE has_entered = true) as attended,
    SUM(amount_paid) FILTER (WHERE payment_status = 'completed') as revenue
  FROM event_registration WHERE event_id = $1;
- This reduces 12 queries to 3 (stats + date grouping + recent registrations)
```

---

### 6. `contains` + `mode: 'insensitive'` = Full Table Scans Everywhere

**Files:**
- `noting.controller.js` → `list()` search (notingId, description)
- `noting.controller.js` → `searchEmployees()` (uid, email, displayName, firstName, lastName, empId — **6 OR conditions!**)
- `clubService.js` → `getClubs()` search (name, purpose, clubId)
- `event.service.js` → `listEvents()` search (name, description, eventId)

**Problem:** Prisma's `contains` with `mode: 'insensitive'` translates to SQL `ILIKE '%term%'`. This **cannot use any B-tree index** and results in a sequential scan of the entire table. With 6 OR conditions in `searchEmployees`, it scans the table 6 times.

**Impact:** 1-5 seconds per search query depending on table size.

**Fix:**
```
- Install PostgreSQL pg_trgm extension: CREATE EXTENSION IF NOT EXISTS pg_trgm;
- Create GIN trigram indexes on searchable columns:
  CREATE INDEX idx_note_notingid_trgm ON note USING GIN (noting_id gin_trgm_ops);
  CREATE INDEX idx_note_description_trgm ON note USING GIN (description gin_trgm_ops);
  CREATE INDEX idx_user_uid_trgm ON user_login USING GIN (uid gin_trgm_ops);
  CREATE INDEX idx_employee_displayname_trgm ON employee_details USING GIN (display_name gin_trgm_ops);
  CREATE INDEX idx_club_name_trgm ON club USING GIN (name gin_trgm_ops);
  CREATE INDEX idx_event_name_trgm ON event USING GIN (name gin_trgm_ops);
- For employee search, add a computed full-text search column or limit to startsWith instead of contains
- Add debounce on frontend (already done for DSW/events, but verify noting search)
```

---

### 7. Frontend API: 30s Timeout + 3 Retries = 120s Worst Case

**File:** `frontend/src/shared/api/api.ts`

**Problem:**
```js
const TIMEOUT = isDev ? 15000 : 30000; // 30s in production!
const MAX_RETRIES = isDev ? 1 : 3;     // 3 retries in production!
```

If the database is slow (cold start, heavy query), the user waits up to 30 seconds before timeout, then the retry logic kicks in with exponential backoff (1s → 2s → 4s). **Total worst case: 30s + 31s + 32s + 34s ≈ 120 seconds.**

**Fix:**
```
- Reduce production timeout to 10-15 seconds (no API call should take 30s)
- Reduce MAX_RETRIES to 1 in production (if it fails twice, show error)
- Don't retry on timeout errors — if the server is overloaded, retries make it worse
- Add a fast-fail for specific endpoints (e.g., list endpoints should timeout at 8s)
```

---

## ⚠️ HIGH (P1) — Significant Performance Contributors

### 8. DSW Has a SEPARATE Axios Instance (No Timeout, No Retry)

**File:** `frontend/src/features/dsw/services/api.ts`

**Problem:** DSW creates its own `axios.create()` with:
- ❌ No `baseURL` (uses relative URLs — works via Next.js proxy but adds an extra hop)
- ❌ No `timeout` (browser default ~300 seconds!)
- ❌ No retry logic
- ❌ No request ID tracking
- ❌ Duplicates auth token logic from `shared/api/api.ts`

If the DSW API is slow, users wait indefinitely with no timeout.

**Fix:**
```
- Remove the separate axios instance in dsw/services/api.ts
- Import and use the shared api instance from @/shared/api/api
- Update all DSW API endpoints to use the shared instance's baseURL pattern
- This gives DSW the same timeout, retry, and logging behavior as other modules
```

---

### 9. Noting List View Fetches 50 History Records Per Note

**File:** `backend/src/modules/noting/utils/selectFragments.js` → `getListNoteInclude()`

**Problem:**
```js
history: {
  select: { performedById: true },
  take: 50, // 50 history records per note!
},
```

For a list of 20 notes, this fetches up to **1,000 history records**. The only purpose is to check if an approver has acted (for the edit/delete button logic).

**Fix:**
```
- Replace with _count: { select: { history: { where: { performedById: { not: createdById } } } } }
- Or add a denormalized boolean field "hasApproverAction" on the Note model
- Or move the edit/delete permission check to the detail view only
- Minimum fix: reduce take from 50 to 1 (you only need to know IF any approver acted, not all actions)
```

---

### 10. Double-Fetch Pattern in Noting Create/Approve/Forward

**File:** `backend/src/modules/noting/controllers/noting.controller.js`

**Problem:** In `create()`:
```js
// First fetch with full include:
const note = await prisma.note.create({ ..., include: getFullNoteInclude() });
// ... workflow logic ...
// Second fetch with same include:
const updatedNote = await prisma.note.findUnique({ where: { id: note.id }, include: getFullNoteInclude() });
```

Same pattern in `approve()`, `forward()`, `submitDraft()`. Each action hits the DB **twice** for the same data.

**Fix:**
```
- Return the data from the update/create query directly (Prisma supports include on update)
- For create → update pattern, only do the findUnique at the end, not on create
- For approve/forward, use the update query's return value with include
```

---

### 11. No Data Prefetching on Frontend

**Files:** All page components (`noting/page.tsx`, `events/page.tsx`, `dsw/clubs/page.tsx`)

**Problem:** Every page navigation triggers fresh API calls. Users see loading spinners on every click. No data is prefetched on hover or route transition.

**Fix:**
```tsx
// In layout.tsx or link components, prefetch on hover:
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

// Prefetch on hover
<Link
  href={`/noting/${note.id}`}
  onMouseEnter={() => {
    queryClient.prefetchQuery({
      queryKey: ['noting', note.id],
      queryFn: () => notingService.getById(note.id),
      staleTime: 60 * 1000,
    });
  }}
>

// Also add staleTime to detail queries:
export function useNote(id: string) {
  return useQuery({
    queryKey: NOTING_QUERY_KEYS.detail(id),
    queryFn: () => notingService.getById(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes — ADD THIS
  });
}
```

---

### 12. Noting Detail & Event Detail: No `staleTime`

**Files:**
- `frontend/src/features/noting-management/hooks/useNoting.ts` → `useNote()`
- `frontend/src/features/event-management/hooks/useEvents.ts` → `useEvent()`

**Problem:** Both hooks have `staleTime` of 0 (default). This means:
- Every time user navigates to a detail page → fresh API call
- Going back to list → fresh API call
- Switching tabs and returning → fresh API call

**Fix:**
```
- Add staleTime: 2 * 60 * 1000 (2 minutes) to useNote() and useEvent()
- Add staleTime: 5 * 60 * 1000 (5 minutes) to useCategories() — categories rarely change
- Keep useNotingList at 1 minute (already set) — good
```

---

### 13. DSW `getClubById()` Fetches ALL Members Without Pagination

**File:** `backend/src/modules/dsw/services/clubService.js` → `getClubById()`

**Problem:** Includes ALL active members with nested student details, no limit, no pagination. A popular club with 200+ members returns a huge payload.

**Fix:**
```
- Add pagination to members: take: 20, skip: 0
- Return _count.members for total count (already done)
- Create a separate /clubs/:id/members endpoint with pagination (already exists — use it)
- In the detail include, only fetch the first 10 members as a preview
```

---

### 14. DSW `getClubStatistics()`: 9 Database Queries

**File:** `backend/src/modules/dsw/services/clubService.js` → `getClubStatistics()`

**Problem:** 8 parallel Promise.all queries + 1 follow-up category name query.

**Fix:**
```
- Combine counts into a single raw SQL query:
  SELECT
    COUNT(*) as total_clubs,
    COUNT(*) FILTER (WHERE status = 'active') as active_clubs,
    (SELECT COUNT(*) FROM club_member WHERE is_active = true) as total_members,
    (SELECT COUNT(*) FROM club_category) as total_categories
  FROM club;
- Cache statistics for 5 minutes (they don't need to be real-time)
- Add a /statistics endpoint that returns pre-computed stats from cache
```

---

## 🔧 MEDIUM (P2) — Optimization Opportunities

### 15. Missing Database Indexes

**Problem:** Common filter/sort columns likely have no indexes.

**Fix — Add these indexes in a Prisma migration:**
```prisma
// schema.prisma additions:

@@index([createdById])           // on Note model — "My Notes" filter
@@index([currentHolderId, status]) // on Note model — "Pending" filter
@@index([status, createdAt])     // on Note model — status filter + sort
@@index([performedById, action]) // on NoteHistory model — "Handled" filter
@@index([status, createdAt])     // on Event model — list filter + sort
@@index([createdById])           // on Event model — "My Events" filter
@@index([eventId, status])       // on EventRegistration — registration counts
@@index([eventId, userId])       // on EventRegistration — user's registration check
@@index([status, categoryId])    // on Club model — club list filter
@@index([clubId, isActive])      // on ClubMember — active member count
```

---

### 16. Event `listEvents()` Extra GroupBy Query

**File:** `backend/src/modules/event-management/services/event.service.js` → `listEvents()`

**Problem:** After fetching events, fires a separate `eventRegistration.groupBy` query for registration counts.

**Fix:**
```
- Use Prisma _count in the original query:
  include: {
    _count: { select: { EventRegistration: { where: { status: 'confirmed' } } } }
  }
- This eliminates the extra query entirely
```

---

### 17. `getEligibleForwardTargets()` for DEAN Role: Fetches ALL Users

**File:** `backend/src/modules/noting/services/approvalFlow.service.js`

**Problem:** When a DEAN forwards a note, fetches ALL active users with ALL permissions, then checks permission on each one via `Promise.all`.

**Fix:**
```
- Use a SQL query that joins users with their permissions and filters by the required permission key
- Cache the list of users with specific permissions (e.g., "users with noting_approve")
- Add pagination/limit to the results (DEAN doesn't need to see 10,000 users)
```

---

### 18. No HTTP Response Caching Headers

**Problem:** API responses have no `Cache-Control`, `ETag`, or `Last-Modified` headers. Browser can't cache any API response.

**Fix:**
```js
// Add to server.js or as middleware:
app.use('/api/v1/noting/config', (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=3600'); // Config rarely changes
  next();
});

// For list endpoints, use ETag:
app.use('/api/v1/noting', (req, res, next) => {
  res.set('Cache-Control', 'private, max-age=0, must-revalidate');
  next();
});

// For static data (categories, event types):
app.use('/api/v1/dsw/categories', (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=86400'); // 24 hours
  next();
});
```

---

### 19. `stripHtml()` Creates DOM Elements Per Render

**File:** `frontend/src/app/noting/page.tsx`

**Problem:**
```js
const stripHtml = (html: string) => {
  const tmp = document.createElement('div'); // Creates DOM element on every call!
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};
```

Called for every note in the list, on every render.

**Fix:**
```js
// Use regex instead:
const stripHtml = (html: string) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
};
// Or memoize the result using useMemo
```

---

### 20. ApprovalFlow Service: Multiple Sequential DB Queries

**File:** `backend/src/modules/noting/services/approvalFlow.service.js` → `determineNextApproverByReporting()`

**Problem:** Runs 3 sequential queries: creator → manager → manager permissions.

**Fix:**
```
- Combine into a single query using Prisma's nested include:
  prisma.userLogin.findUnique({
    where: { id: note.createdById },
    include: {
      reportingTo: {  // assuming a self-relation
        include: {
          centralDeptPermissions: true,
          schoolDeptPermissions: true,
        }
      }
    }
  })
- Or use a single raw SQL query with JOIN
```

---

## 💡 LOW (P3) — Nice-to-Have Improvements

### 21. No List Virtualization
- For long lists (50+ items), use `react-window` or `@tanstack/react-virtual` to only render visible items

### 22. No Optimistic Updates on Mutations
- Delete/approve/reject operations wait for server confirmation. Use React Query's `onMutate` for instant UI feedback

### 23. Large Icon Bundle from lucide-react
- Verify tree-shaking is working. Consider importing icons individually: `import { Plus } from 'lucide-react/dist/esm/icons/plus'`

### 24. No Dynamic Imports for Heavy Sections
- Filter panels, modals, and form components could use `React.lazy()` / `next/dynamic`

### 25. DSW Toast Not Integrated
- `useDSWToast` hook just does `console.log`. Use the shared `useToast` from `@/shared/ui-components/Toast`

---

## 🏗️ Implementation Priority & Estimated Impact

| Priority | Fix | Estimated Time Saved | Effort |
|----------|-----|---------------------|--------|
| **P0-1** | Neon keep-alive + connection pool increase | 2-5s on cold starts | 1 hour |
| **P0-2** | Pre-warm auth cache on login | 0.5-2s per first request | 2 hours |
| **P0-3** | Separate counts endpoint + cache | 1-2s on noting list | 3 hours |
| **P0-4** | Remove ALL registrations from event detail | 1-3s on event pages | 1 hour |
| **P0-5** | Single SQL for event statistics | 2-4s on statistics page | 2 hours |
| **P0-6** | Add trigram indexes for search | 1-5s on every search | 2 hours |
| **P0-7** | Reduce API timeout to 10s, retries to 1 | Faster failure feedback | 30 mins |
| **P1-8** | Use shared axios instance for DSW | Prevents infinite waits | 2 hours |
| **P1-9** | Reduce history `take` from 50 to 1 | 0.5-1s on noting list | 30 mins |
| **P1-10** | Remove double-fetch in create/approve | 0.5-1s per action | 1 hour |
| **P1-11** | Add prefetchQuery on link hover | 1-3s perceived improvement | 2 hours |
| **P1-12** | Add staleTime to detail queries | Eliminates redundant fetches | 30 mins |
| **P2-15** | Add database indexes | 0.5-2s on all queries | 1 hour |
| **P2-16** | Use _count instead of groupBy for events | 0.5-1s on event list | 30 mins |

---

## 🚀 Quick Wins (Can Fix in < 30 Minutes Each)

1. **Reduce API timeout** from 30s → 10s and retries from 3 → 1 (`frontend/src/shared/api/api.ts`)
2. **Add staleTime** to `useNote()` and `useEvent()` hooks (2 minutes)
3. **Reduce history take** from 50 → 1 in `getListNoteInclude()` (`backend/src/modules/noting/utils/selectFragments.js`)
4. **Fix stripHtml** to use regex instead of DOM creation (`frontend/src/app/noting/page.tsx`)
5. **Remove EventRegistration** from `getEventDetails()` include (not needed for detail view)

---

## 📝 Notes

- The Prisma schema file was not accessible in this review. The index recommendations above should be validated against the actual schema.
- Redis cache behavior depends on `CACHE_TTL.USER_SESSION` value which is defined in `redis.js` — verify it's set to at least 15-30 minutes.
- All "Fix" sections are recommendations only. No code was changed during this review.
- Consider adding application-level monitoring (e.g., response time logging per endpoint) to identify which specific endpoints are the slowest in production. The server already has a >500ms slow request logger in development — enable this in production too.

---

## ✅ IMPLEMENTED FIXES (Feb 2025)

| Fix | Status |
|-----|--------|
| P0-1 Database: connection_limit 25 prod, keep-alive 4min | ✅ Done |
| P0-2 Auth: Pre-warm cache on login, USER_SESSION 30min | ✅ Done |
| P0-4 Event detail: Remove ALL registrations from include | ✅ Done |
| P0-5 Event statistics: Single raw SQL for counts + date grouping | ✅ Done |
| P0-6 Trigram indexes: pg_trgm + GIN indexes for search | ✅ Done (migration) |
| P0-7 API: Timeout 10-12s, retries 0-1, no retry on timeout | ✅ Done |
| P1-8 DSW: Uses shared api (already fixed) | ✅ Done |
| P1-9 Noting history: take 1 (already fixed) | ✅ Done |
| P1-11 Prefetch on link hover (noting list) | ✅ Done |
| P1-12 staleTime on useNote/useEvent (already 2min) | ✅ Done |
| P1-13 DSW getClubById: members take 10 | ✅ Done |
| P2-18 Cache headers for config/categories | ✅ Done |
| stripHtml: regex (already fixed) | ✅ Done |
