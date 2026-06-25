import { Injectable, Logger } from '@nestjs/common';
import type { AdEvent } from '../types/ad-decision.types';

export abstract class AdEventEmitter {
  abstract emit(event: AdEvent): void | Promise<void>;
}

@Injectable()
export class LoggingAdEventEmitterService implements AdEventEmitter {
  private readonly logger = new Logger(LoggingAdEventEmitterService.name);

  emit(event: AdEvent): void {
    this.logger.log(JSON.stringify(event));
  }
}
