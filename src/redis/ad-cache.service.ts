import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import type {
  CandidateCampaign,
} from '../ads/types/ad-decision.types';
import type { MainPageAdSlot } from '../ads/constants/ad-slots.constant';

const CANDIDATE_CACHE_TTL_SECONDS = 60;

@Injectable()
export class AdCacheService {
  constructor(private readonly redisService: RedisService) {}

  cacheKey(projectId: string, slotId: MainPageAdSlot): string {
    return `tenant:${projectId}:slot:${slotId}:candidates`;
  }

  async getCandidates(
    projectId: string,
    slots: MainPageAdSlot[],
  ): Promise<Map<MainPageAdSlot, CandidateCampaign[]>> {
    if (slots.length === 0) {
      return new Map();
    }

    const keys = slots.map((slot) => this.cacheKey(projectId, slot));
    const values = await this.redisService.mGet(keys);
    const result = new Map<MainPageAdSlot, CandidateCampaign[]>();

    values.forEach((value, index) => {
      if (value == null) {
        return;
      }

      result.set(slots[index], JSON.parse(value) as CandidateCampaign[]);
    });

    return result;
  }

  async setCandidates(
    projectId: string,
    slot: MainPageAdSlot,
    candidates: CandidateCampaign[],
  ): Promise<void> {
    await this.redisService.setEx(
      this.cacheKey(projectId, slot),
      CANDIDATE_CACHE_TTL_SECONDS,
      JSON.stringify(candidates),
    );
  }

  ttlSeconds(): number {
    return CANDIDATE_CACHE_TTL_SECONDS;
  }
}
