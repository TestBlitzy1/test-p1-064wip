"""
Integration service adapters package providing a unified interface for interacting with 
advertising platforms with comprehensive security, monitoring and error handling.

Version: 1.0.0
"""

import logging
from typing import Dict, Union, Optional

from .google_ads import GoogleAdsAdapter
from .linkedin_ads import LinkedInAdsAdapter
from common.logging.logger import ServiceLogger

# Platform adapter mapping
SUPPORTED_PLATFORMS = {
    "google_ads": GoogleAdsAdapter,
    "linkedin": LinkedInAdsAdapter
}

# Initialize service logger
logger = ServiceLogger("integration_service_adapters")

def get_adapter(platform_name: str, config: Dict[str, any]) -> Union[GoogleAdsAdapter, LinkedInAdsAdapter]:
    """
    Factory function to get the appropriate platform adapter instance with validation and monitoring.
    
    Args:
        platform_name: Name of the advertising platform ("google_ads" or "linkedin")
        config: Platform-specific configuration dictionary
        
    Returns:
        Configured platform adapter instance
        
    Raises:
        ValueError: If platform is not supported or configuration is invalid
        Exception: For other initialization errors
    """
    try:
        # Validate platform name
        if platform_name not in SUPPORTED_PLATFORMS:
            logger.error(
                "Unsupported platform requested",
                extra={
                    "platform": platform_name,
                    "supported_platforms": list(SUPPORTED_PLATFORMS.keys())
                }
            )
            raise ValueError(f"Unsupported platform: {platform_name}")

        # Get adapter class
        adapter_class = SUPPORTED_PLATFORMS[platform_name]
        
        logger.info(
            "Initializing platform adapter",
            extra={
                "platform": platform_name,
                "adapter_class": adapter_class.__name__
            }
        )

        # Initialize adapter with config
        adapter = adapter_class(config)
        
        logger.info(
            "Platform adapter initialized successfully",
            extra={
                "platform": platform_name,
                "adapter_class": adapter_class.__name__
            }
        )
        
        return adapter

    except Exception as e:
        logger.error(
            "Failed to initialize platform adapter",
            exc=e,
            extra={
                "platform": platform_name,
                "error": str(e)
            }
        )
        raise

# Export adapter classes and factory function
__all__ = [
    'GoogleAdsAdapter',
    'LinkedInAdsAdapter', 
    'get_adapter'
]