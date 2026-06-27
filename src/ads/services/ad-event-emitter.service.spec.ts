import { Logger } from '@nestjs/common';
import type { AppConfig } from '../../config/app-config';
import { LoggingAdEventEmitterService } from './ad-event-emitter.service';

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
};

describe('LoggingAdEventEmitterService', () => {
  it('logs only the safe ad event field allowlist', () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const service = new LoggingAdEventEmitterService(testConfig);

    try {
      service.emit({
        event_type: 'ad_impression',
        project_id: 'loopad-demo-shop',
        slot_id: 'main_hero',
        campaign_id: 'camp_fresh_01',
        creative_id: 'cr_fresh_A',
        variant: 'A',
        user_id: 'user_001',
        session_id: 'session_001',
      });

      expect(logSpy).toHaveBeenCalledTimes(1);
      const logPayload = JSON.parse(String(logSpy.mock.calls[0][0])) as Record<
        string,
        unknown
      >;

      expect(logPayload).toMatchObject({
        level: 'info',
        service: 'advertisement-api',
        env: 'test',
        message: 'ad event emitted',
        event_type: 'ad_impression',
        project_id: 'loopad-demo-shop',
        slot_id: 'main_hero',
        campaign_id: 'camp_fresh_01',
        creative_id: 'cr_fresh_A',
        variant: 'A',
      });
      expect(logPayload).not.toHaveProperty('user_id');
      expect(logPayload).not.toHaveProperty('session_id');
      expect(logPayload).not.toHaveProperty('tracking_token');
    } finally {
      logSpy.mockRestore();
    }
  });
});
