import { Injectable } from '@nestjs/common';
import murmurhash3 from 'murmurhash3js';
import type { AdVariant } from '../types/ad-decision.types';

const HASH_SEED = 0;
const VARIANT_BUCKET_COUNT = 100;
const VARIANT_A_BUCKET_LIMIT = 50;

@Injectable()
export class AdVariantService {
  bucketFor(userId: string, campaignId: string): number {
    const input = `${userId}:${campaignId}`;
    const hash = murmurhash3.x86.hash32(input, HASH_SEED) >>> 0;

    return hash % VARIANT_BUCKET_COUNT;
  }

  selectVariant(userId: string, campaignId: string): AdVariant {
    return this.bucketFor(userId, campaignId) < VARIANT_A_BUCKET_LIMIT
      ? 'A'
      : 'B';
  }
}
