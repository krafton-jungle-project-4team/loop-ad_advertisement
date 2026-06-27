import { AdCandidateMapper } from './ad-candidate.mapper';
import { AdCandidateService } from './ad-candidate.service';
import type { AdCacheService } from '../../redis/ad-cache.service';
import type {
  AdCandidateRepository,
  AdCandidateRow,
} from '../repositories/ad-candidate.repository';
import type { CandidateCampaign } from '../types/ad-decision.types';

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

const petCandidate: CandidateCampaign = {
  campaign_id: 'camp_pet_01',
  name: 'pet',
  priority: 8,
  status: 'active',
  target: {
    category: 'pet',
    age_groups: ['20s', '30s'],
    gender: null,
  },
  placement: {
    slot_id: 'main_hero',
    weight: 100,
  },
  creatives: [
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
  ],
};

const candidateRows = [{ mapping_id: '2' }] as AdCandidateRow[];
const loadedCandidates = new Map([['main_hero', [petCandidate]]]) as Map<
  CandidateCampaign['placement']['slot_id'],
  CandidateCampaign[]
>;

function createService(cacheResult: Map<string, CandidateCampaign[]> | Error) {
  const adCacheService = {
    getCandidates:
      cacheResult instanceof Error
        ? jest.fn().mockRejectedValue(cacheResult)
        : jest.fn().mockResolvedValue(cacheResult),
    setCandidates: jest.fn().mockResolvedValue(undefined),
  } as unknown as AdCacheService;
  const adCandidateRepository = {
    findActiveRowsByProjectAndSlots: jest.fn().mockResolvedValue(candidateRows),
  } as unknown as AdCandidateRepository;
  const adCandidateMapper = {
    toCandidatesBySlot: jest.fn().mockReturnValue(loadedCandidates),
  } as unknown as AdCandidateMapper;

  return {
    service: new AdCandidateService(
      adCacheService,
      adCandidateRepository,
      adCandidateMapper,
    ),
    adCacheService,
    adCandidateRepository,
    adCandidateMapper,
  };
}

describe('AdCandidateService', () => {
  it('uses Redis hit path without querying Postgres', async () => {
    const cached = new Map<string, CandidateCampaign[]>([
      ['main_hero', [freshCandidate]],
    ]);
    const { service, adCandidateRepository, adCandidateMapper } =
      createService(cached);

    const result = await service.getCandidatesBySlots('loopad-demo-shop', [
      'main_hero',
    ]);

    expect(result.get('main_hero')).toEqual([freshCandidate]);
    expect(
      adCandidateRepository.findActiveRowsByProjectAndSlots,
    ).not.toHaveBeenCalled();
    expect(adCandidateMapper.toCandidatesBySlot).not.toHaveBeenCalled();
  });

  it('loads misses from Postgres and backfills Redis', async () => {
    const { service, adCacheService, adCandidateRepository, adCandidateMapper } =
      createService(new Map());

    const result = await service.getCandidatesBySlots('loopad-demo-shop', [
      'main_hero',
    ]);

    expect(
      adCandidateRepository.findActiveRowsByProjectAndSlots,
    ).toHaveBeenCalledWith('loopad-demo-shop', ['main_hero']);
    expect(adCandidateMapper.toCandidatesBySlot).toHaveBeenCalledWith(
      candidateRows,
      ['main_hero'],
    );
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
    const { service, adCandidateRepository } = createService(cached);

    const result = await service.getCandidatesBySlots('loopad-demo-shop', [
      'main_side_left',
      'main_hero',
    ]);

    expect(result.get('main_side_left')).toEqual([freshCandidate]);
    expect(
      adCandidateRepository.findActiveRowsByProjectAndSlots,
    ).toHaveBeenCalledWith('loopad-demo-shop', ['main_hero']);
    expect(result.get('main_hero')?.[0]?.campaign_id).toBe('camp_pet_01');
  });

  it('falls back to Postgres when Redis is unavailable', async () => {
    const { service, adCandidateRepository } = createService(
      new Error('redis down'),
    );

    const result = await service.getCandidatesBySlots('loopad-demo-shop', [
      'main_hero',
    ]);

    expect(
      adCandidateRepository.findActiveRowsByProjectAndSlots,
    ).toHaveBeenCalledWith('loopad-demo-shop', ['main_hero']);
    expect(result.get('main_hero')?.[0]?.campaign_id).toBe('camp_pet_01');
  });
});
