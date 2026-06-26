# LoopAd Advertisement Server

LoopAd 데모 쇼핑 서비스의 MVP 광고 서버입니다.

이 서버의 역할은 메인 페이지 광고 슬롯마다 어떤 광고를 보여줄지 빠르게 결정하는 것입니다. MVP 범위는 광고 플랫폼 전체가 아니라, 데모 쇼핑 서비스의 메인 페이지 광고 노출과 클릭 추적을 검증하는 데 집중합니다.

## 프로젝트 개요

- Framework: NestJS 11
- Language: TypeScript
- Database: PostgreSQL
- Cache: Redis
- DB access: `pg` raw SQL
- Package manager: npm
- Main API:
  - `POST /v1/ad-decision`
  - `POST /v1/ad-click`
- Health check:
  - `GET /health`

MVP에서 지원하는 광고 슬롯은 메인 페이지 슬롯 3개뿐입니다.

```txt
main_hero
main_side_left
main_side_right
```

상세 페이지 슬롯, 검색 페이지 슬롯, 입찰 시스템, 추천 서버 연동, Kafka/Kinesis 이벤트 파이프라인, 관리자 UI는 MVP 범위가 아닙니다.

## 핵심 동작

광고 결정은 아래 순서로 진행됩니다.

```txt
Placement → Campaign → Creative
```

1. Placement: 요청된 `slot_id`에 노출 가능한 캠페인 후보를 찾습니다.
2. Campaign: 사용자 context와 캠페인 target 조건을 비교해 매칭되는 캠페인을 고릅니다.
3. Creative: 선택된 캠페인 안에서 A/B creative variant를 결정합니다.

Campaign selection은 rule-based targeting입니다.

- target 조건은 AND 로직으로 매칭합니다.
- 비어 있는 target 필드는 pass-through 조건입니다.
- category가 주요 targeting 축입니다.
- age, gender는 보조 targeting 축입니다.
- campaign에 `target_gender`가 있으면 `context.gender`가 정확히 일치해야 합니다.
- `context.gender`가 없거나 `null`이면 gender-targeted campaign은 매칭되지 않습니다.
- 매칭된 campaign 중 priority가 높은 campaign이 선택됩니다.
- weight-based distribution은 MVP 범위가 아닙니다.

A/B creative selection은 랜덤이 아니라 deterministic hashing입니다.   
단독 구현이라 추천 서버가 없어서 rule-based로 진행했습니다.

```txt
input = user_id + ":" + campaign_id
hash = MurmurHash3 x86 32-bit, seed 0
bucket = hash % 100
bucket < 50 → A
bucket >= 50 → B
```

tracking token은 HMAC-SHA256 signed self-contained token입니다.   
토큰은 암호화된 값이 아니라 서명된 값이므로, payload에는 PII나 secret을 넣으면 안 됩니다.
   
역시 단독 구현이라 이벤트 파이프라인이 없어서 HMAC-SHA256 signed self-contained token를 선택했습니다.

## 로컬 실행

### 1. 패키지 설치

```bash
npm install
```

### 2. Postgres와 Redis 실행

```bash
docker compose up -d
```

기본 포트는 아래와 같습니다.

```txt
Postgres: 127.0.0.1:55432
Redis:    127.0.0.1:6379
```

Postgres host port는 로컬 `5432` 충돌을 피하기 위해 기본값이 `55432`입니다.

### 3. 환경변수 로드

이 프로젝트는 `.env` 파일을 앱에서 자동으로 로드하지 않습니다. DB 스크립트와 앱 서버를 실행할 터미널에서 환경변수를 먼저 로드해야 합니다.

```bash
set -a
source .env.example
set +a
```

실제 개발에서는 `.env.example`을 참고해 로컬용 `.env.local`을 만들고, 아래처럼 로드해도 됩니다. `.env.local`은 커밋하지 않습니다.

```bash
set -a
source .env.local
set +a
```

중요한 환경변수:

```txt
LOOPAD_ENV=local
LOOPAD_SERVICE_ID=advertisement-api
LOOPAD_RUNTIME=go
PORT=8080
LOOPAD_AURORA_HOST=127.0.0.1
LOOPAD_AURORA_PORT=55432
LOOPAD_AURORA_DATABASE=loopad_ad_decision
LOOPAD_AURORA_USERNAME=loopad
LOOPAD_AURORA_PASSWORD=loopad
LOOPAD_REDIS_URL=redis://127.0.0.1:6379
HMAC_SECRET=replace-me-with-a-local-secret

PGHOST=127.0.0.1
PGPORT=55432
PGUSER=loopad
PGPASSWORD=loopad
PGDATABASE=loopad_ad_decision
PGSSLMODE=disable
```

`LOOPAD_*`, `PORT`, `HMAC_SECRET` 중 하나라도 없거나 형식이 틀리면 서버가 시작 시점에 실패합니다.

### 4. DB schema 적용 및 seed 입력

```bash
npm run db:migrate
npm run db:verify
npm run db:seed
```

- `db:migrate`: `database/schema.sql`을 sqldef로 적용합니다.
- `db:verify`: DB schema drift를 확인합니다.
- `db:seed`: demo campaign, creative, placement 데이터를 넣습니다.

이미 seed가 들어간 DB에서 `npm run db:seed`를 다시 실행하면 primary key 중복 오류가 날 수 있습니다. 이 경우는 데이터가 이미 들어간 상태라는 뜻입니다.

### 5. 앱 서버 실행

```bash
npm run dev
```

로컬 예시 포트는 `PORT=8080`입니다.

```txt
http://localhost:8080
```

Health check:

```txt
http://localhost:8080/health
```

## Postman 빠른 테스트

### 정상 광고 결정 테스트

Postman 설정:

```txt
Method: POST
URL: http://localhost:8080/v1/ad-decision
Headers:
  Content-Type: application/json
Body:
  raw 선택 → JSON 선택
```

Body에는 이것만 붙여넣습니다.

```json
{
  "project_id": "loopad-demo-shop",
  "user_id": "user_001",
  "session_id": "session_001",
  "slots": ["main_hero"],
  "context": {
    "page_url": "/",
    "device": "mobile",
    "category": "fresh_food",
    "age_group": "30s",
    "gender": null
  }
}
```

정상이라면 `main_hero` 슬롯에 대해 `camp_fresh_01` 캠페인이 선택됩니다.

`user_001:camp_fresh_01`의 MurmurHash3 bucket은 `44`이고, `44 < 50`이므로 variant는 `A`입니다. 따라서 creative는 `cr_fresh_A`가 나오는 것이 정상입니다.

응답 예시:

```json
{
  "decisions": [
    {
      "slot_id": "main_hero",
      "creative_id": "cr_fresh_A",
      "campaign_id": "camp_fresh_01",
      "variant": "A",
      "creative": {
        "image_url": "https://placehold.co/800x400?text=fresh-A",
        "target_url": "/category/fresh_food",
        "headline": "신선한 닭가슴살 30% 할인"
      },
      "tracking_token": "<non-empty signed token>"
    }
  ]
}
```

`tracking_token`은 요청 시점의 `issued_at`을 포함하므로 요청할 때마다 값이 달라질 수 있습니다. 비어 있지 않은 문자열이면 정상입니다.

### 빈 슬롯 테스트

매칭되는 캠페인이 없으면 fallback 광고를 억지로 넣지 않고 null decision을 반환합니다.

Postman에서 Body를 아래처럼 바꿔서 보냅니다.

```json
{
  "project_id": "loopad-demo-shop",
  "user_id": "user_001",
  "session_id": "session_001",
  "slots": ["main_hero"],
  "context": {
    "page_url": "/",
    "device": "mobile",
    "category": "book",
    "age_group": "50s",
    "gender": null
  }
}
```

정상 응답:

```json
{
  "decisions": [
    {
      "slot_id": "main_hero",
      "creative_id": null,
      "campaign_id": null,
      "variant": null,
      "creative": null,
      "tracking_token": null
    }
  ]
}
```

## Click API 테스트

`/v1/ad-decision` 응답에서 받은 `tracking_token`을 `/v1/ad-click`으로 보냅니다.

Postman 설정:

```txt
Method: POST
URL: http://localhost:8080/v1/ad-click
Headers:
  Content-Type: application/json
Body:
  raw 선택 → JSON 선택
```

Body:

```json
{
  "tracking_token": "<ad-decision 응답에서 받은 tracking_token>"
}
```

정상 응답:

```json
{
  "ok": true
}
```

서버는 tracking token의 signature를 검증한 뒤, token payload에서 campaign, creative, variant, slot 정보를 복원하고 `ad_click` 이벤트를 emit합니다. MVP에서는 실제 이벤트 파이프라인 대신 logging 구현을 사용합니다.

## API 규칙

### POST /v1/ad-decision

요청의 `slots`는 반드시 배열이어야 합니다.

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

응답은 요청한 슬롯 순서를 보존하고, 요청 슬롯마다 decision 하나를 반환합니다.

```json
{
  "decisions": [
    {
      "slot_id": "main_hero",
      "creative_id": "cr_fresh_A",
      "campaign_id": "camp_fresh_01",
      "variant": "A",
      "creative": {
        "image_url": "https://placehold.co/800x400?text=fresh-A",
        "target_url": "/category/fresh_food",
        "headline": "신선한 닭가슴살 30% 할인"
      },
      "tracking_token": "<non-empty signed token>"
    }
  ]
}
```

매칭 실패 시 해당 슬롯 decision은 아래처럼 반환됩니다.

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

### POST /v1/ad-click

요청:

```json
{
  "tracking_token": "<signed tracking token>"
}
```

응답:

```json
{
  "ok": true
}
```

서명이 틀리거나 형식이 잘못된 token은 `401 Unauthorized`로 거절됩니다.

## Seed 데이터

`database/seed.sql`은 demo 검증용 데이터를 넣습니다.

### Campaigns

| campaign_id | slot | priority | target |
|---|---|---:|---|
| `camp_fresh_01` | `main_hero` | 10 | category=`fresh_food`, age=`30s`,`40s` |
| `camp_pet_01` | `main_hero` | 8 | category=`pet`, age=`20s`,`30s` |
| `camp_digital_01` | `main_side_left` | 5 | category=`digital` |
| `camp_fashion_01` | `main_side_right` | 5 | category=`fashion`, age=`20s`,`30s`, gender=`female` |

### Creatives

각 campaign은 A/B creative 2개를 가집니다. 총 8개입니다.

| campaign_id | A creative | B creative |
|---|---|---|
| `camp_fresh_01` | `cr_fresh_A` | `cr_fresh_B` |
| `camp_pet_01` | `cr_pet_A` | `cr_pet_B` |
| `camp_digital_01` | `cr_digital_A` | `cr_digital_B` |
| `camp_fashion_01` | `cr_fashion_A` | `cr_fashion_B` |

### Placements

총 4개 placement가 있습니다.

```txt
camp_fresh_01   → main_hero
camp_pet_01     → main_hero
camp_digital_01 → main_side_left
camp_fashion_01 → main_side_right
```

## Redis cache 정책

Redis에는 최종 선택된 광고가 아니라 슬롯 단위 candidate campaign list를 저장합니다.

Cache key format:

```txt
tenant:{project_id}:slot:{slot_id}:candidates
```

예시:

```txt
tenant:loopad-demo-shop:slot:main_hero:candidates
```

MVP TTL은 60초입니다.

```txt
TTL = 60 seconds
```

흐름:

```txt
Redis hit
→ deserialize candidates
→ target filtering
→ priority selection
→ deterministic variant selection
→ tracking token generation

Redis miss
→ query Postgres
→ write candidates to Redis with TTL
→ same decision flow
```

Redis가 일시적으로 unavailable이면 서버는 Postgres fallback을 시도합니다. Postgres도 사용할 수 없으면 ad decision API는 정상적으로 결정할 수 없습니다.

## 테스트와 검증

코드 변경 전후로 아래 명령을 사용합니다.

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

DB schema까지 확인하려면 Docker와 환경변수 로드가 필요합니다.

```bash
docker compose up -d
set -a
source .env.example
set +a
npm run db:migrate
npm run db:verify
npm run db:seed
```

## 자주 생기는 문제

### Docker가 실행 중이 아님

`docker compose up -d`가 실패하면 Docker Desktop이 실행 중인지 확인합니다.

### 환경변수를 로드하지 않음

앱이 `.env`를 자동으로 읽지 않습니다. `npm run dev`, `npm run db:migrate`, `npm run db:seed`를 실행하는 터미널에서 먼저 환경변수를 로드해야 합니다.

```bash
set -a
source .env.example
set +a
```

### 필수 env 누락

이 서버는 시작 시점에 필수 env를 검증합니다. `LOOPAD_*`, `PORT`, `HMAC_SECRET` 중 하나라도 없거나 형식이 틀리면 서버가 빠르게 실패합니다.

### Postgres 포트 혼동

컨테이너 내부 Postgres 포트는 `5432`이지만, 로컬 host 포트는 기본 `55432`입니다.

```txt
LOOPAD_AURORA_PORT=55432
PGPORT=55432
```

### Redis cache가 이전 응답처럼 보임

candidate cache TTL은 60초입니다. seed 데이터를 바꾼 직후라면 TTL이 지나기를 기다리거나 Redis를 재시작합니다.

```bash
docker compose restart redis
```

### db:seed에서 duplicate key 오류가 남

현재 `database/seed.sql`은 비어 있는 DB에 demo 데이터를 넣는 용도입니다. 이미 seed가 들어간 DB에서 다시 실행하면 아래처럼 primary key 중복 오류가 날 수 있습니다.

```txt
ERROR: duplicate key value violates unique constraint "campaign_pkey"
```

이 경우 schema 적용이나 앱 실행 실패가 아니라, demo 데이터가 이미 들어가 있다는 뜻입니다.

## 참고 문서

- `AGENTS.md`: 이 저장소에서 지켜야 하는 구현 규칙
- `docs/ad-server-design.md`: 광고 결정 서버 설계 문서
- `docs/ad-cache-policy.md`: Redis candidate cache 정책
- `database/schema.sql`: sqldef target schema
- `database/seed.sql`: demo seed data
