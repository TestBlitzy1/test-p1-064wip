import { describe, it, beforeAll, afterAll, expect } from 'jest'; // ^29.0.0
import { gql } from 'graphql-tag'; // ^2.12.6
import { TestClient } from '../../e2e/utils/test-client';
import { TEST_DATABASE_CONFIG } from '../../config/test-database.config';
import { mockLinkedInCampaign } from '../../mocks/data/campaign.mock';

// Constants for test configuration
const TEST_ENDPOINT = '/graphql';
const AI_MODEL_TIMEOUT = 5000;
const testClient = new TestClient('http://localhost:4000');

/**
 * Helper function to execute GraphQL queries with timeout and validation
 */
async function executeQuery(query: string, variables?: Record<string, any>, timeout: number = AI_MODEL_TIMEOUT): Promise<any> {
  const parsedQuery = gql`${query}`;
  
  return Promise.race([
    testClient.post(TEST_ENDPOINT, {
      query: parsedQuery,
      variables
    }),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Query timeout')), timeout)
    )
  ]);
}

describe('GraphQL Schema Validation Tests', () => {
  beforeAll(async () => {
    await testClient.post('/test/setup', {
      database: TEST_DATABASE_CONFIG.database,
      aiModelConfig: TEST_DATABASE_CONFIG.aiModelConfig
    });
  });

  afterAll(async () => {
    await testClient.post('/test/cleanup');
  });

  describe('Campaign Queries', () => {
    it('should fetch campaign with AI optimization data', async () => {
      const query = gql`
        query GetCampaign($id: ID!) {
          campaign(id: $id) {
            id
            name
            platformType
            optimizationHints {
              suggestedBidAdjustments {
                factor
                dimension
                confidence
              }
              audienceExpansionSuggestions {
                segment
                potentialReach
                expectedCTR
              }
            }
            performanceMetrics {
              optimizationScore
              resourceUtilization {
                cpu
                memory
              }
            }
          }
        }
      `;

      const response = await executeQuery(query, { id: mockLinkedInCampaign.id });

      expect(response.data.campaign).toBeDefined();
      expect(response.data.campaign.optimizationHints).toBeDefined();
      expect(response.data.campaign.performanceMetrics.optimizationScore).toBeGreaterThan(0);
    });

    it('should validate campaign analytics with AI insights', async () => {
      const query = gql`
        query GetCampaignAnalytics($id: ID!, $dateRange: DateRangeInput!) {
          campaignAnalytics(id: $id, dateRange: $dateRange) {
            metrics {
              impressions
              clicks
              conversions
              costPerConversion
            }
            aiInsights {
              performanceScore
              recommendations {
                type
                impact
                confidence
                suggestion
              }
              audienceInsights {
                segment
                engagement
                potentialGrowth
              }
            }
          }
        }
      `;

      const response = await executeQuery(query, {
        id: mockLinkedInCampaign.id,
        dateRange: {
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        }
      });

      expect(response.data.campaignAnalytics.metrics).toBeDefined();
      expect(response.data.campaignAnalytics.aiInsights).toBeDefined();
      expect(response.data.campaignAnalytics.aiInsights.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('Campaign Mutations', () => {
    it('should create campaign with AI-generated structure', async () => {
      const mutation = gql`
        mutation CreateCampaign($input: CreateCampaignInput!) {
          createCampaign(input: $input) {
            id
            name
            platformType
            targetingSettings {
              industries
              jobFunctions
              locations
            }
            aiOptimizations {
              type
              confidence
              impact
              suggestion
            }
            validationResults {
              success
              errors {
                code
                message
                field
              }
            }
          }
        }
      `;

      const response = await executeQuery(mutation, {
        input: {
          name: "Test AI Campaign",
          platformType: "LINKEDIN",
          totalBudget: 5000,
          targetingSettings: {
            industries: ["Technology", "Software"],
            locations: ["United States"],
            jobFunctions: ["Information Technology"]
          }
        }
      });

      expect(response.data.createCampaign).toBeDefined();
      expect(response.data.createCampaign.aiOptimizations).toBeInstanceOf(Array);
      expect(response.data.createCampaign.validationResults.success).toBe(true);
    });

    it('should update campaign with AI optimization suggestions', async () => {
      const mutation = gql`
        mutation OptimizeCampaign($id: ID!, $input: OptimizeCampaignInput!) {
          optimizeCampaign(id: $id, input: $input) {
            id
            optimizationResults {
              score
              improvements {
                type
                currentValue
                suggestedValue
                expectedImpact
                confidence
              }
              audienceOptimizations {
                segment
                expansion
                expectedReach
                confidenceScore
              }
            }
          }
        }
      `;

      const response = await executeQuery(mutation, {
        id: mockLinkedInCampaign.id,
        input: {
          optimizationTarget: "CONVERSIONS",
          constraints: {
            maxBudgetIncrease: 0.2,
            minConfidenceScore: 0.8
          }
        }
      });

      expect(response.data.optimizeCampaign).toBeDefined();
      expect(response.data.optimizeCampaign.optimizationResults.score).toBeGreaterThan(0);
      expect(response.data.optimizeCampaign.optimizationResults.improvements).toBeInstanceOf(Array);
    });
  });

  describe('Audience Queries', () => {
    it('should fetch audience segments with AI-powered insights', async () => {
      const query = gql`
        query GetAudienceInsights($segmentId: ID!) {
          audienceInsights(segmentId: $segmentId) {
            segment {
              id
              name
              estimatedReach
            }
            aiAnalysis {
              engagementScore
              growthPotential
              similarSegments {
                id
                name
                overlap
                uniqueReach
              }
              recommendations {
                type
                description
                expectedImpact
                confidence
              }
            }
            performanceMetrics {
              ctr
              conversionRate
              costPerConversion
              qualityScore
            }
          }
        }
      `;

      const response = await executeQuery(query, {
        segmentId: "test-segment-1"
      });

      expect(response.data.audienceInsights).toBeDefined();
      expect(response.data.audienceInsights.aiAnalysis).toBeDefined();
      expect(response.data.audienceInsights.aiAnalysis.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('Schema Validation', () => {
    it('should validate complex nested types', async () => {
      const query = gql`
        query ValidateSchema {
          __schema {
            types {
              name
              fields {
                name
                type {
                  name
                  kind
                }
              }
            }
          }
        }
      `;

      const response = await executeQuery(query);
      expect(response.data.__schema).toBeDefined();
      expect(response.data.__schema.types).toBeInstanceOf(Array);
    });
  });
});