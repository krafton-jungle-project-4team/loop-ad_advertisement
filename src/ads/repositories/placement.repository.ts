import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL, type PgPool } from '../../database/database.constants';
import type { MainPageAdSlot } from '../constants/ad-slots.constant';
import type { Placement } from '../types/ad-decision.types';

interface PlacementRow {
  campaign_id: string;
  slot_id: MainPageAdSlot;
  weight: number;
}

@Injectable()
export class PlacementRepository {
  constructor(@Inject(PG_POOL) private readonly pool: PgPool) {}

  async findBySlots(slots: MainPageAdSlot[]): Promise<Placement[]> {
    if (slots.length === 0) {
      return [];
    }

    const result = await this.pool.query<PlacementRow>(
      `
      SELECT campaign_id, slot_id, weight
      FROM placement
      WHERE slot_id = ANY($1::text[])
      ORDER BY slot_id ASC, campaign_id ASC
      `,
      [slots],
    );

    return result.rows.map((row) => ({
      campaign_id: row.campaign_id,
      slot_id: row.slot_id,
      weight: Number(row.weight),
    }));
  }
}
