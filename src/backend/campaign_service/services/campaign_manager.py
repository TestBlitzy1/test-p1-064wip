"""
Campaign Manager Service for managing digital advertising campaigns across multiple platforms.
Provides AI-powered campaign generation, multi-platform deployment, and performance monitoring.

Version: 1.0.0
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from uuid import uuid4

from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode
from prometheus_client import Counter, Histogram, Gauge
import pybreaker

from campaign_service.models.campaign import Campaign
from campaign_service.services.campaign_generator import CampaignGeneratorService
from integration_service.services.platform_manager import PlatformManager
from common.logging.logger import ServiceLogger

# Campaign status constants
CAMPAIGN_STATUSES = ['DRAFT', 'PENDING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED', 'ERROR']

# Performance and resilience settings
MAX_RETRY_ATTEMPTS = 3
SYNC_INTERVAL_SECONDS = 300
CIRCUIT_BREAKER_THRESHOLD = 5
CACHE_EXPIRY_SECONDS = 600

# Monitoring metrics
CAMPAIGN_OPERATIONS = Counter(
    'campaign_operations_total',
    'Total campaign operations',
    ['operation', 'platform', 'status']
)

GENERATION_TIME = Histogram(
    'campaign_generation_seconds',
    'Time spent generating campaign structure',
    buckets=[5, 10, 15, 20, 25, 30]
)

ACTIVE_CAMPAIGNS = Gauge(
    'active_campaigns_total',
    'Number of active campaigns'
)

@trace.instrument_class
class CampaignManager:
    """
    Enhanced campaign lifecycle manager with comprehensive validation,
    monitoring, and error handling capabilities.
    """

    def __init__(
        self,
        generator_service: CampaignGeneratorService,
        platform_manager: PlatformManager,
        cache_service: Any
    ) -> None:
        """
        Initialize campaign manager with enhanced services and monitoring.

        Args:
            generator_service: AI-powered campaign generation service
            platform_manager: Multi-platform deployment manager
            cache_service: Caching service for performance optimization
        """
        self._generator_service = generator_service
        self._platform_manager = platform_manager
        self._cache = cache_service
        self._logger = ServiceLogger("campaign_manager")
        self._tracer = trace.get_tracer(__name__)

        # Initialize circuit breaker for platform operations
        self._circuit_breaker = pybreaker.CircuitBreaker(
            fail_max=CIRCUIT_BREAKER_THRESHOLD,
            reset_timeout=60,
            name="platform_operations"
        )

    async def create_campaign(
        self,
        name: str,
        description: str,
        platforms: List[str],
        total_budget: float,
        targeting_settings: Dict[str, Any],
        start_date: datetime,
        end_date: datetime
    ) -> Campaign:
        """
        Creates and deploys a new campaign with AI-powered optimization.

        Args:
            name: Campaign name
            description: Campaign description
            platforms: Target advertising platforms
            total_budget: Campaign budget
            targeting_settings: Audience targeting configuration
            start_date: Campaign start date
            end_date: Campaign end date

        Returns:
            Created campaign instance with platform IDs

        Raises:
            ValueError: If validation fails
            RuntimeError: If campaign creation fails
        """
        correlation_id = str(uuid4())
        
        with self._tracer.start_as_current_span("create_campaign") as span:
            span.set_attribute("correlation_id", correlation_id)
            span.set_attribute("platforms", str(platforms))

            try:
                self._logger.info(
                    "Creating new campaign",
                    extra={
                        "correlation_id": correlation_id,
                        "name": name,
                        "platforms": platforms
                    }
                )

                # Check cache for similar campaigns
                cache_key = f"campaign:{name}:{','.join(platforms)}"
                cached_structure = await self._cache.get(cache_key)
                if cached_structure:
                    self._logger.info("Using cached campaign structure")
                    return Campaign(**cached_structure)

                # Generate campaign structure using AI
                with GENERATION_TIME.time():
                    campaign_structure = await self._generator_service.generate_campaign(
                        campaign_objective=description,
                        platform=platforms[0],  # Primary platform
                        target_audience=targeting_settings,
                        budget=total_budget,
                        format_preferences={}
                    )

                # Validate generated structure
                is_valid, error_msg, details = await self._generator_service.validate_campaign(
                    campaign_structure
                )
                if not is_valid:
                    raise ValueError(f"Campaign validation failed: {error_msg}")

                # Create campaign instance
                campaign = Campaign(
                    name=name,
                    description=description,
                    platform_type=platforms[0].upper(),
                    total_budget=total_budget,
                    start_date=start_date,
                    end_date=end_date,
                    targeting_settings=targeting_settings,
                    platform_settings=campaign_structure.get('platform_settings', {})
                )

                # Deploy to platforms with circuit breaker protection
                platform_results = await self._circuit_breaker.call(
                    self._deploy_to_platforms,
                    campaign,
                    platforms
                )

                # Update campaign with platform IDs
                for platform, result in platform_results.items():
                    if result['status'] == 'success':
                        campaign.platform_settings[platform] = {
                            'campaign_id': result['campaign_id']
                        }

                # Cache successful campaign structure
                await self._cache.set(
                    cache_key,
                    campaign.to_dict(),
                    expire=CACHE_EXPIRY_SECONDS
                )

                CAMPAIGN_OPERATIONS.labels(
                    operation='create',
                    platform=platforms[0],
                    status='success'
                ).inc()

                ACTIVE_CAMPAIGNS.inc()

                span.set_status(Status(StatusCode.OK))
                return campaign

            except Exception as e:
                CAMPAIGN_OPERATIONS.labels(
                    operation='create',
                    platform=platforms[0],
                    status='error'
                ).inc()

                self._logger.error(
                    "Campaign creation failed",
                    exc=e,
                    extra={"correlation_id": correlation_id}
                )
                span.set_status(Status(StatusCode.ERROR, str(e)))
                raise

    async def _deploy_to_platforms(
        self,
        campaign: Campaign,
        platforms: List[str]
    ) -> Dict[str, Any]:
        """
        Deploys campaign to specified platforms with enhanced error handling.

        Args:
            campaign: Campaign to deploy
            platforms: Target platforms

        Returns:
            Dict containing deployment results per platform
        """
        platform_data = campaign.to_platform_format()
        
        results = await self._platform_manager.create_campaign(
            campaign_data=platform_data,
            platforms=platforms
        )
        
        return results.get('results', {})

    async def update_campaign_status(
        self,
        campaign_id: str,
        new_status: str
    ) -> bool:
        """
        Updates campaign status with validation and platform synchronization.

        Args:
            campaign_id: Campaign ID
            new_status: New status to set

        Returns:
            bool: Update success status
        """
        if new_status not in CAMPAIGN_STATUSES:
            raise ValueError(f"Invalid campaign status: {new_status}")

        correlation_id = str(uuid4())

        with self._tracer.start_as_current_span("update_campaign_status") as span:
            span.set_attribute("correlation_id", correlation_id)
            span.set_attribute("campaign_id", campaign_id)
            span.set_attribute("new_status", new_status)

            try:
                campaign = await Campaign.get(campaign_id)
                if not campaign:
                    raise ValueError(f"Campaign not found: {campaign_id}")

                # Update campaign status
                campaign.update_status(new_status)

                # Sync status with platforms
                platform_updates = await self._circuit_breaker.call(
                    self._platform_manager.update_campaign,
                    campaign_id,
                    {"status": new_status}
                )

                CAMPAIGN_OPERATIONS.labels(
                    operation='update_status',
                    platform=campaign.platform_type.lower(),
                    status='success'
                ).inc()

                if new_status in ['COMPLETED', 'FAILED']:
                    ACTIVE_CAMPAIGNS.dec()

                span.set_status(Status(StatusCode.OK))
                return True

            except Exception as e:
                CAMPAIGN_OPERATIONS.labels(
                    operation='update_status',
                    platform=campaign.platform_type.lower(),
                    status='error'
                ).inc()

                self._logger.error(
                    "Failed to update campaign status",
                    exc=e,
                    extra={"correlation_id": correlation_id}
                )
                span.set_status(Status(StatusCode.ERROR, str(e)))
                raise

    async def get_campaign_performance(
        self,
        campaign_id: str,
        metrics_config: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Retrieves campaign performance metrics with caching.

        Args:
            campaign_id: Campaign ID
            metrics_config: Optional metrics configuration

        Returns:
            Dict containing performance metrics
        """
        correlation_id = str(uuid4())

        with self._tracer.start_as_current_span("get_campaign_performance") as span:
            span.set_attribute("correlation_id", correlation_id)
            span.set_attribute("campaign_id", campaign_id)

            try:
                # Check cache
                cache_key = f"performance:{campaign_id}"
                cached_metrics = await self._cache.get(cache_key)
                if cached_metrics:
                    return cached_metrics

                campaign = await Campaign.get(campaign_id)
                if not campaign:
                    raise ValueError(f"Campaign not found: {campaign_id}")

                # Get performance data from platform
                metrics = await self._circuit_breaker.call(
                    self._platform_manager.get_campaign_performance,
                    campaign_id,
                    metrics_config or {}
                )

                # Cache results
                await self._cache.set(
                    cache_key,
                    metrics,
                    expire=300  # 5 minutes
                )

                CAMPAIGN_OPERATIONS.labels(
                    operation='get_performance',
                    platform=campaign.platform_type.lower(),
                    status='success'
                ).inc()

                span.set_status(Status(StatusCode.OK))
                return metrics

            except Exception as e:
                CAMPAIGN_OPERATIONS.labels(
                    operation='get_performance',
                    platform=campaign.platform_type.lower(),
                    status='error'
                ).inc()

                self._logger.error(
                    "Failed to retrieve campaign performance",
                    exc=e,
                    extra={"correlation_id": correlation_id}
                )
                span.set_status(Status(StatusCode.ERROR, str(e)))
                raise