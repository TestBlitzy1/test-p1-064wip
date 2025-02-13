"""
Configuration module for the Audience Service providing audience-specific settings,
validation rules, and ML model configuration.

Version: 1.0.0
"""

from typing import Dict, Optional  # v3.11+
from pydantic import Field  # v2.0.0

from common.config.settings import BaseConfig
from audience_service.constants import (
    SERVICE_NAME,
    MIN_AUDIENCE_SIZE,
    MAX_AUDIENCE_SIZE,
    CACHE_TTL,
    BATCH_SIZE,
    TARGETING_RULE_CONSTRAINTS,
    SUPPORTED_RULE_TYPES
)

class AudienceServiceConfig(BaseConfig):
    """
    Configuration class for the Audience Service with specific settings
    for AI-powered audience segmentation and targeting optimization.
    """

    def __init__(self):
        """Initialize audience service configuration with environment-specific settings."""
        super().__init__(service_name=SERVICE_NAME)
        
        # ML model configuration
        self.model_path: str = self._get_env_var('MODEL_PATH', '/opt/models/audience_segmentation')
        self.batch_size: int = self._get_env_var('BATCH_SIZE', BATCH_SIZE)
        self.cache_ttl: int = self._get_env_var('CACHE_TTL', CACHE_TTL)
        
        # Initialize service-specific configurations
        self.segmentation_settings = self.get_segmentation_config()
        self.targeting_settings = self.get_targeting_config()
        self.ml_settings = self.get_ml_config()

    def get_segmentation_config(self) -> Dict:
        """
        Returns configuration for AI-powered audience segmentation including
        thresholds and validation rules.
        """
        return {
            'min_audience_size': self._get_env_var('MIN_AUDIENCE_SIZE', MIN_AUDIENCE_SIZE),
            'max_audience_size': self._get_env_var('MAX_AUDIENCE_SIZE', MAX_AUDIENCE_SIZE),
            'enable_auto_optimization': self._get_env_var('ENABLE_AUTO_OPTIMIZATION', True),
            'similarity_threshold': self._get_env_var('SIMILARITY_THRESHOLD', 0.75),
            'refresh_interval': self._get_env_var('SEGMENT_REFRESH_INTERVAL', 3600),
            'max_segments_per_campaign': self._get_env_var('MAX_SEGMENTS_PER_CAMPAIGN', 10),
            'supported_rule_types': SUPPORTED_RULE_TYPES
        }

    def get_targeting_config(self) -> Dict:
        """
        Returns configuration for targeting optimization including
        rules, constraints and validation thresholds.
        """
        return {
            'targeting_constraints': TARGETING_RULE_CONSTRAINTS,
            'enable_real_time_validation': self._get_env_var('ENABLE_REAL_TIME_VALIDATION', True),
            'enable_auto_suggestions': self._get_env_var('ENABLE_AUTO_SUGGESTIONS', True),
            'max_concurrent_optimizations': self._get_env_var('MAX_CONCURRENT_OPTIMIZATIONS', 100),
            'optimization_interval': self._get_env_var('OPTIMIZATION_INTERVAL', 1800),
            'performance_threshold': self._get_env_var('PERFORMANCE_THRESHOLD', 0.8),
            'validation_timeout': self._get_env_var('VALIDATION_TIMEOUT', 30)
        }

    def get_ml_config(self) -> Dict:
        """
        Returns configuration for ML model settings including
        model paths, parameters and processing settings.
        """
        return {
            'model_path': self.model_path,
            'batch_size': self.batch_size,
            'inference_timeout': self._get_env_var('ML_INFERENCE_TIMEOUT', 60),
            'max_concurrent_inferences': self._get_env_var('MAX_CONCURRENT_INFERENCES', 50),
            'enable_gpu': self._get_env_var('ENABLE_GPU', False),
            'model_version': self._get_env_var('MODEL_VERSION', 'v1.0.0'),
            'feature_store': {
                'host': self._get_env_var('FEATURE_STORE_HOST', 'localhost'),
                'port': self._get_env_var('FEATURE_STORE_PORT', 6379),
                'ttl': self.cache_ttl
            },
            'monitoring': {
                'enable_prediction_logging': self._get_env_var('ENABLE_PREDICTION_LOGGING', True),
                'sampling_rate': self._get_env_var('PREDICTION_SAMPLING_RATE', 0.1),
                'performance_logging_interval': self._get_env_var('PERFORMANCE_LOGGING_INTERVAL', 300)
            }
        }

    def _get_env_var(self, key: str, default: any) -> any:
        """Helper method to get environment variables with type casting."""
        value = self.env_vars.get(f"AUDIENCE_SERVICE_{key}", default)
        if isinstance(default, bool):
            return str(value).lower() == 'true' if isinstance(value, str) else value
        if isinstance(default, (int, float)):
            return type(default)(value) if isinstance(value, str) else value
        return value