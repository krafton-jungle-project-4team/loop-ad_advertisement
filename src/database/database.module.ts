import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { PG_POOL } from './database.constants';

@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new Pool({
          host: config.postgres.host,
          port: config.postgres.port,
          user: config.postgres.username,
          password: config.postgres.password,
          database: config.postgres.database,
        }),
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule {}
