"""
Enhanced audience segment model for B2B campaign targeting with comprehensive validation rules
and platform-specific audience calculation logic.
"""

from datetime import datetime
import uuid
from typing import Dict, Any, Tuple, Optional

from sqlalchemy import Column, String, Integer, Float, JSON, DateTime
from sqlalchemy.orm import validates
from sqlalchemy.ext.hybrid import hybrid_property
from pydantic import ValidationError  # pydantic 2.0.0

from common.database.models import Base
from common.utils.validators import validate_targeting_rules

# Platform-specific audience size thresholds
PLATFORM_THRESHOLDS = {
    'linkedin': {
        'min_size': 1000,
        'max_size': 10000000,
        'overlap_limit': 0.8  # Maximum allowed audience overlap (80%)
    },
    'google': {
        'min_size': 100,
        'max_size': 50000000,
        'overlap_limit': 0.7  # Maximum allowed audience overlap (70%)
    }
}

class AudienceSegment(Base):
    """
    Enhanced SQLAlchemy model representing a B2B audience segment with comprehensive 
    targeting rules and metrics.
    """
    
    __tablename__ = 'audience_segments'

    # Primary fields
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(String(1000))
    
    # Targeting and metrics
    targeting_criteria = Column(JSON, nullable=False)
    targeting_rules = Column(JSON, nullable=False)
    estimated_reach = Column(Integer, default=0)
    confidence_score = Column(Float, default=0.0)
    platform_specific_rules = Column(JSON)
    overlap_metrics = Column(JSON)
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __init__(self, name: str, description: str, targeting_criteria: Dict[str, Any], 
                 platform_specific_rules: Optional[Dict[str, Any]] = None) -> None:
        """
        Initialize audience segment with enhanced targeting capabilities.
        
        Args:
            name: Segment name
            description: Segment description
            targeting_criteria: Dictionary of targeting criteria
            platform_specific_rules: Optional platform-specific targeting rules
        """
        super().__init__()
        
        self.name = name
        self.description = description
        self.targeting_criteria = targeting_criteria
        self.platform_specific_rules = platform_specific_rules or {}
        self.overlap_metrics = {}
        self.confidence_score = 0.0
        
        # Initialize targeting rules with validation
        self.targeting_rules = self._initialize_targeting_rules()
        
        # Calculate initial reach
        reach_data = self.calculate_reach()
        self.estimated_reach = reach_data['total_reach']
        self.confidence_score = reach_data['confidence_score']

    @validates('targeting_criteria', 'targeting_rules')
    def validate_targeting(self, key: str, value: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate targeting criteria and rules.
        
        Args:
            key: Field being validated
            value: Value to validate
            
        Returns:
            Validated targeting data
            
        Raises:
            ValidationError: If targeting validation fails
        """
        if not isinstance(value, dict):
            raise ValidationError('Targeting data must be a dictionary')
            
        # Validate with common validator
        is_valid, validation_result = validate_targeting_rules(value)
        if not is_valid:
            raise ValidationError(f"Invalid {key}: {validation_result['errors']}")
            
        return value

    def validate_reach(self, reach: int, platform: str) -> bool:
        """
        Validates if segment reach meets platform-specific requirements.
        
        Args:
            reach: Estimated audience reach
            platform: Advertising platform (linkedin/google)
            
        Returns:
            bool: True if reach is valid for platform
        """
        if platform not in PLATFORM_THRESHOLDS:
            raise ValueError(f"Unsupported platform: {platform}")
            
        thresholds = PLATFORM_THRESHOLDS[platform]
        
        # Check size thresholds
        if reach < thresholds['min_size']:
            return False
        if reach > thresholds['max_size']:
            return False
            
        # Check overlap constraints if metrics exist
        if self.overlap_metrics and platform in self.overlap_metrics:
            overlap_ratio = self.overlap_metrics[platform].get('overlap_ratio', 0)
            if overlap_ratio > thresholds['overlap_limit']:
                return False
                
        return True

    def calculate_reach(self) -> Dict[str, Any]:
        """
        Calculates estimated audience reach with enhanced targeting criteria.
        
        Returns:
            Dictionary containing reach metrics and confidence score
        """
        result = {
            'total_reach': 0,
            'platform_reach': {},
            'confidence_score': 0.0,
            'reach_breakdown': {}
        }
        
        try:
            # Apply base targeting filters
            base_reach = self._calculate_base_reach()
            
            # Apply industry focus
            industry_reach = self._apply_industry_filter(base_reach)
            result['reach_breakdown']['industry'] = industry_reach
            
            # Apply company size filter
            company_size_reach = self._apply_company_size_filter(industry_reach)
            result['reach_breakdown']['company_size'] = company_size_reach
            
            # Apply job function filters
            job_reach = self._apply_job_filters(company_size_reach)
            result['reach_breakdown']['job_function'] = job_reach
            
            # Apply seniority and geographic filters
            final_reach = self._apply_additional_filters(job_reach)
            
            # Calculate platform-specific reach
            for platform in ['linkedin', 'google']:
                if self.validate_reach(final_reach, platform):
                    result['platform_reach'][platform] = final_reach
            
            # Calculate confidence score based on targeting precision
            confidence_score = self._calculate_confidence_score(result['reach_breakdown'])
            
            result['total_reach'] = final_reach
            result['confidence_score'] = confidence_score
            
            # Update overlap metrics
            self._update_overlap_metrics(result)
            
        except Exception as e:
            # Log error but return safe defaults
            result['total_reach'] = 0
            result['confidence_score'] = 0.0
            result['error'] = str(e)
            
        return result

    def validate_targeting_combination(self, criteria_updates: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Validates compatibility of targeting criteria combinations.
        
        Args:
            criteria_updates: Updated targeting criteria
            
        Returns:
            Tuple containing validation result and message
        """
        combined_criteria = {**self.targeting_criteria, **criteria_updates}
        
        # Check for conflicting targeting rules
        if self._has_targeting_conflicts(combined_criteria):
            return False, "Conflicting targeting rules detected"
            
        # Validate industry-function combinations
        if not self._validate_industry_functions(combined_criteria):
            return False, "Invalid industry and job function combination"
            
        # Check geographic targeting restrictions
        if not self._validate_geographic_targeting(combined_criteria):
            return False, "Invalid geographic targeting configuration"
            
        # Validate seniority level combinations
        if not self._validate_seniority_levels(combined_criteria):
            return False, "Invalid seniority level combination"
            
        return True, "Targeting criteria valid"

    def _initialize_targeting_rules(self) -> Dict[str, Any]:
        """Initialize targeting rules from criteria with validation."""
        base_rules = {
            'inclusion_rules': [],
            'exclusion_rules': [],
            'custom_rules': {}
        }
        
        # Convert targeting criteria to rules
        for criterion, value in self.targeting_criteria.items():
            if isinstance(value, list):
                base_rules['inclusion_rules'].append({
                    'field': criterion,
                    'operator': 'IN',
                    'values': value
                })
            elif isinstance(value, dict):
                base_rules['custom_rules'][criterion] = value
                
        return base_rules

    def _calculate_base_reach(self) -> int:
        """Calculate base audience reach before filters."""
        # Implementation would integrate with audience size estimation service
        return 1000000  # Placeholder default

    def _apply_industry_filter(self, base_reach: int) -> int:
        """Apply industry targeting filters to reach calculation."""
        industry_focus = self.targeting_criteria.get('industries', [])
        if not industry_focus:
            return base_reach
        return int(base_reach * 0.7)  # Simplified calculation

    def _apply_company_size_filter(self, reach: int) -> int:
        """Apply company size filters to reach calculation."""
        size_ranges = self.targeting_criteria.get('company_size', [])
        if not size_ranges:
            return reach
        return int(reach * 0.8)  # Simplified calculation

    def _apply_job_filters(self, reach: int) -> int:
        """Apply job function and title filters to reach calculation."""
        job_filters = self.targeting_criteria.get('job_functions', [])
        if not job_filters:
            return reach
        return int(reach * 0.6)  # Simplified calculation

    def _apply_additional_filters(self, reach: int) -> int:
        """Apply remaining targeting filters to reach calculation."""
        # Apply seniority and location filters
        seniority_impact = 0.9 if self.targeting_criteria.get('seniority_levels') else 1.0
        location_impact = 0.8 if self.targeting_criteria.get('locations') else 1.0
        
        return int(reach * seniority_impact * location_impact)

    def _calculate_confidence_score(self, reach_breakdown: Dict[str, int]) -> float:
        """Calculate confidence score based on targeting precision."""
        weights = {
            'industry': 0.3,
            'company_size': 0.2,
            'job_function': 0.5
        }
        
        score = 0.0
        for category, weight in weights.items():
            if category in reach_breakdown:
                precision = min(reach_breakdown[category], 1000000) / 1000000
                score += weight * precision
                
        return round(min(score, 1.0), 2)

    def _update_overlap_metrics(self, reach_data: Dict[str, Any]) -> None:
        """Update audience overlap metrics."""
        self.overlap_metrics = {
            platform: {
                'overlap_ratio': 0.5,  # Placeholder - would be calculated from actual data
                'overlap_segments': []  # List of overlapping segment IDs
            }
            for platform in reach_data.get('platform_reach', {})
        }