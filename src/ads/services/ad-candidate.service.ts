import { Injectable, Logger } from '@nestjs/common';
import { AdCacheService } from '../../redis/ad-cache.service';
import type { MainPageAdSlot } from '../constants/ad-slots.constant';
import { CampaignRepository } from '../repositories/campaign.repository';
import { CreativeRepository } from '../repositories/creative.repository';
import { PlacementRepository } from '../repositories/placement.repository';
import type {
  CandidateCampaign,
  Creative,
} from '../types/ad-decision.types';

@Injectable()
export class AdCandidateService {
  private readonly logger = new Logger(AdCandidateService.name);

  constructor(
    private readonly adCacheService: AdCacheService,
    private readonly placementRepository: PlacementRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly creativeRepository: CreativeRepository,
  ) {}

  async getCandidatesBySlots(
    projectId: string,
    slots: MainPageAdSlot[],
  ): Promise<Map<MainPageAdSlot, CandidateCampaign[]>> {
    try {
      const cached = await this.adCacheService.getCandidates(projectId, slots);
      const missingSlots = slots.filter((slot) => !cached.has(slot));

      if (missingSlots.length === 0) {
        return cached;
      }

      const loaded = await this.loadCandidatesFromPostgres(missingSlots);

      await Promise.all(
        missingSlots.map(async (slot) => {
          const candidates = loaded.get(slot) ?? [];
          cached.set(slot, candidates);

          try {
            await this.adCacheService.setCandidates(projectId, slot, candidates);
          } catch (error) {
            this.logger.warn(
              `Redis cache write failed for ${slot}: ${(error as Error).message}`,
            );
          }
        }),
      );

      return cached;
    } catch (error) {
      this.logger.warn(
        `Redis candidate lookup failed, falling back to Postgres: ${
          (error as Error).message
        }`,
      );

      return this.loadCandidatesFromPostgres(slots);
    }
  }

  async loadCandidatesFromPostgres(
    slots: MainPageAdSlot[],
  ): Promise<Map<MainPageAdSlot, CandidateCampaign[]>> {
    const placements = await this.placementRepository.findBySlots(slots);
    const campaignIds = placements.map((placement) => placement.campaign_id);
    const [campaigns, creatives] = await Promise.all([
      this.campaignRepository.findActiveByIds(campaignIds),
      this.creativeRepository.findByCampaignIds(campaignIds),
    ]);
    const campaignById = new Map(
      campaigns.map((campaign) => [campaign.campaign_id, campaign]),
    );
    const creativesByCampaign = this.groupCreativesByCampaign(creatives);
    const result = new Map<MainPageAdSlot, CandidateCampaign[]>();

    for (const slot of slots) {
      result.set(slot, []);
    }

    for (const placement of placements) {
      const campaign = campaignById.get(placement.campaign_id);

      if (!campaign) {
        continue;
      }

      const candidates = result.get(placement.slot_id) ?? [];
      candidates.push({
        ...campaign,
        placement: {
          slot_id: placement.slot_id,
          weight: placement.weight,
        },
        creatives: creativesByCampaign.get(campaign.campaign_id) ?? [],
      });
      result.set(placement.slot_id, candidates);
    }

    for (const candidates of result.values()) {
      candidates.sort((left, right) =>
        left.campaign_id.localeCompare(right.campaign_id),
      );
    }

    return result;
  }

  private groupCreativesByCampaign(
    creatives: Creative[],
  ): Map<string, Creative[]> {
    const grouped = new Map<string, Creative[]>();

    for (const creative of creatives) {
      const bucket = grouped.get(creative.campaign_id) ?? [];
      bucket.push(creative);
      grouped.set(creative.campaign_id, bucket);
    }

    for (const bucket of grouped.values()) {
      bucket.sort((left, right) => left.variant.localeCompare(right.variant));
    }

    return grouped;
  }
}
