import { isValid, isFuture, differenceInDays } from 'date-fns';
import { Campaign, ErrorResponse } from '../types/campaigns';

// Constants for validation rules
const MIN_CAMPAIGN_BUDGET = 100;
const MAX_CAMPAIGN_BUDGET = 1000000;
const MIN_CAMPAIGN_DURATION_DAYS = 1;
const MAX_CAMPAIGN_DURATION_DAYS = 365;
const VALIDATION_TIMEOUT_MS = 30000;
const MIN_AUDIENCE_SIZE = 1000;

// Validation options interface
interface ValidationOptions {
  strict?: boolean;
  validatePlatformRules?: boolean;
  timeout?: number;
}

/**
 * Comprehensive campaign validation with performance tracking
 * @param campaign - Campaign configuration to validate
 * @param options - Validation options
 * @returns Promise<ErrorResponse | null>
 */
export async function validateCampaign(
  campaign: Campaign,
  options: ValidationOptions = {}
): Promise<ErrorResponse | null> {
  const startTime = performance.now();
  const errors: string[] = [];
  
  try {
    // Basic structure validation
    if (!campaign.name?.trim()) {
      errors.push('Campaign name is required');
    }

    // Budget validation
    const budgetError = validateBudget(campaign.totalBudget, 'USD');
    if (budgetError) {
      errors.push(budgetError.message);
    }

    // Date range validation
    const dateError = validateDateRange(campaign.dateRange);
    if (dateError) {
      errors.push(dateError.message);
    }

    // Targeting validation
    const targetingError = validateTargeting(campaign.targetingSettings);
    if (targetingError) {
      errors.push(targetingError.message);
    }

    // Platform-specific validation
    if (options.validatePlatformRules) {
      const platformError = await validatePlatformSettings(campaign);
      if (platformError) {
        errors.push(platformError.message);
      }
    }

    const validationTime = performance.now() - startTime;

    if (errors.length > 0) {
      return {
        code: 'VALIDATION_ERROR',
        message: 'Campaign validation failed',
        details: {
          errors,
          validationTime,
          timestamp: new Date().toISOString()
        }
      };
    }

    return null;

  } catch (error) {
    return {
      code: 'VALIDATION_SYSTEM_ERROR',
      message: 'System error during validation',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Validates campaign budget with currency support
 * @param budget - Campaign budget amount
 * @param currency - Currency code
 * @returns ErrorResponse | null
 */
export function validateBudget(
  budget: number,
  currency: string
): ErrorResponse | null {
  if (!budget || budget < MIN_CAMPAIGN_BUDGET) {
    return {
      code: 'INVALID_BUDGET',
      message: `Budget must be at least ${MIN_CAMPAIGN_BUDGET} ${currency}`,
      details: { minBudget: MIN_CAMPAIGN_BUDGET, currency }
    };
  }

  if (budget > MAX_CAMPAIGN_BUDGET) {
    return {
      code: 'INVALID_BUDGET',
      message: `Budget cannot exceed ${MAX_CAMPAIGN_BUDGET} ${currency}`,
      details: { maxBudget: MAX_CAMPAIGN_BUDGET, currency }
    };
  }

  return null;
}

/**
 * Validates campaign date range with timezone support
 * @param dateRange - Campaign date range
 * @returns ErrorResponse | null
 */
export function validateDateRange(dateRange: {
  startDate: string;
  endDate: string;
}): ErrorResponse | null {
  const start = new Date(dateRange.startDate);
  const end = new Date(dateRange.endDate);

  if (!isValid(start) || !isValid(end)) {
    return {
      code: 'INVALID_DATE_RANGE',
      message: 'Invalid date format',
      details: { dateRange }
    };
  }

  if (!isFuture(start)) {
    return {
      code: 'INVALID_DATE_RANGE',
      message: 'Start date must be in the future',
      details: { startDate: dateRange.startDate }
    };
  }

  const duration = differenceInDays(end, start);
  if (duration < MIN_CAMPAIGN_DURATION_DAYS || duration > MAX_CAMPAIGN_DURATION_DAYS) {
    return {
      code: 'INVALID_DATE_RANGE',
      message: `Campaign duration must be between ${MIN_CAMPAIGN_DURATION_DAYS} and ${MAX_CAMPAIGN_DURATION_DAYS} days`,
      details: { duration, min: MIN_CAMPAIGN_DURATION_DAYS, max: MAX_CAMPAIGN_DURATION_DAYS }
    };
  }

  return null;
}

/**
 * Validates targeting settings with audience size verification
 * @param targeting - Campaign targeting settings
 * @returns ErrorResponse | null
 */
export function validateTargeting(targeting: Campaign['targetingSettings']): ErrorResponse | null {
  if (!targeting.industries?.length) {
    return {
      code: 'INVALID_TARGETING',
      message: 'At least one industry must be selected',
      details: { targeting }
    };
  }

  if (!targeting.jobFunctions?.length) {
    return {
      code: 'INVALID_TARGETING',
      message: 'At least one job function must be selected',
      details: { targeting }
    };
  }

  if (!targeting.locations?.length) {
    return {
      code: 'INVALID_TARGETING',
      message: 'At least one location must be selected',
      details: { targeting }
    };
  }

  return null;
}

/**
 * Validates platform-specific settings for LinkedIn and Google Ads
 * @param campaign - Campaign configuration
 * @returns Promise<ErrorResponse | null>
 */
async function validatePlatformSettings(campaign: Campaign): Promise<ErrorResponse | null> {
  const { platformType, platformSettings } = campaign;

  if (platformType === 'LINKEDIN' || platformType === 'BOTH') {
    if (!platformSettings.linkedin) {
      return {
        code: 'INVALID_PLATFORM_SETTINGS',
        message: 'LinkedIn settings are required',
        details: { platformType }
      };
    }

    // LinkedIn-specific validation
    const { linkedin } = platformSettings;
    if (!linkedin.campaignType || !linkedin.objectiveType || !linkedin.format) {
      return {
        code: 'INVALID_LINKEDIN_SETTINGS',
        message: 'Missing required LinkedIn campaign settings',
        details: { settings: linkedin }
      };
    }
  }

  if (platformType === 'GOOGLE' || platformType === 'BOTH') {
    if (!platformSettings.google) {
      return {
        code: 'INVALID_PLATFORM_SETTINGS',
        message: 'Google Ads settings are required',
        details: { platformType }
      };
    }

    // Google Ads-specific validation
    const { google } = platformSettings;
    if (!google.campaignType || !google.bidStrategy || !google.networkSettings) {
      return {
        code: 'INVALID_GOOGLE_SETTINGS',
        message: 'Missing required Google Ads campaign settings',
        details: { settings: google }
      };
    }
  }

  return null;
}