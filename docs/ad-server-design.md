# Ad Decision Server Design

## 1. Purpose

The Advertisement API returns one advertising content decision for a LoopAd demo
shopping request.

The MVP goal is:

```txt
Expose one generated ad content through the current segment experiment and
return a decision_id that later events can carry.
```

This server owns only the ad exposure decision step. It does not own event
collection, recommendation calculation, content generation, click tracking, or
analytics storage.

---

## 2. MVP Scope

### Included

The MVP includes:

- `POST /ads/decision`.
- `user_id` based segment resolution.
- Static segment matching through `user_profiles` and `segment_definitions`.
- Active experiment lookup for the resolved segment.
- Stored probability based weighted random action selection.
- Completed experiment winner-action precedence.
- Generated content lookup by `recommendation_id + action_id`.
- Default segment and default content fallback from seed data.
- Normal decision persistence to `ad_decisions`.
- `decision_id` in the API response.

### Excluded

The MVP excludes:

- `anonymous_id` based tracking.
- Multi-slot ad response contracts.
- Click tracking endpoint.
- Impression event emission from this server.
- Thompson Sampling calculation.
- Synchronous AI/recommendation/content-generation calls.
- Kafka/Kinesis/ClickHouse producers.
- Full ad-management platform behavior.
- Dashboard or analytics pipelines.

---

## 3. API Contract

### Endpoint

```http
POST /ads/decision
```

### Request

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

### Request Rules

- `project_id` is required.
- `user_id` is required.
- `slot_id`, `page_url`, `category`, and `device` are request context.
- `anonymous_id` is forbidden.
- MVP segment matching uses `user_profiles`, not request context.

### Response

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

### Response Rules

- The response always uses the nine-field MVP shape above.
- `decision_id` is the stringified `ad_decisions.id` when persistence succeeds.
- Fallback paths currently return `decision_id: ""` and skip persistence.
- Later SDK/Ingest events related to the shown ad should carry the same
  `decision_id`, `experiment_id`, `recommendation_id`, `action_id`, and
  `content_id` values when available.

---

## 4. Data Model

`database/schema.sql` is the sqldef target schema for local advertisement-server
development.

The MVP runtime tables are:

```txt
user_profiles
segment_definitions
experiments
experiment_action_probs
generated_contents
ad_decisions
```

### `user_profiles`

Source of user attributes for segment matching.

Important fields:

```txt
project_id
user_id
age_group
gender
device
favorite_category
```

### `segment_definitions`

Static segment rules.

Important fields:

```txt
id
project_id
age_group
gender
device
category
is_default
```

### `experiments`

Segment-level experiment exposure contract.

Important fields:

```txt
id
project_id
segment_id
recommendation_id
status
goal_metric
target_value
winner_action_id
started_at
ended_at
created_at
```

`goal_metric` and `target_value` are kept for the AI/experiment server's
evaluate logic even though this advertisement server does not directly use them.

### `experiment_action_probs`

Stored action selection probabilities.

Important fields:

```txt
id
experiment_id
action_id
probability
impressions
clicks
purchases
updated_at
```

The advertisement server reads `probability` and does not update these rows.

### `generated_contents`

Generated ad content lookup table.

Important fields:

```txt
id
project_id
recommendation_id
action_id
content_url
is_default
```

### `ad_decisions`

Normal decision persistence table.

Important fields:

```txt
id
project_id
user_id
segment_id
experiment_id
action_id
content_id
created_at
```

`ad_decisions.id` is returned as `decision_id`.

---

## 5. Decision Flow

The ad server decides content in this order:

```txt
user_id
  -> user_profiles
  -> segment_definitions
  -> experiments
  -> experiment_action_probs
  -> generated_contents
  -> ad_decisions
```

### Step 1. Resolve Segment

The server first checks Redis:

```txt
seg:{project_id}:{user_id}
```

If Redis hits, the cached segment id is used.

If Redis misses or fails, the server reads `user_profiles` and matches against
`segment_definitions`.

Segment matching uses static AND-equality:

```txt
segment.age_group = profile.age_group
segment.gender    = profile.gender
segment.device    = profile.device
segment.category  = profile.favorite_category
```

`NULL` segment fields are pass-through conditions. If no profile exists or no
non-default segment matches, use the default segment seed row.

### Step 2. Find Experiment

The server finds an experiment for the resolved segment:

```txt
status IN ('running', 'completed')
```

Ordering:

1. Prefer `running`.
2. If no running experiment exists, use the most recent `completed` experiment.

If no experiment exists, return default content and do not persist a decision.

### Step 3. Select Action

If the experiment is `completed` and has `winner_action_id`, use that action.

If the experiment is `completed` without `winner_action_id`, log an error,
return default content, and do not persist a decision.

If the experiment is `running`, read `experiment_action_probs`.

Rules:

- Use only positive finite probability rows.
- Normalize by the sum of stored probabilities at selection time.
- Do not write probability values.
- If probability rows are missing, select evenly among available actions for the
  same recommendation.

The advertisement server must not calculate Thompson Sampling.

### Step 4. Resolve Content

The server looks up generated content by:

```txt
project_id + recommendation_id + action_id
```

If the content row is missing or `content_url` is empty, return default banner
content and do not persist a decision.

### Step 5. Persist Decision

When segment, experiment, action, and non-default content are all resolved,
insert into `ad_decisions` and return `id::text` as `decision_id`.

If insert fails, log the error, return content normally, and set
`decision_id: ""`.

---

## 6. Fallback Policy

| Situation | Behavior |
|---|---|
| Missing user profile | Use default segment |
| No segment match | Use default segment |
| No active experiment | Return default content, skip insert |
| Running experiment has no probability rows | Select available actions evenly |
| Completed experiment has no winner | Return default content, skip insert |
| Selected content missing or URL empty | Return default content, skip insert |
| Decision insert failure | Return selected content, `decision_id: ""` |

Default segment and default content must come from seed data. They must not be
introduced as silent runtime env defaults.

Fallback persistence is intentionally skipped for now because the nullable
policy for `ad_decisions.experiment_id`, `action_id`, and `content_id` is not
finalized.

---

## 7. Cache Policy

The MVP cache stores only resolved segment ids.

```txt
seg:{project_id}:{user_id} -> segment_id
```

It does not cache:

- final decisions
- action probabilities
- generated content
- user profile rows
- SDK/Ingest events

See [ad-cache-policy.md](ad-cache-policy.md) for details.

---

## 8. Click Tracking Boundary

This server does not provide click tracking.

Rules:

- Do not expose `POST /ads/click`.
- Do not expose `POST /v1/ad-click`.
- Do not issue signed tracking tokens.
- Do not add token-signing secrets.

Ad click and impression data are collected as SDK/Ingest events, not through
this server.

---

## 9. Demo Seed Data

The seed file should include:

```txt
demo_project
user_001
seg_default
seg_30m_mobile_fresh
exp_001
rec_001
act_discount
act_free_shipping
act_bundle
content_default_banner
content_discount
content_free_shipping
content_bundle
```

Expected `user_001` flow:

```txt
demo_project + user_001
  -> seg_30m_mobile_fresh
  -> exp_001
  -> one action selected by stored probability
  -> generated content URL
  -> ad_decisions.id returned as decision_id
```

---

## 10. Test Scenarios

### Scenario 1. Normal user decision

- `project_id = demo_project`
- `user_id = user_001`
- resolved segment is `seg_30m_mobile_fresh`
- selected experiment is `exp_001`
- selected action resolves to generated content
- normal path persists `ad_decisions`
- response includes all nine MVP fields

### Scenario 2. Probability-driven action selection

- Balanced probabilities produce roughly balanced repeated selections.
- Skewed probabilities shift repeated selections toward the higher-probability
  action.
- The advertisement server never recomputes or writes probability values.

### Scenario 3. Fallback behavior

- Missing user profile uses default segment.
- Missing probability rows use equal action selection.
- Missing experiment returns default content without insert.
- Missing selected content returns default banner without insert.
- Insert failure keeps the content response and returns `decision_id: ""`.

### Scenario 4. Completed experiment

- `completed + winner_action_id` selects the winner before any random path.
- Completed winner decisions are still persisted when content exists.
- `completed` without winner returns default content and skips insert.

---

## 11. Future Extensions

After the MVP, the server may be extended with:

- fallback decision persistence with nullable linkage columns
- explicit segment cache invalidation
- cache projector integration
- richer segment rule language
- frequency capping
- multiple ad slots
- dedicated impression/click ownership if service boundaries change
- analytics/dashboard integrations outside the request path
