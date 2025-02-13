import { jest } from 'jest'; // ^29.0.0
import { ContentGenerator } from '../../../backend/ai_service/models/content_generator';
import { IntegrationTestFixture } from '../utils/test-helpers';
import { MockServiceManager } from '../utils/mock-services';

// Global test configuration
const TEST_TIMEOUT = 30000;

// Mock campaign context for testing
const MOCK_CAMPAIGN_CONTEXT = {
  industry: 'Technology',
  target_audience: 'B2B Decision Makers',
  product_type: 'SaaS',
  brand_voice: 'Professional',
  key_benefits: ['Automation', 'Efficiency', 'ROI'],
  platform_rules: {
    linkedin: {
      headline_max_length: 150,
      description_max_length: 300
    },
    google: {
      headline_max_length: 90,
      description_max_length: 180
    }
  }
};

class ContentGeneratorTestFixture extends IntegrationTestFixture {
  private contentGenerator: ContentGenerator;
  private mockServices: MockServiceManager;
  private metrics: {
    generationTimes: number[];
    validationTimes: number[];
    memoryUsage: number[];
  };

  constructor() {
    super();
    this.metrics = {
      generationTimes: [],
      validationTimes: [],
      memoryUsage: []
    };
  }

  async setup(): Promise<void> {
    await super.setup();
    
    // Initialize content generator with test configuration
    this.contentGenerator = new ContentGenerator({
      model_path: 'test_model',
      cache_config: { ttl: 300 },
      monitoring_config: { enable_metrics: true }
    });

    // Initialize mock services
    this.mockServices = new MockServiceManager();
    await this.mockServices.initialize();

    // Reset metrics
    this.metrics = {
      generationTimes: [],
      validationTimes: [],
      memoryUsage: []
    };
  }

  async teardown(): Promise<void> {
    const avgGenerationTime = this.metrics.generationTimes.reduce((a, b) => a + b, 0) / this.metrics.generationTimes.length;
    const avgValidationTime = this.metrics.validationTimes.reduce((a, b) => a + b, 0) / this.metrics.validationTimes.length;
    const maxMemoryUsage = Math.max(...this.metrics.memoryUsage);

    // Log performance metrics
    console.log('Performance Metrics:', {
      averageGenerationTime: `${avgGenerationTime}ms`,
      averageValidationTime: `${avgValidationTime}ms`,
      maxMemoryUsage: `${maxMemoryUsage}MB`
    });

    await this.mockServices.reset();
    await super.teardown();
  }
}

describe('ContentGenerator Integration Tests', () => {
  let fixture: ContentGeneratorTestFixture;

  beforeEach(async () => {
    fixture = new ContentGeneratorTestFixture();
    await fixture.setup();
  });

  afterEach(async () => {
    await fixture.teardown();
  });

  describe('Ad Copy Generation', () => {
    test('should generate multiple ad copy variations with brand voice consistency', async () => {
      const startTime = Date.now();
      const variations = await fixture.contentGenerator.generate_ad_copies(
        'linkedin',
        MOCK_CAMPAIGN_CONTEXT,
        10
      );

      // Record metrics
      fixture.metrics.generationTimes.push(Date.now() - startTime);
      fixture.metrics.memoryUsage.push(process.memoryUsage().heapUsed / 1024 / 1024);

      // Verify minimum variations generated
      expect(variations.length).toBeGreaterThanOrEqual(10);

      // Verify each variation structure and content
      variations.forEach(variation => {
        expect(variation).toHaveProperty('content');
        expect(variation).toHaveProperty('metadata');
        expect(variation.metadata).toHaveProperty('brand_consistency_score');
        expect(variation.metadata.brand_consistency_score).toBeGreaterThanOrEqual(0.8);
      });

      // Verify variations are unique
      const uniqueContents = new Set(variations.map(v => v.content));
      expect(uniqueContents.size).toBe(variations.length);
    }, TEST_TIMEOUT);

    test('should handle generation with different platform requirements', async () => {
      const platforms = ['linkedin', 'google'];
      
      for (const platform of platforms) {
        const variations = await fixture.contentGenerator.generate_ad_copies(
          platform,
          MOCK_CAMPAIGN_CONTEXT,
          5
        );

        variations.forEach(variation => {
          const maxLength = MOCK_CAMPAIGN_CONTEXT.platform_rules[platform].description_max_length;
          expect(variation.content.length).toBeLessThanOrEqual(maxLength);
        });
      }
    }, TEST_TIMEOUT);
  });

  describe('Platform Compliance', () => {
    test('should validate ad copies against platform-specific rules', async () => {
      const startTime = Date.now();
      const testCopy = 'Test ad copy for validation';

      const validationResult = await fixture.contentGenerator.validate_copy(
        testCopy,
        'linkedin',
        MOCK_CAMPAIGN_CONTEXT
      );

      // Record metrics
      fixture.metrics.validationTimes.push(Date.now() - startTime);

      expect(validationResult).toHaveProperty('isValid');
      expect(validationResult).toHaveProperty('errors');
      expect(validationResult).toHaveProperty('warnings');
    });

    test('should enforce character limits for different platforms', async () => {
      const platforms = ['linkedin', 'google'];
      
      for (const platform of platforms) {
        const maxLength = MOCK_CAMPAIGN_CONTEXT.platform_rules[platform].description_max_length;
        const oversizedCopy = 'A'.repeat(maxLength + 1);

        const validationResult = await fixture.contentGenerator.validate_copy(
          oversizedCopy,
          platform,
          MOCK_CAMPAIGN_CONTEXT
        );

        expect(validationResult.isValid).toBe(false);
        expect(validationResult.errors).toContain('Exceeds maximum length');
      }
    });
  });

  describe('Performance Prediction', () => {
    test('should predict performance metrics for ad copies', async () => {
      const variations = await fixture.contentGenerator.generate_ad_copies(
        'linkedin',
        MOCK_CAMPAIGN_CONTEXT,
        3
      );

      const predictions = await Promise.all(
        variations.map(variation => 
          fixture.contentGenerator.predict_performance(variation.content, MOCK_CAMPAIGN_CONTEXT)
        )
      );

      predictions.forEach(prediction => {
        expect(prediction).toHaveProperty('engagementScore');
        expect(prediction).toHaveProperty('clickThroughRate');
        expect(prediction).toHaveProperty('conversionProbability');
        expect(prediction.engagementScore).toBeGreaterThan(0);
        expect(prediction.clickThroughRate).toBeGreaterThan(0);
        expect(prediction.conversionProbability).toBeGreaterThan(0);
      });
    });

    test('should rank ad copies by predicted performance', async () => {
      const variations = await fixture.contentGenerator.generate_ad_copies(
        'linkedin',
        MOCK_CAMPAIGN_CONTEXT,
        5
      );

      const rankedVariations = await fixture.contentGenerator.rank_variations(
        variations,
        MOCK_CAMPAIGN_CONTEXT
      );

      // Verify ranking order
      for (let i = 1; i < rankedVariations.length; i++) {
        expect(rankedVariations[i].scores.final_score)
          .toBeLessThanOrEqual(rankedVariations[i-1].scores.final_score);
      }

      // Verify ranking metadata
      rankedVariations.forEach(variation => {
        expect(variation.scores).toHaveProperty('engagement');
        expect(variation.scores).toHaveProperty('relevance');
        expect(variation.scores).toHaveProperty('brand_consistency');
        expect(variation.scores).toHaveProperty('final_score');
      });
    });
  });
});