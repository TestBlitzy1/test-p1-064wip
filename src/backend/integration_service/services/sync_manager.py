"""
Advanced synchronization manager for campaign data and performance metrics across advertising platforms
with comprehensive monitoring, error handling, and optimization capabilities.

Version: 1.0.0
"""

import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Any
from uuid import uuid4

from tenacity import (  # v8.0.0
    retry,
    stop_after_attempt,
    wait_exponential,
    RetryError
)
from prometheus_client import (  # v0.16.0
    Counter,
    Histogram,
    Gauge
)
from cachetools import TTLCache  # v5.3.0
import aiohttp  # v3.8.0

from integration_service.services.platform_manager import PlatformManager
from common.logging.logger import ServiceLogger

# Sync configuration constants
SYNC_INTERVAL_SECONDS = 300  # 5 minutes
MAX_SYNC_RETRIES = 3
SYNC_BATCH_SIZE = 50
RATE_LIMIT_WINDOW = 60
MAX_CONCURRENT_SYNCS = 1000

# Initialize metrics
SYNC_OPERATIONS = Counter(
    'sync_operations_total',
    'Total sync operations',
    ['operation', 'platform', 'status']
)

SYNC_DURATION = Histogram(
    'sync_operation_duration_seconds',
    'Sync operation duration in seconds',
    ['operation', 'platform']
)

ACTIVE_SYNCS = Gauge(
    'active_sync_tasks',
    'Number of active sync tasks'
)

class SyncManager:
    """
    Advanced synchronization manager for campaign data and performance metrics across
    advertising platforms with built-in monitoring and optimization.
    """

    def __init__(self, platform_manager: PlatformManager):
        """
        Initialize sync manager with enhanced monitoring and caching capabilities.

        Args:
            platform_manager: Platform manager instance for ad platform operations
        """
        self.logger = ServiceLogger("sync_manager")
        self._platform_manager = platform_manager
        self._sync_tasks: Dict[str, asyncio.Task] = {}
        self._last_sync_time: Dict[str, datetime] = {}
        
        # Initialize performance metrics cache
        self._metrics_cache = TTLCache(
            maxsize=10000,
            ttl=300  # 5 minutes TTL
        )
        
        # Initialize connection pool for concurrent operations
        self._session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            connector=aiohttp.TCPConnector(limit=100)
        )
        
        self.logger.info("Sync manager initialized successfully")

    async def start_sync_task(
        self,
        campaign_id: str,
        platforms: List[str],
        sync_config: Dict[str, Any]
    ) -> asyncio.Task:
        """
        Starts a monitored synchronization task for a campaign with rate limiting.

        Args:
            campaign_id: Campaign identifier
            platforms: List of platforms to sync
            sync_config: Sync configuration parameters

        Returns:
            Monitored sync task handle

        Raises:
            ValueError: If validation fails
            Exception: For other sync errors
        """
        correlation_id = str(uuid4())
        
        self.logger.info(
            "Starting sync task",
            extra={
                "correlation_id": correlation_id,
                "campaign_id": campaign_id,
                "platforms": platforms
            }
        )

        # Validate concurrent sync limits
        if len(self._sync_tasks) >= MAX_CONCURRENT_SYNCS:
            raise ValueError("Maximum concurrent sync limit reached")

        # Create and monitor sync task
        task = asyncio.create_task(
            self._run_sync_task(
                campaign_id,
                platforms,
                sync_config,
                correlation_id
            )
        )
        
        self._sync_tasks[campaign_id] = task
        ACTIVE_SYNCS.inc()

        return task

    @retry(
        stop=stop_after_attempt(MAX_SYNC_RETRIES),
        wait=wait_exponential(multiplier=1, min=4, max=10)
    )
    async def sync_campaign_data(
        self,
        campaign_id: str,
        platforms: List[str]
    ) -> Dict[str, bool]:
        """
        Synchronizes campaign data with enhanced validation and monitoring.

        Args:
            campaign_id: Campaign identifier
            platforms: Platforms to sync data for

        Returns:
            Dict containing sync status per platform

        Raises:
            Exception: If sync operation fails
        """
        correlation_id = str(uuid4())
        start_time = datetime.utcnow()
        results = {}

        try:
            self.logger.info(
                "Syncing campaign data",
                extra={
                    "correlation_id": correlation_id,
                    "campaign_id": campaign_id,
                    "platforms": platforms
                }
            )

            # Sync data for each platform
            for platform in platforms:
                try:
                    # Get latest campaign data
                    campaign_data = await self._platform_manager.get_campaign_data(
                        campaign_id,
                        platform
                    )

                    # Update campaign on platform
                    await self._platform_manager.update_campaign(
                        campaign_id,
                        campaign_data,
                        platform
                    )

                    results[platform] = True
                    SYNC_OPERATIONS.labels(
                        operation="sync_campaign",
                        platform=platform,
                        status="success"
                    ).inc()

                except Exception as e:
                    self.logger.error(
                        f"Failed to sync campaign data for platform: {platform}",
                        exc=e,
                        extra={
                            "correlation_id": correlation_id,
                            "campaign_id": campaign_id
                        }
                    )
                    results[platform] = False
                    SYNC_OPERATIONS.labels(
                        operation="sync_campaign",
                        platform=platform,
                        status="error"
                    ).inc()

            # Record sync duration
            duration = (datetime.utcnow() - start_time).total_seconds()
            SYNC_DURATION.labels(
                operation="sync_campaign",
                platform="all"
            ).observe(duration)

            return results

        except Exception as e:
            self.logger.error(
                "Campaign sync failed",
                exc=e,
                extra={
                    "correlation_id": correlation_id,
                    "campaign_id": campaign_id
                }
            )
            raise

    async def sync_performance_metrics(
        self,
        campaign_id: str,
        platforms: List[str],
        metrics_config: Dict[str, Any]
    ) -> Dict[str, Dict[str, Any]]:
        """
        Synchronizes and analyzes campaign performance metrics with caching.

        Args:
            campaign_id: Campaign identifier
            platforms: Platforms to sync metrics for
            metrics_config: Metrics configuration parameters

        Returns:
            Dict containing performance metrics per platform

        Raises:
            Exception: If metrics sync fails
        """
        correlation_id = str(uuid4())
        start_time = datetime.utcnow()
        results = {}

        try:
            # Check cache for recent metrics
            cache_key = f"{campaign_id}:metrics"
            cached_metrics = self._metrics_cache.get(cache_key)
            if cached_metrics:
                return cached_metrics

            self.logger.info(
                "Syncing performance metrics",
                extra={
                    "correlation_id": correlation_id,
                    "campaign_id": campaign_id,
                    "platforms": platforms
                }
            )

            # Collect metrics from each platform
            for platform in platforms:
                try:
                    metrics = await self._platform_manager.get_performance(
                        campaign_id,
                        platform,
                        metrics_config
                    )

                    results[platform] = self._process_metrics(metrics)
                    SYNC_OPERATIONS.labels(
                        operation="sync_metrics",
                        platform=platform,
                        status="success"
                    ).inc()

                except Exception as e:
                    self.logger.error(
                        f"Failed to sync metrics for platform: {platform}",
                        exc=e,
                        extra={
                            "correlation_id": correlation_id,
                            "campaign_id": campaign_id
                        }
                    )
                    results[platform] = {"error": str(e)}
                    SYNC_OPERATIONS.labels(
                        operation="sync_metrics",
                        platform=platform,
                        status="error"
                    ).inc()

            # Cache results
            self._metrics_cache[cache_key] = results

            # Record sync duration
            duration = (datetime.utcnow() - start_time).total_seconds()
            SYNC_DURATION.labels(
                operation="sync_metrics",
                platform="all"
            ).observe(duration)

            return results

        except Exception as e:
            self.logger.error(
                "Performance metrics sync failed",
                exc=e,
                extra={
                    "correlation_id": correlation_id,
                    "campaign_id": campaign_id
                }
            )
            raise

    async def _run_sync_task(
        self,
        campaign_id: str,
        platforms: List[str],
        sync_config: Dict[str, Any],
        correlation_id: str
    ) -> None:
        """
        Runs the sync task with monitoring and error handling.

        Args:
            campaign_id: Campaign identifier
            platforms: Platforms to sync
            sync_config: Sync configuration
            correlation_id: Operation correlation ID
        """
        try:
            while True:
                try:
                    # Sync campaign data
                    await self.sync_campaign_data(campaign_id, platforms)

                    # Sync performance metrics
                    await self.sync_performance_metrics(
                        campaign_id,
                        platforms,
                        sync_config.get("metrics", {})
                    )

                    self._last_sync_time[campaign_id] = datetime.utcnow()

                except Exception as e:
                    self.logger.error(
                        "Sync task iteration failed",
                        exc=e,
                        extra={
                            "correlation_id": correlation_id,
                            "campaign_id": campaign_id
                        }
                    )

                # Wait for next sync interval
                await asyncio.sleep(SYNC_INTERVAL_SECONDS)

        except asyncio.CancelledError:
            self.logger.info(
                "Sync task cancelled",
                extra={
                    "correlation_id": correlation_id,
                    "campaign_id": campaign_id
                }
            )
        finally:
            # Cleanup
            del self._sync_tasks[campaign_id]
            ACTIVE_SYNCS.dec()

    def _process_metrics(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes and normalizes performance metrics.

        Args:
            metrics: Raw performance metrics

        Returns:
            Processed and normalized metrics
        """
        processed = {
            "impressions": metrics.get("impressions", 0),
            "clicks": metrics.get("clicks", 0),
            "conversions": metrics.get("conversions", 0),
            "spend": metrics.get("spend", 0.0),
            "ctr": self._calculate_ctr(
                metrics.get("clicks", 0),
                metrics.get("impressions", 0)
            ),
            "cpc": self._calculate_cpc(
                metrics.get("spend", 0.0),
                metrics.get("clicks", 0)
            ),
            "conversion_rate": self._calculate_conversion_rate(
                metrics.get("conversions", 0),
                metrics.get("clicks", 0)
            ),
            "timestamp": datetime.utcnow().isoformat()
        }
        return processed

    @staticmethod
    def _calculate_ctr(clicks: int, impressions: int) -> float:
        """Calculates Click-Through Rate."""
        return (clicks / impressions * 100) if impressions > 0 else 0.0

    @staticmethod
    def _calculate_cpc(spend: float, clicks: int) -> float:
        """Calculates Cost Per Click."""
        return (spend / clicks) if clicks > 0 else 0.0

    @staticmethod
    def _calculate_conversion_rate(conversions: int, clicks: int) -> float:
        """Calculates Conversion Rate."""
        return (conversions / clicks * 100) if clicks > 0 else 0.0

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit with cleanup."""
        # Cancel all running sync tasks
        for task in self._sync_tasks.values():
            task.cancel()
        
        # Wait for tasks to complete
        if self._sync_tasks:
            await asyncio.gather(*self._sync_tasks.values(), return_exceptions=True)
        
        # Close aiohttp session
        await self._session.close()