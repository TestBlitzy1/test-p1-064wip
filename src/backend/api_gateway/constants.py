"""
API Gateway Constants Module

This module defines all constant values and configurations used throughout the API Gateway service.
Constants include API versioning, service routes, rate limits, time windows, HTTP status codes,
error messages, and CORS settings. All constants are immutable and environment-independent.

Version: 1.0.0
"""
from typing import Dict, List, Union

# API Version and Base Path
API_VERSION: str = "v1"
BASE_PATH: str = f"/api/{API_VERSION}"

# Service Routes for Internal Microservices
SERVICE_ROUTES: Dict[str, str] = {
    "campaigns": "/campaign-service",
    "analytics": "/analytics-service",
    "audience": "/audience-service",
    "ai": "/ai-service",
    "integration": "/integration-service",
    "auth": "/auth-service",
    "health": "/health"
}

# Rate Limits (requests per minute)
RATE_LIMITS: Dict[str, int] = {
    # Platform-specific limits
    "linkedin_ads_campaign": 100,    # LinkedIn campaign management
    "linkedin_ads_reporting": 500,   # LinkedIn reporting endpoints
    "google_ads_campaign": 150,      # Google Ads campaign management
    "google_ads_reporting": 1000,    # Google Ads reporting endpoints
    
    # Internal service limits
    "campaign_creation": 50,         # Campaign creation endpoints
    "data_sync": 50,                # Data synchronization operations
    "analytics": 500,               # Analytics service endpoints
    "audience": 100,                # Audience service endpoints
    "default": 1000                 # Default rate limit
}

# Time Windows in Seconds
TIME_WINDOWS: Dict[str, int] = {
    "per_second": 1,
    "per_minute": 60,
    "per_hour": 3600,
    "per_day": 86400,
    "per_week": 604800,
    "per_month": 2592000
}

# HTTP Status Codes
HTTP_STATUS: Dict[str, int] = {
    # Success codes (2xx)
    "OK": 200,
    "CREATED": 201,
    "ACCEPTED": 202,
    "NO_CONTENT": 204,
    
    # Client error codes (4xx)
    "BAD_REQUEST": 400,
    "UNAUTHORIZED": 401,
    "FORBIDDEN": 403,
    "NOT_FOUND": 404,
    "METHOD_NOT_ALLOWED": 405,
    "CONFLICT": 409,
    "TOO_MANY_REQUESTS": 429,
    
    # Server error codes (5xx)
    "INTERNAL_SERVER_ERROR": 500,
    "SERVICE_UNAVAILABLE": 503,
    "GATEWAY_TIMEOUT": 504
}

# Standardized Error Messages
ERROR_MESSAGES: Dict[str, str] = {
    # Authentication and Authorization
    "RATE_LIMIT_EXCEEDED": "Rate limit exceeded. Please try again in {time} seconds.",
    "UNAUTHORIZED_ACCESS": "Unauthorized access. Please authenticate.",
    "INVALID_TOKEN": "Invalid or expired token. Please re-authenticate.",
    
    # Service Status
    "SERVICE_UNAVAILABLE": "Service temporarily unavailable. Please try again later.",
    
    # Request Validation
    "INVALID_REQUEST": "Invalid request format. Please check documentation.",
    "RESOURCE_NOT_FOUND": "Requested resource not found.",
    
    # Business Logic
    "CAMPAIGN_CREATION_FAILED": "Failed to create campaign. Please verify inputs.",
    "DATA_SYNC_ERROR": "Error synchronizing data with external service.",
    
    # Validation and Platform
    "VALIDATION_ERROR": "Request validation failed: {details}",
    "PLATFORM_ERROR": "External platform error: {details}"
}

# CORS Configuration Settings
CORS_SETTINGS: Dict[str, Union[List[str], bool, int]] = {
    # Allowed Origins, Methods, and Headers
    "ALLOWED_ORIGINS": ["*"],  # Production should specify exact domains
    "ALLOWED_METHODS": [
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "PATCH",
        "OPTIONS"
    ],
    "ALLOWED_HEADERS": [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-API-Key"
    ],
    "EXPOSED_HEADERS": [
        "Content-Length",
        "X-Rate-Limit-Remaining"
    ],
    
    # CORS Policy Settings
    "MAX_AGE": 3600,  # Cache preflight requests for 1 hour
    "ALLOW_CREDENTIALS": True
}