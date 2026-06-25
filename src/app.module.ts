import { Module } from '@nestjs/common';
import { AdsModule } from './ads/ads.module';

@Module({
  imports: [AdsModule],
})
export class AppModule {}
