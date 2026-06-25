import { AdVariantService } from './ad-variant.service';

describe('AdVariantService', () => {
  const service = new AdVariantService();
  const campaignId = 'camp_fresh_01';

  it('matches the locked MurmurHash3 bucket and variant values', () => {
    const cases = [
      { userId: 'user_001', bucket: 44, variant: 'A' },
      { userId: 'user_002', bucket: 25, variant: 'A' },
      { userId: 'user_003', bucket: 65, variant: 'B' },
      { userId: 'user_004', bucket: 61, variant: 'B' },
      { userId: 'user_005', bucket: 45, variant: 'A' },
      { userId: 'user_006', bucket: 70, variant: 'B' },
      { userId: 'user_007', bucket: 6, variant: 'A' },
      { userId: 'user_008', bucket: 9, variant: 'A' },
    ] as const;

    for (const testCase of cases) {
      expect(service.bucketFor(testCase.userId, campaignId)).toBe(
        testCase.bucket,
      );
      expect(service.selectVariant(testCase.userId, campaignId)).toBe(
        testCase.variant,
      );
    }
  });

  it('is deterministic for the same user and campaign', () => {
    const variants = Array.from({ length: 20 }, () =>
      service.selectVariant('user_001', campaignId),
    );

    expect(new Set(variants)).toEqual(new Set(['A']));
  });

  it('keeps a roughly even split over a sample population', () => {
    const variants = Array.from({ length: 1000 }, (_, index) =>
      service.selectVariant(`user_${index}`, campaignId),
    );
    const aCount = variants.filter((variant) => variant === 'A').length;
    const bCount = variants.length - aCount;

    expect(aCount).toBeGreaterThanOrEqual(450);
    expect(aCount).toBeLessThanOrEqual(550);
    expect(bCount).toBeGreaterThanOrEqual(450);
    expect(bCount).toBeLessThanOrEqual(550);
  });
});
