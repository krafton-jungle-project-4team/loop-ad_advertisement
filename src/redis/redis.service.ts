import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import {
  AppLoggerService,
  errorMessage,
} from '../logging/app-logger.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly logger: AppLoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    const client = createClient({ url: this.config.redis.url });

    client.on('error', (error) => {
      this.logger.warn(RedisService.name, 'redis client error', {
        error_message: errorMessage(error),
      });
    });

    try {
      await client.connect();
      this.client = client as RedisClientType;
    } catch (error) {
      this.logger.warn(RedisService.name, 'redis connection failed', {
        error_message: errorMessage(error),
      });
      this.client = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit();
    }
  }

  async mGet(keys: string[]): Promise<Array<string | null>> {
    const client = this.connectedClient();
    return client.mGet(keys);
  }

  async setEx(key: string, ttlSeconds: number, value: string): Promise<void> {
    const client = this.connectedClient();
    await client.setEx(key, ttlSeconds, value);
  }

  private connectedClient(): RedisClientType {
    if (!this.client?.isOpen) {
      throw new Error('Redis is unavailable');
    }

    return this.client;
  }
}
