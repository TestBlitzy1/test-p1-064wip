"""
API Gateway Middleware Initialization Module

Initializes and exports middleware components for the API Gateway with comprehensive security,
rate limiting, and monitoring features. Implements OAuth 2.0, JWT authentication, and 
platform-specific rate limiting with SOC 2 compliance.

Version: 1.0.0
"""

from typing import Dict, Optional, Callable
from functools import cache
from fastapi import Request, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Internal imports with version compatibility
from .auth import AuthMiddleware  # v1.0.0
from .rate_limiter import RateLimiter  # v1.0.0
from common.cache.redis import RedisCache  # v4.5.0
from common.config.settings import BaseConfig  # v1.0.0
from common.logging.logger import ServiceLogger  # v1.0.0
from api_gateway.constants import (
    RATE_LIMITS,
    TIME_WINDOWS,
    HTTP_STATUS,
    ERROR_MESSAGES
)

# Version and security constants
VERSION: str = '1.0.0'
SECURITY_HEADERS: Dict[str, str] = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'self'"
}

# Initialize core components
config = BaseConfig("api_gateway")
logger = ServiceLogger("middleware", config)
redis_cache = RedisCache(config)

# Initialize middleware instances
auth_middleware = AuthMiddleware()
rate_limiter = RateLimiter(
    app=None,  # Will be set during application startup
    cache=redis_cache,
    rate_limits=RATE_LIMITS,
    time_windows=TIME_WINDOWS
)

@cache(maxsize=1000)
async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=True))
) -> Dict:
    """
    FastAPI dependency for retrieving authenticated user information with caching.
    
    Args:
        request: FastAPI request object
        credentials: HTTP Authorization credentials
        
    Returns:
        Dict: Authenticated user context with security metadata
        
    Raises:
        HTTPException: If authentication fails
    """
    try:
        # Apply security headers
        for header, value in SECURITY_HEADERS.items():
            request.headers[header] = value
            
        # Check rate limits
        client_id = request.headers.get("X-API-Key") or request.client.host
        endpoint = request.url.path.split("/")[3]  # Extract service name
        
        is_allowed, remaining, retry_after = await rate_limiter._check_rate_limit(
            endpoint,
            client_id
        )
        
        if not is_allowed:
            raise HTTPException(
                status_code=HTTP_STATUS["TOO_MANY_REQUESTS"],
                detail=ERROR_MESSAGES["RATE_LIMIT_EXCEEDED"].format(time=retry_after),
                headers={"Retry-After": str(retry_after)}
            )
            
        # Authenticate user
        user_context = await auth_middleware.authenticate(request)
        
        # Add rate limit metadata
        user_context.update({
            "rate_limit_remaining": remaining,
            "endpoint": endpoint
        })
        
        logger.info(
            "User authenticated successfully",
            extra={"user_id": user_context.get("user_id")}
        )
        
        return user_context
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Authentication failed",
            exc=e,
            extra={"path": request.url.path}
        )
        raise HTTPException(
            status_code=HTTP_STATUS["INTERNAL_SERVER_ERROR"],
            detail=ERROR_MESSAGES["UNAUTHORIZED_ACCESS"]
        )

# Export middleware components
__all__ = [
    'auth_middleware',
    'rate_limiter',
    'get_current_user',
    'VERSION',
    'SECURITY_HEADERS'
]

# Initialize monitoring
logger.info(
    "API Gateway middleware initialized",
    extra={
        "version": VERSION,
        "rate_limits": RATE_LIMITS,
        "security_headers": list(SECURITY_HEADERS.keys())
    }
)