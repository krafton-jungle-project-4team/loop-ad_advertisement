import type { MainPageAdSlot } from '../constants/ad-slots.constant';

export type AdVariant = 'A' | 'B';

export interface Creative {
  creative_id: string;
  campaign_id: string;
  variant: AdVariant;
  headline: string;
  image_url: string;
  target_url: string;
}

export interface Placement {
  campaign_id: string;
  slot_id: MainPageAdSlot;
  weight: number;
}

export interface CandidateTarget {
  category: string | null;
  age_groups: string[] | null;
  gender: string | null;
}

export interface CandidateCampaign {
  campaign_id: string;
  name: string;
  priority: number;
  status: string;
  target: CandidateTarget;
  placement: {
    slot_id: MainPageAdSlot;
    weight: number;
  };
  creatives: Creative[];
}

export interface DecisionContext {
  page_url?: string;
  device?: string;
  category?: string | null;
  age_group?: string | null;
  gender?: string | null;
}

export interface AdDecisionRequest {
  project_id: string;
  user_id: string;
  session_id: string;
  slots: MainPageAdSlot[];
  context: DecisionContext;
}

export interface NonNullDecision {
  slot_id: MainPageAdSlot;
  creative_id: string;
  campaign_id: string;
  variant: AdVariant;
  creative: {
    image_url: string;
    target_url: string;
    headline: string;
  };
  tracking_token: string;
}

export interface NullDecision {
  slot_id: MainPageAdSlot;
  creative_id: null;
  campaign_id: null;
  variant: null;
  creative: null;
  tracking_token: null;
}

export type AdDecision = NonNullDecision | NullDecision;

export interface AdDecisionResponse {
  decisions: AdDecision[];
}

export interface TrackingTokenPayload {
  project_id: string;
  slot_id: MainPageAdSlot;
  campaign_id: string;
  creative_id: string;
  variant: AdVariant;
  user_id: string;
  session_id: string;
  issued_at: number;
}

export interface AdEvent {
  event_type: 'ad_impression' | 'ad_click';
  project_id: string;
  slot_id: MainPageAdSlot;
  campaign_id: string;
  creative_id: string;
  variant: AdVariant;
  user_id: string;
  session_id: string;
}
