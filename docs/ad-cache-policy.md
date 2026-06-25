# Ad Cache Policy

## 1. Purpose

This document defines the Redis cache policy for the MVP Ad Decision Server.

The cache is used to reduce ad decision latency by avoiding a Postgres query on every ad request.

The MVP cache stores slot-level candidate campaign lists, not final selected ads.

---

## 2. Cache Design Principle

The ad server separates two responsibilities:

```txt
Candidate loading → Redis / Postgres
Decision logic    → application memory
```

Redis stores the candidate campaigns for each slot.

The application server performs:

```txt
target filtering → priority selection → A/B variant selection → tracking token generation
```

This keeps the cache reusable across users while still allowing personalized decisions per request.

---

## 3. Candidate Cache Key

### Key Format

```txt
tenant:{project_id}:slot:{slot_id}:candidates
```

### Example

```txt
tenant:loopad-demo-shop:slot:main_hero:candidates
tenant:loopad-demo-shop:slot:main_side_left:candidates
tenant:loopad-demo-shop:slot:main_side_right:candidates
```

### Rules

- Include `project_id` in the key to avoid key collision across future projects or tenants.
- Use `slot_id` as the cache partition because candidate pools are slot-specific.
- Do not cache final selected ads per user in the MVP.
- Do not hardcode only one slot in Redis-related code.

---

## 4. Candidate Cache Value

The value is a serialized array of candidate campaigns for one slot.

Example:

```json
[
  {
    "campaign_id": "camp_fresh_01",
    "priority": 10,
    "status": "active",
    "target": {
      "category": "fresh_food",
      "age_groups": ["30s", "40s"],
      "gender": null
    },
    "placement": {
      "slot_id": "main_hero",
      "weight": 100
    },
    "creatives": [
      {
        "creative_id": "cr_fresh_A",
        "variant": "A",
        "headline": "신선한 닭가슴살 30% 할인",
        "image_url": "https://placehold.co/800x400?text=fresh-A",
        "target_url": "/category/fresh_food"
      },
      {
        "creative_id": "cr_fresh_B",
        "variant": "B",
        "headline": "오늘의 신선특가 ✨",
        "image_url": "https://placehold.co/800x400?text=fresh-B",
        "target_url": "/category/fresh_food"
      }
    ]
  }
]
```

### Value Rules

- Each candidate item represents one campaign.
- Each campaign candidate includes its placement data.
- Each campaign candidate includes its target conditions.
- Cache JSON uses short target keys: `category`, `age_groups`, and `gender`.
- Database columns use `target_category`, `target_age_groups`, and `target_gender`; the repository maps between the DB column names and cache JSON keys.
- Each campaign candidate includes both A and B creatives.
- Including both creatives avoids another Redis lookup after variant hashing.
- The value must be enough to complete the decision in memory.

---

## 5. Lookup Flow

### Multi-slot Request

The ad decision API receives multiple slots in one request.

Example:

```json
{
  "slots": ["main_hero", "main_side_left", "main_side_right"]
}
```

The server builds Redis keys for all requested slots and uses MGET.

```txt
MGET
tenant:loopad-demo-shop:slot:main_hero:candidates
tenant:loopad-demo-shop:slot:main_side_left:candidates
tenant:loopad-demo-shop:slot:main_side_right:candidates
```

### Hit Flow

If Redis returns candidates for a slot:

```txt
Redis hit
→ deserialize candidates
→ target filtering
→ priority selection
→ deterministic variant selection
→ tracking token generation
→ decision response
```

### Miss Flow

If Redis misses for a slot:

```txt
Redis miss
→ query Postgres for slot candidates
→ build candidate payload
→ write payload to Redis with TTL
→ perform decision logic in memory
→ decision response
```

### Partial Hit Flow

If some slots hit and others miss:

```txt
hit slots  → use Redis candidates
miss slots → load from Postgres and backfill Redis
```

The server should still return decisions for all requested slots.

---

## 6. TTL Policy

### MVP TTL

Use a short TTL for candidate cache entries.

Recommended MVP value:

```txt
60 seconds
```

### Reason

A short TTL keeps the MVP simple.

It allows campaign seed changes, status changes, and placement changes to be reflected naturally after the TTL expires.

It also reduces the risk of paused or ended campaigns being exposed permanently.

### Trade-off

Short TTL:

- Easier to implement.
- Safer for MVP correctness.
- More Postgres fallback queries.

Long TTL:

- Fewer Postgres queries.
- Higher risk of stale campaign exposure.
- Requires explicit invalidation or projector-based updates.

For the MVP, choose simplicity and correctness.

---

## 7. Cache Miss Fallback

The MVP must support fallback from Redis to Postgres.

This is required because there is no projector in the MVP.

Fallback responsibility:

```txt
Ad Decision Server
```

Future responsibility:

```txt
Campaign Projector / Cache Projector
```

The future projector may update or invalidate Redis whenever campaign, creative, or placement data changes.

The ad server read path should remain mostly unchanged after the projector is introduced.

---

## 8. Cache Invalidation

### MVP

The MVP does not implement explicit invalidation.

Campaign changes are reflected through TTL expiration.

### Future

Future versions may use:

```txt
write-through update
explicit invalidation
projector-based refresh
event-driven cache rebuild
```

Example future invalidation key:

```txt
DEL tenant:loopad-demo-shop:slot:main_hero:candidates
```

---

## 9. Redis and A/B Variant Selection

Redis stores both A and B creatives for each campaign.

The server chooses the variant after campaign selection.

Variant input:

```txt
user_id + ":" + campaign_id
```

Example:

```ts
hash = murmurhash3.x86.hash32(user_id + ":" + campaign_id, 0)
bucket = hash % 100

if bucket < 50:
  variant = "A"
else:
  variant = "B"
```

Reason:

- Same user and same campaign always produce the same variant.
- No user-level assignment table is required.
- No extra Redis lookup is needed after hashing.
- Experiment data is not polluted by random per-request changes.

---

## 10. Empty Slot Handling

Redis may return candidates, but all candidates can still fail targeting.

In that case, return a null decision.

Example:

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

Do not cache final null decisions per user in the MVP.

The candidate cache remains slot-level and reusable.

---

## 11. Serialization Rules

The cache value should be JSON-serialized in the MVP.

Rules:

- Keep the payload explicit.
- Avoid storing database entity objects directly.
- Store only fields needed by the decision flow.
- Do not store secrets.
- Do not store tracking tokens.
- Do not store user-specific decisions.
- Version the payload if the shape becomes unstable later.

Future key format with versioning:

```txt
tenant:{project_id}:slot:{slot_id}:candidates:v1
```

For the MVP, version suffix is optional.

---

## 12. Failure Behavior

### Redis Unavailable

If Redis is unavailable, the server may query Postgres directly.

Expected behavior:

```txt
Redis error
→ log error
→ query Postgres
→ decide ads
→ return response
```

The ad decision API should not fail only because Redis is unavailable, unless Postgres is also unavailable.

### Postgres Unavailable on Redis Miss

If Redis misses and Postgres is unavailable, return null decisions for affected slots or return a controlled server error depending on product requirements.

For the MVP, prefer a controlled error during development so the problem is visible.

---

## 13. Observability

Log at least:

- requested slots
- cache hit/miss per slot
- selected campaign_id
- selected creative_id
- selected variant
- null decision reason
- token verification failure
- Redis fallback usage

Avoid logging full tracking tokens in production logs.

---

## 14. Test Checklist

Cache-related tests should verify:

- Redis key generation includes project_id and slot_id.
- Multi-slot requests use multiple slot keys.
- Redis hit path does not query Postgres.
- Redis miss path queries Postgres and writes Redis.
- Partial hit/miss returns decisions for all slots.
- Cached candidates include both A and B creatives.
- Deterministic hashing selects the same variant for the same user and campaign.
- No matching candidate returns a null decision.
- TTL is applied when writing candidate cache.
- Redis failure falls back to Postgres if possible.
