"""
API Gateway routes module implementing comprehensive request routing, authentication,
rate limiting, and monitoring for the Sales Intelligence Platform.

Version: 1.0.0
"""

import time
from typing import Dict, Optional

from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from prometheus_client import Counter, Histogram

from middleware.auth import AuthMiddleware
from middleware.rate_limiter import RateLimiter
from services.routing import ServiceRouter
from constants import (
    HTTP_STATUS,
    ERROR_MESSAGES,
    SERVICE_ROUTES,
    CORS_SETTINGS
)

# Initialize FastAPI application with enhanced documentation
app = FastAPI(
    title="Sales Intelligence Platform API Gateway",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Initialize core components
auth_middleware = AuthMiddleware()
rate_limiter = RateLimiter()
service_router = ServiceRouter()

# Prometheus metrics
request_counter = Counter(
    'gateway_requests_total',
    'Total requests by endpoint',
    ['endpoint', 'method', 'status']
)
latency_histogram = Histogram(
    'gateway_request_duration_seconds',
    'Request duration in seconds',
    ['endpoint']
)

@app.get("/health")
async def health_check() -> JSONResponse:
    """
    Enhanced health check endpoint with dependency status monitoring.
    
    Returns:
        JSONResponse: Comprehensive health status of API Gateway and dependencies
    """
    try:
        start_time = time.time()
        
        # Check core service health
        health_status = {
            "status": "healthy",
            "timestamp": start_time,
            "version": "1.0.0",
            "dependencies": {}
        }
        
        # Check Redis connection for rate limiting
        redis_healthy = await rate_limiter._cache.health_check()
        health_status["dependencies"]["redis"] = {
            "status": "healthy" if redis_healthy else "unhealthy"
        }
        
        # Check service dependencies
        for service in SERVICE_ROUTES:
            service_healthy = await service_router.check_service_health(service)
            health_status["dependencies"][service] = {
                "status": "healthy" if service_healthy else "unhealthy"
            }
        
        # Calculate response time
        health_status["response_time"] = time.time() - start_time
        
        return JSONResponse(
            content=health_status,
            status_code=HTTP_STATUS["OK"]
        )
        
    except Exception as e:
        return JSONResponse(
            content={
                "status": "unhealthy",
                "error": str(e)
            },
            status_code=HTTP_STATUS["SERVICE_UNAVAILABLE"]
        )

@app.route("/api/campaigns/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def route_campaign_requests(request: Request) -> StreamingResponse:
    """
    Enhanced campaign service request routing with comprehensive security and monitoring.
    
    Args:
        request: FastAPI request object
        
    Returns:
        StreamingResponse: Campaign service response with caching
        
    Raises:
        HTTPException: For various routing and authentication errors
    """
    start_time = time.time()
    
    try:
        # Authenticate request
        user_context = await auth_middleware.authenticate(request)
        
        # Check rate limits
        rate_limit_key = f"campaigns:{user_context['user_id']}"
        if not await rate_limiter.check_rate_limit(rate_limit_key):
            request_counter.labels(
                endpoint="campaigns",
                method=request.method,
                status=429
            ).inc()
            raise HTTPException(
                status_code=HTTP_STATUS["TOO_MANY_REQUESTS"],
                detail=ERROR_MESSAGES["RATE_LIMIT_EXCEEDED"]
            )
        
        # Route request to campaign service
        response = await service_router.route_request(
            request=request,
            service="campaigns",
            user_context=user_context
        )
        
        # Update metrics
        request_counter.labels(
            endpoint="campaigns",
            method=request.method,
            status=response.status_code
        ).inc()
        
        latency_histogram.labels(
            endpoint="campaigns"
        ).observe(time.time() - start_time)
        
        return StreamingResponse(
            content=response.body_iterator,
            status_code=response.status_code,
            headers=response.headers
        )
        
    except HTTPException as e:
        # Log and re-raise HTTP exceptions
        request_counter.labels(
            endpoint="campaigns",
            method=request.method,
            status=e.status_code
        ).inc()
        raise
        
    except Exception as e:
        # Log unexpected errors
        request_counter.labels(
            endpoint="campaigns",
            method=request.method,
            status=500
        ).inc()
        raise HTTPException(
            status_code=HTTP_STATUS["INTERNAL_SERVER_ERROR"],
            detail=str(e)
        )

# Configure CORS
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_SETTINGS["ALLOWED_ORIGINS"],
    allow_methods=CORS_SETTINGS["ALLOWED_METHODS"],
    allow_headers=CORS_SETTINGS["ALLOWED_HEADERS"],
    allow_credentials=CORS_SETTINGS["ALLOW_CREDENTIALS"],
    max_age=CORS_SETTINGS["MAX_AGE"]
)

# Add monitoring middleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])

# Add compression middleware
from fastapi.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=1000)