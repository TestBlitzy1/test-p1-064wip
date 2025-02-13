"""
Audience service models initialization module providing comprehensive validation support
and centralized access to all audience-related data models with version tracking and 
performance optimization.

Version: 1.0.0
"""

from typing import Dict, Any, Optional
from functools import lru_cache

# Internal imports with version tracking
from audience_service.models.audience_segment import AudienceSegment  # v1.0.0
from audience_service.models.targeting_rules import (  # v1.0.0
    TargetingRule,
    IndustryRule,
    PLATFORM_TAXONOMIES
)

# Schema version for model validation
SCHEMA_VERSION = '1.0.0'

# Cache TTL for validation results (in seconds)
VALIDATION_CACHE_TTL = 3600

# Initialize validation cache for frequently used schemas
@lru_cache(maxsize=1000, ttl=VALIDATION_CACHE_TTL)
def initialize_validation_cache(ttl: int = VALIDATION_CACHE_TTL) -> None:
    """
    Initializes the validation cache for frequently used schemas with performance optimization.
    
    Args:
        ttl: Cache time-to-live in seconds
    """
    # Pre-load common validation rules for performance
    AudienceSegment.validate_reach(1000, 'linkedin')
    AudienceSegment.validate_reach(1000, 'google')
    
    # Initialize targeting rule validation cache
    base_rule = TargetingRule(
        rule_type='industry',
        operator='IN',
        criteria={'industries': ['software']}
    )
    base_rule.validate_platform_constraints('linkedin')
    base_rule.validate_platform_constraints('google')
    
    # Pre-load industry mappings
    industry_rule = IndustryRule(
        industries=['software'],
        include_subsidiaries=True
    )
    industry_rule._initialize_industry_mapping()

# Export models and schemas with validation support
__all__ = [
    # Core models
    'AudienceSegment',
    'TargetingRule',
    'IndustryRule',
    
    # Constants and configurations
    'SCHEMA_VERSION',
    'PLATFORM_TAXONOMIES',
    'VALIDATION_CACHE_TTL',
    
    # Utility functions
    'initialize_validation_cache',
]

# Initialize validation cache on module load
initialize_validation_cache()

# Version and schema information
__version__ = SCHEMA_VERSION
__schema_info__ = {
    'version': SCHEMA_VERSION,
    'models': {
        'AudienceSegment': {
            'version': '1.0.0',
            'validation_enabled': True,
            'cache_enabled': True
        },
        'TargetingRule': {
            'version': '1.0.0',
            'validation_enabled': True,
            'cache_enabled': True
        },
        'IndustryRule': {
            'version': '1.0.0',
            'validation_enabled': True,
            'cache_enabled': True
        }
    },
    'cache_config': {
        'ttl': VALIDATION_CACHE_TTL,
        'max_size': 1000
    }
}

def get_schema_info() -> Dict[str, Any]:
    """
    Returns current schema version and configuration information.
    
    Returns:
        Dict containing schema version and configuration details
    """
    return __schema_info__

def validate_schema_version(required_version: str) -> bool:
    """
    Validates compatibility with a required schema version.
    
    Args:
        required_version: Version string to validate against
        
    Returns:
        bool: True if current schema version is compatible
        
    Raises:
        ValueError: If incompatible schema version
    """
    if required_version != SCHEMA_VERSION:
        raise ValueError(
            f"Schema version mismatch. Required: {required_version}, "
            f"Current: {SCHEMA_VERSION}"
        )
    return True

def reset_validation_cache() -> None:
    """
    Resets the validation cache and reinitializes with default settings.
    """
    initialize_validation_cache.cache_clear()
    initialize_validation_cache()