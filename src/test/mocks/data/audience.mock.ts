import { 
  AudienceSegment,
  TargetingRule,
  Platform,
  RuleType,
  IndustryRule,
  CompanySizeRule,
  LocationRule,
  PlatformConstraints,
  ValidationRule
} from '../../../web/src/types/targeting';
import { ID } from '../../../web/src/types/common';

// Platform-specific targeting constraints
export const PLATFORM_CONSTRAINTS: Record<Platform, PlatformConstraints> = {
  linkedin: {
    platform: 'linkedin',
    maxRules: 8,
    supportedRuleTypes: ['industry', 'company_size', 'job_title', 'location'],
    minReach: 1000,
    maxReach: 10000000,
    ruleSpecificConstraints: {
      industry: {
        maxIndustries: 30,
        requiresSubsidiaryFlag: true
      },
      companySize: {
        minAllowed: 1,
        maxAllowed: 10000
      },
      location: {
        maxLocations: 100,
        supportedRadii: [10, 25, 50, 100]
      }
    }
  },
  google: {
    platform: 'google',
    maxRules: 5,
    supportedRuleTypes: ['industry', 'company_size', 'location'],
    minReach: 500,
    maxReach: 5000000,
    ruleSpecificConstraints: {
      industry: {
        maxIndustries: 20,
        requiresSubsidiaryFlag: false
      },
      companySize: {
        minAllowed: 10,
        maxAllowed: 5000
      },
      location: {
        maxLocations: 50,
        supportedRadii: [5, 20, 50]
      }
    }
  }
};

// Helper function to generate mock audience segment
export function generateMockAudienceSegment(
  overrides: Partial<AudienceSegment> = {},
  platform: Platform = 'linkedin'
): AudienceSegment {
  const baseSegment: AudienceSegment = {
    id: `seg_${Math.random().toString(36).substr(2, 9)}` as ID,
    name: 'Mock Audience Segment',
    description: 'Auto-generated mock audience segment for testing',
    platform,
    targetingRules: [],
    estimatedReach: 50000,
    confidence: 0.85,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      lastOptimized: new Date().toISOString(),
      performanceScore: 0.78,
      recommendedBudget: 5000
    }
  };

  return {
    ...baseSegment,
    ...overrides
  };
}

// Helper function to generate mock targeting rule
export function generateMockTargetingRule(
  ruleType: RuleType,
  platform: Platform = 'linkedin'
): TargetingRule {
  const baseRule = {
    id: `rule_${Math.random().toString(36).substr(2, 9)}` as ID,
    weight: 1,
    isActive: true
  };

  switch (ruleType) {
    case 'industry':
      return {
        ...baseRule,
        ruleType: 'industry',
        operator: 'include',
        criteria: {
          industries: ['Software', 'Information Technology', 'Computer Services'],
          includeSubsidiaries: true
        }
      } as IndustryRule;

    case 'company_size':
      return {
        ...baseRule,
        ruleType: 'company_size',
        operator: 'between',
        criteria: {
          minSize: 50,
          maxSize: 1000,
          preferredRanges: [[100, 500], [501, 1000]]
        }
      } as CompanySizeRule;

    case 'location':
      return {
        ...baseRule,
        ruleType: 'location',
        operator: 'include',
        criteria: {
          countries: ['US', 'CA'],
          regions: ['CA-US', 'NY-US'],
          radius: platform === 'linkedin' ? 50 : 20
        }
      } as LocationRule;

    default:
      throw new Error(`Unsupported rule type: ${ruleType}`);
  }
}

// Pre-defined mock audience segments
export const mockAudienceSegments: AudienceSegment[] = [
  generateMockAudienceSegment({
    name: 'Tech Decision Makers',
    description: 'Senior technology decision makers in enterprise companies',
    targetingRules: [
      generateMockTargetingRule('industry', 'linkedin'),
      generateMockTargetingRule('company_size', 'linkedin')
    ],
    estimatedReach: 250000,
    confidence: 0.92
  }, 'linkedin'),

  generateMockAudienceSegment({
    name: 'Enterprise IT Leaders',
    description: 'IT leadership in Fortune 1000 companies',
    targetingRules: [
      generateMockTargetingRule('industry', 'google'),
      generateMockTargetingRule('location', 'google')
    ],
    estimatedReach: 150000,
    confidence: 0.88
  }, 'google'),

  generateMockAudienceSegment({
    name: 'Global Tech Executives',
    description: 'C-level technology executives worldwide',
    targetingRules: [
      generateMockTargetingRule('industry', 'linkedin'),
      generateMockTargetingRule('company_size', 'linkedin'),
      generateMockTargetingRule('location', 'linkedin')
    ],
    estimatedReach: 75000,
    confidence: 0.95
  }, 'linkedin')
];

// Validation helper function
export function validatePlatformConstraints(
  segment: AudienceSegment,
  platform: Platform
): boolean {
  const constraints = PLATFORM_CONSTRAINTS[platform];

  // Validate number of rules
  if (segment.targetingRules.length > constraints.maxRules) {
    return false;
  }

  // Validate reach estimates
  if (segment.estimatedReach < constraints.minReach || 
      segment.estimatedReach > constraints.maxReach) {
    return false;
  }

  // Validate rule types
  const hasInvalidRuleType = segment.targetingRules.some(
    rule => !constraints.supportedRuleTypes.includes(rule.ruleType)
  );
  if (hasInvalidRuleType) {
    return false;
  }

  return true;
}

// Export mock targeting rules for individual testing
export const mockTargetingRules = {
  industryRule: generateMockTargetingRule('industry'),
  companySizeRule: generateMockTargetingRule('company_size'),
  locationRule: generateMockTargetingRule('location')
};