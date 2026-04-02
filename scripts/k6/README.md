# Event Management Load Testing with k6

This folder contains a reusable k6 script for the Event Management module.

## What this script tests

- Login once and reuse the token
- Event list endpoint
- Event detail endpoint
- Registration form endpoint
- Optional registration endpoint load

## Default endpoints used

- POST /api/v1/auth/login
- GET /api/v1/events
- GET /api/v1/events/:id
- GET /api/v1/events/:id/registration-form
- POST /api/v1/events/:id/register
- POST /api/v1/events/:id/register-with-form

## Before running

1. Start the backend locally.
2. Make sure at least one event exists.
3. If you want registration load, choose a test event that is open for registration.
4. Prefer staging or local data, not production.

## Quick smoke test

```powershell
k6 run .\scripts\k6\event-management-load.js
```

## Basic browse load test

```powershell
$env:BASE_URL="http://localhost:5001/api/v1"
$env:USERNAME="STU123456789"
$env:PASSWORD="student123"
$env:STAGES_JSON='[{"target":10,"duration":"1m"},{"target":25,"duration":"2m"},{"target":50,"duration":"2m"},{"target":0,"duration":"30s"}]'
k6 run .\scripts\k6\event-management-load.js
```

## Registration load test

```powershell
$env:BASE_URL="http://localhost:5001/api/v1"
$env:USERNAME="STU123456789"
$env:PASSWORD="student123"
$env:EVENT_ID="replace-with-real-event-id"
$env:FLOW="register"
k6 run .\scripts\k6\event-management-load.js
```

## Registration form mode

Use this only if the event requires custom fields.

```powershell
$env:FLOW="register"
$env:REGISTER_MODE="form"
$env:REGISTER_FORM_JSON='{"answers":[]}'
k6 run .\scripts\k6\event-management-load.js
```

## Constant users instead of arrival rate

```powershell
$env:EXECUTOR="constant-vus"
$env:VUS="50"
$env:DURATION="3m"
k6 run .\scripts\k6\event-management-load.js
```

## How to find capacity

Increase load step by step and watch these numbers in the k6 output:

- http_req_duration p95
- http_req_failed
- failed_requests

Use this process:

1. Run 10 requests per second for 1 to 2 minutes.
2. Then run 25 requests per second.
3. Then 50 requests per second.
4. Then 75 or 100 requests per second.
5. Stop when p95 grows too much, failures start, or server CPU and DB become unstable.

## Practical interpretation

- If 50 requests per second runs with p95 below 1 second and failure rate below 1%, treat 50 RPS as stable.
- If 75 requests per second starts failing, your current safe capacity is somewhere below that.
- To estimate concurrent users, divide your average request rate by the average user think time.

Example:

- If the system is stable at 60 requests per second
- And an average user makes 1 request every 3 seconds
- Then rough concurrent user capacity is about 180 active users

## Important limitation for registration tests

The backend applies a strict login rate limit on the login route. Also, repeated registration with the same user can become duplicate registration instead of real capacity measurement.

For true write-capacity testing, use:

1. Many seeded student accounts
2. Pre-generated tokens, or temporarily relaxed login rate limiting in local or staging
3. A dedicated event created only for load testing
