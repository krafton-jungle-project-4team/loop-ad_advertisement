import { Logger } from '@nestjs/common';
import { ExperimentActionProbRepository } from '../repositories/experiment-action-prob.repository';
import { GeneratedContentRepository } from '../repositories/generated-content.repository';
import { AdActionSelectorService } from './ad-action-selector.service';
import type { Experiment } from '../types/ad-decision.types';

const runningExperiment: Experiment = {
  id: 'exp_001',
  projectId: 'demo_project',
  segmentId: 'seg_30m_mobile_fresh',
  recommendationId: 'rec_001',
  status: 'running',
  goalMetric: 'purchase_rate',
  targetValue: 0.05,
  winnerActionId: null,
  startedAt: new Date('2026-01-01T00:00:00.000Z'),
  endedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

function createService(probabilities = [
  { actionId: 'act_discount', probability: 0.3333 },
  { actionId: 'act_free_shipping', probability: 0.3333 },
  { actionId: 'act_bundle', probability: 0.3334 },
]) {
  const experimentActionProbRepository = {
    findByExperiment: jest.fn().mockResolvedValue(probabilities),
  } as unknown as ExperimentActionProbRepository;
  const generatedContentRepository = {
    findActionIdsByRecommendation: jest.fn().mockResolvedValue([
      'act_discount',
      'act_free_shipping',
      'act_bundle',
    ]),
  } as unknown as GeneratedContentRepository;

  return {
    service: new AdActionSelectorService(
      experimentActionProbRepository,
      generatedContentRepository,
    ),
    experimentActionProbRepository,
    generatedContentRepository,
  };
}

describe('AdActionSelectorService', () => {
  it('keeps balanced stored probabilities roughly balanced over many selections', async () => {
    const { service } = createService();
    const counts = new Map<string, number>();

    for (let index = 0; index < 3000; index += 1) {
      const selected = await service.selectAction(
        runningExperiment,
        (index + 0.5) / 3000,
      );
      counts.set(selected?.actionId ?? 'none', (counts.get(selected?.actionId ?? 'none') ?? 0) + 1);
    }

    expect(counts.get('act_discount')).toBeGreaterThanOrEqual(990);
    expect(counts.get('act_discount')).toBeLessThanOrEqual(1010);
    expect(counts.get('act_free_shipping')).toBeGreaterThanOrEqual(990);
    expect(counts.get('act_free_shipping')).toBeLessThanOrEqual(1010);
    expect(counts.get('act_bundle')).toBeGreaterThanOrEqual(990);
    expect(counts.get('act_bundle')).toBeLessThanOrEqual(1010);
  });

  it('shifts repeated selection toward the higher stored probability', async () => {
    const { service } = createService([
      { actionId: 'act_discount', probability: 0.8 },
      { actionId: 'act_free_shipping', probability: 0.1 },
      { actionId: 'act_bundle', probability: 0.1 },
    ]);
    const counts = new Map<string, number>();

    for (let index = 0; index < 1000; index += 1) {
      const selected = await service.selectAction(
        runningExperiment,
        (index + 0.5) / 1000,
      );
      counts.set(selected?.actionId ?? 'none', (counts.get(selected?.actionId ?? 'none') ?? 0) + 1);
    }

    expect(counts.get('act_discount')).toBe(800);
    expect(counts.get('act_discount')).toBeGreaterThan(
      counts.get('act_free_shipping') ?? 0,
    );
    expect(counts.get('act_discount')).toBeGreaterThan(
      counts.get('act_bundle') ?? 0,
    );
  });

  it('uses equal probability among available actions when probability rows are missing', async () => {
    const { service, generatedContentRepository } = createService([]);

    await expect(service.selectAction(runningExperiment, 0.1)).resolves.toEqual({
      actionId: 'act_discount',
    });
    await expect(service.selectAction(runningExperiment, 0.5)).resolves.toEqual({
      actionId: 'act_free_shipping',
    });
    await expect(service.selectAction(runningExperiment, 0.9)).resolves.toEqual({
      actionId: 'act_bundle',
    });
    expect(
      generatedContentRepository.findActionIdsByRecommendation,
    ).toHaveBeenCalledWith('demo_project', 'rec_001');
  });

  it('selects a completed experiment winner without reading probabilities', async () => {
    const { service, experimentActionProbRepository } = createService();

    await expect(
      service.selectAction(
        {
          ...runningExperiment,
          status: 'completed',
          winnerActionId: 'act_bundle',
        },
        0.01,
      ),
    ).resolves.toEqual({ actionId: 'act_bundle' });
    expect(
      experimentActionProbRepository.findByExperiment,
    ).not.toHaveBeenCalled();
  });

  it('returns null and logs when a completed experiment has no winner', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { service } = createService();

    try {
      await expect(
        service.selectAction(
          {
            ...runningExperiment,
            status: 'completed',
            winnerActionId: null,
          },
          0.01,
        ),
      ).resolves.toBeNull();
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
