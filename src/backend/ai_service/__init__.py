"""
AI service package initializer providing FastAPI application configuration,
ML model initialization, monitoring setup, and comprehensive error handling.

Version: 1.0.0
"""

import torch
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter
from prometheus_client import start_http_server
from circuitbreaker import circuit_breaker
import logging
from typing import Dict, Any

from .routes import router
from .config import AIServiceConfig
from .services.model_loader import ModelLoader
from common.monitoring.metrics import MetricsManager
from common.logging.logger import ServiceLogger

# Package version
__version__ = "1.0.0"

# Initialize core components
config = AIServiceConfig()
logger = ServiceLogger("ai_service", config)
metrics = MetricsManager("ai_service")

# Initialize FastAPI application with detailed configuration
app = FastAPI(
    title="AI Service",
    description="AI-powered campaign generation and optimization service",
    version=__version__,
    docs_url="/ai/docs",
    redoc_url="/ai/redoc"
)

# Initialize performance metrics
METRICS = {
    'request_latency': metrics.create_histogram(
        "request_latency_seconds",
        "Request latency in seconds",
        ["endpoint", "method"],
        buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0]
    ),
    'model_inference_time': metrics.create_histogram(
        "model_inference_time_seconds",
        "Model inference time in seconds",
        ["model_name", "operation"]
    ),
    'error_counter': metrics.create_counter(
        "errors_total",
        "Total number of errors",
        ["error_type", "endpoint"]
    )
}

@app.on_event("startup")
async def startup_event() -> None:
    """Initialize application components on startup."""
    try:
        # Initialize rate limiter
        await FastAPILimiter.init(
            host=config.redis_config['hosts'][0],
            port=config.redis_config['port'],
            password=config.redis_config['password']
        )

        # Initialize ML models
        await init_models()

        # Start Prometheus metrics server
        start_http_server(port=config.monitoring_config['prometheus_port'])

        logger.info("AI service initialized successfully")

    except Exception as e:
        logger.error("Failed to initialize AI service", exc=e)
        raise

@app.on_event("shutdown")
async def shutdown_event() -> None:
    """Cleanup resources on application shutdown."""
    try:
        # Cleanup ML models
        model_loader = ModelLoader(config)
        for model_name in model_loader._model_versions.keys():
            model_loader.unload_model(model_name)

        logger.info("AI service shutdown completed")

    except Exception as e:
        logger.error("Error during shutdown", exc=e)
        raise

@circuit_breaker(failure_threshold=5, recovery_timeout=60)
async def init_models() -> Dict[str, Any]:
    """Initialize ML models with GPU support and optimal resource management."""
    try:
        model_loader = ModelLoader(config)
        
        # Configure GPU if available
        if torch.cuda.is_available():
            torch.backends.cudnn.benchmark = True
            torch.backends.cuda.matmul.allow_tf32 = True

        # Load required models
        models = {}
        for model_name in ["CAMPAIGN_GENERATOR", "CONTENT_GENERATOR"]:
            models[model_name] = await model_loader.load_model(
                model_name=model_name,
                version="latest"
            )

        logger.info("ML models initialized successfully")
        return models

    except Exception as e:
        logger.error("Failed to initialize ML models", exc=e)
        raise

@app.middleware("http")
async def monitoring_middleware(request: Request, call_next):
    """Middleware for request monitoring and error handling."""
    start_time = time.time()
    path = request.url.path
    method = request.method

    try:
        response = await call_next(request)
        duration = time.time() - start_time
        
        # Record request latency
        METRICS['request_latency'].labels(
            endpoint=path,
            method=method
        ).observe(duration)

        return response

    except Exception as e:
        # Record error metrics
        METRICS['error_counter'].labels(
            error_type=type(e).__name__,
            endpoint=path
        ).inc()
        
        logger.error(f"Request failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Configure rate limiting
app.add_middleware(
    RateLimiter,
    calls=100,  # 100 requests
    period=60   # per minute
)

# Include AI service router
app.include_router(
    router,
    prefix="/ai",
    tags=["AI Service"]
)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Enhanced health check endpoint with comprehensive status information."""
    try:
        model_loader = ModelLoader(config)
        
        # Check model health
        model_health = {
            model_name: model_loader.check_model_health(model_name)
            for model_name in ["CAMPAIGN_GENERATOR", "CONTENT_GENERATOR"]
        }

        # Check GPU status if available
        gpu_status = {
            'available': torch.cuda.is_available(),
            'device_count': torch.cuda.device_count() if torch.cuda.is_available() else 0,
            'memory_allocated': torch.cuda.memory_allocated() if torch.cuda.is_available() else 0
        }

        return {
            'status': 'healthy',
            'version': __version__,
            'models': model_health,
            'gpu': gpu_status,
            'timestamp': time.time()
        }

    except Exception as e:
        logger.error("Health check failed", exc=e)
        raise HTTPException(
            status_code=500,
            detail=f"Health check failed: {str(e)}"
        )