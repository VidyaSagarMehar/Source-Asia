# Rate-Limited API Service

Production-oriented backend assignment implementation using Next.js App Router, TypeScript, Node.js runtime, Redis, and BullMQ.

## 1) Project Overview

This service provides:

- `POST /api/request` to submit requests per user with strict rate limiting (5 requests/minute).
- `GET /api/stats` to inspect user-level request metrics.
- Atomic sliding-window limit checks with Redis Lua scripts (safe under high concurrency).
- Optional queue-based retry path when rate limit is exceeded.

## 2) Tech Stack

- Next.js (App Router)
- TypeScript
- Node.js runtime for API routes (`runtime = "nodejs"`)
- Redis (`ioredis`)
- BullMQ (optional retry queue)
- Zod (input/environment validation)
- Pino (structured logging)

## 3) How To Run Locally

### Prerequisites

- Node.js 20+
- Redis server (local or managed)

### Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Update `.env` values:

```env
REDIS_URL=redis://localhost:6379
RATE_LIMIT_MAX_REQUESTS=5
RATE_LIMIT_WINDOW_SECONDS=60
ENABLE_RETRY_QUEUE=true
REQUEST_QUEUE_NAME=rate-limit-retry
LOG_LEVEL=info
```

4. Start API server:

```bash
npm run dev
```

5. (Optional but recommended) Start retry worker in a separate terminal:

```bash
npm run worker
```

## 4) API Documentation

### POST `/api/request`

Request body:

```json
{
  "user_id": "string",
  "payload": {}
}
```

Success response (`200`):

```json
{
  "success": true,
  "message": "Request accepted",
  "request_id": "uuid",
  "user_id": "user-1",
  "total_requests": 1,
  "current_window_requests": 1,
  "remaining_requests": 4,
  "window_reset_time": 1710000000000
}
```

Rate-limited response (`429`):

```json
{
  "error": "Rate limit exceeded",
  "details": {
    "retry_after_seconds": 47,
    "current_window_requests": 5,
    "remaining_requests": 0,
    "window_reset_time": 1710000000000,
    "queued_for_retry": true
  }
}
```

### GET `/api/stats`

- `GET /api/stats`: returns all tracked users.
- `GET /api/stats?user_id=user-1`: returns a single user.

Response:

```json
{
  "max_requests_per_window": 5,
  "window_seconds": 60,
  "stats": {
    "user-1": {
      "total_requests": 12,
      "current_window_requests": 3,
      "remaining_requests": 2,
      "window_reset_time": 1710000000000
    }
  }
}
```

## 5) Design Decisions

### Why Sliding Window Log

- It is exact and timestamp-based, not an approximation.
- It avoids fixed-window burst problems at boundary edges.
- It is easy to validate under concurrent traffic when implemented atomically.

### Why Redis

- Fast, centralized shared state for multiple API instances.
- Native sorted sets and Lua scripting fit sliding-window log implementation.
- TTL-based cleanup avoids long-term storage buildup.

## 6) Concurrency Handling Explanation

Concurrency safety is handled with a Lua script executed in Redis for each incoming request:

1. Remove expired entries from the user’s sorted set.
2. Add current request timestamp/member.
3. Count current window (`ZCARD`).
4. If above limit, rollback the just-added member.
5. Return allow/deny + current counts + reset timestamp.

Because the script runs atomically in Redis, simultaneous requests cannot bypass the limit.

## 7) Limitations

- Single Redis dependency: service availability depends on Redis availability.
- Single-region setup may introduce latency for globally distributed clients.
- Stats endpoint is simple and can be expensive with very large user cardinality.

## 8) Future Improvements

- Multi-region or geo-replicated Redis strategy.
- Dedicated analytics pipeline for historical request metrics.
- API gateway integration (e.g., Kong/NGINX/Cloud gateway) for layered defenses.
- Add formal integration tests and load tests in CI.

## 9) Deployment (Vercel + Redis)

1. Deploy Next.js app to Vercel.
2. Provision Redis (Upstash Redis or managed Redis provider).
3. Set environment variables in Vercel project settings:
   - `REDIS_URL`
   - `RATE_LIMIT_MAX_REQUESTS`
   - `RATE_LIMIT_WINDOW_SECONDS`
   - `ENABLE_RETRY_QUEUE`
   - `REQUEST_QUEUE_NAME`
   - `LOG_LEVEL`
4. Deploy worker separately (container, VM, or serverless worker environment) because BullMQ workers should run as long-lived processes.

## Folder Structure

```text
app/
  api/
    request/route.ts
    stats/route.ts
  layout.tsx
  page.tsx
lib/
  env.ts
  logger.ts
  queue.ts
  rateLimiter.ts
  redis.ts
  requestStore.ts
scripts/
  concurrency-test.ts
types/
  api.ts
utils/
  http.ts
workers/
  rateLimitRetryWorker.ts
postman/
  SourceAsia.postman_collection.json
```

## Postman Collection

A ready-to-use Postman collection is included for quick API verification:

- `postman/SourceAsia.postman_collection.json`

How to use:

1. Open Postman and click **Import**.
2. Select `postman/SourceAsia.postman_collection.json`.
3. Create an environment variable `baseUrl` with value `http://localhost:3000`.
4. Run requests from the collection using `{{baseUrl}}`.

The collection covers:

- Valid `POST /api/request`
- Rate-limited `POST /api/request` scenario
- `GET /api/stats`
- `GET /api/stats?user_id=...`

## Test / Verification Commands

### Basic Manual Test (curl)

```bash
curl -X POST http://localhost:3000/api/request \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user-1","payload":{"foo":"bar"}}'
```

```bash
curl "http://localhost:3000/api/stats?user_id=user-1"
```

### Concurrent Requests Test

Start app, then run:

```bash
npm run test:concurrency
```

Expected behavior:

- Exactly `5` requests accepted (`200`)
- Remaining requests rejected (`429`)
- No race-condition bypass under simultaneous calls
