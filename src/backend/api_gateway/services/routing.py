"""
Service routing module for the API Gateway implementing intelligent request routing,
load balancing, and high availability with comprehensive monitoring.

Version: 1.0.0
"""

import asyncio
import logging
import time
from typing import Dict, Optional
from collections import defaultdict
from dataclasses import dataclass, field

# External imports with versions
from fastapi import Request, Response, HTTPException  # v0.100.0+
import httpx  # v0.24.0+
from tenacity import (  # v8.2.0+
    retry,
    stop_after_attempt,
    wait_exponential,
    RetryError
)
from prometheus_client import Counter, Histogram  # v0.17.0+
from opentelemetry import trace  # v1.20.0+
from opentelemetry.trace import SpanKind

# Internal imports
from ..config import GatewayConfig
from ..middleware.auth import AuthMiddleware
from ..middleware.rate_limiter import RateLimiter
from ..constants import HTTP_STATUS, ERROR_MESSAGES

# Configure logging
logger = logging.getLogger(__name__)

# Metrics collectors
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

# Initialize tracer
tracer = trace.get_tracer(__name__)

@dataclass
class ServiceRouter:
    """
    Advanced routing class implementing intelligent request routing with circuit breaker,
    load balancing, and comprehensive monitoring.
    """

    _config: GatewayConfig
    _auth_middleware: AuthMiddleware
    _rate_limiter: RateLimiter
    _http_client: httpx.AsyncClient = field(init=False)
    _service_health_cache: Dict[str, bool] = field(default_factory=dict)
    _circuit_breakers: Dict[str, Dict] = field(default_factory=lambda: defaultdict(dict))
    _load_balancers: Dict[str, int] = field(default_factory=lambda: defaultdict(int))

    def __post_init__(self):
        """Initialize router with enhanced configuration."""
        # Initialize HTTP client with connection pooling
        self._http_client = httpx.AsyncClient(
            timeout=30.0,
            limits=httpx.Limits(max_keepalive_connections=100, max_connections=200),
            http2=True
        )

        # Initialize circuit breaker states
        for service in self._config.service_routes:
            self._circuit_breakers[service] = {
                'failures': 0,
                'last_failure': 0,
                'state': 'closed',
                'threshold': 5,
                'recovery_time': 30
            }

        # Start background health check task
        asyncio.create_task(self._health_check_loop())

    async def route_request(self, request: Request) -> Response:
        """
        Routes incoming request with comprehensive error handling and monitoring.

        Args:
            request: Incoming FastAPI request

        Returns:
            Response from target service

        Raises:
            HTTPException: For various routing errors
        """
        with tracer.start_as_current_span(
            "route_request",
            kind=SpanKind.SERVER
        ) as span:
            try:
                # Authenticate request
                user_context = await self._auth_middleware.authenticate(request)
                span.set_attribute("user_id", user_context.get("user_id"))

                # Extract target service
                service_name = request.url.path.split("/")[3]
                if service_name not in self._config.service_routes:
                    raise HTTPException(
                        status_code=HTTP_STATUS["NOT_FOUND"],
                        detail=ERROR_MESSAGES["RESOURCE_NOT_FOUND"]
                    )

                # Check circuit breaker
                if not self._check_circuit_breaker(service_name):
                    raise HTTPException(
                        status_code=HTTP_STATUS["SERVICE_UNAVAILABLE"],
                        detail=ERROR_MESSAGES["SERVICE_UNAVAILABLE"]
                    )

                # Check rate limits
                await self._rate_limiter.check_rate_limit(
                    service_name,
                    user_context.get("user_id")
                )

                # Select service instance using load balancer
                service_url = self._get_service_url(service_name)

                # Forward request with retries
                start_time = time.time()
                response = await self._forward_request(service_url, request)
                
                # Update metrics
                duration = time.time() - start_time
                LATENCY_HISTOGRAM.labels(service=service_name).observe(duration)
                REQUEST_COUNTER.labels(
                    service=service_name,
                    method=request.method,
                    status=response.status_code
                ).inc()

                return response

            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Request routing failed: {str(e)}")
                raise HTTPException(
                    status_code=HTTP_STATUS["INTERNAL_SERVER_ERROR"],
                    detail=ERROR_MESSAGES["PLATFORM_ERROR"].format(details=str(e))
                )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def _forward_request(self, service_url: str, request: Request) -> Response:
        """
        Forwards request to target service with retry logic.

        Args:
            service_url: Target service URL
            request: Original request

        Returns:
            Service response
        """
        try:
            # Prepare request with tracing context
            headers = dict(request.headers)
            current_span = trace.get_current_span()
            if current_span:
                headers["X-Trace-ID"] = str(current_span.get_span_context().trace_id)

            # Forward request
            response = await self._http_client.request(
                method=request.method,
                url=f"{service_url}{request.url.path}",
                headers=headers,
                content=await request.body(),
                follow_redirects=True
            )

            # Update circuit breaker on success
            self._update_circuit_breaker(service_url, success=True)

            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=dict(response.headers)
            )

        except Exception as e:
            # Update circuit breaker on failure
            self._update_circuit_breaker(service_url, success=False)
            raise

    def _check_circuit_breaker(self, service_name: str) -> bool:
        """
        Checks circuit breaker state for service.

        Args:
            service_name: Name of the service

        Returns:
            bool: True if circuit is closed
        """
        breaker = self._circuit_breakers[service_name]
        
        if breaker['state'] == 'open':
            if time.time() - breaker['last_failure'] > breaker['recovery_time']:
                breaker['state'] = 'half-open'
                return True
            return False
            
        return True

    def _update_circuit_breaker(self, service_name: str, success: bool) -> None:
        """
        Updates circuit breaker state based on request outcome.

        Args:
            service_name: Name of the service
            success: Whether request was successful
        """
        breaker = self._circuit_breakers[service_name]
        
        if success:
            if breaker['state'] == 'half-open':
                breaker['state'] = 'closed'
            breaker['failures'] = 0
        else:
            breaker['failures'] += 1
            breaker['last_failure'] = time.time()
            
            if breaker['failures'] >= breaker['threshold']:
                breaker['state'] = 'open'

    def _get_service_url(self, service_name: str) -> str:
        """
        Gets service URL using round-robin load balancing.

        Args:
            service_name: Name of the service

        Returns:
            str: Service URL
        """
        urls = self._config.get_service_url(service_name).split(',')
        index = self._load_balancers[service_name] % len(urls)
        self._load_balancers[service_name] += 1
        return urls[index]

    async def _health_check_loop(self) -> None:
        """Background task for periodic service health checks."""
        while True:
            for service in self._config.service_routes:
                try:
                    healthy = await self.check_service_health(service)
                    self._service_health_cache[service] = healthy
                except Exception as e:
                    logger.error(f"Health check failed for {service}: {str(e)}")
                    self._service_health_cache[service] = False
            
            await asyncio.sleep(30)  # Check every 30 seconds

    async def check_service_health(self, service_name: str) -> bool:
        """
        Checks health status of a service.

        Args:
            service_name: Name of the service to check

        Returns:
            bool: True if service is healthy
        """
        try:
            service_url = self._config.get_service_url(service_name)
            response = await self._http_client.get(
                f"{service_url}/health",
                timeout=5.0
            )
            return response.status_code == HTTP_STATUS["OK"]
        except Exception:
            return False