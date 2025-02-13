"""
API Gateway services initialization module providing core routing and service management
functionality with support for high availability, scalability, and monitoring.

Version: 1.0.0
"""

import logging
from typing import Dict, Optional

# External imports with versions
from fastapi import FastAPI  # v0.100.0
from prometheus_client import Counter, Histogram  # v0.17.0

# Internal imports
from .routing import ServiceRouter
from ..config import GatewayConfig
from ..middleware.auth import AuthMiddleware
from ..middleware.rate_limiter import RateLimiter
from common.cache.redis import RedisCache
from common.logging.logger import ServiceLogger

# Initialize logging
logger = ServiceLogger("api_gateway_services")

# Prometheus metrics
REQUEST_COUNTER = Counter(
    'gateway_requests_total',
    'Total requests processed by service',
    ['service', 'method', 'status']
)

LATENCY_HISTOGRAM = Histogram(
    'gateway_request_duration_seconds',
    'Request duration in seconds',
    ['service']
)

class GatewayServices:
    """
    Core API Gateway services manager providing routing, authentication,
    rate limiting and monitoring capabilities.
    """

    def __init__(self, app: FastAPI) -> None:
        """
        Initialize gateway services with comprehensive configuration.

        Args:
            app: FastAPI application instance
        """
        try:
            # Load configuration
            self.config = GatewayConfig()
            
            # Initialize Redis cache
            self.cache = RedisCache(self.config)
            
            # Initialize core components
            self.auth_middleware = AuthMiddleware()
            self.rate_limiter = RateLimiter(
                app=app,
                cache=self.cache,
                rate_limits=self.config.rate_limits,
                burst_multiplier=1.5
            )
            self.router = ServiceRouter(
                config=self.config,
                auth_middleware=self.auth_middleware,
                rate_limiter=self.rate_limiter
            )
            
            logger.info("Gateway services initialized successfully")
            
        except Exception as e:
            logger.error("Failed to initialize gateway services", exc=e)
            raise

    async def route_request(self, request) -> Dict:
        """
        Route and process incoming requests with comprehensive monitoring.

        Args:
            request: Incoming FastAPI request

        Returns:
            dict: Response from target service
        """
        return await self.router.route_request(request)

    async def get_service_health(self, service_name: str) -> bool:
        """
        Check health status of a service.

        Args:
            service_name: Name of service to check

        Returns:
            bool: True if service is healthy
        """
        return await self.router.check_service_health(service_name)

    def get_metrics(self) -> Dict:
        """
        Get comprehensive gateway metrics.

        Returns:
            dict: Gateway performance metrics
        """
        return {
            'requests': {
                label: REQUEST_COUNTER.labels(**label).value
                for label in REQUEST_COUNTER._metrics
            },
            'latencies': {
                label: LATENCY_HISTOGRAM.labels(**label).value
                for label in LATENCY_HISTOGRAM._metrics
            },
            'cache': self.cache._metrics,
            'rate_limiter': self.rate_limiter._metrics
        }

# Initialize gateway services
gateway_services = None

def init_gateway_services(app: FastAPI) -> GatewayServices:
    """
    Initialize gateway services with singleton pattern.

    Args:
        app: FastAPI application instance

    Returns:
        GatewayServices instance
    """
    global gateway_services
    if gateway_services is None:
        gateway_services = GatewayServices(app)
    return gateway_services

# Export core components
__all__ = [
    'GatewayServices',
    'init_gateway_services',
    'gateway_services'
]