"""
Core validation utilities and functions for data validation across the Sales and Intelligence Platform.
Provides comprehensive validators for campaign data, audience targeting, and platform-specific constraints.
"""

import re
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple, Optional, Union

from pydantic import validator, ValidationError

from common.schemas.base import BaseSchema
from common.database.models import STATUSES

# Optimized regex patterns compiled for performance
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
URL_REGEX = re.compile(r'^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$')
PHONE_REGEX = re.compile(r'^\+?[1-9]\d{1,14}$')

# Platform-specific constraints
PLATFORM_CONSTRAINTS = {
    'linkedin': {
        'min_budget': 10.0,
        'max_budget': 50000.0,
        'min_duration_days': 1,
        'max_duration_days': 180,
        'audience_size': {
            'min': 1000,
            'max': 10000000
        },
        'targeting': {
            'max_job_titles': 100,
            'max_industries': 20,
            'max_locations': 50,
            'required_fields': ['industry', 'company_size']
        }
    },
    'google': {
        'min_budget': 1.0,
        'max_budget': 100000.0,
        'min_duration_days': 1,
        'max_duration_days': 365,
        'audience_size': {
            'min': 100,
            'max': 50000000
        },
        'targeting': {
            'max_keywords': 1000,
            'max_locations': 100,
            'required_fields': ['keywords']
        }
    }
}

@validator
def validate_email(email: str) -> bool:
    """
    Validates email address format with comprehensive error handling.
    
    Args:
        email: Email address to validate
        
    Returns:
        bool: True if email is valid
        
    Raises:
        ValidationError: If email format is invalid
    """
    if not email or not isinstance(email, str):
        raise ValidationError('Email address is required and must be a string')
        
    if len(email) > 254:
        raise ValidationError('Email address exceeds maximum length of 254 characters')
        
    if not EMAIL_REGEX.match(email):
        raise ValidationError('Invalid email address format')
        
    # Additional domain validation
    domain = email.split('@')[1]
    if len(domain.split('.')) < 2:
        raise ValidationError('Invalid email domain format')
        
    return True

@validator
def validate_url(url: str) -> bool:
    """
    Validates URL format with enhanced security checks.
    
    Args:
        url: URL to validate
        
    Returns:
        bool: True if URL is valid and secure
        
    Raises:
        ValidationError: If URL format or security checks fail
    """
    if not url or not isinstance(url, str):
        raise ValidationError('URL is required and must be a string')
        
    if len(url) > 2048:
        raise ValidationError('URL exceeds maximum length of 2048 characters')
        
    if not URL_REGEX.match(url):
        raise ValidationError('Invalid URL format')
        
    # Security checks
    lower_url = url.lower()
    if not lower_url.startswith(('http://', 'https://')):
        raise ValidationError('URL must use HTTP or HTTPS protocol')
        
    # Check for malicious patterns
    malicious_patterns = ['javascript:', 'data:', 'vbscript:']
    if any(pattern in lower_url for pattern in malicious_patterns):
        raise ValidationError('URL contains potentially malicious content')
        
    return True

@validator
def validate_campaign_budget(
    budget: float,
    platform: str,
    currency: str = 'USD'
) -> Tuple[bool, str]:
    """
    Validates campaign budget against platform-specific constraints.
    
    Args:
        budget: Campaign budget amount
        platform: Advertising platform (linkedin/google)
        currency: Budget currency code (default: USD)
        
    Returns:
        Tuple[bool, str]: (is_valid, error_message)
    """
    if not isinstance(budget, (int, float)):
        return False, 'Budget must be a numeric value'
        
    if budget <= 0:
        return False, 'Budget must be greater than zero'
        
    if platform not in PLATFORM_CONSTRAINTS:
        return False, f'Unsupported platform: {platform}'
        
    constraints = PLATFORM_CONSTRAINTS[platform]
    
    # Apply currency conversion if needed
    if currency != 'USD':
        # TODO: Implement currency conversion
        pass
        
    if budget < constraints['min_budget']:
        return False, f'Budget below minimum {constraints["min_budget"]} {currency}'
        
    if budget > constraints['max_budget']:
        return False, f'Budget exceeds maximum {constraints["max_budget"]} {currency}'
        
    return True, ''

class CampaignValidator:
    """
    Comprehensive validator for campaign-related data with platform-specific rules.
    """
    
    def __init__(self, platform: str, custom_constraints: Optional[Dict] = None):
        """
        Initialize campaign validator with platform constraints.
        
        Args:
            platform: Advertising platform (linkedin/google)
            custom_constraints: Optional custom validation constraints
        """
        if platform not in PLATFORM_CONSTRAINTS:
            raise ValueError(f'Unsupported platform: {platform}')
            
        self.platform = platform
        self.constraints = PLATFORM_CONSTRAINTS[platform]
        
        # Merge custom constraints if provided
        if custom_constraints:
            self.constraints.update(custom_constraints)
            
    def validate_campaign_structure(self, campaign_data: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Validates complete campaign structure with comprehensive checks.
        
        Args:
            campaign_data: Campaign configuration data
            
        Returns:
            Tuple[bool, List[str]]: (is_valid, error_messages)
        """
        errors = []
        
        # Validate required fields
        required_fields = ['name', 'start_date', 'end_date', 'budget', 'targeting']
        for field in required_fields:
            if field not in campaign_data:
                errors.append(f'Missing required field: {field}')
                
        if errors:
            return False, errors
            
        # Validate dates
        try:
            start_date = datetime.fromisoformat(campaign_data['start_date'])
            end_date = datetime.fromisoformat(campaign_data['end_date'])
            
            duration_days = (end_date - start_date).days
            if duration_days < self.constraints['min_duration_days']:
                errors.append(f'Campaign duration below minimum {self.constraints["min_duration_days"]} days')
            elif duration_days > self.constraints['max_duration_days']:
                errors.append(f'Campaign duration exceeds maximum {self.constraints["max_duration_days"]} days')
                
            BaseSchema.validate_dates(start_date, end_date, {'max_campaign_days': self.constraints['max_duration_days']})
        except ValidationError as e:
            errors.append(str(e))
            
        # Validate budget
        budget_valid, budget_error = validate_campaign_budget(
            campaign_data.get('budget', 0),
            self.platform,
            campaign_data.get('currency', 'USD')
        )
        if not budget_valid:
            errors.append(budget_error)
            
        # Validate targeting rules
        targeting_valid, targeting_result = self.validate_targeting_rules(campaign_data.get('targeting', {}))
        if not targeting_valid:
            errors.extend(targeting_result['errors'])
            
        return len(errors) == 0, errors

    def validate_targeting_rules(self, targeting_data: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """
        Validates audience targeting rules with size estimation.
        
        Args:
            targeting_data: Targeting configuration
            
        Returns:
            Tuple[bool, Dict]: (is_valid, {errors: [], warnings: [], audience_size: int})
        """
        result = {
            'errors': [],
            'warnings': [],
            'audience_size': 0
        }
        
        # Validate required targeting fields
        for field in self.constraints['targeting']['required_fields']:
            if field not in targeting_data:
                result['errors'].append(f'Missing required targeting field: {field}')
                
        if result['errors']:
            return False, result
            
        # Platform-specific targeting validations
        if self.platform == 'linkedin':
            # Validate job titles
            job_titles = targeting_data.get('job_titles', [])
            if len(job_titles) > self.constraints['targeting']['max_job_titles']:
                result['errors'].append(
                    f'Number of job titles exceeds maximum {self.constraints["targeting"]["max_job_titles"]}'
                )
                
            # Validate industries
            industries = targeting_data.get('industries', [])
            if len(industries) > self.constraints['targeting']['max_industries']:
                result['errors'].append(
                    f'Number of industries exceeds maximum {self.constraints["targeting"]["max_industries"]}'
                )
                
        elif self.platform == 'google':
            # Validate keywords
            keywords = targeting_data.get('keywords', [])
            if len(keywords) > self.constraints['targeting']['max_keywords']:
                result['errors'].append(
                    f'Number of keywords exceeds maximum {self.constraints["targeting"]["max_keywords"]}'
                )
                
        # Validate locations
        locations = targeting_data.get('locations', [])
        if len(locations) > self.constraints['targeting']['max_locations']:
            result['errors'].append(
                f'Number of locations exceeds maximum {self.constraints["targeting"]["max_locations"]}'
            )
            
        # TODO: Implement audience size estimation
        result['audience_size'] = 0
        
        # Validate audience size constraints
        if result['audience_size'] < self.constraints['audience_size']['min']:
            result['errors'].append(f'Estimated audience size below minimum {self.constraints["audience_size"]["min"]}')
        elif result['audience_size'] > self.constraints['audience_size']['max']:
            result['errors'].append(f'Estimated audience size exceeds maximum {self.constraints["audience_size"]["max"]}')
            
        return len(result['errors']) == 0, result