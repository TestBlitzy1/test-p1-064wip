"""
Campaign model for managing digital advertising campaigns.
Provides comprehensive campaign management with enhanced validation, caching, and platform support.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
from decimal import Decimal
import json

from sqlalchemy import Column, String, Float, DateTime, JSON
from sqlalchemy.orm import relationship
from pydantic import BaseModel as PydanticModel, validator, Field
from cachetools import TTLCache, cached
from redis import Redis

from common.database.models import BaseModel
from .ad_group import AdGroup

# Platform-specific constants
PLATFORM_TYPES = ['LINKEDIN', 'GOOGLE']
CAMPAIGN_CACHE_TTL = 1800  # 30 minutes
GENERATION_TIMEOUT = 30  # 30 seconds
MIN_CAMPAIGN_DURATION_DAYS = 1
MAX_CAMPAIGN_DURATION_DAYS = 365

# Initialize cache
campaign_cache = TTLCache(maxsize=1000, ttl=CAMPAIGN_CACHE_TTL)
redis_client = Redis(host='localhost', port=6379, db=0)

class CampaignValidator(PydanticModel):
    """Pydantic model for validating campaign data."""
    
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., max_length=1000)
    platform_type: str
    total_budget: float = Field(..., gt=0)
    start_date: datetime
    end_date: datetime
    targeting_settings: Dict[str, Any]
    platform_settings: Dict[str, Any]

    @validator('platform_type')
    def validate_platform(cls, v):
        if v not in PLATFORM_TYPES:
            raise ValueError(f'Invalid platform type: {v}')
        return v

    @validator('total_budget')
    def validate_budget_format(cls, v):
        if round(v, 2) != v:
            raise ValueError('Budget must have maximum 2 decimal places')
        return v

    @validator('end_date')
    def validate_campaign_duration(cls, v, values):
        if 'start_date' in values:
            duration = (v - values['start_date']).days
            if not MIN_CAMPAIGN_DURATION_DAYS <= duration <= MAX_CAMPAIGN_DURATION_DAYS:
                raise ValueError(f'Campaign duration must be between {MIN_CAMPAIGN_DURATION_DAYS} and {MAX_CAMPAIGN_DURATION_DAYS} days')
        return v

class Campaign(BaseModel):
    """
    Enhanced campaign model with optimized validation, caching, and platform-specific formatting.
    """
    
    __tablename__ = 'campaigns'

    # Core fields
    name = Column(String(255), nullable=False)
    description = Column(String(1000), nullable=False)
    platform_type = Column(String(50), nullable=False)
    total_budget = Column(Float, nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    targeting_settings = Column(JSON, nullable=False)
    platform_settings = Column(JSON, nullable=False)
    estimated_reach = Column(Float, nullable=True)

    # Relationships
    ad_groups = relationship("AdGroup", back_populates="campaign", cascade="all, delete-orphan")

    def __init__(
        self,
        name: str,
        description: str,
        platform_type: str,
        total_budget: float,
        start_date: datetime,
        end_date: datetime,
        targeting_settings: Dict[str, Any],
        platform_settings: Dict[str, Any]
    ) -> None:
        """
        Initialize campaign with enhanced validation and caching.

        Args:
            name: Campaign name
            description: Campaign description
            platform_type: Platform (LINKEDIN/GOOGLE)
            total_budget: Total campaign budget
            start_date: Campaign start date
            end_date: Campaign end date
            targeting_settings: Targeting configuration
            platform_settings: Platform-specific settings
        """
        # Validate input data using Pydantic model
        validator = CampaignValidator(
            name=name,
            description=description,
            platform_type=platform_type,
            total_budget=total_budget,
            start_date=start_date,
            end_date=end_date,
            targeting_settings=targeting_settings,
            platform_settings=platform_settings
        )

        # Initialize base model
        super().__init__(
            name=validator.name,
            description=validator.description,
            platform_type=validator.platform_type,
            total_budget=validator.total_budget,
            start_date=validator.start_date,
            end_date=validator.end_date,
            targeting_settings=validator.targeting_settings,
            platform_settings=validator.platform_settings
        )

        self.validate_budget(total_budget)
        self.ad_groups = []
        self._calculate_estimated_reach()

    @cached(campaign_cache)
    def validate_budget(self, budget: float) -> bool:
        """
        Enhanced budget validation with platform rules and caching.

        Args:
            budget: Budget amount to validate

        Returns:
            bool: True if valid, raises ValidationError otherwise
        """
        cache_key = f"budget_validation_{self.id}_{budget}"
        cached_result = redis_client.get(cache_key)
        
        if cached_result:
            return bool(cached_result)

        # Validate budget precision
        if round(budget, 2) != budget:
            raise ValueError('Budget must have maximum 2 decimal places')

        # Platform-specific validation
        if self.platform_type == 'LINKEDIN':
            if budget < 10.00:
                raise ValueError('LinkedIn campaigns require minimum budget of $10.00')
        elif self.platform_type == 'GOOGLE':
            if budget < 5.00:
                raise ValueError('Google campaigns require minimum budget of $5.00')

        # Validate budget allocation if ad groups exist
        if self.ad_groups:
            allocated_budget = sum(group.budget for group in self.ad_groups)
            if allocated_budget > budget:
                raise ValueError('Total ad group budgets exceed campaign budget')

        redis_client.setex(cache_key, CAMPAIGN_CACHE_TTL, "1")
        return True

    def _calculate_estimated_reach(self) -> None:
        """Calculate estimated campaign reach based on targeting and budget."""
        cache_key = f"estimated_reach_{self.id}"
        cached_reach = redis_client.get(cache_key)
        
        if cached_reach:
            self.estimated_reach = float(cached_reach)
            return

        # Platform-specific reach calculation
        if self.platform_type == 'LINKEDIN':
            base_reach = self.total_budget * 200  # Estimated LinkedIn CPM of $5
            targeting_multiplier = len(self.targeting_settings.get('industries', [])) * 0.8
            self.estimated_reach = base_reach * targeting_multiplier
        else:  # Google
            base_reach = self.total_budget * 500  # Estimated Google CPM of $2
            targeting_multiplier = len(self.targeting_settings.get('keywords', [])) * 0.6
            self.estimated_reach = base_reach * targeting_multiplier

        redis_client.setex(cache_key, CAMPAIGN_CACHE_TTL, str(self.estimated_reach))

    def add_ad_group(self, ad_group_data: Dict[str, Any]) -> AdGroup:
        """
        Create and add a new ad group to the campaign.

        Args:
            ad_group_data: Ad group configuration data

        Returns:
            AdGroup: Newly created ad group instance
        """
        # Validate budget allocation
        new_budget = ad_group_data.get('budget', 0)
        current_allocation = sum(group.budget for group in self.ad_groups)
        if current_allocation + new_budget > self.total_budget:
            raise ValueError('Ad group budget allocation would exceed campaign budget')

        # Create new ad group
        ad_group = AdGroup(
            campaign_id=self.id,
            **ad_group_data
        )

        self.ad_groups.append(ad_group)
        self.update_timestamps()
        return ad_group

    @cached(campaign_cache)
    def to_platform_format(self) -> Dict[str, Any]:
        """
        Optimized platform-specific format conversion with caching.

        Returns:
            dict: Platform-specific campaign configuration
        """
        cache_key = f"platform_format_{self.id}"
        cached_format = redis_client.get(cache_key)
        
        if cached_format:
            return json.loads(cached_format)

        base_format = {
            'id': self.id,
            'name': self.name,
            'status': self.status,
            'budget': {
                'amount': str(round(self.total_budget, 2)),
                'currency': self.platform_settings.get('currency', 'USD')
            },
            'startDate': self.start_date.isoformat(),
            'endDate': self.end_date.isoformat(),
            'adGroups': [group.to_platform_format() for group in self.ad_groups]
        }

        if self.platform_type == 'LINKEDIN':
            result = {
                **base_format,
                'targeting': self.targeting_settings,
                'linkedInSettings': self.platform_settings.get('linkedin_specific', {}),
                'tracking': self.platform_settings.get('tracking', {}),
                'estimatedReach': self.estimated_reach
            }
        else:  # GOOGLE
            result = {
                **base_format,
                'targetingSettings': self.targeting_settings,
                'googleSettings': self.platform_settings.get('google_specific', {}),
                'trackingTemplate': self.platform_settings.get('tracking_template'),
                'estimatedReach': self.estimated_reach
            }

        redis_client.setex(cache_key, CAMPAIGN_CACHE_TTL, json.dumps(result))
        return result