# Event Management Module — Load Test Report

**Date:** 2026-03-11  
**Tool:** Grafana k6 v1.6.1  
**Backend:** Node.js + Express.js (port 5001)  
**Database:** PostgreSQL (Neon serverless) via Prisma ORM  
**Cache:** Redis (ioredis)  
**Test Event:** EVT-2026-0007 (published, free, individual)  
**Token Pool:** 150 pre-generated JWT tokens (K6EVT0001–K6EVT0150)

---

## 1. Browse Flow Results (Read-Only: List Events → Event Detail → Registration Form)

| Concurrent Users (VUs) | Duration | Total Requests | Failure Rate | Avg Response | p95 Response | Throughput | Status |
|:-----------------------:|:--------:|:--------------:|:------------:|:------------:|:------------:|:----------:|:------:|
| **50**                  | 2 min    | 3,792          | **0.00%**    | 1.42s        | **2.46s**    | 31.2 req/s | ✅ PASS |
| **100**                 | 2 min    | 3,234          | **0.00%**    | 3.65s        | **7.83s**    | 25.8 req/s | ⚠️ SLOW |
| **200**                 | 2 min    | 4,200          | **0.00%**    | 6.09s        | **10.58s**   | 31.6 req/s | ⚠️ SLOW |
| **500**                 | 3 min    | 6,531          | **9.87%**    | 15.35s       | **26.78s**   | 31.4 req/s | ❌ FAIL |

### Browse Flow Endpoint Breakdown (50 VUs — Best Passing Result)

| Endpoint              | Avg     | p90     | p95     | Max     |
|:----------------------|:-------:|:-------:|:-------:|:-------:|
| GET /events           | 1.75s   | 2.44s   | 2.73s   | 3.53s   |
| GET /events/:id       | 1.80s   | 2.32s   | 2.49s   | 3.46s   |
| GET /events/:id/form  | 721ms   | 978ms   | 1.08s   | 2.40s   |

---

## 2. Registration Flow Results (Browse + POST /events/:id/register)

| Concurrent Users (VUs) | Duration | Total Requests | HTTP Failure Rate* | Avg Response | p95 Response | Throughput |
|:-----------------------:|:--------:|:--------------:|:------------------:|:------------:|:------------:|:----------:|
| **50**                  | 2 min    | 3,604          | 20.86%*            | 1.56s        | **2.91s**    | 29.4 req/s |

> *\*20.86% HTTP failures are **expected "already registered" responses** (409/400). With 150 unique users, after each user registers once, subsequent iterations return duplicate errors. All application-level checks passed **100%**.*

### Registration Endpoint Timing (50 VUs)

| Endpoint                    | Avg     | p90     | p95     | Max     |
|:----------------------------|:-------:|:-------:|:-------:|:-------:|
| POST /events/:id/register   | 1.51s   | 2.81s   | 3.64s   | 5.80s   |

---

## 3. Key Findings

### Maximum Stable Capacity

| Metric                              | Value                |
|:-----------------------------------:|:--------------------:|
| **Max concurrent browse users (p95 < 3s)** | **~50 users**    |
| **Max concurrent browse users (0% errors)** | **~200 users** (but p95 = 10.58s) |
| **Max concurrent registration users**       | **50 users** (p95 = 2.91s) |
| **System breaking point (errors start)**    | **~500 users** (9.87% failures) |
| **Throughput ceiling**                      | **~31 req/s** (constant across all VU levels) |

### Observations

1. **Throughput is capped at ~31 req/s** regardless of VU count (50–500). This is the Node.js single-threaded bottleneck — adding more concurrent users just increases queue wait time, not throughput.

2. **No HTTP errors up to 200 VUs.** The server handles all requests correctly, just slowly. Response times scale linearly with concurrency.

3. **At 500 VUs, 9.87% of requests fail.** Connection timeouts and refusals start occurring. The server is overwhelmed.

4. **Registration is heavier than browse** — POST /register at p95=3.64s vs browse-only endpoints at p95=2.46s–2.73s (at same 50 VU load).

5. **Registration form endpoint is fastest** (avg 721ms at 50 VU) — likely served from Redis cache.

---

## 4. Bottleneck Analysis

| Bottleneck               | Evidence                                    | Impact    |
|:-------------------------|:--------------------------------------------|:---------:|
| **Node.js single thread** | Throughput plateaus at ~31 req/s at all loads | 🔴 High   |
| **Database queries**      | Event list & detail endpoints are slowest    | 🟡 Medium |
| **No connection pooling**  | Server crashes at 500 concurrent connections | 🔴 High   |
| **Neon serverless cold starts** | Min response times increase with VU count | 🟡 Medium |

---

## 5. Recommendations

### Quick Wins (No Architecture Changes)
- **Enable Node.js cluster mode** (PM2 or built-in `cluster`) — multiply throughput by CPU core count
- **Add database connection pooling** (PgBouncer or Prisma connection pool) — handle more concurrent connections
- **Increase Redis cache TTLs** for event list/detail during peak load

### Medium-Term Improvements
- **Add response caching middleware** (e.g., `apicache`) for read-heavy endpoints
- **Optimize Prisma queries** — check for N+1 queries in event list/detail endpoints
- **Add request queuing** (Bull/BullMQ) for registration writes to prevent DB overload

### For Production Scale (1000+ users)
- **Horizontal scaling** — multiple Node.js instances behind a load balancer (Nginx/HAProxy)
- **Read replicas** for PostgreSQL
- **CDN** for static event data

---

## 6. Test Configuration

```
k6 script: scripts/k6/event-management-load.js
Token pool: scripts/k6/generated/event-load-users.json (150 users)
Test event: EVT-2026-0007
Think time: 0.5s between requests
Executor: constant-vus
Rate limit: default (500 req/15min per IP)
```

---

*Report generated automatically by load testing automation.*
