"""
FastAPI router implementation for the Integration Service providing comprehensive platform
integration capabilities with enhanced monitoring, rate limiting, and resilience features.

Version: 1.0.0
"""

from typing import Dict, List, Optional
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi_cache.decorator import cache
from circuitbreaker import circuit

from integration_service.services.platform_manager import PlatformManager
from integration_service.services.sync_manager import SyncManager
from common.logging.logger import ServiceLogger

# Initialize router with prefix and tags
router = APIRouter(prefix="/api/v1/integration", tags=["Integration"])

# Initialize logger
logger = ServiceLogger("integration_router")

# Rate limit configuration
RATE_LIMIT_CONFIG = {
    "linkedin": {"requests": 100, "window": "60s"},
    "google": {"requests": 150, "window": "60s"}
}

# Circuit breaker configuration
CIRCUIT_BREAKER_CONFIG = {
    "failure_threshold": 5,
    "recovery_timeout": 30,
    "max_retries": 3
}

@router.post("/campaigns")
@circuit(failure_threshold=CIRCUIT_BREAKER_CONFIG["failure_threshold"],
        recovery_timeout=CIRCUIT_BREAKER_CONFIG["recovery_timeout"])
async def create_campaign(
    campaign_data: Dict,
    platforms: List[str],
    background_tasks: BackgroundTasks,
    platform_manager: PlatformManager = Depends(),
    sync_manager: SyncManager = Depends()
) -> Dict:
    """
    Creates a campaign across specified advertising platforms with enhanced monitoring
    and rate limiting.

    Args:
        campaign_data: Campaign configuration and settings
        platforms: List of platforms to create campaign on
        background_tasks: FastAPI background tasks
        platform_manager: Platform manager instance
        sync_manager: Sync manager instance

    Returns:
        Dict containing campaign IDs and status per platform

    Raises:
        HTTPException: If campaign creation fails
    """
    correlation_id = str(uuid4())
    logger.info(
        "Creating campaign across platforms",
        extra={
            "correlation_id": correlation_id,
            "platforms": platforms,
            "campaign_data": campaign_data
        }
    )

    try:
        # Create campaign across platforms
        creation_result = await platform_manager.create_campaign(
            campaign_data=campaign_data,
            platforms=platforms,
            options={"rate_limit_config": RATE_LIMIT_CONFIG}
        )

        # Start sync task for campaign monitoring
        background_tasks.add_task(
            sync_manager.start_sync_task,
            campaign_id=creation_result["results"]["campaign_id"],
            platforms=platforms,
            sync_config={"interval": 300}  # 5 minutes
        )

        return {
            "correlation_id": correlation_id,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "success",
            "data": creation_result
        }

    except Exception as e:
        logger.error(
            "Campaign creation failed",
            exc=e,
            extra={"correlation_id": correlation_id}
        )
        raise HTTPException(
            status_code=500,
            detail=f"Campaign creation failed: {str(e)}"
        )

@router.put("/campaigns/{campaign_id}")
@circuit(failure_threshold=CIRCUIT_BREAKER_CONFIG["failure_threshold"],
        recovery_timeout=CIRCUIT_BREAKER_CONFIG["recovery_timeout"])
async def update_campaign(
    campaign_id: str,
    updates: Dict,
    platforms: List[str],
    version_id: str,
    platform_manager: PlatformManager = Depends()
) -> Dict:
    """
    Updates an existing campaign across platforms with optimistic locking.

    Args:
        campaign_id: Campaign ID to update
        updates: Campaign updates to apply
        platforms: Platforms to update campaign on
        version_id: Campaign version for optimistic locking
        platform_manager: Platform manager instance

    Returns:
        Dict containing update status per platform

    Raises:
        HTTPException: If campaign update fails
    """
    correlation_id = str(uuid4())
    logger.info(
        "Updating campaign",
        extra={
            "correlation_id": correlation_id,
            "campaign_id": campaign_id,
            "platforms": platforms,
            "updates": updates
        }
    )

    try:
        # Update campaign across platforms
        update_result = await platform_manager.update_campaign(
            campaign_id=campaign_id,
            updates=updates,
            platforms=platforms,
            version_id=version_id
        )

        return {
            "correlation_id": correlation_id,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "success",
            "data": update_result
        }

    except Exception as e:
        logger.error(
            "Campaign update failed",
            exc=e,
            extra={
                "correlation_id": correlation_id,
                "campaign_id": campaign_id
            }
        )
        raise HTTPException(
            status_code=500,
            detail=f"Campaign update failed: {str(e)}"
        )

@router.get("/campaigns/{campaign_id}/performance")
@cache(expire=300)  # Cache for 5 minutes
async def get_campaign_performance(
    campaign_id: str,
    platforms: List[str],
    metrics_config: Optional[Dict] = None,
    force_refresh: Optional[bool] = False,
    platform_manager: PlatformManager = Depends()
) -> Dict:
    """
    Retrieves campaign performance metrics with caching and batch processing.

    Args:
        campaign_id: Campaign ID to get metrics for
        platforms: Platforms to retrieve metrics from
        metrics_config: Optional metrics configuration
        force_refresh: Whether to force metrics refresh
        platform_manager: Platform manager instance

    Returns:
        Dict containing performance metrics per platform

    Raises:
        HTTPException: If metrics retrieval fails
    """
    correlation_id = str(uuid4())
    logger.info(
        "Retrieving campaign performance",
        extra={
            "correlation_id": correlation_id,
            "campaign_id": campaign_id,
            "platforms": platforms,
            "force_refresh": force_refresh
        }
    )

    try:
        # Get performance metrics
        metrics_result = await platform_manager.get_performance(
            campaign_id=campaign_id,
            platforms=platforms,
            metrics_config=metrics_config or {},
            force_refresh=force_refresh
        )

        return {
            "correlation_id": correlation_id,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "success",
            "data": metrics_result
        }

    except Exception as e:
        logger.error(
            "Performance metrics retrieval failed",
            exc=e,
            extra={
                "correlation_id": correlation_id,
                "campaign_id": campaign_id
            }
        )
        raise HTTPException(
            status_code=500,
            detail=f"Performance metrics retrieval failed: {str(e)}"
        )

@router.get("/platforms/status")
@cache(expire=60)  # Cache for 1 minute
async def get_platform_status(
    platforms: List[str],
    platform_manager: PlatformManager = Depends()
) -> Dict:
    """
    Retrieves operational status of advertising platforms.

    Args:
        platforms: Platforms to check status for
        platform_manager: Platform manager instance

    Returns:
        Dict containing platform status information

    Raises:
        HTTPException: If status check fails
    """
    correlation_id = str(uuid4())
    logger.info(
        "Checking platform status",
        extra={
            "correlation_id": correlation_id,
            "platforms": platforms
        }
    )

    try:
        # Check platform status
        status_result = await platform_manager.validate_platform_status(platforms)

        return {
            "correlation_id": correlation_id,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "success",
            "data": status_result
        }

    except Exception as e:
        logger.error(
            "Platform status check failed",
            exc=e,
            extra={"correlation_id": correlation_id}
        )
        raise HTTPException(
            status_code=500,
            detail=f"Platform status check failed: {str(e)}"
        )