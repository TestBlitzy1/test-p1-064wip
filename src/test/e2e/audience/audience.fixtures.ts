import { faker } from '@faker-js/faker'; // v8.0.0
import { AudienceSegment, TargetingRule, Platform } from '../../types/targeting';

// Constants for test data generation
export const VALID_INDUSTRIES = [
  'Technology',
  'SaaS', 
  'Financial Services',
  'Healthcare',
  'Manufacturing'
] as const;

export const VALID_COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5001+'
] as const;

export const VALID_JOB_TITLES = [
  'CEO',
  'CTO',
  'VP Engineering',
  'IT Director',
  'Software Engineer'
] as const;

export const PLATFORM_CONSTRAINTS = {
  linkedin: {
    minAudienceSize: 300,
    maxTargetingRules: 10,
    maxNameLength: 50,
    maxDescriptionLength: 200
  },
  google: {
    minAudienceSize: 1000,
    maxTargetingRules: 15,
    maxNameLength: 100,
    maxDescriptionLength: 500
  }
} as const;

/**
 * Creates a valid audience segment fixture with realistic targeting criteria
 */
export function createValidAudienceSegment(
  overrides: Partial<AudienceSegment> = {},
  platform: Platform = 'linkedin'
): AudienceSegment {
  const constraints = PLATFORM_CONSTRAINTS[platform];
  
  const segment: AudienceSegment = {
    id: faker.string.uuid(),
    name: faker.company.catchPhrase().slice(0, constraints.maxNameLength),
    description: faker.company.catchPhrase().slice(0, constraints.maxDescriptionLength),
    platform,
    targetingRules: [
      createValidTargetingRule('industry', { industries: [faker.helpers.arrayElement(VALID_INDUSTRIES)] }, platform),
      createValidTargetingRule('company_size', { minSize: 50, maxSize: 1000 }, platform),
      createValidTargetingRule('job_title', { titles: [faker.helpers.arrayElement(VALID_JOB_TITLES)] }, platform)
    ],
    estimatedReach: faker.number.int({ min: constraints.minAudienceSize, max: 100000 }),
    confidence: faker.number.float({ min: 0.1, max: 1.0, precision: 0.01 }),
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    metadata: {
      lastOptimized: faker.date.recent().toISOString(),
      performanceScore: faker.number.float({ min: 0, max: 100, precision: 0.1 }),
      recommendedBudget: faker.number.int({ min: 1000, max: 10000 })
    },
    ...overrides
  };

  return segment;
}

/**
 * Creates an invalid audience segment fixture for negative testing
 */
export function createInvalidAudienceSegment(
  invalidationType: 'size' | 'rules' | 'format',
  platform: Platform = 'linkedin'
): AudienceSegment {
  const baseSegment = createValidAudienceSegment({}, platform);
  const constraints = PLATFORM_CONSTRAINTS[platform];

  switch (invalidationType) {
    case 'size':
      return {
        ...baseSegment,
        estimatedReach: faker.number.int({ min: 1, max: constraints.minAudienceSize - 1 })
      };
    case 'rules':
      return {
        ...baseSegment,
        targetingRules: Array(constraints.maxTargetingRules + 1).fill(null).map(() => 
          createValidTargetingRule('industry', { industries: [faker.helpers.arrayElement(VALID_INDUSTRIES)] }, platform)
        )
      };
    case 'format':
      return {
        ...baseSegment,
        name: faker.string.alpha(constraints.maxNameLength + 1),
        description: faker.string.alpha(constraints.maxDescriptionLength + 1)
      };
    default:
      throw new Error(`Invalid invalidation type: ${invalidationType}`);
  }
}

/**
 * Creates a valid targeting rule fixture with optimization parameters
 */
export function createValidTargetingRule(
  ruleType: string,
  criteria: Record<string, any>,
  platform: Platform = 'linkedin'
): TargetingRule {
  return {
    id: faker.string.uuid(),
    ruleType,
    operator: faker.helpers.arrayElement(['include', 'exclude', 'between']),
    criteria,
    weight: faker.number.float({ min: 0, max: 1, precision: 0.01 }),
    isActive: true,
    platform_constraints: {
      platform,
      minReach: PLATFORM_CONSTRAINTS[platform].minAudienceSize,
      supportedOperators: ['include', 'exclude', 'between']
    }
  };
}

/**
 * Creates an invalid targeting rule fixture for error testing
 */
export function createInvalidTargetingRule(
  ruleType: string,
  invalidationType: 'operator' | 'weight' | 'criteria',
  platform: Platform = 'linkedin'
): TargetingRule {
  const baseRule = createValidTargetingRule(ruleType, {
    industries: [faker.helpers.arrayElement(VALID_INDUSTRIES)]
  }, platform);

  switch (invalidationType) {
    case 'operator':
      return {
        ...baseRule,
        operator: 'invalid_operator'
      };
    case 'weight':
      return {
        ...baseRule,
        weight: faker.number.float({ min: 1.1, max: 2.0 })
      };
    case 'criteria':
      return {
        ...baseRule,
        criteria: {
          industries: Array(11).fill('Invalid Industry')
        }
      };
    default:
      throw new Error(`Invalid invalidation type: ${invalidationType}`);
  }
}