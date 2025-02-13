"""
Comprehensive test suite for the audience segmentation service with enhanced platform validation
and error handling capabilities.

Version: 1.0.0
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from freezegun import freeze_time  # v1.2.0

from audience_service.services.segmentation import SegmentationService
from audience_service.models.audience_segment import AudienceSegment
from common.database.session import get_session

@pytest.mark.usefixtures('db_session')
class TestSegmentationService:
    """
    Comprehensive test suite for the SegmentationService class with enhanced platform validation
    and error handling.
    """

    def setup_method(self):
        """Initialize test fixtures and mock data."""
        # Initialize test segment data
        self.valid_segment_data = {
            'name': 'Enterprise B2B Segment',
            'description': 'Test segment for enterprise B2B marketers',
            'targeting_criteria': {
                'industries': ['Technology', 'SaaS', 'Cloud Services'],
                'company_size': {'min': 50, 'max': 1000},
                'job_titles': ['Marketing Manager', 'Digital Marketing Director', 'CMO'],
                'locations': ['United States', 'Canada', 'United Kingdom'],
                'seniority': ['Manager', 'Director', 'C-Level'],
                'interests': ['B2B Marketing', 'Enterprise Software']
            }
        }

        # Platform-specific constraints
        self.platform_constraints = {
            'linkedin': {
                'max_targeting_facets': 5,
                'min_audience_size': 1000,
                'max_audience_size': 1000000
            },
            'google_ads': {
                'max_targeting_criteria': 10,
                'min_audience_size': 500,
                'max_audience_size': 500000
            }
        }

        # Performance metrics for optimization tests
        self.performance_metrics = {
            'ctr': 2.4,
            'conversion_rate': 3.1,
            'cost_per_conversion': 45.0,
            'roas': 3.8,
            'engagement_rate': 4.2,
            'quality_score': 8
        }

        # Initialize service with cache config
        self.cache_config = {'host': 'localhost', 'port': 6379}
        self.service = SegmentationService(self.cache_config)

    @pytest.mark.asyncio
    async def test_create_segment_success(self, mock_db_session):
        """Test successful creation of audience segment with platform validation."""
        # Setup platform settings
        platform_settings = {
            'platform': 'linkedin',
            'platform_rules': self.platform_constraints['linkedin']
        }

        # Mock reach calculation
        reach_data = {
            'total_reach': 50000,
            'confidence_score': 0.85,
            'platform_reach': {'linkedin': 50000}
        }

        with patch.object(AudienceSegment, 'calculate_reach', return_value=reach_data):
            # Create segment
            segment = await self.service.create_segment(
                self.valid_segment_data,
                platform_settings
            )

            # Verify segment creation
            assert segment.name == self.valid_segment_data['name']
            assert segment.targeting_criteria == self.valid_segment_data['targeting_criteria']
            assert segment.estimated_reach == reach_data['total_reach']
            assert segment.confidence_score == reach_data['confidence_score']

            # Verify platform validation was called
            mock_db_session.add.assert_called_once()
            mock_db_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_segment_platform_validation(self, mock_db_session):
        """Test segment creation with platform-specific validation rules."""
        # Test LinkedIn platform constraints
        linkedin_settings = {
            'platform': 'linkedin',
            'platform_rules': self.platform_constraints['linkedin']
        }

        # Add excessive targeting criteria to trigger validation error
        invalid_data = self.valid_segment_data.copy()
        invalid_data['targeting_criteria']['industries'].extend([
            f'Industry_{i}' for i in range(25)
        ])

        with pytest.raises(ValueError) as exc_info:
            await self.service.create_segment(invalid_data, linkedin_settings)
        assert "Number of industries exceeds maximum" in str(exc_info.value)

        # Test Google Ads platform constraints
        google_settings = {
            'platform': 'google_ads',
            'platform_rules': self.platform_constraints['google_ads']
        }

        # Test audience size validation
        with patch.object(AudienceSegment, 'calculate_reach', 
                         return_value={'total_reach': 100}):
            with pytest.raises(ValueError) as exc_info:
                await self.service.create_segment(
                    self.valid_segment_data,
                    google_settings
                )
            assert "Audience size below minimum threshold" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_optimize_targeting_with_performance(self, mock_db_session):
        """Test targeting optimization with historical performance data."""
        segment_id = "test-segment-id"
        optimization_config = {
            'platform': 'linkedin',
            'optimization_goals': {
                'primary': 'conversion_rate',
                'secondary': 'roas'
            },
            'constraints': self.platform_constraints['linkedin']
        }

        # Mock existing segment
        mock_segment = MagicMock()
        mock_segment.targeting_criteria = self.valid_segment_data['targeting_criteria']
        mock_db_session.query().filter_by().first.return_value = mock_segment

        # Test optimization
        result = await self.service.optimize_targeting(
            segment_id,
            self.performance_metrics,
            optimization_config
        )

        # Verify optimization results
        assert 'optimized_targeting' in result
        assert 'predicted_performance' in result
        assert 'estimated_reach' in result

        # Verify targeting rules still meet platform constraints
        optimized_targeting = result['optimized_targeting']
        assert len(optimized_targeting['industries']) <= self.platform_constraints['linkedin']['max_targeting_facets']
        assert len(optimized_targeting['job_titles']) <= 100

        # Verify performance predictions
        predictions = result['predicted_performance']
        assert predictions['conversion_rate'] > self.performance_metrics['conversion_rate']
        assert predictions['roas'] >= self.performance_metrics['roas']

    @pytest.mark.asyncio
    async def test_audience_size_calculation_with_constraints(self, mock_db_session):
        """Test audience size calculation with platform limitations."""
        targeting_criteria = self.valid_segment_data['targeting_criteria']

        # Test LinkedIn audience size calculation
        linkedin_settings = {
            'platform': 'linkedin',
            'platform_rules': self.platform_constraints['linkedin']
        }

        linkedin_result = await self.service.calculate_audience_size(
            targeting_criteria,
            linkedin_settings
        )

        assert linkedin_result['total_reach'] >= self.platform_constraints['linkedin']['min_audience_size']
        assert linkedin_result['total_reach'] <= self.platform_constraints['linkedin']['max_audience_size']
        assert 'confidence_intervals' in linkedin_result
        assert 'confidence_score' in linkedin_result

        # Test Google Ads audience size calculation
        google_settings = {
            'platform': 'google_ads',
            'platform_rules': self.platform_constraints['google_ads']
        }

        google_result = await self.service.calculate_audience_size(
            targeting_criteria,
            google_settings
        )

        assert google_result['total_reach'] >= self.platform_constraints['google_ads']['min_audience_size']
        assert google_result['total_reach'] <= self.platform_constraints['google_ads']['max_audience_size']
        assert 'breakdown' in google_result
        assert 'seasonal_adjustment' in google_result['breakdown']

    @pytest.mark.asyncio
    async def test_segment_validation_error_handling(self, mock_db_session):
        """Test error handling for segment validation failures."""
        # Test missing required fields
        invalid_data = {
            'name': 'Invalid Segment',
            'targeting_criteria': {}
        }

        platform_settings = {
            'platform': 'linkedin',
            'platform_rules': self.platform_constraints['linkedin']
        }

        with pytest.raises(ValueError) as exc_info:
            await self.service.create_segment(invalid_data, platform_settings)
        assert "Missing required targeting criteria" in str(exc_info.value)

        # Test invalid targeting combinations
        invalid_targeting = self.valid_segment_data.copy()
        invalid_targeting['targeting_criteria']['seniority'] = ['Invalid Level']

        with pytest.raises(ValueError) as exc_info:
            await self.service.create_segment(invalid_targeting, platform_settings)
        assert "Invalid seniority level" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_segment_performance_optimization(self, mock_db_session):
        """Test segment performance optimization with ML-based recommendations."""
        segment_id = "test-segment-id"
        
        # Mock historical performance data
        historical_performance = {
            'metrics': self.performance_metrics,
            'targeting_effectiveness': {
                'industry': 0.8,
                'job_title': 0.7,
                'company_size': 0.9
            }
        }

        optimization_config = {
            'platform': 'linkedin',
            'optimization_goals': {
                'primary': 'conversion_rate',
                'secondary': 'roas'
            },
            'constraints': self.platform_constraints['linkedin']
        }

        # Mock existing segment
        mock_segment = MagicMock()
        mock_segment.targeting_criteria = self.valid_segment_data['targeting_criteria']
        mock_db_session.query().filter_by().first.return_value = mock_segment

        with patch.object(self.service, '_analyze_performance_metrics',
                         return_value=historical_performance):
            result = await self.service.optimize_targeting(
                segment_id,
                self.performance_metrics,
                optimization_config
            )

            # Verify ML-based optimization results
            assert result['optimized_targeting']['industries']
            assert result['predicted_performance']['conversion_rate']
            assert result['confidence_score'] >= 0.7

            # Verify targeting effectiveness improvements
            for metric in result['targeting_effectiveness'].values():
                assert metric >= 0.7