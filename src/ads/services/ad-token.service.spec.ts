import { UnauthorizedException } from '@nestjs/common';
import type { AppConfig } from '../../config/app-config';
import { AdTokenService } from './ad-token.service';
import type { TrackingTokenPayload } from '../types/ad-decision.types';

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

describe('AdTokenService', () => {
  const service = new AdTokenService(testConfig);
  const payload: TrackingTokenPayload = {
    project_id: 'loopad-demo-shop',
    slot_id: 'main_hero',
    campaign_id: 'camp_fresh_01',
    creative_id: '1',
    variant: 'A',
    user_id: 'user_001',
    session_id: 'session_001',
    issued_at: 1710000000,
  };

  it('signs and verifies a self-contained HMAC token', () => {
    const token = service.sign(payload);

    expect(service.verify(token)).toEqual(payload);
    expect(token.split('.')).toHaveLength(2);
  });

  it('rejects tampered tokens', () => {
    const token = service.sign(payload);
    const [encodedPayload, signature] = token.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...payload, campaign_id: 'camp_pet_01' }),
    ).toString('base64url');

    expect(() => service.verify(`${tamperedPayload}.${signature}`)).toThrow(
      UnauthorizedException,
    );
    expect(() => service.verify(`${encodedPayload}.tampered`)).toThrow(
      UnauthorizedException,
    );
  });
});
