"""
Campaign service configuration module extending base configuration with campaign-specific settings.

This module provides comprehensive configuration management for the campaign service,
including platform integrations, performance requirements, and service-specific parameters.

Version: 1.0.0
"""

from typing import Dict, Optional  # version: 3.11+
from pydantic import Field  # version: 2.0.0

from common.config.settings import BaseConfig
from campaign_service.constants import (
    CAMPAIGN_GENERATION_TIMEOUT,
    PLATFORM_TYPES
)

# Default maximum number of campaigns that can be processed concurrently
DEFAULT_MAX_CONCURRENT_CAMPAIGNS = 100

# Default platform-specific settings
DEFAULT_PLATFORM_SETTINGS = {
    'linkedin_ads': {
        'api_version': '202401',
        'request_timeout': 30,
        'max_retries': 3,
        'rate_limits': {
            'campaign_creation': 100,  # requests per minute
            'reporting': 500  # requests per minute
        },
        'batch_size': 50,
        'retry_delay': 5  # seconds
    },
    'google_ads': {
        'api_version': 'v15',
        'request_timeout': 30,
        'max_retries': 3,
        'rate_limits': {
            'campaign_creation': 150,  # requests per minute
            'reporting': 1000  # requests per minute
        },
        'batch_size': 100,
        'retry_delay': 3  # seconds
    }
}

class CampaignServiceConfig(BaseConfig):
    """
    Campaign service specific configuration extending BaseConfig with campaign-related settings.
    Implements performance requirements and platform integration configurations.
    """

    def __init__(self):
        """Initialize campaign service configuration with default values and environment overrides."""
        super().__init__(service_name='campaign_service')
        
        # Campaign generation performance settings
        self.campaign_generation_timeout: int = int(
            self._get_env('CAMPAIGN_GENERATION_TIMEOUT', CAMPAIGN_GENERATION_TIMEOUT)
        )
        self.max_concurrent_campaigns: int = int(
            self._get_env('MAX_CONCURRENT_CAMPAIGNS', DEFAULT_MAX_CONCURRENT_CAMPAIGNS)
        )

        # Platform integration settings
        self.platform_settings: Dict = self._load_platform_settings()

        # Performance optimization settings
        self.performance_settings: Dict = {
            'timeout': self.campaign_generation_timeout,
            'max_concurrent': self.max_concurrent_campaigns,
            'batch_processing': True,
            'caching_enabled': True,
            'cache_ttl': 3600,  # 1 hour
            'performance_monitoring': True
        }

        # Rate limiting settings
        self.rate_limit_settings: Dict = {
            'enabled': True,
            'default_rate': 100,  # requests per minute
            'burst_multiplier': 1.5
        }

    def _load_platform_settings(self) -> Dict:
        """Load and validate platform-specific settings with environment overrides."""
        settings = DEFAULT_PLATFORM_SETTINGS.copy()
        
        # LinkedIn Ads overrides
        linkedin_settings = settings['linkedin_ads']
        linkedin_settings.update({
            'api_version': self._get_env('LINKEDIN_API_VERSION', linkedin_settings['api_version']),
            'request_timeout': int(self._get_env('LINKEDIN_REQUEST_TIMEOUT', linkedin_settings['request_timeout'])),
            'max_retries': int(self._get_env('LINKEDIN_MAX_RETRIES', linkedin_settings['max_retries']))
        })

        # Google Ads overrides
        google_settings = settings['google_ads']
        google_settings.update({
            'api_version': self._get_env('GOOGLE_ADS_API_VERSION', google_settings['api_version']),
            'request_timeout': int(self._get_env('GOOGLE_ADS_REQUEST_TIMEOUT', google_settings['request_timeout'])),
            'max_retries': int(self._get_env('GOOGLE_ADS_MAX_RETRIES', google_settings['max_retries']))
        })

        return settings

    def get_platform_config(self, platform_type: PLATFORM_TYPES) -> Dict:
        """
        Returns configuration for specified advertising platform.

        Args:
            platform_type: PLATFORM_TYPES enum value specifying the ad platform

        Returns:
            Dict containing platform-specific configuration settings

        Raises:
            ValueError: If platform_type is not supported
        """
        platform_key = platform_type.value.lower()
        if platform_key not in self.platform_settings:
            raise ValueError(f"Unsupported platform type: {platform_type}")
        return self.platform_settings[platform_key]

    def get_performance_config(self) -> Dict:
        """
        Returns performance-related configuration settings.

        Returns:
            Dict containing performance configuration including timeouts and limits
        """
        return {
            'generation_timeout': self.campaign_generation_timeout,
            'max_concurrent_campaigns': self.max_concurrent_campaigns,
            'performance_settings': self.performance_settings,
            'rate_limits': self.rate_limit_settings
        }

    def _get_env(self, key: str, default: any) -> str:
        """Helper method to get environment variables with defaults."""
        return self.env_vars.get(key, default)