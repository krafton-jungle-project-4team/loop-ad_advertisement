# AGENTS.md

## Project Overview

This repository implements the MVP Ad Decision Server for the LoopAd demo shopping service.

The main responsibility of this server is to return one advertising content decision for a shopping request by using the agreed MVP loop data:
`user_id`, segment, running experiment, action probabilities, generated content, and `decision_id`.

The MVP focuses on:

- Receiving `POST /ads/decision` requests from the demo shopping service.
- Resolving a `user_id` to a segment through `user_profiles` and `segment_definitions`.
- Reading the active experiment for that segment.
- Reading action selection probabilities from `experiment_action_probs`.
- Selecting one action with weighted random based on stored probabilities.
- Returning the selected `generated_contents.content_url`.
- Saving the selected result to `ad_decisions` and returning its id as `decision_id`.

This project does not implement a full ad-management platform, bidding system, recommendation engine, analytics pipeline, click tracking endpoint, Kafka/ClickHouse ingestion, content generation, or real-time projector in the MVP.

---

## Repository Guidance Scope

Keep a single root `AGENTS.md` for this repository while it remains one deployable server app.

Add nested `AGENTS.md` files only if the repository later becomes a monorepo or contains subtrees with different stacks, commands, ownership, or deployment contracts.

This file should combine:

- LoopAd advertisement domain rules for this service.
- App repository rules from the infra main guide:
  `https://github.com/krafton-jungle-project-4team/loop-ad_infra/blob/main/docs/app-repository-guide.md`

When these instructions conflict with the infra guide, update this file to match the infra guide instead of inventing a repository-local version.

---

## Main Repository Contract

This repository is a LoopAd server app repository. It must follow the main app repository guide maintained in `loop-ad_infra`.

Core rules:

- Do not put fallback or default values on required environment variables.
- Validate required runtime env immediately during server startup.
- Collect validated env values into one config object or config module.
- Fail fast when a required env is missing or malformed.
- Do not read SSM Parameter Store or Secrets Manager directly from app code.
- Do not make app code depend on ECS launch type or AWS resource implementation details.
- Do not commit `.env`, `.env.local`, or `.env.*.local`.
- Do not put secrets in source, Docker images, GitHub Actions env, logs, metric labels, error responses, or frontend bundles.

Forbidden pattern:

```ts
const redisUrl = process.env.LOOPAD_REDIS_URL || 'redis://127.0.0.1:6379';
```

Recommended pattern:

```ts
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export const appConfig = Object.freeze({
  env: requiredEnv('LOOPAD_ENV'),
  serviceId: requiredEnv('LOOPAD_SERVICE_ID'),
  port: Number(requiredEnv('PORT')),
});
```

### Server Deployment Contract

This repository is built as a Docker image and deployed as an ECS service.

Required repository files:

```txt
Dockerfile
.github/workflows/deploy.yml
config loader
```

Dockerfile and runtime rules:

- The image must run on `linux/arm64`.
- The server must read `PORT` and listen on `0.0.0.0:${PORT}`.
- Do not pass DB endpoints, passwords, tokens, or API keys as Docker build args.
- Do not bake runtime env or secrets into the image.
- The server must expose `/health` and return HTTP `200` when healthy.

Deploy workflow rules:

- Use the reusable deploy workflow from `loop-ad_infra`.
- The workflow should only build/push the image and replace the ECS service image.
- Do not define runtime env or secrets in the app repo workflow.
- Use infra guide deploy target names exactly.
- Initial seed images may be pushed directly only before the ECS service exists, and must include a `latest` tag.

Current dev deploy target for this repository:

| Field | Value |
|---|---|
| Service | Advertisement API |
| `service_name` | `advertisement-api` |
| `ecr_repository` | `loop-ad/advertisement-api` |
| `ecs_cluster` | `dev-loop-ad-cluster` |
| `ecs_service` | `dev-advertisement-api` |
| `container_name` | `advertisement-api` |

### Server Env Contract

Application runtime code must read the `LOOPAD_*` env contract from the infra guide.

Common server env:

- `LOOPAD_ENV` — execution environment, for example `dev` or `local`.
- `LOOPAD_SERVICE_ID` — service identifier. For this repository use `advertisement-api`.
- `PORT` — listen port.

Do not read `LOOPAD_RUNTIME` or similar env to decide the app runtime. The runtime is determined by the Dockerfile, package manifest, and repository structure.

Data env used by this repository:

- `LOOPAD_AURORA_HOST` — PostgreSQL hostname.
- `LOOPAD_AURORA_PORT` — PostgreSQL port.
- `LOOPAD_AURORA_DATABASE` — PostgreSQL database name.
- `LOOPAD_AURORA_USERNAME` — PostgreSQL username secret.
- `LOOPAD_AURORA_PASSWORD` — PostgreSQL password secret.
- `LOOPAD_REDIS_URL` — Redis-compatible Valkey endpoint.

For Redis in deployed environments, connect to `LOOPAD_REDIS_URL` as the provided endpoint. Do not silently fall back to local Redis or another address.

Legacy local names such as `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `REDIS_URL`, and `PROJECT_ID` should not be used for new runtime code. When touching config code, migrate toward the `LOOPAD_*` contract.

Schema tools may continue to use standard libpq variables:

- `PGHOST`
- `PGPORT`
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE`
- `PGSSLMODE`

### Server Logging Contract

The server must log to stdout/stderr only.

Logging rules:

- Prefer JSON structured logs.
- Include `timestamp`, `level`, `service`, `env`, and `message`.
- Request logs should include `requestId` or `traceId`.
- Do not log secrets, tokens, passwords, API keys, DB credentials, or personally identifying information.
- Do not manage file logs in application code.

---

## Core Domain Rules

The latest LoopAd MVP agreement takes precedence over older slot-based MVP notes in this repository.

### MVP Loop Contract

The complete MVP loop is:

```txt
collect events
  -> analyze/recommend actions
  -> generate content
  -> expose ads through experiments
  -> collect results again
  -> inspect dashboard
```

This advertisement server owns only the ad exposure decision step.

### Identity and Linkage

- Do not use `anonymous_id` in the MVP.
- All demo tracking is based on `user_id`.
- The ad decision response must include `decision_id`.
- Later `ad_impression`, `ad_click`, and `purchase` events are sent through the SDK/Ingest flow and must carry the same `decision_id` when they are related to the shown ad.

The important cross-service ids are:

```txt
project_id
user_id
segment_id
recommendation_id
action_id
experiment_id
content_id
decision_id
```

### Ad Decision Flow

The ad server should decide ads in this order:

```txt
user_id
  -> user_profiles
  -> segment_definitions
  -> running experiment
  -> experiment_action_probs
  -> weighted random action
  -> generated_contents
  -> ad_decisions
```

Meaning:

1. Look up `user_profiles` by `project_id` and `user_id`.
2. Match that profile to a segment in `segment_definitions`.
3. Find a running experiment for the segment.
4. Read action probabilities from `experiment_action_probs`.
5. Select one action using weighted random over stored probabilities.
6. Read the generated content URL for the selected action.
7. Save the decision to `ad_decisions`.
8. Return the saved decision id as `decision_id`.

### Segment Matching

Segment matching is static rule matching in the MVP.

Rules:

- Use `user_profiles` as the source of user attributes.
- Match `age_group`, `gender`, `device`, and `favorite_category`/`category` against `segment_definitions`.
- Use `default segment` behavior when no user profile exists, as agreed in the MVP fallback policy.
- Do not add ML personalization or anonymous tracking for the MVP.

### Action Selection

The ad server must not calculate Thompson Sampling directly.

Rules:

- The AI/experiment server calculates action probabilities and stores them in `experiment_action_probs`.
- The ad server reads the stored probabilities and performs weighted random selection only.
- If an experiment is completed and has `winner_action_id`, prefer the winner action.
- If a running experiment has no probability rows, select among available actions with equal probability.
- Probability rows for one experiment should sum to `1.0` when available.

### Fallback Policy

MVP fallback behavior is product behavior, not environment-variable fallback.

Rules:

- If there is no active experiment, return default content.
- If an experiment exists but probability rows are missing, select actions evenly.
- If selected action content is missing, return default banner content.
- If the requested `user_id` has no profile, use the default segment.
- Default segment/content must come from seed data or validated configuration, not from silent runtime env fallbacks.

---

## API Rules

### Ad Decision API

The main API is:

```txt
POST /ads/decision
```

Request shape:

```json
{
  "project_id": "demo_project",
  "user_id": "user_001",
  "slot_id": "main_banner",
  "page_url": "/products/chicken_001",
  "category": "fresh_food",
  "device": "mobile"
}
```

Response shape:

```json
{
  "decision_id": "dec_001",
  "project_id": "demo_project",
  "user_id": "user_001",
  "segment_id": "seg_30m_mobile_fresh",
  "experiment_id": "exp_001",
  "recommendation_id": "rec_001",
  "action_id": "act_discount",
  "content_id": "content_001",
  "content_url": "https://s3.ap-northeast-2.amazonaws.com/loop-ad-demo/content_001.png"
}
```

Rules:

- `project_id` and `user_id` are required.
- `anonymous_id` is forbidden.
- The response must include `decision_id`.
- The response fields must stay aligned with SDK/Ingest event fields so that ad result events can carry `decision_id`, `experiment_id`, `recommendation_id`, `action_id`, and `content_id`.
- `slot_id` is request context for the demo ad location. Do not reintroduce the older multi-slot contract unless the product requirement changes explicitly.

### Click Tracking

This server does not provide a click tracking API. Do not add `POST /ads/click`, signed tracking tokens, or token-signing secrets to this repository unless the service ownership changes explicitly.

Ad click and impression data are collected as SDK/Ingest events, not through this server.

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
    services/
      ad-decision.service.ts
      ad-segment.service.ts
      ad-experiment.service.ts
      ad-action-selector.service.ts
      ad-content.service.ts
    repositories/
      user-profile.repository.ts
      segment.repository.ts
      experiment.repository.ts
      generated-content.repository.ts
      ad-decision.repository.ts
    dto/
      ad-decision-request.dto.ts
      ad-decision-response.dto.ts
    types/
      ad-decision.types.ts

  shared/
    contracts/
      ads.contract.ts

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

Local development uses explicitly provided env values. Do not add runtime fallbacks or defaults just for local convenience.

Local application env should mirror the deployed `LOOPAD_*` contract:

```txt
LOOPAD_ENV=local
LOOPAD_SERVICE_ID=advertisement-api
PORT=8080
LOOPAD_AURORA_HOST=127.0.0.1
LOOPAD_AURORA_PORT=55432
LOOPAD_AURORA_DATABASE=loopad_ad_decision
LOOPAD_AURORA_USERNAME=loopad
LOOPAD_AURORA_PASSWORD=loopad
LOOPAD_REDIS_URL=redis://127.0.0.1:6379
```

Schema tool env may still use standard libpq names:

```txt
PGHOST=127.0.0.1
PGPORT=55432
PGUSER=loopad
PGPASSWORD=loopad
PGDATABASE=loopad_ad_decision
PGSSLMODE=disable
```

Both groups point at the same local Postgres instance. The duplicate naming exists because sqldef and psql read standard libpq `PG*` variables automatically.

---

## Schema Management

Schema management is declarative in the MVP.

- `database/schema.sql` contains the full target schema for advertisement decision runtime tables.
- Required MVP tables for this service are `user_profiles`, `segment_definitions`, `experiments`, `experiment_action_probs`, `generated_contents`, and `ad_decisions`.
- `ad_decisions.id` is returned to the frontend as `decision_id`.
- `generated_contents` stores `content_url`; do not store prompts, base64 image data, or generated file bodies in the database.
- `npm run db:migrate` applies the target schema with sqldef `--apply`.
- `npm run db:migrate:plan` previews schema changes with sqldef `--dry-run`.
- `npm run db:verify` checks schema drift with sqldef `--check`.
- sqldef manages DDL only.
- Seed rows are inserted separately through `npm run db:seed` using psql. Seeds should include the demo project, default segment/content, `user_001`, `rec_001`, `exp_001`, and initial action probabilities when needed for local MVP flow.
- `db:forcesync` and schema DROP-style force sync workflows are intentionally out of MVP scope.

---

## Implementation Rules

- Keep controllers thin.
- Put business logic in services.
- Put DB access in repositories.
- Database access uses `pg` with raw SQL queries. No ORM, no query builder, no pgTyped in the MVP.
- Keep segment matching, experiment lookup, weighted action selection, content lookup, and decision persistence as separate responsibilities.
- Do not calculate Thompson Sampling in this service.
- Do not call AI/recommendation/content-generation services synchronously from the decision request path; read persisted PostgreSQL tables.
- Do not implement Kafka/Kinesis producers directly unless explicitly requested.
- Do not emit `ad_impression` or `ad_click` events directly from this server in the MVP. The SDK/Ingest flow collects those events with `decision_id`.
- Add tests for segment resolution, weighted random selection, winner-action precedence, fallback behavior, `ad_decisions` persistence, and API response fields.

---

## Testing Scenarios

The implementation should support the following MVP scenarios:

### user_001 decision

- A request with `project_id = demo_project` and `user_id = user_001` resolves to `seg_30m_mobile_fresh`.
- A running experiment for that segment is selected.
- One action is selected from `experiment_action_probs`.
- The selected action resolves to a `generated_contents.content_url`.
- A row is inserted into `ad_decisions`.
- The API response includes `decision_id`, `project_id`, `user_id`, `segment_id`, `experiment_id`, `recommendation_id`, `action_id`, `content_id`, and `content_url`.

### Probability-driven selection

- When probabilities are `0.3333`, `0.3333`, and `0.3334`, repeated decisions are roughly balanced across actions.
- When probabilities are changed, repeated decisions shift toward the higher-probability action.
- The ad server does not calculate or update probability values itself.

### Fallback behavior

- Missing user profile uses the default segment.
- Missing probability rows use equal probability across available actions.
- Missing active experiment returns default content.
- Missing selected action content returns default banner content.

### Completed experiment

- If an experiment is `completed` and has `winner_action_id`, the winning action is selected before weighted random behavior.
- The decision is still persisted and returned with a `decision_id`.

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

Do not introduce new infrastructure such as Kafka, Kinesis, a recommendation server, content generation service, or real-time projector unless the task explicitly asks for it.

Do not expand the MVP into a full ad-management platform, click tracking service, SDK/Ingest server, dashboard, or analytics service unless explicitly requested.
