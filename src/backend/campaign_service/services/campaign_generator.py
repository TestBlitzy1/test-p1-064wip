"""
Campaign Generator Service for automated campaign structure generation.
Provides AI-powered campaign creation with performance monitoring and error handling.
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional, Tuple

from pydantic import BaseModel, validator, Field
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode
from prometheus_client import Counter, Histogram, Gauge

from campaign_service.models.campaign import Campaign
from ai_service.models.campaign_generator import CampaignGenerator

# Performance monitoring metrics
GENERATION_TIME = Histogram(
    'campaign_generation_seconds',
    'Time spent generating campaign structure',
    buckets=[5, 10, 15, 20, 25, 30]
)
GENERATION_ERRORS = Counter(
    'campaign_generation_errors_total',
    'Total campaign generation errors',
    ['error_type']
)
ACTIVE_GENERATIONS = Gauge(
    'campaign_generations_active',
    'Number of active campaign generations'
)

# Platform and validation constants
SUPPORTED_PLATFORMS = ['linkedin', 'google']
DEFAULT_MAX_BUDGET = 1000000.0
MIN_BUDGET_PER_PLATFORM = {
    "linkedin": 10.0,
    "google": 5.0
}
GENERATION_TIMEOUT = 30
PERFORMANCE_THRESHOLDS = {
    "warning_time": 25,
    "critical_time": 28
}
RETRY_CONFIG = {
    "max_retries": 3,
    "backoff_factor": 1.5
}

class CampaignRequest(BaseModel):
    """Validation model for campaign generation requests."""
    
    campaign_name: str = Field(..., min_length=1, max_length=255)
    platform: str = Field(..., regex='^(linkedin|google)$')
    budget: float = Field(..., gt=0, le=DEFAULT_MAX_BUDGET)
    objectives: Dict[str, Any]
    targeting_criteria: Dict[str, Any]
    start_date: datetime
    end_date: datetime

    @validator('platform')
    def validate_platform(cls, v):
        if v not in SUPPORTED_PLATFORMS:
            raise ValueError(f"Unsupported platform: {v}")
        return v

    @validator('budget')
    def validate_budget(cls, v, values):
        platform = values.get('platform')
        if platform and v < MIN_BUDGET_PER_PLATFORM.get(platform, 0):
            raise ValueError(f"Minimum budget for {platform} is ${MIN_BUDGET_PER_PLATFORM[platform]}")
        return v

class CampaignGeneratorService:
    """Service for generating optimized campaign structures using AI models."""

    def __init__(self, ai_generator: CampaignGenerator, cache: Any) -> None:
        """
        Initialize campaign generator service with monitoring and caching.

        Args:
            ai_generator: AI model for campaign generation
            cache: Caching service instance
        """
        self._ai_generator = ai_generator
        self._cache = cache
        self._logger = logging.getLogger(__name__)
        self._tracer = trace.get_tracer(__name__)

    async def generate_campaign(
        self,
        campaign_name: str,
        platform: str,
        budget: float,
        objectives: Dict[str, Any],
        targeting_criteria: Dict[str, Any],
        start_date: datetime,
        end_date: datetime
    ) -> Campaign:
        """
        Generate optimized campaign structure with performance monitoring.

        Args:
            campaign_name: Name of the campaign
            platform: Target advertising platform
            budget: Campaign budget
            objectives: Campaign objectives and goals
            targeting_criteria: Targeting settings
            start_date: Campaign start date
            end_date: Campaign end date

        Returns:
            Campaign: Generated campaign instance

        Raises:
            ValueError: For validation errors
            TimeoutError: If generation exceeds timeout
            RuntimeError: For generation failures
        """
        with self._tracer.start_as_current_span("generate_campaign") as span:
            span.set_attribute("campaign.name", campaign_name)
            span.set_attribute("campaign.platform", platform)

            try:
                # Validate request
                request = CampaignRequest(
                    campaign_name=campaign_name,
                    platform=platform,
                    budget=budget,
                    objectives=objectives,
                    targeting_criteria=targeting_criteria,
                    start_date=start_date,
                    end_date=end_date
                )

                # Check cache
                cache_key = f"campaign:{platform}:{hash(str(request.dict()))}"
                cached_structure = await self._cache.get(cache_key)
                if cached_structure:
                    self._logger.info(f"Cache hit for campaign: {campaign_name}")
                    return Campaign(**cached_structure)

                # Monitor active generations
                ACTIVE_GENERATIONS.inc()

                # Generate with timeout
                with GENERATION_TIME.time():
                    structure = await asyncio.wait_for(
                        self._generate_structure(request),
                        timeout=GENERATION_TIMEOUT
                    )

                # Validate structure
                is_valid, error_msg, details = await self.validate_campaign(structure)
                if not is_valid:
                    raise ValueError(f"Invalid campaign structure: {error_msg}")

                # Optimize budget
                optimized = await self.optimize_budget(structure)

                # Create campaign instance
                campaign = Campaign(
                    name=campaign_name,
                    platform_type=platform.upper(),
                    total_budget=budget,
                    start_date=start_date,
                    end_date=end_date,
                    targeting_settings=targeting_criteria,
                    platform_settings=optimized.get('platform_settings', {}),
                    description=objectives.get('description', '')
                )

                # Cache successful result
                await self._cache.set(cache_key, campaign.to_dict(), expire=3600)

                span.set_status(Status(StatusCode.OK))
                return campaign

            except ValueError as e:
                GENERATION_ERRORS.labels(error_type="validation").inc()
                span.set_status(Status(StatusCode.ERROR, str(e)))
                raise

            except asyncio.TimeoutError:
                GENERATION_ERRORS.labels(error_type="timeout").inc()
                span.set_status(Status(StatusCode.ERROR, "Generation timeout"))
                raise TimeoutError("Campaign generation exceeded time limit")

            except Exception as e:
                GENERATION_ERRORS.labels(error_type="runtime").inc()
                self._logger.error(f"Campaign generation failed: {str(e)}", exc_info=True)
                span.set_status(Status(StatusCode.ERROR, str(e)))
                raise RuntimeError(f"Campaign generation failed: {str(e)}")

            finally:
                ACTIVE_GENERATIONS.dec()

    async def validate_campaign(self, campaign: Dict[str, Any]) -> Tuple[bool, str, Dict]:
        """
        Validate generated campaign structure with detailed reporting.

        Args:
            campaign: Campaign structure to validate

        Returns:
            Tuple containing (is_valid, error_message, validation_details)
        """
        with self._tracer.start_as_current_span("validate_campaign") as span:
            try:
                return await self._ai_generator.validate_structure(
                    campaign,
                    campaign.get('platform'),
                    strict_mode=True
                )
            except Exception as e:
                span.set_status(Status(StatusCode.ERROR, str(e)))
                return False, str(e), {}

    async def optimize_budget(self, campaign: Dict[str, Any]) -> Dict[str, Any]:
        """
        Optimize budget allocation across campaign components.

        Args:
            campaign: Campaign structure to optimize

        Returns:
            Dict containing optimized budget allocation
        """
        with self._tracer.start_as_current_span("optimize_budget") as span:
            try:
                return await self._ai_generator.optimize_budget_allocation(
                    campaign,
                    campaign.get('budget', 0),
                    {}  # Performance history placeholder
                )
            except Exception as e:
                span.set_status(Status(StatusCode.ERROR, str(e)))
                raise ValueError(f"Budget optimization failed: {str(e)}")

    async def _generate_structure(self, request: CampaignRequest) -> Dict[str, Any]:
        """
        Internal method for campaign structure generation.

        Args:
            request: Validated campaign request

        Returns:
            Dict containing generated campaign structure
        """
        return await self._ai_generator.generate_campaign_structure(
            campaign_objective=request.objectives.get('primary_objective'),
            platform=request.platform,
            target_audience=request.targeting_criteria,
            budget=request.budget,
            format_preferences=request.objectives.get('format_preferences', {})
        )