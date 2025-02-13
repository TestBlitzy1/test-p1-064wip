"""
Analytics service configuration module extending base configuration with analytics-specific settings
for metrics, reporting, caching, and performance monitoring.

Version: 1.0.0
"""

from pydantic import Field  # v2.0.0
from ...common.config.settings import BaseConfig
from ...common.monitoring.metrics import MetricsManager
from .constants import (
    SERVICE_NAME,
    EXPORT_CHUNK_SIZE,
    MAX_REPORT_ROWS,
    CACHE_TTL,
    METRIC_THRESHOLDS,
    SUPPORTED_PLATFORMS,
    AGGREGATION_PERIODS,
    REPORT_FORMATS
)

class AnalyticsConfig(BaseConfig):
    """Analytics service specific configuration extending base configuration with analytics settings."""

    def __init__(self):
        """Initialize analytics service configuration with default values and environment overrides."""
        # Initialize base configuration
        super().__init__(service_name=SERVICE_NAME)

        # Analytics-specific settings
        self.report_chunk_size: int = EXPORT_CHUNK_SIZE
        self.max_report_rows: int = MAX_REPORT_ROWS
        self.cache_ttl: dict = CACHE_TTL
        self.metric_thresholds: dict = METRIC_THRESHOLDS
        self.supported_platforms: list = SUPPORTED_PLATFORMS
        self.aggregation_periods: list = AGGREGATION_PERIODS
        self.report_formats: list = REPORT_FORMATS

        # Initialize metrics manager for analytics service
        self.metrics_manager = MetricsManager(SERVICE_NAME)

        # Configure default analytics metrics
        self._configure_metrics()

    def _configure_metrics(self) -> None:
        """Configure default metrics for analytics service monitoring."""
        # Performance metrics histograms
        self.metrics_manager.create_histogram(
            name="report_generation_time",
            description="Time taken to generate analytics reports",
            labels=["report_type", "format"],
            buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0]
        )

        self.metrics_manager.create_histogram(
            name="query_execution_time",
            description="Time taken to execute analytics queries",
            labels=["query_type", "platform"],
            buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
        )

        # Operational counters
        self.metrics_manager.create_counter(
            name="reports_generated",
            description="Number of analytics reports generated",
            labels=["report_type", "format", "status"]
        )

        self.metrics_manager.create_counter(
            name="cache_hits",
            description="Number of analytics cache hits",
            labels=["cache_type"]
        )

    def get_metrics_config(self) -> dict:
        """Returns metrics collection configuration for the analytics service."""
        base_metrics = self.get_monitoring_config()
        
        analytics_metrics = {
            "collection_interval": 15,  # seconds
            "retention_days": 90,
            "performance_thresholds": {
                "report_generation_warning": 30.0,  # seconds
                "report_generation_critical": 60.0,  # seconds
                "query_execution_warning": 5.0,     # seconds
                "query_execution_critical": 10.0    # seconds
            },
            "alert_thresholds": {
                "error_rate": 0.01,                # 1% error rate threshold
                "cache_miss_rate": 0.20,           # 20% cache miss threshold
                "slow_query_percentage": 0.05      # 5% slow query threshold
            }
        }

        return {
            **base_metrics,
            "analytics": analytics_metrics
        }

    def get_cache_config(self) -> dict:
        """Returns caching configuration for analytics data."""
        base_cache = self.get_redis_config()
        
        analytics_cache = {
            "ttl": self.cache_ttl,
            "key_prefix": "analytics:",
            "serialization": {
                "compression": True,
                "compression_level": 6
            },
            "patterns": {
                "dashboard": "dashboard:*",
                "reports": "reports:*",
                "metrics": "metrics:*"
            },
            "invalidation": {
                "dashboard": 300,    # 5 minutes
                "reports": 3600,     # 1 hour
                "metrics": 86400     # 24 hours
            }
        }

        return {
            **base_cache,
            "analytics": analytics_cache
        }