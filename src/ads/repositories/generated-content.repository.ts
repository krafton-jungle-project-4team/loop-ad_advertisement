import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL, type PgPool } from '../../database/database.constants';
import type { GeneratedContent } from '../types/ad-decision.types';

interface GeneratedContentRow {
  id: string;
  project_id: string;
  recommendation_id: string | null;
  action_id: string | null;
  content_url: string | null;
  is_default: boolean;
}

@Injectable()
export class GeneratedContentRepository {
  constructor(@Inject(PG_POOL) private readonly pool: PgPool) {}

  async findByRecommendationAndAction(
    projectId: string,
    recommendationId: string,
    actionId: string,
  ): Promise<GeneratedContent | null> {
    const result = await this.pool.query<GeneratedContentRow>(
      `
      SELECT
        id,
        project_id,
        recommendation_id,
        action_id,
        content_url,
        is_default
      FROM generated_contents
      WHERE project_id = $1
        AND recommendation_id = $2
        AND action_id = $3
        AND is_default = false
      LIMIT 1
      `,
      [projectId, recommendationId, actionId],
    );

    const row = result.rows[0];
    return row ? this.toContent(row) : null;
  }

  async findActionIdsByRecommendation(
    projectId: string,
    recommendationId: string,
  ): Promise<string[]> {
    const result = await this.pool.query<{ action_id: string }>(
      `
      SELECT DISTINCT action_id
      FROM generated_contents
      WHERE project_id = $1
        AND recommendation_id = $2
        AND action_id IS NOT NULL
        AND is_default = false
      ORDER BY action_id ASC
      `,
      [projectId, recommendationId],
    );

    return result.rows.map((row) => row.action_id);
  }

  async findDefaultByProject(projectId: string): Promise<GeneratedContent | null> {
    const result = await this.pool.query<GeneratedContentRow>(
      `
      SELECT
        id,
        project_id,
        recommendation_id,
        action_id,
        content_url,
        is_default
      FROM generated_contents
      WHERE project_id = $1
        AND is_default = true
      LIMIT 1
      `,
      [projectId],
    );

    const row = result.rows[0];
    return row ? this.toContent(row) : null;
  }

  private toContent(row: GeneratedContentRow): GeneratedContent {
    return {
      contentId: row.id,
      projectId: row.project_id,
      recommendationId: row.recommendation_id,
      actionId: row.action_id,
      contentUrl: row.content_url,
      isDefault: row.is_default,
    };
  }
}
