import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import { AdCandidateService } from '../services/ad-candidate.service';
import { AdClickService } from '../services/ad-click.service';
import { AdDecisionService } from '../services/ad-decision.service';
import { AdEventEmitter } from '../services/ad-event-emitter.service';
import { AdTargetingService } from '../services/ad-targeting.service';
import { AdTokenService } from '../services/ad-token.service';
import { AdVariantService } from '../services/ad-variant.service';
import { AdClickController } from './ad-click.controller';
import { AdDecisionController } from './ad-decision.controller';
import type { CandidateCampaign } from '../types/ad-decision.types';

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

function campaign(
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
    placement: { slot_id, weight: 100 },
    creatives: [
      {
        creative_id: `${campaign_id}_A`,
        campaign_id,
        variant: 'A',
        headline: `${campaign_id} A`,
        image_url: 'https://placehold.co/800x400?text=A',
        target_url: '/a',
      },
      {
        creative_id: `${campaign_id}_B`,
        campaign_id,
        variant: 'B',
        headline: `${campaign_id} B`,
        image_url: 'https://placehold.co/800x400?text=B',
        target_url: '/b',
      },
    ],
  };
}

describe('Ad API integration', () => {
  let app: INestApplication;
  const eventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    eventEmitter.emit.mockClear();

    const candidateService = {
      getCandidatesBySlots: jest.fn().mockResolvedValue(
        new Map([
          [
            'main_hero',
            [
              campaign('camp_fresh_01', 'main_hero', 10, {
                category: 'fresh_food',
                age_groups: ['30s', '40s'],
                gender: null,
              }),
            ],
          ],
          [
            'main_side_left',
            [
              campaign('camp_digital_01', 'main_side_left', 5, {
                category: 'digital',
                age_groups: null,
                gender: null,
              }),
            ],
          ],
          [
            'main_side_right',
            [
              campaign('camp_fashion_01', 'main_side_right', 5, {
                category: 'fashion',
                age_groups: ['20s', '30s'],
                gender: 'female',
              }),
            ],
          ],
        ]),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdDecisionController, AdClickController],
      providers: [
        AdDecisionService,
        AdClickService,
        AdTargetingService,
        AdVariantService,
        AdTokenService,
        {
          provide: APP_CONFIG,
          useValue: testConfig,
        },
        {
          provide: AdCandidateService,
          useValue: candidateService,
        },
        {
          provide: AdEventEmitter,
          useValue: eventEmitter,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns one decision per requested slot and emits impressions', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/ad-decision')
      .send({
        project_id: 'loopad-demo-shop',
        user_id: 'user_001',
        session_id: 'session_001',
        slots: ['main_hero', 'main_side_left', 'main_side_right'],
        context: {
          page_url: '/',
          device: 'mobile',
          category: 'fresh_food',
          age_group: '30s',
          gender: null,
        },
      })
      .expect(200);

    expect(response.body.decisions).toHaveLength(3);
    expect(response.body.decisions[0]).toMatchObject({
      slot_id: 'main_hero',
      campaign_id: 'camp_fresh_01',
    });
    expect(response.body.decisions[1]).toEqual({
      slot_id: 'main_side_left',
      creative_id: null,
      campaign_id: null,
      variant: null,
      creative: null,
      tracking_token: null,
    });
    expect(response.body.decisions[2]).toEqual({
      slot_id: 'main_side_right',
      creative_id: null,
      campaign_id: null,
      variant: null,
      creative: null,
      tracking_token: null,
    });
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);

    eventEmitter.emit.mockClear();

    await request(app.getHttpServer())
      .post('/v1/ad-click')
      .send({
        tracking_token: response.body.decisions[0].tracking_token,
      })
      .expect(200)
      .expect({ ok: true });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'ad_click',
        campaign_id: 'camp_fresh_01',
      }),
    );
  });

  it('rejects tampered click tokens', async () => {
    await request(app.getHttpServer())
      .post('/v1/ad-click')
      .send({
        tracking_token: 'bad.token',
      })
      .expect(401);
  });
});
