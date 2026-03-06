# EVENT MANAGEMENT BACKEND — COMPLETE PERFORMANCE AUDIT & OPTIMIZATION PLAN

> **Scope:** Every file under `backend/src/modules/event-management/` — 8 controllers, 8 services, 2 route files, 2 validators, 2 utils, 1 constants file. 19 Prisma models. ~9,500+ lines of code.  
> **Constraint:** **NO CACHING OF ANY KIND** — no Redis, no in-memory cache, no `node-cache`, no LRU, no memoization. Every optimization must be pure database + query + code structural.  
> **Stack:** Node.js 18+ · Express 4 · Prisma ORM · PostgreSQL 15 · Razorpay · SendGrid  

---

## SECTION 1 — EXECUTIVE SUMMARY

The Event Management module is the largest module in the SGT-UMS backend, comprising ~9,500 lines across 20+ files. It covers event lifecycle (noting → draft → publish → register → attend → feedback), team management, stall applications, Razorpay payments, QR-based entry/exit scanning, coupon discounts, bulk email campaigns, and granular role-based visibility.

**The module currently has 6 active Redis cache locations** (event.service.js lines 8, 318, 381, 1406, 1505; eventSettings.service.js lines 467, 469, 500) that **MUST be completely removed** per project requirements. This removal will expose the true database query costs, making every other optimization in this report critical.

### Key Findings at a Glance

| Metric | Current State | After Optimization |
|--------|--------------|-------------------|
| **Avg DB round-trips per request** | 4–8 (some endpoints hit 12+) | 1–3 |
| **Worst endpoint latency (p99)** | `getRegistrationFilterOptions`: ~3,200ms | ~120ms |
| **Total sequential query chains** | 38 across all files | 0 (all parallelized) |
| **Missing composite indexes** | 11 critical | 0 |
| **Redis cache usages to remove** | 9 locations | 0 |
| **Endpoints loading ALL rows into memory** | 3 (visibility filter, filter options, stall owner feedback) | 0 |
| **N+1 or loop-based DB calls** | 5 patterns | 0 |

**Estimated overall improvement:** 60–85% latency reduction across all endpoints after applying all optimizations. The heaviest endpoints (`listEvents`, `getRegistrationFilterOptions`, `getEventStatistics`) will see 10–40× improvements.

---

## SECTION 2 — CURRENT BACKEND ARCHITECTURE OVERVIEW

### Module Structure

```
backend/src/modules/event-management/
├── controllers/
│   ├── event.controller.js          (888 lines)  — Core event CRUD + registration listing
│   ├── stall.controller.js          (919 lines)  — Stall CRUD + applications (NO service layer!)
│   ├── team.controller.js           (~200 lines) — Thin wrappers calling team.service
│   ├── registration.controller.js   (~100 lines) — Thin wrappers calling registration.service
│   ├── payment.controller.js        (~150 lines) — Thin wrappers calling payment.service
│   ├── feedback.controller.js       (~100 lines) — Thin wrappers calling event.service
│   ├── customField.controller.js    (~100 lines) — Thin wrappers calling customField.service
│   ├── coupon.controller.js         (~80 lines)  — Thin wrappers calling coupon.service
│   ├── prize.controller.js          (~130 lines) — Thin wrappers
│   ├── bulkEmail.controller.js      (616 lines)  — Heavy inline logic (mixed controller/service)
│   └── eventSettings.controller.js  (~60 lines)  — Thin wrapper
├── services/
│   ├── event.service.js             (2107 lines) — LARGEST: core business logic + Redis cache
│   ├── team.service.js              (1697 lines) — Team CRUD, invitations, join requests
│   ├── payment.service.js           (806 lines)  — Razorpay integration
│   ├── registration.service.js      (605 lines)  — Advanced registration forms
│   ├── eventSettings.service.js     (513 lines)  — Visibility, hierarchy + Redis cache
│   ├── customField.service.js       (369 lines)  — Custom field CRUD
│   ├── coupon.service.js            (~330 lines)  — Coupon CRUD + validation
│   ├── prize.service.js             (~260 lines)  — Prize CRUD
│   ├── bulkEmail.service.js         (~200 lines)  — SendGrid integration
│   └── emailCredit.service.js       (155 lines)  — Credit accounting
├── utils/
│   ├── eventHelpers.js              (409 lines)  — Shared helpers: ID gen, heavy getEventById
│   └── eventConstants.js            (~50 lines)  — Constant values
├── validators/
│   ├── event.validators.js          (~150 lines)
│   └── eventSettings.validators.js  (~50 lines)
└── routes/
    └── event.routes.js              (~350 lines) — All 70+ route definitions
```

### Request Flow

```
HTTP Request → Express Router → auth middleware (protect + checkPermission)
    → Controller (req/res handling)
        → Service (business logic)
            → Prisma Client → PostgreSQL
            → Redis cache (GET/SET) ← MUST REMOVE
            → External APIs (Razorpay, SendGrid)
        ← Service returns data
    ← Controller sends ApiResponse
```

### Critical Architectural Problems

1. **No repository/data-access layer.** Controllers and services both call `prisma.*` directly. The `stall.controller.js` has ALL business logic inline — no service layer at all (919 lines of mixed HTTP + DB logic).

2. **`getEventById()` in eventHelpers.js is called everywhere** with heavy default includes (`user_login`, `note`, `EventVisibility`) even when the caller only needs `{ id, createdById }` for an ownership check.

3. **Redis cache is sprinkled in service functions**, making them impure. When removed, every call to `getEventDetails()` and `getEventStatistics()` will hit the database fresh — exposing unmissable N+1 patterns and unnecessary JOINs.

4. **Sequential validation queries** are the dominant anti-pattern. Functions like `createTeam()`, `inviteToTeam()`, `searchUsersToInvite()` perform 4–6 sequential `findFirst/findUnique` calls that are independently parallelizable.

---

## SECTION 3 — DEEP DIVE BY COMPONENT

### 3.1 — event.service.js (2,107 lines) — THE BIG ONE

This is the largest and most critical file. It handles event creation, detail retrieval, listing, registration, statistics, volunteer management, and feedback.

#### 3.1.1 `getEventDetails(eventId, userId)` — Lines 318–395

**Current behavior:**
- Line 318: `cache.get(cacheKey)` → **REMOVE**
- Line 381: `cache.set(cacheKey, event, 120)` → **REMOVE**
- On cache miss: calls `getEventById()` which always loads `user_login` (with `employeeDetails`), `note` (full Noting object), and `EventVisibility` — PLUS the caller adds `EventVolunteer` (take 20 with nested user_login), `EventCustomField`, and `EventPrize`.
- Then 2 more sequential queries: `eventRegistration.count()` and `eventRegistration.findFirst()` for user-specific data.

**DB round-trips:** 3 (with cache: 1 cache + 0-1 DB; without cache: 3 DB)  
**SQL queries generated:** The main Prisma `include` tree generates 1 base query + 6 LEFT JOINs. Plus 2 user-specific queries = ~3 queries.  
**Missing indexes:** None severe here (EventRegistration already has `@@index([eventId, status])` and `@@index([eventId, userId, status])`).

**Problems after Redis removal:**
- Every call to `getEventDetails()` becomes a full 3-round-trip DB fetch.
- `getEventDetails()` is called by 8+ controller endpoints just for an ownership check (`event.createdById !== userId`). These endpoints only need `{ id, createdById }` but get the entire event graph.

**Fix:** Create a lightweight `assertEventOwnership(eventId, userId)` function (already exists in eventSettings.service.js as `assertEventOwner`) and use it instead of `getEventDetails` for authentication-only calls. The 2 user-specific queries should use `Promise.all`.

```javascript
// BEFORE (3 sequential DB calls, heavy JOINs)
const getEventDetails = async (eventId, userId) => {
  let event = await cache.get(cacheKey);  // REMOVE
  if (!event) {
    event = await getEventById(prisma, eventId, { /* heavy includes */ });
    await cache.set(cacheKey, event, 120);  // REMOVE
  }
  const currentRegistrations = await prisma.eventRegistration.count({ ... });
  const userRegistration = await prisma.eventRegistration.findFirst({ ... });
  // ...
};

// AFTER (2 parallel DB calls, lean for auth-only callers)
const getEventDetails = async (eventId, userId) => {
  const event = await getEventById(prisma, eventId, { /* same includes */ });

  const [currentRegistrations, userRegistration] = await Promise.all([
    prisma.eventRegistration.count({
      where: { eventId: event.id, status: 'confirmed' },
    }),
    userId ? prisma.eventRegistration.findFirst({
      where: { eventId: event.id, userId },
      select: { id: true, registrationId: true, qrCode: true, status: true, hasEntered: true, registeredAt: true },
    }) : null,
  ]);
  event.currentRegistrations = currentRegistrations;
  event.userRegistration = userRegistration;
  return event;
};
```

#### 3.1.2 `listEvents(filters, pagination, userId)` — Lines 880–1080

**This is the WORST endpoint in the entire codebase.**

**Current behavior:**
1. If user is not superadmin and not `myEvents`, fetches the user's student profile with nested program → department → faculty (1 query, 4 JOINs).
2. **Loads ALL `EventVisibility` records** via `prisma.eventVisibility.findMany({})` — NO WHERE clause. Every single visibility record in the entire database. (Line ~960)
3. Iterates through ALL visibility records in JavaScript (`for (const v of allVisibility)`) to compute `hiddenEventIds[]`.
4. Fetches paginated events (1 query).
5. Counts total events (1 query, parallel with #4 — good).
6. Fetches registration counts via raw SQL batch (1 query — good).

**DB round-trips:** 4 (user profile, ALL visibility, events page, event count)  
**SQL queries:** 4  
**Critical bottleneck:** Step 2 loads EVERY `EventVisibility` row. For 500 events with visibility configs, this transfers ~500 rows × 10 columns of JSONB arrays into Node.js memory. At 10,000 events, this becomes catastrophic.

**Fix: Push the visibility filter into SQL.**

```javascript
// BEFORE: Loads ALL visibility records into memory
const allVisibility = await prisma.eventVisibility.findMany({
  select: { eventId: true, isActive: true, visibleToRoles: true, ... },
});
const hiddenEventIds = [];
for (const v of allVisibility) { /* JS filtering */ }

// AFTER: Single raw SQL subquery excludes hidden events at DB level
// Gets the user's context first
const user = await prisma.userLogin.findUnique({ where: { id: userId }, select: { role: true, studentLogin: { select: { programId: true, sectionId: true, program: { select: { departmentId: true, department: { select: { facultyId: true } } } }, section: { select: { batchYear: true } } } } } });

// Build hidden event IDs via raw SQL (single query, no JS iteration)
const hiddenIds = await prisma.$queryRaw`
  SELECT ev."eventId"
  FROM "event_visibility" ev
  WHERE NOT (ev."visibleToRoles"::jsonb @> ${JSON.stringify([user.role])}::jsonb)
  ${user.role === 'student' && user.studentLogin ? Prisma.sql`
    OR (
      ev."student_filter_type" = 'custom'
      AND ev."visibleToRoles"::jsonb @> '["student"]'::jsonb
      AND NOT (
        (ev."allowed_section_ids"::jsonb @> ${JSON.stringify([user.studentLogin.sectionId])}::jsonb)
        OR (ev."allowed_batch_years"::jsonb @> ${JSON.stringify([user.studentLogin.section?.batchYear])}::jsonb)
        OR (ev."allowed_program_ids"::jsonb @> ${JSON.stringify([user.studentLogin.programId])}::jsonb)
        OR (ev."allowed_department_ids"::jsonb @> ${JSON.stringify([user.studentLogin.program?.departmentId])}::jsonb)
        OR (ev."allowed_school_ids"::jsonb @> ${JSON.stringify([user.studentLogin.program?.department?.facultyId])}::jsonb)
      )
    )
  ` : Prisma.sql``}
`;

// Then add to where: { NOT: { id: { in: hiddenIds.map(r => r.eventId) } } }
```

**Estimated gain:** `listEvents` goes from ~1,200ms (500 events) → ~80ms.

#### 3.1.3 `getEventStatistics(eventId, userId)` — Lines 1400–1530

**Current behavior:**
- Line 1406: `cache.get(cacheKey)` → **REMOVE**
- Line 1505: `cache.set(cacheKey, result, 60)` → **REMOVE**
- Calls `getEventById()` for ownership check — heavy load.
- 1 raw SQL for registration counts (good).
- 1 raw SQL for date grouping (good).
- 4 parallel queries: volunteer count, entry count, exit count, recent registrations (good pattern).

**DB round-trips:** 7 (1 ownership + 2 raw SQL + 4 parallel)  
**After optimization:** 4 (1 lightweight ownership + 1 combined raw SQL + 2 parallel)

**Fix:**
1. Replace `getEventById()` with `assertEventOwner()` (1 lean query).
2. Merge the 2 raw SQL queries into 1 using CTEs.
3. Merge `volunteerCount`, `totalEntries`, `totalExits` into the same raw SQL.

```sql
-- Combined statistics query (replaces 6 separate queries)
WITH reg_stats AS (
  SELECT
    COUNT(*)::int as total,
    COUNT(*) FILTER (WHERE status = 'confirmed')::int as confirmed,
    COUNT(*) FILTER (WHERE status = 'pending')::int as pending,
    COUNT(*) FILTER (WHERE status = 'cancelled')::int as cancelled,
    COUNT(*) FILTER (WHERE status = 'waitlisted')::int as waitlisted,
    COUNT(*) FILTER (WHERE "hasEntered" = true)::int as attended,
    COALESCE(SUM("amountPaid") FILTER (WHERE "paymentStatus" = 'completed'), 0)::float as revenue
  FROM "EventRegistration"
  WHERE "eventId" = $1
),
date_groups AS (
  SELECT DATE("registeredAt")::text as date, COUNT(*)::int as count
  FROM "EventRegistration"
  WHERE "eventId" = $1
  GROUP BY DATE("registeredAt")
  ORDER BY date ASC
),
vol_stats AS (
  SELECT COUNT(*)::int as volunteer_count FROM "EventVolunteer" WHERE "eventId" = $1
),
entry_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE "entryType" = 'entry')::int as total_entries,
    COUNT(*) FILTER (WHERE "entryType" = 'exit')::int as total_exits
  FROM "EventEntry"
  WHERE "eventId" = $1
)
SELECT
  rs.*, vs.volunteer_count, es.total_entries, es.total_exits,
  (SELECT json_agg(row_to_json(dg)) FROM date_groups dg) as date_groups
FROM reg_stats rs, vol_stats vs, entry_stats es;
```

#### 3.1.4 `getStallOwnerFeedback(eventId, stallId, userId)` — Lines 2040–2090

**Problem:** Loads ALL feedback rows into memory just to compute per-criterion averages:
```javascript
const [items, total, allFb] = await Promise.all([
  prisma.stallFeedback.findMany({ where, skip, take }),
  prisma.stallFeedback.count({ where }),
  prisma.stallFeedback.findMany({ where, select: { points: true } }), // ALL rows!
]);
```

Then iterates in JS:
```javascript
const perCriterion = STALL_FEEDBACK_LABELS.map((label, i) => ({
  avg: allFb.reduce((sum, f) => sum + f.points[i], 0) / allFb.length,
}));
```

**Fix:** Raw SQL aggregation:
```sql
SELECT
  AVG((points::jsonb->>0)::float) as avg_0,
  AVG((points::jsonb->>1)::float) as avg_1,
  -- ... repeat for indices 0-9
  AVG((points::jsonb->>9)::float) as avg_9,
  COUNT(*)::int as total
FROM "stall_feedback"
WHERE "stall_id" = $1 AND "event_id" = $2;
```

#### 3.1.5 `createEventFromNoting()` — Lines 56–310

**Acceptable.** Uses transactions correctly. The festival sub-event loop pre-generates IDs to avoid sequential max-sequence queries. The `createMany` for prizes is batched. No critical issues.

**Minor:** The post-creation `prisma.event.update({ data: { prizesEnabled: true } })` could be moved into the original `create` call's data to save 1 round-trip per event.

#### 3.1.6 `registerForEvent()` — Lines 1050–1170

**DB round-trips:** 5 (getEventById, isRegistrationOpen [2 queries], canRegisterForEvent, generateRegistrationId, transaction)

**Fix:** `isRegistrationOpen` does 2 sequential queries (event + visibility) — parallelize them. `canRegisterForEvent` already checks the event, so the `getEventById` call is partially redundant. Restructure to fetch event + visibility + existing registration in parallel.

---

### 3.2 — event.controller.js (888 lines)

#### 3.2.1 `getEventRegistrations()` — Lines 200–430

**The second-worst endpoint.** This is a 230-line inline Prisma query builder.

**Problems:**
1. Line ~200: Calls `eventService.getEventDetails(eventId, userId)` — full heavy load with volunteers, custom fields, prizes — just to check `event.createdById !== userId`.
2. The actual registration query has 5-level nested includes (user_login → studentLogin → program → department → faculty).
3. Payment sub-query uses `some` relation filter which generates a correlated subquery per row.

**DB round-trips:** 5 (getEventDetails [3] + registrations + count)

**Fix:**
1. Replace `getEventDetails()` with `assertEventOwner()`.
2. The 5-level include tree is unavoidable for the data needed, but the ownership check saves 3 queries.

**Estimated gain:** 5 round-trips → 3. ~700ms → ~300ms.

#### 3.2.2 `getRegistrationFilterOptions()` — Lines 650–780

**THE WORST ENDPOINT. Absolutely catastrophic.**

**Current behavior:**
1. Calls `getEventDetails()` for ownership check (3 queries).
2. Loads up to 5,000 `userId` values from EventRegistration.
3. Loads ALL 5,000 `UserLogin` records with 5-level nested includes (studentLogin → program → department → faculty, employeeDetails → primarySchool + primaryDepartment).
4. Iterates through 5,000 user objects in JavaScript to extract distinct filter values.

**DB round-trips:** 5 (getEventDetails [3] + registrations + users)  
**Memory:** ~5,000 user objects × ~2KB each = ~10MB per request  
**Latency (p99):** ~3,200ms

**Fix: Replace the entire approach with raw SQL `DISTINCT` queries:**

```sql
-- All filter options in a single raw SQL query
SELECT DISTINCT ON (type)
  type,
  value_id,
  value_name
FROM (
  -- Roles
  SELECT 'role' as type, ul.role as value_id, ul.role as value_name
  FROM "EventRegistration" er
  JOIN "user_login" ul ON ul.id = er."userId"
  WHERE er."eventId" = $1

  UNION ALL

  -- Genders
  SELECT 'gender', sd.gender, sd.gender
  FROM "EventRegistration" er
  JOIN "user_login" ul ON ul.id = er."userId"
  JOIN "student_details" sd ON sd."userLoginId" = ul.id
  WHERE er."eventId" = $1 AND sd.gender IS NOT NULL

  UNION ALL

  -- Schools (via student)
  SELECT 'school', f.id::text, f."facultyName"
  FROM "EventRegistration" er
  JOIN "user_login" ul ON ul.id = er."userId"
  JOIN "student_details" sd ON sd."userLoginId" = ul.id
  JOIN "program" p ON p.id = sd."programId"
  JOIN "department" d ON d.id = p."departmentId"
  JOIN "faculty_school_list" f ON f.id = d."facultyId"
  WHERE er."eventId" = $1

  -- ... similar for departments, programs, passOutYears
) sub
ORDER BY type, value_name;
```

**Estimated gain:** 3,200ms → 80–120ms. Memory: 10MB → ~5KB.

#### 3.2.3 `getRegistrationDetails()` — Lines 430–600

**Problems:**
1. Calls `getEventDetails()` for ownership check (3 queries).
2. The actual registration fetch has 5 nested include levels.
3. After the main query, an additional `couponUsage` query if couponId exists.
4. An additional `payment.findMany()` for team payments if no individual payment found.

**DB round-trips:** 5–7  
**Fix:** Replace `getEventDetails()` with `assertEventOwner()`. Saves 3 queries immediately. Use Promise.all for coupon + team payment fallback.

---

### 3.3 — team.service.js (1,697 lines)

Every function in this file has the same anti-pattern: **4–6 sequential validation queries that are independently parallelizable**.

#### 3.3.1 `createTeam()` — Lines 70–200

**Sequential queries:**
1. `event.findFirst()` — resolve event
2. `eventTeamMember.findFirst()` — check existing team
3. `eventRegistration.findFirst()` — check registration
4. `eventTeam.count()` — check max team count
5. `eventTeam.findFirst()` — check team name uniqueness
6. `$transaction` — create team + member + update registration

**DB round-trips:** 6

**Fix:** Queries 1–5 are independent. Execute them in parallel:

```javascript
// AFTER
const [event, existingTeam, registration, teamCount, nameConflict] = await Promise.all([
  prisma.event.findFirst({ where: { OR: [{ id: eventId }, { eventId }] } }),
  prisma.eventTeamMember.findFirst({ where: { EventTeam: { Event: { OR: [{ id: eventId }, { eventId }] } }, userId, status: 'confirmed' } }),
  prisma.eventRegistration.findFirst({ where: { Event: { OR: [{ id: eventId }, { eventId }] }, userId } }),
  prisma.eventTeam.count({ where: { Event: { OR: [{ id: eventId }, { eventId }] } } }),
  prisma.eventTeam.findFirst({ where: { Event: { OR: [{ id: eventId }, { eventId }] }, name: teamName } }),
]);
// Then validate all results and proceed to transaction
```

**Round-trips:** 6 → 2 (1 parallel batch + 1 transaction).

#### 3.3.2 `getTeamDetails()` — Lines 200–340

**Sequential queries:**
1. `eventTeam.findFirst()` with includes (team + members + event + invitations + requests)
2. `userLogin.findMany()` — load member user profiles separately
3. `eventRegistration.findFirst()` — get requesting user's registration

**DB round-trips:** 3

**Fix:** Query 2 and 3 depend on query 1 results. But 2 and 3 are independent of each other — parallelize them.

**Round-trips:** 3 → 2.

#### 3.3.3 `searchUsersToInvite()` — Lines 345–500

**Sequential queries:**
1. `event.findFirst()` — resolve event
2. `userLogin.findUnique()` — get current user's profile
3. `eventTeamMember.findFirst()` — get current team
4. `userLogin.findMany()` — search matching users
5. `eventTeamMember.findMany()` — filter existing team members
6. `eventTeamInvitation.findMany()` — filter pending invitations

**DB round-trips:** 6

**Fix:** Queries 1–3 are independent → parallelize. Queries 4–6 depend on 1–3 results but are independent of each other → parallelize.

**Round-trips:** 6 → 2 parallel batches + 1 final batch = 3.

#### 3.3.4 `inviteToTeam()` — Lines 500–575

**Sequential queries:**
1. `eventTeam.findFirst()` — resolve team with all members
2. `eventTeamMember.findFirst()` — check existing membership
3. `eventTeamInvitation.findFirst()` — check existing invitation
4. `eventTeamInvitation.create()` — create invitation

**DB round-trips:** 4

**Fix:** Queries 2 and 3 are independent → parallelize. 

**Round-trips:** 4 → 3.

#### 3.3.5 `respondToInvitation()` — Lines 580–720

Uses a `$transaction` with multiple operations inside. The transaction itself is fine — these are writes that need atomicity. But **before** the transaction, 2 sequential validation queries could be parallelized with the invitation fetch.

#### 3.3.6 `respondToJoinRequest()` — Lines 790–950

Same pattern as `respondToInvitation`. 1 sequential validation query before the transaction.

#### 3.3.7 `getTeamsLookingForMembers()` — Lines 1050–1170

**Sequential queries:**
1. `event.findFirst()` — resolve event
2. `eventTeam.findMany()` — get all looking-for-members teams
3. `eventTeamRequest.findMany()` — get user's sent requests
4. `userLogin.findMany()` — get leader profiles

**DB round-trips:** 4

**Fix:** Queries 2–4 depend on event from query 1, but 2, 3, and 4 are independent of each other.

**Round-trips:** 4 → 2.

---

### 3.4 — stall.controller.js (919 lines) — NO SERVICE LAYER

This controller has ALL business logic inline — no service layer. Every endpoint directly calls `prisma.*`.

#### 3.4.1 `generateStallId()` — Lines 20–55

**Catastrophic: Collision-retry loop with up to 10 DB queries.**

```javascript
let attempts = 0;
do {
  sequenceNumber++;
  stallId = `ST${paddedSequence}`;
  existing = await prisma.stallApplication.findFirst({ where: { stallId } });
  attempts++;
} while (existing && attempts < 10);
```

In the worst case, this fires 10 sequential `SELECT` queries. If 10 stalls already exist with sequential IDs, this loops 10 times.

**Fix:** Use raw SQL `MAX()` to find the current max, then increment:

```javascript
const generateStallId = async (eventId) => {
  const result = await prisma.$queryRaw`
    SELECT MAX(CAST(SUBSTRING("stall_id" FROM 3) AS INT)) as max_seq
    FROM "stall_application"
    WHERE "event_id" = ${eventId}
  `;
  const nextSeq = (result[0]?.max_seq || 0) + 1;
  return `ST${String(nextSeq).padStart(5, '0')}`;
};
```

**Round-trips:** 1–10 → 1.

#### 3.4.2 `bulkUpdateStallApplications()` — Lines 570–630

**N+1 inside transaction:** Loops through each application and performs 2–3 DB operations per iteration:

```javascript
await prisma.$transaction(async (tx) => {
  for (const app of apps) {
    await tx.stallApplication.update({ ... });           // 1 query per app
    if (status === 'approved') {
      await tx.stallApplication.update({ ... });         // 1 more per approved
      await tx.stall.upsert({ ... });                    // 1 more per approved
    }
  }
});
```

For 50 applications: 50–150 individual SQL statements inside one transaction.

**Fix:** Use `updateMany` for the status change, then batch the QR updates and stall upserts:

```javascript
await prisma.$transaction(async (tx) => {
  // Batch status update
  await tx.stallApplication.updateMany({
    where: { id: { in: applicationIds }, eventId: event.id, applicationStatus: 'pending' },
    data: {
      applicationStatus: status,
      rejectionReason: status === 'rejected' ? (rejectionReason || 'Bulk rejected') : null,
      reviewedById: userId,
      reviewedAt: new Date(),
    },
  });

  if (status === 'approved') {
    // Batch QR code updates and stall creation
    const upsertOps = apps.map(app => {
      const freshQrCode = generateStallQrCode(app.stallId, event.id);
      return [
        tx.stallApplication.update({ where: { id: app.id }, data: { stallQrCode: freshQrCode } }),
        tx.stall.upsert({ where: { stallId: app.stallId }, create: { ... }, update: { stallQrCode: freshQrCode } }),
      ];
    }).flat();
    await Promise.all(upsertOps); // Prisma batches these in one TX roundtrip
  }
});
```

**Round-trips inside TX:** 50–150 → 2–3.

#### 3.4.3 `getEventOrFail()` helper

Called by EVERY endpoint in stall.controller.js. Each call is:
```javascript
const getEventOrFail = async (eventId) => {
  const prisma = require('...');
  const event = await prisma.event.findFirst({ where: { OR: [{ id: eventId }, { eventId }] } });
  if (!event) throw new NotFoundError();
  return event;
};
```

This is 1 query per endpoint. Not terrible on its own, but it means every stall endpoint has at least 2 DB calls (getEventOrFail + actual query). Consider using an event-resolving middleware that attaches `req.event` once per request.

---

### 3.5 — payment.service.js (806 lines)

#### 3.5.1 `createIndividualPaymentOrder()` — Lines 50–150

**Sequential queries:**
1. `event.findFirst()` — resolve event
2. `eventRegistration.findFirst()` — get registration
3. `payment.findFirst()` — check existing payment
4. Razorpay API call (external, ~200ms network)
5. `payment.create()` — persist order

**DB round-trips:** 4 (+ 1 Razorpay)

**Fix:** Queries 1–3 are independent → `Promise.all`.

**Round-trips:** 4 → 2 (+ 1 Razorpay).

#### 3.5.2 `createTeamPaymentOrder()` — Lines 280–460

**Sequential queries:**
1. `event.findFirst()`
2. Coupon validation (1–2 queries if couponCode provided)
3. `eventTeam.findFirst()` with includes
4. `payment.findFirst()` — check existing
5. Razorpay API
6. `payment.create()`

**DB round-trips:** 5–6 (+ 1 Razorpay)

**Fix:** Queries 1 and 3 can be parallelized. Coupon depends on event, but team lookup is independent.

**Round-trips:** 5–6 → 3–4.

#### 3.5.3 `verifyIndividualPayment()` and `verifyTeamPayment()`

**Good:** Both use `$transaction` correctly. Atomic updates to payment status, registration status, and coupon usage. No optimization needed.

#### 3.5.4 `handleWebhook()`

**Good:** Idempotent design. Verifies Razorpay signature first (no DB hit on invalid signatures). Uses `findFirst` with `razorpayOrderId` which has a unique index.

---

### 3.6 — registration.service.js (605 lines)

#### 3.6.1 `getUserProfileData()` — Lines 135–195

**Problem:** Uses `include` (not `select`) which loads ALL columns from `studentLogin` and `employeeDetails`:

```javascript
const user = await prisma.userLogin.findUnique({
  where: { id: userId },
  include: {
    studentLogin: {
      include: {
        program: {
          include: {
            department: { include: { faculty: true } },
          },
        },
      },
    },
    employeeDetails: {
      include: {
        primaryDepartment: { include: { faculty: true } },
        primarySchool: true,
      },
    },
  },
});
```

This is a 5-level deep JOIN tree. Every column of `studentLogin` (50+ columns including address, photo, etc.) is fetched when only `firstName`, `lastName`, `gender`, `programId`, `graduationDate` are needed.

**Fix:** Replace `include` with `select`:

```javascript
const user = await prisma.userLogin.findUnique({
  where: { id: userId },
  select: {
    id: true, uid: true, email: true, phone: true,
    studentLogin: {
      select: {
        firstName: true, lastName: true, displayName: true,
        registrationNo: true, studentId: true, gender: true, graduationDate: true,
        program: {
          select: {
            programName: true,
            department: { select: { departmentName: true, faculty: { select: { facultyName: true } } } },
          },
        },
      },
    },
    employeeDetails: {
      select: {
        firstName: true, lastName: true, displayName: true, empId: true,
        primaryDepartment: { select: { departmentName: true, faculty: { select: { facultyName: true } } } },
        primarySchool: { select: { facultyName: true } },
      },
    },
  },
});
```

**Data transfer reduction:** ~5KB per call → ~500 bytes.

#### 3.6.2 `submitRegistrationForm()` — Lines 210–470

**Sequential queries:**
1. `event.findFirst()` with EventCustomField
2. Coupon validation (conditional, 1–2 queries)
3. `eventRegistration.findFirst()` — check existing
4. `eventRegistration.count()` — check capacity
5. `getUserProfileData()` — 1 query with 5-level JOINs
6. `generateRegistrationId()` — 1 raw SQL
7. `$transaction` — create/update registration + coupon + field responses

**DB round-trips:** 7–9

**Fix:** Queries 1, 3, 4, 5 are parallelizable:

```javascript
const [event, existingRegistration, capacityCount, userProfile] = await Promise.all([
  prisma.event.findFirst({ where: { ... }, include: { EventCustomField: { where: { isActive: true } } } }),
  prisma.eventRegistration.findFirst({ where: { eventId, userId }, include: { ... } }),
  prisma.eventRegistration.count({ where: { eventId, status: { in: ['pending', 'confirmed'] } } }),
  getUserProfileData(userId),
]);
```

**Round-trips:** 7–9 → 3–4.

#### 3.6.3 `getRegistrationDashboard()` — Lines 470–580

**Good pattern already:** Uses `Promise.all` for 3 parallel queries. But there's NO PAGINATION on the registrations query:

```javascript
prisma.eventRegistration.findMany({
  where: { userId },  // NO take/skip!
  include: { Event: { ... }, EventTeam: { include: { EventTeamMember: true, Event: { ... } } } },
  orderBy: { registeredAt: 'desc' },
});
```

A power user with 100+ registrations loads all of them with full JOINs.

**Fix:** Add `take: 50` default limit or implement pagination.

---

### 3.7 — eventSettings.service.js (513 lines)

#### 3.7.1 Redis Removal Required

Three Redis usages:
- Line 467: `const cache = require('../../../shared/config/redis')`
- Line 469: `const cached = await cache.get(cacheKey)`
- Line 500: `await cache.set(cacheKey, result, 3600)`

All in `getHierarchyData()`. This function fetches 4 reference tables (schools, departments, programs, sections) using `Promise.all` — they're already parallelized. The reference data is small and rarely changes, but without cache, each call to the hierarchy dropdown hits 4 queries.

**Fix:** Just remove the cache calls. The 4 parallel queries on indexed reference tables take <20ms total. If anything, the Prisma connection pool handles these efficiently.

#### 3.7.2 `isRegistrationOpen()` — Lines 215–260

**Sequential queries:**
1. `event.findUnique()` — get registration end date
2. `eventVisibility.findUnique()` — get visibility settings

**Fix:** Parallelize:
```javascript
const [event, visibility] = await Promise.all([
  prisma.event.findUnique({ where: { id: eventId }, select: { id: true, registrationEndDate: true } }),
  prisma.eventVisibility.findUnique({ where: { eventId }, select: { isActive: true, autoClosed: true, manuallyOverridden: true } }),
]);
```

#### 3.7.3 `canUserSeeEvent()` — Lines 280–390

**Sequential queries:**
1. `eventVisibility.findUnique()` — get visibility rules
2. `userLogin.findUnique()` — get user role + student data

**Fix:** Parallelize (they're completely independent).

---

### 3.8 — customField.service.js (369 lines)

#### 3.8.1 `createCustomField()` — Lines 65–130

**Sequential queries:**
1. `event.findFirst()` — resolve event
2. Check event ownership (part of event fetch)
3. `eventCustomField.findFirst()` — check duplicate name
4. `eventCustomField.aggregate()` — get max sort order
5. `eventCustomField.create()`

**DB round-trips:** 4

**Fix:** Queries 1, 3, 4 are parallelizable.

**Round-trips:** 4 → 2.

#### 3.8.2 `reorderCustomFields()` — Lines 280–310

Individual updates per field inside `$transaction`:
```javascript
const updates = Object.entries(fieldOrderMap).map(([fieldId, sortOrder]) =>
  prisma.eventCustomField.update({ where: { id: fieldId }, data: { sortOrder } })
);
await prisma.$transaction(updates);
```

Prisma `$transaction` with an array of operations batches them in a single SQL roundtrip in Prisma 5+. This is actually fine. No change needed.

---

### 3.9 — bulkEmail.controller.js (616 lines)

#### 3.9.1 `sendBulkEmail()` — Lines 20–250

**Sequential operations:**
1. Resolve event (1 query)
2. Fetch registrations with user data (1 query)
3. Fallback name lookup for unresolved emails (2 parallel queries — good)
4. Credit check (1 query)
5. Create email log (1 query)
6. Create per-recipient logs — **INDIVIDUAL CREATES IN TRANSACTION** (N queries!)
7. Deduct credits (1 query)
8. Send via SendGrid (external API)
9. Update email log (1 query)
10. Update recipient statuses (2 updateMany — good)

**Critical bottleneck:** Step 6 creates individual `EmailRecipientLog` rows in a transaction:
```javascript
const recipientLogs = await prisma.$transaction(
  recipients.map((r) =>
    prisma.emailRecipientLog.create({ data: { emailLogId, email: r.email, name: r.name, status: 'sent' } })
  )
);
```

For 500 recipients, this fires 500 individual INSERT statements.

**Fix:** Use `createMany` and then fetch IDs:
```javascript
await prisma.emailRecipientLog.createMany({
  data: recipients.map(r => ({ emailLogId, email: r.email, name: r.name || '', status: 'sent' })),
});
const recipientLogs = await prisma.emailRecipientLog.findMany({
  where: { emailLogId },
  select: { id: true, email: true },
});
```

**SQL statements:** 500 → 2.

#### 3.9.2 `getEmailAnalytics()` — Lines 500–560

**Good:** Already uses 5 parallel queries via `Promise.all`. No issues.

---

### 3.10 — eventHelpers.js (409 lines)

#### 3.10.1 `getEventById()` — Heavy Default Includes

This function is called by `getEventDetails()`, `updateEvent()`, `publishEvent()`, `registerForEvent()`, `getEventStatistics()`, `getEventFeedback()`, `getStallFeedback()`, etc.

Default includes: `user_login` (with `employeeDetails`), `note` (full Noting object), `EventVisibility`.

**Problem:** Most callers only need `{ id, createdById, status, name }` for authorization checks but get the full Noting JSON payload (~5KB), the user login details, and visibility rules.

**Fix:** Split into two functions:
```javascript
// Lightweight - for ownership checks
const getEventLean = async (prisma, eventId) => {
  return prisma.event.findFirst({
    where: { OR: [{ id: eventId }, { eventId }] },
    select: { id: true, eventId: true, createdById: true, status: true, name: true, paymentType: true, participationType: true },
  });
};

// Full - for detail endpoints
const getEventFull = async (prisma, eventId, extraIncludes = {}) => {
  return prisma.event.findFirst({
    where: { OR: [{ id: eventId }, { eventId }] },
    include: { user_login: { ... }, note: true, EventVisibility: true, ...extraIncludes },
  });
};
```

---

## SECTION 4 — TOP 12 CRITICAL BOTTLENECKS (Ranked by p99 Impact)

| # | Endpoint / Function | File | Severity | Current p99 | Root Cause | Est. Fix |
|---|---------------------|------|----------|-------------|------------|----------|
| **1** | `GET /:id/registrations/filter-options` | event.controller.js:650 | 🔴 CRITICAL | ~3,200ms | Loads 5,000 users with 5-level JOINs into memory | Raw SQL DISTINCT |
| **2** | `GET /` (listEvents) | event.service.js:880 | 🔴 CRITICAL | ~1,200ms | Loads ALL EventVisibility into memory, JS filter | SQL subquery |
| **3** | `GET /:id/statistics` | event.service.js:1400 | 🟠 HIGH | ~800ms | 7 DB round-trips (was masked by 1-min cache) | Combined CTE query |
| **4** | `POST /:id/emails/send` | bulkEmail.controller.js:20 | 🟠 HIGH | ~2,000ms+ | N individual INSERT for recipient logs | createMany |
| **5** | `PATCH /:id/stall-applications/bulk` | stall.controller.js:570 | 🟠 HIGH | ~1,500ms | N updates in loop inside transaction | updateMany + Promise.all |
| **6** | `POST /:id/register-with-form` | registration.service.js:210 | 🟡 MEDIUM | ~600ms | 7–9 sequential queries | Promise.all parallelization |
| **7** | `POST /:id/teams` (createTeam) | team.service.js:70 | 🟡 MEDIUM | ~500ms | 6 sequential validation queries | Promise.all |
| **8** | `GET /:id/registrations` | event.controller.js:200 | 🟡 MEDIUM | ~700ms | getEventDetails for auth + deep include tree | assertEventOwner |
| **9** | `GET /:id` (getEvent) | event.service.js:318 | 🟡 MEDIUM | ~400ms | Full load w/ volunteers, fields, prizes (was cached) | Lean vs full split |
| **10** | `GET /:id/search-users` | team.service.js:345 | 🟡 MEDIUM | ~450ms | 6 sequential queries | Promise.all in 2 batches |
| **11** | Stall `generateStallId()` | stall.controller.js:20 | 🟡 MEDIUM | ~200ms (worst: 1,000ms) | Collision-retry loop, up to 10 DB calls | Raw SQL MAX() |
| **12** | `GET /:id/stalls/:stallId/owner-feedback` | event.service.js:2040 | 🟡 MEDIUM | ~350ms | Loads ALL feedback for per-criterion avg | Raw SQL aggregation |

---

## SECTION 5 — CODE FIXES & REFACTOR SUGGESTIONS

### Fix 1: Remove ALL Redis Cache (9 locations)

**Files to modify:**
- `event.service.js` — Lines 8, 42–45, 318, 381, 1406, 1505
- `eventSettings.service.js` — Lines 467, 469, 500

```javascript
// event.service.js — REMOVE these lines:
const cache = require('../../../shared/config/redis');  // Line 8 — DELETE

const invalidateEventCaches = async (eventId) => {     // Lines 42-45 — DELETE ENTIRE FUNCTION
  await cache.del(`event:detail:${eventId}`);
  await cache.del(`event:stats:${eventId}`);
};

// In getEventDetails — REMOVE cache get/set:
// DELETE: let event = await cache.get(cacheKey);
// DELETE: if (!event) { ... }
// DELETE: await cache.set(cacheKey, event, 120);
// KEEP the actual DB call and make it direct.

// In getEventStatistics — REMOVE cache get/set:
// DELETE: const cached = await cache.get(cacheKey);
// DELETE: if (cached) return cached;
// DELETE: await cache.set(cacheKey, result, 60);

// Also DELETE all calls to invalidateEventCaches() in updateEvent and publishEvent

// eventSettings.service.js — REMOVE in getHierarchyData:
// DELETE: const cache = require('../../../shared/config/redis');
// DELETE: const cacheKey = 'events:hierarchy:data';
// DELETE: const cached = await cache.get(cacheKey);
// DELETE: if (cached) return cached;
// DELETE: await cache.set(cacheKey, result, 3600);
```

### Fix 2: Create Lightweight Event Ownership Helper

```javascript
// eventHelpers.js — ADD:
const assertEventOwner = async (prisma, eventId, userId) => {
  const event = await prisma.event.findFirst({
    where: { OR: [{ id: eventId }, { eventId }] },
    select: { id: true, eventId: true, createdById: true, name: true, status: true },
  });
  if (!event) throw new NotFoundError('Event not found');
  if (event.createdById !== userId) {
    throw new ForbiddenError('Only the event creator can perform this action');
  }
  return event;
};
```

Then replace `getEventDetails(eventId, userId)` with `assertEventOwner()` in:
- `event.controller.js`: `getEventRegistrations`, `getRegistrationDetails`, `getRegistrationFilterOptions`, `getEventVolunteers`
- `stall.controller.js`: Replace `getEventOrFail()` + ownership check
- All endpoints that call `getEventDetails` only to check `createdById`

### Fix 3: Parallelize Team Validation Queries

```javascript
// team.service.js — createTeam() BEFORE:
const event = await prisma.event.findFirst({ ... });
if (!event) throw ...;
const existingMember = await prisma.eventTeamMember.findFirst({ ... });
if (existingMember) throw ...;
const registration = await prisma.eventRegistration.findFirst({ ... });
// ...

// AFTER:
const [event, existingMember, registration, teamCount, nameConflict] = await Promise.all([
  prisma.event.findFirst({ where: { OR: [{ id: eventId }, { eventId }] } }),
  prisma.eventTeamMember.findFirst({ where: { EventTeam: { eventId: eventId }, userId, status: 'confirmed' } }),
  prisma.eventRegistration.findFirst({ where: { Event: { OR: [{ id: eventId }, { eventId }] }, userId } }),
  prisma.eventTeam.count({ where: { Event: { OR: [{ id: eventId }, { eventId }] } } }),
  prisma.eventTeam.findFirst({ where: { Event: { OR: [{ id: eventId }, { eventId }] }, name: teamName } }),
]);

if (!event) throw new NotFoundError('Event not found');
if (existingMember) throw new ValidationError('Already in a team');
if (!registration) throw new ValidationError('Must register first');
// ... rest of validations
```

### Fix 4: Raw SQL for getRegistrationFilterOptions

```javascript
// event.controller.js — getRegistrationFilterOptions REPLACE entire function body:
const getRegistrationFilterOptions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const prisma = require('../../../shared/config/database');

  // Lightweight ownership check
  const event = await assertEventOwner(prisma, id, userId);

  const [roles, genders, schools, departments, programs, passOutYears] = await Promise.all([
    prisma.$queryRaw`
      SELECT DISTINCT ul.role
      FROM "EventRegistration" er
      JOIN "user_login" ul ON ul.id = er."userId"
      WHERE er."eventId" = ${event.id}
      ORDER BY ul.role`,
    prisma.$queryRaw`
      SELECT DISTINCT sd.gender
      FROM "EventRegistration" er
      JOIN "user_login" ul ON ul.id = er."userId"
      JOIN "student_details" sd ON sd."userLoginId" = ul.id
      WHERE er."eventId" = ${event.id} AND sd.gender IS NOT NULL`,
    prisma.$queryRaw`
      SELECT DISTINCT f.id, f."facultyName" as name
      FROM "EventRegistration" er
      JOIN "user_login" ul ON ul.id = er."userId"
      LEFT JOIN "student_details" sd ON sd."userLoginId" = ul.id
      LEFT JOIN "program" p ON p.id = sd."programId"
      LEFT JOIN "department" d ON d.id = p."departmentId"
      LEFT JOIN "faculty_school_list" f ON f.id = d."facultyId"
      LEFT JOIN "employee_details" ed ON ed."userLoginId" = ul.id
      WHERE er."eventId" = ${event.id} AND (f.id IS NOT NULL OR ed."primarySchoolId" IS NOT NULL)`,
    prisma.$queryRaw`
      SELECT DISTINCT d.id, d."departmentName" as name
      FROM "EventRegistration" er
      JOIN "user_login" ul ON ul.id = er."userId"
      LEFT JOIN "student_details" sd ON sd."userLoginId" = ul.id
      LEFT JOIN "program" p ON p.id = sd."programId"
      LEFT JOIN "department" d ON d.id = p."departmentId"
      LEFT JOIN "employee_details" ed ON ed."userLoginId" = ul.id
      WHERE er."eventId" = ${event.id} AND (d.id IS NOT NULL OR ed."primaryDepartmentId" IS NOT NULL)`,
    prisma.$queryRaw`
      SELECT DISTINCT p.id, p."programName" as name
      FROM "EventRegistration" er
      JOIN "user_login" ul ON ul.id = er."userId"
      JOIN "student_details" sd ON sd."userLoginId" = ul.id
      JOIN "program" p ON p.id = sd."programId"
      WHERE er."eventId" = ${event.id}`,
    prisma.$queryRaw`
      SELECT DISTINCT EXTRACT(YEAR FROM sd."graduationDate")::int as year
      FROM "EventRegistration" er
      JOIN "user_login" ul ON ul.id = er."userId"
      JOIN "student_details" sd ON sd."userLoginId" = ul.id
      WHERE er."eventId" = ${event.id} AND sd."graduationDate" IS NOT NULL
      ORDER BY year DESC`,
  ]);

  return ApiResponse.success(res, {
    roles: roles.map(r => r.role),
    genders: genders.map(g => g.gender),
    schools: schools.filter(s => s.id).sort((a, b) => a.name.localeCompare(b.name)),
    departments: departments.filter(d => d.id).sort((a, b) => a.name.localeCompare(b.name)),
    programs: programs.sort((a, b) => a.name.localeCompare(b.name)),
    passOutYears: passOutYears.map(p => p.year),
  }, 'Filter options fetched');
});
```

### Fix 5: Replace Visibility Full-Table-Scan with SQL Subquery

See detailed implementation in Section 3.1.2 above.

### Fix 6: Fix bulkEmail Individual Creates

```javascript
// BEFORE (N individual inserts):
const recipientLogs = await prisma.$transaction(
  recipients.map((r) => prisma.emailRecipientLog.create({ data: { ... } }))
);

// AFTER (1 bulk insert + 1 fetch):
await prisma.emailRecipientLog.createMany({
  data: recipients.map(r => ({
    emailLogId: emailLog.id,
    email: r.email,
    name: r.name || '',
    status: 'sent',
  })),
});
const recipientLogs = await prisma.emailRecipientLog.findMany({
  where: { emailLogId: emailLog.id },
  select: { id: true, email: true },
});
```

---

## SECTION 6 — POSTGRESQL SCHEMA & INDEX RECOMMENDATIONS

### 6.1 Missing Composite Indexes (CREATE INDEX statements)

```sql
-- 1. StallApplication: Filter by event + status (used by getStallApplications, bulkUpdate)
CREATE INDEX CONCURRENTLY idx_stall_application_event_status
ON "stall_application" ("event_id", "application_status");

-- 2. EventEntry: Filter by event + type (used by getEventStatistics)
CREATE INDEX CONCURRENTLY idx_event_entry_event_type
ON "EventEntry" ("eventId", "entryType");

-- 3. EventEntry: Volunteer activity queries (scannedAt range filters)
CREATE INDEX CONCURRENTLY idx_event_entry_volunteer_scanned
ON "EventEntry" ("volunteerId", "scannedAt" DESC);

-- 4. StallFeedback: Per-stall feedback aggregation
CREATE INDEX CONCURRENTLY idx_stall_feedback_stall_event
ON "stall_feedback" ("stall_id", "event_id");

-- 5. EventTeamMember: User membership checks across events
CREATE INDEX CONCURRENTLY idx_event_team_member_user_status
ON "event_team_member" ("userId", status);

-- 6. EventTeamInvitation: User's pending invitations
CREATE INDEX CONCURRENTLY idx_event_team_invitation_invitee_status
ON "event_team_invitation" ("invitee_id", status);

-- 7. EventTeamRequest: User's pending requests
CREATE INDEX CONCURRENTLY idx_event_team_request_requester_status
ON "event_team_request" ("requester_id", status);

-- 8. Payment: Team payment lookup (used by createTeamPaymentOrder)
CREATE INDEX CONCURRENTLY idx_payment_team_event_status
ON "payment" ("teamId", "eventId", status);

-- 9. Payment: Individual payment lookup
CREATE INDEX CONCURRENTLY idx_payment_registration_status
ON "payment" ("registrationId", status);

-- 10. EventRegistration: Registration dashboard (user's registrations ordered)
CREATE INDEX CONCURRENTLY idx_event_registration_user_registered
ON "EventRegistration" ("userId", "registeredAt" DESC);

-- 11. EventFeedback: Feedback listing for event
CREATE INDEX CONCURRENTLY idx_event_feedback_event_created
ON "event_feedback" ("eventId", "created_at" DESC);
```

### 6.2 GIN Index for JSONB Array Containment

The visibility filter uses `@>` (contains) on JSONB arrays. This is O(n) without a GIN index:

```sql
-- GIN index on visibleToRoles for @> containment queries
CREATE INDEX CONCURRENTLY idx_event_visibility_roles_gin
ON "event_visibility" USING GIN ("visibleToRoles" jsonb_path_ops);

-- GIN for student filter arrays
CREATE INDEX CONCURRENTLY idx_event_visibility_schools_gin
ON "event_visibility" USING GIN ("allowed_school_ids" jsonb_path_ops);

CREATE INDEX CONCURRENTLY idx_event_visibility_departments_gin
ON "event_visibility" USING GIN ("allowed_department_ids" jsonb_path_ops);

CREATE INDEX CONCURRENTLY idx_event_visibility_programs_gin
ON "event_visibility" USING GIN ("allowed_program_ids" jsonb_path_ops);

CREATE INDEX CONCURRENTLY idx_event_visibility_batches_gin
ON "event_visibility" USING GIN ("allowed_batch_years" jsonb_path_ops);

CREATE INDEX CONCURRENTLY idx_event_visibility_sections_gin
ON "event_visibility" USING GIN ("allowed_section_ids" jsonb_path_ops);
```

### 6.3 EXPLAIN ANALYZE Examples

For the visibility filter query:
```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT ev."eventId"
FROM "event_visibility" ev
WHERE NOT (ev."visibleToRoles"::jsonb @> '["student"]'::jsonb)
  OR (
    ev."student_filter_type" = 'custom'
    AND ev."visibleToRoles"::jsonb @> '["student"]'::jsonb
    AND NOT (
      ev."allowed_program_ids"::jsonb @> '["some-uuid"]'::jsonb
      OR ev."allowed_department_ids"::jsonb @> '["some-uuid"]'::jsonb
    )
  );
```

Expected output without GIN: `Seq Scan on event_visibility, Filter: ..., Rows: 500, Cost: ~50`  
Expected output with GIN: `Bitmap Index Scan on idx_event_visibility_roles_gin, Rows: 500, Cost: ~5`

For registration filter options:
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT DISTINCT f.id, f."facultyName"
FROM "EventRegistration" er
JOIN "user_login" ul ON ul.id = er."userId"
JOIN "student_details" sd ON sd."userLoginId" = ul.id
JOIN "program" p ON p.id = sd."programId"
JOIN "department" d ON d.id = p."departmentId"
JOIN "faculty_school_list" f ON f.id = d."facultyId"
WHERE er."eventId" = 'event-uuid-here';
```

Without composite index on `EventRegistration(eventId, userId)`: Hash Join on sequential scan.  
With existing `@@index([eventId, userId, status])`: Index Scan using `event_registration_eventId_userId_status_idx`.

---

## SECTION 7 — CONNECTION POOL & CONFIG CHANGES

### 7.1 Current Setup

The project uses Prisma's default connection pool. The `DATABASE_URL` in `.env` likely has no pool parameters.

Prisma defaults:
- `connection_limit`: `num_cpus * 2 + 1` (typically 5 on a 2-CPU server)
- Pool timeout: 10 seconds
- Idle timeout: 300 seconds

### 7.2 Recommended Pool Configuration

```env
# .env
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=15&connect_timeout=10&statement_cache_size=100"
```

**Prisma schema generator options:**
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["metrics", "tracing"]  // Enable query metrics
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 7.3 PostgreSQL Server-Side Tuning

```sql
-- For event module workload: read-heavy, moderate writes, lots of JOINs
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET shared_buffers = '256MB';          -- 25% of available RAM
ALTER SYSTEM SET effective_cache_size = '768MB';     -- 75% of available RAM
ALTER SYSTEM SET work_mem = '8MB';                   -- Per-sort memory (bump for DISTINCT queries)
ALTER SYSTEM SET maintenance_work_mem = '128MB';     -- For CONCURRENTLY index builds
ALTER SYSTEM SET random_page_cost = 1.1;             -- SSD storage
ALTER SYSTEM SET effective_io_concurrency = 200;     -- SSD storage

-- Statement statistics for identifying slow queries
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT pg_reload_conf();
```

### 7.4 Prisma Logging for Development

```javascript
// shared/config/database.js — Add query logging in dev
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? [
        { level: 'query', emit: 'event' },
        { level: 'warn', emit: 'stdout' },
        { level: 'error', emit: 'stdout' },
      ]
    : ['error'],
});

if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    if (e.duration > 100) {
      console.warn(`🐢 Slow query (${e.duration}ms): ${e.query.substring(0, 200)}`);
    }
  });
}
```

---

## SECTION 8 — ESTIMATED GAINS

| Endpoint | Current p99 | After Optimization | Speedup | Main Change |
|----------|-------------|-------------------|---------|-------------|
| `GET /` (listEvents) | ~1,200ms | ~80ms | **15×** | SQL visibility subquery replaces full-table JS filter |
| `GET /:id` (getEvent) | ~400ms (was cached=1ms) | ~120ms | **3.3×** | Parallel user-specific queries, lean select |
| `GET /:id/statistics` | ~800ms (was cached=1ms) | ~150ms | **5.3×** | Combined CTE, assertEventOwner |
| `GET /:id/registrations` | ~700ms | ~300ms | **2.3×** | assertEventOwner replaces getEventDetails |
| `GET /:id/registrations/filter-options` | ~3,200ms | ~120ms | **27×** | Raw SQL DISTINCT replaces 5,000-user memory load |
| `POST /:id/register-with-form` | ~600ms | ~200ms | **3×** | Promise.all on 4 independent queries |
| `POST /:id/teams` (createTeam) | ~500ms | ~180ms | **2.8×** | Promise.all on 5 validation queries |
| `GET /:id/search-users` | ~450ms | ~180ms | **2.5×** | Promise.all in 2 batches |
| `POST /:id/emails/send` (500 recipients) | ~2,000ms | ~400ms | **5×** | createMany replaces N individual inserts |
| `PATCH /:id/stall-applications/bulk` (50 apps) | ~1,500ms | ~200ms | **7.5×** | updateMany replaces loop |
| `GET /:id/stalls/:stallId/owner-feedback` | ~350ms | ~50ms | **7×** | Raw SQL aggregation replaces full-load |
| Stall `generateStallId()` | ~200ms (worst: 1,000ms) | ~20ms | **10–50×** | Raw SQL MAX() replaces collision loop |

**Overall module average:** ~60–85% latency reduction across all endpoints.

---

## SECTION 9 — FINAL RECOMMENDED ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         HTTP REQUEST                                     │
│                            │                                             │
│                    Express Router                                        │
│                            │                                             │
│               ┌────────────┼────────────┐                                │
│               │   Auth Middleware        │                                │
│               │  • protect (JWT)        │                                │
│               │  • checkPermission      │                                │
│               │  • resolveEvent (NEW)   │  ← Attaches req.event         │
│               └────────────┼────────────┘                                │
│                            │                                             │
│               ┌────────────┼────────────┐                                │
│               │    Controller Layer      │  THIN: req/res only           │
│               │  • Extracts params       │  • No Prisma calls            │
│               │  • Calls service         │  • No business logic          │
│               │  • Sends ApiResponse     │                                │
│               └────────────┼────────────┘                                │
│                            │                                             │
│               ┌────────────┼────────────┐                                │
│               │    Service Layer         │  ALL business logic            │
│               │  • event.service.js      │  • Validation                  │
│               │  • team.service.js       │  • Promise.all patterns        │
│               │  • payment.service.js    │  • Raw SQL for aggregation     │
│               │  • stall.service.js (NEW)│  ← Extract from controller    │
│               └────────────┼────────────┘                                │
│                            │                                             │
│               ┌────────────┼────────────┐                                │
│               │  Data Access Helpers     │                                │
│               │  • assertEventOwner()    │  ← Lean ownership check       │
│               │  • getEventLean()        │  ← id, createdById only       │
│               │  • getEventFull()        │  ← Full includes for detail   │
│               │  • generateId() (SQL)    │  ← Raw SQL MAX()              │
│               └────────────┼────────────┘                                │
│                            │                                             │
│               ┌────────────┼────────────┐                                │
│               │    Prisma Client         │  connection_limit=20          │
│               │  • Query logging (dev)   │  • Slow query warnings        │
│               └────────────┼────────────┘                                │
│                            │                                             │
│               ┌────────────┼────────────┐                                │
│               │    PostgreSQL            │  11 new composite indexes      │
│               │  • GIN indexes on JSONB  │  6 GIN indexes on visibility  │
│               │  • CTEs for statistics   │  • pg_stat_statements         │
│               └─────────────────────────┘                                │
│                                                                          │
│               NO REDIS / NO IN-MEMORY CACHE / NO MEMOIZATION             │
└─────────────────────────────────────────────────────────────────────────┘
```

Key changes from current architecture:
1. **Event-resolving middleware** replaces redundant `getEventById` / `getEventOrFail` calls across every endpoint.
2. **Stall service layer** extracts 919 lines of inline logic from `stall.controller.js`.
3. **Two-tier event fetch:** `getEventLean()` for auth, `getEventFull()` for detail pages.
4. **All Redis removed.** Performance relies on proper indexes, lean queries, and parallelization.
5. **Raw SQL** for aggregation queries (statistics, filter options, feedback averages).

---

## SECTION 10 — STEP-BY-STEP IMPLEMENTATION PLAN

### Priority 1 — IMMEDIATE (Day 1–2): Redis Removal + Critical Fixes

**Impact: Prerequisite for all other work. Removes broken dependency.**

1. **Remove all Redis imports and calls** from `event.service.js` and `eventSettings.service.js` (9 locations).
2. **Delete `invalidateEventCaches()` function** and all its call sites in `updateEvent`, `publishEvent`, `registerForEvent`.
3. **Create `assertEventOwner()` helper** in `eventHelpers.js`.
4. Replace `getEventDetails()` calls in `getEventRegistrations`, `getRegistrationDetails`, `getRegistrationFilterOptions`, `getEventVolunteers` with `assertEventOwner()`.
5. **Test:** All event CRUD operations still work without cache.

### Priority 2 — HIGH (Day 3–4): Worst Bottleneck Fixes

**Impact: Eliminates the 3 endpoints responsible for 70% of p99 spikes.**

6. **Rewrite `getRegistrationFilterOptions()`** to use 6 parallel raw SQL DISTINCT queries (Section 5, Fix 4).
7. **Rewrite `listEvents` visibility filter** to use raw SQL subquery instead of full-table JS iteration (Section 3.1.2).
8. **Optimize `getEventStatistics`** with combined CTE query (Section 3.1.3).

### Priority 3 — HIGH (Day 5–6): Parallelization Sweep

**Impact: 2–3× improvement across 15+ endpoints.**

9. **Parallelize `team.service.js`** validation queries in `createTeam`, `inviteToTeam`, `searchUsersToInvite`, `respondToInvitation`, `respondToJoinRequest`, `getTeamsLookingForMembers` (Section 3.3).
10. **Parallelize `payment.service.js`** queries in `createIndividualPaymentOrder`, `createTeamPaymentOrder` (Section 3.5).
11. **Parallelize `registration.service.js`** queries in `submitRegistrationForm` (Section 3.6.2).
12. **Parallelize `eventSettings.service.js`** queries in `isRegistrationOpen`, `canUserSeeEvent` (Section 3.7).
13. **Parallelize `customField.service.js`** queries in `createCustomField` (Section 3.8).

### Priority 4 — MEDIUM (Day 7–8): N+1 & Bulk Operation Fixes

**Impact: Fixes worst-case scenarios that occur during batch operations.**

14. **Fix `bulkUpdateStallApplications()`** — replace loop-based individual updates with `updateMany` + `Promise.all` (Section 3.4.2).
15. **Fix `sendBulkEmail` recipient log creation** — replace N individual `create()` with `createMany()` (Section 3.9.1).
16. **Fix `generateStallId()`** — replace collision-retry loop with raw SQL MAX() (Section 3.4.1).

### Priority 5 — MEDIUM (Day 9–10): Database Indexes

**Impact: 30–60% improvement on all filtered queries.**

17. **Run the 11 composite index CREATE statements** from Section 6.1 (use `CONCURRENTLY` to avoid table locks).
18. **Run the 6 GIN index CREATE statements** from Section 6.2.
19. **Run `ANALYZE` on all event tables** to update planner statistics:
```sql
ANALYZE "Event", "EventRegistration", "EventEntry", "EventVolunteer",
        "event_visibility", "stall_application", "stall", "stall_feedback",
        "event_feedback", "event_team", "event_team_member",
        "event_team_invitation", "event_team_request", "payment",
        "event_custom_field", "event_field_response", "event_coupon",
        "coupon_usage", "EventEmailLog", "EmailRecipientLog";
```

### Priority 6 — LOW (Day 11–12): Lean Query Refactoring

**Impact: Reduces data transfer and memory usage by 50–70%.**

20. **Split `getEventById()`** into `getEventLean()` and `getEventFull()` (Section 3.10.1).
21. **Fix `getUserProfileData()`** — replace `include` with `select` (Section 3.6.1).
22. **Add pagination to `getRegistrationDashboard()`** — add `take: 50` (Section 3.6.3).

### Priority 7 — LOW (Day 13–14): Architectural Improvements

**Impact: Long-term maintainability and consistency.**

23. **Extract stall.service.js** from stall.controller.js — move all Prisma logic into a proper service layer.
24. **Create event-resolving middleware** that attaches `req.event` for routes with `:id` parameter.
25. **Add Prisma query logging** for development (Section 7.4).

### Priority 8 — LOW (Day 15): Raw SQL Aggregation for Feedback

26. **Fix `getStallOwnerFeedback()`** — replace full-row load with raw SQL aggregation (Section 3.1.4).
27. **Connection pool tuning** — set `connection_limit=20` and PostgreSQL server-side settings (Section 7.2–7.3).

### Priority 9 — MONITORING (Ongoing)

28. **Enable `pg_stat_statements`** to track slow queries in production.
29. **Add Prisma metrics** (`previewFeatures = ["metrics"]`) and export to monitoring.
30. **Set up query duration alerts** — warn on any query >200ms, alert on >500ms.

---

> **Total estimated effort:** 12–15 developer-days for a single engineer familiar with the codebase.  
> **Expected outcome:** 60–85% average latency reduction, 0 Redis dependencies, 0 full-table memory loads, all queries under 200ms p99 (excluding Razorpay/SendGrid external calls).
