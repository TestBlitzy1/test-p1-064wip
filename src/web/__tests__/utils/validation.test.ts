import { describe, it, expect } from '@jest/globals';
import {
  validateCampaign,
  validateBudget,
  validateDateRange,
  validateTargeting
} from '../../src/utils/validation';
import {
  mockLinkedInCampaign,
  mockGoogleCampaign
} from '../../../test/mocks/data/campaign.mock';

describe('Campaign Validation Tests', () => {
  // Test complete campaign validation within time limit
  it('should validate complete LinkedIn campaign within 30 seconds', async () => {
    const startTime = performance.now();
    const result = await validateCampaign(mockLinkedInCampaign, {
      validatePlatformRules: true
    });
    const validationTime = performance.now() - startTime;

    expect(result).toBeNull();
    expect(validationTime).toBeLessThan(30000);
  });

  it('should validate complete Google Ads campaign within 30 seconds', async () => {
    const startTime = performance.now();
    const result = await validateCampaign(mockGoogleCampaign, {
      validatePlatformRules: true
    });
    const validationTime = performance.now() - startTime;

    expect(result).toBeNull();
    expect(validationTime).toBeLessThan(30000);
  });

  // Test invalid campaign structure
  it('should reject campaign with missing required fields', async () => {
    const invalidCampaign = { ...mockLinkedInCampaign, name: '' };
    const result = await validateCampaign(invalidCampaign);

    expect(result).toEqual(expect.objectContaining({
      code: 'VALIDATION_ERROR',
      message: 'Campaign validation failed',
      details: expect.objectContaining({
        errors: expect.arrayContaining(['Campaign name is required'])
      })
    }));
  });

  // Test platform-specific validation
  it('should reject LinkedIn campaign with invalid platform settings', async () => {
    const invalidCampaign = {
      ...mockLinkedInCampaign,
      platformSettings: {
        linkedin: {
          ...mockLinkedInCampaign.platformSettings.linkedin,
          campaignType: undefined
        }
      }
    };

    const result = await validateCampaign(invalidCampaign, {
      validatePlatformRules: true
    });

    expect(result).toEqual(expect.objectContaining({
      code: 'VALIDATION_ERROR',
      details: expect.objectContaining({
        errors: expect.arrayContaining(['Missing required LinkedIn campaign settings'])
      })
    }));
  });
});

describe('Budget Validation Tests', () => {
  it('should validate budget within platform limits', () => {
    const result = validateBudget(50000, 'USD');
    expect(result).toBeNull();
  });

  it('should reject budget below minimum', () => {
    const result = validateBudget(50, 'USD');
    expect(result).toEqual(expect.objectContaining({
      code: 'INVALID_BUDGET',
      message: expect.stringContaining('Budget must be at least')
    }));
  });

  it('should reject budget above maximum', () => {
    const result = validateBudget(2000000, 'USD');
    expect(result).toEqual(expect.objectContaining({
      code: 'INVALID_BUDGET',
      message: expect.stringContaining('Budget cannot exceed')
    }));
  });
});

describe('Date Range Validation Tests', () => {
  it('should validate valid date range', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);

    const result = validateDateRange({
      startDate: tomorrow.toISOString(),
      endDate: nextMonth.toISOString()
    });

    expect(result).toBeNull();
  });

  it('should reject past start date', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);

    const result = validateDateRange({
      startDate: yesterday.toISOString(),
      endDate: nextMonth.toISOString()
    });

    expect(result).toEqual(expect.objectContaining({
      code: 'INVALID_DATE_RANGE',
      message: 'Start date must be in the future'
    }));
  });

  it('should reject campaign duration outside allowed range', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tooFarFuture = new Date();
    tooFarFuture.setDate(tooFarFuture.getDate() + 400);

    const result = validateDateRange({
      startDate: tomorrow.toISOString(),
      endDate: tooFarFuture.toISOString()
    });

    expect(result).toEqual(expect.objectContaining({
      code: 'INVALID_DATE_RANGE',
      message: expect.stringContaining('Campaign duration must be between')
    }));
  });
});

describe('Targeting Validation Tests', () => {
  it('should validate complete targeting settings', () => {
    const result = validateTargeting(mockLinkedInCampaign.targetingSettings);
    expect(result).toBeNull();
  });

  it('should reject targeting without industries', () => {
    const invalidTargeting = {
      ...mockLinkedInCampaign.targetingSettings,
      industries: []
    };

    const result = validateTargeting(invalidTargeting);
    expect(result).toEqual(expect.objectContaining({
      code: 'INVALID_TARGETING',
      message: 'At least one industry must be selected'
    }));
  });

  it('should reject targeting without job functions', () => {
    const invalidTargeting = {
      ...mockLinkedInCampaign.targetingSettings,
      jobFunctions: []
    };

    const result = validateTargeting(invalidTargeting);
    expect(result).toEqual(expect.objectContaining({
      code: 'INVALID_TARGETING',
      message: 'At least one job function must be selected'
    }));
  });

  it('should reject targeting without locations', () => {
    const invalidTargeting = {
      ...mockLinkedInCampaign.targetingSettings,
      locations: []
    };

    const result = validateTargeting(invalidTargeting);
    expect(result).toEqual(expect.objectContaining({
      code: 'INVALID_TARGETING',
      message: 'At least one location must be selected'
    }));
  });
});