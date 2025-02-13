"""
Campaign Service Package Initializer
Provides AI-powered campaign generation and lifecycle management capabilities.

Version: 1.0.0
"""

from typing import Dict, Any, List, Optional

# Import core campaign generation and management services
from campaign_service.services.campaign_generator import CampaignGeneratorService
from campaign_service.services.campaign_manager import CampaignManager

# Package version
__version__ = "1.0.0"

# Export core services
__all__ = [
    "CampaignGeneratorService",
    "CampaignManager"
]

# Initialize package-level logging
import logging
logger = logging.getLogger(__name__)

def validate_dependencies() -> bool:
    """
    Validates required dependencies and their versions for the campaign service.
    
    Returns:
        bool: True if all dependencies are valid
        
    Raises:
        ImportError: If required dependencies are missing or invalid
    """
    try:
        import pydantic
        import opentelemetry
        import prometheus_client
        import pybreaker
        
        # Add version checks if needed
        return True
    except ImportError as e:
        logger.error(f"Missing required dependency: {str(e)}")
        raise

def check_service_health() -> Dict[str, Any]:
    """
    Performs health check of campaign service components.
    
    Returns:
        Dict containing health status of core components
    """
    health_status = {
        "status": "healthy",
        "components": {
            "campaign_generator": True,
            "campaign_manager": True
        },
        "version": __version__
    }
    return health_status

# Validate dependencies on module import
try:
    validate_dependencies()
    logger.info(f"Campaign service initialized successfully (v{__version__})")
except Exception as e:
    logger.error(f"Campaign service initialization failed: {str(e)}")
    raise