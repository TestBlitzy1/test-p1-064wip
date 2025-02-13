"""
Common schema package for the Sales and Intelligence Platform.
Provides centralized schema classes and validation utilities for standardized data validation,
serialization, and API documentation across all backend services.
"""

from common.schemas.base import (
    BaseSchema,
    RequestSchema,
    ResponseSchema,
)

# Schema version for compatibility tracking and migrations
SCHEMA_VERSION = "1.0.0"

# Export schema classes and utilities
__all__ = [
    "BaseSchema",
    "RequestSchema", 
    "ResponseSchema",
    "SCHEMA_VERSION"
]