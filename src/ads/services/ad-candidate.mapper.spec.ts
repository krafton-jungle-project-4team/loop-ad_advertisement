import { AppLoggerService } from '../../logging/app-logger.service';
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
    creative_id: 'cr_fresh_A',
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
  let logger: jest.Mocked<AppLoggerService>;
  let mapper: AdCandidateMapper;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<AppLoggerService>;
    mapper = new AdCandidateMapper(logger);
  });

  it('maps common schema rows into candidate campaigns', () => {
    const result = mapper.toCandidatesBySlot(
      [
        row(),
        row({
          creative_id: 'cr_fresh_B',
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
      },
    ]);
  });

  it('defaults weight and converts a single age_group to age_groups', () => {
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
            priority: 5,
          },
          campaign_pk: '3',
          campaign_id: 'camp_digital_01',
          campaign_name: 'digital',
          creative_id: 'cr_digital_A',
          creative_headline: 'digital A',
          creative_image_url: 'https://placehold.co/400x400?text=digital-A',
          creative_target_url: '/category/digital',
        }),
      ],
      ['main_side_left'],
    );

    expect(result.get('main_side_left')?.[0]).toMatchObject({
      campaign_id: 'camp_digital_01',
      priority: 5,
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
          creative_id: 'cr_digital_A',
          variant: 'A',
        },
      ],
    });
  });

  it('excludes candidates without valid creatives', () => {
    const result = mapper.toCandidatesBySlot(
      [
        row({
          creative_payload_json: { variant: 'C' },
        }),
        row({
          creative_id: 'cr_fresh_B',
          creative_payload_json: { variant: 'B' },
          creative_image_url: null,
        }),
      ],
      ['main_hero'],
    );

    expect(result.get('main_hero')).toEqual([]);
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

  it('skips invalid candidate rows and logs a warning summary', () => {
    const result = mapper.toCandidatesBySlot(
      [
        row({
          mapping_id: 'missing-campaign',
          campaign_id: null,
        }),
        row({
          mapping_id: 'missing-priority',
          execution_hint_json: {
            slot_id: 'main_hero',
            weight: 100,
          },
        }),
        row({
          mapping_id: 'missing-creative',
          creative_id: null,
        }),
      ],
      ['main_hero'],
    );
    const warningFields = logger.warn.mock.calls.at(-1)?.[2] as Record<
      string,
      unknown
    >;

    expect(result.get('main_hero')).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      AdCandidateMapper.name,
      'skipped invalid ad candidate rows',
      expect.any(Object),
    );
    expect(warningFields).toMatchObject({
      skipped: {
        missing_external_campaign_id: {
          count: 1,
          sample_mapping_ids: ['missing-campaign'],
        },
        missing_priority: {
          count: 1,
          sample_mapping_ids: ['missing-priority'],
        },
        missing_external_creative_id: {
          count: 1,
          sample_mapping_ids: ['missing-creative'],
        },
        no_valid_creative: {
          count: 1,
          sample_mapping_ids: ['missing-creative'],
        },
      },
    });
  });
});
