import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { AdDecisionController } from './controllers/ad-decision.controller';
import { AdCandidateRepository } from './repositories/ad-candidate.repository';
import { AdCandidateMapper } from './services/ad-candidate.mapper';
import { AdCandidateService } from './services/ad-candidate.service';
import {
  AdEventEmitter,
  LoggingAdEventEmitterService,
} from './services/ad-event-emitter.service';
import { AdDecisionService } from './services/ad-decision.service';
import { AdTargetingService } from './services/ad-targeting.service';
import { AdVariantService } from './services/ad-variant.service';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [AdDecisionController],
  providers: [
    AdCandidateRepository,
    AdCandidateMapper,
    AdCandidateService,
    AdTargetingService,
    AdVariantService,
    AdDecisionService,
    {
      provide: AdEventEmitter,
      useClass: LoggingAdEventEmitterService,
    },
  ],
  exports: [AdDecisionService, AdVariantService],
})
export class AdsModule {}
