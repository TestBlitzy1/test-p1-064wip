"""
Rate limiting middleware for the API Gateway implementing a distributed token bucket algorithm
with Redis-based sliding window support, connection pooling, and comprehensive monitoring.

Version: 1.0.0
"""

import time
from typing import Dict, Tuple, Optional, Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from common.cache.redis import RedisCache  # v4.5.0
from api_gateway.constants import (
    RATE_LIMITS,
    TIME_WINDOWS,
    HTTP_STATUS,
    ERROR_MESSAGES
)

class RateLimiter(BaseHTTPMiddleware):
    """
    Distributed rate limiting middleware implementing token bucket algorithm with Redis backend,
    supporting sliding windows and burst handling.
    """

    def __init__(
        self,
        app: ASGIApp,
        cache: RedisCache,
        rate_limits: Dict[str, int] = RATE_LIMITS,
        time_windows: Dict[str, int] = TIME_WINDOWS,
        burst_multiplier: float = 1.5,
        cleanup_interval: int = 3600
    ) -> None:
        """
        Initialize rate limiter with Redis cache and configurations.

        Args:
            app: ASGI application
            cache: Redis cache instance
            rate_limits: Rate limits per endpoint
            time_windows: Time windows for rate limiting
            burst_multiplier: Multiplier for burst limits
            cleanup_interval: Interval for cleaning expired keys
        """
        super().__init__(app)
        self._cache = cache
        self._rate_limits = rate_limits
        self._time_windows = time_windows
        self._burst_limits = {
            endpoint: int(limit * burst_multiplier)
            for endpoint, limit in rate_limits.items()
        }
        self._cleanup_interval = cleanup_interval
        self._last_cleanup = time.time()

        # Initialize monitoring metrics
        self._metrics = {
            'requests': 0,
            'exceeded': 0,
            'bursts': 0
        }

    def _get_rate_limit_key(self, endpoint: str, client_id: str, window: int) -> str:
        """
        Generate optimized Redis key for rate limiting.

        Args:
            endpoint: API endpoint
            client_id: Client identifier
            window: Time window timestamp

        Returns:
            Optimized Redis key
        """
        # Format: rl:{endpoint}:{client_id}:{window}
        return f"rl:{endpoint}:{client_id}:{window}"

    async def _check_rate_limit(
        self,
        endpoint: str,
        client_id: str
    ) -> Tuple[bool, int, Optional[int]]:
        """
        Check if request is within rate limit using sliding window.

        Args:
            endpoint: API endpoint
            client_id: Client identifier

        Returns:
            Tuple of (is_allowed, remaining_tokens, retry_after)
        """
        current_time = int(time.time())
        window = current_time - (current_time % self._time_windows['per_minute'])
        rate_key = self._get_rate_limit_key(endpoint, client_id, window)

        # Get current token count with sliding window
        current_count = await self._cache.get(rate_key) or 0
        limit = self._rate_limits.get(endpoint, self._rate_limits['default'])
        burst_limit = self._burst_limits[endpoint]

        if current_count >= burst_limit:
            retry_after = window + self._time_windows['per_minute'] - current_time
            return False, 0, retry_after

        # Update token count with distributed lock
        new_count = await self._cache.incr(rate_key)
        if new_count == 1:
            await self._cache.expire(rate_key, self._time_windows['per_minute'])

        remaining = burst_limit - new_count
        is_allowed = new_count <= burst_limit

        if not is_allowed:
            self._metrics['exceeded'] += 1
        elif new_count > limit:
            self._metrics['bursts'] += 1

        return is_allowed, remaining, None

    async def _cleanup_expired_keys(self) -> None:
        """Periodic cleanup of expired rate limit keys."""
        current_time = time.time()
        if current_time - self._last_cleanup >= self._cleanup_interval:
            await self._cache.clear_pattern("rl:*")
            self._last_cleanup = current_time

    async def dispatch(
        self,
        request: Request,
        call_next: Callable
    ) -> Response:
        """
        Middleware dispatch function for handling requests with rate limiting.

        Args:
            request: FastAPI request
            call_next: Next middleware in chain

        Returns:
            API response with rate limit headers
        """
        # Extract endpoint and client identifier
        endpoint = request.url.path.split("/")[3]  # Get service name from path
        client_id = request.headers.get("X-API-Key") or request.client.host

        # Increment request counter
        self._metrics['requests'] += 1

        # Check rate limit
        is_allowed, remaining, retry_after = await self._check_rate_limit(
            endpoint,
            client_id
        )

        # Periodic cleanup of expired keys
        await self._cleanup_expired_keys()

        # Add rate limit headers
        headers = {
            "X-RateLimit-Remaining": str(remaining),
            "X-RateLimit-Limit": str(self._burst_limits.get(
                endpoint,
                self._burst_limits['default']
            ))
        }

        if not is_allowed:
            headers["Retry-After"] = str(retry_after)
            return Response(
                content=ERROR_MESSAGES["RATE_LIMIT_EXCEEDED"].format(
                    time=retry_after
                ),
                status_code=HTTP_STATUS["TOO_MANY_REQUESTS"],
                headers=headers
            )

        # Process request if allowed
        response = await call_next(request)

        # Add rate limit headers to response
        for header, value in headers.items():
            response.headers[header] = value

        return response