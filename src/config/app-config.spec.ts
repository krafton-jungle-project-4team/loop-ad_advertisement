import { loadAppConfig } from './app-config';

const validEnv = {
  LOOPAD_ENV: 'local',
  LOOPAD_SERVICE_ID: 'advertisement-api',
  PORT: '8080',
  LOOPAD_AURORA_HOST: '127.0.0.1',
  LOOPAD_AURORA_PORT: '55432',
  LOOPAD_AURORA_DATABASE: 'loopad_ad_decision',
  LOOPAD_AURORA_USERNAME: 'loopad',
  LOOPAD_AURORA_PASSWORD: 'loopad',
  LOOPAD_REDIS_URL: 'redis://127.0.0.1:6379',
  HMAC_SECRET: 'test-secret',
};

describe('loadAppConfig', () => {
  it('loads the explicit LOOPAD server env contract', () => {
    expect(loadAppConfig(validEnv)).toMatchObject({
      env: 'local',
      serviceId: 'advertisement-api',
      port: 8080,
      postgres: {
        host: '127.0.0.1',
        port: 55432,
        database: 'loopad_ad_decision',
        username: 'loopad',
      },
      redis: {
        url: 'redis://127.0.0.1:6379',
      },
    });
  });

  it('fails fast when required env is missing', () => {
    const env = { ...validEnv, PORT: undefined };

    expect(() => loadAppConfig(env)).toThrow('PORT is required');
  });

  it('rejects local Redis URLs outside local env', () => {
    expect(() =>
      loadAppConfig({
        ...validEnv,
        LOOPAD_ENV: 'dev',
        LOOPAD_REDIS_URL: 'redis://127.0.0.1:6379',
      }),
    ).toThrow('LOOPAD_REDIS_URL must use rediss:// outside local');
  });

  it('accepts rediss Redis URLs outside local env', () => {
    expect(
      loadAppConfig({
        ...validEnv,
        LOOPAD_ENV: 'dev',
        LOOPAD_REDIS_URL: 'rediss://cache.dev.loop-ad.org:6379',
      }).redis.url,
    ).toBe('rediss://cache.dev.loop-ad.org:6379');
  });
});
