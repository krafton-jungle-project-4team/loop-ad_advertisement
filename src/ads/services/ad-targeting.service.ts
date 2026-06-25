import { Injectable } from '@nestjs/common';
import type {
  CandidateCampaign,
  DecisionContext,
} from '../types/ad-decision.types';

@Injectable()
export class AdTargetingService {
  matches(candidate: CandidateCampaign, context: DecisionContext): boolean {
    const target = candidate.target;
    const hasAnyTarget =
      target.category != null ||
      (target.age_groups != null && target.age_groups.length > 0) ||
      target.gender != null;

    if (!hasAnyTarget) {
      return false;
    }

    if (target.category != null && context.category !== target.category) {
      return false;
    }

    if (
      target.age_groups != null &&
      target.age_groups.length > 0 &&
      (context.age_group == null || !target.age_groups.includes(context.age_group))
    ) {
      return false;
    }

    if (target.gender != null && context.gender !== target.gender) {
      return false;
    }

    return true;
  }

  filter(
    candidates: CandidateCampaign[],
    context: DecisionContext,
  ): CandidateCampaign[] {
    return candidates.filter((candidate) => this.matches(candidate, context));
  }
}
