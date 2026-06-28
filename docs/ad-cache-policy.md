# Ad Cache Policy

## 1. Purpose

This document defines the Redis cache policy for the MVP Advertisement API.

The MVP decision flow is based on:

```txt
user_id
  -> user_profiles
  -> segment_definitions
  -> experiments
  -> experiment_action_probs
  -> generated_contents
  -> ad_decisions
```

Redis is used only to reduce repeated segment resolution work. It does not store
final ad decisions, action probabilities, generated content, or experiment
results.

---

## 2. Cache Design Principle

The ad server separates two responsibilities:

```txt
Segment resolution cache → Redis
Decision data lookup      → Postgres
Decision logic            → application memory
```

Redis stores the resolved segment id for a `project_id + user_id` pair.

The application server still reads experiments, probabilities, generated
content, and decision persistence data from Postgres.

---

## 3. Segment Cache Key

### Key Format

```txt
seg:{project_id}:{user_id}
```

### Example

```txt
seg:demo_project:user_001
```

### Rules

- Include `project_id` to avoid key collision across future projects.
- Include `user_id` because MVP identity and linkage are user-based.
- Do not use `anonymous_id`.
- Do not cache final selected ads per user.
- Do not cache action probabilities or generated content in the MVP.

---

## 4. Segment Cache Value

The value is the resolved segment id as a plain string.

Example:

```txt
seg_30m_mobile_fresh
```

### Value Rules

- Store only the segment id.
- Do not store full `user_profiles` rows.
- Do not store PII or request bodies.
- Do not store generated content URLs.
- Do not store final `decision_id`.

The cached segment id is an optimization only. Postgres seed and runtime tables
remain the source of truth.

---

## 5. Lookup Flow

### Hit Flow

```txt
Redis hit
→ use cached segment_id
→ query experiment/probability/content from Postgres
→ run decision logic
→ persist normal decision if applicable
→ response
```

### Miss Flow

```txt
Redis miss
→ query user_profiles by project_id + user_id
→ match profile against segment_definitions
→ fallback to default segment when needed
→ write segment_id to Redis with TTL
→ continue decision flow
```

### Redis Failure Flow

```txt
Redis error
→ log warning
→ resolve segment from Postgres
→ continue decision flow
```

Redis failure must not fail the API when Postgres can still resolve the segment.

---

## 6. Segment Matching Source of Truth

The cache stores only the result of this Postgres-backed matching process:

```txt
segment_definitions.age_group = user_profiles.age_group
segment_definitions.gender    = user_profiles.gender
segment_definitions.device    = user_profiles.device
segment_definitions.category  = user_profiles.favorite_category
```

Rules:

- Matching uses static AND-equality.
- `NULL` segment conditions behave as pass-through conditions.
- A non-default segment with every matching field empty is not considered a
  meaningful personalized match.
- If no user profile exists, use the default segment seed row.
- If no non-default segment matches, use the default segment seed row.

---

## 7. TTL Policy

Use a short TTL for segment cache entries.

Current MVP TTL:

```txt
60 seconds
```

Reason:

- Keeps MVP correctness simple.
- Allows local seed/profile/segment changes to become visible quickly.
- Avoids explicit invalidation or projector dependencies.

Trade-off:

- Short TTL creates more Postgres reads.
- Long TTL risks stale segment assignment.

For the MVP, choose short TTL and simple behavior.

---

## 8. Cache Invalidation

### MVP

The MVP does not implement explicit invalidation.

Segment changes become visible after TTL expiration.

### Future

Future versions may use:

```txt
explicit invalidation
write-through update
projector-based refresh
event-driven cache rebuild
```

Example invalidation key:

```txt
DEL seg:demo_project:user_001
```

---

## 9. What Redis Must Not Cache

Redis must not cache:

- final selected ad decisions
- `decision_id`
- `experiment_action_probs`
- generated content URLs
- user profile rows
- secrets, tokens, passwords, or API keys
- SDK/Ingest event payloads

Action probabilities are calculated by the AI/experiment server and stored in
Postgres. The advertisement server reads them and performs weighted random
selection only.

---

## 10. Failure Behavior

### Redis Unavailable

Expected behavior:

```txt
Redis error
→ log warning
→ resolve segment from Postgres
→ return ad decision response
```

### Postgres Unavailable

Postgres is required for experiment, probability, content, and persistence data.
If Postgres is unavailable, the API may fail with a controlled server error.

Redis alone is not enough to complete a decision in the MVP.

---

## 11. Observability

Log at least:

- Redis segment lookup failure
- Redis segment cache write failure
- completed experiment without winner
- decision insert failure

Logs must not include secrets, passwords, tokens, or DB credentials. Avoid
logging personally identifying information beyond non-secret technical ids
needed for debugging.

---

## 12. Test Checklist

Cache-related tests should verify:

- Segment cache key format is `seg:{project_id}:{user_id}`.
- Redis hit path does not query Postgres for segment resolution.
- Redis miss path queries Postgres and writes the segment id with TTL.
- Redis failure falls back to Postgres.
- Missing user profile uses the default segment.
- Segment matching uses `user_profiles`, not request context.
- Final ad decisions are not cached in Redis.
