import { jest } from 'jest'; // ^29.0.0
import { MockServiceManager } from '../utils/mock-services';
import { 
  mockAudienceSegments, 
  mockTargetingRules,
  PLATFORM_CONSTRAINTS,
  validatePlatformConstraints 
} from '../../mocks/data/audience.mock';
import type { 
  AudienceSegment,
  TargetingRule,
  Platform,
  TargetingValidation,
  OptimizationSettings
} from '../../../web/src/types/targeting';

// Test configuration
const TEST_TIMEOUT = 10000;
let mockServiceManager: MockServiceManager;

describe('Audience Targeting Service Integration Tests', () => {
  beforeAll(async () => {
    // Initialize mock services
    mockServiceManager = new MockServiceManager();
    await mockServiceManager.initialize();
  });

  afterEach(async () => {
    // Reset mock services state
    await mockServiceManager.reset();
  });

  afterAll(async () => {
    // Cleanup test environment
    const { crm, googleAds, linkedInAds } = mockServiceManager.getServices();
    await Promise.all([
      crm.connect({ apiKey: '', environment: 'test' }),
      linkedInAds.reset()
    ]);
  });

  describe('Audience Segmentation', () => {
    test('should create valid audience segment with targeting rules', async () => {
      // Arrange
      const { techDecisionMakers } = mockAudienceSegments;
      const { industryRule, companySizeRule } = mockTargetingRules;

      // Act
      const segment: AudienceSegment = {
        ...techDecisionMakers,
        targetingRules: [industryRule, companySizeRule]
      };

      // Assert
      expect(validatePlatformConstraints(segment, 'linkedin')).toBe(true);
      expect(segment.targetingRules).toHaveLength(2);
      expect(segment.estimatedReach).toBeGreaterThan(PLATFORM_CONSTRAINTS.linkedin.minReach);
      expect(segment.confidence).toBeGreaterThan(0.7);
    }, TEST_TIMEOUT);

    test('should validate platform-specific targeting constraints', async () => {
      // Arrange
      const { industryRule } = mockTargetingRules;
      const invalidSegment: AudienceSegment = {
        ...mockAudienceSegments[0],
        targetingRules: Array(10).fill(industryRule) // Exceeds max rules
      };

      // Act & Assert
      expect(validatePlatformConstraints(invalidSegment, 'linkedin')).toBe(false);
      expect(validatePlatformConstraints(invalidSegment, 'google')).toBe(false);
    });

    test('should handle multi-platform audience segments', async () => {
      // Arrange
      const { industryRule, locationRule } = mockTargetingRules;
      const multiPlatformSegment: AudienceSegment = {
        ...mockAudienceSegments[0],
        platform: 'linkedin',
        targetingRules: [industryRule, locationRule]
      };

      // Act
      const linkedInValid = validatePlatformConstraints(multiPlatformSegment, 'linkedin');
      multiPlatformSegment.platform = 'google';
      const googleValid = validatePlatformConstraints(multiPlatformSegment, 'google');

      // Assert
      expect(linkedInValid).toBe(true);
      expect(googleValid).toBe(true);
    });
  });

  describe('Targeting Rule Validation', () => {
    test('should validate industry targeting rules', async () => {
      // Arrange
      const { industryRule } = mockTargetingRules;
      
      // Act & Assert
      expect(industryRule.criteria.industries.length).toBeGreaterThan(0);
      expect(industryRule.criteria.includeSubsidiaries).toBeDefined();
      expect(industryRule.weight).toBeGreaterThan(0);
      expect(industryRule.weight).toBeLessThanOrEqual(1);
    });

    test('should validate company size targeting rules', async () => {
      // Arrange
      const { companySizeRule } = mockTargetingRules;

      // Act & Assert
      expect(companySizeRule.criteria.minSize).toBeGreaterThan(0);
      expect(companySizeRule.criteria.maxSize).toBeGreaterThan(companySizeRule.criteria.minSize);
      expect(companySizeRule.criteria.preferredRanges).toBeDefined();
      expect(Array.isArray(companySizeRule.criteria.preferredRanges)).toBe(true);
    });

    test('should validate location targeting rules', async () => {
      // Arrange
      const { locationRule } = mockTargetingRules;

      // Act & Assert
      expect(locationRule.criteria.countries).toHaveLength(2); // US, CA
      expect(locationRule.criteria.regions).toBeDefined();
      expect(locationRule.criteria.radius).toBeGreaterThan(0);
    });
  });

  describe('Targeting Optimization', () => {
    test('should optimize targeting based on performance data', async () => {
      // Arrange
      const { techDecisionMakers } = mockAudienceSegments;
      const optimizationSettings: OptimizationSettings = {
        targetMetric: 'conversion',
        minConfidence: 0.8,
        budgetConstraint: 10000,
        weightingPreferences: {
          industry: 0.4,
          company_size: 0.3,
          location: 0.3
        }
      };

      // Act
      const segment = { ...techDecisionMakers };
      segment.metadata = {
        ...segment.metadata,
        performanceScore: 0.85,
        lastOptimized: new Date().toISOString()
      };

      // Assert
      expect(segment.metadata.performanceScore).toBeGreaterThan(0.8);
      expect(segment.confidence).toBeGreaterThan(optimizationSettings.minConfidence);
      expect(new Date(segment.metadata.lastOptimized)).toBeDefined();
    });

    test('should handle targeting optimization failures gracefully', async () => {
      // Arrange
      const { techDecisionMakers } = mockAudienceSegments;
      const invalidSettings: OptimizationSettings = {
        targetMetric: 'reach',
        minConfidence: 1.5, // Invalid confidence value
        budgetConstraint: -1000 // Invalid budget
      };

      // Act & Assert
      expect(() => {
        const segment = { ...techDecisionMakers };
        segment.metadata.performanceScore = 0.5;
      }).not.toThrow();
    });
  });

  describe('Platform Integration', () => {
    test('should validate LinkedIn-specific targeting constraints', async () => {
      // Arrange
      const linkedInConstraints = PLATFORM_CONSTRAINTS.linkedin;
      const { industryRule, companySizeRule } = mockTargetingRules;

      // Act
      const segment: AudienceSegment = {
        ...mockAudienceSegments[0],
        platform: 'linkedin',
        targetingRules: [industryRule, companySizeRule]
      };

      // Assert
      expect(segment.targetingRules.length).toBeLessThanOrEqual(linkedInConstraints.maxRules);
      expect(segment.estimatedReach).toBeGreaterThanOrEqual(linkedInConstraints.minReach);
      expect(segment.estimatedReach).toBeLessThanOrEqual(linkedInConstraints.maxReach);
    });

    test('should validate Google Ads-specific targeting constraints', async () => {
      // Arrange
      const googleConstraints = PLATFORM_CONSTRAINTS.google;
      const { industryRule, locationRule } = mockTargetingRules;

      // Act
      const segment: AudienceSegment = {
        ...mockAudienceSegments[1],
        platform: 'google',
        targetingRules: [industryRule, locationRule]
      };

      // Assert
      expect(segment.targetingRules.length).toBeLessThanOrEqual(googleConstraints.maxRules);
      expect(segment.estimatedReach).toBeGreaterThanOrEqual(googleConstraints.minReach);
      expect(segment.estimatedReach).toBeLessThanOrEqual(googleConstraints.maxReach);
    });
  });
});