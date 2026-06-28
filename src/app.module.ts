import { Module } from '@nestjs/common';
import { AdsModule } from './ads/ads.module';
import { ConfigModule } from './config/config.module';
import { HealthController } from './health.controller';
import { LoggingModule } from './logging/logging.module';

@Module({
  imports: [ConfigModule, LoggingModule, AdsModule],
  controllers: [HealthController],
})
export class AppModule {}
