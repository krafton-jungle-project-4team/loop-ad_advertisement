import { AdCandidateService } from './ad-candidate.service';
import type { AdCacheService } from '../../redis/ad-cache.service';
import type { CampaignRecord } from '../repositories/campaign.repository';
import type { CampaignRepository } from '../repositories/campaign.repository';
import type { CreativeRepository } from '../repositories/creative.repository';
import type { PlacementRepository } from '../repositories/placement.repository';
import type {
  CandidateCampaign,
  Creative,
  Placement,
} from '../types/ad-decision.types';

const freshCandidate: CandidateCampaign = {
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

const placementRows: Placement[] = [
  {
    campaign_id: 'camp_pet_01',
    slot_id: 'main_hero',
    weight: 100,
  },
];
const campaignRows: CampaignRecord[] = [
  {
    campaign_id: 'camp_pet_01',
    name: 'pet',
    priority: 8,
    status: 'active',
    target: {
      category: 'pet',
      age_groups: ['20s', '30s'],
      gender: null,
    },
  },
];
const creativeRows: Creative[] = [
  {
    creative_id: 'cr_pet_A',
    campaign_id: 'camp_pet_01',
    variant: 'A',
    headline: 'pet A',
    image_url: 'https://placehold.co/800x400?text=pet-A',
    target_url: '/category/pet',
  },
  {
    creative_id: 'cr_pet_B',
    campaign_id: 'camp_pet_01',
    variant: 'B',
    headline: 'pet B',
    image_url: 'https://placehold.co/800x400?text=pet-B',
    target_url: '/category/pet',
  },
];

function createService(cacheResult: Map<string, CandidateCampaign[]> | Error) {
  const adCacheService = {
    getCandidates:
      cacheResult instanceof Error
        ? jest.fn().mockRejectedValue(cacheResult)
        : jest.fn().mockResolvedValue(cacheResult),
    setCandidates: jest.fn().mockResolvedValue(undefined),
  } as unknown as AdCacheService;
  const placementRepository = {
    findBySlots: jest.fn().mockResolvedValue(placementRows),
  } as unknown as PlacementRepository;
  const campaignRepository = {
    findActiveByIds: jest.fn().mockResolvedValue(campaignRows),
  } as unknown as CampaignRepository;
  const creativeRepository = {
    findByCampaignIds: jest.fn().mockResolvedValue(creativeRows),
  } as unknown as CreativeRepository;

  return {
    service: new AdCandidateService(
      adCacheService,
      placementRepository,
      campaignRepository,
      creativeRepository,
    ),
    adCacheService,
    placementRepository,
    campaignRepository,
    creativeRepository,
  };
}

describe('AdCandidateService', () => {
  it('uses Redis hit path without querying Postgres', async () => {
    const cached = new Map<string, CandidateCampaign[]>([
      ['main_hero', [freshCandidate]],
    ]);
    const { service, placementRepository, campaignRepository, creativeRepository } =
      createService(cached);

    const result = await service.getCandidatesBySlots('loopad-demo-shop', [
      'main_hero',
    ]);

    expect(result.get('main_hero')).toEqual([freshCandidate]);
    expect(placementRepository.findBySlots).not.toHaveBeenCalled();
    expect(campaignRepository.findActiveByIds).not.toHaveBeenCalled();
    expect(creativeRepository.findByCampaignIds).not.toHaveBeenCalled();
  });

  it('loads misses from Postgres and backfills Redis', async () => {
    const { service, adCacheService, placementRepository } = createService(
      new Map(),
    );

    const result = await service.getCandidatesBySlots('loopad-demo-shop', [
      'main_hero',
    ]);

    expect(placementRepository.findBySlots).toHaveBeenCalledWith(['main_hero']);
    expect(result.get('main_hero')?.[0]?.campaign_id).toBe('camp_pet_01');
    expect(adCacheService.setCandidates).toHaveBeenCalledWith(
      'loopad-demo-shop',
      'main_hero',
      result.get('main_hero'),
    );
  });

  it('supports partial hit and miss requests', async () => {
    const cached = new Map<string, CandidateCampaign[]>([
      ['main_side_left', [freshCandidate]],
    ]);
    const { service, placementRepository } = createService(cached);

    const result = await service.getCandidatesBySlots('loopad-demo-shop', [
      'main_side_left',
      'main_hero',
    ]);

    expect(result.get('main_side_left')).toEqual([freshCandidate]);
    expect(placementRepository.findBySlots).toHaveBeenCalledWith(['main_hero']);
    expect(result.get('main_hero')?.[0]?.campaign_id).toBe('camp_pet_01');
  });

  it('falls back to Postgres when Redis is unavailable', async () => {
    const { service, placementRepository } = createService(
      new Error('redis down'),
    );

    const result = await service.getCandidatesBySlots('loopad-demo-shop', [
      'main_hero',
    ]);

    expect(placementRepository.findBySlots).toHaveBeenCalledWith(['main_hero']);
    expect(result.get('main_hero')?.[0]?.campaign_id).toBe('camp_pet_01');
  });
});
