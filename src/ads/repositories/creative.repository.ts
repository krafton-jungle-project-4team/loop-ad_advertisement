import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL, type PgPool } from '../../database/database.constants';
import type { Creative } from '../types/ad-decision.types';

interface CreativeRow {
  creative_id: string;
  campaign_id: string;
  variant: 'A' | 'B';
  headline: string;
  image_url: string;
  target_url: string;
}

@Injectable()
export class CreativeRepository {
  constructor(@Inject(PG_POOL) private readonly pool: PgPool) {}

  async findByCampaignIds(campaignIds: string[]): Promise<Creative[]> {
    const uniqueIds = [...new Set(campaignIds)];

    if (uniqueIds.length === 0) {
      return [];
    }

    const result = await this.pool.query<CreativeRow>(
      `
      SELECT
        creative_id,
        campaign_id,
        variant,
        headline,
        image_url,
        target_url
      FROM creative
      WHERE campaign_id = ANY($1::text[])
      ORDER BY campaign_id ASC, variant ASC
      `,
      [uniqueIds],
    );

    return result.rows.map((row) => ({
      creative_id: row.creative_id,
      campaign_id: row.campaign_id,
      variant: row.variant,
      headline: row.headline,
      image_url: row.image_url,
      target_url: row.target_url,
    }));
  }
}
