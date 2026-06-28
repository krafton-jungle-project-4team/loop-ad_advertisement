import { Logger } from '@nestjs/common';
import type { AppConfig } from '../config/app-config';
import { AppLoggerService } from './app-logger.service';

const testConfig: AppConfig = {
  env: 'test',
  serviceId: 'advertisement-api',
  port: 8080,
  postgres: {
    host: '127.0.0.1',
    port: 55432,
    database: 'loopad_ad_decision',
    username: 'loopad',
    password: 'loopad',
  },
  redis: {
    url: 'redis://127.0.0.1:6379',
  },
};

describe('AppLoggerService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('writes info logs with the common structured fields', () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const service = new AppLoggerService(testConfig);

    service.info('TestContext', 'test message', {
      project_id: 'demo_project',
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(logSpy.mock.calls[0][0])) as Record<
      string,
      unknown
    >;

    expect(payload).toMatchObject({
      level: 'info',
      service: 'advertisement-api',
      env: 'test',
      context: 'TestContext',
      message: 'test message',
      project_id: 'demo_project',
    });
    expect(payload.timestamp).toEqual(expect.any(String));
  });

  it('does not allow extra fields to overwrite common log fields', () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const service = new AppLoggerService(testConfig);

    service.info('TestContext', 'test message', {
      level: 'error',
      service: 'other-service',
      env: 'prod',
      context: 'OtherContext',
      message: 'other message',
      project_id: 'demo_project',
    });

    const payload = JSON.parse(String(logSpy.mock.calls[0][0])) as Record<
      string,
      unknown
    >;

    expect(payload).toMatchObject({
      level: 'info',
      service: 'advertisement-api',
      env: 'test',
      context: 'TestContext',
      message: 'test message',
      project_id: 'demo_project',
    });
  });

  it('routes warn and error logs to the matching Nest logger methods', () => {
    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const service = new AppLoggerService(testConfig);

    service.warn('TestContext', 'warn message');
    service.error('TestContext', 'error message');

    const warnPayload = JSON.parse(String(warnSpy.mock.calls[0][0])) as Record<
      string,
      unknown
    >;
    const errorPayload = JSON.parse(String(errorSpy.mock.calls[0][0])) as Record<
      string,
      unknown
    >;

    expect(warnPayload).toMatchObject({
      level: 'warn',
      service: 'advertisement-api',
      env: 'test',
      context: 'TestContext',
      message: 'warn message',
    });
    expect(errorPayload).toMatchObject({
      level: 'error',
      service: 'advertisement-api',
      env: 'test',
      context: 'TestContext',
      message: 'error message',
    });
  });
});
