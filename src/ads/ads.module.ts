import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { AdClickController } from './controllers/ad-click.controller';
import { AdDecisionController } from './controllers/ad-decision.controller';
import { CampaignRepository } from './repositories/campaign.repository';
import { CreativeRepository } from './repositories/creative.repository';
import { PlacementRepository } from './repositories/placement.repository';
import { AdCandidateService } from './services/ad-candidate.service';
import { AdClickService } from './services/ad-click.service';
import {
  AdEventEmitter,
  LoggingAdEventEmitterService,
} from './services/ad-event-emitter.service';
import { AdDecisionService } from './services/ad-decision.service';
import { AdTargetingService } from './services/ad-targeting.service';
import { AdTokenService } from './services/ad-token.service';
import { AdVariantService } from './services/ad-variant.service';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [AdDecisionController, AdClickController],
  providers: [
    PlacementRepository,
    CampaignRepository,
    CreativeRepository,
    AdCandidateService,
    AdTargetingService,
    AdVariantService,
    AdTokenService,
    AdDecisionService,
    AdClickService,
    {
      provide: AdEventEmitter,
      useClass: LoggingAdEventEmitterService,
    },
  ],
  exports: [AdDecisionService, AdClickService, AdVariantService],
})
export class AdsModule {}
