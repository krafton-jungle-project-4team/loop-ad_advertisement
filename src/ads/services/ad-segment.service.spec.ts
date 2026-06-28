import { AppLoggerService } from '../../logging/app-logger.service';
import { AdCacheService } from '../../redis/ad-cache.service';
import { SegmentRepository } from '../repositories/segment.repository';
import { UserProfileRepository } from '../repositories/user-profile.repository';
import { AdSegmentService } from './ad-segment.service';
import type {
  SegmentDefinition,
  UserProfile,
} from '../types/ad-decision.types';

const user001: UserProfile = {
  projectId: 'demo_project',
  userId: 'user_001',
  ageGroup: '30s',
  gender: 'male',
  device: 'mobile',
  favoriteCategory: 'fresh_food',
};

const defaultSegment: SegmentDefinition = {
  id: 'seg_default',
  projectId: 'demo_project',
  ageGroup: null,
  gender: null,
  device: null,
  category: null,
  isDefault: true,
};

const freshSegment: SegmentDefinition = {
  id: 'seg_30m_mobile_fresh',
  projectId: 'demo_project',
  ageGroup: '30s',
  gender: 'male',
  device: 'mobile',
  category: 'fresh_food',
  isDefault: false,
};

function createService(overrides: {
  cachedSegmentId?: string | null;
  cacheRejects?: Error;
  profile?: UserProfile | null;
  segments?: SegmentDefinition[];
  defaultSegment?: SegmentDefinition | null;
} = {}) {
  const adCacheService = {
    getSegment: jest.fn().mockImplementation(() => {
      if (overrides.cacheRejects) {
        return Promise.reject(overrides.cacheRejects);
      }

      return Promise.resolve(overrides.cachedSegmentId ?? null);
    }),
    setSegment: jest.fn().mockResolvedValue(undefined),
  } as unknown as AdCacheService;
  const userProfileRepository = {
    findByProjectAndUser: jest
      .fn()
      .mockResolvedValue(
        Object.prototype.hasOwnProperty.call(overrides, 'profile')
          ? overrides.profile
          : user001,
      ),
  } as unknown as UserProfileRepository;
  const segmentRepository = {
    findNonDefaultByProject: jest
      .fn()
      .mockResolvedValue(overrides.segments ?? [freshSegment]),
    findDefaultByProject: jest
      .fn()
      .mockResolvedValue(
        Object.prototype.hasOwnProperty.call(overrides, 'defaultSegment')
          ? overrides.defaultSegment
          : defaultSegment,
      ),
  } as unknown as SegmentRepository;
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as jest.Mocked<AppLoggerService>;

  return {
    service: new AdSegmentService(
      adCacheService,
      userProfileRepository,
      segmentRepository,
      logger,
    ),
    adCacheService,
    userProfileRepository,
    segmentRepository,
    logger,
  };
}

describe('AdSegmentService', () => {
  it('uses Redis segment hits without querying Postgres', async () => {
    const { service, userProfileRepository, segmentRepository } = createService({
      cachedSegmentId: 'seg_cached',
    });

    await expect(
      service.resolveSegment('demo_project', 'user_001'),
    ).resolves.toBe('seg_cached');
    expect(userProfileRepository.findByProjectAndUser).not.toHaveBeenCalled();
    expect(segmentRepository.findNonDefaultByProject).not.toHaveBeenCalled();
  });

  it('matches user_profiles to segment_definitions with AND equality and backfills Redis', async () => {
    const { service, adCacheService } = createService();

    await expect(
      service.resolveSegment('demo_project', 'user_001'),
    ).resolves.toBe('seg_30m_mobile_fresh');
    expect(adCacheService.setSegment).toHaveBeenCalledWith(
      'demo_project',
      'user_001',
      'seg_30m_mobile_fresh',
    );
  });

  it('uses the default segment when the user profile is missing', async () => {
    const { service } = createService({ profile: null });

    await expect(
      service.resolveSegment('demo_project', 'unknown_user'),
    ).resolves.toBe('seg_default');
  });

  it('falls back to Postgres when Redis lookup fails', async () => {
    const { service } = createService({
      cacheRejects: new Error('redis unavailable'),
    });

    await expect(
      service.resolveSegment('demo_project', 'user_001'),
    ).resolves.toBe('seg_30m_mobile_fresh');
  });
});
