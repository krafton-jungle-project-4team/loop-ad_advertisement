import { Injectable, Logger } from '@nestjs/common';
import { AdDecisionRepository } from '../repositories/ad-decision.repository';
import { AdActionSelectorService } from './ad-action-selector.service';
import { AdContentService } from './ad-content.service';
import { AdExperimentService } from './ad-experiment.service';
import { AdSegmentService } from './ad-segment.service';
import type {
  AdDecisionRequest,
  AdDecisionResponse,
  Experiment,
  GeneratedContent,
} from '../types/ad-decision.types';

@Injectable()
export class AdDecisionService {
  private readonly logger = new Logger(AdDecisionService.name);

  constructor(
    private readonly adSegmentService: AdSegmentService,
    private readonly adExperimentService: AdExperimentService,
    private readonly adActionSelectorService: AdActionSelectorService,
    private readonly adContentService: AdContentService,
    private readonly adDecisionRepository: AdDecisionRepository,
  ) {}

  async decide(request: AdDecisionRequest): Promise<AdDecisionResponse> {
    const segmentId = await this.adSegmentService.resolveSegment(
      request.project_id,
      request.user_id,
    );
    const experiment =
      await this.adExperimentService.findExperimentForSegment(
        request.project_id,
        segmentId,
      );

    if (experiment == null) {
      return this.defaultContentResponse(request, segmentId);
    }

    const selectedAction =
      await this.adActionSelectorService.selectAction(experiment);

    if (selectedAction == null) {
      return this.defaultContentResponse(request, segmentId, experiment);
    }

    const resolvedContent = await this.adContentService.resolveContent(
      request.project_id,
      experiment.recommendationId,
      selectedAction.actionId,
    );

    if (resolvedContent.isDefaultFallback) {
      return this.response({
        request,
        segmentId,
        experiment,
        actionId: selectedAction.actionId,
        content: resolvedContent.content,
        decisionId: '',
      });
    }

    const decisionId = await this.insertDecision({
      request,
      segmentId,
      experiment,
      actionId: selectedAction.actionId,
      contentId: resolvedContent.content.contentId,
    });

    return this.response({
      request,
      segmentId,
      experiment,
      actionId: selectedAction.actionId,
      content: resolvedContent.content,
      decisionId,
    });
  }

  private async defaultContentResponse(
    request: AdDecisionRequest,
    segmentId: string,
    experiment?: Experiment,
  ): Promise<AdDecisionResponse> {
    const defaultContent = await this.adContentService.getDefaultContent(
      request.project_id,
    );

    return this.response({
      request,
      segmentId,
      experiment,
      actionId: '',
      content: defaultContent,
      decisionId: '',
    });
  }

  private async insertDecision(input: {
    request: AdDecisionRequest;
    segmentId: string;
    experiment: Experiment;
    actionId: string;
    contentId: string;
  }): Promise<string> {
    try {
      return await this.adDecisionRepository.insert({
        projectId: input.request.project_id,
        userId: input.request.user_id,
        segmentId: input.segmentId,
        experimentId: input.experiment.id,
        actionId: input.actionId,
        contentId: input.contentId,
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: 'ad decision insert failed',
          project_id: input.request.project_id,
          segment_id: input.segmentId,
          experiment_id: input.experiment.id,
          action_id: input.actionId,
          content_id: input.contentId,
          error: (error as Error).message,
        }),
      );

      return '';
    }
  }

  private response(input: {
    request: AdDecisionRequest;
    segmentId: string;
    experiment?: Experiment;
    actionId: string;
    content: GeneratedContent;
    decisionId: string;
  }): AdDecisionResponse {
    return {
      decision_id: input.decisionId,
      project_id: input.request.project_id,
      user_id: input.request.user_id,
      segment_id: input.segmentId,
      experiment_id: input.experiment?.id ?? '',
      recommendation_id: input.experiment?.recommendationId ?? '',
      action_id: input.actionId,
      content_id: input.content.contentId,
      content_url: input.content.contentUrl ?? '',
    };
  }
}
