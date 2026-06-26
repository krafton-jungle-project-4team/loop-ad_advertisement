import { Injectable, Logger } from '@nestjs/common';
import { AdCacheService } from '../../redis/ad-cache.service';
import type { MainPageAdSlot } from '../constants/ad-slots.constant';
import { AdCandidateRepository } from '../repositories/ad-candidate.repository';
import { AdCandidateMapper } from './ad-candidate.mapper';
import type { CandidateCampaign } from '../types/ad-decision.types';

@Injectable()
export class AdCandidateService {
  private readonly logger = new Logger(AdCandidateService.name);

  constructor(
    private readonly adCacheService: AdCacheService,
    private readonly adCandidateRepository: AdCandidateRepository,
    private readonly adCandidateMapper: AdCandidateMapper,
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

      const loaded = await this.loadCandidatesFromPostgres(
        projectId,
        missingSlots,
      );

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

      return this.loadCandidatesFromPostgres(projectId, slots);
    }
  }

  async loadCandidatesFromPostgres(
    projectId: string,
    slots: MainPageAdSlot[],
  ): Promise<Map<MainPageAdSlot, CandidateCampaign[]>> {
    const rows =
      await this.adCandidateRepository.findActiveRowsByProjectAndSlots(
        projectId,
        slots,
      );
    const result = this.adCandidateMapper.toCandidatesBySlot(rows, slots);

    for (const candidates of result.values()) {
      candidates.sort((left, right) =>
        left.campaign_id.localeCompare(right.campaign_id),
      );
    }

    return result;
  }
}
