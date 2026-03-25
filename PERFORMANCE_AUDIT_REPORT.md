# Performance Audit Report — Event Management System

**Version:** 1.0  
**Date:** 2026-03-11  
**Auditor:** Performance Engineering  
**Target:** p95 Response Time < 500ms @ 2,000 Concurrent Users  
**Current Baseline:** p95 = 2,460ms @ 50 Users (browse), System Degradation Begins @ 100+ Users

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Load Test Observations](#2-load-test-observations)
3. [Identified Bottlenecks](#3-identified-bottlenecks)
4. [Recommended Fixes (Per Bottleneck)](#4-recommended-fixes)
5. [Architecture Improvements for 2,000+ Users](#5-architecture-improvements)
6. [Step-by-Step Optimization Roadmap](#6-optimization-roadmap)
7. [Expected System Capacity After Fixes](#7-expected-capacity)
8. [Appendix: Technical Evidence](#8-appendix)

---

## 1. Executive Summary

The Event Management backend was load-tested using Grafana k6 v1.6.1 against a Node.js/Express.js server (port 5001) backed by PostgreSQL (Neon serverless) via Prisma ORM and Redis caching.

### Current State

| Metric | Current | Target |
|:-------|:-------:|:------:|
| **Max stable concurrent users (p95 < 3s)** | **~50** | **2,000** |
| **p95 response time @ 50 users** | **2,460ms** | **< 500ms** |
| **Throughput ceiling** | **~31 req/s** | **> 2,000 req/s** |
| **Error-free concurrency** | **~200 users** | **2,000+ users** |
| **System breaking point** | **500 users** (9.87% errors) | **No errors @ 2,000** |

### Gap Analysis

To reach **p95 < 500ms @ 2,000 concurrent users**, the system needs approximately a **65x throughput improvement** (31 → 2,000+ req/s) and a **5x latency reduction** (2,460ms → <500ms). This requires changes at every layer: process model, database queries, caching strategy, connection management, and serialization.

### Root Cause Summary

The primary bottleneck is the **single-threaded Node.js process** running without clustering, combined with **uncached list queries**, **Neon serverless connection overhead**, and **excessive Prisma ORM-generated SQL complexity**. The throughput ceiling of ~31 req/s is constant across all concurrency levels (50–500 VUs), proving the bottleneck is CPU-bound on the server side, not network or database throughput.

---

## 2. Load Test Observations

### 2.1 Browse Flow Results (GET /events → GET /events/:id → GET /events/:id/registration-form)

| VUs | Duration | Requests | Failure % | Avg Resp | p95 Resp | Throughput |
|:---:|:--------:|:--------:|:---------:|:--------:|:--------:|:----------:|
| 50  | 2 min    | 3,792    | 0.00%     | 1.42s    | 2.46s    | 31.2 req/s |
| 100 | 2 min    | 3,234    | 0.00%     | 3.65s    | 7.83s    | 25.8 req/s |
| 200 | 2 min    | 4,200    | 0.00%     | 6.09s    | 10.58s   | 31.6 req/s |
| 500 | 3 min    | 6,531    | 9.87%     | 15.35s   | 26.78s   | 31.4 req/s |

### 2.2 Registration Flow Results (Browse + POST /events/:id/register)

| VUs | Duration | Requests | HTTP Fail %* | Avg Resp | p95 Resp | Throughput |
|:---:|:--------:|:--------:|:------------:|:--------:|:--------:|:----------:|
| 50  | 2 min    | 3,604    | 20.86%*      | 1.56s    | 2.91s    | 29.4 req/s |

> *20.86% are expected "already registered" (409) responses — not actual failures. All application-level checks passed 100%.

### 2.3 Endpoint-Level Breakdown (50 VUs)

| Endpoint | Avg | p90 | p95 | Max |
|:---------|:---:|:---:|:---:|:---:|
| `GET /events` (list) | 1,750ms | 2,440ms | 2,730ms | 3,530ms |
| `GET /events/:id` (detail) | 1,800ms | 2,320ms | 2,490ms | 3,460ms |
| `GET /events/:id/registration-form` | 721ms | 978ms | 1,080ms | 2,400ms |
| `POST /events/:id/register` | 1,510ms | 2,810ms | 3,640ms | 5,800ms |

### 2.4 Critical Observations

1. **Throughput plateau at ~31 req/s** — identical at 50, 200, and 500 VUs. This is the single-threaded processing capacity. Adding users only increases queue depth, not throughput.

2. **Linear latency scaling** — response times scale proportionally with VU count: 1.42s (50 VU) → 3.65s (100 VU) → 6.09s (200 VU) → 15.35s (500 VU). Classic symptom of a single-threaded bottleneck with queuing.

3. **`/registration-form` is 2.5x faster** than `/events` and `/events/:id` — likely benefiting from the in-memory `resolveEvent` cache and smaller payload.

4. **Registration POST is the slowest** — transaction overhead + ID generation + cache invalidation adds latency.

---

## 3. Identified Bottlenecks

### 3.1 🔴 CRITICAL: Single-Threaded Node.js Process (No Clustering)

**File:** [backend/src/server.js](backend/src/server.js)

**Evidence:** Throughput is capped at ~31 req/s regardless of concurrent users. `server.js` does not use `cluster` module, PM2, or any multi-process orchestration.

**Why it causes slow performance:**  
Node.js runs on a single thread. Every incoming request competes for the same CPU core. Even with async I/O, JSON serialization, Prisma query building, response compression, and middleware execution all consume CPU time sequentially. At ~31 req/s, each request uses ~32ms of CPU time, fully saturating one core.

**Estimated latency impact:** This is the **#1 bottleneck**. It caps throughput at ~31 req/s. With 2,000 concurrent users at 31 req/s, the average queue wait time alone would be **~64 seconds** — making sub-500ms p95 impossible without clustering.

**Fix:** Enable Node.js cluster mode (PM2 or native `cluster` module). On a 4-core machine, throughput increases to ~124 req/s. On an 8-core machine, ~248 req/s. Combined with other optimizations, this is the foundation for reaching 2,000 users.

---

### 3.2 🔴 CRITICAL: Uncached Event List Endpoint

**File:** [backend/src/modules/event-management/services/event.service.js](backend/src/modules/event-management/services/event.service.js) — `listEvents()` (line 1053)

**Evidence:** `GET /events` has avg response time of 1,750ms at just 50 VUs. The `getEventDetails()` function caches individual event detail (line 466: `event:detail:${eventId}`), but `listEvents()` has **no cache at all** — every request hits the database.

**Why it causes slow performance:**
`listEvents()` executes:
1. A user profile query for `buildVisibilityFilter()` — deep nested JOIN (user → student → program → department)
2. A `prisma.event.findMany()` with complex OR/AND conditions, including `EventVolunteer` subquery
3. A `prisma.event.count()` with the same complex WHERE clause
4. A raw SQL `EventRegistration` count aggregation

That's **4 database round-trips per list request**, with the first two involving complex JOINs. On Neon serverless with ~50-100ms network latency per query, this alone accounts for **200-400ms** baseline.

**Estimated latency impact:** 200-400ms per request (database round-trips) + 50-100ms for Prisma query generation + result serialization. Total: **~300-500ms per call** even at low concurrency.

**Fix:** 
- Cache the list response with user-role-based cache keys (e.g., `event:list:${role}:${page}:${status}`)
- Cache `buildVisibilityFilter()` output per userId (30s TTL)
- Use `getOrSet()` pattern already implemented in the codebase

---

### 3.3 🔴 CRITICAL: `buildVisibilityFilter()` Executes a DB Query Per Request

**File:** [backend/src/modules/event-management/services/eventSettings.service.js](backend/src/modules/event-management/services/eventSettings.service.js) — line 449

**Evidence:** Every call to `listEvents()` invokes `buildVisibilityFilter(userId)`, which executes:
```javascript
const user = await prisma.userLogin.findUnique({
  where: { id: userId },
  select: {
    role: true,
    studentLogin: {
      select: {
        programId: true, sectionId: true,
        program: { select: { departmentId: true, department: { select: { facultyId: true } } } },
        section: { select: { batchYear: true } }
      }
    }
  }
});
```

This is a **4-level nested JOIN** (user → student → program → department) executed on **every single event list request**. The same user data is already available in `req.user` from the `protect` middleware — but the visibility function re-fetches it.

**Estimated latency impact:** 50-100ms per request (Neon network latency + nested JOIN execution). At 2,000 concurrent users, this generates 2,000 unnecessary DB queries.

**Fix:**
1. **Immediate:** Pass `req.user` into `buildVisibilityFilter()` instead of re-querying. The student profile data needed (programId, sectionId, batchYear, departmentId, facultyId) can be pre-cached in the auth middleware.
2. **Better:** Cache the visibility filter result per userId with 60s TTL — user's school/department rarely changes.

---

### 3.4 🟠 HIGH: `isRegistrationOpen()` — Two DB Queries on Every Event Detail

**File:** [backend/src/modules/event-management/services/eventSettings.service.js](backend/src/modules/event-management/services/eventSettings.service.js) — line 297

**Evidence:** `isRegistrationOpen(eventId)` is called during `registerForEvent()`. It executes **two parallel DB queries**:
```javascript
const [event, visibility] = await Promise.all([
  prisma.event.findUnique({ where: { id: eventId }, select: { registrationEndDate: true } }),
  prisma.eventVisibility.findUnique({ where: { eventId }, select: { isActive: true, autoClosed: true, manuallyOverridden: true } }),
]);
```

These are lightweight queries but add **100-150ms** of network latency to every registration request on top of the actual registration logic.

**Estimated latency impact:** 100-150ms per registration request.

**Fix:** 
1. Cache `isRegistrationOpen` result per eventId with 30s TTL
2. Or bundle this data into the event detail cache (`event:detail:${id}`) so it's fetched once

---

### 3.5 🟠 HIGH: Development Mode Connection Pool Limit (5 connections)

**File:** [backend/src/shared/config/database.js](backend/src/shared/config/database.js) — line 37

**Evidence:** In development mode (which is what the load test runs under), the connection pool is limited to **5 connections**:
```javascript
url: process.env.DATABASE_URL + "?connection_limit=5&pool_timeout=30"
```

With 50 concurrent users making 4 queries each per request, that's **200 queries competing for 5 connections**. Each query waits in the pool queue, adding massive latency.

**Estimated latency impact:** At 50 VUs with 4 queries/request = 200 queries in flight. With 5 connections and ~50ms per query, queue wait time = (200/5) × 50ms = **2,000ms average queue delay**. This alone explains the 1,420ms average response time.

**Fix:** Increase development pool to `connection_limit=25` (matching production). For 2,000 users target, production should use `connection_limit=50` minimum with PgBouncer.

---

### 3.6 🟠 HIGH: `getEventDetails()` — User-Specific Queries Not Cached

**File:** [backend/src/modules/event-management/services/event.service.js](backend/src/modules/event-management/services/event.service.js) — line 461

**Evidence:** The event detail function caches the base event data (line 530: `cache.set(cacheKey, event, 120)`) but then executes **two uncached parallel queries on every request**:
```javascript
const [currentRegistrations, userRegistration] = await Promise.all([
  prisma.eventRegistration.count({ where: { eventId, status: "confirmed" } }),
  prisma.eventRegistration.findFirst({ where: { eventId, userId } }),
]);
```

The `currentRegistrations` count is the same for all users viewing the same event — it should be cached separately.

**Estimated latency impact:** 100-150ms per event detail request (two DB round trips on cache hit).

**Fix:**
1. Cache `currentRegistrations` count with 30s TTL: `event:regcount:${eventId}`
2. Cache `userRegistration` lookup per user: `event:userreg:${eventId}:${userId}` with 60s TTL
3. Invalidate both caches on registration mutations

---

### 3.7 🟠 HIGH: Rate Limiter Per-IP = Blocked Under Load

**File:** [backend/src/server.js](backend/src/server.js) — line 45

**Evidence:** The API rate limiter is configured for **500 requests per 15 minutes per IP**:
```javascript
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // 15 min
  max: config.rateLimit.max,           // 500
});
```

During load testing from a single machine, all 50-500 VUs share one IP address. At 31 req/s throughput, the 500-request limit is hit in **~16 seconds**, after which all remaining requests are rejected with 429.

**Estimated latency impact:** Not a latency issue per se, but causes **100% failure after 16s of testing** if rate limit is not elevated.

**Fix:** 
1. For load testing: set `RATE_LIMIT_MAX_REQUESTS=999999` env variable
2. For production: implement rate limiting per user ID (authenticated) + per IP (unauthenticated), not just per IP
3. Consider sliding window rate limiting instead of fixed window

---

### 3.8 🟠 HIGH: Prisma-Generated SQL Complexity for Visibility Filtering

**File:** [backend/src/modules/event-management/services/eventSettings.service.js](backend/src/modules/event-management/services/eventSettings.service.js) — `buildVisibilityFilter()` line 449

**Evidence:** The visibility filter for student users generates deeply nested Prisma WHERE clauses:
```javascript
{
  OR: [
    { EventVisibility: null },                    // LEFT JOIN + IS NULL check
    { EventVisibility: { isActive: true, visibleToRoles: { array_contains: ['student'] }, studentFilterType: 'all' } },
    { EventVisibility: { isActive: true, visibleToRoles: { array_contains: ['student'] }, studentFilterType: 'custom',
        OR: [
          { allowedSectionIds: { array_contains: [sectionId] } },
          { allowedBatchYears: { array_contains: [batchYear] } },
          { allowedProgramIds: { array_contains: [programId] } },
          { allowedDepartmentIds: { array_contains: [deptId] } },
          { allowedSchoolIds: { array_contains: [schoolId] } },
        ]
    }},
  ]
}
```

Prisma translates this into a SQL query with **multiple LEFT JOINs on `event_visibility`** with `array_contains` operations (PostgreSQL `@>` operator on JSON arrays). Combined with the `listEvents()` own OR conditions (creator check + EventVolunteer subquery), the generated SQL is extremely complex.

**Estimated latency impact:** 100-300ms per list query depending on event count. PostgreSQL's query planner struggles with nested OR conditions containing JSON array operators.

**Fix:**
1. **GIN indexes** on JSON array columns: `allowedSchoolIds`, `allowedDepartmentIds`, `allowedProgramIds`, `allowedBatchYears`, `allowedSectionIds`
2. Cache the visibility filter WHERE clause per userId (it only changes when student's enrollment changes)
3. Consider denormalizing: add `visibleToAll` boolean column to Event table for fast filtering

---

### 3.9 🟡 MEDIUM: Audit Middleware Overhead on Every Request

**File:** [backend/src/shared/middleware/audit.middleware.js](backend/src/shared/middleware/audit.middleware.js)

**Evidence:** The audit middleware intercepts **every API request**, captures request body, masks sensitive fields, maps HTTP method to action type, classifies module, and (presumably) writes to database.

Even with `logGetRequests: false`, POST/PUT/DELETE requests still trigger:
1. Request body parsing/cloning
2. Sensitive field masking (regex-based)
3. Module classification (route pattern matching)
4. Database write (audit log insertion)

**Estimated latency impact:** 10-30ms per POST/PUT/DELETE request. For browse-only flow, minimal impact. For registration flow, adds overhead.

**Fix:** 
1. Make audit logging async (fire-and-forget with a queue)
2. Use BullMQ (already in the codebase) to defer audit log writes
3. Skip audit for high-frequency read endpoints

---

### 3.10 🟡 MEDIUM: Response Compression on Small Payloads

**File:** [backend/src/server.js](backend/src/server.js) — line 66

**Evidence:** `compression()` middleware is applied globally to all responses. For small JSON responses (<1KB), compression actually **adds latency** (CPU overhead for gzip without meaningful size reduction).

**Estimated latency impact:** 2-5ms per response for small payloads. At 31 req/s, this is constant overhead.

**Fix:** Configure compression threshold:
```javascript
app.use(compression({ threshold: 1024 })); // Only compress responses > 1KB
```

---

### 3.11 🟡 MEDIUM: `resolveEvent()` Uses `findFirst` with OR Instead of Direct Lookup

**File:** [backend/src/modules/event-management/utils/eventHelpers.js](backend/src/modules/event-management/utils/eventHelpers.js) — line 43

**Evidence:** 
```javascript
const query = { where: { OR: [{ id: eventId }, { eventId }] } };
const event = await prisma.event.findFirst(query);
```

`findFirst` with OR is slower than `findUnique` because PostgreSQL cannot use the unique index optimally. It scans both indexes and returns the first match.

**Estimated latency impact:** 5-20ms per call (difference between `findFirst` with OR vs `findUnique` with direct key).

**Fix:** Detect whether the input is a UUID or human-readable ID, then use `findUnique` with the appropriate key:
```javascript
const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(eventId);
const event = await prisma.event.findUnique({
  where: isUUID ? { id: eventId } : { eventId },
});
```

---

### 3.12 🟡 MEDIUM: No HTTP Cache Headers on Event Endpoints

**File:** [backend/src/server.js](backend/src/server.js)

**Evidence:** HTTP cache headers (`Cache-Control`) are only set for `/api/v1/noting/config` and `/api/v1/dsw/categories`. Event endpoints return no cache headers, forcing the client (and any CDN/reverse proxy) to fetch fresh data on every request.

**Estimated latency impact:** No server-side impact, but prevents CDN/browser caching from reducing request volume.

**Fix:** Add `Cache-Control` headers to frequently-accessed read endpoints:
```javascript
app.use("/api/v1/events", (req, res, next) => {
  if (req.method === 'GET') {
    res.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
  }
  next();
});
```

---

### 3.13 🟡 MEDIUM: `getRegistrationForm()` — Three Sequential Query Phases

**File:** [backend/src/modules/event-management/services/registration.service.js](backend/src/modules/event-management/services/registration.service.js) — line 42

**Evidence:** The registration form endpoint executes queries in three phases:

**Phase 1** (parallel): `resolveEvent()` + `getUserProfileData()` — good, parallelized  
**Phase 2** (sequential): `prisma.eventRegistration.findFirst()` with nested includes (`EventFieldResponse → EventCustomField`, `EventTeam → EventTeamMember`) — this is a **separate DB call after Phase 1**  

Phase 2 could be parallelized with Phase 1 but isn't. The nested includes also generate multiple SQL JOINs.

**Estimated latency impact:** 50-100ms (Phase 2 sequential wait after Phase 1).

**Fix:** Move the existing registration check into the `Promise.all` of Phase 1:
```javascript
const [event, userProfile, existingRegistration] = await Promise.all([
  resolveEvent(eventId, { include: { EventCustomField: {...} } }),
  getUserProfileData(userId),
  prisma.eventRegistration.findFirst({ where: { eventId, userId }, include: {...} }),
]);
```

---

### 3.14 🟢 LOW: In-Memory Event Cache (`_eventCache`) is Process-Scoped

**File:** [backend/src/modules/event-management/utils/eventHelpers.js](backend/src/modules/event-management/utils/eventHelpers.js) — line 11

**Evidence:** The `resolveEvent()` function uses a JavaScript `Map` for in-memory caching. When clustering is enabled (recommended fix #1), each worker process has its own `Map`, leading to:
1. Cache duplication across workers (wasted memory)
2. Cache inconsistency (one worker invalidates, others still serve stale data)

**Estimated latency impact:** No current impact (single process), but will cause stale data issues when clustering is added.

**Fix:** Move `resolveEvent()` caching to Redis (already in the codebase) instead of in-memory Map.

---

## 4. Recommended Fixes (Detailed)

### Fix 4.1: Enable PM2 Cluster Mode

**Impact:** ~4x throughput (31 → 124 req/s on 4 cores), ~8x on 8 cores

Create [backend/ecosystem.config.js](backend/ecosystem.config.js):
```javascript
module.exports = {
  apps: [{
    name: 'sgt-ums-backend',
    script: 'src/server.js',
    instances: 'max',         // Use all CPU cores
    exec_mode: 'cluster',
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 5001,
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 5001,
    },
  }],
};
```

Run: `pm2 start ecosystem.config.js`

**Caveat:** The 30-second DB keep-alive `setInterval` in `server.js` will run in each worker. Wrap it:
```javascript
if (cluster.isPrimary || !cluster.isWorker) {
  setInterval(async () => { /* keep-alive ping */ }, 30000);
}
```

---

### Fix 4.2: Cache Event List Responses

**Impact:** ~80% reduction in list endpoint latency (1,750ms → ~350ms)

In `event.service.js` `listEvents()`:
```javascript
const listEvents = async (filters, pagination, userId) => {
  // Build cache key from normalized query params
  const user = /* from req.user or passed in */;
  const cacheKey = `event:list:${user.role}:${pagination.page}:${pagination.limit}:${filters.status || 'all'}:${filters.myEvents || false}`;

  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  // ... existing query logic ...

  const result = { events: eventsWithCount, pagination: { ... } };
  await cache.set(cacheKey, result, 30); // 30s TTL
  return result;
};
```

Invalidate on event mutations:
```javascript
async function invalidateEventCaches(eventId) {
  invalidateResolveEventCache(eventId);
  await Promise.all([
    cache.del(`event:detail:${eventId}`),
    cache.del(`event:stats:${eventId}`),
    // Invalidate list caches (pattern delete)
    cache.delByPattern('event:list:*'),
  ]);
}
```

---

### Fix 4.3: Increase Connection Pool Size

**Impact:** ~60% reduction in queue wait latency

In [backend/src/shared/config/database.js](backend/src/shared/config/database.js), change development pool:
```javascript
// BEFORE:
url: process.env.DATABASE_URL + "?connection_limit=5&pool_timeout=30"

// AFTER:
url: process.env.DATABASE_URL + "?connection_limit=25&pool_timeout=30"
```

For production with clustering (N workers × pool_per_worker):
```javascript
// With PM2 cluster on 4 cores: 4 workers × 10 connections = 40 total
url: process.env.DATABASE_URL + "?connection_limit=10&pool_timeout=30"
```

**Important:** Neon serverless has a concurrent connection limit. Use **PgBouncer** (Neon offers built-in connection pooling) to handle 100+ pooled connections.

---

### Fix 4.4: Eliminate Redundant `buildVisibilityFilter()` DB Query

**Impact:** Eliminate 50-100ms per list request

Pass `req.user` through to `buildVisibilityFilter()` instead of re-querying:

```javascript
// In event.controller.js (or wherever listEvents is called):
const result = await eventService.listEvents(filters, pagination, req.user);

// In event.service.js listEvents():
const listEvents = async (filters, pagination, user) => {
  const userId = user.id;
  // ...
  if (!myEvents) {
    const visibilityFilter = buildVisibilityFilterSync(user); // No DB call!
    // ...
  }
};

// In eventSettings.service.js — new sync version:
const buildVisibilityFilterSync = (user) => {
  if (user.role === 'superadmin') return {};
  // Use user.studentLogin data from auth middleware cache
  // ... same logic but without the DB query ...
};
```

**Prerequisite:** Extend the auth middleware cache to include `studentLogin` with program/department/section data.

---

### Fix 4.5: Cache Registration Count Per Event

**Impact:** Eliminate 50-70ms per event detail request

```javascript
const getRegistrationCount = async (eventId) => {
  const cacheKey = `event:regcount:${eventId}`;
  return cache.getOrSet(cacheKey, async () => {
    const count = await prisma.eventRegistration.count({
      where: { eventId, status: 'confirmed' },
    });
    return count;
  }, 30); // 30s TTL
};
```

---

### Fix 4.6: Add GIN Indexes for JSON Array Filtering

**Impact:** 50-200ms improvement on list queries for student users

Create a Prisma migration:
```sql
-- GIN indexes for visibility JSON array filtering
CREATE INDEX CONCURRENTLY idx_event_visibility_visible_roles 
  ON event_visibility USING GIN ("visibleToRoles");
CREATE INDEX CONCURRENTLY idx_event_visibility_school_ids 
  ON event_visibility USING GIN ("allowed_school_ids");
CREATE INDEX CONCURRENTLY idx_event_visibility_dept_ids 
  ON event_visibility USING GIN ("allowed_department_ids");
CREATE INDEX CONCURRENTLY idx_event_visibility_program_ids 
  ON event_visibility USING GIN ("allowed_program_ids");
CREATE INDEX CONCURRENTLY idx_event_visibility_batch_years 
  ON event_visibility USING GIN ("allowed_batch_years");
CREATE INDEX CONCURRENTLY idx_event_visibility_section_ids 
  ON event_visibility USING GIN ("allowed_section_ids");
```

---

### Fix 4.7: Optimize `resolveEvent()` to Use `findUnique`

**Impact:** 5-20ms improvement per event lookup

```javascript
const resolveEvent = async (eventId, options = {}) => {
  // ... cache check ...
  
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId);
  const query = {
    where: isUUID ? { id: eventId } : { eventId },
    ...options,
  };
  
  const event = isUUID 
    ? await prisma.event.findUnique(query)
    : await prisma.event.findUnique(query);
  
  if (!event) throw new NotFoundError('Event not found');
  // ... cache set ...
  return event;
};
```

---

### Fix 4.8: Parallelize `getRegistrationForm()` Phase 2

**Impact:** 50-100ms improvement per form request

```javascript
const getRegistrationForm = async (eventId, userId) => {
  const [event, userProfile, existingRegistration] = await Promise.all([
    resolveEvent(eventId, { include: { EventCustomField: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } } }),
    getUserProfileData(userId),
    prisma.eventRegistration.findFirst({
      where: { eventId, userId },
      include: {
        EventFieldResponse: { include: { EventCustomField: true } },
        EventTeam: { include: { EventTeamMember: true } },
      },
    }),
  ]);
  // Note: eventId in the findFirst needs the resolved UUID, 
  // so resolve the event ID first if using human-readable IDs,
  // or use the raw eventId if it's already a UUID
};
```

---

### Fix 4.9: Configure Compression Threshold

**Impact:** 2-5ms improvement per small response

```javascript
app.use(compression({ 
  threshold: 1024,  // Only compress responses > 1KB
  level: 6,         // Balanced compression level (default: 6)
}));
```

---

### Fix 4.10: Add HTTP Cache Headers for Event Read Endpoints

**Impact:** Reduces request volume by 20-40% (browser/CDN caching)

```javascript
// In event routes or as middleware
router.get('/', protect, (req, res, next) => {
  res.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');
  next();
}, eventController.listEvents);

router.get('/:id', protect, (req, res, next) => {
  res.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
  next();
}, eventController.getEvent);
```

---

## 5. Architecture Improvements for 2,000+ Concurrent Users

### 5.1 Caching Strategy

| Layer | Current | Proposed |
|:------|:--------|:---------|
| **L1 (In-Process)** | `Map` in `resolveEvent()` only | LRU cache (lru-cache npm) for hot objects across all services |
| **L2 (Redis)** | Event detail only (2min TTL) | Event list, registration count, visibility filter, user profile |
| **L3 (HTTP)** | None on event endpoints | `Cache-Control` headers for browser/CDN |
| **L4 (CDN)** | None | CloudFlare/Vercel Edge for static event data |

**Recommended TTLs:**

| Cache Key Pattern | TTL | Invalidation |
|:-----------------|:---:|:-------------|
| `event:list:${role}:${page}` | 30s | On any event create/update/publish |
| `event:detail:${id}` | 120s (current) | On event update |
| `event:regcount:${id}` | 30s | On registration create/cancel |
| `event:userreg:${eventId}:${userId}` | 60s | On user's registration change |
| `visibility:filter:${userId}` | 300s | On user profile change |

### 5.2 Database Indexing

**Existing indexes on Event model (confirmed in schema):**
- `@@index([status, startDate])` ✅
- `@@index([createdById])` ✅
- `@@index([eventType])` ✅

**Existing indexes on EventRegistration (confirmed):**
- `@@index([eventId, status])` ✅
- `@@index([eventId, userId, status])` ✅
- `@@index([userId, registeredAt(sort: Desc)])` ✅

**Missing indexes needed for load test hot paths:**
```sql
-- 1. GIN indexes for JSON array visibility filtering (see Fix 4.6)
-- 2. Composite index for volunteer manager lookup (used in listEvents OR clause)
CREATE INDEX CONCURRENTLY idx_event_volunteer_user_role 
  ON "EventVolunteer"("userId", "role") WHERE role = 'event_manager';
```

The existing indexes are actually quite comprehensive. The main gap is GIN indexes for JSON array operations.

### 5.3 Connection Pooling Architecture

```
[k6 / 2000 users]
        │
        ▼
[Nginx Load Balancer] ─── sticky sessions / round-robin
        │
    ┌───┼───┐
    ▼   ▼   ▼
[PM2 Worker 1] [PM2 Worker 2] [PM2 Worker 3] [PM2 Worker 4]
    │   │   │   │
    └───┼───┘   │
        ▼       ▼
   [PgBouncer] ──── Transaction Mode
        │
        ▼
   [Neon PostgreSQL]
   (connection_limit=50)
```

Each PM2 worker: `connection_limit=10`  
PgBouncer: `max_client_conn=200`, `default_pool_size=50`  
Neon: `connection_limit=50` (or higher on paid plan)

### 5.4 Query Restructuring

**Current `listEvents()` query chain:**
```
1. buildVisibilityFilter(userId)     → DB query (user + nested joins)
2. prisma.event.findMany(...)        → DB query (complex WHERE + note JOIN)
3. prisma.event.count(...)           → DB query (same complex WHERE)
4. prisma.$queryRaw(regCounts)       → DB query (registration aggregation)
= 4 sequential/parallel DB calls
```

**Optimized query chain:**
```
1. buildVisibilityFilterFromCache(userId)  → Redis/memory (0ms DB)
2. cache.getOrSet(listCacheKey, ...)       → Redis hit: 0 DB
   └─ cache miss:
      a. prisma.event.findMany(...)        → 1 DB query
      b. prisma.event.count(...)           → 1 DB query (parallel with a)
      c. prisma.$queryRaw(regCounts)       → 1 DB query (parallel with a,b)
= 0 DB calls on cache hit, 3 parallel calls on miss
```

### 5.5 Background Jobs

Move these operations to BullMQ (already partially configured in server.js):

| Operation | Current | Proposed |
|:----------|:--------|:---------|
| Audit log writes | Synchronous middleware | BullMQ queue (fire-and-forget) |
| Cache invalidation | Synchronous after mutation | BullMQ job (best-effort, non-blocking) |
| Registration count update | Query on every detail view | Background job updates cached count every 10s |
| Email notifications | Direct send in request cycle | Already using BullMQ ✅ |

### 5.6 Horizontal Scaling

For 2,000+ concurrent users:

| Component | Instances | Config |
|:----------|:---------:|:-------|
| Node.js (PM2 cluster) | 4-8 workers | `instances: 'max'` |
| Redis | 1 (or Redis Cluster for HA) | `maxmemory-policy: allkeys-lru` |
| PostgreSQL | 1 primary + 1 read replica | Write to primary, read from replica |
| Nginx | 1 | Reverse proxy + load balance across PM2 workers |

---

## 6. Step-by-Step Optimization Roadmap

Ordered by **impact vs. effort ratio** (highest ROI first):

### Phase 1: Quick Wins (< 1 day, ~10x improvement expected)

| Step | Fix | Expected Improvement | Effort |
|:----:|:----|:---------------------|:------:|
| 1 | **Increase dev connection pool** from 5 → 25 | p95: 2,460ms → ~800ms | 1 line |
| 2 | **Enable PM2 cluster mode** (4 workers) | Throughput: 31 → ~124 req/s | 30 min |
| 3 | **Cache event list responses** (30s TTL) | List endpoint: 1,750ms → ~50ms (cache hit) | 1 hour |
| 4 | **Cache registration counts** (30s TTL) | Detail endpoint: 1,800ms → ~100ms (hit) | 30 min |
| 5 | **Eliminate buildVisibilityFilter DB query** | -100ms per list request | 1 hour |
| **Cumulative Phase 1** | | **p95 < 500ms @ 200 users** | **~4 hours** |

### Phase 2: Medium Optimizations (1-2 days, ~20x improvement)

| Step | Fix | Expected Improvement | Effort |
|:----:|:----|:---------------------|:------:|
| 6 | **Add GIN indexes for JSON visibility columns** | List query: -100-200ms | 1 hour |
| 7 | **Add HTTP Cache-Control headers** | -20-40% request volume | 30 min |
| 8 | **Parallelize getRegistrationForm Phase 2** | Form: -50-100ms | 30 min |
| 9 | **Optimize resolveEvent to use findUnique** | -5-20ms per lookup | 30 min |
| 10 | **Configure compression threshold** | -2-5ms per small response | 5 min |
| 11 | **Async audit logging via BullMQ** | -10-30ms per write request | 2 hours |
| **Cumulative Phase 2** | | **p95 < 500ms @ 500 users** | **~1 day** |

### Phase 3: Production Architecture (1-2 weeks, 2,000+ users)

| Step | Fix | Expected Improvement | Effort |
|:----:|:----|:---------------------|:------:|
| 12 | **PgBouncer for connection pooling** | Handle 200+ concurrent DB connections | 1 day |
| 13 | **Nginx reverse proxy** with upstream to PM2 | Better connection handling, SSL termination | 1 day |
| 14 | **Redis caching for all hot paths** | Near-zero DB load for reads | 2 days |
| 15 | **Read replica for PostgreSQL** | 2x read throughput | 1 day |
| 16 | **CDN for static event data** | Offload static reads to edge | 1 day |
| 17 | **Pre-cache auth middleware** with student profile | Eliminate auth-related DB overhead | 1 day |
| **Cumulative Phase 3** | | **p95 < 500ms @ 2,000+ users** | **~1-2 weeks** |

---

## 7. Expected System Capacity After Fixes

### Projected Performance Matrix

| Optimization Stage | Max Concurrent Users (p95 < 500ms) | Throughput | p95 @ 50 Users |
|:-------------------|:----------------------------------:|:----------:|:--------------:|
| **Current (baseline)** | ~50 | 31 req/s | 2,460ms |
| **After Phase 1** (pool + cluster + cache) | ~200-300 | ~124 req/s | ~200ms |
| **After Phase 2** (indexes + HTTP cache + async audit) | ~500-800 | ~200 req/s | ~100ms |
| **After Phase 3** (PgBouncer + Redis everywhere + Nginx) | **2,000+** | **500-1,000 req/s** | **<50ms** |

### Calculation Basis

**Phase 1 throughput estimate:**
- Current: 1 process × 31 req/s = 31 req/s
- PM2 (4 cores): 4 × 31 = 124 req/s
- With caching (80% cache hit): effective DB load = 124 × 0.2 = 24.8 req/s hitting DB
- Queue wait at 200 users: 200 / 124 = 1.6 concurrent requests per worker → minimal queuing

**Phase 3 throughput estimate:**
- PM2 (8 cores): 8 workers
- With caching (90% hit): each worker handles mostly cache-served responses (~10ms each)
- Effective capacity: 8 × ~100 req/s = 800 req/s (cache hits at ~10ms mean 100 req/s per worker)
- With PgBouncer + read replica: DB can handle 50-100 query/s → supports 500-1,000 req/s with 90% cache hit

---

## 8. Appendix: Technical Evidence

### 8.1 Throughput Plateau Evidence

```
50 VUs:  31.2 req/s    # ← CPU-bound ceiling
100 VUs: 25.8 req/s    # ← Slight drop due to context switching overhead
200 VUs: 31.6 req/s    # ← Same ceiling, more queue wait
500 VUs: 31.4 req/s    # ← Same ceiling, massive queue wait → errors begin
```

The constant ~31 req/s across all VU levels proves the bottleneck is CPU-bound (single thread), not I/O-bound.

### 8.2 Connection Pool Starvation Evidence

Development pool: `connection_limit=5`

At 50 VUs with `listEvents()` making 4 DB calls:
- Concurrent DB queries: 50 × 4 = 200
- Available connections: 5
- Queue factor: 200 / 5 = 40
- Per-query time: ~50ms
- Queue wait per query: 40 × 50ms = **2,000ms**
- Observed avg response: **1,420ms** (aligns with pool contention model)

### 8.3 Key Files Reference

| File | Purpose | Lines |
|:-----|:--------|:-----:|
| [backend/src/server.js](backend/src/server.js) | Server entry, middleware pipeline | 239 |
| [backend/src/shared/config/database.js](backend/src/shared/config/database.js) | Prisma client, connection pool | ~150 |
| [backend/src/shared/config/redis.js](backend/src/shared/config/redis.js) | Redis cache, memory fallback, TTL config | 400+ |
| [backend/src/shared/config/app.config.js](backend/src/shared/config/app.config.js) | Rate limit, JWT, CORS, pool config | 39 |
| [backend/src/shared/middleware/auth.js](backend/src/shared/middleware/auth.js) | JWT verify, user cache, permission check | 200+ |
| [backend/src/modules/event-management/services/event.service.js](backend/src/modules/event-management/services/event.service.js) | Core event logic (list, detail, register) | 1650+ |
| [backend/src/modules/event-management/services/registration.service.js](backend/src/modules/event-management/services/registration.service.js) | Registration form, submit, dashboard | 400+ |
| [backend/src/modules/event-management/services/eventSettings.service.js](backend/src/modules/event-management/services/eventSettings.service.js) | Visibility filter, registration open check | 620+ |
| [backend/src/modules/event-management/utils/eventHelpers.js](backend/src/modules/event-management/utils/eventHelpers.js) | resolveEvent, generateId, canRegister | 370+ |
| [backend/src/modules/event-management/controllers/event.controller.js](backend/src/modules/event-management/controllers/event.controller.js) | Request handling, response formatting | 700+ |
| [backend/prisma/schema.prisma](backend/prisma/schema.prisma) | Database models, indexes | 2600+ |

### 8.4 Load Test Configuration

```
Tool: Grafana k6 v1.6.1 (Windows amd64)
Script: scripts/k6/event-management-load.js
Token Pool: 150 pre-generated JWT tokens
Test Event: EVT-2026-0007 (published, free, individual)
Think Time: 0.5s between requests
Executor: constant-vus
Backend: Node.js + Express.js 4.18.2 (single process, no cluster)
Database: PostgreSQL (Neon serverless) via Prisma 5.19.0
Cache: Redis (ioredis) with memory fallback
Rate Limit: 500 req/15min per IP (express-rate-limit)
```

---

*End of Performance Audit Report*

**Document ID:** PERF-AUDIT-2026-03-11  
**Classification:** Internal Engineering  
**Next Review:** After Phase 1 implementation — re-run load tests to validate improvements
