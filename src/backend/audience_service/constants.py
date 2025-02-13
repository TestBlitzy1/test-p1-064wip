"""
Constants module for the audience service defining core configuration values,
targeting rules, validation thresholds, and supported values for B2B audience segmentation.

Version: 1.0.0
"""

from typing import Dict, List, Optional  # v3.11+
from common.config.settings import ENV  # Internal import

# Service identification
SERVICE_NAME: str = "audience_service"

# Audience size constraints for statistical significance and privacy
MIN_AUDIENCE_SIZE: int = 1000  # Minimum audience size for valid targeting
MAX_AUDIENCE_SIZE: int = 10_000_000  # Maximum audience size for performance optimization

# Supported targeting dimensions for B2B campaigns
SUPPORTED_RULE_TYPES: List[str] = [
    "industry",
    "company_size",
    "job_title",
    "location",
    "seniority",
    "skills",
    "interests",
    "company_revenue",
    "company_growth",
    "technology_usage"
]

# Comprehensive B2B industry mapping
SUPPORTED_INDUSTRIES: Dict[str, str] = {
    "technology": "Technology & SaaS",
    "finance": "Finance & Banking",
    "healthcare": "Healthcare & Life Sciences",
    "manufacturing": "Manufacturing & Industrial",
    "retail": "Retail & E-commerce",
    "professional_services": "Professional Services",
    "telecommunications": "Telecommunications",
    "energy": "Energy & Utilities",
    "education": "Education & Training",
    "government": "Government & Public Sector"
}

# Granular company size ranges for B2B segmentation
COMPANY_SIZE_RANGES: Dict[str, Dict[str, Optional[int]]] = {
    "startup": {"min": 1, "max": 50},
    "small": {"min": 51, "max": 200},
    "mid_market": {"min": 201, "max": 1000},
    "large": {"min": 1001, "max": 5000},
    "enterprise": {"min": 5001, "max": None}  # None indicates no upper limit
}

# Comprehensive job level categories for precise targeting
JOB_LEVEL_CATEGORIES: List[str] = [
    "C-Level",
    "VP",
    "Director",
    "Senior Manager",
    "Manager",
    "Senior Individual Contributor",
    "Individual Contributor",
    "Consultant",
    "Advisor",
    "Specialist"
]

# Platform-specific targeting constraints
TARGETING_RULE_CONSTRAINTS: Dict[str, int] = {
    "min_industries": 1,
    "max_industries": 5,
    "min_job_titles": 1,
    "max_job_titles": 20,
    "min_locations": 1,
    "max_locations": 50,
    "min_skills": 1,
    "max_skills": 15,
    "min_interests": 1,
    "max_interests": 10,
    "min_technologies": 1,
    "max_technologies": 25
}

# Performance optimization constants
CACHE_TTL: int = 3600  # Cache duration in seconds
BATCH_SIZE: int = 1000  # Optimal batch size for data processing