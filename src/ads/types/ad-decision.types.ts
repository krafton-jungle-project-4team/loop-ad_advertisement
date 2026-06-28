import type { MainPageAdSlot } from '../constants/ad-slots.constant';

export interface AdDecisionRequest {
  project_id: string;
  user_id: string;
  slot_id?: string;
  page_url?: string;
  category?: string | null;
  device?: string | null;
}

export interface AdDecisionResponse {
  decision_id: string;
  project_id: string;
  user_id: string;
  segment_id: string;
  experiment_id: string;
  recommendation_id: string;
  action_id: string;
  content_id: string;
  content_url: string;
}

export interface UserProfile {
  projectId: string;
  userId: string;
  ageGroup: string | null;
  gender: string | null;
  device: string | null;
  favoriteCategory: string | null;
}

export interface SegmentDefinition {
  id: string;
  projectId: string;
  ageGroup: string | null;
  gender: string | null;
  device: string | null;
  category: string | null;
  isDefault: boolean;
}

export type ExperimentStatus = 'running' | 'completed';

export interface Experiment {
  id: string;
  projectId: string;
  segmentId: string;
  recommendationId: string;
  status: ExperimentStatus;
  goalMetric: string;
  targetValue: number;
  winnerActionId: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
}

export interface ActionProbability {
  actionId: string;
  probability: number;
}

export interface GeneratedContent {
  contentId: string;
  projectId: string;
  recommendationId: string | null;
  actionId: string | null;
  contentUrl: string | null;
  isDefault: boolean;
}

export interface SelectedAction {
  actionId: string;
}

export interface ResolvedContent {
  content: GeneratedContent;
  isDefaultFallback: boolean;
}

// Legacy candidate-slot types are kept while the old candidate files remain in
// the repository. They are no longer wired into the MVP decision endpoint.
export type AdVariant = 'A' | 'B';

export interface Creative {
  creative_id: string;
  campaign_id: string;
  variant: AdVariant;
  headline: string;
  image_url: string;
  target_url: string;
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
}

export interface NullDecision {
  slot_id: MainPageAdSlot;
  creative_id: null;
  campaign_id: null;
  variant: null;
  creative: null;
}

export interface AdEvent {
  event_type: 'ad_impression';
  project_id: string;
  slot_id: MainPageAdSlot;
  campaign_id: string;
  creative_id: string;
  variant: AdVariant;
  user_id: string;
  session_id: string;
}
