import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/app-config';

export type AppLogFields = Record<string, unknown>;
type AppLogLevel = 'info' | 'warn' | 'error';
const reservedLogFields = new Set([
  'timestamp',
  'level',
  'service',
  'env',
  'context',
  'message',
]);

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class AppLoggerService {
  private readonly logger = new Logger(AppLoggerService.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  info(context: string, message: string, fields: AppLogFields = {}): void {
    this.write('info', context, message, fields);
  }

  warn(context: string, message: string, fields: AppLogFields = {}): void {
    this.write('warn', context, message, fields);
  }

  error(context: string, message: string, fields: AppLogFields = {}): void {
    this.write('error', context, message, fields);
  }

  private write(
    level: AppLogLevel,
    context: string,
    message: string,
    fields: AppLogFields,
  ): void {
    const payload = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: this.config.serviceId,
      env: this.config.env,
      context,
      message,
      ...this.extraFields(fields),
    });

    if (level === 'info') {
      this.logger.log(payload);
      return;
    }

    if (level === 'warn') {
      this.logger.warn(payload);
      return;
    }

    this.logger.error(payload);
  }

  private extraFields(fields: AppLogFields): AppLogFields {
    return Object.fromEntries(
      Object.entries(fields).filter(([key]) => !reservedLogFields.has(key)),
    );
  }
}
