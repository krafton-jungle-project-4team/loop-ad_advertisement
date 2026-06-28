import { Inject, Injectable } from '@nestjs/common';
import { PG_POOL, type PgPool } from '../../database/database.constants';
import type { UserProfile } from '../types/ad-decision.types';

interface UserProfileRow {
  project_id: string;
  user_id: string;
  age_group: string | null;
  gender: string | null;
  device: string | null;
  favorite_category: string | null;
}

@Injectable()
export class UserProfileRepository {
  constructor(@Inject(PG_POOL) private readonly pool: PgPool) {}

  async findByProjectAndUser(
    projectId: string,
    userId: string,
  ): Promise<UserProfile | null> {
    const result = await this.pool.query<UserProfileRow>(
      `
      SELECT
        project_id,
        user_id,
        age_group,
        gender,
        device,
        favorite_category
      FROM user_profiles
      WHERE project_id = $1
        AND user_id = $2
      LIMIT 1
      `,
      [projectId, userId],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      projectId: row.project_id,
      userId: row.user_id,
      ageGroup: row.age_group,
      gender: row.gender,
      device: row.device,
      favoriteCategory: row.favorite_category,
    };
  }
}
