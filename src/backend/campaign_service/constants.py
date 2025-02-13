"""
Constants and enumerations for the campaign service.

This module defines all constant values and enumerations used throughout the campaign service
for managing digital advertising campaigns. It includes definitions for campaign statuses,
platform types, budget constraints, and validation rules.

Version: 1.0.0
"""

from enum import Enum  # version: 3.11+

class CAMPAIGN_STATUS(Enum):
    """Campaign lifecycle status values."""
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ARCHIVED = "ARCHIVED"

class PLATFORM_TYPES(Enum):
    """Supported advertising platform types."""
    LINKEDIN_ADS = "LINKEDIN_ADS"
    GOOGLE_ADS = "GOOGLE_ADS"

# Performance requirements
CAMPAIGN_GENERATION_TIMEOUT = 30  # Maximum seconds allowed for campaign generation

# Budget constraints (in USD)
MIN_CAMPAIGN_BUDGET = 100.0
MAX_CAMPAIGN_BUDGET = 1000000.0
MIN_AD_GROUP_BUDGET = 50.0
BUDGET_PRECISION = 2  # Decimal places for budget calculations

# Campaign structure constraints
CAMPAIGN_NAME_MAX_LENGTH = 120
AD_GROUP_NAME_MAX_LENGTH = 100
MAX_AD_GROUPS_PER_CAMPAIGN = 50

# Campaign objectives
SUPPORTED_OBJECTIVES = {
    'BRAND_AWARENESS',
    'WEBSITE_TRAFFIC',
    'LEAD_GENERATION',
    'WEBSITE_CONVERSIONS'
}

# Platform-specific ad formats
LINKEDIN_AD_FORMATS = {
    'SINGLE_IMAGE_AD',
    'CAROUSEL_AD',
    'VIDEO_AD',
    'TEXT_AD',
    'SPOTLIGHT_AD'
}

GOOGLE_AD_FORMATS = {
    'RESPONSIVE_SEARCH_AD',
    'EXPANDED_TEXT_AD',
    'DISPLAY_AD',
    'VIDEO_AD'
}