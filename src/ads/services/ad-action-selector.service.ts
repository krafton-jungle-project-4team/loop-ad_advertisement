import { Injectable, Logger } from '@nestjs/common';
import { ExperimentActionProbRepository } from '../repositories/experiment-action-prob.repository';
import { GeneratedContentRepository } from '../repositories/generated-content.repository';
import type {
  ActionProbability,
  Experiment,
  SelectedAction,
} from '../types/ad-decision.types';

@Injectable()
export class AdActionSelectorService {
  private readonly logger = new Logger(AdActionSelectorService.name);

  constructor(
    private readonly experimentActionProbRepository: ExperimentActionProbRepository,
    private readonly generatedContentRepository: GeneratedContentRepository,
  ) {}

  async selectAction(
    experiment: Experiment,
    randomValue = Math.random(),
  ): Promise<SelectedAction | null> {
    if (experiment.status === 'completed') {
      if (experiment.winnerActionId != null) {
        return { actionId: experiment.winnerActionId };
      }

      this.logger.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: 'completed experiment has no winner action',
          project_id: experiment.projectId,
          experiment_id: experiment.id,
          segment_id: experiment.segmentId,
        }),
      );

      return null;
    }

    const probabilities =
      await this.experimentActionProbRepository.findByExperiment(experiment.id);
    const validProbabilities = probabilities.filter((row) =>
      this.isPositiveFinite(row.probability),
    );

    if (validProbabilities.length > 0) {
      return this.selectWeighted(validProbabilities, randomValue);
    }

    const actionIds =
      await this.generatedContentRepository.findActionIdsByRecommendation(
        experiment.projectId,
        experiment.recommendationId,
      );

    if (actionIds.length === 0) {
      return null;
    }

    return this.selectEvenly(actionIds, randomValue);
  }

  private selectWeighted(
    probabilities: ActionProbability[],
    randomValue: number,
  ): SelectedAction {
    const total = probabilities.reduce(
      (sum, row) => sum + row.probability,
      0,
    );
    const threshold = this.boundedRandom(randomValue) * total;
    let cumulative = 0;

    for (const row of probabilities) {
      cumulative += row.probability;

      if (threshold < cumulative) {
        return { actionId: row.actionId };
      }
    }

    return { actionId: probabilities[probabilities.length - 1].actionId };
  }

  private selectEvenly(actionIds: string[], randomValue: number): SelectedAction {
    const index = Math.floor(this.boundedRandom(randomValue) * actionIds.length);
    return { actionId: actionIds[index] };
  }

  private boundedRandom(randomValue: number): number {
    if (!Number.isFinite(randomValue) || randomValue < 0) {
      return 0;
    }

    return Math.min(randomValue, 0.999999999999);
  }

  private isPositiveFinite(value: number): boolean {
    return Number.isFinite(value) && value > 0;
  }
}
