"""
LinkedIn Ads platform adapter providing comprehensive integration capabilities with
enhanced error handling, rate limiting, and performance monitoring.

Version: 1.0.0
"""

import asyncio
from datetime import datetime
from typing import Dict, Any, Optional
from uuid import uuid4

import aiohttp  # v3.8.0
from tenacity import (  # v8.0.0
    retry, 
    stop_after_attempt, 
    wait_exponential,
    RetryError
)
from ratelimit import limits, RateLimitException  # v2.2.1
from circuitbreaker import circuit  # v1.3.0

from integration_service.models.platform_config import LinkedInAdsConfig
from common.logging.logger import ServiceLogger

# API Configuration
API_VERSION = "v2"
BASE_URL = "https://api.linkedin.com/v2/adAccounts"
CAMPAIGN_ENDPOINT = "/campaigns"
ANALYTICS_ENDPOINT = "/analytics"

# Rate Limiting Configuration
RATE_LIMIT_CAMPAIGN = 100  # requests per minute for campaign operations
RATE_LIMIT_ANALYTICS = 500  # requests per minute for analytics operations
RATE_LIMIT_WINDOW = 60  # window in seconds

logger = ServiceLogger("linkedin_ads_adapter")

class LinkedInAdsAdapter:
    """
    Advanced adapter for LinkedIn Ads API integration with comprehensive error handling,
    rate limiting, and performance monitoring.
    """

    def __init__(self, config: LinkedInAdsConfig):
        """
        Initialize LinkedIn Ads adapter with enhanced configuration and security.
        
        Args:
            config: LinkedIn Ads platform configuration
        """
        self._config = config
        self._config.validate_credentials()
        
        # Initialize aiohttp session with connection pooling
        self._session = aiohttp.ClientSession(
            headers={
                "Authorization": f"Bearer {self._config.access_token.get_secret_value()}",
                "X-Restli-Protocol-Version": "2.0.0",
                "Content-Type": "application/json"
            },
            timeout=aiohttp.ClientTimeout(total=30),
            connector=aiohttp.TCPConnector(limit=100, ttl_dns_cache=300)
        )
        
        # Initialize rate limiters
        self._campaign_limiter = limits(calls=RATE_LIMIT_CAMPAIGN, period=RATE_LIMIT_WINDOW)
        self._analytics_limiter = limits(calls=RATE_LIMIT_ANALYTICS, period=RATE_LIMIT_WINDOW)

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit with cleanup."""
        await self._session.close()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        reraise=True
    )
    @circuit(failure_threshold=5, recovery_timeout=60)
    async def create_campaign(self, campaign_data: Dict[str, Any]) -> str:
        """
        Creates a new campaign on LinkedIn Ads with comprehensive validation and error handling.
        
        Args:
            campaign_data: Campaign configuration data
            
        Returns:
            str: Created campaign ID
            
        Raises:
            ValueError: If campaign data is invalid
            RateLimitException: If rate limit is exceeded
            CircuitBreakerError: If circuit breaker is open
            Exception: For other API errors
        """
        correlation_id = str(uuid4())
        logger.info(
            "Creating LinkedIn campaign", 
            extra={"correlation_id": correlation_id, "campaign_data": campaign_data}
        )

        try:
            # Validate campaign data
            self._validate_campaign_data(campaign_data)
            
            # Apply rate limiting
            if not self._campaign_limiter():
                raise RateLimitException("Campaign creation rate limit exceeded")

            # Transform campaign data to LinkedIn format
            linkedin_data = self._transform_campaign_data(campaign_data)
            
            # Make API request
            async with self._session.post(
                f"{BASE_URL}/{self._config.account_id}{CAMPAIGN_ENDPOINT}",
                json=linkedin_data
            ) as response:
                if response.status == 201:
                    response_data = await response.json()
                    campaign_id = response_data.get("id")
                    logger.info(
                        "Campaign created successfully",
                        extra={
                            "correlation_id": correlation_id,
                            "campaign_id": campaign_id
                        }
                    )
                    return campaign_id
                    
                await self._handle_error_response(response, correlation_id)

        except Exception as e:
            logger.error(
                "Failed to create campaign",
                exc=e,
                extra={"correlation_id": correlation_id}
            )
            raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        reraise=True
    )
    @circuit(failure_threshold=5, recovery_timeout=60)
    async def update_campaign(self, campaign_id: str, updates: Dict[str, Any]) -> bool:
        """
        Updates an existing LinkedIn Ads campaign with validation and error tracking.
        
        Args:
            campaign_id: ID of campaign to update
            updates: Campaign updates to apply
            
        Returns:
            bool: Update success status
            
        Raises:
            ValueError: If update data is invalid
            RateLimitException: If rate limit is exceeded
            CircuitBreakerError: If circuit breaker is open
            Exception: For other API errors
        """
        correlation_id = str(uuid4())
        logger.info(
            "Updating LinkedIn campaign",
            extra={
                "correlation_id": correlation_id,
                "campaign_id": campaign_id,
                "updates": updates
            }
        )

        try:
            # Validate update data
            self._validate_update_data(updates)
            
            # Apply rate limiting
            if not self._campaign_limiter():
                raise RateLimitException("Campaign update rate limit exceeded")

            # Transform update data
            linkedin_updates = self._transform_campaign_data(updates)
            
            # Make API request
            async with self._session.patch(
                f"{BASE_URL}/{self._config.account_id}{CAMPAIGN_ENDPOINT}/{campaign_id}",
                json=linkedin_updates
            ) as response:
                if response.status == 200:
                    logger.info(
                        "Campaign updated successfully",
                        extra={
                            "correlation_id": correlation_id,
                            "campaign_id": campaign_id
                        }
                    )
                    return True
                    
                await self._handle_error_response(response, correlation_id)

        except Exception as e:
            logger.error(
                "Failed to update campaign",
                exc=e,
                extra={
                    "correlation_id": correlation_id,
                    "campaign_id": campaign_id
                }
            )
            raise

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=4, max=10),
        reraise=True
    )
    @circuit(failure_threshold=5, recovery_timeout=60)
    async def get_campaign_performance(
        self,
        campaign_id: str,
        metrics_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Retrieves campaign performance metrics with caching and batch processing.
        
        Args:
            campaign_id: Campaign ID to get metrics for
            metrics_config: Configuration for metrics retrieval
            
        Returns:
            Dict[str, Any]: Campaign performance metrics
            
        Raises:
            RateLimitException: If rate limit is exceeded
            CircuitBreakerError: If circuit breaker is open
            Exception: For other API errors
        """
        correlation_id = str(uuid4())
        logger.info(
            "Retrieving campaign performance",
            extra={
                "correlation_id": correlation_id,
                "campaign_id": campaign_id,
                "metrics_config": metrics_config
            }
        )

        try:
            # Apply rate limiting
            if not self._analytics_limiter():
                raise RateLimitException("Analytics rate limit exceeded")

            # Build analytics query
            query_params = self._build_analytics_query(campaign_id, metrics_config)
            
            # Make API request
            async with self._session.get(
                f"{BASE_URL}/{self._config.account_id}{ANALYTICS_ENDPOINT}",
                params=query_params
            ) as response:
                if response.status == 200:
                    metrics_data = await response.json()
                    processed_metrics = self._process_metrics_data(metrics_data)
                    logger.info(
                        "Retrieved campaign performance successfully",
                        extra={
                            "correlation_id": correlation_id,
                            "campaign_id": campaign_id
                        }
                    )
                    return processed_metrics
                    
                await self._handle_error_response(response, correlation_id)

        except Exception as e:
            logger.error(
                "Failed to retrieve campaign performance",
                exc=e,
                extra={
                    "correlation_id": correlation_id,
                    "campaign_id": campaign_id
                }
            )
            raise

    def _validate_campaign_data(self, campaign_data: Dict[str, Any]) -> None:
        """Validates campaign data structure and required fields."""
        required_fields = ["name", "objective", "status", "runSchedule"]
        missing_fields = [field for field in required_fields if field not in campaign_data]
        if missing_fields:
            raise ValueError(f"Missing required campaign fields: {missing_fields}")

    def _validate_update_data(self, update_data: Dict[str, Any]) -> None:
        """Validates campaign update data."""
        allowed_fields = ["name", "status", "runSchedule", "targeting", "budget"]
        invalid_fields = [field for field in update_data if field not in allowed_fields]
        if invalid_fields:
            raise ValueError(f"Invalid update fields: {invalid_fields}")

    def _transform_campaign_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Transforms campaign data to LinkedIn API format."""
        return {
            "account": f"urn:li:sponsoredAccount:{self._config.account_id}",
            **data
        }

    def _build_analytics_query(
        self,
        campaign_id: str,
        metrics_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Builds analytics query parameters."""
        return {
            "q": "analytics",
            "pivot": "CAMPAIGN",
            "dateRange.start.day": metrics_config.get("start_date"),
            "dateRange.end.day": metrics_config.get("end_date"),
            "campaigns[0]": f"urn:li:sponsoredCampaign:{campaign_id}",
            "fields": ",".join(metrics_config.get("metrics", []))
        }

    def _process_metrics_data(self, metrics_data: Dict[str, Any]) -> Dict[str, Any]:
        """Processes and normalizes metrics data."""
        processed = {}
        for element in metrics_data.get("elements", []):
            for metric in element.get("metrics", []):
                processed[metric["name"]] = metric["value"]
        return processed

    async def _handle_error_response(
        self,
        response: aiohttp.ClientResponse,
        correlation_id: str
    ) -> None:
        """Handles API error responses with detailed logging."""
        error_data = await response.json()
        logger.error(
            "LinkedIn API error",
            extra={
                "correlation_id": correlation_id,
                "status_code": response.status,
                "error_data": error_data
            }
        )
        
        if response.status == 429:
            raise RateLimitException("LinkedIn API rate limit exceeded")
        elif response.status == 401:
            raise ValueError("Invalid or expired access token")
        elif response.status == 403:
            raise ValueError("Insufficient permissions")
        else:
            raise Exception(f"LinkedIn API error: {error_data}")