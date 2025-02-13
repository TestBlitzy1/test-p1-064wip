import { UUID } from 'crypto';
import { BaseResponse, DateRange, ErrorResponse } from './common';

// Platform type definitions
export type PlatformType = 'LINKEDIN' | 'GOOGLE' | 'BOTH';

// Campaign status types
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
export type BudgetType = 'DAILY' | 'LIFETIME';
export type ProcessingStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type ValidationLevel = 'STRICT' | 'MODERATE' | 'RELAXED';

// Targeting related interfaces
export interface Industry {
  id: string;
  name: string;
  subIndustries?: Industry[];
}

export interface JobFunction {
  id: string;
  title: string;
  seniority: string[];
}

export interface CompanySize {
  min: number;
  max: number | null;
  label: string;
}

export interface Location {
  country: string;
  region?: string;
  city?: string;
  postalCode?: string;
}

export interface TargetingSettings {
  industries: Industry[];
  jobFunctions: JobFunction[];
  companySizes: CompanySize[];
  locations: Location[];
  languages?: string[];
  excludedAudiences?: string[];
  customAudiences?: string[];
}

// Platform-specific settings
export interface LinkedInSettings {
  campaignType: 'SPONSORED_CONTENT' | 'MESSAGE_AD' | 'DYNAMIC_AD';
  objectiveType: 'AWARENESS' | 'CONSIDERATION' | 'CONVERSION';
  bidStrategy: 'AUTOMATED' | 'MANUAL_CPC' | 'MANUAL_CPM';
  bidAmount?: number;
  format: 'SINGLE_IMAGE' | 'CAROUSEL' | 'VIDEO' | 'MESSAGE';
}

export interface GoogleAdsSettings {
  campaignType: 'SEARCH' | 'DISPLAY' | 'VIDEO' | 'SHOPPING';
  bidStrategy: 'CPC' | 'CPA' | 'MAXIMIZE_CONVERSIONS';
  networkSettings: {
    searchNetwork: boolean;
    displayNetwork: boolean;
    partnerNetwork: boolean;
  };
  keywords?: {
    text: string;
    matchType: 'EXACT' | 'PHRASE' | 'BROAD';
  }[];
}

export interface PlatformSettings {
  linkedin?: LinkedInSettings;
  google?: GoogleAdsSettings;
}

// Performance and optimization interfaces
export interface PerformanceMetrics {
  processingTime: number;
  validationTime: number;
  optimizationScore: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
  };
  platformMetrics: {
    apiLatency: number;
    requestCount: number;
  };
}

export interface OptimizationHints {
  suggestedBidAdjustments: {
    factor: number;
    dimension: string;
    confidence: number;
  }[];
  audienceExpansionSuggestions: {
    segment: string;
    potentialReach: number;
    expectedCTR: number;
  }[];
  budgetRecommendations: {
    recommended: number;
    min: number;
    max: number;
    reason: string;
  };
}

// Validation interfaces
export interface Rule {
  field: string;
  condition: string;
  value: any;
  errorMessage: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
}

export type ValidatorFunction = (campaign: Campaign) => Promise<ErrorResponse[]>;

export interface ValidationRules {
  level: ValidationLevel;
  rules: Rule[];
  customValidators: ValidatorFunction[];
  platformSpecificRules: {
    linkedin?: Rule[];
    google?: Rule[];
  };
}

// Template interfaces
export interface CompatibilityRules {
  minimumVersion: string;
  maximumVersion: string;
  requiredFeatures: string[];
  platformCompatibility: PlatformType[];
  restrictions: {
    field: string;
    rule: string;
  }[];
}

export interface PerformanceHints {
  expectedProcessingTime: number;
  resourceRequirements: {
    minCpu: number;
    minMemory: number;
  };
  scalingLimits: {
    maxConcurrent: number;
    maxPerHour: number;
  };
}

// Main interfaces
export interface Campaign {
  id: UUID;
  name: string;
  description: string;
  platformType: PlatformType;
  totalBudget: number;
  budgetType: BudgetType;
  dateRange: DateRange;
  status: CampaignStatus;
  processingStatus: ProcessingStatus;
  estimatedProcessingTime: number;
  targetingSettings: TargetingSettings;
  platformSettings: PlatformSettings;
  performanceMetrics: PerformanceMetrics;
  validationRules: ValidationRules;
  optimizationHints: OptimizationHints;
  version: string;
  createdAt: string;
  updatedAt: string;
  createdBy: UUID;
  updatedBy: UUID;
}

export interface CampaignTemplate {
  id: UUID;
  name: string;
  description: string;
  version: string;
  platformType: PlatformType;
  compatibilityRules: CompatibilityRules;
  performanceHints: PerformanceHints;
  targetingSettings: TargetingSettings;
  platformSettings: PlatformSettings;
  validationRules: ValidationRules;
  createdAt: string;
  updatedAt: string;
  createdBy: UUID;
  isActive: boolean;
}

// API response types
export interface CampaignResponse extends BaseResponse<Campaign> {
  validationResults?: ErrorResponse[];
  processingMetrics?: {
    startTime: string;
    endTime: string;
    duration: number;
  };
}

export interface CampaignTemplateResponse extends BaseResponse<CampaignTemplate> {
  compatibilityStatus: {
    isCompatible: boolean;
    incompatibilityReasons?: string[];
  };
}