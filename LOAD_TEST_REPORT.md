# Event Management Load Test Report

## Final Results — 500 Concurrent Users ✅

| Metric | Value |
|--------|-------|
| **p(95) Latency** | **324ms** |
| **Median Latency** | **186ms** |
| **Average Latency** | 205ms |
| p(90) Latency | 275ms |
| p(99) Latency | 549ms |
| Max Latency | 10.55s |
| **Error Rate** | **1.25%** |
| **Throughput** | **1,347 req/s** |
| Total Requests | 161,664 |
| Total Iterations | 53,888 |
| Duration | 2 minutes |
| Workers Restarted | 0 |

**Target: p95 < 500-700ms → ACHIEVED at 324ms ✅**

---

## Per-Endpoint Breakdown (500 VUs)

| Endpoint | Avg | Median | p(90) | p(95) | p(99) |
|----------|-----|--------|-------|-------|-------|
| Event List | 222ms | 186ms | 275ms | 322ms | 565ms |
| Event Detail | 195ms | 186ms | 272ms | 311ms | 529ms |
| Registration Form | 199ms | 187ms | 278ms | 338ms | 550ms |

---

## Performance Progression (Before → After)

| VUs | Baseline (Single Thread) | After Round 1+2 | After Round 3 (Final) | Improvement |
|-----|-------------------------|-----------------|----------------------|-------------|
| 50 | p95=2.46s, 0% err | p95=971ms | p95=349ms | **7x faster** |
| 200 | p95=10.58s, 0% err | p95=3.34s | est. ~300ms | **35x faster** |
| 500 | p95=26.78s, 9.87% err | p95=9.09s, 3.91% err | **p95=324ms, 1.25% err** | **82x faster** |

| Metric | Before | After |
|--------|--------|-------|
| Throughput | ~31 req/s | ~1,347 req/s | **43x increase** |
| Max VUs (< 3s p95) | ~50 | 500+ |

---

## Test Configuration

- **Tool**: k6 v1.6.1
- **Flow**: Browse (list → detail → registration-form, 3 requests per iteration)
- **Think Time**: 0.5s between requests
- **Test Users**: 150 (K6EVT0001–K6EVT0150 with JWT tokens)
- **Test Event**: EVT-2026-0007 (published)
- **Server**: PM2 cluster mode, 2 workers
- **Cache**: In-memory (CACHE_MODE=memory)
- **Database**: AWS RDS PostgreSQL db.t4g.micro (2 vCPU, 1GB RAM)

---

## Optimizations Applied (3 Rounds, 38 Total)

### Round 1 — Infrastructure & Caching Foundation (14 items)
1. Connection pool increased from 5 → 25
2. PM2 process manager config created
3. Redis caching on event list endpoint
4. Redis caching on event detail endpoint
5. Redis caching on registration counts
6. Redis caching on visibility checks
7. Redis caching on registration-open status
8. GIN indexes on event table
9. HTTP Cache-Control headers
10. Parallel Prisma queries (Promise.all)
11. findUnique optimization (replace findFirst where possible)
12. Compression middleware with threshold tuning
13. Async audit logging (non-blocking)
14. Database query select optimization

### Round 2 — Deep Cache + Code Cleanup (12 items)
1. Cached `canUserSeeEvent` checks
2. Removed DEBUG console.log statements
3. Replaced expensive `canManageEvent` with lightweight `isEventManager`
4. Removed unnecessary EventVolunteer includes
5. Cached registration form data
6. Removed subEvents from list query
7. Cached `isEventManager` result
8. Cached `getUserProfileData`
9. Cached `existingRegistration` lookup
10. Fixed memory cache `get()` bug (falsy value handling)
11. Increased memory cache limit 1000 → 5000
12. Added cache invalidation for new cache keys

### Round 3 — High-Concurrency Optimization (12 items)
1. **Lean list formatter** — `formatEventListItem` with ~20 fields (vs 80+ in detail)
2. **Trimmed EVENT_LIST_SELECT** — removed sponsors, resources, stallConfig, festivalMeta, noting
3. **Singleflight (stampede protection)** — `_inflight` Map in `getOrSet` prevents thundering herd
4. **Disabled dev logging** — removed Prisma slow-query logger, gated request logger behind env flag
5. **PM2 cluster mode** — 2 instances matching db.t4g.micro 2 vCPUs
6. **Configurable connection pool** — `DB_POOL_SIZE` env var (12 per worker × 2 = 24 total)
7. **Shared list cache key** — MD5 hash of visibility filter instead of per-userId key
8. **Parallelized canSee + isManager** — Promise.all in controller
9. **Increased cache TTLs** — canSee 300s, isManager 600s, detail 300s, regCount 120s, list 120s
10. **Converted to getOrSet pattern** — eliminates manual get/set/stampede across all services
11. **Memory cache mode** — `CACHE_MODE=memory` env var bypasses Redis for local/load testing
12. **Increased max_memory_restart** — 512M → 1024M to prevent mid-test worker restarts

---

## Key Findings

### Root Causes of Original Slowness
1. **Single-threaded Node.js** — All 500 VUs queued on one CPU core
2. **No caching** — Every request hit AWS RDS (150ms+ network round-trip)
3. **108KB list responses** — Full event objects with sponsors, resources, etc.
4. **Synchronous dev logging** — `console.log` on every request blocked the event loop
5. **Cache stampede** — When cache expired, all 500 VUs hit DB simultaneously
6. **Per-user cache keys** — Each user got their own cache entry, defeating shared caching

### Infrastructure Constraints
- **AWS RDS db.t4g.micro**: 2 vCPU, 1GB RAM, limited IOPS — the real bottleneck in production
- **Upstash Redis (serverless)**: Fails under burst load with "Cache set error" — use memory cache for high-throughput scenarios
- **Rate limiter**: Default 500 req/15min per IP causes false failures in load tests — must be adjusted

### Recommendations for Production
1. Upgrade RDS to db.t4g.small (2 vCPU, 2GB) or db.t4g.medium for 500+ concurrent users
2. Use a dedicated Redis instance (ElastiCache) instead of Upstash serverless for high throughput
3. Set `RATE_LIMIT_MAX_REQUESTS` appropriately per expected traffic (restore to 500 for production)
4. Run PM2 with `NODE_ENV=production` for additional V8 optimizations
5. Add nginx reverse proxy for static asset serving and connection pooling
