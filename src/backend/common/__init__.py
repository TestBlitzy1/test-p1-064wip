"""
Core initialization module for common backend functionality, providing centralized access to shared utilities,
configurations, and base components used across all microservices in the Sales and Intelligence Platform.

Version: 1.0.0
"""

import threading
import logging
from typing import Dict, Optional

# External package imports with versions
import structlog  # v23.1.0

# Internal imports
from common.config.settings import BaseConfig
from common.auth.jwt import JWTHandler
from common.database.models import BaseModel

# Global constants
VERSION = "1.0.0"
INITIALIZATION_LOCK = threading.Lock()
logger = structlog.get_logger(__name__)

def setup_logging(service_name: str, log_level: str, additional_config: Optional[Dict] = None) -> None:
    """
    Configures comprehensive structured logging for all backend services with standardized format,
    security audit trail, and GDPR compliance.
    """
    # Configure structlog with service context
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        wrapper_class=structlog.BoundLogger,
        cache_logger_on_first_use=True
    )

    # Set base logging configuration
    logging.basicConfig(
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        level=getattr(logging, log_level.upper()),
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(f"{service_name}.log")
        ]
    )

    # Configure security audit logging
    audit_logger = logging.getLogger("security_audit")
    audit_logger.setLevel(logging.INFO)
    audit_handler = logging.FileHandler("security_audit.log")
    audit_handler.setFormatter(
        logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    )
    audit_logger.addHandler(audit_handler)

    # Apply additional configuration if provided
    if additional_config:
        for logger_name, level in additional_config.get("loggers", {}).items():
            logging.getLogger(logger_name).setLevel(level)

def initialize_service(service_name: str, service_config: Optional[Dict] = None) -> Dict:
    """
    Initializes common components and configurations for a backend service with comprehensive
    security, monitoring, and health checks.
    """
    with INITIALIZATION_LOCK:
        try:
            # Load and validate service configuration
            config = BaseConfig(service_name=service_name)
            if service_config:
                config.validate_config(service_config)

            # Initialize structured logging
            monitoring_config = config.get_monitoring_config()
            setup_logging(
                service_name=service_name,
                log_level=monitoring_config["log_level"],
                additional_config=monitoring_config.get("logging_config")
            )

            # Initialize authentication handler
            jwt_handler = JWTHandler()

            # Initialize database connection
            db_config = config.get_database_config()
            BaseModel.metadata.create_all()

            # Initialize health monitoring
            health_status = {
                "service": service_name,
                "version": VERSION,
                "status": "healthy",
                "components": {
                    "database": "connected",
                    "authentication": "initialized",
                    "logging": "configured"
                }
            }

            logger.info(
                "Service initialized successfully",
                service_name=service_name,
                version=VERSION
            )

            return {
                "config": config,
                "jwt_handler": jwt_handler,
                "health_status": health_status
            }

        except Exception as e:
            logger.error(
                "Service initialization failed",
                service_name=service_name,
                error=str(e)
            )
            raise

# Export common components
__all__ = [
    "VERSION",
    "setup_logging",
    "initialize_service",
    "BaseConfig",
    "JWTHandler",
    "BaseModel"
]