# Rate-Limited API Service

Production-oriented backend assignment implementation using Next.js App Router, TypeScript, Redis, and BullMQ.

---

## 🌐 Live Deployment

- **API Base URL:**
  https://source-asia.vercel.app

- **Worker Service:**
  Deployed on Railway (background processing)

---

## 🧾 1) Project Overview

This service provides:

- `POST /api/request` to submit requests per user with strict rate limiting (5 requests/minute).
- `GET /api/stats` to inspect user-level request metrics.
- Atomic sliding-window limit checks with Redis Lua scripts (safe under high concurrency).
- Optional queue-based retry path when rate limit is exceeded.

---

## 🧠 Architecture Overview

The system is deployed using a split architecture:

- **API Layer (Vercel)** → Handles incoming HTTP requests
- **Worker Layer (Railway)** → Processes retry queue asynchronously
- **Redis** → Shared state for rate limiting & queue coordination

This ensures:

- Scalability
- Fault isolation
- Non-blocking request handling

---

## ⚙️ 2) Tech Stack

- Next.js (App Router)
- TypeScript
- Node.js runtime (`runtime = "nodejs"`)
- Redis (`ioredis`)
- BullMQ (retry queue)
- Zod (validation)
- Pino (logging)

---

## 🏃 3) How To Run Locally

### Prerequisites

- Node.js 20+
- Redis (local or cloud)

### Setup

```bash
npm install
```

```bash
cp .env.example .env
```

### Environment Variables

```env
REDIS_URL=redis://localhost:6379
RATE_LIMIT_MAX_REQUESTS=5
RATE_LIMIT_WINDOW_SECONDS=60
ENABLE_RETRY_QUEUE=true
REQUEST_QUEUE_NAME=rate-limit-retry
LOG_LEVEL=info
```

### Start API

```bash
npm run dev
```

### Start Worker (separate terminal)

```bash
npm run worker
```

---

## 📡 4) API Documentation

### 🔹 POST `/api/request`

**Production URL:**

```
https://source-asia.vercel.app/api/request
```

Request:

```json
{
	"user_id": "string",
	"payload": {}
}
```

Success (`200`):

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

Rate Limited (`429`):

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

---

### 🔹 GET `/api/stats`

**Production URL:**

```
https://source-asia.vercel.app/api/stats
```

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

---

## 🧠 5) Design Decisions

### Why Sliding Window Log

- Exact and timestamp-based
- Avoids burst issues at window boundaries
- Works reliably under concurrency

### Why Redis

- Centralized shared state
- Supports atomic operations via Lua scripts
- Efficient cleanup via TTL

---

## ⚡ 6) Concurrency Handling

Handled using Redis Lua scripts:

1. Remove expired entries
2. Add new request timestamp
3. Count requests
4. Rollback if limit exceeded

👉 Fully atomic → no race conditions under parallel requests

---

## 🔁 7) Retry Queue (Worker)

- Implemented using BullMQ
- Runs as a **separate background service on Railway**
- Processes queued requests when rate limit allows

Worker log:

```bash
Rate-limit retry worker is ready
```

---

## 📊 8) Observability

- Structured logging via Pino
- API logs → Vercel dashboard
- Worker logs → Railway dashboard

---

## ⚠️ 9) Limitations

- Depends on Redis availability
- Single-region deployment
- Stats endpoint not optimized for very large datasets

---

## 🚀 10) Future Improvements

- Multi-region Redis
- API Gateway integration
- Advanced analytics pipeline
- Load testing & CI integration

---

## 🚀 11) Deployment

### API (Vercel)

- Deployed on Vercel
- Stateless API layer

### Worker (Railway)

- Background service
- Command:

```bash
npm run worker
```

- No public endpoint
- Handles retry queue asynchronously

---

## 📁 Folder Structure

```text
app/
  api/
    request/
    stats/
lib/
workers/
postman/
scripts/
```

---

## 📮 Postman Collection

Location:

```
postman/SourceAsia.postman_collection.json
```

### Usage

1. Import into Postman
2. Set environment:

```
baseUrl = https://source-asia.vercel.app
```

3. Run APIs

Covers:

- Request API
- Rate limit scenario
- Stats API

---

## 🧪 12) Testing (Production)

### Example

```bash
curl -X POST https://source-asia.vercel.app/api/request \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user-1","payload":{"test":"data"}}'
```

---

## 🧪 Concurrent Test

```bash
npm run test:concurrency
```

Expected:

- 5 requests → success
- Remaining → 429
- No race condition bypass

---

## ✅ Final Notes

- Fully production-considered implementation
- Handles concurrency safely
- Scalable architecture (API + Worker separation)
- Redis-backed atomic rate limiting
- Ready for real-world usage
