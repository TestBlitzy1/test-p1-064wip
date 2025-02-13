"""
Comprehensive test suite for analytics service aggregation functionality.
Tests real-time metrics calculation, platform-specific analytics, performance trend analysis,
caching mechanisms, and statistical validation.

Version: 1.0.0
"""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4
from freezegun import freeze_time  # freezegun ^1.2.0
import redis  # redis ^4.0.0
import numpy as np

from analytics_service.services.aggregation import MetricsAggregator
from analytics_service.models.campaign_metrics import CampaignMetrics
from analytics_service.models.performance_data import PerformanceData

@pytest.fixture
def metrics_aggregator():
    """Initialize metrics aggregator with test configuration."""
    cache_config = {
        'ttl': 3600,
        'host': 'localhost',
        'port': 6379,
        'db': 0
    }
    return MetricsAggregator(cache_config)

@pytest.fixture
def test_campaign_data():
    """Generate test campaign performance data."""
    return {
        'impressions': 10000,
        'clicks': 500,
        'conversions': 50,
        'spend': 1000.00,
        'revenue': 5000.00
    }

@pytest.fixture
def test_platform_data():
    """Generate platform-specific test data."""
    return {
        'LINKEDIN': {
            'impressions': 8000,
            'clicks': 400,
            'conversions': 40,
            'spend': 800.00,
            'revenue': 4000.00
        },
        'GOOGLE': {
            'impressions': 2000,
            'clicks': 100,
            'conversions': 10,
            'spend': 200.00,
            'revenue': 1000.00
        }
    }

class TestMetricsAggregator:
    """
    Comprehensive test suite for MetricsAggregator class functionality.
    Tests real-time processing, caching, and statistical validation.
    """

    def setup_method(self):
        """Set up test environment before each test."""
        self.campaign_id = uuid4()
        self.cache_config = {
            'ttl': 3600,
            'host': 'localhost',
            'port': 6379,
            'db': 0
        }
        self.aggregator = MetricsAggregator(self.cache_config)

    @pytest.mark.benchmark(group="analytics")
    def test_aggregate_campaign_metrics_real_time(self, benchmark, test_campaign_data):
        """Test real-time campaign metrics aggregation with performance benchmarks."""
        def aggregate_metrics():
            return self.aggregator.aggregate_campaign_metrics(
                campaign_id=self.campaign_id,
                time_period='daily',
                use_cache=False
            )

        # Benchmark the aggregation performance
        result = benchmark(aggregate_metrics)

        # Verify sub-second response time
        assert benchmark.stats.stats.mean < 1.0

        # Validate metric calculations
        assert 'metrics' in result
        metrics = result['metrics']
        assert isinstance(metrics['ctr'], float)
        assert isinstance(metrics['conversion_rate'], float)
        assert isinstance(metrics['roas'], float)

        # Verify statistical analysis
        assert 'statistical_analysis' in result
        stats = result['statistical_analysis']
        assert 'confidence_level' in stats
        assert stats['confidence_level'] == 0.95

    def test_platform_specific_calculations(self, test_platform_data):
        """Test platform-specific metrics calculations for LinkedIn and Google Ads."""
        # Test LinkedIn metrics
        linkedin_metrics = CampaignMetrics(
            campaign_id=self.campaign_id,
            platform='LINKEDIN',
            metrics_data=test_platform_data['LINKEDIN']
        )
        
        assert linkedin_metrics.ctr == Decimal('5.0000')  # 400/8000 * 100
        assert linkedin_metrics.conversion_rate == Decimal('10.0000')  # 40/400 * 100
        assert linkedin_metrics.roas == Decimal('5.0000')  # 4000/800

        # Test Google Ads metrics
        google_metrics = CampaignMetrics(
            campaign_id=self.campaign_id,
            platform='GOOGLE',
            metrics_data=test_platform_data['GOOGLE']
        )
        
        assert google_metrics.ctr == Decimal('5.0000')  # 100/2000 * 100
        assert google_metrics.conversion_rate == Decimal('10.0000')  # 10/100 * 100
        assert google_metrics.roas == Decimal('5.0000')  # 1000/200

    def test_performance_trend_analysis(self, test_campaign_data):
        """Test performance trend analysis with statistical validation."""
        # Generate time series data
        dates = [datetime.utcnow() - timedelta(days=i) for i in range(30)]
        
        for date in dates:
            self.aggregator.performance_metrics[self.campaign_id] = PerformanceData(
                campaign_id=self.campaign_id,
                platform='LINKEDIN',
                initial_metrics=test_campaign_data
            )

        # Test trend analysis
        trends = self.aggregator.analyze_performance_trends(
            campaign_id=self.campaign_id,
            metrics=['ctr', 'conversion_rate', 'roas'],
            time_period='30d'
        )

        assert 'trends' in trends
        assert all(metric in trends['trends'] for metric in ['ctr', 'conversion_rate', 'roas'])
        
        # Validate statistical significance
        for metric, data in trends['trends'].items():
            assert 'statistical_significance' in data
            assert 0 <= data['statistical_significance'] <= 1

    def test_caching_mechanism(self, test_campaign_data):
        """Test caching functionality with TTL validation."""
        # Test cache miss
        result1 = self.aggregator.aggregate_campaign_metrics(
            campaign_id=self.campaign_id,
            time_period='daily',
            use_cache=True
        )

        # Test cache hit
        result2 = self.aggregator.aggregate_campaign_metrics(
            campaign_id=self.campaign_id,
            time_period='daily',
            use_cache=True
        )

        assert result1 == result2

        # Test cache expiration
        with freeze_time(datetime.utcnow() + timedelta(hours=2)):
            result3 = self.aggregator.aggregate_campaign_metrics(
                campaign_id=self.campaign_id,
                time_period='daily',
                use_cache=True
            )
            assert result3 != result1

    def test_statistical_validation(self, test_campaign_data):
        """Test statistical significance and confidence intervals."""
        # Generate sample data with known distribution
        sample_size = 1000
        conversion_rates = np.random.normal(0.05, 0.01, sample_size)
        
        # Calculate confidence interval
        confidence_level = 0.95
        mean = np.mean(conversion_rates)
        std_error = np.std(conversion_rates) / np.sqrt(sample_size)
        z_score = 1.96  # 95% confidence level
        
        interval = self.aggregator._calculate_confidence_interval(mean, std_error)
        
        # Verify interval contains true mean
        assert interval[0] <= mean <= interval[1]
        
        # Verify statistical significance calculation
        significance = self.aggregator._calculate_statistical_significance(conversion_rates)
        assert 0 <= significance <= 1

    @pytest.mark.parametrize("time_period", ["daily", "weekly"])
    def test_time_period_aggregations(self, test_campaign_data, time_period):
        """Test different time period aggregations."""
        result = self.aggregator.aggregate_campaign_metrics(
            campaign_id=self.campaign_id,
            time_period=time_period,
            use_cache=False
        )
        
        assert result is not None
        assert 'metrics' in result
        assert 'statistical_analysis' in result

    def test_error_handling(self):
        """Test error handling for invalid inputs and edge cases."""
        with pytest.raises(ValueError):
            self.aggregator.aggregate_campaign_metrics(
                campaign_id=self.campaign_id,
                time_period='invalid',
                use_cache=False
            )

        with pytest.raises(ValueError):
            self.aggregator.analyze_performance_trends(
                campaign_id=self.campaign_id,
                metrics=['invalid_metric'],
                time_period='30d'
            )