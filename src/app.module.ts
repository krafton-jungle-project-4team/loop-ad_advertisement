import { Module } from '@nestjs/common';
import { AdsModule } from './ads/ads.module';
import { ConfigModule } from './config/config.module';
import { HealthController } from './health.controller';

@Module({
  imports: [ConfigModule, AdsModule],
  controllers: [HealthController],
})
export class AppModule {}
