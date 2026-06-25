import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL, type PgPool } from '../../database/database.constants';
import type { CandidateTarget } from '../types/ad-decision.types';

export interface CampaignRecord {
  campaign_id: string;
  name: string;
  priority: number;
  status: string;
  target: CandidateTarget;
}

interface CampaignRow {
  campaign_id: string;
  name: string;
  priority: number;
  status: string;
  target_category: string | null;
  target_age_groups: string[] | null;
  target_gender: string | null;
}

@Injectable()
export class CampaignRepository {
  constructor(@Inject(PG_POOL) private readonly pool: PgPool) {}

  async findActiveByIds(campaignIds: string[]): Promise<CampaignRecord[]> {
    const uniqueIds = [...new Set(campaignIds)];

    if (uniqueIds.length === 0) {
      return [];
    }

    const result = await this.pool.query<CampaignRow>(
      `
      SELECT
        campaign_id,
        name,
        priority,
        status,
        target_category,
        target_age_groups,
        target_gender
      FROM campaign
      WHERE campaign_id = ANY($1::text[])
        AND status = 'active'
        AND (starts_at IS NULL OR starts_at <= now())
        AND (ends_at IS NULL OR ends_at >= now())
      ORDER BY campaign_id ASC
      `,
      [uniqueIds],
    );

    return result.rows.map((row) => ({
      campaign_id: row.campaign_id,
      name: row.name,
      priority: Number(row.priority),
      status: row.status,
      target: {
        category: row.target_category,
        age_groups: row.target_age_groups,
        gender: row.target_gender,
      },
    }));
  }
}
