"""
FastAPI route definitions for the audience service providing AI-powered audience segmentation,
targeting optimization and real-time validation capabilities.

Version: 1.0.0
"""

import logging
from datetime import timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, validator

from audience_service.services.segmentation import SegmentationService
from audience_service.services.targeting import TargetingService
from common.database.session import get_session
from common.logging.logger import ServiceLogger

# Initialize router with prefix and tags
router = APIRouter(prefix="/api/v1/audience", tags=["audience"])

# Initialize logger
logger = ServiceLogger("audience_routes")

# Cache configuration
CACHE_TTL = timedelta(minutes=15)

# Request/Response Models
class SegmentRequest(BaseModel):
    """Enhanced audience segment creation request model."""
    name: str = Field(..., description="Segment name")
    description: Optional[str] = Field(None, description="Segment description")
    targeting_criteria: Dict[str, Any] = Field(..., description="Targeting criteria")
    platform_settings: Dict[str, Any] = Field(..., description="Platform-specific settings")

    @validator("targeting_criteria")
    def validate_targeting(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        """Validates targeting criteria structure and constraints."""
        if not v:
            raise ValueError("Targeting criteria cannot be empty")
        
        required_fields = ["industries", "company_size"]
        if not all(field in v for field in required_fields):
            raise ValueError(f"Missing required targeting fields: {required_fields}")
            
        return v

class SegmentResponse(BaseModel):
    """Enhanced audience segment response model."""
    id: UUID
    name: str
    description: Optional[str]
    targeting_criteria: Dict[str, Any]
    estimated_reach: int
    confidence_score: float
    platform_metrics: Dict[str, Any]

class OptimizationRequest(BaseModel):
    """Enhanced targeting optimization request model."""
    performance_data: Dict[str, Any] = Field(..., description="Historical performance metrics")
    optimization_config: Dict[str, Any] = Field(..., description="Optimization parameters")

class OptimizationResponse(BaseModel):
    """Enhanced optimization response model."""
    segment_id: UUID
    optimized_targeting: Dict[str, Any]
    predicted_performance: Dict[str, Any]
    estimated_reach: Dict[str, Any]

@router.post("/segments", response_model=SegmentResponse, status_code=status.HTTP_201_CREATED)
async def create_segment(
    segment_data: SegmentRequest,
    db = Depends(get_session),
    segmentation_service: SegmentationService = Depends()
) -> SegmentResponse:
    """
    Creates a new AI-optimized audience segment with comprehensive validation.
    
    Args:
        segment_data: Segment configuration data
        db: Database session
        segmentation_service: Segmentation service instance
        
    Returns:
        Created segment details with audience metrics
        
    Raises:
        HTTPException: If segment creation fails
    """
    try:
        logger.info(
            "Creating new audience segment",
            extra={"segment_name": segment_data.name}
        )

        # Create segment with AI optimization
        segment = segmentation_service.create_segment(
            segment_data.dict(),
            segment_data.platform_settings
        )

        # Calculate initial reach and metrics
        reach_data = segment.calculate_reach()

        response = SegmentResponse(
            id=segment.id,
            name=segment.name,
            description=segment.description,
            targeting_criteria=segment.targeting_criteria,
            estimated_reach=reach_data["total_reach"],
            confidence_score=reach_data["confidence_score"],
            platform_metrics=reach_data["platform_reach"]
        )

        logger.info(
            "Audience segment created successfully",
            extra={
                "segment_id": str(segment.id),
                "estimated_reach": reach_data["total_reach"]
            }
        )

        return response

    except ValueError as e:
        logger.error(
            "Validation error creating segment",
            exc=e,
            extra={"segment_data": segment_data.dict()}
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(
            "Error creating audience segment",
            exc=e,
            extra={"segment_data": segment_data.dict()}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create audience segment"
        )

@router.post(
    "/segments/{segment_id}/optimize",
    response_model=OptimizationResponse,
    status_code=status.HTTP_200_OK
)
async def optimize_segment(
    segment_id: UUID,
    optimization_data: OptimizationRequest,
    db = Depends(get_session),
    segmentation_service: SegmentationService = Depends()
) -> OptimizationResponse:
    """
    Optimizes audience targeting using ML models and performance data.
    
    Args:
        segment_id: Segment identifier
        optimization_data: Performance data and optimization parameters
        db: Database session
        segmentation_service: Segmentation service instance
        
    Returns:
        Optimized targeting rules with performance predictions
        
    Raises:
        HTTPException: If optimization fails
    """
    try:
        logger.info(
            "Optimizing audience segment",
            extra={
                "segment_id": str(segment_id),
                "optimization_config": optimization_data.optimization_config
            }
        )

        # Perform ML-based optimization
        optimization_result = segmentation_service.optimize_targeting(
            str(segment_id),
            optimization_data.performance_data,
            optimization_data.optimization_config
        )

        response = OptimizationResponse(
            segment_id=segment_id,
            optimized_targeting=optimization_result["optimized_targeting"],
            predicted_performance=optimization_result["predicted_performance"],
            estimated_reach=optimization_result["estimated_reach"]
        )

        logger.info(
            "Segment optimization completed",
            extra={
                "segment_id": str(segment_id),
                "new_reach": optimization_result["estimated_reach"]["total_reach"]
            }
        )

        return response

    except ValueError as e:
        logger.error(
            "Validation error during optimization",
            exc=e,
            extra={"segment_id": str(segment_id)}
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(
            "Error optimizing segment",
            exc=e,
            extra={"segment_id": str(segment_id)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to optimize audience segment"
        )