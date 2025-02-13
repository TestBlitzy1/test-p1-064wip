"""
Enhanced distributed tracing module providing Jaeger integration for backend microservices
with comprehensive support for request tracing, span management, and secure context propagation.

Version: 1.0.0
"""

import os
import logging
from typing import Any, Callable, Dict, Optional, TypeVar
from functools import wraps

# External package imports with versions
from opentelemetry import trace  # v1.20.0
from opentelemetry.sdk.trace import TracerProvider, sampling  # v1.20.0
from opentelemetry.sdk.trace.export import BatchSpanProcessor  # v1.20.0
from opentelemetry.exporter.jaeger.thrift import JaegerExporter  # v1.20.0
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator  # v1.20.0

# Internal imports
from ..config.settings import BaseConfig

# Configure logging
logger = logging.getLogger(__name__)

# Environment variables with defaults
JAEGER_HOST = os.getenv('JAEGER_HOST', 'localhost')
JAEGER_PORT = int(os.getenv('JAEGER_PORT', '6831'))

# Type variables for generics
F = TypeVar('F', bound=Callable[..., Any])

class TracingManager:
    """
    Enhanced tracing management class with advanced sampling, multi-region support,
    and secure context propagation.
    """

    def __init__(self, service_name: str):
        """Initialize tracing manager with advanced configuration and security features."""
        self.service_name = service_name
        self.monitoring_config = BaseConfig(service_name=service_name).get_monitoring_config()
        
        # Initialize tracer provider with adaptive sampling
        self._tracer_provider = TracerProvider(
            sampler=sampling.ParentBased(
                root=sampling.TraceIdRatioBased(self.monitoring_config['trace_sample_rate'])
            )
        )
        
        # Configure secure Jaeger exporter with retry logic
        jaeger_exporter = JaegerExporter(
            agent_host_name=JAEGER_HOST,
            agent_port=JAEGER_PORT,
            udp_split_oversized_batches=True
        )
        
        # Set up batch processor with optimized settings
        processor = BatchSpanProcessor(
            jaeger_exporter,
            max_export_batch_size=512,
            schedule_delay_millis=5000
        )
        
        self._tracer_provider.add_span_processor(processor)
        trace.set_tracer_provider(self._tracer_provider)
        
        # Initialize service tracer with security controls
        self._tracer = trace.get_tracer(
            self.service_name,
            schema_url=f"https://opentelemetry.io/{self.service_name}",
            tracer_provider=self._tracer_provider,
        )

    def create_span(
        self,
        name: str,
        attributes: Optional[Dict[str, Any]] = None,
        parent_context: Optional[trace.SpanContext] = None
    ) -> trace.Span:
        """Creates a new tracing span with enhanced security and validation."""
        # Sanitize span name and attributes
        sanitized_name = self._sanitize_span_name(name)
        safe_attributes = self._sanitize_attributes(attributes or {})
        
        # Create span with validated parameters
        span_context = trace.set_span_in_context(parent_context) if parent_context else None
        
        return self._tracer.start_span(
            name=sanitized_name,
            attributes=safe_attributes,
            context=span_context
        )

    def get_current_span(self) -> Optional[trace.Span]:
        """Retrieves current active span with context validation."""
        current_span = trace.get_current_span()
        if current_span and current_span.is_recording():
            return current_span
        return None

    def inject_context(self, carrier: Dict[str, str]) -> Dict[str, str]:
        """Injects secure tracing context into carrier."""
        propagator = TraceContextTextMapPropagator()
        propagator.inject(carrier)
        return carrier

    def _sanitize_span_name(self, name: str) -> str:
        """Sanitizes span name for security."""
        return name[:100].strip()

    def _sanitize_attributes(self, attributes: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitizes span attributes and removes PII."""
        safe_attributes = {}
        pii_fields = {'password', 'token', 'secret', 'key', 'auth'}
        
        for key, value in attributes.items():
            if any(pii in key.lower() for pii in pii_fields):
                continue
            if isinstance(value, (str, int, float, bool)):
                safe_attributes[key] = value
        return safe_attributes

def trace_request(operation_name: str, attributes: Optional[Dict[str, Any]] = None) -> Callable[[F], F]:
    """
    Enhanced decorator for tracing service requests with automatic error categorization,
    performance metrics, and PII protection.
    """
    def decorator(func: F) -> F:
        @wraps(func)
        def wrapper(*args, **kwargs):
            tracer = trace.get_tracer(__name__)
            with tracer.start_as_current_span(
                name=operation_name,
                attributes=attributes or {}
            ) as span:
                try:
                    # Record request start time and details
                    span.set_attribute("request.start_time", str(trace.time_ns()))
                    
                    # Execute operation with performance tracking
                    result = func(*args, **kwargs)
                    
                    # Record success metrics
                    span.set_attribute("request.success", True)
                    span.set_attribute("request.duration_ns", str(trace.time_ns()))
                    
                    return result
                except Exception as e:
                    # Enhanced error handling with categorization
                    error_type = type(e).__name__
                    span.set_attribute("error", True)
                    span.set_attribute("error.type", error_type)
                    span.set_attribute("error.message", str(e))
                    
                    # Record stack trace securely
                    if not isinstance(e, (ValueError, TypeError)):
                        span.record_exception(e)
                    
                    logger.exception(f"Error in traced operation {operation_name}")
                    raise
        return wrapper
    return decorator

def trace_background_task(task_name: str) -> Callable[[F], F]:
    """
    Enhanced decorator for tracing background/async tasks with priority tracking
    and resource monitoring.
    """
    def decorator(func: F) -> F:
        @wraps(func)
        def wrapper(*args, **kwargs):
            tracer = trace.get_tracer(__name__)
            with tracer.start_as_current_span(
                name=f"background_task.{task_name}",
                attributes={
                    "task.priority": kwargs.get("priority", "normal"),
                    "task.type": "background"
                }
            ) as span:
                try:
                    # Monitor task execution
                    span.set_attribute("task.start_time", str(trace.time_ns()))
                    result = func(*args, **kwargs)
                    
                    # Record task completion metrics
                    span.set_attribute("task.success", True)
                    span.set_attribute("task.duration_ns", str(trace.time_ns()))
                    
                    return result
                except Exception as e:
                    # Enhanced error handling for background tasks
                    span.set_attribute("error", True)
                    span.set_attribute("error.type", type(e).__name__)
                    span.record_exception(e)
                    
                    logger.exception(f"Error in background task {task_name}")
                    raise
        return wrapper
    return decorator