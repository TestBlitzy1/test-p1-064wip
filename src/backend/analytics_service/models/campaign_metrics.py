"""
Campaign metrics model providing comprehensive performance tracking and analytics calculations
with high-precision financial metrics for advertising campaigns.
"""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any
from uuid import UUID

from pydantic import Field  # pydantic 2.0.0

from common.schemas.base import BaseSchema

# Supported ad platforms
SUPPORTED_PLATFORMS = ['LINKEDIN', 'GOOGLE']

# Precision settings for financial calculations
FINANCIAL_PRECISION = Decimal('0.000001')
PERCENTAGE_PRECISION = Decimal('0.0001')

# Validation thresholds
MAX_CTR = Decimal('100.0')
MAX_CONVERSION_RATE = Decimal('100.0')
MIN_ROAS = Decimal('0.0')


@dataclass
class CampaignMetrics:
    """
    Core class for tracking and calculating campaign performance metrics with 
    high-precision financial calculations.
    """

    def __init__(self, campaign_id: UUID, platform: str, metrics_data: Dict[str, Any]) -> None:
        """
        Initialize campaign metrics with validation and initial calculations.

        Args:
            campaign_id: Unique identifier for the campaign
            platform: Advertising platform (LINKEDIN or GOOGLE)
            metrics_data: Raw metrics data dictionary

        Raises:
            ValueError: If validation fails
        """
        # Validate inputs using schema
        schema = CampaignMetricsSchema()
        if not schema.validate_metrics(metrics_data):
            raise ValueError("Invalid metrics data")

        # Initialize base attributes
        self.campaign_id = campaign_id
        self.platform = platform.upper()
        if self.platform not in SUPPORTED_PLATFORMS:
            raise ValueError(f"Unsupported platform: {platform}")

        # Initialize base metrics
        self.impressions = int(metrics_data['impressions'])
        self.clicks = int(metrics_data['clicks'])
        self.conversions = int(metrics_data['conversions'])
        
        # Initialize financial metrics with high precision
        self.spend = Decimal(str(metrics_data['spend'])).quantize(FINANCIAL_PRECISION)
        self.revenue = Decimal(str(metrics_data['revenue'])).quantize(FINANCIAL_PRECISION)

        # Calculate derived metrics
        self.ctr = self.calculate_ctr()
        self.conversion_rate = self.calculate_conversion_rate()
        self.cpc = self.calculate_cpc()
        self.roas = self.calculate_roas()

        # Set timestamp
        self.timestamp = datetime.utcnow()

    def calculate_ctr(self) -> Decimal:
        """
        Calculate Click-Through Rate with high precision.

        Returns:
            Decimal: CTR as percentage with 4 decimal precision

        Raises:
            ValueError: If impressions is zero
        """
        if self.impressions <= 0:
            raise ValueError("Impressions must be greater than zero")

        ctr = (Decimal(self.clicks) / Decimal(self.impressions)) * Decimal('100')
        ctr = ctr.quantize(PERCENTAGE_PRECISION, rounding=ROUND_HALF_UP)

        if ctr > MAX_CTR:
            raise ValueError(f"CTR exceeds maximum allowed value: {ctr}")

        return ctr

    def calculate_conversion_rate(self) -> Decimal:
        """
        Calculate Conversion Rate with validation.

        Returns:
            Decimal: Conversion rate as percentage with 4 decimal precision

        Raises:
            ValueError: If clicks is zero
        """
        if self.clicks <= 0:
            raise ValueError("Clicks must be greater than zero")

        conv_rate = (Decimal(self.conversions) / Decimal(self.clicks)) * Decimal('100')
        conv_rate = conv_rate.quantize(PERCENTAGE_PRECISION, rounding=ROUND_HALF_UP)

        if conv_rate > MAX_CONVERSION_RATE:
            raise ValueError(f"Conversion rate exceeds maximum allowed value: {conv_rate}")

        return conv_rate

    def calculate_cpc(self) -> Decimal:
        """
        Calculate Cost Per Click with financial precision.

        Returns:
            Decimal: CPC value with 6 decimal precision

        Raises:
            ValueError: If clicks is zero
        """
        if self.clicks <= 0:
            raise ValueError("Clicks must be greater than zero")

        cpc = self.spend / Decimal(self.clicks)
        return cpc.quantize(FINANCIAL_PRECISION, rounding=ROUND_HALF_UP)

    def calculate_roas(self) -> Decimal:
        """
        Calculate Return on Ad Spend with financial precision.

        Returns:
            Decimal: ROAS multiplier with 4 decimal precision

        Raises:
            ValueError: If spend is zero
        """
        if self.spend <= 0:
            raise ValueError("Spend must be greater than zero")

        roas = self.revenue / self.spend
        roas = roas.quantize(PERCENTAGE_PRECISION, rounding=ROUND_HALF_UP)

        if roas < MIN_ROAS:
            raise ValueError(f"ROAS cannot be negative: {roas}")

        return roas

    def update_metrics(self, new_metrics: Dict[str, Any]) -> bool:
        """
        Update metrics with new data and recalculate derived metrics.

        Args:
            new_metrics: Dictionary containing updated metric values

        Returns:
            bool: True if update successful

        Raises:
            ValueError: If validation fails
        """
        # Validate new metrics
        schema = CampaignMetricsSchema()
        if not schema.validate_metrics(new_metrics):
            raise ValueError("Invalid update metrics data")

        # Update base metrics
        self.impressions = int(new_metrics['impressions'])
        self.clicks = int(new_metrics['clicks'])
        self.conversions = int(new_metrics['conversions'])
        self.spend = Decimal(str(new_metrics['spend'])).quantize(FINANCIAL_PRECISION)
        self.revenue = Decimal(str(new_metrics['revenue'])).quantize(FINANCIAL_PRECISION)

        # Recalculate derived metrics
        self.ctr = self.calculate_ctr()
        self.conversion_rate = self.calculate_conversion_rate()
        self.cpc = self.calculate_cpc()
        self.roas = self.calculate_roas()

        # Update timestamp
        self.timestamp = datetime.utcnow()

        return True


class CampaignMetricsSchema(BaseSchema):
    """
    Pydantic schema for comprehensive campaign metrics validation.
    """

    class Config:
        arbitrary_types_allowed = True

    campaign_id: UUID = Field(...)
    platform: str = Field(...)
    metrics_data: Dict[str, Any] = Field(...)

    def validate_metrics(self, data: Dict[str, Any]) -> bool:
        """
        Validate campaign metrics data with comprehensive checks.

        Args:
            data: Metrics data dictionary to validate

        Returns:
            bool: True if validation successful

        Raises:
            ValueError: If validation fails
        """
        required_fields = {'impressions', 'clicks', 'conversions', 'spend', 'revenue'}
        if not all(field in data for field in required_fields):
            raise ValueError("Missing required metrics fields")

        # Validate numeric values
        if any(int(data[field]) < 0 for field in ['impressions', 'clicks', 'conversions']):
            raise ValueError("Metrics cannot be negative")

        # Validate financial values
        if any(Decimal(str(data[field])) < 0 for field in ['spend', 'revenue']):
            raise ValueError("Financial metrics cannot be negative")

        # Validate metrics relationships
        if int(data['clicks']) > int(data['impressions']):
            raise ValueError("Clicks cannot exceed impressions")
        if int(data['conversions']) > int(data['clicks']):
            raise ValueError("Conversions cannot exceed clicks")

        return True