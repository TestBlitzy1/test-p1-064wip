"""
Test suite for the CampaignManager service validating campaign lifecycle management
including creation, updates, performance tracking, and status management.

Version: 1.0.0
"""

import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from freezegun import freeze_time
import json

from campaign_service.services.campaign_manager import CampaignManager, CAMPAIGN_STATUSES
from campaign_service.models.campaign import Campaign
from campaign_service.services.campaign_generator import CampaignGeneratorService
from integration_service.services.platform_manager import PlatformManager

# Test Constants
TEST_CAMPAIGN_NAME = "Test B2B Campaign"
TEST_PLATFORMS = ["linkedin", "google"]
TEST_BUDGET = 1000.0
TEST_START_DATE = datetime.utcnow() + timedelta(days=1)
TEST_END_DATE = TEST_START_DATE + timedelta(days=30)

@pytest.fixture
def mock_cache():
    """Fixture providing a mock cache service."""
    return Mock(
        get=AsyncMock(return_value=None),
        set=AsyncMock(return_value=True)
    )

@pytest_asyncio.fixture
async def campaign_manager():
    """Fixture providing a configured CampaignManager instance with mocked dependencies."""
    # Mock AI generator service
    generator_service = Mock(spec=CampaignGeneratorService)
    generator_service.generate_campaign = AsyncMock(return_value={
        "structure": "test_structure",
        "platform_settings": {
            "linkedin": {"campaign_id": "li_123"},
            "google": {"campaign_id": "ga_123"}
        }
    })
    generator_service.validate_campaign = AsyncMock(return_value=(True, "", {}))

    # Mock platform manager
    platform_manager = Mock(spec=PlatformManager)
    platform_manager.create_campaign = AsyncMock(return_value={
        "results": {
            "linkedin": {"status": "success", "campaign_id": "li_123"},
            "google": {"status": "success", "campaign_id": "ga_123"}
        }
    })

    # Create campaign manager instance
    manager = CampaignManager(
        generator_service=generator_service,
        platform_manager=platform_manager,
        cache_service=mock_cache()
    )
    
    return manager

@pytest_asyncio.fixture
async def mock_campaign():
    """Fixture providing a mock Campaign instance with test data."""
    return Campaign(
        name=TEST_CAMPAIGN_NAME,
        description="Test campaign description",
        platform_type="LINKEDIN",
        total_budget=TEST_BUDGET,
        start_date=TEST_START_DATE,
        end_date=TEST_END_DATE,
        targeting_settings={
            "industries": ["Technology", "SaaS"],
            "company_size": ["50-200", "201-500"],
            "job_titles": ["CTO", "VP Engineering"]
        },
        platform_settings={
            "linkedin": {
                "campaign_id": "li_123",
                "format": "SINGLE_IMAGE"
            }
        }
    )

@pytest.mark.asyncio
@pytest.mark.timeout(35)  # Enforce 30-second timeout requirement
async def test_create_campaign(campaign_manager, benchmark):
    """
    Test campaign creation with performance benchmarking and validation.
    Validates F-001-RQ-001: Generate campaign structure within 30 seconds.
    """
    targeting_settings = {
        "industries": ["Technology", "SaaS"],
        "company_size": ["50-200", "201-500"],
        "job_titles": ["CTO", "VP Engineering"]
    }

    # Benchmark campaign creation
    result = await benchmark(
        campaign_manager.create_campaign,
        name=TEST_CAMPAIGN_NAME,
        description="Test campaign description",
        platforms=TEST_PLATFORMS,
        total_budget=TEST_BUDGET,
        targeting_settings=targeting_settings,
        start_date=TEST_START_DATE,
        end_date=TEST_END_DATE
    )

    # Validate campaign structure
    assert result is not None
    assert result.name == TEST_CAMPAIGN_NAME
    assert result.total_budget == TEST_BUDGET
    assert result.platform_settings is not None
    
    # Validate platform-specific settings
    assert "linkedin" in result.platform_settings
    assert "google" in result.platform_settings
    assert result.platform_settings["linkedin"]["campaign_id"] == "li_123"
    assert result.platform_settings["google"]["campaign_id"] == "ga_123"

    # Validate generation time
    assert benchmark.stats.stats.mean < 30.0, "Campaign generation exceeded 30-second limit"

@pytest.mark.asyncio
async def test_update_campaign_status(campaign_manager, mock_campaign):
    """Test campaign status updates with validation."""
    new_status = "ACTIVE"
    
    # Update campaign status
    result = await campaign_manager.update_campaign_status(
        campaign_id=mock_campaign.id,
        new_status=new_status
    )

    assert result is True
    assert mock_campaign.status == new_status

    # Test invalid status transition
    with pytest.raises(ValueError):
        await campaign_manager.update_campaign_status(
            campaign_id=mock_campaign.id,
            new_status="INVALID_STATUS"
        )

@pytest.mark.asyncio
async def test_get_campaign_performance(campaign_manager, mock_campaign):
    """Test campaign performance metrics retrieval and validation."""
    metrics_config = {
        "metrics": ["impressions", "clicks", "conversions"],
        "date_range": {
            "start_date": TEST_START_DATE.isoformat(),
            "end_date": TEST_END_DATE.isoformat()
        }
    }

    # Mock performance data
    mock_performance = {
        "impressions": 10000,
        "clicks": 500,
        "conversions": 50,
        "ctr": 0.05,
        "conversion_rate": 0.10
    }
    campaign_manager._platform_manager.get_campaign_performance = AsyncMock(
        return_value=mock_performance
    )

    # Get performance metrics
    result = await campaign_manager.get_campaign_performance(
        campaign_id=mock_campaign.id,
        metrics_config=metrics_config
    )

    assert result is not None
    assert "impressions" in result
    assert "clicks" in result
    assert "conversions" in result
    assert result["impressions"] == 10000
    assert result["clicks"] == 500
    assert result["conversions"] == 50

@pytest.mark.asyncio
async def test_campaign_creation_error_handling(campaign_manager):
    """Test error handling during campaign creation."""
    # Mock generator service to raise an error
    campaign_manager._generator_service.generate_campaign = AsyncMock(
        side_effect=ValueError("Invalid campaign configuration")
    )

    with pytest.raises(ValueError) as exc_info:
        await campaign_manager.create_campaign(
            name=TEST_CAMPAIGN_NAME,
            description="Test campaign description",
            platforms=TEST_PLATFORMS,
            total_budget=TEST_BUDGET,
            targeting_settings={},
            start_date=TEST_START_DATE,
            end_date=TEST_END_DATE
        )

    assert "Invalid campaign configuration" in str(exc_info.value)

@pytest.mark.asyncio
async def test_campaign_format_support(campaign_manager):
    """
    Test support for multiple ad formats.
    Validates F-001-RQ-002: Support for all LinkedIn/Google formats.
    """
    linkedin_formats = ["SINGLE_IMAGE", "CAROUSEL", "VIDEO", "MESSAGE", "DYNAMIC"]
    google_formats = ["RESPONSIVE_SEARCH", "EXPANDED_TEXT", "RESPONSIVE_DISPLAY"]

    for platform, formats in [("linkedin", linkedin_formats), ("google", google_formats)]:
        for ad_format in formats:
            result = await campaign_manager.create_campaign(
                name=f"Test {ad_format} Campaign",
                description=f"Test {ad_format} campaign",
                platforms=[platform],
                total_budget=TEST_BUDGET,
                targeting_settings={
                    "format": ad_format,
                    "platform_specific": {}
                },
                start_date=TEST_START_DATE,
                end_date=TEST_END_DATE
            )

            assert result is not None
            assert result.platform_settings[platform]["format"] == ad_format

@pytest.mark.asyncio
async def test_campaign_cache_handling(campaign_manager, mock_cache):
    """Test campaign cache functionality."""
    # Test cache miss
    mock_cache.get.return_value = None
    
    result = await campaign_manager.create_campaign(
        name=TEST_CAMPAIGN_NAME,
        description="Test campaign description",
        platforms=TEST_PLATFORMS,
        total_budget=TEST_BUDGET,
        targeting_settings={},
        start_date=TEST_START_DATE,
        end_date=TEST_END_DATE
    )

    assert result is not None
    mock_cache.set.assert_called_once()

    # Test cache hit
    mock_cache.get.return_value = result.to_dict()
    cached_result = await campaign_manager.create_campaign(
        name=TEST_CAMPAIGN_NAME,
        description="Test campaign description",
        platforms=TEST_PLATFORMS,
        total_budget=TEST_BUDGET,
        targeting_settings={},
        start_date=TEST_START_DATE,
        end_date=TEST_END_DATE
    )

    assert cached_result is not None
    assert cached_result.id == result.id