import type { Pool } from 'pg';

export const PG_POOL = Symbol('PG_POOL');

export type PgPool = Pool;
