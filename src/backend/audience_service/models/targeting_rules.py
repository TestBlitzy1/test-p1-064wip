"""
Enhanced targeting rules model for B2B audience targeting with comprehensive platform-specific 
validation and optimization features.
"""

from functools import cache
from typing import Dict, Any, List, Optional, Union
from datetime import datetime

from pydantic import BaseModel, Field, validator

from common.schemas.base import BaseSchema
from common.utils.validators import validate_targeting_rules
from audience_service.models.audience_segment import AudienceSegment

# Platform-specific targeting taxonomies
PLATFORM_TAXONOMIES = {
    'linkedin': {
        'industries': {
            'technology': ['software', 'it_services', 'internet'],
            'finance': ['banking', 'investment_banking', 'financial_services'],
            'manufacturing': ['industrial', 'automotive', 'aerospace']
        },
        'company_sizes': ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10000+'],
        'job_functions': ['information_technology', 'engineering', 'sales', 'marketing', 'finance', 'operations'],
        'seniority_levels': ['entry', 'senior', 'manager', 'director', 'vp', 'cxo']
    },
    'google': {
        'industries': {
            'technology': ['software_development', 'it_solutions', 'cloud_computing'],
            'finance': ['banking_services', 'investment_management', 'insurance'],
            'manufacturing': ['industrial_production', 'automotive_manufacturing', 'aerospace_defense']
        },
        'business_sizes': ['small', 'medium', 'large', 'enterprise'],
        'job_categories': ['it_computing', 'business_professional', 'sales_marketing', 'finance_accounting']
    }
}

def cache_validation_results(func):
    """Decorator to cache validation results for performance optimization."""
    def wrapper(self, *args, **kwargs):
        cache_key = f"{func.__name__}_{str(args)}_{str(kwargs)}"
        if cache_key not in self.validation_cache:
            self.validation_cache[cache_key] = func(self, *args, **kwargs)
        return self.validation_cache[cache_key]
    return wrapper

class TargetingRule(BaseModel):
    """Enhanced base class for all targeting rule types with platform-specific validation."""
    
    rule_type: str = Field(..., description="Type of targeting rule")
    operator: str = Field(..., description="Rule operator (e.g., IN, NOT_IN, CONTAINS)")
    criteria: Dict[str, Any] = Field(..., description="Targeting criteria")
    weight: float = Field(default=1.0, description="Rule weight for scoring")
    is_active: bool = Field(default=True, description="Rule activation status")
    platform_constraints: Dict[str, Any] = Field(default_factory=dict)
    validation_cache: Dict[str, Any] = Field(default_factory=dict, exclude=True)

    class Config:
        validate_assignment = True
        arbitrary_types_allowed = True

    def __init__(self, **data):
        """Initialize targeting rule with enhanced validation."""
        super().__init__(**data)
        self.validation_cache = {}
        self._initialize_platform_constraints()

    def _initialize_platform_constraints(self):
        """Initialize platform-specific constraints and validation rules."""
        for platform in ['linkedin', 'google']:
            if platform not in self.platform_constraints:
                self.platform_constraints[platform] = {
                    'taxonomies': PLATFORM_TAXONOMIES[platform],
                    'validation_rules': self._get_platform_validation_rules(platform)
                }

    @validator('rule_type')
    @cache_validation_results
    def validate_rule_type(cls, value: str) -> str:
        """Enhanced validation of rule type with platform-specific checks."""
        valid_types = {
            'industry': ['linkedin', 'google'],
            'company_size': ['linkedin'],
            'business_size': ['google'],
            'job_function': ['linkedin'],
            'job_category': ['google'],
            'location': ['linkedin', 'google'],
            'seniority': ['linkedin']
        }

        if value not in valid_types:
            raise ValueError(f"Invalid rule type: {value}")

        return value

    @cache_validation_results
    def validate_platform_constraints(self, platform: str) -> bool:
        """Validate targeting rule against platform-specific constraints."""
        if platform not in self.platform_constraints:
            raise ValueError(f"Unsupported platform: {platform}")

        constraints = self.platform_constraints[platform]
        taxonomies = constraints['taxonomies']

        if self.rule_type == 'industry':
            return self._validate_industry_targeting(taxonomies['industries'])
        elif self.rule_type in ['company_size', 'business_size']:
            size_values = taxonomies.get('company_sizes' if platform == 'linkedin' else 'business_sizes', [])
            return self._validate_size_targeting(size_values)
        elif self.rule_type in ['job_function', 'job_category']:
            job_values = taxonomies.get('job_functions' if platform == 'linkedin' else 'job_categories', [])
            return self._validate_job_targeting(job_values)

        return True

    def _validate_industry_targeting(self, valid_industries: Dict[str, List[str]]) -> bool:
        """Validate industry targeting criteria."""
        selected_industries = self.criteria.get('industries', [])
        flattened_industries = [
            sub_industry
            for industry in valid_industries.values()
            for sub_industry in industry
        ]
        
        return all(industry in flattened_industries for industry in selected_industries)

    def _validate_size_targeting(self, valid_sizes: List[str]) -> bool:
        """Validate company/business size targeting."""
        selected_sizes = self.criteria.get('sizes', [])
        return all(size in valid_sizes for size in selected_sizes)

    def _validate_job_targeting(self, valid_jobs: List[str]) -> bool:
        """Validate job function/category targeting."""
        selected_jobs = self.criteria.get('jobs', [])
        return all(job in valid_jobs for job in selected_jobs)

    def _get_platform_validation_rules(self, platform: str) -> Dict[str, Any]:
        """Get platform-specific validation rules."""
        return {
            'linkedin': {
                'max_industries': 20,
                'max_job_titles': 100,
                'max_locations': 50,
                'required_fields': ['industry', 'company_size']
            },
            'google': {
                'max_keywords': 1000,
                'max_locations': 100,
                'required_fields': ['keywords']
            }
        }.get(platform, {})

class IndustryRule(TargetingRule):
    """Enhanced industry targeting rule with platform-specific validation."""
    
    industries: List[str] = Field(..., description="List of target industries")
    include_subsidiaries: bool = Field(default=True, description="Include subsidiary companies")
    industry_mapping: Dict[str, List[str]] = Field(default_factory=dict)
    platform_taxonomies: Dict[str, Any] = Field(default_factory=dict)

    def __init__(self, **data):
        """Initialize industry targeting rule with enhanced validation."""
        super().__init__(rule_type="industry", **data)
        self._initialize_industry_mapping()

    def _initialize_industry_mapping(self):
        """Initialize cross-platform industry mapping."""
        for platform, taxonomy in PLATFORM_TAXONOMIES.items():
            self.platform_taxonomies[platform] = taxonomy['industries']
            
        self.industry_mapping = self._create_industry_mapping()

    def _create_industry_mapping(self) -> Dict[str, List[str]]:
        """Create mapping between platform-specific industry taxonomies."""
        mapping = {}
        for platform, industries in self.platform_taxonomies.items():
            for category, sub_industries in industries.items():
                if category not in mapping:
                    mapping[category] = {}
                mapping[category][platform] = sub_industries
        return mapping

    @validator('industries')
    def validate_industries(cls, value: List[str], values: Dict[str, Any]) -> List[str]:
        """Validate industry list against platform taxonomies."""
        if not value:
            raise ValueError("At least one industry must be specified")

        platform_taxonomies = values.get('platform_taxonomies', {})
        valid_industries = set()
        for taxonomy in platform_taxonomies.values():
            for industries in taxonomy.values():
                valid_industries.update(industries)

        invalid_industries = [ind for ind in value if ind not in valid_industries]
        if invalid_industries:
            raise ValueError(f"Invalid industries: {invalid_industries}")

        return value