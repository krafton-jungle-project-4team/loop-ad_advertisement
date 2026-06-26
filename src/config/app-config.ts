export const APP_CONFIG = Symbol('APP_CONFIG');

const EXPECTED_SERVICE_ID = 'advertisement-api';
const LOCAL_ENV = 'local';

type Env = Record<string, string | undefined>;

export interface AppConfig {
  env: string;
  serviceId: string;
  runtime: string;
  port: number;
  postgres: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
  redis: {
    url: string;
  };
  hmacSecret: string;
}

export function loadAppConfig(env: Env = process.env): AppConfig {
  const loopadEnv = requiredEnv(env, 'LOOPAD_ENV');
  const serviceId = requiredEnv(env, 'LOOPAD_SERVICE_ID');
  const redisUrl = requiredUrl(env, 'LOOPAD_REDIS_URL', ['redis:', 'rediss:']);

  if (serviceId !== EXPECTED_SERVICE_ID) {
    throw new Error(`LOOPAD_SERVICE_ID must be ${EXPECTED_SERVICE_ID}`);
  }

  validateRedisProtocol(loopadEnv, redisUrl);

  return Object.freeze({
    env: loopadEnv,
    serviceId,
    runtime: requiredEnv(env, 'LOOPAD_RUNTIME'),
    port: requiredPort(env, 'PORT'),
    postgres: Object.freeze({
      host: requiredEnv(env, 'LOOPAD_AURORA_HOST'),
      port: requiredPort(env, 'LOOPAD_AURORA_PORT'),
      database: requiredEnv(env, 'LOOPAD_AURORA_DATABASE'),
      username: requiredEnv(env, 'LOOPAD_AURORA_USERNAME'),
      password: requiredEnv(env, 'LOOPAD_AURORA_PASSWORD'),
    }),
    redis: Object.freeze({
      url: redisUrl,
    }),
    hmacSecret: requiredEnv(env, 'HMAC_SECRET'),
  });
}

function requiredEnv(env: Env, name: string): string {
  const value = env[name];

  if (value == null || value.trim() === '') {
    throw new Error(`${name} is required`);
  }

  return value;
}

function requiredPort(env: Env, name: string): number {
  const value = requiredEnv(env, name);
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be a valid TCP port`);
  }

  return port;
}

function requiredUrl(
  env: Env,
  name: string,
  allowedProtocols: string[],
): string {
  const value = requiredEnv(env, name);

  try {
    const url = new URL(value);

    if (!allowedProtocols.includes(url.protocol)) {
      throw new Error();
    }
  } catch {
    throw new Error(`${name} must be a valid ${allowedProtocols.join(' or ')} URL`);
  }

  return value;
}

function validateRedisProtocol(env: string, redisUrl: string): void {
  if (env === LOCAL_ENV) {
    return;
  }

  const protocol = new URL(redisUrl).protocol;

  if (protocol !== 'rediss:') {
    throw new Error('LOOPAD_REDIS_URL must use rediss:// outside local');
  }
}
