import { Injectable } from '@nestjs/common';
import { AdCacheService } from '../../redis/ad-cache.service';
import {
  AppLoggerService,
  errorMessage,
} from '../../logging/app-logger.service';
import { SegmentRepository } from '../repositories/segment.repository';
import { UserProfileRepository } from '../repositories/user-profile.repository';
import type {
  SegmentDefinition,
  UserProfile,
} from '../types/ad-decision.types';

@Injectable()
export class AdSegmentService {
  constructor(
    private readonly adCacheService: AdCacheService,
    private readonly userProfileRepository: UserProfileRepository,
    private readonly segmentRepository: SegmentRepository,
    private readonly logger: AppLoggerService,
  ) {}

  async resolveSegment(projectId: string, userId: string): Promise<string> {
    try {
      const cachedSegmentId = await this.adCacheService.getSegment(
        projectId,
        userId,
      );

      if (cachedSegmentId != null && cachedSegmentId.trim().length > 0) {
        return cachedSegmentId;
      }
    } catch (error) {
      this.logger.warn(
        AdSegmentService.name,
        'redis segment lookup failed; falling back to postgres',
        {
          project_id: projectId,
          error_message: errorMessage(error),
        },
      );
    }

    const segmentId = await this.resolveSegmentFromPostgres(projectId, userId);

    try {
      await this.adCacheService.setSegment(projectId, userId, segmentId);
    } catch (error) {
      this.logger.warn(AdSegmentService.name, 'redis segment cache write failed', {
        project_id: projectId,
        segment_id: segmentId,
        error_message: errorMessage(error),
      });
    }

    return segmentId;
  }

  private async resolveSegmentFromPostgres(
    projectId: string,
    userId: string,
  ): Promise<string> {
    const profile = await this.userProfileRepository.findByProjectAndUser(
      projectId,
      userId,
    );

    if (profile == null) {
      return this.defaultSegmentId(projectId);
    }

    const segments =
      await this.segmentRepository.findNonDefaultByProject(projectId);
    const matched = segments
      .filter((segment) => this.matches(segment, profile))
      .sort((left, right) => {
        const specificity = this.specificity(right) - this.specificity(left);

        if (specificity !== 0) {
          return specificity;
        }

        return left.id.localeCompare(right.id);
      })[0];

    return matched?.id ?? this.defaultSegmentId(projectId);
  }

  private async defaultSegmentId(projectId: string): Promise<string> {
    const defaultSegment =
      await this.segmentRepository.findDefaultByProject(projectId);

    if (defaultSegment == null) {
      throw new Error('default segment seed row is required');
    }

    return defaultSegment.id;
  }

  private matches(segment: SegmentDefinition, profile: UserProfile): boolean {
    if (this.specificity(segment) === 0) {
      return false;
    }

    return (
      this.matchesValue(segment.ageGroup, profile.ageGroup) &&
      this.matchesValue(segment.gender, profile.gender) &&
      this.matchesValue(segment.device, profile.device) &&
      this.matchesValue(segment.category, profile.favoriteCategory)
    );
  }

  private matchesValue(
    expected: string | null,
    actual: string | null,
  ): boolean {
    return expected == null || expected === actual;
  }

  private specificity(segment: SegmentDefinition): number {
    return [
      segment.ageGroup,
      segment.gender,
      segment.device,
      segment.category,
    ].filter((value) => value != null).length;
  }
}
