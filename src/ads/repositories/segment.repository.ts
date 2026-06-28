import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL, type PgPool } from '../../database/database.constants';
import type { SegmentDefinition } from '../types/ad-decision.types';

interface SegmentDefinitionRow {
  id: string;
  project_id: string;
  age_group: string | null;
  gender: string | null;
  device: string | null;
  category: string | null;
  is_default: boolean;
}

@Injectable()
export class SegmentRepository {
  constructor(@Inject(PG_POOL) private readonly pool: PgPool) {}

  async findNonDefaultByProject(
    projectId: string,
  ): Promise<SegmentDefinition[]> {
    const result = await this.pool.query<SegmentDefinitionRow>(
      `
      SELECT
        id,
        project_id,
        age_group,
        gender,
        device,
        category,
        is_default
      FROM segment_definitions
      WHERE project_id = $1
        AND is_default = false
      ORDER BY id ASC
      `,
      [projectId],
    );

    return result.rows.map((row) => this.toSegment(row));
  }

  async findDefaultByProject(
    projectId: string,
  ): Promise<SegmentDefinition | null> {
    const result = await this.pool.query<SegmentDefinitionRow>(
      `
      SELECT
        id,
        project_id,
        age_group,
        gender,
        device,
        category,
        is_default
      FROM segment_definitions
      WHERE project_id = $1
        AND is_default = true
      LIMIT 1
      `,
      [projectId],
    );

    const row = result.rows[0];
    return row ? this.toSegment(row) : null;
  }

  private toSegment(row: SegmentDefinitionRow): SegmentDefinition {
    return {
      id: row.id,
      projectId: row.project_id,
      ageGroup: row.age_group,
      gender: row.gender,
      device: row.device,
      category: row.category,
      isDefault: row.is_default,
    };
  }
}
