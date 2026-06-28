import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { createCorsOptions } from '../../config/cors';
import { AdDecisionService } from '../services/ad-decision.service';
import { AdDecisionController } from './ad-decision.controller';

describe('Ad API integration', () => {
  let app: INestApplication;
  const decisionPaths = [
    '/ads/decision',
    '/api/ads/decision',
    '/advertisements/decision',
  ];
  const devShoppingMallOrigin = 'https://demo-shoppingmall.dev.loop-ad.org';
  const localShoppingMallOrigin = 'http://localhost:5173';
  const blockedOrigin = 'https://dashboard.dev.loop-ad.org';
  const decisionRequest = {
    project_id: 'demo_project',
    user_id: 'user_001',
    slot_id: 'main_banner',
    page_url: '/products/chicken_001',
    category: 'fresh_food',
    device: 'mobile',
  };
  const decisionResponse = {
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
  };
  const adDecisionService = {
    decide: jest.fn(),
  };

  beforeEach(async () => {
    adDecisionService.decide.mockResolvedValue(decisionResponse);

    const moduleRef = await Test.createTestingModule({
      controllers: [AdDecisionController],
      providers: [
        {
          provide: AdDecisionService,
          useValue: adDecisionService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.enableCors(createCorsOptions());
    await app.init();
  });

  afterEach(async () => {
    adDecisionService.decide.mockReset();
    await app.close();
  });

  it.each(decisionPaths)(
    'returns the single MVP ad decision response from POST %s',
    async (path) => {
      const response = await request(app.getHttpServer())
        .post(path)
        .send(decisionRequest)
        .expect(200);

      expect(response.body).toEqual(decisionResponse);
      expect(adDecisionService.decide).toHaveBeenCalledTimes(1);
      expect(adDecisionService.decide).toHaveBeenCalledWith(decisionRequest);
    },
  );

  it('rejects anonymous_id in the request body', async () => {
    await request(app.getHttpServer())
      .post('/ads/decision')
      .send({
        project_id: 'demo_project',
        user_id: 'user_001',
        anonymous_id: 'anon_001',
      })
      .expect(400);

    expect(adDecisionService.decide).not.toHaveBeenCalled();
  });

  it('does not register click tracking endpoints', async () => {
    await request(app.getHttpServer()).post('/ads/click').send({}).expect(404);
    await request(app.getHttpServer())
      .post('/api/ads/click')
      .send({})
      .expect(404);
    await request(app.getHttpServer())
      .post('/advertisements/click')
      .send({})
      .expect(404);
    await request(app.getHttpServer()).post('/v1/ad-click').send({}).expect(404);
  });

  it('allows dev shopping mall preflight requests to the public decision path', async () => {
    const response = await preflightDecisionRequest(devShoppingMallOrigin).expect(
      204,
    );

    expect(response.headers['access-control-allow-origin']).toBe(
      devShoppingMallOrigin,
    );
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-headers']).toContain(
      'Content-Type',
    );
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('allows local frontend preflight requests to the public decision path', async () => {
    const response = await preflightDecisionRequest(
      localShoppingMallOrigin,
    ).expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(
      localShoppingMallOrigin,
    );
  });

  it('does not add CORS allow-origin for unregistered origins', async () => {
    const response = await preflightDecisionRequest(blockedOrigin);

    expect(response.status).not.toBe(500);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  function preflightDecisionRequest(origin: string): request.Test {
    return request(app.getHttpServer())
      .options('/api/ads/decision')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type');
  }
});
