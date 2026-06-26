import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { APP_CONFIG, type AppConfig } from '../../config/app-config';
import type { TrackingTokenPayload } from '../types/ad-decision.types';

@Injectable()
export class AdTokenService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  sign(payload: TrackingTokenPayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    const signature = this.signatureFor(encodedPayload);

    return `${encodedPayload}.${signature}`;
  }

  verify(token: string): TrackingTokenPayload {
    const [encodedPayload, signature, extra] = token.split('.');

    if (!encodedPayload || !signature || extra !== undefined) {
      throw new UnauthorizedException('Invalid tracking token');
    }

    const expectedSignature = this.signatureFor(encodedPayload);

    if (!this.safeEquals(signature, expectedSignature)) {
      throw new UnauthorizedException('Invalid tracking token signature');
    }

    try {
      return JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as TrackingTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid tracking token payload');
    }
  }

  private signatureFor(encodedPayload: string): string {
    return createHmac('sha256', this.secret())
      .update(encodedPayload)
      .digest('base64url');
  }

  private secret(): string {
    return this.config.hmacSecret;
  }

  private safeEquals(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }
}
