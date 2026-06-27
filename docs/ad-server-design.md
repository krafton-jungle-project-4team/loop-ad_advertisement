# Ad Decision Server Design

## 1. Purpose

The Ad Decision Server decides which advertisement should be shown in each ad slot on the LoopAd demo shopping service.

The MVP goal is:

```txt
Show personalized ads quickly on the main page.
```

This server focuses on ad decisioning, not analytics, recommendation modeling, bidding, or full campaign management.

---

## 2. MVP Scope

### Included

The MVP includes:

- Main page ad decision API.
- Three main page ad slots.
- Common schema based candidate read model.
- Rule-based target filtering.
- Priority-based campaign selection.
- Deterministic A/B creative selection.
- Redis candidate cache.
- Impression event emit interface.

### Excluded

The MVP excludes:

- Detail page ads.
- Search page ads.
- Real-time bidding.
- Recommendation server integration.
- Weight-based campaign distribution.
- Same-priority campaign competition.
- Kafka/Kinesis integration implementation.
- Analytics consumer implementation.
- Click tracking.
- Projector-based Redis cache updates.
- Admin UI for campaign management.

---

## 3. Slot Definition

The MVP supports only main page slots.

```ts
slot_id = "main_hero"        // large main banner
slot_id = "main_side_left"   // left side banner
slot_id = "main_side_right"  // right side banner
```

The MVP intentionally focuses on the main page because supporting main, detail, and search pages at the same time would require different candidate pools, cache keys, and exposure logic for each slot group.

---

## 4. Data Model

The runtime ad model is still exposed to the decision service as three layers.

```txt
Candidate mapping / Campaign / Creative
```

### Campaign

Campaign is the business unit of advertising.

It represents what the advertiser wants to promote.

Example campaigns:

- Fresh food promotion
- Pet product promotion
- Digital appliance event
- Fashion promotion

Campaign fields after mapping:

```ts
campaign_id
name
priority
status
target
```

### Creative

Creative is the actual material rendered on the screen.

Each campaign can have A/B creatives.

Creative fields after mapping:

```ts
creative_id
campaign_id
variant
headline
image_url
target_url
```

### Candidate Mapping

Candidate mapping defines where and for which target a campaign can be shown.

Mapping fields after conversion:

```ts
campaign_id
slot_id
weight
priority
target
```

In this phase, `weight` exists in the data model but is not used for campaign selection.

### Database Schema (Postgres)

`database/schema.sql` is the sqldef target schema for local advertisement-server development. It contains the common tables this service directly reads:

```txt
projects
campaigns
coupons
ad_creatives
recommendation_results
experiments
segment_ad_mappings
```

The repository reads `segment_ad_mappings + campaigns + ad_creatives`, then the mapper converts common rows into the internal `CandidateCampaign` shape.

ID mapping:

```txt
campaigns.id                   -> DB join key
campaigns.external_campaign_id -> API/token/hash campaign_id
ad_creatives.id                -> DB join key
ad_creatives.external_creative_id -> API/token creative_id
```

`ad_creatives.external_creative_id` is nullable for migration compatibility in the current schema, but application mapping treats it as required. After existing rows are backfilled, promote it to `NOT NULL` with `UNIQUE(project_id, external_creative_id)`.

Candidate mapping:

```txt
execution_hint_json.slot_id  -> placement.slot_id
execution_hint_json.priority -> candidate.priority
execution_hint_json.weight   -> placement.weight
segment_json                 -> target
payload_json.variant         -> creative.variant
```

---

## 5. Decision Flow

The ad server narrows candidates in this order:

```txt
Placement → Campaign → Creative
```

### Step 1. Placement Filtering

The server receives requested slots.

For each slot, it loads candidate campaigns whose placement read model is represented by `segment_ad_mappings.execution_hint_json.slot_id`.

Example:

```txt
main_hero → camp_fresh_01, camp_pet_01
```

### Step 2. Campaign Filtering

The server filters candidates by user/request context.

Target rules:

- Target conditions are matched with AND logic.
- Empty target fields are skipped.
- Category is the primary condition.
- Age and gender are optional supporting conditions.
- If a candidate target has `gender`, `context.gender` must exactly match it.
- If `context.gender` is missing or null, gender-targeted campaigns do not match.
- Fully empty targets are not allowed for personalized campaigns.

Example:

```txt
User context: category=fresh_food, age_group=30s
Candidate: camp_fresh_01
Result: match
```

### Step 3. Campaign Ranking

After filtering, the server selects the highest-priority campaign.

Rules:

- Higher priority wins.
- Weight-based distribution is out of MVP scope.
- Same-priority competition is intentionally avoided in the MVP seed data.

### Step 4. Creative Selection

After selecting a campaign, the server chooses an A/B creative through deterministic hashing.

Input:

```txt
user_id + ":" + campaign_id
```

Bucket rule:

```txt
hash = MurmurHash3 x86 32-bit, seed 0
bucket = hash % 100
0-49  -> A
50-99 -> B
```

This keeps the same user assigned to the same creative variant for the same campaign without storing user-level assignment records.

---

## 6. Ad Decision API

### Endpoint

```http
POST /v1/ad-decision
```

### Request

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

### Request Rules

- `slots` must be an array.
- The server should process multiple slots in one request.
- `user_id` may be an anonymous ID when the user is not logged in.
- `context.category` is used as the primary targeting signal in the MVP.
- `context.age_group` and `context.gender` are optional supporting request signals.
- If a candidate target has `gender`, a missing or null `context.gender` does not match it.

### Response

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
      }
    },
    {
      "slot_id": "main_side_left",
      "creative_id": null,
      "campaign_id": null,
      "variant": null,
      "creative": null
    }
  ]
}
```

### Response Rules

- The response contains one decision per requested slot.
- If no candidate matches, return a null decision.
- The server must not force a fallback ad unless explicitly required.

---

## 7. Click Tracking Boundary

This server does not provide click tracking.

Rules:

- Do not issue signed tracking tokens from the ad decision API.
- Do not expose `POST /v1/ad-click`.
- Do not add token-signing secrets to this service.
- Click tracking, if needed, is owned by another service.

---

## 8. Event Emit Interface

The ad server defines an event emit interface for impressions.

MVP behavior:

- The ad server creates event objects.
- The event emitter interface receives the event.
- The actual transport is replaced with logging in the MVP.

Future behavior:

- The event emitter can be connected to Kafka, Kinesis, or another event pipeline.
- Analytics consumers are owned outside the ad decision server.

### Impression Event

The server emits one impression event per non-null decision when building the response. Real viewability tracking, meaning whether the ad was actually seen on screen, is out of MVP scope.

Example:

```json
{
  "event_type": "ad_impression",
  "project_id": "loopad-demo-shop",
  "slot_id": "main_hero",
  "campaign_id": "camp_fresh_01",
  "creative_id": "cr_fresh_B",
  "variant": "B",
  "user_id": "user_123",
  "session_id": "session_456"
}
```

## 9. Demo Seed Data

### Placements

`campaign_id` is read from `campaigns.external_campaign_id`. Slot, priority, weight, and target data are read from `segment_ad_mappings` JSON fields as the placement read model.

| campaign_id | name | slot | priority | status | target |
|---|---|---:|---:|---|---|
| camp_fresh_01 | 신선식품 프로모션 | main_hero | 10 | active | category=fresh_food / age=30s,40s |
| camp_pet_01 | 반려동물 용품 프로모션 | main_hero | 8 | active | category=pet / age=20s,30s |
| camp_digital_01 | 디지털/가전 기획전 | main_side_left | 5 | active | category=digital |
| camp_fashion_01 | 패션 기획전 | main_side_right | 5 | active | category=fashion / age=20s,30s / gender=female |

### Creatives

| creative_id | campaign_id | variant | headline | image_url | target_url |
|---|---|---|---|---|---|
| cr_fresh_A | camp_fresh_01 | A | 신선한 닭가슴살 30% 할인 | https://placehold.co/800x400?text=fresh-A | /category/fresh_food |
| cr_fresh_B | camp_fresh_01 | B | 오늘의 신선특가 ✨ | https://placehold.co/800x400?text=fresh-B | /category/fresh_food |
| cr_pet_A | camp_pet_01 | A | 우리 아이 간식 특가 | https://placehold.co/800x400?text=pet-A | /category/pet |
| cr_pet_B | camp_pet_01 | B | 반려동물 필수템 모음 | https://placehold.co/800x400?text=pet-B | /category/pet |
| cr_digital_A | camp_digital_01 | A | 신상 이어폰 입고 | https://placehold.co/400x400?text=digital-A | /category/digital |
| cr_digital_B | camp_digital_01 | B | 가전 최대 50% | https://placehold.co/400x400?text=digital-B | /category/digital |
| cr_fashion_A | camp_fashion_01 | A | 지금 많이 보는 데일리룩 | https://placehold.co/400x400?text=fashion-A | /category/fashion |
| cr_fashion_B | camp_fashion_01 | B | 오늘의 패션 특가 | https://placehold.co/400x400?text=fashion-B | /category/fashion |

---

## 10. Test Scenarios

### Scenario 1. main_hero competition

| Request Context | Expected Decision | Verification Point |
|---|---|---|
| age=30s, category=fresh_food | camp_fresh_01 | target filtering |
| age=20s, category=pet | camp_pet_01 | context-based selection |
| age=30s, category=pet | camp_pet_01 | pet target allows 20s and 30s |
| age=50s, category=book | null | empty slot behavior |
| age=20s, category=fresh_food | null | age mismatch |

### Scenario 2. A/B creative selection

Given:

```txt
category=fresh_food
age_group=30s
slot_id=main_hero
```

Expected:

- `camp_fresh_01` always wins campaign selection.
- Different users may receive different variants.
- The same user must receive the same variant for the same campaign.
- MurmurHash3 x86 32-bit with seed `0` must produce these locked values for `camp_fresh_01`:

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

- The distribution for `user_0` through `user_999` should stay within a 45-55% tolerance band for both variants.

### Scenario 3. Side slots

| Slot | Campaign | Expected |
|---|---|---|
| main_side_left | camp_digital_01 | digital context matches |
| main_side_right | camp_fashion_01 | fashion + 20s/30s + female context matches |
| main_side_right | null | fashion + 20s/30s + male context returns null |
| main_side_right | null | fashion + 20s/30s + null gender returns null |
| main_side_right | null | non-matching category or age returns null |

---

## 11. Future Extensions

After the MVP, the server may be extended with:

- Detail page slots.
- Search page slots.
- Projector-based cache update.
- Explicit Redis invalidation.
- Weight-based campaign distribution.
- Frequency capping.
- Impression deduplication.
- Real analytics pipeline integration.
- Recommendation server integration.
