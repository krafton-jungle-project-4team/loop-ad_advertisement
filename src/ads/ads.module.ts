import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { AdDecisionController } from './controllers/ad-decision.controller';
import { AdDecisionRepository } from './repositories/ad-decision.repository';
import { ExperimentActionProbRepository } from './repositories/experiment-action-prob.repository';
import { ExperimentRepository } from './repositories/experiment.repository';
import { GeneratedContentRepository } from './repositories/generated-content.repository';
import { SegmentRepository } from './repositories/segment.repository';
import { UserProfileRepository } from './repositories/user-profile.repository';
import { AdActionSelectorService } from './services/ad-action-selector.service';
import { AdContentService } from './services/ad-content.service';
import { AdDecisionService } from './services/ad-decision.service';
import { AdExperimentService } from './services/ad-experiment.service';
import { AdSegmentService } from './services/ad-segment.service';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [AdDecisionController],
  providers: [
    UserProfileRepository,
    SegmentRepository,
    ExperimentRepository,
    ExperimentActionProbRepository,
    GeneratedContentRepository,
    AdDecisionRepository,
    AdSegmentService,
    AdExperimentService,
    AdActionSelectorService,
    AdContentService,
    AdDecisionService,
  ],
  exports: [AdDecisionService],
})
export class AdsModule {}
