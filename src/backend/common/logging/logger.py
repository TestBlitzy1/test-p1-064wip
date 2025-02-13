"""
Core logging module providing centralized, structured logging capabilities for backend microservices
with support for different log levels, formatting, and integration with monitoring systems.

Version: 1.0.0
"""

import logging  # v3.11+
import json_logging  # v1.3.0
from typing import Optional, Dict  # v3.11+
from datetime import datetime  # v3.11+
from ..config.settings import BaseConfig

# Global logging format for structured JSON logs
LOG_FORMAT = {
    'timestamp': '%(asctime)s',
    'service': '%(service_name)s',
    'level': '%(levelname)s',
    'message': '%(message)s',
    'trace_id': '%(trace_id)s',
    'correlation_id': '%(correlation_id)s',
    'environment': '%(environment)s',
    'version': '%(version)s'
}

DEFAULT_LOG_LEVEL = logging.INFO

def setup_json_logging() -> None:
    """
    Configures JSON-formatted structured logging with ELK Stack integration.
    """
    # Initialize JSON logging for web frameworks
    json_logging.init_framework(
        enable_json=True,
        custom_formatter=LOG_FORMAT,
        enable_request_logging=True,
        correlation_id_generator=lambda: datetime.now().strftime('%Y%m%d%H%M%S-') + str(hash(datetime.now()))
    )
    
    # Configure log rotation settings
    json_logging.init_request_instrument(
        exclude_url_patterns=['/health', '/metrics'],
        request_id_generator=lambda: datetime.now().strftime('%Y%m%d%H%M%S-') + str(hash(datetime.now()))
    )

class ServiceLogger:
    """
    Advanced logging class providing structured logging with monitoring integration.
    """
    
    def __init__(self, service_name: str, config: Optional[BaseConfig] = None):
        """
        Initialize service logger with monitoring integration.
        
        Args:
            service_name: Name of the service using the logger
            config: Optional BaseConfig instance for monitoring settings
        """
        self.service_name = service_name
        self._logger = logging.getLogger(service_name)
        self._logger.setLevel(DEFAULT_LOG_LEVEL)
        
        # Initialize monitoring configuration
        self.monitoring_config = config.get_monitoring_config() if config else {}
        self.environment = config.env if config else 'development'
        self.version = '1.0.0'
        self.log_buffer = {}
        
        # Configure JSON logging
        setup_json_logging()

    def _enrich_log_context(self, extra: Optional[Dict] = None) -> Dict:
        """
        Enriches log context with service metadata and monitoring information.
        """
        context = {
            'service_name': self.service_name,
            'environment': self.environment,
            'version': self.version,
            'timestamp': datetime.utcnow().isoformat(),
            'trace_id': self.monitoring_config.get('trace_id', ''),
            'correlation_id': self.monitoring_config.get('correlation_id', '')
        }
        
        if extra:
            context.update(extra)
        
        return context

    def info(self, message: str, extra: Optional[Dict] = None) -> None:
        """
        Logs an info level message with enhanced context.
        
        Args:
            message: The log message
            extra: Optional additional context
        """
        context = self._enrich_log_context(extra)
        self._logger.info(message, extra=context)

    def error(self, message: str, exc: Optional[Exception] = None, extra: Optional[Dict] = None) -> None:
        """
        Logs an error with comprehensive debug information.
        
        Args:
            message: The error message
            exc: Optional exception object
            extra: Optional additional context
        """
        context = self._enrich_log_context(extra)
        
        if exc:
            context.update({
                'exception_type': type(exc).__name__,
                'exception_message': str(exc),
                'stack_trace': logging.traceback.format_exc()
            })
        
        self._logger.error(message, extra=context)

    def warning(self, message: str, extra: Optional[Dict] = None) -> None:
        """
        Logs a warning with context.
        
        Args:
            message: The warning message
            extra: Optional additional context
        """
        context = self._enrich_log_context(extra)
        self._logger.warning(message, extra=context)

    def debug(self, message: str, extra: Optional[Dict] = None) -> None:
        """
        Logs detailed debug information.
        
        Args:
            message: The debug message
            extra: Optional additional context
        """
        context = self._enrich_log_context(extra)
        self._logger.debug(message, extra=context)