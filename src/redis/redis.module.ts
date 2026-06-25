import { Module } from '@nestjs/common';
import { AdCacheService } from './ad-cache.service';
import { RedisService } from './redis.service';

@Module({
  providers: [RedisService, AdCacheService],
  exports: [RedisService, AdCacheService],
})
export class RedisModule {}
