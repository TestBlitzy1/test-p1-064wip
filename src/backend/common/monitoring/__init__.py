"""
Monitoring module initialization providing centralized access to metrics and tracing capabilities
for backend microservices with comprehensive error handling and thread safety.

Version: 1.0.0
"""

import os
import re
import threading
import logging
from typing import Optional, Tuple, Dict

# Internal imports
from .metrics import MetricsManager
from .tracing import TracingManager

# Configure logging
logger = logging.getLogger(__name__)

# Global constants
DEFAULT_SERVICE_NAME = 'sales_intelligence_service'
SERVICE_NAME_PATTERN = re.compile(r'^[a-z][a-z0-9_]{2,49}$')

# Thread safety controls
_monitoring_lock = threading.Lock()
_initialized = False

# Global instances
_metrics_manager: Optional[MetricsManager] = None
_tracing_manager: Optional[TracingManager] = None

def setup_monitoring(
    service_name: str,
    enable_metrics: bool = True,
    enable_tracing: bool = True
) -> Tuple[Optional[MetricsManager], Optional[TracingManager]]:
    """
    Thread-safe initialization of metrics and tracing for a service with comprehensive error handling.
    
    Args:
        service_name (str): Name of the service to monitor
        enable_metrics (bool): Flag to enable Prometheus metrics collection
        enable_tracing (bool): Flag to enable distributed tracing
        
    Returns:
        Tuple[Optional[MetricsManager], Optional[TracingManager]]: Initialized manager instances
        
    Raises:
        ValueError: If service name is invalid
        RuntimeError: If initialization fails
    """
    global _initialized, _metrics_manager, _tracing_manager
    
    # Validate service name
    if not SERVICE_NAME_PATTERN.match(service_name):
        raise ValueError(
            f"Invalid service_name: {service_name}. Must match pattern: {SERVICE_NAME_PATTERN.pattern}"
        )
    
    with _monitoring_lock:
        try:
            # Check if already initialized
            if _initialized:
                logger.warning("Monitoring already initialized")
                return _metrics_manager, _tracing_manager
            
            # Initialize metrics if enabled
            if enable_metrics:
                try:
                    _metrics_manager = MetricsManager(service_name)
                    logger.info("Successfully initialized metrics manager")
                except Exception as e:
                    logger.error(f"Failed to initialize metrics manager: {str(e)}")
                    raise RuntimeError(f"Metrics initialization failed: {str(e)}")
            
            # Initialize tracing if enabled
            if enable_tracing:
                try:
                    _tracing_manager = TracingManager(service_name)
                    logger.info("Successfully initialized tracing manager")
                except Exception as e:
                    logger.error(f"Failed to initialize tracing manager: {str(e)}")
                    raise RuntimeError(f"Tracing initialization failed: {str(e)}")
            
            _initialized = True
            logger.info(f"Monitoring successfully initialized for service: {service_name}")
            
            return _metrics_manager, _tracing_manager
            
        except Exception as e:
            logger.error(f"Monitoring initialization failed: {str(e)}")
            # Cleanup on failure
            _metrics_manager = None
            _tracing_manager = None
            _initialized = False
            raise

def get_monitoring_status() -> Dict[str, any]:
    """
    Retrieves current monitoring initialization status and health metrics.
    
    Returns:
        Dict containing monitoring status, uptime, and health metrics
    """
    status = {
        "initialized": _initialized,
        "metrics_enabled": _metrics_manager is not None,
        "tracing_enabled": _tracing_manager is not None,
        "health": {
            "metrics": "healthy" if _metrics_manager else "disabled",
            "tracing": "healthy" if _tracing_manager else "disabled"
        }
    }
    
    # Add metrics manager health details if available
    if _metrics_manager:
        try:
            # Add basic health metrics
            uptime_metric = _metrics_manager.get_metric("uptime")
            status["health"]["metrics_details"] = {
                "uptime_seconds": uptime_metric.get() if uptime_metric else 0
            }
        except Exception as e:
            logger.error(f"Failed to get metrics health: {str(e)}")
            status["health"]["metrics"] = "unhealthy"
    
    # Add tracing manager health details if available
    if _tracing_manager:
        try:
            current_span = _tracing_manager.get_current_span()
            status["health"]["tracing_details"] = {
                "active_span": current_span is not None
            }
        except Exception as e:
            logger.error(f"Failed to get tracing health: {str(e)}")
            status["health"]["tracing"] = "unhealthy"
    
    return status

# Export public interfaces
__all__ = [
    'MetricsManager',
    'TracingManager',
    'setup_monitoring',
    'get_monitoring_status'
]