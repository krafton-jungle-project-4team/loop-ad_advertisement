import { Injectable } from '@nestjs/common';
import { AppLoggerService } from '../../logging/app-logger.service';
import type { AdEvent } from '../types/ad-decision.types';

export abstract class AdEventEmitter {
  abstract emit(event: AdEvent): void | Promise<void>;
}

@Injectable()
export class LoggingAdEventEmitterService implements AdEventEmitter {
  constructor(private readonly logger: AppLoggerService) {}

  emit(event: AdEvent): void {
    this.logger.info(LoggingAdEventEmitterService.name, 'ad event emitted', {
      event_type: event.event_type,
      project_id: event.project_id,
      slot_id: event.slot_id,
      campaign_id: event.campaign_id,
      creative_id: event.creative_id,
      variant: event.variant,
    });
  }
}
