"""
Campaign service models package initialization.
Provides optimized access to core campaign and ad group models for rapid campaign generation.

Version: 1.0.0
"""

from typing import List

# Import core models with optimized validation and caching capabilities
from .campaign import Campaign
from .ad_group import AdGroup

# Export core models and their essential methods
__all__: List[str] = [
    "Campaign",  # Campaign model with budget validation and platform formatting
    "AdGroup"    # Ad group model with platform-specific configuration
]

# Version and metadata
__version__ = "1.0.0"
__author__ = "Sales & Intelligence Platform"
__description__ = "Core campaign models optimized for <30s campaign generation"

# Ensure models are registered with SQLAlchemy
from common.database.models import mapper_registry
mapper_registry.configure()