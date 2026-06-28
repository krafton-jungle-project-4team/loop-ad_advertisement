import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL, type PgPool } from '../../database/database.constants';
import type {
  Experiment,
  ExperimentStatus,
} from '../types/ad-decision.types';

interface ExperimentRow {
  id: string;
  project_id: string;
  segment_id: string;
  recommendation_id: string;
  status: ExperimentStatus;
  goal_metric: string;
  target_value: string;
  winner_action_id: string | null;
  started_at: Date | null;
  ended_at: Date | null;
  created_at: Date;
}

@Injectable()
export class ExperimentRepository {
  constructor(@Inject(PG_POOL) private readonly pool: PgPool) {}

  async findActiveBySegment(
    projectId: string,
    segmentId: string,
  ): Promise<Experiment | null> {
    const result = await this.pool.query<ExperimentRow>(
      `
      SELECT
        id,
        project_id,
        segment_id,
        recommendation_id,
        status,
        goal_metric,
        target_value,
        winner_action_id,
        started_at,
        ended_at,
        created_at
      FROM experiments
      WHERE project_id = $1
        AND segment_id = $2
        AND status IN ('running', 'completed')
      ORDER BY
        CASE WHEN status = 'running' THEN 0 ELSE 1 END ASC,
        COALESCE(started_at, created_at) DESC,
        created_at DESC
      LIMIT 1
      `,
      [projectId, segmentId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      projectId: row.project_id,
      segmentId: row.segment_id,
      recommendationId: row.recommendation_id,
      status: row.status,
      goalMetric: row.goal_metric,
      targetValue: Number(row.target_value),
      winnerActionId: row.winner_action_id,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      createdAt: row.created_at,
    };
  }
}
