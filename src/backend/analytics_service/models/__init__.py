"""
Analytics service models initialization providing centralized access to campaign metrics 
and performance data models with comprehensive type safety and validation.

Version: 1.0.0
"""

from datetime import datetime
from typing import Dict, Any

# Import core analytics models
from .campaign_metrics import (
    CampaignMetrics,
    CampaignMetricsSchema,
    SUPPORTED_PLATFORMS,
    FINANCIAL_PRECISION,
    PERCENTAGE_PRECISION
)

from .performance_data import (
    PerformanceData,
    METRICS_CACHE_TTL,
    AGGREGATION_WINDOW,
    CONFIDENCE_LEVEL
)

# Module version and configuration
VERSION = "1.0.0"
METRICS_CACHE_TTL = 300  # 5 minutes cache TTL
MAX_CONCURRENT_CALCULATIONS = 1000

# Performance optimization settings
PERFORMANCE_CONFIG = {
    'max_calculation_time': 100,  # milliseconds
    'cache_strategy': 'LRU',
    'cache_ttl': METRICS_CACHE_TTL,
    'max_concurrent_requests': MAX_CONCURRENT_CALCULATIONS,
    'data_retention_period': {
        'hot_data': 90,  # days
        'warm_data': 365,  # days
        'cold_data': 1095  # days (3 years)
    }
}

# Export core models and schemas
__all__ = [
    # Core metric models
    'CampaignMetrics',
    'CampaignMetricsSchema',
    'PerformanceData',
    
    # Constants and configurations
    'VERSION',
    'METRICS_CACHE_TTL',
    'MAX_CONCURRENT_CALCULATIONS',
    'SUPPORTED_PLATFORMS',
    'FINANCIAL_PRECISION',
    'PERCENTAGE_PRECISION',
    'CONFIDENCE_LEVEL',
    'AGGREGATION_WINDOW',
    'PERFORMANCE_CONFIG'
]

# Initialize module timestamp
MODULE_INITIALIZED = datetime.utcnow()

def get_module_info() -> Dict[str, Any]:
    """
    Get module information and configuration details.

    Returns:
        Dict[str, Any]: Module information including version and configuration
    """
    return {
        'version': VERSION,
        'initialized_at': MODULE_INITIALIZED,
        'supported_platforms': SUPPORTED_PLATFORMS,
        'performance_config': PERFORMANCE_CONFIG,
        'cache_config': {
            'strategy': PERFORMANCE_CONFIG['cache_strategy'],
            'ttl': METRICS_CACHE_TTL
        }
    }