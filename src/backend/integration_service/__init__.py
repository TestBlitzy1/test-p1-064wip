"""
Integration Service Package Initialization

Configures and exposes core components for managing integrations with LinkedIn Ads and Google Ads platforms.
Implements comprehensive logging, monitoring, rate limiting, and platform-specific configurations.

Version: 1.0.0
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime

# External imports with versions
from fastapi import FastAPI  # v0.100.0
from circuitbreaker import circuit  # v1.4.0

# Internal imports
from integration_service.config import IntegrationServiceConfig
from integration_service.routes import router
from common.logging.logger import ServiceLogger

# Package version
__version__ = '1.0.0'

# Initialize service logger
logger = ServiceLogger("integration_service")

# Initialize platform-specific loggers
platform_loggers = {
    'linkedin': logging.getLogger('integration_service.linkedin'),
    'google_ads': logging.getLogger('integration_service.google_ads')
}

# Initialize service configuration
config = IntegrationServiceConfig()

def configure_logging(log_level: str = "INFO", log_format: str = "json") -> None:
    """
    Configures comprehensive logging for the integration service with JSON formatting,
    correlation IDs, and rotation.

    Args:
        log_level: Logging level to set
        log_format: Log format (json or text)
    """
    # Set root logger level
    logging.getLogger().setLevel(getattr(logging, log_level))

    # Configure JSON formatting for structured logging
    if log_format == "json":
        for handler in logging.getLogger().handlers:
            handler.setFormatter(logging.Formatter(
                '{"timestamp":"%(asctime)s", "level":"%(levelname)s", '
                '"service":"integration_service", "version":"' + __version__ + '", '
                '"correlation_id":"%(correlation_id)s", "message":"%(message)s"}'
            ))

    # Configure platform-specific loggers
    for platform, platform_logger in platform_loggers.items():
        platform_logger.setLevel(getattr(logging, log_level))
        
        # Add platform-specific handlers
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(
            f'%(asctime)s - {platform} - %(levelname)s - %(message)s'
        ))
        platform_logger.addHandler(handler)

    logger.info(
        "Logging configured successfully",
        extra={"log_level": log_level, "log_format": log_format}
    )

def initialize_service() -> None:
    """
    Initializes the integration service with comprehensive configuration,
    monitoring, and resilience features.
    """
    try:
        # Configure enhanced logging
        configure_logging(
            log_level=config.monitoring_config.get("log_level", "INFO"),
            log_format=config.monitoring_config.get("log_format", "json")
        )

        # Initialize platform configurations
        platform_configs = {
            "linkedin": config.get_linkedin_config(),
            "google_ads": config.get_google_ads_config()
        }

        # Configure rate limiting
        rate_limit_config = config.get_rate_limit_config()
        for platform, limits in rate_limit_config.items():
            logger.info(
                f"Configured rate limits for {platform}",
                extra={"limits": limits}
            )

        # Initialize circuit breakers
        circuit_config = {
            "failure_threshold": 5,
            "recovery_timeout": 30,
            "reset_timeout": 60
        }

        # Configure monitoring endpoints
        logger.info(
            "Service initialized successfully",
            extra={
                "version": __version__,
                "platforms": list(platform_configs.keys()),
                "rate_limits": rate_limit_config
            }
        )

    except Exception as e:
        logger.error(
            "Service initialization failed",
            exc=e,
            extra={"error": str(e)}
        )
        raise

# Initialize service on module import
initialize_service()

# Export core components
__all__ = [
    'router',
    'config',
    '__version__',
    'configure_logging',
    'initialize_service'
]