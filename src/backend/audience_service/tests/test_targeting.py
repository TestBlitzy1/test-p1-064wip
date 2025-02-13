"""
Comprehensive test suite for the audience targeting service validating AI-powered segmentation,
targeting optimization, and platform compliance.

Version: 1.0.0
"""

import pytest
import pytest_asyncio  # v0.21.0
from unittest.mock import Mock, AsyncMock
from datetime import datetime
from typing import Dict, Any

from audience_service.services.targeting import TargetingService
from audience_service.models.targeting_rules import TargetingRule
from integration_service.adapters.linkedin_ads import LinkedInAdsAdapter
from integration_service.adapters.google_ads import GoogleAdsAdapter

# Test data constants
TEST_INDUSTRY_TARGETING = {
    'industries': ['software', 'it_services'],
    'include_subsidiaries': True
}

TEST_COMPANY_SIZE_TARGETING = {
    'sizes': ['201-500', '501-1000', '1001-5000']
}

TEST_JOB_TARGETING = {
    'functions': ['information_technology', 'engineering'],
    'seniority_levels': ['senior', 'manager', 'director']
}

TEST_LOCATION_TARGETING = {
    'locations': ['United States', 'Canada'],
    'exclude_locations': []
}

@pytest.fixture
def linkedin_adapter():
    """Fixture for mocked LinkedIn adapter."""
    adapter = AsyncMock(spec=LinkedInAdsAdapter)
    adapter.validate_campaign.return_value = (True, [], {'audience_size': 50000})
    return adapter

@pytest.fixture
def google_adapter():
    """Fixture for mocked Google adapter."""
    adapter = AsyncMock(spec=GoogleAdsAdapter)
    adapter.validate_campaign_settings.return_value = (True, [], {'reach': 75000})
    return adapter

@pytest.fixture
def targeting_service(linkedin_adapter, google_adapter):
    """Fixture for initialized targeting service."""
    return TargetingService(linkedin_adapter, google_adapter)

@pytest.mark.asyncio
class TestTargetingService:
    """
    Comprehensive test suite for validating TargetingService functionality including
    AI segmentation, optimization, and platform compliance.
    """

    async def test_create_targeting_rule_valid(self, targeting_service):
        """Test successful creation of targeting rule with AI optimization."""
        # Arrange
        targeting_data = {
            'rule_type': 'industry',
            'criteria': TEST_INDUSTRY_TARGETING,
            'weight': 1.0,
            'platform': 'linkedin'
        }

        # Act
        rule = await targeting_service.create_targeting_rule(
            rule_type=targeting_data['rule_type'],
            criteria=targeting_data['criteria'],
            weight=targeting_data['weight'],
            platform=targeting_data['platform']
        )

        # Assert
        assert rule is not None
        assert rule.rule_type == 'industry'
        assert rule.weight == 1.0
        assert all(ind in rule.criteria['industries'] 
                  for ind in TEST_INDUSTRY_TARGETING['industries'])
        assert rule.criteria['include_subsidiaries'] is True

    async def test_create_targeting_rule_invalid_platform(self, targeting_service):
        """Test targeting rule creation with invalid platform."""
        # Arrange
        invalid_platform = 'unsupported_platform'

        # Act & Assert
        with pytest.raises(ValueError, match=f"Unsupported platform: {invalid_platform}"):
            await targeting_service.create_targeting_rule(
                rule_type='industry',
                criteria=TEST_INDUSTRY_TARGETING,
                platform=invalid_platform
            )

    async def test_apply_targeting_rules_success(self, targeting_service):
        """Test successful application of multiple targeting rules."""
        # Arrange
        rules = [
            TargetingRule(
                rule_type='industry',
                criteria=TEST_INDUSTRY_TARGETING,
                operator='IN'
            ),
            TargetingRule(
                rule_type='company_size',
                criteria=TEST_COMPANY_SIZE_TARGETING,
                operator='IN'
            )
        ]
        
        segment = Mock()
        segment.id = 'test_segment_id'
        segment.calculate_reach.return_value = {
            'total_reach': 50000,
            'confidence_score': 0.85
        }

        # Act
        result = await targeting_service.apply_targeting_rules(segment, rules)

        # Assert
        assert result is not None
        assert result.id == 'test_segment_id'
        segment.add_targeting_rule.assert_called()
        segment.calculate_reach.assert_called_once()

    async def test_apply_targeting_rules_audience_too_small(self, targeting_service):
        """Test targeting rules application with insufficient audience size."""
        # Arrange
        rules = [
            TargetingRule(
                rule_type='industry',
                criteria=TEST_INDUSTRY_TARGETING,
                operator='IN'
            )
        ]
        
        segment = Mock()
        segment.calculate_reach.return_value = {
            'total_reach': 500,  # Below minimum threshold
            'confidence_score': 0.9
        }

        # Act & Assert
        with pytest.raises(ValueError, match="Audience size below minimum threshold"):
            await targeting_service.apply_targeting_rules(segment, rules)

    async def test_validate_platform_targeting_linkedin(self, targeting_service):
        """Test LinkedIn-specific targeting validation."""
        # Arrange
        rules = [
            TargetingRule(
                rule_type='industry',
                criteria=TEST_INDUSTRY_TARGETING,
                operator='IN'
            ),
            TargetingRule(
                rule_type='job_function',
                criteria=TEST_JOB_TARGETING,
                operator='IN'
            )
        ]

        # Act
        is_valid, errors, metadata = await targeting_service.validate_platform_targeting(
            rules, 'linkedin'
        )

        # Assert
        assert is_valid is True
        assert len(errors) == 0
        assert 'audience_size' in metadata

    async def test_validate_platform_targeting_google(self, targeting_service):
        """Test Google Ads-specific targeting validation."""
        # Arrange
        rules = [
            TargetingRule(
                rule_type='industry',
                criteria=TEST_INDUSTRY_TARGETING,
                operator='IN'
            ),
            TargetingRule(
                rule_type='location',
                criteria=TEST_LOCATION_TARGETING,
                operator='IN'
            )
        ]

        # Act
        is_valid, errors, metadata = await targeting_service.validate_platform_targeting(
            rules, 'google'
        )

        # Assert
        assert is_valid is True
        assert len(errors) == 0
        assert 'reach' in metadata

    async def test_optimize_targeting_performance(self, targeting_service):
        """Test AI-powered targeting optimization with performance data."""
        # Arrange
        rules = [
            TargetingRule(
                rule_type='industry',
                criteria=TEST_INDUSTRY_TARGETING,
                operator='IN'
            )
        ]
        
        performance_data = {
            'impressions': 100000,
            'clicks': 2500,
            'conversions': 125,
            'ctr': 0.025,
            'conversion_rate': 0.05
        }

        # Act
        optimized_rules = await targeting_service.optimize_targeting(
            rules,
            performance_data,
            'linkedin'
        )

        # Assert
        assert len(optimized_rules) == len(rules)
        assert optimized_rules[0].weight != rules[0].weight
        assert 'industries' in optimized_rules[0].criteria

    async def test_targeting_rule_conflicts(self, targeting_service):
        """Test detection of conflicting targeting rules."""
        # Arrange
        conflicting_rules = [
            TargetingRule(
                rule_type='job_function',
                criteria={'functions': ['engineering']},
                operator='IN'
            ),
            TargetingRule(
                rule_type='job_function',
                criteria={'functions': ['sales']},
                operator='IN'
            )
        ]

        # Act & Assert
        with pytest.raises(ValueError, match="Duplicate targeting rule types detected"):
            await targeting_service.apply_targeting_rules(Mock(), conflicting_rules)

    async def test_targeting_validation_with_empty_rules(self, targeting_service):
        """Test targeting validation with empty rule set."""
        # Act
        is_valid, errors, metadata = await targeting_service.validate_platform_targeting(
            [], 'linkedin'
        )

        # Assert
        assert is_valid is True
        assert len(errors) == 0
        assert metadata == {}