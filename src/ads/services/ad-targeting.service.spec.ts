import { AdTargetingService } from './ad-targeting.service';
import type { CandidateCampaign } from '../types/ad-decision.types';

function candidate(target: CandidateCampaign['target']): CandidateCampaign {
  return {
    campaign_id: 'camp_test',
    name: 'test',
    priority: 1,
    status: 'active',
    target,
    placement: {
      slot_id: 'main_hero',
      weight: 100,
    },
    creatives: [],
  };
}

describe('AdTargetingService', () => {
  const service = new AdTargetingService();

  it('matches target conditions with AND logic and pass-through empty fields', () => {
    expect(
      service.matches(
        candidate({
          category: 'fresh_food',
          age_groups: ['30s', '40s'],
          gender: null,
        }),
        { category: 'fresh_food', age_group: '30s', gender: null },
      ),
    ).toBe(true);
  });

  it('rejects category and age mismatches', () => {
    const fresh30s = candidate({
      category: 'fresh_food',
      age_groups: ['30s', '40s'],
      gender: null,
    });

    expect(
      service.matches(fresh30s, {
        category: 'book',
        age_group: '30s',
        gender: null,
      }),
    ).toBe(false);
    expect(
      service.matches(fresh30s, {
        category: 'fresh_food',
        age_group: '20s',
        gender: null,
      }),
    ).toBe(false);
  });

  it('uses strict gender matching when target_gender exists', () => {
    const fashionFemale = candidate({
      category: 'fashion',
      age_groups: ['20s', '30s'],
      gender: 'female',
    });

    expect(
      service.matches(fashionFemale, {
        category: 'fashion',
        age_group: '20s',
        gender: 'female',
      }),
    ).toBe(true);
    expect(
      service.matches(fashionFemale, {
        category: 'fashion',
        age_group: '20s',
        gender: 'male',
      }),
    ).toBe(false);
    expect(
      service.matches(fashionFemale, {
        category: 'fashion',
        age_group: '20s',
        gender: null,
      }),
    ).toBe(false);
    expect(
      service.matches(fashionFemale, {
        category: 'fashion',
        age_group: '20s',
      }),
    ).toBe(false);
  });

  it('rejects fully empty personalized targets', () => {
    expect(
      service.matches(
        candidate({ category: null, age_groups: null, gender: null }),
        { category: 'fresh_food', age_group: '30s', gender: null },
      ),
    ).toBe(false);
  });
});
