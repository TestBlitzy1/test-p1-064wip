import { z } from 'zod'; // v3.x
import { BaseResponse, ID } from './common';

// Global type definitions for targeting rules
export type RuleType = 'industry' | 'company_size' | 'job_title' | 'location' | 'interest' | 'behavior';
export type RuleOperator = 'include' | 'exclude' | 'between' | 'greater_than' | 'less_than';
export type Platform = 'linkedin' | 'google';

// Base targeting rule interface
export interface TargetingRule {
  id: ID;
  ruleType: RuleType;
  operator: RuleOperator;
  criteria: Record<string, any>;
  weight: number;
  isActive: boolean;
}

// Industry targeting specific rule
export interface IndustryRule extends TargetingRule {
  criteria: {
    industries: string[];
    includeSubsidiaries: boolean;
    excludedIndustries?: string[];
  };
}

// Company size targeting rule
export interface CompanySizeRule extends TargetingRule {
  criteria: {
    minSize: number;
    maxSize: number;
    preferredRanges?: [number, number][];
  };
}

// Job title targeting rule
export interface JobTitleRule extends TargetingRule {
  criteria: {
    titles: string[];
    seniority?: string[];
    functions?: string[];
    exactMatch: boolean;
  };
}

// Location targeting rule
export interface LocationRule extends TargetingRule {
  criteria: {
    countries: string[];
    regions?: string[];
    cities?: string[];
    radius?: number;
    excludedLocations?: string[];
  };
}

// Interest targeting rule
export interface InterestRule extends TargetingRule {
  criteria: {
    interests: string[];
    matchType: 'broad' | 'exact';
    minEngagementScore?: number;
  };
}

// Behavior targeting rule
export interface BehaviorRule extends TargetingRule {
  criteria: {
    behaviors: string[];
    timeframe: number; // in days
    frequency?: number;
    intensity?: 'low' | 'medium' | 'high';
  };
}

// Audience segment interface
export interface AudienceSegment {
  id: ID;
  name: string;
  description: string;
  platform: Platform;
  targetingRules: TargetingRule[];
  estimatedReach: number;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  metadata?: {
    lastOptimized?: string;
    performanceScore?: number;
    recommendedBudget?: number;
  };
}

// Targeting validation schema using Zod
export const targetingRuleSchema = z.object({
  id: z.string(),
  ruleType: z.enum(['industry', 'company_size', 'job_title', 'location', 'interest', 'behavior']),
  operator: z.enum(['include', 'exclude', 'between', 'greater_than', 'less_than']),
  weight: z.number().min(0).max(1),
  isActive: z.boolean()
});

// Platform-specific targeting constraints
export interface PlatformConstraints {
  platform: Platform;
  maxRules: number;
  supportedRuleTypes: RuleType[];
  minReach: number;
  maxReach: number;
  ruleSpecificConstraints: {
    industry?: {
      maxIndustries: number;
      requiresSubsidiaryFlag: boolean;
    };
    companySize?: {
      minAllowed: number;
      maxAllowed: number;
    };
    location?: {
      maxLocations: number;
      supportedRadii: number[];
    };
  };
}

// Targeting validation interface
export interface TargetingValidation {
  validateRule: (rule: TargetingRule) => boolean;
  validateSegment: (segment: AudienceSegment) => boolean;
  validatePlatformCompliance: (segment: AudienceSegment, constraints: PlatformConstraints) => boolean;
}

// Response types for targeting-related API calls
export interface TargetingRuleResponse extends BaseResponse<TargetingRule> {}
export interface AudienceSegmentResponse extends BaseResponse<AudienceSegment> {}
export interface TargetingEstimateResponse extends BaseResponse<{
  reach: number;
  confidence: number;
  cost: {
    min: number;
    max: number;
    recommended: number;
  };
}> {}

// Targeting optimization settings
export interface OptimizationSettings {
  targetMetric: 'reach' | 'engagement' | 'conversion';
  minConfidence: number;
  budgetConstraint?: number;
  excludedRuleTypes?: RuleType[];
  weightingPreferences?: {
    [key in RuleType]?: number;
  };
}

// AI-powered targeting recommendations
export interface TargetingRecommendation {
  segmentId: ID;
  suggestedRules: TargetingRule[];
  expectedImpact: {
    reachIncrease: number;
    confidenceScore: number;
    costImplication: number;
  };
  reasoning: string[];
}