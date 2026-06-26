CREATE TABLE projects (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  sdk_key VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE campaigns (
  id BIGSERIAL PRIMARY KEY,
  project_id VARCHAR(128) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  external_campaign_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  channel VARCHAR(64),
  goal VARCHAR(64),
  budget NUMERIC(18, 2),
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, external_campaign_id)
);

CREATE INDEX idx_campaigns_project_status ON campaigns (project_id, status);
CREATE INDEX idx_campaigns_project_channel ON campaigns (project_id, channel);

CREATE TABLE coupons (
  id BIGSERIAL PRIMARY KEY,
  project_id VARCHAR(128) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  code VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  discount_type VARCHAR(64) NOT NULL,
  discount_rate NUMERIC(5, 4),
  discount_amount NUMERIC(18, 2),
  max_discount_amount NUMERIC(18, 2),
  budget NUMERIC(18, 2),
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, code)
);

CREATE INDEX idx_coupons_project_status ON coupons (project_id, status);

CREATE TABLE ad_creatives (
  id BIGSERIAL PRIMARY KEY,
  project_id VARCHAR(128) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  campaign_id BIGINT REFERENCES campaigns (id) ON DELETE SET NULL,
  coupon_id BIGINT REFERENCES coupons (id) ON DELETE SET NULL,
  action_id VARCHAR(128),
  creative_type VARCHAR(64) NOT NULL DEFAULT 'banner',
  title VARCHAR(255),
  message TEXT,
  image_url TEXT,
  landing_url TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_creatives_project_status ON ad_creatives (project_id, status);
CREATE INDEX idx_ad_creatives_project_action_status ON ad_creatives (project_id, action_id, status);
CREATE INDEX idx_ad_creatives_campaign ON ad_creatives (campaign_id);

CREATE TABLE recommendation_results (
  id BIGSERIAL PRIMARY KEY,
  project_id VARCHAR(128) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  baseline_start TIMESTAMPTZ,
  baseline_end TIMESTAMPTZ,
  segment_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  segment_hash VARCHAR(64) NOT NULL,
  status VARCHAR(64) NOT NULL,
  anomaly_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  root_causes_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendations_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy_decision_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_by VARCHAR(255),
  decision_at TIMESTAMPTZ,
  decision_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recommendation_results_project_status ON recommendation_results (project_id, status);
CREATE INDEX idx_recommendation_results_project_created ON recommendation_results (project_id, created_at DESC);
CREATE INDEX idx_recommendation_results_segment_hash ON recommendation_results (segment_hash);
CREATE INDEX gin_recommendation_results_segment_json ON recommendation_results USING GIN (segment_json);

CREATE TABLE experiments (
  id BIGSERIAL PRIMARY KEY,
  project_id VARCHAR(128) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  recommendation_result_id BIGINT NOT NULL REFERENCES recommendation_results (id) ON DELETE CASCADE,
  segment_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  segment_hash VARCHAR(64) NOT NULL,
  action_id VARCHAR(128) NOT NULL,
  action_type VARCHAR(64) NOT NULL,
  status VARCHAR(64) NOT NULL,
  traffic_split_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  primary_metric VARCHAR(128),
  guardrail_metrics_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_experiments_recommendation_action UNIQUE (recommendation_result_id, action_id)
);

CREATE INDEX idx_experiments_project_status ON experiments (project_id, status);
CREATE INDEX idx_experiments_recommendation ON experiments (recommendation_result_id);
CREATE INDEX idx_experiments_segment_hash ON experiments (segment_hash);

CREATE TABLE segment_ad_mappings (
  id BIGSERIAL PRIMARY KEY,
  project_id VARCHAR(128) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  segment_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  segment_hash VARCHAR(64) NOT NULL,
  recommendation_result_id BIGINT NOT NULL REFERENCES recommendation_results (id) ON DELETE CASCADE,
  experiment_id BIGINT REFERENCES experiments (id) ON DELETE SET NULL,
  campaign_id BIGINT REFERENCES campaigns (id) ON DELETE SET NULL,
  creative_id BIGINT REFERENCES ad_creatives (id) ON DELETE SET NULL,
  coupon_id BIGINT REFERENCES coupons (id) ON DELETE SET NULL,
  action_id VARCHAR(128) NOT NULL,
  action_type VARCHAR(64) NOT NULL,
  execution_hint_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(64) NOT NULL,
  source VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_segment_ad_mappings_recommendation_action UNIQUE (recommendation_result_id, action_id)
);

CREATE INDEX idx_segment_ad_mappings_project_status ON segment_ad_mappings (project_id, status);
CREATE INDEX idx_segment_ad_mappings_project_segment_status ON segment_ad_mappings (project_id, segment_hash, status);
CREATE INDEX idx_segment_ad_mappings_recommendation ON segment_ad_mappings (recommendation_result_id);
CREATE INDEX idx_segment_ad_mappings_experiment ON segment_ad_mappings (experiment_id);
CREATE INDEX gin_segment_ad_mappings_segment_json ON segment_ad_mappings USING GIN (segment_json);
