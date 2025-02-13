"""
AdGroup model for managing collections of ads within campaigns.
Provides comprehensive platform-specific validation and configuration management.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
from decimal import Decimal

from sqlalchemy import Column, String, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship
from pydantic import BaseModel as PydanticModel, validator, Field  # pydantic 2.0.0

from common.database.models import BaseModel

# Platform-specific constants
LINKEDIN_MIN_BUDGET = 10.00
GOOGLE_MIN_BUDGET = 5.00
PLATFORM_AD_FORMATS = {
    'LINKEDIN': ['SINGLE_IMAGE', 'CAROUSEL', 'VIDEO', 'MESSAGE', 'DYNAMIC'],
    'GOOGLE': ['RESPONSIVE_SEARCH', 'EXPANDED_TEXT', 'RESPONSIVE_DISPLAY']
}
AD_GROUP_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED', 'REMOVED']

class AdGroupValidator(PydanticModel):
    """Pydantic model for validating ad group data."""
    
    name: str = Field(..., min_length=1, max_length=255)
    campaign_id: str
    budget: float = Field(..., gt=0)
    targeting_criteria: Dict[str, Any]
    ad_format: str
    platform_settings: Dict[str, Any]

    @validator('budget')
    def validate_budget_format(cls, v):
        """Validate budget has max 2 decimal places."""
        if round(v, 2) != v:
            raise ValueError('Budget must have maximum 2 decimal places')
        return v

    @validator('ad_format')
    def validate_ad_format(cls, v, values):
        """Validate ad format is supported by the platform."""
        platform = values.get('platform_settings', {}).get('platform')
        if platform and v not in PLATFORM_AD_FORMATS.get(platform, []):
            raise ValueError(f'Invalid ad format {v} for platform {platform}')
        return v

class AdGroup(BaseModel):
    """
    Represents an ad group within a campaign with enhanced platform-specific validation.
    """
    
    __tablename__ = 'ad_groups'

    # Core fields
    name = Column(String(255), nullable=False)
    campaign_id = Column(String(36), ForeignKey('campaigns.id'), nullable=False)
    budget = Column(Float, nullable=False)
    targeting_criteria = Column(JSON, nullable=False)
    ad_format = Column(String(50), nullable=False)
    platform_settings = Column(JSON, nullable=False)

    # Relationships
    ads = relationship("Ad", back_populates="ad_group", cascade="all, delete-orphan")

    def __init__(
        self,
        name: str,
        campaign_id: str,
        budget: float,
        targeting_criteria: Dict[str, Any],
        ad_format: str,
        platform_settings: Dict[str, Any]
    ) -> None:
        """
        Initialize a new AdGroup instance with enhanced validation.

        Args:
            name: Name of the ad group
            campaign_id: ID of the parent campaign
            budget: Ad group budget amount
            targeting_criteria: Platform-specific targeting settings
            ad_format: Type of ads in this group
            platform_settings: Platform-specific configurations
        """
        # Validate input data using Pydantic model
        validator = AdGroupValidator(
            name=name,
            campaign_id=campaign_id,
            budget=budget,
            targeting_criteria=targeting_criteria,
            ad_format=ad_format,
            platform_settings=platform_settings
        )

        # Initialize base model
        super().__init__(
            name=validator.name,
            campaign_id=validator.campaign_id,
            budget=validator.budget,
            targeting_criteria=validator.targeting_criteria,
            ad_format=validator.ad_format,
            platform_settings=validator.platform_settings
        )

        self.validate_budget(budget)
        self.ads = []

    def validate_budget(self, budget: float) -> bool:
        """
        Validate ad group budget against platform requirements.

        Args:
            budget: Budget amount to validate

        Returns:
            bool: True if valid, raises ValidationError otherwise
        """
        platform = self.platform_settings.get('platform')
        
        # Check platform-specific minimum budgets
        if platform == 'LINKEDIN' and budget < LINKEDIN_MIN_BUDGET:
            raise ValueError(f'LinkedIn ad groups require minimum budget of ${LINKEDIN_MIN_BUDGET}')
        elif platform == 'GOOGLE' and budget < GOOGLE_MIN_BUDGET:
            raise ValueError(f'Google ad groups require minimum budget of ${GOOGLE_MIN_BUDGET}')

        # Validate budget precision
        if round(budget, 2) != budget:
            raise ValueError('Budget must have maximum 2 decimal places')

        return True

    def update_status(self, new_status: str) -> bool:
        """
        Update ad group status with platform synchronization.

        Args:
            new_status: New status to set

        Returns:
            bool: True if update successful
        """
        if new_status not in AD_GROUP_STATUSES:
            raise ValueError(f'Invalid status: {new_status}')

        # Validate status transition
        if not self.validate_status(new_status):
            raise ValueError(f'Invalid status transition from {self.status} to {new_status}')

        self.status = new_status
        self.update_timestamps()
        return True

    def to_platform_format(self) -> Dict[str, Any]:
        """
        Convert ad group data to platform-specific format.

        Returns:
            dict: Platform-specific ad group configuration
        """
        platform = self.platform_settings.get('platform')
        
        base_format = {
            'id': self.id,
            'name': self.name,
            'status': self.status,
            'budget': {
                'amount': str(round(self.budget, 2)),
                'currency': self.platform_settings.get('currency', 'USD')
            }
        }

        if platform == 'LINKEDIN':
            return {
                **base_format,
                'targeting': self.targeting_criteria,
                'format': self.ad_format,
                'linkedInSettings': self.platform_settings.get('linkedin_specific', {}),
                'tracking': self.platform_settings.get('tracking', {})
            }
        elif platform == 'GOOGLE':
            return {
                **base_format,
                'targetingSettings': self.targeting_criteria,
                'adFormat': self.ad_format,
                'googleSettings': self.platform_settings.get('google_specific', {}),
                'trackingTemplate': self.platform_settings.get('tracking_template')
            }
        else:
            raise ValueError(f'Unsupported platform: {platform}')

    def add_ad(self, ad_data: Dict[str, Any]) -> 'Ad':
        """
        Create and add a new ad to the group.

        Args:
            ad_data: Ad configuration data

        Returns:
            Ad: Newly created ad instance
        """
        from .ad import Ad  # Avoid circular import

        # Validate ad format compatibility
        if ad_data.get('format') != self.ad_format:
            raise ValueError(f'Ad format {ad_data.get("format")} does not match group format {self.ad_format}')

        # Create new ad instance
        new_ad = Ad(
            ad_group_id=self.id,
            **ad_data
        )

        self.ads.append(new_ad)
        self.update_timestamps()
        return new_ad