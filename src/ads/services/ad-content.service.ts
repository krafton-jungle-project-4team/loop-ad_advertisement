import { Injectable } from '@nestjs/common';
import { GeneratedContentRepository } from '../repositories/generated-content.repository';
import type {
  GeneratedContent,
  ResolvedContent,
} from '../types/ad-decision.types';

@Injectable()
export class AdContentService {
  constructor(
    private readonly generatedContentRepository: GeneratedContentRepository,
  ) {}

  async resolveContent(
    projectId: string,
    recommendationId: string,
    actionId: string,
  ): Promise<ResolvedContent> {
    const content =
      await this.generatedContentRepository.findByRecommendationAndAction(
        projectId,
        recommendationId,
        actionId,
      );

    if (content != null && this.hasContentUrl(content)) {
      return { content, isDefaultFallback: false };
    }

    return {
      content: await this.getDefaultContent(projectId),
      isDefaultFallback: true,
    };
  }

  async getDefaultContent(projectId: string): Promise<GeneratedContent> {
    const defaultContent =
      await this.generatedContentRepository.findDefaultByProject(projectId);

    if (defaultContent == null || !this.hasContentUrl(defaultContent)) {
      throw new Error('default banner content seed row is required');
    }

    return defaultContent;
  }

  private hasContentUrl(content: GeneratedContent): boolean {
    return (
      content.contentUrl != null && content.contentUrl.trim().length > 0
    );
  }
}
