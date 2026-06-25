import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './database.constants';

@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () =>
        new Pool({
          host: process.env.DATABASE_HOST ?? '127.0.0.1',
          port: Number(process.env.DATABASE_PORT ?? 55432),
          user: process.env.DATABASE_USER ?? 'loopad',
          password: process.env.DATABASE_PASSWORD ?? 'loopad',
          database: process.env.DATABASE_NAME ?? 'loopad_ad_decision',
        }),
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule {}
