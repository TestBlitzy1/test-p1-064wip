"""
Platform Manager Service for orchestrating operations across multiple advertising platforms
with enhanced error handling, monitoring, and rate limiting capabilities.

Version: 1.0.0
"""

import asyncio
from datetime import datetime
from typing import Dict, List, Union, Any, Optional
from uuid import uuid4

from tenacity import (  # v8.0.0
    retry,
    stop_after_attempt,
    wait_exponential,
    RetryError
)
from opentelemetry import trace  # v1.20.0
from prometheus_client import Counter, Histogram  # v0.17.1
import pybreaker  # v1.0.1

from integration_service.adapters.linkedin_ads import LinkedInAdsAdapter
from integration_service.adapters.google_ads import GoogleAdsAdapter
from common.logging.logger import ServiceLogger

# Platform configuration and constants
SUPPORTED_PLATFORMS = {
    "linkedin": LinkedInAdsAdapter,
    "google": GoogleAdsAdapter
}

DEFAULT_TIMEOUT_SECONDS = 30
MAX_RETRIES = 3
RATE_LIMIT_THRESHOLDS = {
    "linkedin": 0.8,  # 80% of rate limit
    "google": 0.9     # 90% of rate limit
}

CIRCUIT_BREAKER_CONFIG = {
    "failure_threshold": 5,
    "reset_timeout": 60
}

# Initialize metrics
PLATFORM_OPERATIONS = Counter(
    'platform_operations_total',
    'Total platform operations',
    ['platform', 'operation', 'status']
)

OPERATION_DURATION = Histogram(
    'platform_operation_duration_seconds',
    'Platform operation duration in seconds',
    ['platform', 'operation']
)

# Initialize tracing
tracer = trace.get_tracer(__name__)

class PlatformManager:
    """
    Enhanced manager for operations across multiple advertising platforms with
    advanced error handling, monitoring, and rate limiting capabilities.
    """

    def __init__(self, platform_configs: Dict[str, Union[Dict, Any]]):
        """
        Initialize platform manager with enhanced configuration and monitoring.

        Args:
            platform_configs: Configuration for each platform
        """
        self.logger = ServiceLogger("platform_manager")
        self._platform_adapters = {}
        self._circuit_breakers = {}
        self._rate_limit_usage = {}

        # Initialize platform adapters and circuit breakers
        for platform, config in platform_configs.items():
            if platform not in SUPPORTED_PLATFORMS:
                raise ValueError(f"Unsupported platform: {platform}")

            # Initialize platform adapter
            adapter_class = SUPPORTED_PLATFORMS[platform]
            self._platform_adapters[platform] = adapter_class(config)

            # Initialize circuit breaker
            self._circuit_breakers[platform] = pybreaker.CircuitBreaker(
                fail_max=CIRCUIT_BREAKER_CONFIG["failure_threshold"],
                reset_timeout=CIRCUIT_BREAKER_CONFIG["reset_timeout"],
                name=f"{platform}_circuit"
            )

            # Initialize rate limit tracking
            self._rate_limit_usage[platform] = 0.0

        self.logger.info("Platform manager initialized successfully")

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        reraise=True
    )
    async def create_campaign(
        self,
        campaign_data: Dict[str, Any],
        platforms: List[str],
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Creates a campaign across specified platforms with enhanced error handling
        and monitoring.

        Args:
            campaign_data: Campaign configuration and settings
            platforms: List of platforms to create campaign on
            options: Optional platform-specific options

        Returns:
            Dict containing campaign IDs and status per platform

        Raises:
            ValueError: If platform validation fails
            Exception: For other creation errors
        """
        correlation_id = str(uuid4())
        results = {}
        options = options or {}

        with tracer.start_as_current_span("create_campaign") as span:
            span.set_attribute("correlation_id", correlation_id)
            span.set_attribute("platforms", str(platforms))

            self.logger.info(
                "Creating campaign across platforms",
                extra={
                    "correlation_id": correlation_id,
                    "platforms": platforms,
                    "campaign_data": campaign_data
                }
            )

            # Validate platforms
            self._validate_platforms(platforms)

            # Create campaigns concurrently
            tasks = []
            for platform in platforms:
                task = self._create_platform_campaign(
                    platform,
                    campaign_data,
                    options.get(platform, {}),
                    correlation_id
                )
                tasks.append(task)

            platform_results = await asyncio.gather(*tasks, return_exceptions=True)

            # Process results
            for platform, result in zip(platforms, platform_results):
                if isinstance(result, Exception):
                    self.logger.error(
                        f"Campaign creation failed for {platform}",
                        extra={
                            "correlation_id": correlation_id,
                            "platform": platform,
                            "error": str(result)
                        }
                    )
                    results[platform] = {
                        "status": "error",
                        "error": str(result)
                    }
                    PLATFORM_OPERATIONS.labels(
                        platform=platform,
                        operation="create_campaign",
                        status="error"
                    ).inc()
                else:
                    results[platform] = {
                        "status": "success",
                        "campaign_id": result
                    }
                    PLATFORM_OPERATIONS.labels(
                        platform=platform,
                        operation="create_campaign",
                        status="success"
                    ).inc()

            return {
                "correlation_id": correlation_id,
                "timestamp": datetime.utcnow().isoformat(),
                "results": results
            }

    async def _create_platform_campaign(
        self,
        platform: str,
        campaign_data: Dict[str, Any],
        platform_options: Dict[str, Any],
        correlation_id: str
    ) -> str:
        """
        Creates a campaign on a specific platform with circuit breaker protection.

        Args:
            platform: Target platform
            campaign_data: Campaign configuration
            platform_options: Platform-specific options
            correlation_id: Operation correlation ID

        Returns:
            Created campaign ID

        Raises:
            Exception: If campaign creation fails
        """
        start_time = datetime.utcnow()

        try:
            # Check rate limits
            await self._check_rate_limits(platform)

            # Apply circuit breaker
            campaign_id = await self._circuit_breakers[platform].call(
                self._platform_adapters[platform].create_campaign,
                campaign_data
            )

            duration = (datetime.utcnow() - start_time).total_seconds()
            OPERATION_DURATION.labels(
                platform=platform,
                operation="create_campaign"
            ).observe(duration)

            return campaign_id

        except Exception as e:
            self.logger.error(
                f"Platform operation failed: {platform}",
                extra={
                    "correlation_id": correlation_id,
                    "platform": platform,
                    "error": str(e)
                }
            )
            raise

    async def _check_rate_limits(self, platform: str) -> None:
        """
        Checks and manages rate limits for platform operations.

        Args:
            platform: Platform to check rate limits for

        Raises:
            Exception: If rate limit exceeded
        """
        if platform == "linkedin":
            rate_limit = await self._platform_adapters[platform].validate_rate_limits()
        else:  # google
            rate_limit = await self._platform_adapters[platform].check_quota_usage()

        threshold = RATE_LIMIT_THRESHOLDS[platform]
        if rate_limit > threshold:
            raise Exception(f"Rate limit threshold exceeded for {platform}")

        self._rate_limit_usage[platform] = rate_limit

    def _validate_platforms(self, platforms: List[str]) -> None:
        """
        Validates platform availability and configuration.

        Args:
            platforms: Platforms to validate

        Raises:
            ValueError: If platform validation fails
        """
        invalid_platforms = [p for p in platforms if p not in SUPPORTED_PLATFORMS]
        if invalid_platforms:
            raise ValueError(f"Unsupported platforms: {invalid_platforms}")

        unconfigured_platforms = [
            p for p in platforms if p not in self._platform_adapters
        ]
        if unconfigured_platforms:
            raise ValueError(f"Unconfigured platforms: {unconfigured_platforms}")