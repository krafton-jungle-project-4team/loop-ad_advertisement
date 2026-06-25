CREATE TABLE campaign (
  campaign_id text PRIMARY KEY,
  name text NOT NULL,
  priority integer NOT NULL,
  status VARCHAR(20) NOT NULL,
  target_category text,
  target_age_groups text[],
  target_gender text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_campaign_status CHECK (status = ANY (ARRAY['active', 'ended', 'paused']))
);

CREATE TABLE creative (
  creative_id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES campaign (campaign_id),
  variant VARCHAR(1) NOT NULL,
  headline text NOT NULL,
  image_url text NOT NULL,
  target_url text NOT NULL,
  CONSTRAINT chk_creative_variant CHECK (variant IN ('A', 'B'))
);

CREATE TABLE placement (
  campaign_id text NOT NULL REFERENCES campaign (campaign_id),
  slot_id text NOT NULL,
  weight integer NOT NULL DEFAULT 100,
  PRIMARY KEY (campaign_id, slot_id)
);

CREATE INDEX idx_placement_slot_id ON placement (slot_id);
CREATE INDEX idx_creative_campaign_id ON creative (campaign_id);
