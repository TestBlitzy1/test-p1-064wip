import { jest } from 'jest'; // ^29.0.0
import supertest from 'supertest'; // ^2.0.0
import { 
  setupIntegrationTest, 
  teardownIntegrationTest,
  IntegrationTestFixture,
  INTEGRATION_TEST_TIMEOUT
} from '../utils/test-helpers';
import { 
  mockAudienceSegments,
  generateMockAudienceSegment,
  validatePlatformConstraints,
  PLATFORM_CONSTRAINTS
} from '../../mocks/data/audience.mock';
import type { 
  AudienceSegment,
  TargetingRule,
  Platform,
  TargetingValidation,
  OptimizationSettings
} from '../../../web/src/types/targeting';
import type { ApiResponse } from '../../../web/src/types/api';

class SegmentationTestFixture extends IntegrationTestFixture {
  private _mockSegments: Map<string, AudienceSegment>;
  private _performanceData: Map<string, any>;
  private _validationRules: TargetingValidation;

  constructor() {
    super();
    this._mockSegments = new Map();
    this._performanceData = new Map();
    this._validationRules = {
      validateRule: jest.fn(),
      validateSegment: jest.fn(),
      validatePlatformCompliance: jest.fn()
    };
  }

  async setup(): Promise<void> {
    await super.setup();
    
    // Initialize mock data
    mockAudienceSegments.forEach(segment => {
      this._mockSegments.set(segment.id, segment);
    });

    // Setup validation rules
    this._validationRules.validatePlatformCompliance.mockImplementation(
      (segment: AudienceSegment, platform: Platform) => 
        validatePlatformConstraints(segment, platform)
    );
  }

  async teardown(): Promise<void> {
    this._mockSegments.clear();
    this._performanceData.clear();
    await super.teardown();
  }
}

describe('Audience Segmentation Integration Tests', () => {
  let fixture: SegmentationTestFixture;

  beforeAll(async () => {
    await setupIntegrationTest();
    fixture = new SegmentationTestFixture();
    await fixture.setup();
  });

  afterAll(async () => {
    await fixture.teardown();
    await teardownIntegrationTest();
  });

  describe('AI-Powered Segmentation', () => {
    test('should create new audience segment with AI-optimized targeting', async () => {
      // Prepare test data
      const baseSegment = generateMockAudienceSegment({
        platform: 'linkedin',
        name: 'Test AI Segment'
      });

      // Test segment creation
      const response = await supertest(process.env.API_URL)
        .post('/api/v1/audience/segments')
        .send(baseSegment)
        .expect(201);

      const result = response.body as ApiResponse<AudienceSegment>;
      
      // Validate response
      expect(result.data).toBeDefined();
      expect(result.data.id).toBeDefined();
      expect(result.data.targetingRules.length).toBeGreaterThan(0);
      expect(result.data.confidence).toBeGreaterThan(0.7);
      
      // Validate AI optimizations
      expect(result.data.metadata?.lastOptimized).toBeDefined();
      expect(result.data.metadata?.performanceScore).toBeGreaterThan(0);
    }, INTEGRATION_TEST_TIMEOUT);

    test('should optimize existing segment based on performance data', async () => {
      const segment = mockAudienceSegments[0];
      const optimizationSettings: OptimizationSettings = {
        targetMetric: 'conversion',
        minConfidence: 0.8,
        budgetConstraint: 10000
      };

      const response = await supertest(process.env.API_URL)
        .post(`/api/v1/audience/segments/${segment.id}/optimize`)
        .send(optimizationSettings)
        .expect(200);

      const result = response.body as ApiResponse<AudienceSegment>;

      // Validate optimization results
      expect(result.data.targetingRules).not.toEqual(segment.targetingRules);
      expect(result.data.confidence).toBeGreaterThan(segment.confidence);
      expect(result.data.metadata?.performanceScore).toBeGreaterThan(
        segment.metadata?.performanceScore || 0
      );
    }, INTEGRATION_TEST_TIMEOUT);
  });

  describe('Audience Size Validation', () => {
    test('should enforce platform-specific audience size thresholds', async () => {
      // Test LinkedIn constraints
      const linkedInSegment = generateMockAudienceSegment({
        platform: 'linkedin',
        estimatedReach: PLATFORM_CONSTRAINTS.linkedin.minReach - 100
      });

      const invalidResponse = await supertest(process.env.API_URL)
        .post('/api/v1/audience/segments')
        .send(linkedInSegment)
        .expect(400);

      expect(invalidResponse.body.message).toContain('minimum audience size');

      // Test valid audience size
      const validSegment = generateMockAudienceSegment({
        platform: 'linkedin',
        estimatedReach: PLATFORM_CONSTRAINTS.linkedin.minReach + 1000
      });

      const validResponse = await supertest(process.env.API_URL)
        .post('/api/v1/audience/segments')
        .send(validSegment)
        .expect(201);

      expect(validResponse.body.data.estimatedReach).toBeGreaterThanOrEqual(
        PLATFORM_CONSTRAINTS.linkedin.minReach
      );
    }, INTEGRATION_TEST_TIMEOUT);

    test('should validate targeting rule combinations', async () => {
      const segment = generateMockAudienceSegment({ platform: 'linkedin' });
      
      // Add excessive rules to trigger validation error
      for (let i = 0; i < PLATFORM_CONSTRAINTS.linkedin.maxRules + 1; i++) {
        segment.targetingRules.push({
          id: `rule-${i}`,
          ruleType: 'industry',
          operator: 'include',
          criteria: { industries: ['Technology'] },
          weight: 1,
          isActive: true
        });
      }

      const response = await supertest(process.env.API_URL)
        .post('/api/v1/audience/segments')
        .send(segment)
        .expect(400);

      expect(response.body.message).toContain('maximum number of targeting rules');
    }, INTEGRATION_TEST_TIMEOUT);
  });

  describe('Performance Optimization', () => {
    test('should optimize targeting rules based on historical performance', async () => {
      const segment = mockAudienceSegments[0];
      
      // Add mock performance data
      const performanceData = {
        impressions: 100000,
        clicks: 5000,
        conversions: 250,
        costPerConversion: 45.50
      };

      // Update segment with performance data
      await supertest(process.env.API_URL)
        .post(`/api/v1/audience/segments/${segment.id}/performance`)
        .send(performanceData)
        .expect(200);

      // Trigger optimization
      const response = await supertest(process.env.API_URL)
        .post(`/api/v1/audience/segments/${segment.id}/optimize`)
        .send({ targetMetric: 'conversion' })
        .expect(200);

      const optimizedSegment = response.body.data as AudienceSegment;

      // Validate optimizations
      expect(optimizedSegment.targetingRules).not.toEqual(segment.targetingRules);
      expect(optimizedSegment.metadata?.performanceScore).toBeGreaterThan(
        segment.metadata?.performanceScore || 0
      );
      expect(optimizedSegment.confidence).toBeGreaterThan(0.8);
    }, INTEGRATION_TEST_TIMEOUT);
  });
});