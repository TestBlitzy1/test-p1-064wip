"""Common utilities package providing centralized validation functions for the Sales and Intelligence Platform.

This package exposes core validation functions used across all backend services for ensuring
data integrity, platform compliance, and business rule enforcement. All functions include
comprehensive type hints and validation error handling.

Available Functions:
    validate_campaign_budget: Ensures campaign budgets meet platform and business constraints
    validate_targeting_rules: Validates audience targeting criteria against platform rules
    validate_date_range: Verifies campaign date ranges are valid and within allowed bounds
    validate_platform_compliance: Checks compliance with ad platform specific rules

Version: 1.0.0
"""

from typing import Dict, Any, List, Tuple, Optional, Union
from datetime import datetime

from .validators import (
    validate_campaign_budget,
    validate_targeting_rules,
    validate_date_range,
    validate_platform_compliance
)

# Package version
__version__ = "1.0.0"

# Expose core validation functions
__all__ = [
    "validate_campaign_budget",
    "validate_targeting_rules", 
    "validate_date_range",
    "validate_platform_compliance"
]

# Re-export validation functions with enhanced type hints
def validate_campaign_budget(
    budget: float,
    platform: str,
    currency: str = "USD"
) -> Tuple[bool, str]:
    """
    Validates campaign budget against platform-specific constraints.
    Re-exported from validators module with enhanced type hints.

    Args:
        budget: Campaign budget amount as float
        platform: Advertising platform ("linkedin" or "google")
        currency: Three-letter currency code (default: "USD")

    Returns:
        Tuple containing:
            - bool: True if budget is valid
            - str: Error message if invalid, empty string if valid
    """
    return validate_campaign_budget(budget, platform, currency)

def validate_targeting_rules(
    targeting_data: Dict[str, Any],
    platform: str
) -> Tuple[bool, Dict[str, Any]]:
    """
    Validates audience targeting rules against platform constraints.
    Re-exported from validators module with enhanced type hints.

    Args:
        targeting_data: Dictionary containing targeting configuration
        platform: Advertising platform ("linkedin" or "google")

    Returns:
        Tuple containing:
            - bool: True if targeting rules are valid
            - Dict: Contains 'errors', 'warnings' and 'audience_size' keys
    """
    return validate_targeting_rules(targeting_data, platform)

def validate_date_range(
    start_date: datetime,
    end_date: datetime,
    platform: str
) -> Tuple[bool, str]:
    """
    Validates campaign date range against platform constraints.
    Re-exported from validators module with enhanced type hints.

    Args:
        start_date: Campaign start datetime
        end_date: Campaign end datetime
        platform: Advertising platform ("linkedin" or "google")

    Returns:
        Tuple containing:
            - bool: True if date range is valid
            - str: Error message if invalid, empty string if valid
    """
    return validate_date_range(start_date, end_date, platform)

def validate_platform_compliance(
    campaign_data: Dict[str, Any],
    platform: str
) -> Tuple[bool, List[str]]:
    """
    Validates complete campaign configuration against platform rules.
    Re-exported from validators module with enhanced type hints.

    Args:
        campaign_data: Complete campaign configuration dictionary
        platform: Advertising platform ("linkedin" or "google")

    Returns:
        Tuple containing:
            - bool: True if campaign is compliant
            - List[str]: List of compliance errors if any
    """
    return validate_platform_compliance(campaign_data, platform)