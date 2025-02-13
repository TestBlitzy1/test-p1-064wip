"""
Package initializer for the Audience Service that configures the FastAPI application,
sets up core dependencies, and exposes the main router for AI-powered audience
segmentation and targeting optimization.

Version: 1.0.0
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from audience_service.routes import router
from audience_service.config import AudienceServiceConfig

# Initialize configuration
config = AudienceServiceConfig()

# Initialize FastAPI application with OpenAPI documentation
app = FastAPI(
    title="Audience Service",
    description="AI-powered audience segmentation and targeting optimization service",
    version="1.0.0",
    docs_url="/api/v1/audience/docs"
)

# Initialize logger
logger = logging.getLogger(__name__)

def configure_logging() -> None:
    """Configures structured logging with correlation IDs and metrics."""
    logging_config = config.get_monitoring_config()
    
    logging.basicConfig(
        level=logging_config["log_level"],
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    
    # Set service-specific logging level
    logger.setLevel(logging_config["log_level"])
    
    logger.info(
        "Audience Service logging configured",
        extra={"service": "audience_service", "environment": config.env}
    )

def init_app() -> FastAPI:
    """
    Initializes the FastAPI application with comprehensive middleware,
    error handlers, and monitoring.
    
    Returns:
        FastAPI: Configured FastAPI application instance
    """
    # Configure CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure based on environment
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"]
    )
    
    # Initialize Prometheus metrics
    instrumentator = Instrumentator()
    instrumentator.instrument(app)
    
    # Include main router with prefix
    app.include_router(
        router,
        prefix="/api/v1/audience",
        tags=["audience"]
    )
    
    # Configure health check endpoint
    @app.get("/health", tags=["health"])
    async def health_check():
        """Health check endpoint for monitoring."""
        return {
            "status": "healthy",
            "service": "audience_service",
            "version": "1.0.0"
        }
    
    # Configure error handlers
    @app.exception_handler(Exception)
    async def global_exception_handler(request, exc):
        """Global exception handler with error tracking."""
        logger.error(
            f"Unhandled exception: {str(exc)}",
            extra={
                "path": request.url.path,
                "method": request.method,
                "error": str(exc)
            },
            exc_info=True
        )
        return {
            "status": "error",
            "message": "Internal server error",
            "error_code": "INTERNAL_ERROR"
        }
    
    logger.info(
        "Audience Service initialized successfully",
        extra={"environment": config.env}
    )
    
    return app

# Configure logging on module import
configure_logging()

# Initialize application
app = init_app()