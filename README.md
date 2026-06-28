# loop-ad Advertisement API

이 서버는 MVP loop 중 **광고 노출 결정** 단계만 담당합니다.

쇼핑 서비스에서 `project_id`와 `user_id`를 받으면, 저장된 사용자 segment와 진행 중인 experiment를 조회합니다. 이후 experiment에 저장된 action probability를 기준으로 하나의 action을 선택하고, 해당 action에 연결된 generated content를 광고로 반환합니다.

선택 결과는 `ad_decisions`에 저장되며, 응답에는 이후 impression, click, purchase 이벤트와 연결할 수 있도록 `decision_id`가 포함됩니다.

## 역할

이 repository는 하나의 NestJS 서버 앱입니다.

| 항목 | 값 |
|---|---|
| Framework | NestJS 11 |
| Language | TypeScript |
| Database | PostgreSQL |
| Cache | Redis-compatible Valkey |
| DB access | `pg` raw SQL |
| Package manager | npm |
| Health check | `GET /health` |
| Main API | `POST /ads/decision` |

광고 결정은 `user_id` 기반입니다. MVP에서는 `anonymous_id`를 가정하지 않습니다.

## 제공하지 않는 것

이 서버는 아래 기능을 제공하지 않습니다.

- click tracking endpoint
- SDK/Ingest event 수집
- AI 추천 계산 또는 Thompson Sampling 계산
- content generation
- Kafka, ClickHouse, Kinesis producer
- dashboard, analytics pipeline, ad-management platform

`ad_impression`, `ad_click`, `purchase` 같은 결과 이벤트는 SDK/Ingest flow에서
수집합니다. 이때 광고 노출과 연결되는 이벤트는 이 서버가 반환한 `decision_id`를
함께 보내야 합니다.

## HTTP API

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/health` | ECS/NLB health check. 정상일 때 `200`을 반환합니다. |
| `POST` | `/ads/decision` | 한 요청에 대해 하나의 광고 content decision을 반환합니다. |
| `POST` | `/api/ads/decision` | public ALB 광고 API 호환 경로입니다. |
| `POST` | `/advertisements/decision` | public ALB 광고 API 호환 경로입니다. |

### `POST /ads/decision`

요청 `Content-Type`은 `application/json`이어야 합니다.

Public ALB 호환 경로인 `POST /api/ads/decision`과
`POST /advertisements/decision`도 같은 요청/응답 계약을 사용합니다.

Request:

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

`project_id`와 `user_id`는 필수입니다. `slot_id`, `page_url`, `category`,
`device`는 요청 context입니다. MVP segment matching은 요청 context가 아니라
`user_profiles`에 저장된 사용자 속성을 기준으로 수행합니다.

명세에 없는 최상위 필드는 거부합니다. 특히 `anonymous_id`는 MVP에서 금지합니다.

Response:

```json
{
  "decision_id": "1",
  "project_id": "demo_project",
  "user_id": "user_001",
  "segment_id": "seg_30m_mobile_fresh",
  "experiment_id": "exp_001",
  "recommendation_id": "rec_001",
  "action_id": "act_discount",
  "content_id": "content_discount",
  "content_url": "https://s3.ap-northeast-2.amazonaws.com/loop-ad-demo/content_discount.png"
}
```

`decision_id`는 `ad_decisions.id`를 문자열로 반환한 값입니다. 이후 SDK/Ingest로
들어오는 관련 결과 이벤트는 같은 `decision_id`를 포함해야 합니다.

주요 오류 응답:

- `400 Bad Request`: 필수 필드 누락, 빈 문자열, 명세 외 필드 포함
- `500 Internal Server Error`: default segment 또는 default content seed 누락 등 서버가 복구할 수 없는 설정 문제

## Decision Flow

MVP 광고 결정은 아래 순서로 진행합니다.

```txt
user_id
  -> user_profiles
  -> segment_definitions
  -> experiments
  -> experiment_action_probs
  -> generated_contents
  -> ad_decisions
```

의미는 다음과 같습니다.

1. `project_id + user_id`로 사용자의 segment를 찾습니다.
2. Redis `seg:{project_id}:{user_id}` cache를 먼저 확인합니다.
3. Redis miss 또는 Redis 장애 시 Postgres에서 `user_profiles`와 `segment_definitions`를 조회합니다.
4. segment 기준으로 `running` experiment를 우선 조회하고, 없으면 최신 `completed` experiment를 사용합니다.
5. `completed` experiment에 `winner_action_id`가 있으면 winner action을 사용합니다.
6. `running` experiment는 저장된 `experiment_action_probs.probability`를 읽고 weighted random으로 action을 선택합니다.
7. 선택한 action의 `generated_contents.content_url`을 조회합니다.
8. 정상 선택 경로에서는 `ad_decisions`에 저장하고 생성된 id를 `decision_id`로 반환합니다.

광고 서버는 확률을 계산하거나 업데이트하지 않습니다. AI/experiment 서버가
저장한 확률을 읽고 선택만 수행합니다.

## Fallback Policy

MVP fallback은 광고를 계속 반환하기 위한 product behavior입니다. 

| 상황 | 동작 |
|---|---|
| user profile 없음 | seed data의 default segment 사용 |
| segment match 없음 | seed data의 default segment 사용 |
| active experiment 없음 | seed data의 default banner content 반환, `decision_id`는 빈 문자열 |
| probability row 없음 | 같은 recommendation의 available action을 equal weight로 선택 |
| selected action content 없음 | seed data의 default banner content 반환, `decision_id`는 빈 문자열 |
| decision insert 실패 | content 응답은 유지하고 `decision_id`는 빈 문자열 |

default segment와 default banner는 seed data에서만 가져옵니다. required runtime env에
기본값을 넣어 fallback하지 않습니다.

현재 fallback 경로는 `ad_decisions`에 저장하지 않습니다. `ad_decisions` linkage
컬럼의 nullable 정책이 확정되면 fallback decision 저장 정책은 별도 변경으로
다룹니다.

## Required Env

서버는 시작할 때 필요한 환경변수가 모두 있는지 검증합니다.   
필수 환경변수가 없거나 잘못된 값이면, 기본값으로 대체하지 않고 서버를 중단합니다.

| Env | 예시 | 설명 |
|---|---|---|
| `LOOPAD_ENV` | `local` | 실행 환경 이름 |
| `LOOPAD_SERVICE_ID` | `advertisement-api` | 서비스 식별자. 다른 값이면 실패합니다. |
| `PORT` | `8080` | `0.0.0.0:${PORT}`로 listen합니다. |
| `LOOPAD_AURORA_HOST` | `127.0.0.1` | PostgreSQL hostname |
| `LOOPAD_AURORA_PORT` | `55432` | PostgreSQL port |
| `LOOPAD_AURORA_DATABASE` | `loopad_ad_decision` | PostgreSQL database |
| `LOOPAD_AURORA_USERNAME` | `loopad` | PostgreSQL username |
| `LOOPAD_AURORA_PASSWORD` | `loopad` | PostgreSQL password |
| `LOOPAD_REDIS_URL` | `redis://127.0.0.1:6379` | Redis-compatible endpoint |

배포 환경에서 Redis는 infra가 제공하는 `LOOPAD_REDIS_URL`을 그대로
사용합니다.   
이 값이 없거나 잘못되어도 앱 코드에서 로컬 Redis 주소로 바꿔서 실행하지 않습니다.

## Schema Tool Env

DB schema script는 standard libpq env를 사용합니다.

| Env | 예시 | 설명 |
|---|---|---|
| `PGHOST` | `127.0.0.1` | PostgreSQL host |
| `PGPORT` | `55432` | PostgreSQL port |
| `PGUSER` | `loopad` | PostgreSQL user |
| `PGPASSWORD` | `loopad` | PostgreSQL password |
| `PGDATABASE` | `loopad_ad_decision` | PostgreSQL database |
| `PGSSLMODE` | `disable` | local schema tool SSL mode |

## Local Development

### 1. 패키지 설치

```bash
npm install
```

### 2. Postgres와 Redis 실행

```bash
docker compose up -d
```

로컬 기본 endpoint:

| Service | URL |
|---|---|
| Postgres | `127.0.0.1:55432` |
| Redis | `redis://127.0.0.1:6379` |

### 3. 환경변수 로드

이 앱은 `.env` 파일을 자동으로 로드하지 않습니다. 앱 서버와 DB script를 실행할
터미널에서 환경변수를 먼저 로드합니다.

```bash
set -a
source .env.local
set +a
```

로컬 예시:

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

PGHOST=127.0.0.1
PGPORT=55432
PGUSER=loopad
PGPASSWORD=loopad
PGDATABASE=loopad_ad_decision
PGSSLMODE=disable
```

`.env`, `.env.local`, `.env.*.local`은 커밋하지 않습니다.

### 4. DB schema 적용 및 seed 입력

```bash
npm run db:migrate
npm run db:verify
npm run db:seed
```

- `db:migrate`: `database/schema.sql` target schema를 적용합니다.
- `db:verify`: schema drift를 확인합니다.
- `db:seed`: demo segment, experiment, probability, generated content seed를 입력합니다.

Seed는 재실행 시 primary key 중복 오류가 날 수 있습니다. 이 경우는 이미 같은 seed가
들어간 상태라는 뜻입니다.

### 5. 앱 서버 실행

```bash
npm run dev
```

health check:

```bash
curl -i http://localhost:8080/health
```

## Quick Test

로컬 서버가 `PORT=8080`으로 떠 있고 DB seed가 들어간 상태에서 실행합니다.

```bash
curl -i -X POST http://localhost:8080/ads/decision \
  -H 'Content-Type: application/json' \
  -d '{
    "project_id": "demo_project",
    "user_id": "user_001",
    "slot_id": "main_banner",
    "page_url": "/products/chicken_001",
    "category": "fresh_food",
    "device": "mobile"
  }'
```

정상 응답은 아래 형태입니다. weighted random 선택 결과에 따라 `action_id`와
`content_id`는 달라질 수 있습니다.

```json
{
  "decision_id": "1",
  "project_id": "demo_project",
  "user_id": "user_001",
  "segment_id": "seg_30m_mobile_fresh",
  "experiment_id": "exp_001",
  "recommendation_id": "rec_001",
  "action_id": "act_discount",
  "content_id": "content_discount",
  "content_url": "https://s3.ap-northeast-2.amazonaws.com/loop-ad-demo/content_discount.png"
}
```

명세 외 필드가 거부되는지 확인하려면 `anonymous_id`를 추가해 `400 Bad Request`가
나는지 확인합니다.

## Verification

일반 검증:

```bash
npm run lint
npm run test
npm run build
```

외부 Postgres/Redis 없이 MVP decision flow만 빠르게 확인하려면 아래 테스트를
실행합니다.

```bash
npm run test -- \
  src/ads/services/ad-decision.service.spec.ts \
  src/ads/services/ad-action-selector.service.spec.ts \
  src/ads/services/ad-segment.service.spec.ts \
  src/ads/controllers/ad-api.integration.spec.ts
```

`POST /ads/decision` API를 로컬에서 실제로 호출하려면, 먼저 local Postgres에 seed 데이터를 넣어야 합니다.
Redis를 사용할 수 없는 경우에도, 서버는 Postgres를 조회해 광고 결정을 계속 수행합니다.

## Deployment

이 repository는 Docker image로 빌드되어 ECS service로 배포됩니다.

배포 workflow는 `.github/workflows/deploy.yml`에 있으며 현재 `main` branch push에서만
dev ECS service 배포를 실행합니다. `dev` branch push는 서버 배포를 자동 실행하지
않습니다.

배포 대상 이름:

| Field | Value |
|---|---|
| Service | Advertisement API |
| `service_name` | `advertisement-api` |
| `ecr_repository` | `loop-ad/advertisement-api` |
| `ecs_cluster` | `dev-loop-ad-cluster` |
| `ecs_service` | `dev-advertisement-api` |
| `container_name` | `advertisement-api` |

## Related Docs

- [AGENTS.md](AGENTS.md): repository authoritative contract
- [database/schema.sql](database/schema.sql): MVP target schema
- [database/seed.sql](database/seed.sql): local/demo seed data
- [docs/mvp-ad-decision/implementation-notes.md](docs/mvp-ad-decision/implementation-notes.md): 구현 상세 설명
- [docs/ad-cache-policy.md](docs/ad-cache-policy.md): segment cache 정책
- [docs/ad-server-design.md](docs/ad-server-design.md): MVP 광고 결정 서버 설계
