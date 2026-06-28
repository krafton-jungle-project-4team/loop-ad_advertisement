# MVP Ad Decision Endpoint 구현 설명

## 구현 범위

`POST /ads/decision` 단일 광고 결정 API를 MVP 계약에 맞춰 구현했다.

현재 API 진입점은 `src/ads/controllers/ad-decision.controller.ts`의
`@Post('/ads/decision')`이다. 컨트롤러는 요청 검증만 담당하고, 실제 결정 흐름은
`AdDecisionService.decide()`가 오케스트레이션한다.

기존 `/v1/ad-decision` 다중 슬롯/캠페인 방식은 새 `AdsModule` wiring에서 빠졌고,
현재 MVP 결정 경로는 segment, experiment, action probability, generated content,
ad decision persistence 순서로 동작한다.

## API 입력/검증

요청 DTO는 `src/ads/dto/ad-decision-request.dto.ts`에 있다.

허용 필드는 다음과 같다.

```txt
project_id
user_id
slot_id
page_url
category
device
```

`project_id`, `user_id`는 필수다. `slot_id`, `page_url`, `category`, `device`는
요청 컨텍스트로 받지만, MVP segment matching은 요청 context가 아니라
`user_profiles`의 저장된 사용자 속성을 기준으로 한다.

DTO는 `zod.strict()`를 사용하므로 `anonymous_id` 같은 명세 외 필드가 들어오면
컨트롤러가 `400 Bad Request`를 반환한다.

응답은 항상 다음 9개 필드를 반환한다.

```txt
decision_id
project_id
user_id
segment_id
experiment_id
recommendation_id
action_id
content_id
content_url
```

## 메인 결정 흐름

전체 흐름은 `src/ads/services/ad-decision.service.ts`에 있다.

처리 순서는 다음과 같다.

1. `project_id + user_id`로 segment를 resolve한다.
2. segment 기준으로 `running` 또는 `completed` experiment를 조회한다.
3. experiment가 없으면 default banner를 반환하고 `ad_decisions`에는 저장하지 않는다.
4. experiment 상태에 맞춰 action을 선택한다.
5. action 선택에 실패하면 default banner를 반환하고 저장하지 않는다.
6. `recommendation_id + action_id`로 generated content를 조회한다.
7. content가 없거나 `content_url`이 비어 있으면 default banner를 반환하고 저장하지 않는다.
8. 정상 experiment, action, content가 모두 있으면 `ad_decisions`에 저장하고 생성된 id를 `decision_id`로 반환한다.

fallback 응답에서는 `decision_id`를 빈 문자열로 내려준다.

## Segment Resolve

Segment resolve는 `src/ads/services/ad-segment.service.ts`가 담당한다.

Redis key는 다음 형식이다.

```txt
seg:{project_id}:{user_id}
```

동작 방식은 다음과 같다.

- Redis HIT이면 cached segment id를 바로 사용한다.
- Redis MISS 또는 Redis 장애가 발생하면 Postgres로 fallback한다.
- `user_profiles`에서 `project_id + user_id`로 profile을 조회한다.
- profile이 없으면 `segment_definitions.is_default = true`인 default segment를 사용한다.
- profile이 있으면 `segment_definitions`의 non-default segment와 AND-equality matching을 수행한다.
- 매칭 결과가 없으면 default segment를 사용한다.
- Postgres에서 resolve한 segment id는 Redis에 TTL 60초로 backfill한다.

매칭 필드는 다음과 같다.

```txt
segment_definitions.age_group = user_profiles.age_group
segment_definitions.gender = user_profiles.gender
segment_definitions.device = user_profiles.device
segment_definitions.category = user_profiles.favorite_category
```

segment definition의 특정 조건이 `NULL`이면 그 조건은 wildcard처럼 통과한다.
단, 조건이 전부 비어 있는 non-default segment는 매칭 대상으로 보지 않는다.

## Experiment 조회

Experiment 조회 wrapper는 `src/ads/services/ad-experiment.service.ts`,
실제 SQL은 `src/ads/repositories/experiment.repository.ts`에 있다.

조회 조건은 다음과 같다.

```sql
WHERE project_id = $1
  AND segment_id = $2
  AND status IN ('running', 'completed')
```

정렬 정책은 다음과 같다.

1. `running` 우선
2. running이 없으면 최신 `completed`
3. 최신 기준은 `COALESCE(started_at, created_at) DESC`, `created_at DESC`

`experiments.goal_metric`, `experiments.target_value`는 광고 서버의 결정 로직에서
직접 사용하지 않지만, AI 서버 evaluate 로직과 팀 공용 DDL을 위해 유지한다.

## Action 선택

Action 선택은 `src/ads/services/ad-action-selector.service.ts`가 담당한다.

상태별 정책은 다음과 같다.

- `completed`이고 `winner_action_id`가 있으면 winner action을 바로 선택한다.
- `completed`인데 winner가 없으면 error log를 남기고 `null`을 반환한다.
- `running`이면 `experiment_action_probs`를 읽어 weighted random을 수행한다.

probability row 처리 방식은 다음과 같다.

- `probability > 0`이고 finite한 row만 유효 row로 본다.
- 유효 row가 있으면 row들의 합계를 기준으로 정규화된 weighted random을 수행한다.
- DB의 probability 값을 수정하거나 재계산하지 않는다.
- 유효 row가 없으면 같은 `recommendation_id`의 generated content action들을 읽고 equal weight로 선택한다.

즉, 광고 서버는 Thompson Sampling을 계산하지 않는다. AI/experiment 서버가 저장한
확률을 읽고 선택만 수행한다.

## Content 조회와 fallback

Content 조회는 `src/ads/services/ad-content.service.ts`가 담당한다.

정상 content 조회 조건은 다음과 같다.

```txt
project_id + recommendation_id + action_id
```

`generated_contents` row가 없거나 `content_url`이 비어 있으면 default banner를 조회한다.
default banner는 `generated_contents.is_default = true`인 seed row에서만 가져온다.

이 fallback 경로에서는 `ad_decisions`에 저장하지 않는다. 이유는 현재
`ad_decisions.experiment_id`, `action_id`, `content_id`의 nullable 여부를 스키마 담당과
확정하기 전까지 fallback decision을 null linkage로 저장하지 않기로 했기 때문이다.

## Persistence

정상 선택 경로에서만 `src/ads/repositories/ad-decision.repository.ts`가 insert한다.

저장 컬럼은 다음과 같다.

```txt
project_id
user_id
segment_id
experiment_id
action_id
content_id
created_at
```

insert 후 `RETURNING id::text`로 받은 값을 `decision_id`로 반환한다.

insert 실패 시에는 에러 로그를 남기고, 광고 content 응답은 유지한다. 이때
`decision_id`는 빈 문자열이다. 데모 안정성을 위해 persistence 실패가 광고 응답 전체를
실패시키지는 않는다.

## Schema/Seed

DDL은 `database/schema.sql`에 있다.

MVP runtime table은 다음 6개다.

```txt
user_profiles
segment_definitions
experiments
experiment_action_probs
generated_contents
ad_decisions
```

팀 합의에 따라 `experiments`에는 다음 컬럼을 유지한다.

```txt
id, project_id, segment_id, recommendation_id, status,
goal_metric, target_value, winner_action_id,
started_at, ended_at, created_at
```

팀 합의에 따라 `experiment_action_probs`에는 다음 컬럼을 유지한다.

```txt
id, experiment_id, action_id, probability,
impressions, clicks, purchases, updated_at
```

Seed는 `database/seed.sql`에 있으며 다음 데이터를 포함한다.

```txt
demo_project
user_001
seg_default
seg_30m_mobile_fresh
exp_001
rec_001
act_discount / act_free_shipping / act_bundle probabilities
content_default_banner
action별 generated content
```

## 테스트와 검증 결과

외부 Postgres/Redis 없이 mock 기반으로 MVP 로직을 검증했다.

주요 테스트 파일은 다음과 같다.

```txt
src/ads/services/ad-decision.service.spec.ts
src/ads/services/ad-action-selector.service.spec.ts
src/ads/services/ad-segment.service.spec.ts
src/ads/controllers/ad-api.integration.spec.ts
```

검증 내용은 다음과 같다.

- `demo_project/user_001` 정상 decision 응답 9개 필드
- 정상 선택 경로에서만 `ad_decisions` insert
- no experiment fallback은 default banner + `decision_id = ""`
- missing content fallback은 default banner + insert skip
- insert 실패 시 content 응답 유지 + `decision_id = ""`
- Redis segment hit/miss/failure
- profile 없음 시 default segment
- weighted random selection
- probability row 없음 시 equal weight
- completed winner 우선
- `anonymous_id` 요청 거부
- click tracking endpoint 미등록

확인한 명령은 다음과 같다.

```bash
npm run lint
npm run test
npm run build
```

세 명령 모두 통과했다.
