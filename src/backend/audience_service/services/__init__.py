"""
Core initialization module for the audience service layer providing a unified interface for 
AI-powered audience segmentation and targeting operations. Implements lazy loading pattern 
and comprehensive type validation.

Version: 1.0.0
"""

from typing import Dict, Any, Optional

from .segmentation import AudienceSegmentationService
from .targeting import TargetingService

# Module version
__version__ = "1.0.0"

# Expose core service classes
__all__ = ["AudienceSegmentationService", "TargetingService"]

# Cache for lazy-loaded service instances
_service_instances: Dict[str, Any] = {}

def get_segmentation_service(cache_config: Optional[Dict[str, Any]] = None) -> AudienceSegmentationService:
    """
    Get or create an instance of the AudienceSegmentationService using lazy loading pattern.

    Args:
        cache_config: Optional Redis cache configuration for service optimization

    Returns:
        Configured AudienceSegmentationService instance
    """
    if "segmentation" not in _service_instances:
        _service_instances["segmentation"] = AudienceSegmentationService(
            cache_config or {}
        )
    return _service_instances["segmentation"]

def get_targeting_service(
    linkedin_adapter: Optional[Any] = None,
    google_adapter: Optional[Any] = None
) -> TargetingService:
    """
    Get or create an instance of the TargetingService using lazy loading pattern.

    Args:
        linkedin_adapter: Optional LinkedIn Ads platform adapter
        google_adapter: Optional Google Ads platform adapter

    Returns:
        Configured TargetingService instance
    """
    if "targeting" not in _service_instances:
        _service_instances["targeting"] = TargetingService(
            linkedin_adapter=linkedin_adapter,
            google_adapter=google_adapter
        )
    return _service_instances["targeting"]

def cleanup_services() -> None:
    """
    Cleanup and release resources held by service instances.
    Should be called during application shutdown.
    """
    global _service_instances
    _service_instances.clear()