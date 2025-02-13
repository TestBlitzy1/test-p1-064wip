"""
Campaign Service initialization module providing FastAPI application setup with comprehensive
logging, monitoring, authentication, and platform integrations.

Version: 1.0.0
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.authentication import AuthenticationMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from prometheus_client import Counter, Histogram
from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

from campaign_service.routes import router
from campaign_service.config import CampaignServiceConfig
from common.logging.logger import ServiceLogger
from common.auth.jwt import JWTHandler

# Initialize core components
config = CampaignServiceConfig()
logger = ServiceLogger("campaign_service")
jwt_handler = JWTHandler()

# Initialize monitoring metrics
REQUEST_COUNT = Counter(
    'campaign_service_requests_total',
    'Total requests processed',
    ['method', 'endpoint', 'status']
)

RESPONSE_TIME = Histogram(
    'campaign_service_response_time_seconds',
    'Response time in seconds',
    ['method', 'endpoint']
)

class MetricsMiddleware(BaseHTTPMiddleware):
    """Middleware for collecting request/response metrics."""

    async def dispatch(self, request, call_next):
        # Start timing
        with RESPONSE_TIME.labels(
            method=request.method,
            endpoint=request.url.path
        ).time():
            response = await call_next(request)
            
            # Record request count
            REQUEST_COUNT.labels(
                method=request.method,
                endpoint=request.url.path,
                status=response.status_code
            ).inc()
            
            return response

def init_app() -> FastAPI:
    """
    Initialize and configure the FastAPI application with comprehensive middleware,
    authentication, and monitoring.

    Returns:
        FastAPI: Configured FastAPI application instance
    """
    # Initialize FastAPI with OpenAPI documentation
    app = FastAPI(
        title="Campaign Service",
        description="AI-powered campaign generation and management service",
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc"
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure appropriately for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"]
    )

    # Add security middlewares
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=config.get_platform_config('LINKEDIN_ADS').get('allowed_hosts', ["*"])
    )
    app.add_middleware(
        AuthenticationMiddleware,
        backend=jwt_handler
    )

    # Add monitoring middleware
    app.add_middleware(MetricsMiddleware)

    # Initialize tracing
    tracer = trace.get_tracer(__name__)
    tracer_provider = trace.get_tracer_provider()
    
    # Configure logging
    logger.info(
        "Initializing Campaign Service",
        extra={
            "environment": config.env,
            "version": "1.0.0"
        }
    )

    # Include routers
    app.include_router(
        router,
        prefix="/api/campaigns",
        tags=["campaigns"]
    )

    @app.on_event("startup")
    async def startup_event():
        """Configure service startup tasks."""
        logger.info("Campaign Service starting up")
        # Initialize platform connections
        platform_config = config.get_platform_config('LINKEDIN_ADS')
        performance_config = config.get_performance_config()
        
        logger.info(
            "Service configuration loaded",
            extra={
                "platform_config": platform_config,
                "performance_config": performance_config
            }
        )

    @app.on_event("shutdown")
    async def shutdown_event():
        """Handle graceful shutdown."""
        logger.info("Campaign Service shutting down")
        # Cleanup connections and resources

    @app.get("/health")
    async def health_check():
        """Health check endpoint for monitoring."""
        return {
            "status": "healthy",
            "service": "campaign_service",
            "version": "1.0.0"
        }

    return app

# Initialize FastAPI application
app = init_app()