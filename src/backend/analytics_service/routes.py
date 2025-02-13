"""
Analytics service router module providing comprehensive HTTP endpoints for campaign performance
metrics, reporting, and trend analysis with support for real-time analytics and caching.

Version: 1.0.0
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from prometheus_client import Counter, Histogram
import redis

from analytics_service.models.campaign_metrics import CampaignMetrics
from analytics_service.services.aggregation import MetricsAggregator
from analytics_service.services.reporting import ReportGenerator, generate_campaign_report
from common.database.session import get_db

# Configure logging
logger = logging.getLogger(__name__)

# Initialize router with prefix and tags
router = APIRouter(prefix="/analytics", tags=["analytics"])

# Prometheus metrics
METRICS_REQUEST_COUNT = Counter(
    "analytics_request_total",
    "Total analytics endpoint requests",
    ["endpoint", "status"]
)
METRICS_LATENCY = Histogram(
    "analytics_request_latency_seconds",
    "Analytics endpoint latency in seconds",
    ["endpoint"]
)

# Constants
SUPPORTED_TIME_PERIODS = ["daily", "weekly", "monthly", "custom"]
METRICS_CACHE_TTL = 300  # 5 minutes
MAX_BATCH_SIZE = 1000
RATE_LIMIT_REQUESTS = 100
RATE_LIMIT_PERIOD = 60  # 1 minute

# Initialize Redis client for caching
redis_client = redis.Redis(
    host="localhost",  # Configure from environment
    port=6379,
    db=0,
    decode_responses=True
)

@router.get("/{campaign_id}/metrics")
async def get_campaign_metrics(
    campaign_id: UUID,
    time_period: str = Query(..., enum=SUPPORTED_TIME_PERIODS),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    metrics: List[str] = Query(default=["ctr", "conversion_rate", "cpc", "roas"]),
    db=Depends(get_db)
) -> Dict[str, Any]:
    """
    Retrieve comprehensive campaign performance metrics with caching and statistical analysis.

    Args:
        campaign_id: Campaign identifier
        time_period: Analysis period (daily, weekly, monthly, custom)
        start_date: Optional start date for custom period
        end_date: Optional end date for custom period
        metrics: List of metrics to retrieve
        db: Database session

    Returns:
        Dict containing campaign metrics with statistical analysis

    Raises:
        HTTPException: If validation fails or errors occur
    """
    try:
        # Track request metrics
        METRICS_REQUEST_COUNT.labels(endpoint="get_metrics", status="started").inc()
        with METRICS_LATENCY.labels(endpoint="get_metrics").time():
            
            # Validate date range for custom period
            if time_period == "custom":
                if not start_date or not end_date:
                    raise HTTPException(
                        status_code=400,
                        detail="start_date and end_date required for custom period"
                    )
                if end_date <= start_date:
                    raise HTTPException(
                        status_code=400,
                        detail="end_date must be after start_date"
                    )

            # Check cache first
            cache_key = f"metrics:{campaign_id}:{time_period}"
            cached_metrics = redis_client.get(cache_key)
            if cached_metrics:
                return eval(cached_metrics)  # Convert string to dict

            # Initialize metrics aggregator
            aggregator = MetricsAggregator(
                cache_config={"ttl": METRICS_CACHE_TTL}
            )

            # Get campaign metrics
            metrics_data = aggregator.aggregate_campaign_metrics(
                campaign_id=campaign_id,
                time_period=time_period,
                use_cache=True
            )

            # Get performance trends
            trends_data = aggregator.analyze_performance_trends(
                campaign_id=campaign_id,
                metrics=metrics,
                time_period=time_period
            )

            # Combine metrics and trends
            response = {
                "campaign_id": str(campaign_id),
                "time_period": time_period,
                "metrics": metrics_data,
                "trends": trends_data,
                "generated_at": datetime.utcnow().isoformat(),
                "cache_ttl": METRICS_CACHE_TTL
            }

            # Cache the results
            redis_client.setex(
                cache_key,
                METRICS_CACHE_TTL,
                str(response)
            )

            METRICS_REQUEST_COUNT.labels(endpoint="get_metrics", status="success").inc()
            return response

    except Exception as e:
        METRICS_REQUEST_COUNT.labels(endpoint="get_metrics", status="error").inc()
        logger.error(f"Error getting metrics for campaign {campaign_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{campaign_id}/trends")
async def get_performance_trends(
    campaign_id: UUID,
    metrics: List[str] = Query(default=["ctr", "conversion_rate", "roas"]),
    days: int = Query(default=30, ge=1, le=365),
    db=Depends(get_db)
) -> Dict[str, Any]:
    """
    Analyze campaign performance trends with statistical validation.

    Args:
        campaign_id: Campaign identifier
        metrics: List of metrics to analyze
        days: Number of days for analysis
        db: Database session

    Returns:
        Dict containing trend analysis with statistical significance

    Raises:
        HTTPException: If validation fails or errors occur
    """
    try:
        METRICS_REQUEST_COUNT.labels(endpoint="get_trends", status="started").inc()
        with METRICS_LATENCY.labels(endpoint="get_trends").time():

            # Initialize metrics aggregator
            aggregator = MetricsAggregator(
                cache_config={"ttl": METRICS_CACHE_TTL}
            )

            # Get performance trends
            trends = aggregator.analyze_performance_trends(
                campaign_id=campaign_id,
                metrics=metrics,
                time_period=f"{days}d"
            )

            METRICS_REQUEST_COUNT.labels(endpoint="get_trends", status="success").inc()
            return {
                "campaign_id": str(campaign_id),
                "trends": trends,
                "analysis_period": f"{days} days",
                "generated_at": datetime.utcnow().isoformat()
            }

    except Exception as e:
        METRICS_REQUEST_COUNT.labels(endpoint="get_trends", status="error").inc()
        logger.error(f"Error analyzing trends for campaign {campaign_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{campaign_id}/reports")
async def generate_report(
    campaign_id: UUID,
    report_config: Dict[str, Any],
    db=Depends(get_db)
) -> Dict[str, Any]:
    """
    Generate comprehensive campaign performance report.

    Args:
        campaign_id: Campaign identifier
        report_config: Report configuration parameters
        db: Database session

    Returns:
        Dict containing generated report data

    Raises:
        HTTPException: If validation fails or errors occur
    """
    try:
        METRICS_REQUEST_COUNT.labels(endpoint="generate_report", status="started").inc()
        with METRICS_LATENCY.labels(endpoint="generate_report").time():

            # Initialize report generator
            generator = ReportGenerator(
                db_session=db,
                cache_manager=redis_client,
                config=report_config
            )

            # Generate report
            report = await generator.create_report(
                campaign_id=campaign_id,
                report_config=report_config,
                force_refresh=report_config.get("force_refresh", False)
            )

            METRICS_REQUEST_COUNT.labels(endpoint="generate_report", status="success").inc()
            return report

    except Exception as e:
        METRICS_REQUEST_COUNT.labels(endpoint="generate_report", status="error").inc()
        logger.error(f"Error generating report for campaign {campaign_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{campaign_id}/reports/schedule")
async def schedule_report(
    campaign_id: UUID,
    schedule_config: Dict[str, Any],
    db=Depends(get_db)
) -> Dict[str, Any]:
    """
    Schedule automated campaign performance report generation.

    Args:
        campaign_id: Campaign identifier
        schedule_config: Report scheduling configuration
        db: Database session

    Returns:
        Dict containing schedule confirmation

    Raises:
        HTTPException: If validation fails or errors occur
    """
    try:
        METRICS_REQUEST_COUNT.labels(endpoint="schedule_report", status="started").inc()
        with METRICS_LATENCY.labels(endpoint="schedule_report").time():

            # Initialize report generator
            generator = ReportGenerator(
                db_session=db,
                cache_manager=redis_client,
                config=schedule_config
            )

            # Schedule report generation
            schedule = await generator.schedule_report(
                campaign_id=campaign_id,
                schedule_config=schedule_config
            )

            METRICS_REQUEST_COUNT.labels(endpoint="schedule_report", status="success").inc()
            return {
                "campaign_id": str(campaign_id),
                "schedule": schedule,
                "created_at": datetime.utcnow().isoformat()
            }

    except Exception as e:
        METRICS_REQUEST_COUNT.labels(endpoint="schedule_report", status="error").inc()
        logger.error(f"Error scheduling report for campaign {campaign_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))