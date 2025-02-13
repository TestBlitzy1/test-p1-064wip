"""
FastAPI router module for AI service endpoints handling campaign generation, content creation,
and performance prediction requests with comprehensive validation and monitoring.

Version: 1.0.0
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, validator
from fastapi_cache import Cache
from fastapi_limiter import RateLimiter
import logging
import prometheus_client
from typing import Dict, List, Optional
import time

from services.inference import InferenceService
from services.model_loader import ModelLoader

# Initialize router with prefix and tags
router = APIRouter(prefix='/ai', tags=['AI Service'])

# Global constants
SUPPORTED_PLATFORMS = ['linkedin', 'google']
CACHE_TTL = 300  # 5 minutes cache TTL
RATE_LIMIT_REQUESTS = 100  # Requests per window
RATE_LIMIT_WINDOW = 60  # Window in seconds

# Initialize metrics
GENERATION_LATENCY = prometheus_client.Histogram(
    'campaign_generation_latency_seconds',
    'Campaign generation latency in seconds',
    ['platform']
)

CONTENT_GENERATION_LATENCY = prometheus_client.Histogram(
    'content_generation_latency_seconds',
    'Content generation latency in seconds',
    ['platform']
)

class CampaignGenerationRequest(BaseModel):
    """Campaign generation request model with enhanced validation."""
    
    campaign_objective: str = Field(..., min_length=1, max_length=100)
    platform: str = Field(..., regex='^(linkedin|google)$')
    target_audience: Dict[str, any] = Field(...)
    budget: float = Field(..., gt=0)
    platform_specific_settings: Dict[str, any] = Field(...)

    @validator('platform')
    def validate_platform(cls, v):
        if v not in SUPPORTED_PLATFORMS:
            raise ValueError(f'Unsupported platform: {v}')
        return v

    @validator('budget')
    def validate_budget(cls, v, values):
        platform = values.get('platform')
        min_budget = 10.0 if platform == 'linkedin' else 5.0
        if v < min_budget:
            raise ValueError(f'Minimum budget for {platform} is ${min_budget}')
        return v

class AdContentGenerationRequest(BaseModel):
    """Ad content generation request model with validation."""
    
    platform: str = Field(..., regex='^(linkedin|google)$')
    campaign_context: Dict[str, any] = Field(...)
    num_variations: int = Field(default=5, ge=3, le=10)
    content_guidelines: Dict[str, any] = Field(...)

    @validator('platform')
    def validate_platform(cls, v):
        if v not in SUPPORTED_PLATFORMS:
            raise ValueError(f'Unsupported platform: {v}')
        return v

@router.post('/campaign/generate')
@RateLimiter(RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW)
async def generate_campaign_structure(
    request: CampaignGenerationRequest,
    inference_service: InferenceService = Depends()
) -> Dict:
    """
    Generates AI-optimized campaign structure with performance monitoring.
    
    Args:
        request: Campaign generation parameters
        inference_service: Injected inference service
        
    Returns:
        Generated campaign structure with targeting and budget allocation
    """
    start_time = time.time()
    
    try:
        # Generate campaign structure
        campaign_structure = await inference_service.generate_campaign(
            campaign_objective=request.campaign_objective,
            platform=request.platform,
            target_audience=request.target_audience,
            budget=request.budget
        )
        
        # Record latency metric
        GENERATION_LATENCY.labels(platform=request.platform).observe(
            time.time() - start_time
        )
        
        return campaign_structure

    except Exception as e:
        logging.error(f"Campaign generation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Campaign generation failed: {str(e)}"
        )

@router.post('/content/generate')
@RateLimiter(RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW)
async def generate_ad_content(
    request: AdContentGenerationRequest,
    inference_service: InferenceService = Depends()
) -> List[Dict]:
    """
    Generates AI-powered ad copy variations with compliance checks.
    
    Args:
        request: Content generation parameters
        inference_service: Injected inference service
        
    Returns:
        List of generated ad copy variations with metadata
    """
    start_time = time.time()
    
    try:
        # Generate ad content variations
        ad_variations = await inference_service.generate_ad_content(
            platform=request.platform,
            campaign_context=request.campaign_context,
            num_variations=request.num_variations
        )
        
        # Record latency metric
        CONTENT_GENERATION_LATENCY.labels(platform=request.platform).observe(
            time.time() - start_time
        )
        
        return ad_variations

    except Exception as e:
        logging.error(f"Ad content generation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Ad content generation failed: {str(e)}"
        )

@router.get('/health')
async def get_service_health(
    inference_service: InferenceService = Depends()
) -> Dict:
    """
    Enhanced health check endpoint for AI service.
    
    Args:
        inference_service: Injected inference service
        
    Returns:
        Detailed service health status
    """
    try:
        # Get model loader status
        model_loader = ModelLoader()
        campaign_model_health = model_loader.check_model_health("CAMPAIGN_GENERATOR")
        content_model_health = model_loader.check_model_health("CONTENT_GENERATOR")
        
        return {
            "status": "healthy",
            "models": {
                "campaign_generator": campaign_model_health,
                "content_generator": content_model_health
            },
            "metrics": {
                "campaign_latency": GENERATION_LATENCY.collect(),
                "content_latency": CONTENT_GENERATION_LATENCY.collect()
            }
        }

    except Exception as e:
        logging.error(f"Health check failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Health check failed: {str(e)}"
        )