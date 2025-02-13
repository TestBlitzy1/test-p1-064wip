"""
Integration Service Configuration Module

This module manages platform-specific settings, API credentials, and integration configurations
for LinkedIn Ads and Google Ads platforms with comprehensive security and monitoring capabilities.

Version: 1.0.0
"""

from typing import Dict, Optional, List
import os
import json

# External imports
import pydantic  # v2.0.0

# Internal imports
from common.config.settings import BaseConfig
from integration_service.constants import (
    PlatformType,
    LINKEDIN_API_VERSION,
    GOOGLE_ADS_API_VERSION,
    LINKEDIN_BASE_URL,
    GOOGLE_ADS_BASE_URL,
    LINKEDIN_CAMPAIGN_RATE_LIMIT,
    LINKEDIN_REPORTING_RATE_LIMIT,
    GOOGLE_ADS_RATE_LIMIT,
    RATE_LIMIT_WINDOW,
    MAX_RETRIES,
    RETRY_BACKOFF_FACTOR,
    REQUEST_TIMEOUT,
    CAMPAIGN_LIMITS,
    COMPLIANCE_SETTINGS
)

@pydantic.dataclasses.dataclass
class IntegrationServiceConfig(BaseConfig):
    """
    Configuration class for Integration Service extending BaseConfig with platform-specific settings.
    Manages configurations for LinkedIn Ads and Google Ads integrations with comprehensive
    security, rate limiting, and retry policies.
    """

    def __init__(self):
        """Initialize integration service configuration with platform-specific settings."""
        super().__init__(service_name='integration_service')
        self.linkedin_config = self.get_linkedin_config()
        self.google_ads_config = self.get_google_ads_config()
        self.rate_limit_config = self.get_rate_limit_config()
        self.retry_config = self.get_retry_config()

    def get_linkedin_config(self) -> Dict:
        """
        Returns LinkedIn platform configuration settings with API credentials,
        endpoints, and platform-specific parameters.
        """
        return {
            'platform': PlatformType.LINKEDIN.value,
            'api_version': LINKEDIN_API_VERSION,
            'base_url': LINKEDIN_BASE_URL,
            'client_id': os.getenv('LINKEDIN_CLIENT_ID'),
            'client_secret': os.getenv('LINKEDIN_CLIENT_SECRET'),
            'access_token': os.getenv('LINKEDIN_ACCESS_TOKEN'),
            'organization_id': os.getenv('LINKEDIN_ORGANIZATION_ID'),
            'campaign_endpoints': {
                'create': '/adCampaignsV2',
                'update': '/adCampaignsV2/{id}',
                'delete': '/adCampaignsV2/{id}',
                'get': '/adCampaignsV2/{id}',
                'list': '/adCampaignsV2',
                'analytics': '/adAnalyticsV2'
            },
            'compliance': {
                'data_retention_days': COMPLIANCE_SETTINGS['data_retention_days'],
                'require_consent': COMPLIANCE_SETTINGS['require_consent'],
                'privacy_policy_version': COMPLIANCE_SETTINGS['privacy_policy_version']
            },
            'limits': {
                'max_name_length': CAMPAIGN_LIMITS['max_name_length'],
                'max_daily_budget': CAMPAIGN_LIMITS['max_daily_budget'],
                'min_daily_budget': CAMPAIGN_LIMITS['min_daily_budget'],
                'max_ads_per_group': CAMPAIGN_LIMITS['max_ads_per_group']
            }
        }

    def get_google_ads_config(self) -> Dict:
        """
        Returns Google Ads platform configuration settings with API credentials,
        endpoints, and platform-specific parameters.
        """
        return {
            'platform': PlatformType.GOOGLE_ADS.value,
            'api_version': GOOGLE_ADS_API_VERSION,
            'base_url': GOOGLE_ADS_BASE_URL,
            'client_id': os.getenv('GOOGLE_ADS_CLIENT_ID'),
            'client_secret': os.getenv('GOOGLE_ADS_CLIENT_SECRET'),
            'developer_token': os.getenv('GOOGLE_ADS_DEVELOPER_TOKEN'),
            'refresh_token': os.getenv('GOOGLE_ADS_REFRESH_TOKEN'),
            'customer_id': os.getenv('GOOGLE_ADS_CUSTOMER_ID'),
            'campaign_endpoints': {
                'create': '/customers/{customer_id}/campaigns:mutate',
                'update': '/customers/{customer_id}/campaigns:mutate',
                'delete': '/customers/{customer_id}/campaigns:mutate',
                'get': '/customers/{customer_id}/campaigns/{id}',
                'list': '/customers/{customer_id}/campaigns',
                'analytics': '/customers/{customer_id}/googleAds:search'
            },
            'compliance': {
                'data_retention_days': COMPLIANCE_SETTINGS['data_retention_days'],
                'require_consent': COMPLIANCE_SETTINGS['require_consent'],
                'privacy_policy_version': COMPLIANCE_SETTINGS['privacy_policy_version']
            },
            'limits': {
                'max_name_length': CAMPAIGN_LIMITS['max_name_length'],
                'max_daily_budget': CAMPAIGN_LIMITS['max_daily_budget'],
                'min_daily_budget': CAMPAIGN_LIMITS['min_daily_budget'],
                'max_ads_per_group': CAMPAIGN_LIMITS['max_ads_per_group']
            }
        }

    def get_rate_limit_config(self) -> Dict:
        """
        Returns rate limiting configuration for API requests with platform-specific
        thresholds and window settings.
        """
        return {
            'linkedin': {
                'campaign_operations': {
                    'requests_per_minute': LINKEDIN_CAMPAIGN_RATE_LIMIT,
                    'window_seconds': RATE_LIMIT_WINDOW
                },
                'reporting_operations': {
                    'requests_per_minute': LINKEDIN_REPORTING_RATE_LIMIT,
                    'window_seconds': RATE_LIMIT_WINDOW
                }
            },
            'google_ads': {
                'campaign_operations': {
                    'requests_per_minute': GOOGLE_ADS_RATE_LIMIT,
                    'window_seconds': RATE_LIMIT_WINDOW
                }
            },
            'storage': {
                'backend': 'redis',
                'key_prefix': 'rate_limit',
                'expire_seconds': RATE_LIMIT_WINDOW * 2
            },
            'monitoring': {
                'enable_alerts': True,
                'threshold_percentage': 80,
                'alert_interval': 300
            }
        }

    def get_retry_config(self) -> Dict:
        """
        Returns retry configuration for failed API requests with backoff strategy
        and platform-specific settings.
        """
        return {
            'max_attempts': MAX_RETRIES,
            'backoff_factor': RETRY_BACKOFF_FACTOR,
            'request_timeout': REQUEST_TIMEOUT,
            'retry_on_status_codes': [408, 429, 500, 502, 503, 504],
            'circuit_breaker': {
                'failure_threshold': 5,
                'recovery_timeout': 30,
                'reset_timeout': 60
            },
            'monitoring': {
                'enable_logging': True,
                'alert_on_consecutive_failures': 3
            },
            'platform_specific': {
                'linkedin': {
                    'max_attempts': MAX_RETRIES,
                    'retry_on_errors': ['RATE_LIMIT_EXCEEDED', 'SERVER_ERROR']
                },
                'google_ads': {
                    'max_attempts': MAX_RETRIES,
                    'retry_on_errors': ['QUOTA_ERROR', 'RATE_LIMIT_ERROR', 'INTERNAL_ERROR']
                }
            }
        }