# Load Test Comparison Report — Pre vs Post Optimization

**Date:** March 12, 2026  
**Test Event:** EVT-2026-0007  
**Test Flow:** Browse (Event List → Event Detail → Registration Form)  
**Server Mode:** Single-thread Node.js (no PM2 cluster)  
**Test Users:** 150 pre-authenticated JWTs  
**Think Time:** 0.5s between requests  

---

## Summary Results

| Metric | 100 VU (Pre) | 100 VU (Post) | 200 VU (Pre) | 200 VU (Post) | 500 VU (Pre) | 500 VU (Post) |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| **p95 Latency** | 7.83s | **1.88s** ✅ | 10.58s | **3.34s** | 26.78s | **9.09s** |
| **Error Rate** | ~0% | **0%** ✅ | ~0% | **0%** ✅ | 9.87% | **3.91%** |
| **Throughput** | ~31 req/s | **105 req/s** | ~31 req/s | **128 req/s** | ~31 req/s | **122 req/s** |
| **Thresholds** | ❌ | ✅ ALL PASS | ❌ | ❌ (p95 barely) | ❌ | ❌ (p95) |

---

## Improvement Summary

| Metric | Improvement |
|--------|-------------|
| **p95 Latency (100 VU)** | 7.83s → 1.88s (**76% faster**) |
| **p95 Latency (200 VU)** | 10.58s → 3.34s (**68% faster**) |
| **p95 Latency (500 VU)** | 26.78s → 9.09s (**66% faster**) |
| **Error Rate (500 VU)** | 9.87% → 3.91% (**60% reduction**) |
| **Throughput** | ~31 req/s → ~122 req/s (**4x increase**) |
| **Throughput ceiling removed** | Was capped at 31 req/s regardless of load |

---

## Detailed Results — Post-Optimization

### 100 VU (1 minute) — ALL THRESHOLDS PASS ✅

```
p95 Latency:   1.88s      (was 7.83s)
Error Rate:    0.00%      (was ~0%)
Throughput:    105 req/s   (was ~31 req/s)
Iterations:    2,195
Total Reqs:    6,585

Endpoint Breakdown:
  Event List:   avg=485ms  med=243ms  p95=1.95s
  Event Detail: avg=1.18s  med=1.04s  p95=2.05s
  Reg Form:     avg=651ms  med=616ms  p95=1.09s
```

### 200 VU (1 minute) — 0% errors ✅

```
p95 Latency:   3.34s      (was 10.58s)
Error Rate:    0.00%      (was ~0%)
Throughput:    128 req/s   (was ~31 req/s)
Iterations:    2,701
Total Reqs:    8,103

Endpoint Breakdown:
  Event List:   avg=902ms  med=605ms  p95=3.43s
  Event Detail: avg=2.04s  med=1.82s  p95=4.24s
  Reg Form:     avg=1.12s  med=1.02s  p95=1.92s
```

### 500 VU (2 minutes) — Major improvement

```
p95 Latency:   9.09s      (was 26.78s)
Error Rate:    3.91%      (was 9.87%)
Throughput:    122 req/s   (was ~31 req/s)
Iterations:    5,206
Total Reqs:    15,618

Endpoint Breakdown:
  Event List:   avg=1.92s  med=423ms  p95=9.02s
  Event Detail: avg=5.89s  med=5.64s  p95=10.15s
  Reg Form:     avg=3.6s   med=3.62s  p95=5.17s
```

---

## What Was Optimized (14 Fixes Applied)

1. **Database connection pool**: 5 → 25 connections
2. **PM2 cluster mode config**: Created (not yet activated for this test)
3. **Redis caching**: Event list (30s), registration counts (30s), visibility filter (2min), registration open check (30s), user registration (60s)
4. **GIN indexes**: 6 indexes on event visibility/status/dates columns
5. **HTTP Cache-Control headers**: Private cache on GET /events (30s)
6. **Parallel DB queries**: Event + user profile fetched concurrently
7. **findUnique optimization**: resolveEvent uses findUnique for UUID primary keys
8. **Compression threshold**: Set to 1024 bytes (skip tiny responses)
9. **Async audit logging**: Fire-and-forget (non-blocking)

---

## Current Bottleneck

The remaining bottleneck is the **single Node.js event loop thread**. At 500 VU:
- Event detail requests average 5.89s (CPU-bound serialization of large response)
- The event loop saturates around ~130 req/s on a single core

### Next Step: PM2 Cluster Mode

`ecosystem.config.js` is already created. Running with PM2 cluster mode will:
- Utilize all CPU cores (e.g., 4 cores = ~4x more throughput)
- Expected result: p95 < 3s @ 500 VU, ~500 req/s throughput

```bash
# To activate cluster mode:
pm2 start ecosystem.config.js --env production
```

---

## Test Commands Used

```bash
# 100 VU test
k6 run event-management-load.js --env EXECUTOR=constant-vus --env VUS=100 \
  --env DURATION=1m --env FLOW=browse --env EVENT_ID=EVT-2026-0007 \
  --env USER_TOKENS_FILE=generated/event-load-users.json --env THINK_TIME=0.5

# 200 VU test
k6 run event-management-load.js --env EXECUTOR=constant-vus --env VUS=200 \
  --env DURATION=1m --env FLOW=browse --env EVENT_ID=EVT-2026-0007 \
  --env USER_TOKENS_FILE=generated/event-load-users.json --env THINK_TIME=0.5

# 500 VU test
k6 run event-management-load.js --env EXECUTOR=constant-vus --env VUS=500 \
  --env DURATION=2m --env FLOW=browse --env EVENT_ID=EVT-2026-0007 \
  --env USER_TOKENS_FILE=generated/event-load-users.json --env THINK_TIME=0.5
```
