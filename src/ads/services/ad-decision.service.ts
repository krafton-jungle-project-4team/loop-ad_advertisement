import { Injectable } from '@nestjs/common';
import { AdCandidateService } from './ad-candidate.service';
import { AdEventEmitter } from './ad-event-emitter.service';
import { AdTargetingService } from './ad-targeting.service';
import { AdTokenService } from './ad-token.service';
import { AdVariantService } from './ad-variant.service';
import type {
  AdDecision,
  AdDecisionRequest,
  AdDecisionResponse,
  CandidateCampaign,
  Creative,
  NullDecision,
  TrackingTokenPayload,
} from '../types/ad-decision.types';
import type { MainPageAdSlot } from '../constants/ad-slots.constant';

@Injectable()
export class AdDecisionService {
  constructor(
    private readonly adCandidateService: AdCandidateService,
    private readonly adTargetingService: AdTargetingService,
    private readonly adVariantService: AdVariantService,
    private readonly adTokenService: AdTokenService,
    private readonly adEventEmitter: AdEventEmitter,
  ) {}

  async decide(request: AdDecisionRequest): Promise<AdDecisionResponse> {
    const candidatesBySlot =
      await this.adCandidateService.getCandidatesBySlots(
        request.project_id,
        request.slots,
      );
    const decisions: AdDecision[] = [];

    for (const slot of request.slots) {
      const candidates = candidatesBySlot.get(slot) ?? [];
      const decision = this.decideSlot(slot, candidates, request);
      decisions.push(decision);

      if (decision.campaign_id != null) {
        await this.adEventEmitter.emit({
          event_type: 'ad_impression',
          project_id: request.project_id,
          slot_id: decision.slot_id,
          campaign_id: decision.campaign_id,
          creative_id: decision.creative_id,
          variant: decision.variant,
          user_id: request.user_id,
          session_id: request.session_id,
        });
      }
    }

    return { decisions };
  }

  private decideSlot(
    slot: MainPageAdSlot,
    candidates: CandidateCampaign[],
    request: AdDecisionRequest,
  ): AdDecision {
    const campaign = this.selectCampaign(
      this.adTargetingService.filter(candidates, request.context),
    );

    if (!campaign) {
      return this.nullDecision(slot);
    }

    const variant = this.adVariantService.selectVariant(
      request.user_id,
      campaign.campaign_id,
    );
    const creative = campaign.creatives.find(
      (candidateCreative) => candidateCreative.variant === variant,
    );

    if (!creative) {
      return this.nullDecision(slot);
    }

    const tokenPayload: TrackingTokenPayload = {
      project_id: request.project_id,
      slot_id: slot,
      campaign_id: campaign.campaign_id,
      creative_id: creative.creative_id,
      variant,
      user_id: request.user_id,
      session_id: request.session_id,
      issued_at: Math.floor(Date.now() / 1000),
    };

    return {
      slot_id: slot,
      creative_id: creative.creative_id,
      campaign_id: campaign.campaign_id,
      variant,
      creative: this.responseCreative(creative),
      tracking_token: this.adTokenService.sign(tokenPayload),
    };
  }

  private selectCampaign(
    candidates: CandidateCampaign[],
  ): CandidateCampaign | null {
    return [...candidates].sort((left, right) => {
      if (left.priority !== right.priority) {
        return right.priority - left.priority;
      }

      return left.campaign_id.localeCompare(right.campaign_id);
    })[0] ?? null;
  }

  private responseCreative(creative: Creative) {
    return {
      image_url: creative.image_url,
      target_url: creative.target_url,
      headline: creative.headline,
    };
  }

  private nullDecision(slot: MainPageAdSlot): NullDecision {
    return {
      slot_id: slot,
      creative_id: null,
      campaign_id: null,
      variant: null,
      creative: null,
      tracking_token: null,
    };
  }
}
