CREATE TABLE user_profiles (
  project_id VARCHAR(128) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  age_group VARCHAR(64),
  gender VARCHAR(64),
  device VARCHAR(64),
  favorite_category VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX idx_user_profiles_project_user ON user_profiles (project_id, user_id);

CREATE TABLE segment_definitions (
  id VARCHAR(128) PRIMARY KEY,
  project_id VARCHAR(128) NOT NULL,
  age_group VARCHAR(64),
  gender VARCHAR(64),
  device VARCHAR(64),
  category VARCHAR(128),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_segment_definitions_project ON segment_definitions (project_id);
CREATE UNIQUE INDEX uq_segment_definitions_project_default
  ON segment_definitions (project_id)
  WHERE is_default;

CREATE TABLE experiments (
  id VARCHAR(128) PRIMARY KEY,
  project_id VARCHAR(128) NOT NULL,
  segment_id VARCHAR(128) NOT NULL,
  recommendation_id VARCHAR(128) NOT NULL,
  status VARCHAR(64) NOT NULL,
  goal_metric VARCHAR(128) NOT NULL,
  target_value NUMERIC(12, 6) NOT NULL,
  winner_action_id VARCHAR(128),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_experiments_project_segment_status
  ON experiments (project_id, segment_id, status);

CREATE TABLE experiment_action_probs (
  id BIGSERIAL PRIMARY KEY,
  experiment_id VARCHAR(128) NOT NULL REFERENCES experiments (id) ON DELETE CASCADE,
  action_id VARCHAR(128) NOT NULL,
  probability NUMERIC(12, 8) NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  purchases INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, action_id)
);

CREATE INDEX idx_experiment_action_probs_experiment
  ON experiment_action_probs (experiment_id);

CREATE TABLE generated_contents (
  id VARCHAR(128) PRIMARY KEY,
  project_id VARCHAR(128) NOT NULL,
  recommendation_id VARCHAR(128),
  action_id VARCHAR(128),
  content_url TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_generated_contents_project_recommendation_action
  ON generated_contents (project_id, recommendation_id, action_id);
CREATE UNIQUE INDEX uq_generated_contents_project_default
  ON generated_contents (project_id)
  WHERE is_default;

CREATE TABLE ad_decisions (
  id BIGSERIAL PRIMARY KEY,
  project_id VARCHAR(128) NOT NULL,
  user_id VARCHAR(128) NOT NULL,
  segment_id VARCHAR(128) NOT NULL,
  experiment_id VARCHAR(128) NOT NULL,
  action_id VARCHAR(128) NOT NULL,
  content_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_decisions_project_user_created
  ON ad_decisions (project_id, user_id, created_at DESC);
CREATE INDEX idx_ad_decisions_experiment_action
  ON ad_decisions (experiment_id, action_id);
