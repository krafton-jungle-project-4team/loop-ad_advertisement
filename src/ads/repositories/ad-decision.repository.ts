import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL, type PgPool } from '../../database/database.constants';

export interface InsertAdDecisionInput {
  projectId: string;
  userId: string;
  segmentId: string;
  experimentId: string;
  actionId: string;
  contentId: string;
}

@Injectable()
export class AdDecisionRepository {
  constructor(@Inject(PG_POOL) private readonly pool: PgPool) {}

  async insert(input: InsertAdDecisionInput): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `
      INSERT INTO ad_decisions (
        project_id,
        user_id,
        segment_id,
        experiment_id,
        action_id,
        content_id,
        created_at
      ) VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        now()
      )
      RETURNING id::text
      `,
      [
        input.projectId,
        input.userId,
        input.segmentId,
        input.experimentId,
        input.actionId,
        input.contentId,
      ],
    );

    return result.rows[0]?.id ?? '';
  }
}
