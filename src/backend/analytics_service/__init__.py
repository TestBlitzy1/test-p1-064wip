"""
Analytics service initialization module providing FastAPI application setup with comprehensive
monitoring, caching, and performance optimization capabilities for real-time analytics.

Version: 1.0.0
"""

import logging
from typing import Dict, Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import Counter, Histogram  # prometheus_client ^0.17.0
from redis import RedisCache  # redis ^4.5.0

from .config import AnalyticsConfig
from .routes import router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI application with OpenAPI documentation
app = FastAPI(
    title='Analytics Service',
    version='1.0.0',
    docs_url='/analytics/docs',
    redoc_url='/analytics/redoc'
)

# Initialize configuration
config = AnalyticsConfig()

# Initialize Redis cache with optimized settings
cache = RedisCache(**config.get_cache_config()['analytics'])

# Initialize Prometheus metrics
METRICS_REQUEST_COUNT = Counter(
    'analytics_requests_total',
    'Total analytics endpoint requests',
    ['endpoint', 'status']
)

METRICS_LATENCY = Histogram(
    'analytics_request_latency_seconds',
    'Analytics endpoint latency in seconds',
    ['endpoint'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0]
)

def init_metrics() -> None:
    """Initialize Prometheus metrics collectors with comprehensive monitoring."""
    metrics_config = config.get_metrics_config()
    
    # Initialize resource usage metrics
    Counter(
        'analytics_cache_hits_total',
        'Total cache hits for analytics queries',
        ['cache_type']
    )
    
    Counter(
        'analytics_cache_misses_total',
        'Total cache misses for analytics queries',
        ['cache_type']
    )
    
    Histogram(
        'analytics_query_execution_seconds',
        'Query execution time in seconds',
        ['query_type'],
        buckets=metrics_config['analytics']['performance_thresholds'].values()
    )
    
    # Initialize business metrics
    Counter(
        'analytics_reports_generated_total',
        'Total number of analytics reports generated',
        ['report_type', 'format']
    )
    
    logger.info("Prometheus metrics initialized successfully")

def init_cache() -> None:
    """Initialize Redis cache with optimized configuration."""
    cache_config = config.get_cache_config()['analytics']
    
    # Configure cache serialization
    cache.config_set('maxmemory-policy', 'allkeys-lru')
    cache.config_set('maxmemory', '1gb')
    
    # Set up cache key prefixes
    for pattern, ttl in cache_config['invalidation'].items():
        cache.config_set(f'key-prefix:{pattern}', ttl)
    
    # Configure compression for large objects
    if cache_config['serialization']['compression']:
        cache.config_set('compression', 'yes')
        cache.config_set('compression-level', 
                        cache_config['serialization']['compression_level'])
    
    logger.info("Redis cache initialized successfully")

@app.on_event("startup")
async def startup_event() -> None:
    """Initialize analytics service with all required components."""
    try:
        # Initialize metrics collection
        init_metrics()
        
        # Initialize cache
        init_cache()
        
        # Configure CORS middleware
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],  # Configure from environment in production
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"]
        )
        
        # Include analytics routes
        app.include_router(router)
        
        logger.info("Analytics service initialized successfully")
        
    except Exception as e:
        logger.error(f"Failed to initialize analytics service: {str(e)}")
        raise

@app.on_event("shutdown")
async def shutdown_event() -> None:
    """Gracefully shutdown analytics service components."""
    try:
        # Close Redis connections
        await cache.close()
        
        # Flush metrics
        METRICS_REQUEST_COUNT.collect()
        METRICS_LATENCY.collect()
        
        logger.info("Analytics service shutdown completed")
        
    except Exception as e:
        logger.error(f"Error during analytics service shutdown: {str(e)}")
        raise