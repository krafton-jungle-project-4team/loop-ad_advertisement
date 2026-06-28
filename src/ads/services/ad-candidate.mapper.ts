import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../logging/app-logger.service';
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

const DEFAULT_WEIGHT = 100;
const MAX_SKIP_SAMPLE_MAPPING_IDS = 3;

type SkipReason =
  | 'missing_or_invalid_slot'
  | 'missing_external_campaign_id'
  | 'missing_priority'
  | 'missing_external_creative_id'
  | 'missing_headline'
  | 'missing_image_url'
  | 'missing_target_url'
  | 'invalid_variant'
  | 'no_valid_creative';

interface SkipSummaryEntry {
  count: number;
  sample_mapping_ids: string[];
}

@Injectable()
export class AdCandidateMapper {
  constructor(private readonly logger: AppLoggerService) {}

  toCandidatesBySlot(
    rows: AdCandidateRow[],
    slots: MainPageAdSlot[],
  ): Map<MainPageAdSlot, CandidateCampaign[]> {
    const result = new Map<MainPageAdSlot, CandidateCampaign[]>();
    const candidatesByMapping = new Map<string, CandidateCampaign>();
    const mappingIdByCandidate = new Map<CandidateCampaign, string>();
    const invalidMappings = new Set<string>();
    const skipSummary = new Map<SkipReason, SkipSummaryEntry>();

    for (const slot of slots) {
      result.set(slot, []);
    }

    for (const row of rows) {
      if (invalidMappings.has(row.mapping_id)) {
        continue;
      }

      const slotId = this.slotId(row.execution_hint_json);

      if (slotId == null) {
        invalidMappings.add(row.mapping_id);
        this.recordSkip(skipSummary, 'missing_or_invalid_slot', row.mapping_id);
        continue;
      }

      let candidate = candidatesByMapping.get(row.mapping_id);

      if (!candidate) {
        const mappedCandidate = this.toCandidate(row, slotId, skipSummary);

        if (mappedCandidate == null) {
          invalidMappings.add(row.mapping_id);
          continue;
        }

        candidate = mappedCandidate;
        candidatesByMapping.set(row.mapping_id, candidate);
        mappingIdByCandidate.set(candidate, row.mapping_id);

        const candidates = result.get(slotId) ?? [];
        candidates.push(candidate);
        result.set(slotId, candidates);
      }

      const creative = this.toCreative(row, candidate.campaign_id, skipSummary);

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

    for (const [slot, candidates] of result.entries()) {
      const validCandidates = candidates.filter((candidate) => {
        if (candidate.creatives.length > 0) {
          return true;
        }

        this.recordSkip(
          skipSummary,
          'no_valid_creative',
          mappingIdByCandidate.get(candidate) ?? 'unknown',
        );

        return false;
      });

      result.set(slot, validCandidates);

      for (const candidate of validCandidates) {
        candidate.creatives.sort((left, right) =>
          left.variant.localeCompare(right.variant),
        );
      }

      validCandidates.sort((left, right) =>
        left.campaign_id.localeCompare(right.campaign_id),
      );
    }

    this.warnSkippedCandidates(skipSummary);

    return result;
  }

  private toCandidate(
    row: AdCandidateRow,
    slotId: MainPageAdSlot,
    skipSummary: Map<SkipReason, SkipSummaryEntry>,
  ): CandidateCampaign | null {
    const executionHint = this.objectValue(row.execution_hint_json);
    const campaignId = this.nonEmptyString(row.campaign_id);
    const priority = this.requiredNumber(executionHint.priority);

    if (campaignId == null) {
      this.recordSkip(
        skipSummary,
        'missing_external_campaign_id',
        row.mapping_id,
      );

      return null;
    }

    if (priority == null) {
      this.recordSkip(skipSummary, 'missing_priority', row.mapping_id);

      return null;
    }

    return {
      campaign_id: campaignId,
      name: row.campaign_name,
      priority,
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
    skipSummary?: Map<SkipReason, SkipSummaryEntry>,
  ): Creative | null {
    const creativeId = this.nonEmptyString(row.creative_id);
    const headline = this.nonEmptyString(row.creative_headline);
    const imageUrl = this.nonEmptyString(row.creative_image_url);
    const targetUrl = this.nonEmptyString(row.creative_target_url);
    const variant = this.variant(row.creative_payload_json);

    if (creativeId == null) {
      this.recordOptionalSkip(
        skipSummary,
        'missing_external_creative_id',
        row.mapping_id,
      );

      return null;
    }

    if (headline == null) {
      this.recordOptionalSkip(skipSummary, 'missing_headline', row.mapping_id);

      return null;
    }

    if (imageUrl == null) {
      this.recordOptionalSkip(skipSummary, 'missing_image_url', row.mapping_id);

      return null;
    }

    if (targetUrl == null) {
      this.recordOptionalSkip(skipSummary, 'missing_target_url', row.mapping_id);

      return null;
    }

    if (variant == null) {
      this.recordOptionalSkip(skipSummary, 'invalid_variant', row.mapping_id);

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

  private warnSkippedCandidates(
    skipSummary: Map<SkipReason, SkipSummaryEntry>,
  ): void {
    if (skipSummary.size === 0) {
      return;
    }

    this.logger.warn(AdCandidateMapper.name, 'skipped invalid ad candidate rows', {
      skipped: Object.fromEntries(skipSummary),
    });
  }

  private recordOptionalSkip(
    skipSummary: Map<SkipReason, SkipSummaryEntry> | undefined,
    reason: SkipReason,
    mappingId: string,
  ): void {
    if (skipSummary == null) {
      return;
    }

    this.recordSkip(skipSummary, reason, mappingId);
  }

  private recordSkip(
    skipSummary: Map<SkipReason, SkipSummaryEntry>,
    reason: SkipReason,
    mappingId: string,
  ): void {
    const entry = skipSummary.get(reason) ?? {
      count: 0,
      sample_mapping_ids: [],
    };

    entry.count += 1;

    if (
      entry.sample_mapping_ids.length < MAX_SKIP_SAMPLE_MAPPING_IDS &&
      !entry.sample_mapping_ids.includes(mappingId)
    ) {
      entry.sample_mapping_ids.push(mappingId);
    }

    skipSummary.set(reason, entry);
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

  private requiredNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return null;
  }

  private numberValue(value: unknown, fallback: number): number {
    return this.requiredNumber(value) ?? fallback;
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
