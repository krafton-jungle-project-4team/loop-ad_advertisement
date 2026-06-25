import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType | null = null;

  async onModuleInit(): Promise<void> {
    const url = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
    const client = createClient({ url });

    client.on('error', (error) => {
      this.logger.warn(`Redis client error: ${(error as Error).message}`);
    });

    try {
      await client.connect();
      this.client = client as RedisClientType;
    } catch (error) {
      this.logger.warn(`Redis connection failed: ${(error as Error).message}`);
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
