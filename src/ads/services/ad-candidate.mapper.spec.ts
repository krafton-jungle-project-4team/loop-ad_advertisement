import { AdCandidateMapper } from './ad-candidate.mapper';
import type { AdCandidateRow } from '../repositories/ad-candidate.repository';

function row(overrides: Partial<AdCandidateRow> = {}): AdCandidateRow {
  return {
    mapping_id: '1',
    segment_json: {
      category: 'fresh_food',
      age_groups: ['30s', '40s'],
      gender: null,
    },
    execution_hint_json: {
      slot_id: 'main_hero',
      priority: 10,
      weight: 100,
    },
    campaign_pk: '100',
    campaign_id: 'camp_fresh_01',
    campaign_name: 'fresh',
    campaign_status: 'active',
    creative_id: '1',
    creative_payload_json: {
      variant: 'A',
    },
    creative_headline: 'fresh A',
    creative_image_url: 'https://placehold.co/800x400?text=fresh-A',
    creative_target_url: '/category/fresh_food',
    ...overrides,
  };
}

describe('AdCandidateMapper', () => {
  const mapper = new AdCandidateMapper();

  it('maps common schema rows into candidate campaigns', () => {
    const result = mapper.toCandidatesBySlot(
      [
        row(),
        row({
          creative_id: '2',
          creative_payload_json: { variant: 'B' },
          creative_headline: 'fresh B',
          creative_image_url: 'https://placehold.co/800x400?text=fresh-B',
        }),
      ],
      ['main_hero'],
    );

    expect(result.get('main_hero')).toEqual([
      {
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
            creative_id: '1',
            campaign_id: 'camp_fresh_01',
            variant: 'A',
            headline: 'fresh A',
            image_url: 'https://placehold.co/800x400?text=fresh-A',
            target_url: '/category/fresh_food',
          },
          {
            creative_id: '2',
            campaign_id: 'camp_fresh_01',
            variant: 'B',
            headline: 'fresh B',
            image_url: 'https://placehold.co/800x400?text=fresh-B',
            target_url: '/category/fresh_food',
          },
        ],
      },
    ]);
  });

  it('uses common schema defaults and converts a single age_group to age_groups', () => {
    const result = mapper.toCandidatesBySlot(
      [
        row({
          mapping_id: '2',
          segment_json: {
            category: 'digital',
            age_group: '20s',
          },
          execution_hint_json: {
            slot_id: 'main_side_left',
          },
          campaign_pk: '3',
          campaign_id: '3',
          campaign_name: 'digital',
          creative_id: '5',
          creative_headline: 'digital A',
          creative_image_url: 'https://placehold.co/400x400?text=digital-A',
          creative_target_url: '/category/digital',
        }),
      ],
      ['main_side_left'],
    );

    expect(result.get('main_side_left')?.[0]).toMatchObject({
      campaign_id: '3',
      priority: 0,
      target: {
        category: 'digital',
        age_groups: ['20s'],
        gender: null,
      },
      placement: {
        slot_id: 'main_side_left',
        weight: 100,
      },
      creatives: [
        {
          creative_id: '5',
          variant: 'A',
        },
      ],
    });
  });

  it('excludes invalid creatives while keeping the mapped candidate', () => {
    const result = mapper.toCandidatesBySlot(
      [
        row({
          creative_payload_json: { variant: 'C' },
        }),
        row({
          creative_id: '2',
          creative_payload_json: { variant: 'B' },
          creative_image_url: null,
        }),
      ],
      ['main_hero'],
    );

    expect(result.get('main_hero')).toHaveLength(1);
    expect(result.get('main_hero')?.[0]?.creatives).toEqual([]);
  });

  it('skips rows without a supported main page slot', () => {
    const result = mapper.toCandidatesBySlot(
      [
        row({
          execution_hint_json: {
            slot_id: 'detail_page',
            priority: 10,
            weight: 100,
          },
        }),
      ],
      ['main_hero'],
    );

    expect(result.get('main_hero')).toEqual([]);
  });
});
