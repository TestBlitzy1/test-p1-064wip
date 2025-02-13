"""
Constants module for the Integration Service.

This module defines platform-specific configurations, API versions, rate limits,
and other constant values used across LinkedIn Ads and Google Ads integrations.

Version: 1.0
"""

from enum import Enum, unique  # enum package version 3.11

# API Versions
LINKEDIN_API_VERSION = "v2"
GOOGLE_ADS_API_VERSION = "v14"

# API Base URLs
LINKEDIN_BASE_URL = "https://api.linkedin.com/v2"
GOOGLE_ADS_BASE_URL = "https://googleads.googleapis.com"

# Rate Limits (requests per minute)
LINKEDIN_CAMPAIGN_RATE_LIMIT = 100  # Campaign creation/management operations
LINKEDIN_REPORTING_RATE_LIMIT = 500  # Reporting operations
GOOGLE_ADS_RATE_LIMIT = 150  # Campaign management operations
RATE_LIMIT_WINDOW = 60  # Time window in seconds for rate limiting

# Retry Configuration
MAX_RETRIES = 3  # Maximum number of retry attempts for failed requests
RETRY_BACKOFF_FACTOR = 2  # Exponential backoff factor for retries

# Request Configuration
REQUEST_TIMEOUT = 30  # Request timeout in seconds
BATCH_SIZE = 50  # Batch size for bulk operations
SYNC_INTERVAL_MINUTES = 15  # Interval for data synchronization

@unique
class PlatformType(Enum):
    """
    Enum defining supported advertising platforms.
    
    This enumeration is used to identify and configure platform-specific
    behavior throughout the integration service.
    """
    LINKEDIN = "linkedin"
    GOOGLE_ADS = "google_ads"

@unique
class CampaignStatus(Enum):
    """
    Enum defining possible campaign statuses.
    
    These statuses represent the lifecycle states of advertising campaigns
    across supported platforms.
    """
    DRAFT = "draft"
    PENDING = "pending"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"

# Platform-specific error codes and messages can be added here as needed
LINKEDIN_ERROR_CODES = {
    "0": "Success",
    "400": "Bad Request",
    "401": "Unauthorized",
    "403": "Forbidden",
    "404": "Not Found",
    "429": "Too Many Requests",
    "500": "Internal Server Error"
}

GOOGLE_ADS_ERROR_CODES = {
    "AUTHENTICATION_ERROR": "Authentication failed",
    "AUTHORIZATION_ERROR": "Authorization failed",
    "INVALID_ARGUMENT": "Invalid argument provided",
    "QUOTA_ERROR": "Quota exceeded",
    "RATE_LIMIT_ERROR": "Rate limit exceeded",
    "INTERNAL_ERROR": "Internal server error"
}

# Campaign configuration limits
CAMPAIGN_LIMITS = {
    "max_name_length": 255,
    "max_daily_budget": 100000,  # in smallest currency unit
    "min_daily_budget": 5,       # in smallest currency unit
    "max_ads_per_group": 50,
    "max_groups_per_campaign": 100
}

# Compliance and policy constants
COMPLIANCE_SETTINGS = {
    "require_consent": True,
    "data_retention_days": 365,
    "privacy_policy_version": "1.0",
    "terms_version": "1.0"
}