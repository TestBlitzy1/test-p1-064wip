import { jest } from 'jest';
import { KeywordRecommender } from '../../../backend/ai_service/models/keyword_recommender';
import { MockServiceManager } from '../utils/mock-services';
import { IntegrationTestFixture } from '../utils/test-helpers';
import { Campaign } from '../../../web/src/types/campaigns';
import { mockGoogleCampaign } from '../../mocks/data/campaign.mock';

// Constants for test configuration
const TEST_TIMEOUT = 30000; // 30 seconds as per requirements
const MIN_KEYWORDS = 10;
const MAX_KEYWORDS = 2000;
const MIN_RELEVANCE_SCORE = 0.6;

/**
 * Integration test fixture for keyword recommender with GPU acceleration support
 */
class KeywordRecommenderTestFixture extends IntegrationTestFixture {
  private recommender: KeywordRecommender;
  private serviceManager: MockServiceManager;
  private testCampaign: Campaign;
  private processingMetrics: {
    startTime: number;
    endTime: number;
    duration: number;
    gpuUtilization: number;
  };

  constructor() {
    super();
    this.serviceManager = new MockServiceManager();
    this.processingMetrics = {
      startTime: 0,
      endTime: 0,
      duration: 0,
      gpuUtilization: 0
    };
  }

  /**
   * Sets up test environment with GPU acceleration and monitoring
   */
  async setup(): Promise<void> {
    await super.setup();
    
    // Initialize mock services with GPU support
    await this.serviceManager.initialize();
    
    // Initialize keyword recommender with test configuration
    this.recommender = new KeywordRecommender(
      'models/keyword_recommender',
      {
        version: '1.0.0',
        enableGPU: true,
        batchSize: 32,
        maxKeywords: MAX_KEYWORDS
      }
    );

    // Setup test campaign data
    this.testCampaign = {
      ...mockGoogleCampaign,
      targetingSettings: {
        industries: ['Technology', 'SaaS'],
        jobFunctions: [
          { id: '1', title: 'CTO', seniority: ['Senior'] },
          { id: '2', title: 'IT Director', seniority: ['Senior'] }
        ],
        companySizes: [{ min: 100, max: 1000, label: 'Mid-Market' }]
      }
    };
  }

  /**
   * Cleans up test resources and GPU memory
   */
  async teardown(): Promise<void> {
    await this.serviceManager.reset();
    await super.teardown();
  }
}

describe('Keyword Recommender Integration Tests', () => {
  let fixture: KeywordRecommenderTestFixture;

  beforeEach(async () => {
    fixture = new KeywordRecommenderTestFixture();
    await fixture.setup();
  });

  afterEach(async () => {
    await fixture.teardown();
  });

  test('should generate B2B-focused keywords within processing time limit', async () => {
    // Arrange
    const startTime = Date.now();
    const platform = 'GOOGLE';
    const context = {
      industry: 'Technology',
      company_size: '100-1000',
      job_titles: ['CTO', 'IT Director'],
      description: 'Enterprise SaaS Solutions'
    };

    // Act
    const keywords = await fixture.recommender.generate_keywords(context, platform);

    // Assert
    const processingTime = Date.now() - startTime;
    
    // Validate processing time requirement (30 seconds)
    expect(processingTime).toBeLessThanOrEqual(TEST_TIMEOUT);
    
    // Validate keyword generation results
    expect(keywords).toBeInstanceOf(Array);
    expect(keywords.length).toBeGreaterThanOrEqual(MIN_KEYWORDS);
    expect(keywords.length).toBeLessThanOrEqual(MAX_KEYWORDS);
    
    // Validate keyword relevance scores
    keywords.forEach(keyword => {
      expect(keyword.relevance_score).toBeGreaterThanOrEqual(MIN_RELEVANCE_SCORE);
      expect(keyword.platform_compliant).toBe(true);
    });
  });

  test('should optimize keywords based on historical performance data', async () => {
    // Arrange
    const initialKeywords = await fixture.recommender.generate_keywords({
      industry: 'Technology',
      company_size: '100-1000',
      job_titles: ['CTO']
    }, 'GOOGLE');

    const performanceData = {
      ctr: { 'enterprise saas': 0.05, 'cloud solutions': 0.04 },
      conversion_rate: { 'enterprise saas': 0.02, 'cloud solutions': 0.015 },
      cost_per_click: { 'enterprise saas': 5.0, 'cloud solutions': 4.5 }
    };

    // Act
    const optimizedKeywords = await fixture.recommender.optimize_keywords(
      initialKeywords,
      performanceData
    );

    // Assert
    expect(optimizedKeywords).toBeInstanceOf(Array);
    expect(optimizedKeywords.length).toBeLessThanOrEqual(initialKeywords.length);
    
    // Validate optimization results
    optimizedKeywords.forEach(keyword => {
      expect(keyword.performance_score).toBeDefined();
      expect(keyword.final_score).toBeGreaterThanOrEqual(MIN_RELEVANCE_SCORE);
      expect(keyword.predictions).toMatchObject({
        expected_ctr: expect.any(Number),
        expected_conversion_rate: expect.any(Number),
        expected_cost: expect.any(Number)
      });
    });
  });

  test('should validate keywords against platform-specific policies', async () => {
    // Arrange
    const testKeywords = [
      { keyword: 'enterprise saas', relevance_score: 0.8 },
      { keyword: 'free software!', relevance_score: 0.7 }, // Invalid format
      { keyword: 'cloud solutions', relevance_score: 0.9 }
    ];

    // Act
    const validatedKeywords = await fixture.recommender.validate_keywords(
      testKeywords,
      'GOOGLE'
    );

    // Assert
    expect(validatedKeywords).toBeInstanceOf(Array);
    expect(validatedKeywords.length).toBeLessThan(testKeywords.length);
    
    // Validate compliance results
    validatedKeywords.forEach(keyword => {
      expect(keyword.platform_compliant).toBe(true);
      expect(keyword.validation_errors).toHaveLength(0);
    });
  });
});