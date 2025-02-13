"""
Analytics service entry point module providing real-time analytics capabilities,
performance tracking, and scalable reporting functionality.

Version: 1.0.0
"""

from typing import Dict, Any, Optional
import structlog  # v23.1.0
import redis  # v5.0.1
from opentelemetry import trace  # v1.20.0

from .aggregation import MetricsAggregator
from .reporting import ReportGenerator

# Configure constants
CACHE_TTL = 300  # 5 minute cache TTL
RATE_LIMIT = 1000  # requests per minute

# Initialize structured logging
logger = structlog.get_logger(__name__)

# Initialize OpenTelemetry tracer
tracer = trace.get_tracer(__name__)

class AnalyticsService:
    """
    Core analytics service providing real-time metrics processing, reporting,
    and performance tracking with comprehensive caching and error handling.
    """

    def __init__(self, config: Dict[str, Any]) -> None:
        """
        Initialize analytics service with enhanced configuration.

        Args:
            config: Service configuration dictionary

        Raises:
            ValueError: If invalid configuration provided
        """
        self.config = config
        
        # Initialize Redis cache connection
        self.cache = redis.Redis(
            host=config['redis']['host'],
            port=config['redis']['port'],
            db=config['redis']['db'],
            decode_responses=True,
            socket_timeout=5
        )

        # Initialize core components with tracing
        with tracer.start_as_current_span("init_analytics_service") as span:
            try:
                self.metrics_aggregator = MetricsAggregator(
                    cache_config={'ttl': CACHE_TTL}
                )
                
                self.report_generator = ReportGenerator(
                    db_session=None,  # Injected by service factory
                    cache_manager=self.cache,
                    config=config
                )
                
                span.set_attribute("service.initialized", True)
                logger.info("Analytics service initialized successfully")
                
            except Exception as e:
                span.set_attribute("service.initialized", False)
                span.record_exception(e)
                logger.error("Failed to initialize analytics service", error=str(e))
                raise

    def get_metrics_aggregator(self) -> MetricsAggregator:
        """
        Get metrics aggregator instance with validation.

        Returns:
            MetricsAggregator: Configured metrics aggregator

        Raises:
            RuntimeError: If metrics aggregator not initialized
        """
        if not self.metrics_aggregator:
            raise RuntimeError("Metrics aggregator not initialized")
        return self.metrics_aggregator

    def get_report_generator(self) -> ReportGenerator:
        """
        Get report generator instance with validation.

        Returns:
            ReportGenerator: Configured report generator

        Raises:
            RuntimeError: If report generator not initialized
        """
        if not self.report_generator:
            raise RuntimeError("Report generator not initialized")
        return self.report_generator

    def health_check(self) -> Dict[str, Any]:
        """
        Perform comprehensive service health check.

        Returns:
            Dict containing health status and component states
        """
        with tracer.start_as_current_span("analytics_health_check") as span:
            try:
                # Check cache connectivity
                self.cache.ping()
                
                # Validate core components
                metrics_healthy = bool(self.metrics_aggregator)
                reports_healthy = bool(self.report_generator)
                
                health_status = {
                    'status': 'healthy' if (metrics_healthy and reports_healthy) else 'degraded',
                    'cache': 'connected',
                    'components': {
                        'metrics_aggregator': 'healthy' if metrics_healthy else 'error',
                        'report_generator': 'healthy' if reports_healthy else 'error'
                    },
                    'rate_limit': RATE_LIMIT,
                    'cache_ttl': CACHE_TTL
                }
                
                span.set_attribute("health_check.status", health_status['status'])
                logger.info("Health check completed", status=health_status)
                
                return health_status
                
            except redis.RedisError as e:
                status = {
                    'status': 'unhealthy',
                    'cache': 'disconnected',
                    'error': str(e)
                }
                span.set_attribute("health_check.status", "unhealthy")
                logger.error("Health check failed", error=str(e))
                return status

# Export core components
__all__ = ['MetricsAggregator', 'ReportGenerator', 'AnalyticsService']