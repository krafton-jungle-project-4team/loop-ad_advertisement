import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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
    env: dockerProcessEnv(),
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

function dockerProcessEnv() {
  const env = { ...process.env };
  delete env.PGPASSWORD;

  return env;
}

function withDockerEnvFile(db, callback) {
  const tempDir = mkdtempSync(join(tmpdir(), 'loopad-schema-env-'));
  const envFile = join(tempDir, 'db.env');

  try {
    writeFileSync(
      envFile,
      [
        `PGPASSWORD=${db.password}`,
        `PGSSLMODE=${db.sslmode}`,
        '',
      ].join('\n'),
      { mode: 0o600 },
    );

    return callback(envFile);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export function runSqldef(db = connection(), flags = []) {
  const schema = readFileSync(schemaFile, 'utf8');

  return withDockerEnvFile(db, (envFile) => {
    const args = [
      'run',
      '--rm',
      '-i',
      '--env-file',
      envFile,
      '--add-host',
      dockerHostAlias,
      'sqldef/psqldef',
      '--host',
      db.host,
      '--port',
      db.port,
      '--user',
      db.user,
      ...flags,
      db.database,
    ];

    return runDocker(args, schema);
  });
}

export function runPsql(db = connection(), sql) {
  return withDockerEnvFile(db, (envFile) => {
    const args = [
      'run',
      '--rm',
      '-i',
      '--env-file',
      envFile,
      '--add-host',
      dockerHostAlias,
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
  });
}
