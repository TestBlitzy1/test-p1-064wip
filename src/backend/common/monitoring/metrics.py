"""
Core metrics collection and monitoring module providing Prometheus integration for backend microservices.
Implements thread-safe metric management, comprehensive latency tracking, and enhanced error monitoring.

Version: 1.0.0
"""

import os
import time
import threading
from typing import Any, Callable, Dict, List, Optional, Union
from functools import wraps

# External package imports with versions
import prometheus_client  # v0.17.0
from prometheus_client import Counter, Gauge, Histogram, start_http_server

# Internal imports
from ..config.settings import BaseConfig

# Global constants
DEFAULT_BUCKETS = [0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0]
PROMETHEUS_PORT = int(os.getenv('PROMETHEUS_PORT', '9090'))
METRIC_NAME_MAX_LENGTH = 100
MAX_LABEL_COUNT = 10

class MetricsManager:
    """Thread-safe core metrics management class for Prometheus integration."""
    
    def __init__(self, service_name: str):
        """Initialize metrics manager with service configuration."""
        self._metrics: Dict[str, Union[Counter, Gauge, Histogram]] = {}
        self._lock = threading.Lock()
        self.service_name = service_name
        
        # Load monitoring configuration
        config = BaseConfig(service_name=service_name)
        self.monitoring_config = config.get_monitoring_config()
        
        # Start Prometheus HTTP server
        try:
            start_http_server(port=self.monitoring_config['prometheus_port'])
        except Exception as e:
            raise RuntimeError(f"Failed to start Prometheus server: {str(e)}")

    def create_counter(self, name: str, description: str, labels: Optional[List[str]] = None) -> Counter:
        """Create a new thread-safe Prometheus counter metric."""
        with self._lock:
            self._validate_metric_name(name)
            self._validate_labels(labels)
            
            metric_name = f"{self.service_name}_{name}"
            if metric_name in self._metrics:
                return self._metrics[metric_name]
            
            counter = Counter(
                name=metric_name,
                documentation=description,
                labelnames=labels or []
            )
            self._metrics[metric_name] = counter
            return counter

    def create_gauge(self, name: str, description: str, labels: Optional[List[str]] = None) -> Gauge:
        """Create a new thread-safe Prometheus gauge metric."""
        with self._lock:
            self._validate_metric_name(name)
            self._validate_labels(labels)
            
            metric_name = f"{self.service_name}_{name}"
            if metric_name in self._metrics:
                return self._metrics[metric_name]
            
            gauge = Gauge(
                name=metric_name,
                documentation=description,
                labelnames=labels or []
            )
            self._metrics[metric_name] = gauge
            return gauge

    def create_histogram(
        self, 
        name: str, 
        description: str, 
        labels: Optional[List[str]] = None,
        buckets: Optional[List[float]] = None
    ) -> Histogram:
        """Create a new thread-safe Prometheus histogram metric."""
        with self._lock:
            self._validate_metric_name(name)
            self._validate_labels(labels)
            
            metric_name = f"{self.service_name}_{name}"
            if metric_name in self._metrics:
                return self._metrics[metric_name]
            
            histogram = Histogram(
                name=metric_name,
                documentation=description,
                labelnames=labels or [],
                buckets=buckets or DEFAULT_BUCKETS
            )
            self._metrics[metric_name] = histogram
            return histogram

    def get_metric(self, name: str) -> Union[Counter, Gauge, Histogram]:
        """Thread-safe retrieval of existing metric."""
        with self._lock:
            metric_name = f"{self.service_name}_{name}"
            if metric_name not in self._metrics:
                raise KeyError(f"Metric not found: {metric_name}")
            return self._metrics[metric_name]

    def _validate_metric_name(self, name: str) -> None:
        """Validate metric name format and length."""
        if not name or len(name) > METRIC_NAME_MAX_LENGTH:
            raise ValueError(
                f"Invalid metric name: {name}. "
                f"Must be non-empty and <= {METRIC_NAME_MAX_LENGTH} characters"
            )
        if not name.replace('_', '').isalnum():
            raise ValueError(
                f"Invalid metric name: {name}. "
                "Must contain only alphanumeric characters and underscores"
            )

    def _validate_labels(self, labels: Optional[List[str]]) -> None:
        """Validate metric labels count and format."""
        if not labels:
            return
            
        if len(labels) > MAX_LABEL_COUNT:
            raise ValueError(
                f"Too many labels: {len(labels)}. "
                f"Maximum allowed: {MAX_LABEL_COUNT}"
            )
        
        for label in labels:
            if not label.isalnum():
                raise ValueError(
                    f"Invalid label name: {label}. "
                    "Must contain only alphanumeric characters"
                )

def track_latency(metric_name: str, labels: Optional[List[str]] = None, 
                 buckets: Optional[List[float]] = None) -> Callable:
    """Thread-safe decorator for tracking operation latency using histograms."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            # Get or create histogram metric
            metrics_manager = MetricsManager(args[0].service_name 
                                          if hasattr(args[0], 'service_name') 
                                          else 'default')
            try:
                histogram = metrics_manager.get_metric(metric_name)
            except KeyError:
                histogram = metrics_manager.create_histogram(
                    name=metric_name,
                    description=f"Latency histogram for {metric_name}",
                    labels=labels,
                    buckets=buckets
                )
            
            # Track operation latency
            start_time = time.perf_counter()
            try:
                result = func(*args, **kwargs)
                duration = time.perf_counter() - start_time
                histogram.observe(duration)
                return result
            except Exception as e:
                duration = time.perf_counter() - start_time
                histogram.observe(duration)
                raise e
                
        return wrapper
    return decorator

def track_errors(metric_name: str, labels: Optional[List[str]] = None) -> Callable:
    """Thread-safe decorator for tracking operation errors using counters."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            # Get or create error counter metric
            metrics_manager = MetricsManager(args[0].service_name 
                                          if hasattr(args[0], 'service_name') 
                                          else 'default')
            try:
                counter = metrics_manager.get_metric(metric_name)
            except KeyError:
                counter = metrics_manager.create_counter(
                    name=metric_name,
                    description=f"Error counter for {metric_name}",
                    labels=labels or ['error_type']
                )
            
            try:
                return func(*args, **kwargs)
            except Exception as e:
                # Increment error counter with error type
                error_labels = {
                    'error_type': e.__class__.__name__,
                    **(dict(zip(labels[1:], [''] * (len(labels) - 1))) if labels else {})
                }
                counter.labels(**error_labels).inc()
                raise e
                
        return wrapper
    return decorator