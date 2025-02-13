"""
Test package initialization for campaign service tests providing comprehensive test environment setup,
fixtures, and utilities for campaign generation testing, performance validation, and error handling scenarios.

Version: 1.0.0
"""

import pytest  # v7.0.0
import pytest_asyncio  # v0.21.0
import pytest_timeout  # v2.1.0
from common.config.settings import TEST_DATABASE_URL, TEST_LOGGING_CONFIG
from common.logging.logger import setup_test_logging, cleanup_test_logging

# Test configuration constants
TEST_TIMEOUT = 30  # Maximum test execution time in seconds
TEST_PLATFORMS = ['linkedin', 'google']  # Supported ad platforms for testing

# Custom test markers with descriptions
TEST_MARKERS = {
    'campaign': 'Campaign generation tests',
    'performance': 'Performance validation tests',
    'integration': 'Integration tests',
    'error': 'Error handling tests'
}

def pytest_configure(config):
    """
    Configures the test environment for campaign service tests with comprehensive setup
    for database, logging, markers, and timeout enforcement.

    Args:
        config: pytest configuration object

    Returns:
        None
    """
    # Register custom markers
    for marker, description in TEST_MARKERS.items():
        config.addinivalue_line(
            "markers",
            f"{marker}: {description}"
        )

    # Configure test timeouts for performance requirements
    config.addinivalue_line(
        "timeout",
        f"timeout: {TEST_TIMEOUT}"
    )

    # Set up test database configuration
    config.option.database_url = TEST_DATABASE_URL

    # Configure structured JSON logging for tests
    setup_test_logging(TEST_LOGGING_CONFIG)

    # Configure test fixtures
    config.addinivalue_line(
        "fixtures",
        "campaign_data: Test campaign data fixture"
    )
    config.addinivalue_line(
        "fixtures", 
        "audience_data: Test audience data fixture"
    )
    config.addinivalue_line(
        "fixtures",
        "analytics_data: Test analytics data fixture"
    )

    # Set up error handling test configurations
    config.addinivalue_line(
        "error_handling",
        "api_errors: API error simulation configuration"
    )
    config.addinivalue_line(
        "error_handling",
        "data_errors: Data validation error configuration"
    )
    config.addinivalue_line(
        "error_handling",
        "system_errors: System error simulation configuration"
    )

    # Configure performance monitoring for tests
    config.addinivalue_line(
        "monitoring",
        "enable_performance_monitoring: true"
    )
    config.addinivalue_line(
        "monitoring",
        "collect_test_metrics: true"
    )

def pytest_unconfigure(config):
    """
    Performs comprehensive cleanup of test environment after test execution.

    Args:
        config: pytest configuration object

    Returns:
        None
    """
    # Clean up test database
    config.option.database_url = None

    # Remove test logging configuration
    cleanup_test_logging()

    # Clean up test fixtures
    config.option.fixtures = []

    # Clean up error handling configurations
    config.option.error_handling = []

    # Clean up performance monitoring
    config.option.monitoring = []

    # Generate test execution report
    if hasattr(config, '_html'):
        config._html.summary_prefix = "Campaign Service Test Results"