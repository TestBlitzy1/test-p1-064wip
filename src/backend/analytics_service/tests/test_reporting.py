"""
Comprehensive test suite for analytics reporting service validating real-time analytics,
campaign performance metrics, trend analysis, and report scheduling functionality.
"""

import uuid
from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from freezegun import freeze_time

from analytics_service.services.reporting import ReportGenerator
from analytics_service.models.campaign_metrics import CampaignMetrics
from analytics_service.models.performance_data import PerformanceData

# Test configuration
TEST_CAMPAIGN_ID = uuid.uuid4()
TEST_PLATFORM = 'LINKEDIN'
PERFORMANCE_THRESHOLDS = {
    'response_time': 1.0,  # 1 second max
    'statistical_confidence': 0.95
}

@pytest.fixture
def mock_campaign_metrics():
    """Fixture providing test campaign metrics data."""
    return {
        'impressions': 100000,
        'clicks': 2500,
        'conversions': 75,
        'spend': Decimal('5000.00'),
        'revenue': Decimal('15000.00')
    }

@pytest.fixture
def mock_performance_data():
    """Fixture providing historical performance data."""
    data = {}
    base_date = datetime.utcnow() - timedelta(days=30)
    
    for day in range(30):
        date_key = (base_date + timedelta(days=day)).strftime('%Y-%m-%d')
        data[date_key] = {
            'impressions': 3500 + day * 100,
            'clicks': 85 + day * 3,
            'conversions': 3 + day,
            'spend': Decimal(str(180.00 + day * 5)),
            'revenue': Decimal(str(540.00 + day * 15))
        }
    return data

@pytest.fixture
async def report_generator():
    """Fixture providing configured report generator instance."""
    return ReportGenerator(
        db_session=None,  # Mock session would be injected here
        cache_manager=None,  # Mock cache would be injected here
        config={
            'platform': TEST_PLATFORM,
            'metrics_config': {
                'statistical_confidence': PERFORMANCE_THRESHOLDS['statistical_confidence']
            }
        }
    )

@pytest.mark.asyncio
class TestReportGenerator:
    """Comprehensive test suite for analytics reporting functionality."""

    async def test_create_campaign_report(self, report_generator, mock_campaign_metrics):
        """Test campaign report creation with performance validation."""
        start_time = datetime.utcnow()
        
        # Generate report
        report = await report_generator.create_report(
            campaign_id=TEST_CAMPAIGN_ID,
            report_config={
                'type': 'daily',
                'start_date': datetime.utcnow() - timedelta(days=7),
                'end_date': datetime.utcnow(),
                'platform': TEST_PLATFORM,
                'metrics': ['ctr', 'conversion_rate', 'roas']
            }
        )
        
        # Validate response time
        processing_time = (datetime.utcnow() - start_time).total_seconds()
        assert processing_time < PERFORMANCE_THRESHOLDS['response_time']
        
        # Validate report structure
        assert report['campaign_id'] == str(TEST_CAMPAIGN_ID)
        assert 'metrics' in report
        assert 'trends' in report
        assert 'statistical_significance' in report
        
        # Validate metrics calculations
        metrics = report['metrics']['summary']
        assert isinstance(metrics['ctr'], float)
        assert isinstance(metrics['conversion_rate'], float)
        assert isinstance(metrics['roas'], float)
        assert 0 <= metrics['ctr'] <= 100
        assert 0 <= metrics['conversion_rate'] <= 100
        assert metrics['roas'] >= 0

    async def test_performance_summary(self, report_generator, mock_performance_data):
        """Test performance summary generation with statistical validation."""
        # Initialize performance data
        perf_data = PerformanceData(
            campaign_id=TEST_CAMPAIGN_ID,
            platform=TEST_PLATFORM,
            initial_metrics=mock_performance_data[list(mock_performance_data.keys())[0]]
        )
        
        # Add historical data
        for date_key, metrics in mock_performance_data.items():
            perf_data.update_daily_metrics(
                date=datetime.strptime(date_key, '%Y-%m-%d'),
                metrics=metrics
            )
        
        # Generate performance summary
        summary = await report_generator._fetch_campaign_metrics(
            campaign_id=TEST_CAMPAIGN_ID,
            start_date=datetime.utcnow() - timedelta(days=30),
            end_date=datetime.utcnow()
        )
        
        # Validate statistical significance
        assert 'benchmarks' in summary
        assert summary['summary']['statistical_confidence'] >= PERFORMANCE_THRESHOLDS['statistical_confidence']
        
        # Validate metric aggregations
        daily_metrics = summary['daily_breakdown']
        assert len(daily_metrics) == 30
        assert all(isinstance(day_data['ctr'], float) for day_data in daily_metrics.values())
        assert all(isinstance(day_data['roas'], float) for day_data in daily_metrics.values())

    @freeze_time("2024-01-01 12:00:00")
    async def test_trend_analysis(self, report_generator, mock_performance_data):
        """Test performance trend analysis with time series data."""
        # Initialize with historical data
        perf_data = PerformanceData(
            campaign_id=TEST_CAMPAIGN_ID,
            platform=TEST_PLATFORM,
            initial_metrics=mock_performance_data[list(mock_performance_data.keys())[0]]
        )
        
        # Generate trend analysis
        trends = await report_generator._fetch_performance_trends(
            campaign_id=TEST_CAMPAIGN_ID,
            metrics=['ctr', 'conversion_rate', 'roas']
        )
        
        # Validate trend calculations
        for metric in ['ctr', 'conversion_rate', 'roas']:
            assert metric in trends
            trend_data = trends[metric]
            assert 'trend_direction' in trend_data
            assert 'forecast_next_value' in trend_data
            assert 'forecast_confidence' in trend_data
            assert 0 <= trend_data['forecast_confidence'] <= 1
            
            # Validate rolling averages
            assert len(trend_data['rolling_average']) > 0
            assert all(isinstance(val, float) for val in trend_data['rolling_average'])

    async def test_report_scheduling(self, report_generator):
        """Test report scheduling functionality with concurrency."""
        # Create multiple report schedules
        schedules = [
            {
                'frequency': 'daily',
                'time': '00:00',
                'metrics': ['ctr', 'conversion_rate']
            },
            {
                'frequency': 'weekly',
                'time': '01:00',
                'metrics': ['roas', 'cpc']
            }
        ]
        
        # Schedule reports concurrently
        schedule_tasks = []
        for schedule in schedules:
            task = report_generator.create_report(
                campaign_id=TEST_CAMPAIGN_ID,
                report_config={
                    'type': schedule['frequency'],
                    'start_date': datetime.utcnow(),
                    'end_date': datetime.utcnow() + timedelta(days=30),
                    'platform': TEST_PLATFORM,
                    'metrics': schedule['metrics']
                }
            )
            schedule_tasks.append(task)
        
        # Execute schedules concurrently
        results = await asyncio.gather(*schedule_tasks)
        
        # Validate schedule results
        assert len(results) == len(schedules)
        for result in results:
            assert result['campaign_id'] == str(TEST_CAMPAIGN_ID)
            assert 'metrics' in result
            assert 'metadata' in result
            assert result['metadata']['cache_ttl'] > 0

    async def test_edge_cases(self, report_generator):
        """Test edge cases and error handling scenarios."""
        # Test empty metrics
        with pytest.raises(ValueError):
            await report_generator.create_report(
                campaign_id=TEST_CAMPAIGN_ID,
                report_config={
                    'type': 'daily',
                    'start_date': datetime.utcnow(),
                    'end_date': datetime.utcnow(),
                    'platform': TEST_PLATFORM,
                    'metrics': []
                }
            )
        
        # Test invalid date range
        with pytest.raises(ValueError):
            await report_generator.create_report(
                campaign_id=TEST_CAMPAIGN_ID,
                report_config={
                    'type': 'daily',
                    'start_date': datetime.utcnow(),
                    'end_date': datetime.utcnow() - timedelta(days=1),
                    'platform': TEST_PLATFORM,
                    'metrics': ['ctr']
                }
            )
        
        # Test invalid metrics
        with pytest.raises(ValueError):
            await report_generator.create_report(
                campaign_id=TEST_CAMPAIGN_ID,
                report_config={
                    'type': 'daily',
                    'start_date': datetime.utcnow(),
                    'end_date': datetime.utcnow(),
                    'platform': TEST_PLATFORM,
                    'metrics': ['invalid_metric']
                }
            )