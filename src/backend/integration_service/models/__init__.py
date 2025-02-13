"""
Package initializer for integration service models that exposes platform configuration models 
and schemas for LinkedIn Ads and Google Ads integrations with comprehensive validation.
"""

from integration_service.models.platform_config import (  # platform_config.py v1.0.0
    LinkedInAdsConfig,
    GoogleAdsConfig, 
    PlatformConfig,
    LINKEDIN_API_VERSION,
    GOOGLE_ADS_API_VERSION
)

# API Version Constants
LINKEDIN_API_VERSION = "v2.0"  # LinkedIn Marketing API v2.0
GOOGLE_ADS_API_VERSION = "v14"  # Google Ads API v14

# Platform configuration mapping
PLATFORM_CONFIGS = {
    "linkedin": LinkedInAdsConfig,
    "google": GoogleAdsConfig
}

# Export all required classes and constants
__all__ = [
    "LinkedInAdsConfig",
    "GoogleAdsConfig", 
    "PlatformConfig",
    "LINKEDIN_API_VERSION",
    "GOOGLE_ADS_API_VERSION",
    "PLATFORM_CONFIGS"
]