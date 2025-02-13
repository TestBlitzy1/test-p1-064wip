"""
Initialization module for the common logging package providing centralized, structured logging
capabilities with monitoring integration for all backend microservices.

Features:
- Thread-safe logger instance management
- Enhanced performance monitoring
- ELK Stack integration
- OpenTelemetry support
- Secure logging practices
- Automatic PII detection and masking

Version: 1.0.0
"""

import logging  # v3.11+
import threading  # v3.11+
from typing import Dict, Optional

from .logger import ServiceLogger, setup_json_logging
from ..config.settings import BaseConfig

# Thread-safe storage for logger instances
logger_instances: Dict[str, ServiceLogger] = {}
_logger_lock = threading.Lock()

def get_logger(service_name: str, correlation_id: Optional[str] = None) -> ServiceLogger:
    """
    Thread-safe factory function to create or retrieve a configured logger instance
    for a service with performance monitoring and correlation ID support.

    Args:
        service_name: Name of the service requesting the logger
        correlation_id: Optional correlation ID for request tracing

    Returns:
        ServiceLogger: Configured logger instance with monitoring integration

    Raises:
        ValueError: If service_name is not in the allowed SERVICE_NAMES
    """
    # Validate service name against allowed services
    if service_name not in BaseConfig.SERVICE_NAMES:
        raise ValueError(f"Invalid service name: {service_name}")

    global logger_instances
    
    with _logger_lock:
        # Return existing logger instance if available
        if service_name in logger_instances:
            logger = logger_instances[service_name]
            if correlation_id:
                # Update correlation ID for existing logger
                logger.monitoring_config['correlation_id'] = correlation_id
            return logger

        # Create new logger instance with monitoring configuration
        config = BaseConfig(service_name=service_name)
        logger = ServiceLogger(
            service_name=service_name,
            config=config
        )
        
        # Configure correlation ID if provided
        if correlation_id:
            logger.monitoring_config['correlation_id'] = correlation_id

        # Cache logger instance
        logger_instances[service_name] = logger
        
        return logger

def configure_root_logger() -> None:
    """
    Configures the root logger with enhanced monitoring, security,
    and performance optimizations.
    """
    # Get monitoring configuration
    config = BaseConfig(service_name="root")
    monitoring_config = config.get_monitoring_config()

    # Set up JSON-formatted logging
    setup_json_logging()

    # Configure root logger with monitoring settings
    root_logger = logging.getLogger()
    root_logger.setLevel(monitoring_config['log_level'])

    # Configure log buffering for performance
    logging.logThreads = False
    logging.logProcesses = False
    logging._srcfile = None

    # Initialize performance metrics collection
    if monitoring_config['enable_tracing']:
        # Configure OpenTelemetry integration
        from opentelemetry import trace
        tracer = trace.get_tracer(__name__)
        trace.set_tracer_provider(tracer)

    # Set up secure logging practices
    logging.getLogger('urllib3').setLevel(logging.WARNING)
    logging.getLogger('requests').setLevel(logging.WARNING)
    
    # Configure automatic log rotation
    from logging.handlers import RotatingFileHandler
    handler = RotatingFileHandler(
        filename='app.log',
        maxBytes=10485760,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    root_logger.addHandler(handler)

# Initialize root logger configuration on module import
configure_root_logger()

# Export public interface
__all__ = [
    'get_logger',
    'ServiceLogger'
]