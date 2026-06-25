import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { connection, repoRoot, runPsql } from './schema-sync-utils.mjs';

const seedFile = resolve(repoRoot, 'database/seed.sql');
const sql = readFileSync(seedFile, 'utf8');
const status = runPsql(connection(), sql);

process.exit(status);
