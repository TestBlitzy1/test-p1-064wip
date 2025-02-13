"""
API Gateway initialization module providing secure request handling, authentication,
rate limiting, and monitoring capabilities for the Sales & Intelligence Platform.

Version: 1.0.0
"""

import logging
from typing import Dict, Optional

# External imports
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi import HTTPException
import opentelemetry.trace as trace  # v1.20.0

# Internal imports
from .config import GatewayConfig
from .middleware.auth import AuthMiddleware
from .constants import (
    SERVICE_ROUTES,
    ERROR_MESSAGES,
    CORS_SETTINGS,
    HTTP_STATUS
)

# Initialize configuration with security validation
config = GatewayConfig(validate_security=True)

# Initialize FastAPI with security headers disabled in production
app = FastAPI(
    title='Sales & Intelligence Platform API Gateway',
    version=config.api_version,
    docs_url=None if config.is_production else '/docs',
    redoc_url=None if config.is_production else '/redoc'
)

# Initialize logger
logger = logging.getLogger('api_gateway')

def init_middleware() -> None:
    """
    Initializes all middleware with enhanced security and monitoring features.
    """
    # Initialize authentication middleware
    auth_middleware = AuthMiddleware()
    
    # Configure CORS with strict security settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_settings['ALLOWED_ORIGINS'],
        allow_credentials=config.cors_settings['ALLOW_CREDENTIALS'],
        allow_methods=config.cors_settings['ALLOWED_METHODS'],
        allow_headers=config.cors_settings['ALLOWED_HEADERS'],
        expose_headers=config.cors_settings['EXPOSED_HEADERS'],
        max_age=config.cors_settings['MAX_AGE']
    )

    # Add security headers middleware
    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    # Add authentication middleware
    @app.middleware("http")
    async def authenticate_request(request: Request, call_next):
        try:
            if not request.url.path.startswith("/health"):
                user_context = await auth_middleware.authenticate(request)
                request.state.user = user_context
            return await call_next(request)
        except HTTPException as e:
            return Response(
                content=ERROR_MESSAGES["UNAUTHORIZED_ACCESS"],
                status_code=HTTP_STATUS["UNAUTHORIZED"]
            )

    # Add rate limiting middleware
    @app.middleware("http")
    async def rate_limit_requests(request: Request, call_next):
        client_id = request.headers.get("X-Client-ID", request.client.host)
        endpoint = request.url.path
        
        rate_limit = config.get_rate_limit(endpoint, client_id)
        if not rate_limit.get("bypass_rate_limit"):
            if not await auth_middleware._check_rate_limit(client_id):
                return Response(
                    content=ERROR_MESSAGES["RATE_LIMIT_EXCEEDED"],
                    status_code=HTTP_STATUS["TOO_MANY_REQUESTS"]
                )
        
        return await call_next(request)

    # Add request tracing middleware
    @app.middleware("http")
    async def trace_requests(request: Request, call_next):
        tracer = trace.get_tracer(__name__)
        with tracer.start_as_current_span(
            f"{request.method} {request.url.path}",
            attributes={
                "http.method": request.method,
                "http.url": str(request.url),
                "http.client_ip": request.client.host
            }
        ) as span:
            response = await call_next(request)
            span.set_attribute("http.status_code", response.status_code)
            return response

def init_routes() -> None:
    """
    Initializes API routes with versioning and enhanced error handling.
    """
    # Health check endpoint
    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "version": config.api_version}

    # Error handling routes
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return Response(
            content=ERROR_MESSAGES["VALIDATION_ERROR"].format(details=str(exc)),
            status_code=HTTP_STATUS["BAD_REQUEST"]
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return Response(
            content=str(exc.detail),
            status_code=exc.status_code
        )

def configure_logging() -> None:
    """
    Configures comprehensive logging with security event tracking.
    """
    logging.basicConfig(
        level=logging.INFO if not config.debug else logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Add security event logging
    security_logger = logging.getLogger('security_events')
    security_logger.setLevel(logging.INFO)

    # Configure request tracing
    trace.set_tracer_provider(trace.TracerProvider())

# Initialize API Gateway
init_middleware()
init_routes()
configure_logging()

logger.info(
    f"API Gateway initialized successfully",
    extra={
        "version": config.api_version,
        "environment": config.env
    }
)