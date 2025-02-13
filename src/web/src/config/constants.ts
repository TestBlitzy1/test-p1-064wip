/**
 * Core constants and configuration values for the Sales & Intelligence Platform
 * @version 1.0.0
 */

// API Configuration
export const API_VERSION = 'v1';
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// API Endpoint Type Definitions
type AuthEndpoints = {
  LOGIN: string;
  LOGOUT: string;
  REFRESH: string;
  VERIFY: string;
};

type CampaignEndpoints = {
  BASE: string;
  DETAIL: string;
  METRICS: string;
  OPTIMIZE: string;
};

type AnalyticsEndpoints = {
  DASHBOARD: string;
  REPORTS: string;
  EXPORT: string;
};

type TargetingEndpoints = {
  AUDIENCE: string;
  SEGMENTS: string;
  RECOMMENDATIONS: string;
};

// API Endpoints Configuration
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    VERIFY: '/auth/verify'
  } as AuthEndpoints,
  
  CAMPAIGNS: {
    BASE: '/campaigns',
    DETAIL: '/campaigns/:id',
    METRICS: '/campaigns/:id/metrics',
    OPTIMIZE: '/campaigns/:id/optimize'
  } as CampaignEndpoints,
  
  ANALYTICS: {
    DASHBOARD: '/analytics/dashboard',
    REPORTS: '/analytics/reports',
    EXPORT: '/analytics/export'
  } as AnalyticsEndpoints,
  
  TARGETING: {
    AUDIENCE: '/targeting/audience',
    SEGMENTS: '/targeting/segments',
    RECOMMENDATIONS: '/targeting/recommendations'
  } as TargetingEndpoints
};

// Application Route Type Definitions
type CampaignRoutes = {
  LIST: string;
  CREATE: string;
  EDIT: string;
  DETAIL: string;
  ANALYTICS: string;
};

type AnalyticsRoutes = {
  DASHBOARD: string;
  REPORTS: string;
  CUSTOM: string;
};

type SettingsRoutes = {
  PROFILE: string;
  ORGANIZATION: string;
  INTEGRATIONS: string;
  BILLING: string;
};

type AuthRoutes = {
  LOGIN: string;
  SIGNUP: string;
  FORGOT_PASSWORD: string;
  RESET_PASSWORD: string;
};

// Application Routes Configuration
export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  CAMPAIGNS: {
    LIST: '/campaigns',
    CREATE: '/campaigns/create',
    EDIT: '/campaigns/[id]/edit',
    DETAIL: '/campaigns/[id]',
    ANALYTICS: '/campaigns/[id]/analytics'
  } as CampaignRoutes,
  
  ANALYTICS: {
    DASHBOARD: '/analytics',
    REPORTS: '/analytics/reports',
    CUSTOM: '/analytics/custom'
  } as AnalyticsRoutes,
  
  SETTINGS: {
    PROFILE: '/settings/profile',
    ORGANIZATION: '/settings/organization',
    INTEGRATIONS: '/settings/integrations',
    BILLING: '/settings/billing'
  } as SettingsRoutes,
  
  AUTH: {
    LOGIN: '/login',
    SIGNUP: '/signup',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password'
  } as AuthRoutes
};

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

// User Role Constants
export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  ANALYST: 'analyst',
  VIEWER: 'viewer'
} as const;

// Campaign Status Constants
export const CAMPAIGN_STATUS = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  SCHEDULED: 'scheduled',
  ACTIVE: 'active',
  PAUSED: 'paused',
  OPTIMIZING: 'optimizing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  ARCHIVED: 'archived'
} as const;

// Platform Type Constants
export const PLATFORM_TYPES = {
  LINKEDIN: 'linkedin',
  GOOGLE: 'google'
} as const;

// Validation Constraints
export const VALIDATION_LIMITS = {
  CAMPAIGN_NAME_MIN: 3,
  CAMPAIGN_NAME_MAX: 100,
  BUDGET_MIN: 100,
  BUDGET_MAX: 1000000,
  AD_COPY_MIN: 25,
  AD_COPY_MAX: 150
} as const;

// Type exports for consuming components
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
export type CampaignStatus = typeof CAMPAIGN_STATUS[keyof typeof CAMPAIGN_STATUS];
export type PlatformType = typeof PLATFORM_TYPES[keyof typeof PLATFORM_TYPES];