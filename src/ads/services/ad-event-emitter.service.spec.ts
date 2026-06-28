import { AppLoggerService } from '../../logging/app-logger.service';
import { LoggingAdEventEmitterService } from './ad-event-emitter.service';

describe('LoggingAdEventEmitterService', () => {
  it('logs only the safe ad event field allowlist', () => {
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<AppLoggerService>;
    const service = new LoggingAdEventEmitterService(logger);

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

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      LoggingAdEventEmitterService.name,
      'ad event emitted',
      expect.any(Object),
    );
    const logFields = logger.info.mock.calls[0][2] as Record<string, unknown>;

    expect(logFields).toMatchObject({
      event_type: 'ad_impression',
      project_id: 'loopad-demo-shop',
      slot_id: 'main_hero',
      campaign_id: 'camp_fresh_01',
      creative_id: 'cr_fresh_A',
      variant: 'A',
    });
    expect(logFields).not.toHaveProperty('user_id');
    expect(logFields).not.toHaveProperty('session_id');
    expect(logFields).not.toHaveProperty('tracking_token');
  });
});
