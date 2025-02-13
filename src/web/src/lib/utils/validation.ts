import { z } from 'zod'; // v3.22.4
import { Campaign, ValidationRules, Rule, ValidatorFunction } from '../../types/campaigns';
import { TargetingRule, PlatformConstraints, targetingRuleSchema } from '../../types/targeting';
import { ErrorResponse } from '../../types/common';

// Performance monitoring decorator
function performanceMetric(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    const start = performance.now();
    try {
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - start;
      result.metrics = { duration, timestamp: new Date().toISOString() };
      return result;
    } catch (error) {
      throw error;
    }
  };
  return descriptor;
}

// Error boundary decorator
function errorBoundary(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    try {
      return await originalMethod.apply(this, args);
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: error
        }]
      };
    }
  };
  return descriptor;
}

// Memoization decorator for targeting rule validation
function memoize(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const cache = new Map();
  const originalMethod = descriptor.value;
  
  descriptor.value = function (...args: any[]) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = originalMethod.apply(this, args);
    cache.set(key, result);
    return result;
  };
  return descriptor;
}

// Currency-aware decorator for budget validation
function currencyAware(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function (budget: number, platformType: string, currency: string) {
    // Add currency conversion logic if needed
    const result = await originalMethod.apply(this, [budget, platformType, currency]);
    result.currency = currency;
    return result;
  };
  return descriptor;
}

// Campaign schema validation
const campaignSchema = z.object({
  name: z.string().min(1).max(100),
  totalBudget: z.number().positive(),
  dateRange: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime()
  }),
  targetingSettings: z.object({
    industries: z.array(z.object({
      id: z.string(),
      name: z.string()
    })).min(1),
    jobFunctions: z.array(z.object({
      id: z.string(),
      title: z.string()
    })),
    companySizes: z.array(z.object({
      min: z.number(),
      max: z.number().nullable()
    })),
    locations: z.array(z.object({
      country: z.string(),
      region: z.string().optional(),
      city: z.string().optional()
    })).min(1)
  })
});

@performanceMetric
@errorBoundary
export async function validateCampaign(campaign: Campaign): Promise<{
  isValid: boolean;
  errors: ErrorResponse[];
  metrics?: { duration: number; timestamp: string };
}> {
  const errors: ErrorResponse[] = [];

  // Schema validation
  try {
    campaignSchema.parse(campaign);
  } catch (error) {
    errors.push({
      code: 'SCHEMA_VALIDATION_ERROR',
      message: 'Campaign data does not match required schema',
      details: error.errors
    });
  }

  // Business rules validation
  if (campaign.totalBudget < 100) {
    errors.push({
      code: 'BUDGET_ERROR',
      message: 'Campaign budget must be at least 100',
      details: { provided: campaign.totalBudget, minimum: 100 }
    });
  }

  // Date range validation
  const startDate = new Date(campaign.dateRange.startDate);
  const endDate = new Date(campaign.dateRange.endDate);
  const now = new Date();

  if (startDate < now) {
    errors.push({
      code: 'DATE_ERROR',
      message: 'Campaign start date must be in the future',
      details: { provided: startDate, current: now }
    });
  }

  if (endDate <= startDate) {
    errors.push({
      code: 'DATE_ERROR',
      message: 'Campaign end date must be after start date',
      details: { startDate, endDate }
    });
  }

  // Targeting validation
  const targetingErrors = validateTargetingSettings(campaign.targetingSettings);
  errors.push(...targetingErrors);

  return {
    isValid: errors.length === 0,
    errors
  };
}

@memoize
@errorBoundary
export function validateTargetingRule(rule: TargetingRule, constraints: PlatformConstraints): {
  isValid: boolean;
  errors: ErrorResponse[];
} {
  const errors: ErrorResponse[] = [];

  // Schema validation
  try {
    targetingRuleSchema.parse(rule);
  } catch (error) {
    errors.push({
      code: 'RULE_SCHEMA_ERROR',
      message: 'Targeting rule does not match required schema',
      details: error.errors
    });
    return { isValid: false, errors };
  }

  // Platform constraints validation
  if (!constraints.supportedRuleTypes.includes(rule.ruleType)) {
    errors.push({
      code: 'UNSUPPORTED_RULE_TYPE',
      message: `Rule type ${rule.ruleType} is not supported for this platform`,
      details: { supported: constraints.supportedRuleTypes }
    });
  }

  // Rule-specific validation
  switch (rule.ruleType) {
    case 'industry':
      if (rule.criteria.industries?.length > constraints.ruleSpecificConstraints.industry?.maxIndustries) {
        errors.push({
          code: 'MAX_INDUSTRIES_EXCEEDED',
          message: 'Maximum number of industries exceeded',
          details: {
            provided: rule.criteria.industries.length,
            maximum: constraints.ruleSpecificConstraints.industry?.maxIndustries
          }
        });
      }
      break;
    case 'location':
      if (rule.criteria.radius && !constraints.ruleSpecificConstraints.location?.supportedRadii.includes(rule.criteria.radius)) {
        errors.push({
          code: 'INVALID_RADIUS',
          message: 'Unsupported location radius value',
          details: {
            provided: rule.criteria.radius,
            supported: constraints.ruleSpecificConstraints.location?.supportedRadii
          }
        });
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

@currencyAware
@errorBoundary
export async function validateBudget(
  budget: number,
  platformType: string,
  currency: string
): Promise<{
  isValid: boolean;
  errors: ErrorResponse[];
  currency?: string;
}> {
  const errors: ErrorResponse[] = [];

  // Basic budget validation
  if (budget <= 0) {
    errors.push({
      code: 'INVALID_BUDGET',
      message: 'Budget must be greater than zero',
      details: { provided: budget }
    });
  }

  // Platform-specific budget validation
  const minimumBudgets = {
    LINKEDIN: 100,
    GOOGLE: 50,
    BOTH: 150
  };

  const minimumBudget = minimumBudgets[platformType as keyof typeof minimumBudgets];
  if (budget < minimumBudget) {
    errors.push({
      code: 'INSUFFICIENT_BUDGET',
      message: `Minimum budget for ${platformType} is ${minimumBudget} ${currency}`,
      details: { provided: budget, minimum: minimumBudget }
    });
  }

  // Daily budget allocation validation
  const dailyMinimum = minimumBudget / 30; // Assuming 30-day campaign
  if (budget / 30 < dailyMinimum) {
    errors.push({
      code: 'INSUFFICIENT_DAILY_BUDGET',
      message: `Daily budget must be at least ${dailyMinimum} ${currency}`,
      details: { provided: budget / 30, minimum: dailyMinimum }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Helper function to validate targeting settings
function validateTargetingSettings(targetingSettings: Campaign['targetingSettings']): ErrorResponse[] {
  const errors: ErrorResponse[] = [];

  // Validate industries
  if (!targetingSettings.industries?.length) {
    errors.push({
      code: 'TARGETING_ERROR',
      message: 'At least one industry must be selected',
      details: { provided: targetingSettings.industries }
    });
  }

  // Validate locations
  if (!targetingSettings.locations?.length) {
    errors.push({
      code: 'TARGETING_ERROR',
      message: 'At least one location must be selected',
      details: { provided: targetingSettings.locations }
    });
  }

  // Validate company sizes
  if (targetingSettings.companySizes?.length) {
    for (const size of targetingSettings.companySizes) {
      if (size.min < 0 || (size.max !== null && size.max < size.min)) {
        errors.push({
          code: 'TARGETING_ERROR',
          message: 'Invalid company size range',
          details: { provided: size }
        });
      }
    }
  }

  return errors;
}