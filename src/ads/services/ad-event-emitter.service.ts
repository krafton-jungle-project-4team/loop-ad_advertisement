import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import type { AdEvent } from '../types/ad-decision.types';

export abstract class AdEventEmitter {
  abstract emit(event: AdEvent): void | Promise<void>;
}

@Injectable()
export class LoggingAdEventEmitterService implements AdEventEmitter {
  private readonly logger = new Logger(LoggingAdEventEmitterService.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  emit(event: AdEvent): void {
    this.logger.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        service: this.config.serviceId,
        env: this.config.env,
        message: 'ad event emitted',
        event_type: event.event_type,
        project_id: event.project_id,
        slot_id: event.slot_id,
        campaign_id: event.campaign_id,
        creative_id: event.creative_id,
        variant: event.variant,
      }),
    );
  }
}
