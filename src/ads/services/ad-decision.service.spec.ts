import { AppLoggerService } from '../../logging/app-logger.service';
import { AdDecisionRepository } from '../repositories/ad-decision.repository';
import { AdActionSelectorService } from './ad-action-selector.service';
import { AdContentService } from './ad-content.service';
import { AdDecisionService } from './ad-decision.service';
import { AdExperimentService } from './ad-experiment.service';
import { AdSegmentService } from './ad-segment.service';
import type {
  AdDecisionRequest,
  Experiment,
  GeneratedContent,
} from '../types/ad-decision.types';

const request: AdDecisionRequest = {
  project_id: 'demo_project',
  user_id: 'user_001',
  slot_id: 'main_banner',
  page_url: '/products/chicken_001',
  category: 'fresh_food',
  device: 'mobile',
};

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

const selectedContent: GeneratedContent = {
  contentId: 'content_discount',
  projectId: 'demo_project',
  recommendationId: 'rec_001',
  actionId: 'act_discount',
  contentUrl:
    'https://s3.ap-northeast-2.amazonaws.com/loop-ad-demo/content_discount.png',
  isDefault: false,
};

const defaultContent: GeneratedContent = {
  contentId: 'content_default_banner',
  projectId: 'demo_project',
  recommendationId: null,
  actionId: null,
  contentUrl:
    'https://s3.ap-northeast-2.amazonaws.com/loop-ad-demo/default_banner.png',
  isDefault: true,
};

function createService(overrides: {
  segmentId?: string;
  experiment?: Experiment | null;
  actionId?: string | null;
  content?: GeneratedContent;
  isDefaultFallback?: boolean;
  decisionId?: string;
  insertRejects?: Error;
} = {}) {
  const adSegmentService = {
    resolveSegment: jest
      .fn()
      .mockResolvedValue(overrides.segmentId ?? 'seg_30m_mobile_fresh'),
  } as unknown as AdSegmentService;
  const adExperimentService = {
    findExperimentForSegment: jest
      .fn()
      .mockResolvedValue(
        Object.prototype.hasOwnProperty.call(overrides, 'experiment')
          ? overrides.experiment
          : runningExperiment,
      ),
  } as unknown as AdExperimentService;
  const adActionSelectorService = {
    selectAction: jest.fn().mockResolvedValue(
      overrides.actionId === null
        ? null
        : { actionId: overrides.actionId ?? 'act_discount' },
    ),
  } as unknown as AdActionSelectorService;
  const adContentService = {
    resolveContent: jest.fn().mockResolvedValue({
      content: overrides.content ?? selectedContent,
      isDefaultFallback: overrides.isDefaultFallback ?? false,
    }),
    getDefaultContent: jest.fn().mockResolvedValue(defaultContent),
  } as unknown as AdContentService;
  const adDecisionRepository = {
    insert: jest.fn().mockImplementation(() => {
      if (overrides.insertRejects) {
        return Promise.reject(overrides.insertRejects);
      }

      return Promise.resolve(overrides.decisionId ?? '101');
    }),
  } as unknown as AdDecisionRepository;
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as jest.Mocked<AppLoggerService>;

  return {
    service: new AdDecisionService(
      adSegmentService,
      adExperimentService,
      adActionSelectorService,
      adContentService,
      adDecisionRepository,
      logger,
    ),
    adSegmentService,
    adExperimentService,
    adActionSelectorService,
    adContentService,
    adDecisionRepository,
    logger,
  };
}

describe('AdDecisionService', () => {
  it('returns the MVP decision fields and persists a normal selected decision', async () => {
    const { service, adDecisionRepository } = createService();

    const response = await service.decide(request);

    expect(response).toEqual({
      decision_id: '101',
      project_id: 'demo_project',
      user_id: 'user_001',
      segment_id: 'seg_30m_mobile_fresh',
      experiment_id: 'exp_001',
      recommendation_id: 'rec_001',
      action_id: 'act_discount',
      content_id: 'content_discount',
      content_url:
        'https://s3.ap-northeast-2.amazonaws.com/loop-ad-demo/content_discount.png',
    });
    expect(adDecisionRepository.insert).toHaveBeenCalledWith({
      projectId: 'demo_project',
      userId: 'user_001',
      segmentId: 'seg_30m_mobile_fresh',
      experimentId: 'exp_001',
      actionId: 'act_discount',
      contentId: 'content_discount',
    });
  });

  it('uses default content without insert when no experiment exists', async () => {
    const {
      service,
      adActionSelectorService,
      adContentService,
      adDecisionRepository,
    } = createService({ experiment: null });

    const response = await service.decide(request);

    expect(response).toMatchObject({
      decision_id: '',
      segment_id: 'seg_30m_mobile_fresh',
      experiment_id: '',
      recommendation_id: '',
      action_id: '',
      content_id: 'content_default_banner',
    });
    expect(adActionSelectorService.selectAction).not.toHaveBeenCalled();
    expect(adContentService.getDefaultContent).toHaveBeenCalledWith(
      'demo_project',
    );
    expect(adDecisionRepository.insert).not.toHaveBeenCalled();
  });

  it('uses default banner without insert when selected action content is missing', async () => {
    const { service, adDecisionRepository } = createService({
      content: defaultContent,
      isDefaultFallback: true,
    });

    const response = await service.decide(request);

    expect(response).toMatchObject({
      decision_id: '',
      experiment_id: 'exp_001',
      recommendation_id: 'rec_001',
      action_id: 'act_discount',
      content_id: 'content_default_banner',
    });
    expect(adDecisionRepository.insert).not.toHaveBeenCalled();
  });

  it('uses default content without insert when a completed experiment has no winner', async () => {
    const completedWithoutWinner: Experiment = {
      ...runningExperiment,
      status: 'completed',
      winnerActionId: null,
      endedAt: new Date('2026-01-02T00:00:00.000Z'),
    };
    const { service, adDecisionRepository } = createService({
      experiment: completedWithoutWinner,
      actionId: null,
    });

    const response = await service.decide(request);

    expect(response).toMatchObject({
      decision_id: '',
      experiment_id: 'exp_001',
      recommendation_id: 'rec_001',
      action_id: '',
      content_id: 'content_default_banner',
    });
    expect(adDecisionRepository.insert).not.toHaveBeenCalled();
  });

  it('still returns normal content with an empty decision_id when insert fails', async () => {
    const { service, logger } = createService({
      insertRejects: new Error('insert failed'),
    });

    const response = await service.decide(request);

    expect(response).toMatchObject({
      decision_id: '',
      content_id: 'content_discount',
      content_url:
        'https://s3.ap-northeast-2.amazonaws.com/loop-ad-demo/content_discount.png',
    });
    expect(logger.error).toHaveBeenCalledWith(
      AdDecisionService.name,
      'ad decision insert failed',
      {
        project_id: 'demo_project',
        segment_id: 'seg_30m_mobile_fresh',
        experiment_id: 'exp_001',
        action_id: 'act_discount',
        content_id: 'content_discount',
        error_message: 'insert failed',
      },
    );
  });

  it('persists a completed experiment winner when action selection succeeds', async () => {
    const completedWithWinner: Experiment = {
      ...runningExperiment,
      status: 'completed',
      winnerActionId: 'act_bundle',
      endedAt: new Date('2026-01-02T00:00:00.000Z'),
    };
    const { service, adDecisionRepository } = createService({
      experiment: completedWithWinner,
      actionId: 'act_bundle',
      content: {
        ...selectedContent,
        contentId: 'content_bundle',
        actionId: 'act_bundle',
      },
    });

    const response = await service.decide(request);

    expect(response).toMatchObject({
      decision_id: '101',
      action_id: 'act_bundle',
      content_id: 'content_bundle',
    });
    expect(adDecisionRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'act_bundle',
        contentId: 'content_bundle',
      }),
    );
  });
});
