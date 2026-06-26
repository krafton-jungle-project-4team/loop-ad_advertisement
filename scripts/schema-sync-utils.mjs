import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(scriptDir, '..');
export const schemaFile = resolve(repoRoot, 'database/schema.sql');

const dockerHostAlias = 'host.docker.internal:host-gateway';

function requiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function dockerHost(host) {
  if (host === '127.0.0.1' || host === 'localhost') {
    return 'host.docker.internal';
  }

  return host;
}

export function connection() {
  const host = requiredEnv('PGHOST');

  return {
    originalHost: host,
    host: dockerHost(host),
    port: requiredEnv('PGPORT'),
    user: requiredEnv('PGUSER'),
    password: requiredEnv('PGPASSWORD'),
    database: requiredEnv('PGDATABASE'),
    sslmode: requiredEnv('PGSSLMODE'),
  };
}

function runDocker(args, input) {
  const result = spawnSync('docker', args, {
    cwd: repoRoot,
    input,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

export function runSqldef(db = connection(), flags = []) {
  const schema = readFileSync(schemaFile, 'utf8');
  const args = [
    'run',
    '--rm',
    '-i',
    '--add-host',
    dockerHostAlias,
    'sqldef/psqldef',
    '--host',
    db.host,
    '--port',
    db.port,
    '--user',
    db.user,
    '--password',
    db.password,
    ...flags,
    db.database,
  ];

  return runDocker(args, schema);
}

export function runPsql(db = connection(), sql) {
  const args = [
    'run',
    '--rm',
    '-i',
    '--add-host',
    dockerHostAlias,
    '-e',
    `PGPASSWORD=${db.password}`,
    '-e',
    `PGSSLMODE=${db.sslmode}`,
    'postgres:16-alpine',
    'psql',
    '--set',
    'ON_ERROR_STOP=1',
    '--host',
    db.host,
    '--port',
    db.port,
    '--username',
    db.user,
    '--dbname',
    db.database,
  ];

  return runDocker(args, sql);
}
