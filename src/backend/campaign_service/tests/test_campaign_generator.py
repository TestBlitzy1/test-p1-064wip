"""
Comprehensive test suite for the CampaignGeneratorService class.
Validates automated campaign generation, optimization, and validation functionality.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from freezegun import freeze_time
from typing import Dict, Any

from campaign_service.services.campaign_generator import (
    CampaignGeneratorService,
    SUPPORTED_PLATFORMS,
    MIN_BUDGET_PER_PLATFORM,
    GENERATION_TIMEOUT
)
from campaign_service.models.campaign import Campaign
from campaign_service.models.ad_group import AdGroup

# Test data constants
TEST_CAMPAIGN_NAME = "B2B SaaS Campaign Q4"
TEST_BUDGET = 5000.0
TEST_START_DATE = datetime(2024, 1, 1)
TEST_END_DATE = datetime(2024, 3, 31)

@pytest.mark.asyncio
class TestCampaignGeneratorService:
    """Test suite for CampaignGeneratorService functionality."""

    async def setup_method(self):
        """Initialize test environment and mock data."""
        # Mock AI generator and cache for testing
        self.ai_generator = self._mock_ai_generator()
        self.cache = self._mock_cache()
        
        # Initialize service
        self.service = CampaignGeneratorService(
            ai_generator=self.ai_generator,
            cache=self.cache
        )

        # Test campaign data
        self.test_campaign_data = {
            "campaign_name": TEST_CAMPAIGN_NAME,
            "budget": TEST_BUDGET,
            "objectives": {
                "primary_objective": "lead_generation",
                "format_preferences": {
                    "linkedin": ["SINGLE_IMAGE", "CAROUSEL"],
                    "google": ["RESPONSIVE_SEARCH", "DISPLAY"]
                }
            },
            "targeting_criteria": {
                "industries": ["Technology", "SaaS"],
                "company_size": ["50-200", "201-1000"],
                "job_titles": ["CTO", "IT Director"],
                "locations": ["United States", "Canada"]
            },
            "start_date": TEST_START_DATE,
            "end_date": TEST_END_DATE
        }

        # Platform-specific test data
        self.test_linkedin_formats = {
            "SINGLE_IMAGE": {"width": 1200, "height": 627},
            "CAROUSEL": {"card_count": 3},
            "VIDEO": {"duration": 30},
            "MESSAGE": {"text_limit": 500},
            "DYNAMIC": {"variants": 5}
        }

        self.test_google_formats = {
            "RESPONSIVE_SEARCH": {"headlines": 15, "descriptions": 4},
            "EXPANDED_TEXT": {"headline_limit": 30},
            "RESPONSIVE_DISPLAY": {"images": 5, "headlines": 5}
        }

    @pytest.mark.asyncio
    @freeze_time("2024-01-01")
    async def test_generate_campaign_linkedin(self):
        """Test LinkedIn campaign generation with performance validation."""
        platform = "linkedin"
        campaign_data = self.test_campaign_data.copy()
        campaign_data["platform"] = platform

        # Test campaign generation
        start_time = datetime.utcnow()
        campaign = await self.service.generate_campaign(**campaign_data)
        generation_time = (datetime.utcnow() - start_time).total_seconds()

        # Validate generation time
        assert generation_time < GENERATION_TIMEOUT, f"Campaign generation exceeded {GENERATION_TIMEOUT}s timeout"

        # Validate campaign structure
        assert isinstance(campaign, Campaign)
        assert campaign.name == TEST_CAMPAIGN_NAME
        assert campaign.platform_type == "LINKEDIN"
        assert campaign.total_budget == TEST_BUDGET
        assert campaign.start_date == TEST_START_DATE
        assert campaign.end_date == TEST_END_DATE

        # Validate targeting settings
        targeting = campaign.targeting_settings
        assert all(key in targeting for key in ["industries", "company_size", "job_titles"])
        assert len(targeting["industries"]) > 0
        assert len(targeting["job_titles"]) > 0

        # Validate ad formats
        platform_format = campaign.to_platform_format()
        assert "linkedInSettings" in platform_format
        assert any(format in str(platform_format) for format in self.test_linkedin_formats.keys())

        # Validate budget allocation
        assert campaign.total_budget >= MIN_BUDGET_PER_PLATFORM["linkedin"]
        for ad_group in campaign.ad_groups:
            assert ad_group.budget >= MIN_BUDGET_PER_PLATFORM["linkedin"]

    @pytest.mark.asyncio
    @freeze_time("2024-01-01")
    async def test_generate_campaign_google(self):
        """Test Google Ads campaign generation with performance validation."""
        platform = "google"
        campaign_data = self.test_campaign_data.copy()
        campaign_data["platform"] = platform

        # Test campaign generation
        start_time = datetime.utcnow()
        campaign = await self.service.generate_campaign(**campaign_data)
        generation_time = (datetime.utcnow() - start_time).total_seconds()

        # Validate generation time
        assert generation_time < GENERATION_TIMEOUT, f"Campaign generation exceeded {GENERATION_TIMEOUT}s timeout"

        # Validate campaign structure
        assert isinstance(campaign, Campaign)
        assert campaign.name == TEST_CAMPAIGN_NAME
        assert campaign.platform_type == "GOOGLE"
        assert campaign.total_budget == TEST_BUDGET
        assert campaign.start_date == TEST_START_DATE
        assert campaign.end_date == TEST_END_DATE

        # Validate targeting settings
        targeting = campaign.targeting_settings
        assert all(key in targeting for key in ["keywords", "locations"])
        assert len(targeting.get("keywords", [])) > 0

        # Validate ad formats
        platform_format = campaign.to_platform_format()
        assert "googleSettings" in platform_format
        assert any(format in str(platform_format) for format in self.test_google_formats.keys())

        # Validate budget allocation
        assert campaign.total_budget >= MIN_BUDGET_PER_PLATFORM["google"]
        for ad_group in campaign.ad_groups:
            assert ad_group.budget >= MIN_BUDGET_PER_PLATFORM["google"]

    async def test_validate_campaign(self):
        """Test campaign validation functionality."""
        # Test valid campaign
        valid_campaign = {
            "name": TEST_CAMPAIGN_NAME,
            "platform": "linkedin",
            "budget": TEST_BUDGET,
            "targeting_settings": self.test_campaign_data["targeting_criteria"],
            "ad_formats": ["SINGLE_IMAGE", "CAROUSEL"],
            "start_date": TEST_START_DATE,
            "end_date": TEST_END_DATE
        }

        is_valid, error_msg, details = await self.service.validate_campaign(valid_campaign)
        assert is_valid, f"Valid campaign validation failed: {error_msg}"

        # Test invalid budget
        invalid_budget_campaign = valid_campaign.copy()
        invalid_budget_campaign["budget"] = MIN_BUDGET_PER_PLATFORM["linkedin"] - 1
        is_valid, error_msg, _ = await self.service.validate_campaign(invalid_budget_campaign)
        assert not is_valid
        assert "budget" in error_msg.lower()

        # Test invalid targeting
        invalid_targeting_campaign = valid_campaign.copy()
        invalid_targeting_campaign["targeting_settings"] = {}
        is_valid, error_msg, _ = await self.service.validate_campaign(invalid_targeting_campaign)
        assert not is_valid
        assert "targeting" in error_msg.lower()

        # Test invalid date range
        invalid_date_campaign = valid_campaign.copy()
        invalid_date_campaign["end_date"] = TEST_START_DATE - timedelta(days=1)
        is_valid, error_msg, _ = await self.service.validate_campaign(invalid_date_campaign)
        assert not is_valid
        assert "date" in error_msg.lower()

    async def test_optimize_budget(self):
        """Test budget optimization functionality."""
        campaign_structure = {
            "platform": "linkedin",
            "total_budget": TEST_BUDGET,
            "ad_groups": [
                {"name": "Group 1", "format": "SINGLE_IMAGE"},
                {"name": "Group 2", "format": "CAROUSEL"},
                {"name": "Group 3", "format": "VIDEO"}
            ]
        }

        # Test budget optimization
        optimized = await self.service.optimize_budget(campaign_structure)
        
        # Validate total budget remains unchanged
        total_allocated = sum(group.get("budget", 0) for group in optimized["ad_groups"])
        assert abs(total_allocated - TEST_BUDGET) < 0.01

        # Validate minimum budgets
        for group in optimized["ad_groups"]:
            assert group["budget"] >= MIN_BUDGET_PER_PLATFORM["linkedin"]

        # Test budget distribution
        budgets = [group["budget"] for group in optimized["ad_groups"]]
        assert len(set(budgets)) > 1, "Budget optimization produced uniform distribution"

    def _mock_ai_generator(self):
        """Create mock AI generator for testing."""
        class MockAIGenerator:
            async def generate_campaign_structure(self, *args, **kwargs):
                return {"status": "success", "data": {}}
            
            async def validate_structure(self, *args, **kwargs):
                return True, "", {}
            
            async def optimize_budget_allocation(self, *args, **kwargs):
                return {"status": "success", "data": {}}
        
        return MockAIGenerator()

    def _mock_cache(self):
        """Create mock cache for testing."""
        class MockCache:
            async def get(self, key):
                return None
            
            async def set(self, key, value, expire=None):
                pass
        
        return MockCache()