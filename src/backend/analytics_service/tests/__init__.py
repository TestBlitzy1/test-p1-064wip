"""
Analytics service test initialization module providing comprehensive test environment setup,
fixtures, and utilities for real-time analytics testing and performance validation.

Version: 1.0.0
"""

import os
import pytest
from datetime import datetime, timedelta
from typing import Dict, Any, Generator
from uuid import uuid4

from analytics_service.services.aggregation import MetricsAggregator
from analytics_service.models.campaign_metrics import CampaignMetrics

# Test environment configuration
TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL', 'postgresql://test:test@localhost:5432/analytics_test')
TEST_REDIS_URL = os.getenv('TEST_REDIS_URL', 'redis://localhost:6379/1')
TEST_METRICS_CONFIG = {
    "aggregation_interval": 60,
    "batch_size": 1000,
    "cache_ttl": 3600
}

def pytest_configure(config: Dict[str, Any]) -> None:
    """
    Configure pytest environment for analytics service tests with comprehensive setup.

    Args:
        config: Pytest configuration dictionary

    Raises:
        RuntimeError: If test environment setup fails
    """
    # Register custom markers for analytics tests
    config.addinivalue_line(
        "markers",
        "real_time: mark test as real-time analytics test"
    )
    config.addinivalue_line(
        "markers",
        "performance: mark test as performance validation test"
    )
    config.addinivalue_line(
        "markers",
        "integration: mark test as integration test"
    )

    # Configure test timeouts
    config.addinivalue_line(
        "timeout",
        "default_timeout = 60"  # 60 second default timeout
    )
    config.addinivalue_line(
        "timeout",
        "performance_timeout = 300"  # 5 minute timeout for performance tests
    )

    # Configure test database isolation level
    os.environ['TEST_ISOLATION_LEVEL'] = 'READ COMMITTED'

    # Initialize test metrics configuration
    os.environ['TEST_METRICS_CONFIG'] = str(TEST_METRICS_CONFIG)

    # Configure resource cleanup hooks
    config.addinivalue_line(
        "cleanup",
        "test_data: true"  # Enable test data cleanup
    )
    config.addinivalue_line(
        "cleanup",
        "cache: true"  # Enable cache cleanup
    )

    # Setup performance monitoring for tests
    config.addinivalue_line(
        "monitoring",
        "enable_profiling: true"  # Enable test profiling
    )
    config.addinivalue_line(
        "monitoring",
        "trace_slow_tests: true"  # Track slow tests
    )

@pytest.hookimpl
def pytest_collection_modifyitems(session: pytest.Session, config: pytest.Config, items: list) -> None:
    """
    Modify test collection for proper test ordering and dependencies.

    Args:
        session: Pytest session object
        config: Pytest configuration object
        items: List of test items
    """
    # Add async marker to async test functions
    for item in items:
        if item.get_closest_marker('asyncio'):
            item.add_marker(pytest.mark.async_test)

    # Order tests by dependencies and resource requirements
    performance_tests = []
    integration_tests = []
    unit_tests = []

    for item in items:
        if item.get_closest_marker('performance'):
            performance_tests.append(item)
        elif item.get_closest_marker('integration'):
            integration_tests.append(item)
        else:
            unit_tests.append(item)

    # Reorder tests: unit tests first, then integration, then performance
    items[:] = unit_tests + integration_tests + performance_tests

    # Configure test timeouts based on type
    for item in performance_tests:
        item.add_marker(pytest.mark.timeout(300))  # 5 minutes for performance tests
    for item in integration_tests:
        item.add_marker(pytest.mark.timeout(120))  # 2 minutes for integration tests
    for item in unit_tests:
        item.add_marker(pytest.mark.timeout(60))   # 1 minute for unit tests

    # Group related tests for optimal execution
    current_module = None
    current_group = []
    
    for item in items:
        if item.module != current_module:
            if current_group:
                # Configure cleanup between test groups
                current_group[-1].add_marker(pytest.mark.cleanup)
            current_module = item.module
            current_group = []
        current_group.append(item)

    # Configure parallel execution groups
    for item in items:
        if not item.get_closest_marker('serial'):
            item.add_marker(pytest.mark.parallel)

@pytest.fixture(scope='session')
def metrics_aggregator() -> Generator[MetricsAggregator, None, None]:
    """
    Fixture providing configured MetricsAggregator instance for tests.

    Yields:
        MetricsAggregator: Configured metrics aggregator instance
    """
    aggregator = MetricsAggregator(TEST_METRICS_CONFIG)
    yield aggregator

@pytest.fixture(scope='function')
def sample_campaign_metrics() -> Generator[CampaignMetrics, None, None]:
    """
    Fixture providing sample campaign metrics for testing.

    Yields:
        CampaignMetrics: Sample campaign metrics instance
    """
    metrics_data = {
        'impressions': 10000,
        'clicks': 500,
        'conversions': 50,
        'spend': 1000.00,
        'revenue': 5000.00
    }
    
    campaign_metrics = CampaignMetrics(
        campaign_id=uuid4(),
        platform='LINKEDIN',
        metrics_data=metrics_data
    )
    yield campaign_metrics