import { Injectable } from '@nestjs/common';
import {
  isMainPageAdSlot,
  type MainPageAdSlot,
} from '../constants/ad-slots.constant';
import type { AdCandidateRow } from '../repositories/ad-candidate.repository';
import type {
  AdVariant,
  CandidateCampaign,
  CandidateTarget,
  Creative,
} from '../types/ad-decision.types';

const DEFAULT_PRIORITY = 0;
const DEFAULT_WEIGHT = 100;

@Injectable()
export class AdCandidateMapper {
  toCandidatesBySlot(
    rows: AdCandidateRow[],
    slots: MainPageAdSlot[],
  ): Map<MainPageAdSlot, CandidateCampaign[]> {
    const result = new Map<MainPageAdSlot, CandidateCampaign[]>();
    const candidatesByMapping = new Map<string, CandidateCampaign>();

    for (const slot of slots) {
      result.set(slot, []);
    }

    for (const row of rows) {
      const slotId = this.slotId(row.execution_hint_json);

      if (slotId == null) {
        continue;
      }

      let candidate = candidatesByMapping.get(row.mapping_id);

      if (!candidate) {
        candidate = this.toCandidate(row, slotId);
        candidatesByMapping.set(row.mapping_id, candidate);

        const candidates = result.get(slotId) ?? [];
        candidates.push(candidate);
        result.set(slotId, candidates);
      }

      const creative = this.toCreative(row, candidate.campaign_id);

      if (
        creative != null &&
        !candidate.creatives.some(
          (candidateCreative) =>
            candidateCreative.creative_id === creative.creative_id,
        )
      ) {
        candidate.creatives.push(creative);
      }
    }

    for (const candidates of result.values()) {
      candidates.sort((left, right) =>
        left.campaign_id.localeCompare(right.campaign_id),
      );

      for (const candidate of candidates) {
        candidate.creatives.sort((left, right) =>
          left.variant.localeCompare(right.variant),
        );
      }
    }

    return result;
  }

  private toCandidate(
    row: AdCandidateRow,
    slotId: MainPageAdSlot,
  ): CandidateCampaign {
    const executionHint = this.objectValue(row.execution_hint_json);

    return {
      campaign_id: this.nonEmptyString(row.campaign_id) ?? row.campaign_pk,
      name: row.campaign_name,
      priority: this.numberValue(executionHint.priority, DEFAULT_PRIORITY),
      status: row.campaign_status,
      target: this.target(row.segment_json),
      placement: {
        slot_id: slotId,
        weight: this.numberValue(executionHint.weight, DEFAULT_WEIGHT),
      },
      creatives: [],
    };
  }

  private toCreative(
    row: AdCandidateRow,
    campaignId: string,
  ): Creative | null {
    const creativeId = this.nonEmptyString(row.creative_id);
    const headline = this.nonEmptyString(row.creative_headline);
    const imageUrl = this.nonEmptyString(row.creative_image_url);
    const targetUrl = this.nonEmptyString(row.creative_target_url);
    const variant = this.variant(row.creative_payload_json);

    if (
      creativeId == null ||
      headline == null ||
      imageUrl == null ||
      targetUrl == null ||
      variant == null
    ) {
      return null;
    }

    return {
      creative_id: creativeId,
      campaign_id: campaignId,
      variant,
      headline,
      image_url: imageUrl,
      target_url: targetUrl,
    };
  }

  private target(value: unknown): CandidateTarget {
    const segment = this.objectValue(value);

    return {
      category: this.nonEmptyString(segment.category),
      age_groups: this.ageGroups(segment),
      gender: this.nonEmptyString(segment.gender),
    };
  }

  private ageGroups(segment: Record<string, unknown>): string[] | null {
    if (Array.isArray(segment.age_groups)) {
      const ageGroups = segment.age_groups
        .map((ageGroup) => this.nonEmptyString(ageGroup))
        .filter((ageGroup): ageGroup is string => ageGroup != null);

      return ageGroups.length > 0 ? ageGroups : null;
    }

    const singleAgeGroup = this.nonEmptyString(segment.age_group);

    return singleAgeGroup != null ? [singleAgeGroup] : null;
  }

  private slotId(value: unknown): MainPageAdSlot | null {
    const slotId = this.nonEmptyString(this.objectValue(value).slot_id);

    return slotId != null && isMainPageAdSlot(slotId) ? slotId : null;
  }

  private variant(value: unknown): AdVariant | null {
    const variant = this.nonEmptyString(this.objectValue(value).variant);

    return variant === 'A' || variant === 'B' ? variant : null;
  }

  private numberValue(value: unknown, fallback: number): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return fallback;
  }

  private nonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
  }

  private objectValue(value: unknown): Record<string, unknown> {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }
}
