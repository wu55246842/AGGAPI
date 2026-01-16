# Unified Model Gateway (MVP)

Replicate-like multi-model API gateway with routing, fallback, streaming (SSE), async jobs, rate limiting, billing, and usage aggregation.

## Features
- Unified API (`/v1/responses`, `/v1/responses/stream`, `/v1/jobs`, `/v1/models`, `/v1/usage`)
- OpenAI-compatible façade (`/v1/chat.completions`)
- Routing + fallback across providers (OpenAI, Anthropic, Mock)
- Rate limiting + API key auth (hash + prefix)
- Usage & billing (token + cost)
- OpenTelemetry tracing + structured JSON logs
- BullMQ async jobs

## Local Development

### 1) Install dependencies
```bash
npm install
```

### 2) Start Postgres + Redis
```bash
docker compose up -d postgres redis
```

### 3) Configure environment
```bash
cp .env.example .env
```

### 4) Run Prisma
```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 5) Create an API key record
Generate a random key and insert its prefix + hash.
```bash
node -e "const crypto=require('crypto');const key='sk_test_'+crypto.randomBytes(16).toString('hex');const hash=crypto.createHash('sha256').update(key).digest('hex');console.log({key, prefix:key.slice(0,6), hash});"
```
Then insert into DB:
```sql
INSERT INTO "ApiKey" (id, prefix, hash, "tenantId", "projectId", "rateLimitPerMinute", "isActive")
VALUES (gen_random_uuid(), '<prefix>', '<hash>', 'tenant_demo', 'project_demo', 60, true);
```

### 6) Run the API
```bash
npm run start:dev
```

## Docker Compose (All-in-one)
```bash
docker compose up --build
```

## Curl Examples (10)

> Replace `<API_KEY>` with your key or run with `MOCK_MODE=true`.

1) Basic unified response
```bash
curl -sS http://localhost:3000/v1/responses \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4.1","input":{"messages":[{"role":"user","content":[{"type":"text","text":"Hello"}]}]}}'
```

2) Streamed unified response (SSE)
```bash
curl -N http://localhost:3000/v1/responses/stream \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4.1","input":{"prompt":"Stream please"}}'
```

3) Explicit job creation
```bash
curl -sS http://localhost:3000/v1/jobs \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"request":{"model":"gpt-4.1","input":{"prompt":"Run async"}}}'
```

4) Get job status
```bash
curl -sS http://localhost:3000/v1/jobs/<JOB_ID> \
  -H "Authorization: Bearer <API_KEY>"
```

5) List models
```bash
curl -sS http://localhost:3000/v1/models \
  -H "Authorization: Bearer <API_KEY>"
```

6) Usage aggregation
```bash
curl -sS "http://localhost:3000/v1/usage?from=2024-01-01T00:00:00Z&to=2024-12-31T23:59:59Z" \
  -H "Authorization: Bearer <API_KEY>"
```

7) OpenAI-compatible chat completion
```bash
curl -sS http://localhost:3000/v1/chat.completions \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4.1","messages":[{"role":"user","content":"Hi"}]}'
```

8) Routing strategy: cost
```bash
curl -sS http://localhost:3000/v1/responses \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4.1","input":{"prompt":"Cheapest"},"constraints":{"routing":{"strategy":"cost"}}}'
```

9) Routing strategy: reliability with provider allowlist
```bash
curl -sS http://localhost:3000/v1/responses \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-3.5-sonnet","input":{"prompt":"Only anthropic"},"constraints":{"routing":{"strategy":"reliability","allow_providers":["anthropic"]}}}'
```

10) Budget constraints
```bash
curl -sS http://localhost:3000/v1/responses \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4.1","input":{"prompt":"Budget"},"constraints":{"budget":{"max_cost_usd":0.01}}}'
```
