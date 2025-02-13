"""
Main entry point for AI service functionality, providing unified access to AI-powered 
campaign generation, content creation, and optimization capabilities with comprehensive 
error handling, logging, and performance monitoring.

Version: 1.0.0
"""

import asyncio
from typing import Dict, Any, Tuple, Optional
from functools import wraps

# Internal imports
from .model_loader import ModelLoader
from .inference import InferenceService
from .optimization import CampaignOptimizer
from ..config import AIServiceConfig
from common.monitoring.metrics import MetricsManager
from common.logging.logger import ServiceLogger

# Global constants
VERSION = '1.0.0'
SUPPORTED_PLATFORMS = ['linkedin', 'google']
DEFAULT_TIMEOUT = 30  # 30-second processing requirement
MAX_RETRIES = 3
CACHE_TTL = 300  # 5 minutes

def validate_platform(platform_name: str) -> bool:
    """
    Validates if the requested platform is supported.

    Args:
        platform_name: Name of the advertising platform

    Returns:
        bool: True if platform is supported
    """
    return platform_name.lower() in SUPPORTED_PLATFORMS

async def initialize_services(config: Dict[str, Any]) -> Tuple[ModelLoader, InferenceService, CampaignOptimizer]:
    """
    Initializes all AI services with comprehensive error handling and monitoring.

    Args:
        config: Service configuration parameters

    Returns:
        Tuple containing initialized service instances

    Raises:
        RuntimeError: If initialization fails
    """
    logger = ServiceLogger("ai_service")
    metrics = MetricsManager("ai_service")

    try:
        # Initialize configuration
        ai_config = AIServiceConfig()
        
        # Initialize model loader with GPU support
        model_loader = ModelLoader(ai_config)
        logger.info("Model loader initialized successfully")

        # Initialize inference service
        inference_service = InferenceService(model_loader)
        logger.info("Inference service initialized successfully")

        # Initialize optimizer for each platform
        optimizers = {}
        for platform in SUPPORTED_PLATFORMS:
            optimizer = CampaignOptimizer(
                platform=platform,
                config=config.get('optimization_config', {}),
                use_gpu=config.get('use_gpu', True)
            )
            optimizers[platform] = optimizer
            logger.info(f"Campaign optimizer initialized for {platform}")

        # Verify service health
        health_status = await verify_services_health(
            model_loader=model_loader,
            inference_service=inference_service,
            optimizers=optimizers
        )

        if not health_status['healthy']:
            raise RuntimeError(f"Service health check failed: {health_status['details']}")

        return model_loader, inference_service, optimizers

    except Exception as e:
        logger.error("Failed to initialize AI services", exc=e)
        metrics.get_counter('initialization_errors').inc()
        raise RuntimeError(f"Service initialization failed: {str(e)}")

async def verify_services_health(
    model_loader: ModelLoader,
    inference_service: InferenceService,
    optimizers: Dict[str, CampaignOptimizer]
) -> Dict[str, Any]:
    """
    Verifies health status of all AI service components.

    Args:
        model_loader: Initialized model loader instance
        inference_service: Initialized inference service instance
        optimizers: Dictionary of platform optimizers

    Returns:
        Dict containing health status and details
    """
    health_status = {
        'healthy': True,
        'details': {},
        'timestamp': asyncio.get_event_loop().time()
    }

    try:
        # Check model loader health
        model_health = model_loader.check_model_health("CAMPAIGN_GENERATOR")
        health_status['details']['model_loader'] = model_health

        # Check inference service health
        inference_health = await inference_service._get_model("CAMPAIGN_GENERATOR")
        health_status['details']['inference_service'] = {
            'status': 'healthy' if inference_health else 'unhealthy'
        }

        # Check optimizer health for each platform
        optimizer_health = {}
        for platform, optimizer in optimizers.items():
            optimizer_status = optimizer.check_model_health("PERFORMANCE_PREDICTOR")
            optimizer_health[platform] = optimizer_status
        health_status['details']['optimizers'] = optimizer_health

        return health_status

    except Exception as e:
        health_status['healthy'] = False
        health_status['details']['error'] = str(e)
        return health_status

# Export core services and utilities
__all__ = [
    'ModelLoader',
    'InferenceService',
    'CampaignOptimizer',
    'initialize_services',
    'validate_platform',
    'VERSION',
    'SUPPORTED_PLATFORMS'
]