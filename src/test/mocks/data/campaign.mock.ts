import { faker } from '@faker-js/faker'; // ^8.0.0
import type { Campaign, AdGroup, PlatformType, ProcessingStatus, LinkedInSettings, GoogleAdsSettings } from '../../web/src/types/campaigns';
import type { IAudienceSegment } from '../../web/src/types/targeting';

// Constants for mock data generation
const MOCK_USER_ID = 'test-user-123';
const MOCK_CAMPAIGN_STATUSES: ProcessingStatus[] = ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'];
const MOCK_PLATFORMS: PlatformType[] = ['LINKEDIN', 'GOOGLE', 'BOTH'];
const MOCK_AD_FORMATS = {
  LINKEDIN: ['SINGLE_IMAGE', 'CAROUSEL', 'VIDEO', 'MESSAGE'],
  GOOGLE: ['RESPONSIVE_SEARCH', 'DISPLAY', 'VIDEO', 'SHOPPING']
};

interface GenerateMockCampaignOptions {
  status?: ProcessingStatus;
  budget?: number;
  adGroupCount?: number;
  includeAIOptimizations?: boolean;
}

/**
 * Generates a mock campaign with AI-optimized settings and comprehensive test data
 */
export function generateMockCampaign(
  platform: PlatformType,
  options: GenerateMockCampaignOptions = {}
): Campaign {
  const {
    status = faker.helpers.arrayElement(MOCK_CAMPAIGN_STATUSES),
    budget = faker.number.int({ min: 1000, max: 50000 }),
    adGroupCount = faker.number.int({ min: 1, max: 5 }),
    includeAIOptimizations = true
  } = options;

  const campaignId = faker.string.uuid();
  const now = new Date().toISOString();

  const platformSettings = generatePlatformSettings(platform);
  const targetingSettings = generateTargetingSettings(platform);
  const adGroups = Array.from({ length: adGroupCount }, () => 
    generateMockAdGroup(campaignId, platform)
  );

  return {
    id: campaignId,
    name: `${faker.company.name()} - ${faker.company.buzzPhrase()}`,
    description: faker.company.catchPhrase(),
    platformType: platform,
    totalBudget: budget,
    budgetType: faker.helpers.arrayElement(['DAILY', 'LIFETIME']),
    dateRange: {
      startDate: now,
      endDate: faker.date.future().toISOString()
    },
    status: faker.helpers.arrayElement(['DRAFT', 'ACTIVE', 'PAUSED']),
    processingStatus: status,
    estimatedProcessingTime: faker.number.int({ min: 5, max: 30 }),
    targetingSettings,
    platformSettings,
    performanceMetrics: generatePerformanceMetrics(),
    validationRules: generateValidationRules(platform),
    optimizationHints: includeAIOptimizations ? generateOptimizationHints() : null,
    version: '1.0.0',
    createdAt: now,
    updatedAt: now,
    createdBy: MOCK_USER_ID,
    updatedBy: MOCK_USER_ID,
    adGroups
  };
}

/**
 * Generates a mock ad group with platform-specific settings and format support
 */
export function generateMockAdGroup(
  campaignId: string,
  platform: PlatformType
): AdGroup {
  return {
    id: faker.string.uuid(),
    name: `${faker.commerce.department()} - ${faker.company.buzzPhrase()}`,
    campaignId,
    budget: faker.number.int({ min: 500, max: 5000 }),
    adFormats: platform === 'LINKEDIN' ? 
      faker.helpers.arrayElements(MOCK_AD_FORMATS.LINKEDIN, { min: 1, max: 3 }) :
      faker.helpers.arrayElements(MOCK_AD_FORMATS.GOOGLE, { min: 1, max: 3 }),
    platformSettings: generateAdGroupPlatformSettings(platform),
    performanceSettings: {
      bidAmount: faker.number.int({ min: 5, max: 50 }),
      bidStrategy: faker.helpers.arrayElement(['AUTOMATED', 'MANUAL']),
      optimizationGoal: faker.helpers.arrayElement(['AWARENESS', 'CONSIDERATION', 'CONVERSION'])
    }
  };
}

// Helper functions for generating mock data components
function generatePlatformSettings(platform: PlatformType): { linkedin?: LinkedInSettings; google?: GoogleAdsSettings } {
  const settings: any = {};

  if (platform === 'LINKEDIN' || platform === 'BOTH') {
    settings.linkedin = {
      campaignType: faker.helpers.arrayElement(['SPONSORED_CONTENT', 'MESSAGE_AD', 'DYNAMIC_AD']),
      objectiveType: faker.helpers.arrayElement(['AWARENESS', 'CONSIDERATION', 'CONVERSION']),
      bidStrategy: faker.helpers.arrayElement(['AUTOMATED', 'MANUAL_CPC', 'MANUAL_CPM']),
      bidAmount: faker.number.int({ min: 10, max: 100 }),
      format: faker.helpers.arrayElement(MOCK_AD_FORMATS.LINKEDIN)
    };
  }

  if (platform === 'GOOGLE' || platform === 'BOTH') {
    settings.google = {
      campaignType: faker.helpers.arrayElement(['SEARCH', 'DISPLAY', 'VIDEO', 'SHOPPING']),
      bidStrategy: faker.helpers.arrayElement(['CPC', 'CPA', 'MAXIMIZE_CONVERSIONS']),
      networkSettings: {
        searchNetwork: faker.datatype.boolean(),
        displayNetwork: faker.datatype.boolean(),
        partnerNetwork: faker.datatype.boolean()
      },
      keywords: Array.from({ length: faker.number.int({ min: 5, max: 15 }) }, () => ({
        text: faker.word.words(3),
        matchType: faker.helpers.arrayElement(['EXACT', 'PHRASE', 'BROAD'])
      }))
    };
  }

  return settings;
}

function generateTargetingSettings(platform: PlatformType): IAudienceSegment {
  return {
    industryFilters: Array.from({ length: faker.number.int({ min: 2, max: 5 }) }, () => 
      faker.company.buzzNoun()
    ),
    companySizeRange: {
      min: faker.helpers.arrayElement([10, 50, 100, 500]),
      max: faker.helpers.arrayElement([1000, 5000, 10000, null])
    },
    targetingCriteria: {
      locations: Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => ({
        country: faker.location.country(),
        region: faker.location.state(),
        city: faker.location.city()
      })),
      jobTitles: Array.from({ length: faker.number.int({ min: 3, max: 8 }) }, () =>
        faker.person.jobTitle()
      ),
      interests: Array.from({ length: faker.number.int({ min: 2, max: 6 }) }, () =>
        faker.company.buzzPhrase()
      )
    },
    aiOptimizations: generateAIOptimizations()
  };
}

function generatePerformanceMetrics() {
  return {
    processingTime: faker.number.int({ min: 100, max: 1000 }),
    validationTime: faker.number.int({ min: 50, max: 200 }),
    optimizationScore: faker.number.float({ min: 0.5, max: 1, precision: 0.01 }),
    resourceUtilization: {
      cpu: faker.number.float({ min: 0.1, max: 0.9, precision: 0.01 }),
      memory: faker.number.float({ min: 0.1, max: 0.9, precision: 0.01 })
    },
    platformMetrics: {
      apiLatency: faker.number.int({ min: 50, max: 500 }),
      requestCount: faker.number.int({ min: 1, max: 50 })
    }
  };
}

function generateValidationRules(platform: PlatformType) {
  return {
    level: faker.helpers.arrayElement(['STRICT', 'MODERATE', 'RELAXED']),
    rules: Array.from({ length: faker.number.int({ min: 3, max: 8 }) }, () => ({
      field: faker.helpers.arrayElement(['budget', 'targeting', 'creative']),
      condition: faker.helpers.arrayElement(['required', 'min', 'max', 'format']),
      value: faker.number.int({ min: 1, max: 100 }),
      errorMessage: faker.word.words(5),
      severity: faker.helpers.arrayElement(['ERROR', 'WARNING', 'INFO'])
    })),
    platformSpecificRules: {
      [platform.toLowerCase()]: Array.from({ length: 3 }, () => ({
        field: faker.helpers.arrayElement(['format', 'audience', 'budget']),
        rule: faker.word.words(3),
        value: faker.number.int({ min: 1, max: 100 })
      }))
    }
  };
}

function generateOptimizationHints() {
  return {
    suggestedBidAdjustments: Array.from({ length: faker.number.int({ min: 2, max: 5 }) }, () => ({
      factor: faker.number.float({ min: 0.8, max: 1.5, precision: 0.01 }),
      dimension: faker.helpers.arrayElement(['device', 'location', 'audience']),
      confidence: faker.number.float({ min: 0.6, max: 0.95, precision: 0.01 })
    })),
    audienceExpansionSuggestions: Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, () => ({
      segment: faker.company.buzzPhrase(),
      potentialReach: faker.number.int({ min: 5000, max: 100000 }),
      expectedCTR: faker.number.float({ min: 0.01, max: 0.05, precision: 0.001 })
    }))
  };
}

function generateAIOptimizations() {
  return Array.from({ length: faker.number.int({ min: 2, max: 5 }) }, () => ({
    type: faker.helpers.arrayElement(['AUDIENCE_EXPANSION', 'BID_OPTIMIZATION', 'CREATIVE_SUGGESTION']),
    confidence: faker.number.float({ min: 0.7, max: 0.99, precision: 0.01 }),
    impact: faker.helpers.arrayElement(['HIGH', 'MEDIUM', 'LOW']),
    suggestion: faker.word.words(8)
  }));
}

// Pre-generated mock campaigns for common testing scenarios
export const mockLinkedInCampaign = generateMockCampaign('LINKEDIN', {
  status: 'COMPLETED',
  budget: 25000,
  adGroupCount: 3
});

export const mockGoogleCampaign = generateMockCampaign('GOOGLE', {
  status: 'COMPLETED',
  budget: 30000,
  adGroupCount: 4
});