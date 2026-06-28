import { Injectable } from '@nestjs/common';
import { ExperimentRepository } from '../repositories/experiment.repository';
import type { Experiment } from '../types/ad-decision.types';

@Injectable()
export class AdExperimentService {
  constructor(private readonly experimentRepository: ExperimentRepository) {}

  async findExperimentForSegment(
    projectId: string,
    segmentId: string,
  ): Promise<Experiment | null> {
    return this.experimentRepository.findActiveBySegment(projectId, segmentId);
  }
}
