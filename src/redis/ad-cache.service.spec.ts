import { AdCacheService } from './ad-cache.service';
import type { RedisService } from './redis.service';
import type { CandidateCampaign } from '../ads/types/ad-decision.types';

const candidate: CandidateCampaign = {
  campaign_id: 'camp_fresh_01',
  name: 'fresh',
  priority: 10,
  status: 'active',
  target: {
    category: 'fresh_food',
    age_groups: ['30s', '40s'],
    gender: null,
  },
  placement: {
    slot_id: 'main_hero',
    weight: 100,
  },
  creatives: [
    {
      creative_id: 'cr_fresh_A',
      campaign_id: 'camp_fresh_01',
      variant: 'A',
      headline: 'fresh A',
      image_url: 'https://placehold.co/800x400?text=fresh-A',
      target_url: '/category/fresh_food',
    },
    {
      creative_id: 'cr_fresh_B',
      campaign_id: 'camp_fresh_01',
      variant: 'B',
      headline: 'fresh B',
      image_url: 'https://placehold.co/800x400?text=fresh-B',
      target_url: '/category/fresh_food',
    },
  ],
};

describe('AdCacheService', () => {
  it('generates tenant slot candidate keys and uses MGET for multiple slots', async () => {
    const redisService = {
      mGet: jest.fn().mockResolvedValue([JSON.stringify([candidate]), null]),
      setEx: jest.fn(),
    } as unknown as RedisService;
    const service = new AdCacheService(redisService);

    const result = await service.getCandidates('loopad-demo-shop', [
      'main_hero',
      'main_side_left',
    ]);

    expect(redisService.mGet).toHaveBeenCalledWith([
      'tenant:loopad-demo-shop:slot:main_hero:candidates',
      'tenant:loopad-demo-shop:slot:main_side_left:candidates',
    ]);
    expect(result.get('main_hero')).toEqual([candidate]);
    expect(result.has('main_side_left')).toBe(false);
  });

  it('writes candidate cache with a 60 second TTL', async () => {
    const redisService = {
      mGet: jest.fn(),
      setEx: jest.fn().mockResolvedValue(undefined),
    } as unknown as RedisService;
    const service = new AdCacheService(redisService);

    await service.setCandidates('loopad-demo-shop', 'main_hero', [candidate]);

    expect(redisService.setEx).toHaveBeenCalledWith(
      'tenant:loopad-demo-shop:slot:main_hero:candidates',
      60,
      JSON.stringify([candidate]),
    );
    expect(service.ttlSeconds()).toBe(60);
  });

  it('reads and writes MVP segment cache keys', async () => {
    const redisService = {
      mGet: jest.fn().mockResolvedValue(['seg_30m_mobile_fresh']),
      setEx: jest.fn().mockResolvedValue(undefined),
    } as unknown as RedisService;
    const service = new AdCacheService(redisService);

    await expect(
      service.getSegment('demo_project', 'user_001'),
    ).resolves.toBe('seg_30m_mobile_fresh');
    await service.setSegment(
      'demo_project',
      'user_001',
      'seg_30m_mobile_fresh',
    );

    expect(redisService.mGet).toHaveBeenCalledWith([
      'seg:demo_project:user_001',
    ]);
    expect(redisService.setEx).toHaveBeenCalledWith(
      'seg:demo_project:user_001',
      60,
      'seg_30m_mobile_fresh',
    );
    expect(service.segmentTtlSeconds()).toBe(60);
  });
});
