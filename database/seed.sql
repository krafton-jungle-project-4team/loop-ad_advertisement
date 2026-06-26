INSERT INTO projects (
  id,
  name,
  domain,
  sdk_key,
  status
) VALUES (
  'loopad-demo-shop',
  'LoopAd Demo Shop',
  'localhost',
  'local-loopad-demo-shop-sdk-key',
  'active'
);

INSERT INTO campaigns (
  id,
  project_id,
  external_campaign_id,
  name,
  channel,
  goal,
  status
) VALUES
  (1, 'loopad-demo-shop', 'camp_fresh_01', '신선식품 프로모션', 'onsite_ad', 'promotion', 'active'),
  (2, 'loopad-demo-shop', 'camp_pet_01', '반려동물 용품 프로모션', 'onsite_ad', 'promotion', 'active'),
  (3, 'loopad-demo-shop', 'camp_digital_01', '디지털/가전 기획전', 'onsite_ad', 'promotion', 'active'),
  (4, 'loopad-demo-shop', 'camp_fashion_01', '패션 기획전', 'onsite_ad', 'promotion', 'active');

INSERT INTO ad_creatives (
  id,
  project_id,
  campaign_id,
  action_id,
  creative_type,
  title,
  image_url,
  landing_url,
  payload_json,
  status
) VALUES
  (1, 'loopad-demo-shop', 1, 'show_fresh_A', 'banner', '신선한 닭가슴살 30% 할인', 'https://placehold.co/800x400?text=fresh-A', '/category/fresh_food', '{"variant":"A"}'::jsonb, 'active'),
  (2, 'loopad-demo-shop', 1, 'show_fresh_B', 'banner', '오늘의 신선특가 ✨', 'https://placehold.co/800x400?text=fresh-B', '/category/fresh_food', '{"variant":"B"}'::jsonb, 'active'),
  (3, 'loopad-demo-shop', 2, 'show_pet_A', 'banner', '우리 냥이 간식 특가', 'https://placehold.co/800x400?text=pet-A', '/category/pet', '{"variant":"A"}'::jsonb, 'active'),
  (4, 'loopad-demo-shop', 2, 'show_pet_B', 'banner', '반려동물 필수템 모음', 'https://placehold.co/800x400?text=pet-B', '/category/pet', '{"variant":"B"}'::jsonb, 'active'),
  (5, 'loopad-demo-shop', 3, 'show_digital_A', 'banner', '신상 이어폰 입고', 'https://placehold.co/400x400?text=digital-A', '/category/digital', '{"variant":"A"}'::jsonb, 'active'),
  (6, 'loopad-demo-shop', 3, 'show_digital_B', 'banner', '가전 최대 50%', 'https://placehold.co/400x400?text=digital-B', '/category/digital', '{"variant":"B"}'::jsonb, 'active'),
  (7, 'loopad-demo-shop', 4, 'show_fashion_A', 'banner', '지금 많이 보는 데일리룩', 'https://placehold.co/400x400?text=fashion-A', '/category/fashion', '{"variant":"A"}'::jsonb, 'active'),
  (8, 'loopad-demo-shop', 4, 'show_fashion_B', 'banner', '오늘의 패션 특가', 'https://placehold.co/400x400?text=fashion-B', '/category/fashion', '{"variant":"B"}'::jsonb, 'active');

INSERT INTO recommendation_results (
  id,
  project_id,
  window_start,
  window_end,
  segment_json,
  segment_hash,
  status,
  recommendations_json,
  policy_decision_json
) VALUES (
  1,
  'loopad-demo-shop',
  now() - interval '1 hour',
  now(),
  '{}'::jsonb,
  'seed-main-page',
  'approved',
  '{}'::jsonb,
  '{}'::jsonb
);

INSERT INTO segment_ad_mappings (
  id,
  project_id,
  segment_json,
  segment_hash,
  recommendation_result_id,
  campaign_id,
  creative_id,
  action_id,
  action_type,
  execution_hint_json,
  status,
  source
) VALUES
  (
    1,
    'loopad-demo-shop',
    '{"category":"fresh_food","age_groups":["30s","40s"]}'::jsonb,
    'seg_fresh_food_30s_40s',
    1,
    1,
    NULL,
    'map_fresh_main_hero',
    'show_ad',
    '{"slot_id":"main_hero","priority":10,"weight":100}'::jsonb,
    'active',
    'seed'
  ),
  (
    2,
    'loopad-demo-shop',
    '{"category":"pet","age_groups":["20s","30s"]}'::jsonb,
    'seg_pet_20s_30s',
    1,
    2,
    NULL,
    'map_pet_main_hero',
    'show_ad',
    '{"slot_id":"main_hero","priority":8,"weight":100}'::jsonb,
    'active',
    'seed'
  ),
  (
    3,
    'loopad-demo-shop',
    '{"category":"digital"}'::jsonb,
    'seg_digital',
    1,
    3,
    NULL,
    'map_digital_main_side_left',
    'show_ad',
    '{"slot_id":"main_side_left","priority":5,"weight":100}'::jsonb,
    'active',
    'seed'
  ),
  (
    4,
    'loopad-demo-shop',
    '{"category":"fashion","age_groups":["20s","30s"],"gender":"female"}'::jsonb,
    'seg_fashion_20s_30s_female',
    1,
    4,
    NULL,
    'map_fashion_main_side_right',
    'show_ad',
    '{"slot_id":"main_side_right","priority":5,"weight":100}'::jsonb,
    'active',
    'seed'
  );

SELECT setval(pg_get_serial_sequence('campaigns', 'id'), (SELECT max(id) FROM campaigns));
SELECT setval(pg_get_serial_sequence('ad_creatives', 'id'), (SELECT max(id) FROM ad_creatives));
SELECT setval(pg_get_serial_sequence('recommendation_results', 'id'), (SELECT max(id) FROM recommendation_results));
SELECT setval(pg_get_serial_sequence('segment_ad_mappings', 'id'), (SELECT max(id) FROM segment_ad_mappings));
