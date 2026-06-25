# AGENTS.md

## Project Overview

This repository implements the MVP Ad Decision Server for the LoopAd demo shopping service.

The main responsibility of this server is to decide which advertisement should be shown in each main page ad slot with low latency.

The MVP focuses on:

- Serving ads for the main page only.
- Supporting three main page ad slots.
- Selecting campaigns through rule-based targeting.
- Selecting A/B creatives through deterministic hashing.
- Caching slot-level candidate campaigns in Redis.
- Emitting impression and click events through an interface.

This project does not implement a full ad platform, bidding system, recommendation engine, analytics pipeline, or real-time campaign projector in the MVP.

---

## Core Domain Rules

### Main Page Slots

The MVP supports only the main page ad slots below:

```ts
main_hero
main_side_left
main_side_right
```

The project intentionally avoids supporting detail page and search page slots in the MVP because each slot type would require separate candidate pools, cache keys, and exposure rules.

### Ad Decision Flow

The ad server should decide ads in this order:

```txt
Placement → Campaign → Creative
```

Meaning:

1. Placement limits candidates by `slot_id`.
2. Campaign filtering decides which campaign is suitable for the user context.
3. Creative selection chooses the final A/B variant inside the selected campaign.

### Campaign Selection

Campaign selection is rule-based in the MVP.

Rules:

- Target conditions are matched with AND logic.
- Empty target fields are treated as pass-through conditions.
- Fully empty targets are not allowed for personalized campaigns.
- Category is the primary targeting axis.
- Age and gender are optional supporting axes.
- If a campaign has `target_gender`, `context.gender` must exactly match it.
- If `context.gender` is missing or null, gender-targeted campaigns do not match.
- Priority decides the final campaign among matched candidates.
- Weight-based distribution is out of MVP scope.
- Do not create same-slot campaigns with the same priority in the MVP.

### A/B Creative Selection

A/B creative selection must use deterministic hashing.

Use a stable input such as:

```txt
user_id + ":" + campaign_id
```

Then hash the input and map the result to a variant bucket.

Example:

```txt
0-49  → A
50-99 → B
```

Do not use random selection for A/B variants because it can change the shown creative on every request and pollute experiment data.

### Empty Slot Rule

If no campaign matches a slot, the server must return an empty decision for that slot.

Do not force a fallback campaign unless the product requirement explicitly asks for one.

Use:

```json
{
  "slot_id": "main_hero",
  "creative_id": null,
  "campaign_id": null,
  "variant": null,
  "creative": null,
  "tracking_token": null
}
```

---

## API Rules

### Ad Decision API

The main API is:

```txt
POST /v1/ad-decision
```

Request shape:

```json
{
  "project_id": "loopad-demo-shop",
  "user_id": "user_123",
  "session_id": "session_456",
  "slots": ["main_hero", "main_side_left", "main_side_right"],
  "context": {
    "page_url": "/",
    "device": "mobile",
    "category": "fresh_food",
    "age_group": "30s",
    "gender": null
  }
}
```

Response shape:

```json
{
  "decisions": [
    {
      "slot_id": "main_hero",
      "creative_id": "cr_fresh_B",
      "campaign_id": "camp_fresh_01",
      "variant": "B",
      "creative": {
        "image_url": "https://placehold.co/800x400?text=fresh-B",
        "target_url": "/category/fresh_food",
        "headline": "오늘의 신선특가 ✨"
      },
      "tracking_token": "..."
    }
  ]
}
```

Rules:

- Request slots are an array.
- Response decisions must preserve one decision per requested slot.
- A missing candidate must return a null decision.
- Do not make one HTTP request per slot.
- Use Redis MGET for multi-slot candidate lookup when possible.

### Ad Click API

The click endpoint is:

```txt
POST /v1/ad-click
```

The click endpoint receives a tracking token, verifies it, restores the campaign/creative/variant/slot information, and emits an `ad_click` event.

The server that issued the tracking token is responsible for decoding and verifying it.

---

## Tracking Token Rules

Use an HMAC-SHA256 signed self-contained token in the MVP.

Format:

```txt
base64url(payload).base64url(signature)
```

The payload may include:

```json
{
  "project_id": "loopad-demo-shop",
  "slot_id": "main_hero",
  "campaign_id": "camp_fresh_01",
  "creative_id": "cr_fresh_B",
  "variant": "B",
  "user_id": "user_123",
  "session_id": "session_456",
  "issued_at": 1710000000
}
```

Rules:

- The token is signed, not encrypted.
- `user_id` and `session_id` are anonymous identifiers and may be included in the payload.
- Do not put PII or secrets in the payload.
- The token-signing service reads the HMAC secret from the `HMAC_SECRET` environment variable. Do not hardcode the secret in source.
- Verify the signature before trusting the payload.
- The MVP does not store issued tokens server-side.
- Future versions may replace this with opaque reference tokens.

---

## Redis Cache Rules

Redis stores slot-level candidate campaign lists, not final selected ads.

Candidate key format:

```txt
tenant:{project_id}:slot:{slot_id}:candidates
```

Example:

```txt
tenant:loopad-demo-shop:slot:main_hero:candidates
```

Rules:

- Include `project_id` in the key.
- Cache candidates by slot.
- Include both A and B creatives inside each cached campaign candidate.
- Do not perform another Redis lookup just to select the A/B creative.
- On Redis hit, filter candidates in memory.
- On Redis miss, load candidates from Postgres, cache them, then respond.
- Use a short TTL in the MVP, for example 60 seconds.
- Explicit invalidation and projector-based cache updates are out of MVP scope.

---

## Suggested Repository Structure

```txt
src/
  main.ts
  app.module.ts

  ads/
    ads.module.ts
    controllers/
      ad-decision.controller.ts
      ad-click.controller.ts
    services/
      ad-decision.service.ts
      ad-candidate.service.ts
      ad-targeting.service.ts
      ad-variant.service.ts
      ad-token.service.ts
      ad-event-emitter.service.ts
    repositories/
      campaign.repository.ts
      creative.repository.ts
      placement.repository.ts
    dto/
      ad-decision-request.dto.ts
      ad-decision-response.dto.ts
      ad-click-request.dto.ts
    constants/
      ad-slots.constant.ts
      ad-categories.constant.ts
    types/
      ad-decision.types.ts

  redis/
    redis.module.ts
    redis.service.ts
    ad-cache.service.ts

  shared/
    contracts/
      ads.contract.ts
    constants/
      ad-slots.ts

database/
  schema.sql
  seed.sql

scripts/
  migrate-db.mjs
  verify-schema-drift.mjs
  seed-db.mjs
  schema-sync-utils.mjs
```

---

## Local Environment

Local development uses PostgreSQL and Redis through `docker-compose` services.

Application runtime environment variables:

- `DATABASE_HOST` — Postgres host for the application `pg` pool.
- `DATABASE_PORT` — Postgres port for the application `pg` pool.
- `DATABASE_USER` — Postgres user for the application `pg` pool.
- `DATABASE_PASSWORD` — Postgres password for the application `pg` pool.
- `DATABASE_NAME` — Postgres database name for the application `pg` pool.
- `REDIS_URL` — Redis connection string.
- `HMAC_SECRET` — secret used to sign tracking tokens.
- `PROJECT_ID` — default project/tenant id, for example `loopad-demo-shop`.

Schema tool environment variables:

- `PGHOST` — Postgres host for sqldef and psql.
- `PGPORT` — Postgres port for sqldef and psql.
- `PGUSER` — Postgres user for sqldef and psql.
- `PGPASSWORD` — Postgres password for sqldef and psql.
- `PGDATABASE` — Postgres database name for sqldef and psql.
- `PGSSLMODE` — Postgres SSL mode for sqldef and psql.

Both groups point at the same local Postgres instance. The duplicate naming exists because sqldef and psql read standard libpq `PG*` variables automatically.

---

## Schema Management

Schema management is declarative in the MVP.

- `database/schema.sql` contains the full target schema for `campaign`, `creative`, and `placement`.
- `npm run db:migrate` applies the target schema with sqldef `--apply`.
- `npm run db:migrate:plan` previews schema changes with sqldef `--dry-run`.
- `npm run db:verify` checks schema drift with sqldef `--check`.
- sqldef manages DDL only.
- Seed rows are inserted separately through `npm run db:seed` using psql.
- `db:forcesync` and schema DROP-style force sync workflows are intentionally out of MVP scope.

---

## Implementation Rules

- Keep controllers thin.
- Put business logic in services.
- Put DB access in repositories.
- Database access uses `pg` with raw SQL queries. No ORM, no query builder, no pgTyped in the MVP.
- Put Redis key construction and cache serialization in cache-related services.
- Do not scatter Redis key strings across multiple files.
- Do not mix campaign filtering, variant selection, and token generation into one large function.
- Do not implement recommendation server integration in the MVP.
- Do not implement Kafka/Kinesis producers directly unless explicitly requested.
- MVP event emission may be represented by an interface and logging implementation.
- Emit one impression event per non-null decision at response build time. Do not implement client-side viewability tracking in the MVP.
- Add tests for targeting, priority selection, empty slots, deterministic A/B selection, token verification, and Redis hit/miss behavior.

---

## Testing Scenarios

The implementation should support the following MVP scenarios:

### main_hero campaign competition

- `30s / fresh_food` should expose `camp_fresh_01`.
- `20s / pet` should expose `camp_pet_01`.
- `30s / pet` should expose `camp_pet_01`.
- `50s / book` should return a null decision.
- `20s / fresh_food` should return a null decision.

### A/B creative selection

For the same `user_id + campaign_id`, the selected variant must always be the same.

Different users may receive different variants.

MVP hashing is MurmurHash3 x86 32-bit with seed `0`. Use `user_id + ":" + campaign_id` as the input, then `bucket = hash % 100`; `bucket < 50` maps to `A`, otherwise `B`.

For `camp_fresh_01`, tests must lock the following values:

| user_id | bucket | variant |
|---|---:|:---:|
| user_001 | 44 | A |
| user_002 | 25 | A |
| user_003 | 65 | B |
| user_004 | 61 | B |
| user_005 | 45 | A |
| user_006 | 70 | B |
| user_007 | 6 | A |
| user_008 | 9 | A |

### Side slots

- `main_side_left` uses `camp_digital_01`.
- `main_side_right` uses `camp_fashion_01` when category is `fashion`, age group is `20s` or `30s`, and gender is `female`.
- `main_side_right` returns a null decision when gender is `male`, missing, or null.
- If any target condition does not match, return a null decision.

---

## Commands

Use the actual project commands if they differ from this scaffold.

```bash
npm install
npm run build
npm run lint
npm run test
npm run dev
```

Before completing a task, run the relevant test and lint commands if available.

Expected `package.json` scripts:

```json
{
  "build": "nest build",
  "dev": "nest start --watch",
  "db:migrate": "node scripts/migrate-db.mjs",
  "db:migrate:plan": "node scripts/migrate-db.mjs --dry-run",
  "db:verify": "node scripts/verify-schema-drift.mjs",
  "db:seed": "node scripts/seed-db.mjs",
  "typecheck": "tsc --noEmit",
  "test": "jest",
  "lint": "eslint \"{src,scripts}/**/*.{ts,js,mjs}\""
}
```

---

## Do Not Modify

Do not modify unrelated domains.

Do not change package lock files unless explicitly requested.

Do not introduce new infrastructure such as Kafka, Kinesis, a recommendation server, or a campaign projector unless the task explicitly asks for it.

Do not expand the MVP to detail page or search page ad slots unless explicitly requested.
