import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export const ALLOWED_CORS_ORIGINS = Object.freeze([
  'https://demo-shoppingmall.dev.loop-ad.org',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
]);

export function isAllowedCorsOrigin(origin: string | undefined): boolean {
  if (origin == null || origin === '') {
    return true;
  }

  return ALLOWED_CORS_ORIGINS.includes(origin);
}

export function createCorsOptions(): CorsOptions {
  return {
    origin: (origin, callback) => {
      callback(null, isAllowedCorsOrigin(origin));
    },
    methods: ['POST'],
    allowedHeaders: ['Content-Type'],
    credentials: false,
  };
}
