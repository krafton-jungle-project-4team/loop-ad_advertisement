import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL, type PgPool } from '../../database/database.constants';
import type { ActionProbability } from '../types/ad-decision.types';

interface ActionProbabilityRow {
  action_id: string;
  probability: string;
}

@Injectable()
export class ExperimentActionProbRepository {
  constructor(@Inject(PG_POOL) private readonly pool: PgPool) {}

  async findByExperiment(experimentId: string): Promise<ActionProbability[]> {
    const result = await this.pool.query<ActionProbabilityRow>(
      `
      SELECT
        action_id,
        probability
      FROM experiment_action_probs
      WHERE experiment_id = $1
      ORDER BY action_id ASC
      `,
      [experimentId],
    );

    return result.rows.map((row) => ({
      actionId: row.action_id,
      probability: Number(row.probability),
    }));
  }
}
