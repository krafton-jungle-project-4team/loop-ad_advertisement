import { Logger } from '@nestjs/common';
import type { AppConfig } from '../../config/app-config';
import { AdCandidateService } from './ad-candidate.service';
import { AdDecisionService } from './ad-decision.service';
import { AdEventEmitter } from './ad-event-emitter.service';
import { AdTargetingService } from './ad-targeting.service';
import { AdTokenService } from './ad-token.service';
import { AdVariantService } from './ad-variant.service';
import type {
  AdDecisionRequest,
  CandidateCampaign,
} from '../types/ad-decision.types';

const testConfig: AppConfig = {
  env: 'test',
  serviceId: 'advertisement-api',
  port: 8080,
  postgres: {
    host: '127.0.0.1',
    port: 55432,
    database: 'loopad_ad_decision',
    username: 'loopad',
    password: 'loopad',
  },
  redis: {
    url: 'redis://127.0.0.1:6379',
  },
  hmacSecret: 'test-secret',
};

function creative(campaignId: string, variant: 'A' | 'B') {
  return {
    creative_id: `cr_${campaignId}_${variant}`,
    campaign_id: campaignId,
    variant,
    headline: `${campaignId} ${variant}`,
    image_url: `https://placehold.co/800x400?text=${campaignId}-${variant}`,
    target_url: `/category/${campaignId}`,
  };
}

function candidate(
  campaign_id: string,
  slot_id: CandidateCampaign['placement']['slot_id'],
  priority: number,
  target: CandidateCampaign['target'],
): CandidateCampaign {
  return {
    campaign_id,
    name: campaign_id,
    priority,
    status: 'active',
    target,
    placement: {
      slot_id,
      weight: 100,
    },
    creatives: [creative(campaign_id, 'A'), creative(campaign_id, 'B')],
  };
}

const seedCandidates = new Map([
  [
    'main_hero',
    [
      candidate('camp_fresh_01', 'main_hero', 10, {
        category: 'fresh_food',
        age_groups: ['30s', '40s'],
        gender: null,
      }),
      candidate('camp_pet_01', 'main_hero', 8, {
        category: 'pet',
        age_groups: ['20s', '30s'],
        gender: null,
      }),
    ],
  ],
  [
    'main_side_left',
    [
      candidate('camp_digital_01', 'main_side_left', 5, {
        category: 'digital',
        age_groups: null,
        gender: null,
      }),
    ],
  ],
  [
    'main_side_right',
    [
      candidate('camp_fashion_01', 'main_side_right', 5, {
        category: 'fashion',
        age_groups: ['20s', '30s'],
        gender: 'female',
      }),
    ],
  ],
]) as Map<CandidateCampaign['placement']['slot_id'], CandidateCampaign[]>;

function request(
  slot: CandidateCampaign['placement']['slot_id'],
  context: AdDecisionRequest['context'],
): AdDecisionRequest {
  return {
    project_id: 'loopad-demo-shop',
    user_id: 'user_001',
    session_id: 'session_001',
    slots: [slot],
    context,
  };
}

function createService(candidates = seedCandidates) {
  const candidateService = {
    getCandidatesBySlots: jest.fn().mockResolvedValue(candidates),
  } as unknown as AdCandidateService;
  const eventEmitter = {
    emit: jest.fn(),
  } as unknown as AdEventEmitter;
  const service = new AdDecisionService(
    candidateService,
    new AdTargetingService(),
    new AdVariantService(),
    new AdTokenService(testConfig),
    eventEmitter,
  );

  return { service, eventEmitter };
}

describe('AdDecisionService', () => {
  it.each([
    [{ category: 'fresh_food', age_group: '30s' }, 'camp_fresh_01'],
    [{ category: 'pet', age_group: '20s' }, 'camp_pet_01'],
    [{ category: 'pet', age_group: '30s' }, 'camp_pet_01'],
  ])('selects main_hero campaign for %p', async (context, campaignId) => {
    const { service } = createService();

    const response = await service.decide(request('main_hero', context));

    expect(response.decisions).toHaveLength(1);
    expect(response.decisions[0].campaign_id).toBe(campaignId);
  });

  it.each([
    { category: 'book', age_group: '50s' },
    { category: 'fresh_food', age_group: '20s' },
  ])('returns a full null decision for non-matching main_hero %p', async (context) => {
    const { service, eventEmitter } = createService();

    const response = await service.decide(request('main_hero', context));

    expect(response.decisions[0]).toEqual({
      slot_id: 'main_hero',
      creative_id: null,
      campaign_id: null,
      variant: null,
      creative: null,
      tracking_token: null,
    });
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('supports side-slot gender strict matching', async () => {
    const { service } = createService();

    await expect(
      service.decide(
        request('main_side_right', {
          category: 'fashion',
          age_group: '20s',
          gender: 'female',
        }),
      ),
    ).resolves.toMatchObject({
      decisions: [{ campaign_id: 'camp_fashion_01' }],
    });
    await expect(
      service.decide(
        request('main_side_right', {
          category: 'fashion',
          age_group: '20s',
          gender: 'male',
        }),
      ),
    ).resolves.toMatchObject({
      decisions: [{ campaign_id: null }],
    });
    await expect(
      service.decide(
        request('main_side_right', {
          category: 'fashion',
          age_group: '20s',
          gender: null,
        }),
      ),
    ).resolves.toMatchObject({
      decisions: [{ campaign_id: null }],
    });
  });

  it('logs same-priority conflicts while keeping deterministic tiebreakers', async () => {
    const candidates = new Map([
      [
        'main_hero',
        [
          candidate('camp_beta', 'main_hero', 10, {
            category: 'pet',
            age_groups: null,
            gender: null,
          }),
          candidate('camp_alpha', 'main_hero', 10, {
            category: 'pet',
            age_groups: null,
            gender: null,
          }),
        ],
      ],
    ]) as Map<CandidateCampaign['placement']['slot_id'], CandidateCampaign[]>;
    const { service } = createService(candidates);
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    try {
      const response = await service.decide(
        request('main_hero', { category: 'pet' }),
      );

      expect(response.decisions[0].campaign_id).toBe('camp_alpha');
      expect(errorSpy).toHaveBeenCalledTimes(1);

      const logPayload = JSON.parse(String(errorSpy.mock.calls[0][0]));
      expect(logPayload).toMatchObject({
        level: 'error',
        message: 'same-slot same-priority matched campaigns',
        slot_id: 'main_hero',
        priority: 10,
        campaign_ids: ['camp_alpha', 'camp_beta'],
      });
      expect(logPayload).not.toHaveProperty('user_id');
      expect(logPayload).not.toHaveProperty('session_id');
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('emits one impression per non-null decision', async () => {
    const { service, eventEmitter } = createService();

    await service.decide(
      request('main_side_left', {
        category: 'digital',
      }),
    );

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'ad_impression',
        campaign_id: 'camp_digital_01',
      }),
    );
  });
});
