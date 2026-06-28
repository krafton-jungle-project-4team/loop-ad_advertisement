INSERT INTO user_profiles (
  project_id,
  user_id,
  age_group,
  gender,
  device,
  favorite_category
) VALUES (
  'demo_project',
  'user_001',
  '30s',
  'male',
  'mobile',
  'fresh_food'
);

INSERT INTO segment_definitions (
  id,
  project_id,
  age_group,
  gender,
  device,
  category,
  is_default
) VALUES
  (
    'seg_default',
    'demo_project',
    NULL,
    NULL,
    NULL,
    NULL,
    true
  ),
  (
    'seg_30m_mobile_fresh',
    'demo_project',
    '30s',
    'male',
    'mobile',
    'fresh_food',
    false
  );

INSERT INTO experiments (
  id,
  project_id,
  segment_id,
  recommendation_id,
  status,
  goal_metric,
  target_value,
  winner_action_id,
  started_at,
  ended_at
) VALUES (
  'exp_001',
  'demo_project',
  'seg_30m_mobile_fresh',
  'rec_001',
  'running',
  'purchase_rate',
  0.050000,
  NULL,
  now() - interval '1 hour',
  NULL
);

INSERT INTO experiment_action_probs (
  experiment_id,
  action_id,
  probability,
  impressions,
  clicks,
  purchases
) VALUES
  ('exp_001', 'act_discount', 0.33330000, 0, 0, 0),
  ('exp_001', 'act_free_shipping', 0.33330000, 0, 0, 0),
  ('exp_001', 'act_bundle', 0.33340000, 0, 0, 0);

INSERT INTO generated_contents (
  id,
  project_id,
  recommendation_id,
  action_id,
  content_url,
  is_default
) VALUES
  (
    'content_default_banner',
    'demo_project',
    NULL,
    NULL,
    'https://s3.ap-northeast-2.amazonaws.com/loop-ad-demo/default_banner.png',
    true
  ),
  (
    'content_discount',
    'demo_project',
    'rec_001',
    'act_discount',
    'https://s3.ap-northeast-2.amazonaws.com/loop-ad-demo/content_discount.png',
    false
  ),
  (
    'content_free_shipping',
    'demo_project',
    'rec_001',
    'act_free_shipping',
    'https://s3.ap-northeast-2.amazonaws.com/loop-ad-demo/content_free_shipping.png',
    false
  ),
  (
    'content_bundle',
    'demo_project',
    'rec_001',
    'act_bundle',
    'https://s3.ap-northeast-2.amazonaws.com/loop-ad-demo/content_bundle.png',
    false
  );
