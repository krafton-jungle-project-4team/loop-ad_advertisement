import { UnauthorizedException } from '@nestjs/common';
import { AdTokenService } from './ad-token.service';
import type { TrackingTokenPayload } from '../types/ad-decision.types';

describe('AdTokenService', () => {
  const service = new AdTokenService();
  const payload: TrackingTokenPayload = {
    project_id: 'loopad-demo-shop',
    slot_id: 'main_hero',
    campaign_id: 'camp_fresh_01',
    creative_id: 'cr_fresh_A',
    variant: 'A',
    user_id: 'user_001',
    session_id: 'session_001',
    issued_at: 1710000000,
  };

  beforeEach(() => {
    process.env.HMAC_SECRET = 'test-secret';
  });

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
