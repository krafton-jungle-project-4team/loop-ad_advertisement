import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL, type PgPool } from '../../database/database.constants';
import type { MainPageAdSlot } from '../constants/ad-slots.constant';

export interface AdCandidateRow {
  mapping_id: string;
  segment_json: unknown;
  execution_hint_json: unknown;
  campaign_pk: string;
  campaign_id: string;
  campaign_name: string;
  campaign_status: string;
  creative_id: string | null;
  creative_payload_json: unknown;
  creative_headline: string | null;
  creative_image_url: string | null;
  creative_target_url: string | null;
}

@Injectable()
export class AdCandidateRepository {
  constructor(@Inject(PG_POOL) private readonly pool: PgPool) {}

  async findActiveRowsByProjectAndSlots(
    projectId: string,
    slots: MainPageAdSlot[],
  ): Promise<AdCandidateRow[]> {
    const uniqueSlots = [...new Set(slots)];

    if (uniqueSlots.length === 0) {
      return [];
    }

    const result = await this.pool.query<AdCandidateRow>(
      `
      SELECT
        mapping.id::text AS mapping_id,
        mapping.segment_json,
        mapping.execution_hint_json,
        campaign.id::text AS campaign_pk,
        COALESCE(campaign.external_campaign_id, campaign.id::text) AS campaign_id,
        campaign.name AS campaign_name,
        campaign.status AS campaign_status,
        creative.id::text AS creative_id,
        creative.payload_json AS creative_payload_json,
        creative.title AS creative_headline,
        creative.image_url AS creative_image_url,
        creative.landing_url AS creative_target_url
      FROM segment_ad_mappings AS mapping
      JOIN campaigns AS campaign
        ON campaign.id = mapping.campaign_id
       AND campaign.project_id = mapping.project_id
      LEFT JOIN ad_creatives AS creative
        ON creative.campaign_id = campaign.id
       AND creative.project_id = mapping.project_id
       AND creative.status = 'active'
      WHERE mapping.project_id = $1
        AND mapping.status = 'active'
        AND (mapping.expires_at IS NULL OR mapping.expires_at >= now())
        AND mapping.execution_hint_json->>'slot_id' = ANY($2::text[])
        AND campaign.status = 'active'
        AND (campaign.started_at IS NULL OR campaign.started_at <= now())
        AND (campaign.ended_at IS NULL OR campaign.ended_at >= now())
      ORDER BY
        mapping.execution_hint_json->>'slot_id' ASC,
        campaign_id ASC,
        creative.payload_json->>'variant' ASC NULLS LAST
      `,
      [projectId, uniqueSlots],
    );

    return result.rows;
  }
}
