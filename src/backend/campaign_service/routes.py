"""
FastAPI router module for campaign service providing comprehensive HTTP endpoints
for campaign management with advanced security, monitoring and caching.

Version: 1.0.0
"""

from datetime import datetime
from typing import Dict, Any, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode
from redis import Redis
from circuitbreaker import circuit

from campaign_service.services.campaign_manager import CampaignManager
from common.auth.jwt import JWTHandler
from common.logging.logger import ServiceLogger

# Initialize components
router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])
logger = ServiceLogger("campaign_routes")
tracer = trace.get_tracer(__name__)
jwt_handler = JWTHandler()

# Constants
SUPPORTED_PLATFORMS = ["linkedin", "google"]
CACHE_TTL = 300  # 5 minutes
RATE_LIMIT_REQUESTS = 100
RATE_LIMIT_WINDOW = 60

# Initialize Redis for caching
redis_client = Redis(host="localhost", port=6379, db=0)

class CampaignCreate(BaseModel):
    """Enhanced campaign creation request model with validation."""
    
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., max_length=1000)
    platforms: list[str]
    total_budget: float = Field(..., gt=0)
    targeting_settings: Dict[str, Any]
    start_date: datetime
    end_date: datetime

    @validator("platforms")
    def validate_platforms(cls, v):
        """Validates platform selection."""
        if not v:
            raise ValueError("At least one platform required")
        if not all(p in SUPPORTED_PLATFORMS for p in v):
            raise ValueError(f"Supported platforms are: {SUPPORTED_PLATFORMS}")
        return v

    @validator("total_budget")
    def validate_budget(cls, v):
        """Validates budget format and minimum."""
        if round(v, 2) != v:
            raise ValueError("Budget must have maximum 2 decimal places")
        return v

async def get_current_user(token: str = Depends(jwt_handler.validate_token)):
    """Enhanced JWT token validation with caching."""
    cache_key = f"user_token:{token}"
    
    # Check cache
    cached_user = await redis_client.get(cache_key)
    if cached_user:
        return cached_user
    
    try:
        user_data = jwt_handler.decode_token(token)
        if not user_data:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        # Cache valid user data
        await redis_client.setex(cache_key, CACHE_TTL, str(user_data))
        return user_data
        
    except Exception as e:
        logger.error("Token validation failed", exc=e)
        raise HTTPException(status_code=401, detail="Invalid authentication")

@router.post("/")
@circuit(failure_threshold=5, recovery_timeout=60)
async def create_campaign_handler(
    request: Request,
    campaign: CampaignCreate,
    current_user: Dict = Depends(get_current_user),
    campaign_manager: CampaignManager = Depends()
) -> JSONResponse:
    """
    Creates a new campaign with comprehensive validation and monitoring.
    """
    correlation_id = str(uuid4())
    
    with tracer.start_as_current_span("create_campaign_handler") as span:
        span.set_attribute("correlation_id", correlation_id)
        span.set_attribute("user_id", current_user["user_id"])
        
        try:
            logger.info(
                "Creating new campaign",
                extra={
                    "correlation_id": correlation_id,
                    "user_id": current_user["user_id"],
                    "campaign_data": campaign.dict()
                }
            )
            
            # Create campaign
            result = await campaign_manager.create_campaign(
                name=campaign.name,
                description=campaign.description,
                platforms=campaign.platforms,
                total_budget=campaign.total_budget,
                targeting_settings=campaign.targeting_settings,
                start_date=campaign.start_date,
                end_date=campaign.end_date
            )
            
            span.set_status(Status(StatusCode.OK))
            return JSONResponse(
                status_code=201,
                content={
                    "message": "Campaign created successfully",
                    "campaign_id": result.id,
                    "correlation_id": correlation_id
                }
            )
            
        except ValueError as e:
            span.set_status(Status(StatusCode.ERROR, str(e)))
            raise HTTPException(status_code=400, detail=str(e))
            
        except Exception as e:
            span.set_status(Status(StatusCode.ERROR, str(e)))
            logger.error(
                "Campaign creation failed",
                exc=e,
                extra={"correlation_id": correlation_id}
            )
            raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{campaign_id}")
@circuit(failure_threshold=5, recovery_timeout=60)
async def get_campaign_handler(
    campaign_id: str,
    current_user: Dict = Depends(get_current_user),
    campaign_manager: CampaignManager = Depends()
) -> JSONResponse:
    """
    Retrieves campaign details with caching.
    """
    correlation_id = str(uuid4())
    cache_key = f"campaign:{campaign_id}"
    
    with tracer.start_as_current_span("get_campaign_handler") as span:
        span.set_attribute("correlation_id", correlation_id)
        span.set_attribute("campaign_id", campaign_id)
        
        try:
            # Check cache
            cached_campaign = await redis_client.get(cache_key)
            if cached_campaign:
                return JSONResponse(content=cached_campaign)
            
            campaign = await campaign_manager.get_campaign(campaign_id)
            if not campaign:
                raise HTTPException(status_code=404, detail="Campaign not found")
            
            # Cache result
            await redis_client.setex(
                cache_key,
                CACHE_TTL,
                campaign.to_dict()
            )
            
            span.set_status(Status(StatusCode.OK))
            return JSONResponse(content=campaign.to_dict())
            
        except Exception as e:
            span.set_status(Status(StatusCode.ERROR, str(e)))
            logger.error(
                "Failed to retrieve campaign",
                exc=e,
                extra={
                    "correlation_id": correlation_id,
                    "campaign_id": campaign_id
                }
            )
            raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{campaign_id}/performance")
@circuit(failure_threshold=5, recovery_timeout=60)
async def get_campaign_performance_handler(
    campaign_id: str,
    current_user: Dict = Depends(get_current_user),
    campaign_manager: CampaignManager = Depends()
) -> JSONResponse:
    """
    Retrieves campaign performance metrics with caching.
    """
    correlation_id = str(uuid4())
    cache_key = f"performance:{campaign_id}"
    
    with tracer.start_as_current_span("get_campaign_performance") as span:
        span.set_attribute("correlation_id", correlation_id)
        span.set_attribute("campaign_id", campaign_id)
        
        try:
            # Check cache
            cached_metrics = await redis_client.get(cache_key)
            if cached_metrics:
                return JSONResponse(content=cached_metrics)
            
            metrics = await campaign_manager.get_campaign_performance(campaign_id)
            
            # Cache result
            await redis_client.setex(cache_key, CACHE_TTL, metrics)
            
            span.set_status(Status(StatusCode.OK))
            return JSONResponse(content=metrics)
            
        except Exception as e:
            span.set_status(Status(StatusCode.ERROR, str(e)))
            logger.error(
                "Failed to retrieve performance metrics",
                exc=e,
                extra={
                    "correlation_id": correlation_id,
                    "campaign_id": campaign_id
                }
            )
            raise HTTPException(status_code=500, detail="Internal server error")

@router.patch("/{campaign_id}/status")
@circuit(failure_threshold=5, recovery_timeout=60)
async def change_campaign_status_handler(
    campaign_id: str,
    status: str,
    current_user: Dict = Depends(get_current_user),
    campaign_manager: CampaignManager = Depends()
) -> JSONResponse:
    """
    Updates campaign status with validation.
    """
    correlation_id = str(uuid4())
    
    with tracer.start_as_current_span("change_campaign_status") as span:
        span.set_attribute("correlation_id", correlation_id)
        span.set_attribute("campaign_id", campaign_id)
        span.set_attribute("new_status", status)
        
        try:
            result = await campaign_manager.change_campaign_status(
                campaign_id,
                status
            )
            
            # Invalidate caches
            await redis_client.delete(f"campaign:{campaign_id}")
            await redis_client.delete(f"performance:{campaign_id}")
            
            span.set_status(Status(StatusCode.OK))
            return JSONResponse(
                content={
                    "message": "Campaign status updated successfully",
                    "campaign_id": campaign_id,
                    "status": status
                }
            )
            
        except ValueError as e:
            span.set_status(Status(StatusCode.ERROR, str(e)))
            raise HTTPException(status_code=400, detail=str(e))
            
        except Exception as e:
            span.set_status(Status(StatusCode.ERROR, str(e)))
            logger.error(
                "Failed to update campaign status",
                exc=e,
                extra={
                    "correlation_id": correlation_id,
                    "campaign_id": campaign_id
                }
            )
            raise HTTPException(status_code=500, detail="Internal server error")