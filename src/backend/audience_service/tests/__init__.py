"""
Test package initialization file for the audience service test suite.
Configures pytest settings, custom markers, and common test fixtures for audience segmentation
and targeting tests with comprehensive validation and performance monitoring.

Version: 1.0.0
"""

import pytest  # v7.0.0
import pytest_asyncio  # v0.21.0
from typing import Dict, Any, List

# Define test plugins required for async testing
pytest_plugins = ['pytest_asyncio']

# Performance thresholds for test monitoring
PERFORMANCE_THRESHOLDS = {
    'segmentation_time': 30,  # Maximum time in seconds for segmentation operations
    'targeting_time': 15,     # Maximum time in seconds for targeting operations
    'validation_time': 5      # Maximum time in seconds for validation operations
}

# Platform-specific test constraints
PLATFORM_CONSTRAINTS = {
    'linkedin': {
        'min_audience_size': 1000,
        'max_audience_size': 10000000,
        'max_targeting_facets': 5,
        'required_fields': ['industry', 'company_size']
    },
    'google': {
        'min_audience_size': 100,
        'max_audience_size': 50000000,
        'max_targeting_criteria': 10,
        'required_fields': ['keywords']
    }
}

def pytest_configure(config: Any) -> None:
    """
    Configures pytest settings, custom markers, performance monitoring, and validation thresholds
    for the audience service test suite.

    Args:
        config: Pytest configuration object
    """
    # Register custom markers for test categorization and monitoring
    config.addinivalue_line(
        "markers",
        "segmentation: mark test as an audience segmentation test with performance monitoring"
    )
    config.addinivalue_line(
        "markers",
        "targeting: mark test as a targeting rule test with platform compliance validation"
    )
    config.addinivalue_line(
        "markers",
        "integration: mark test as an end-to-end platform integration test"
    )
    config.addinivalue_line(
        "markers",
        "performance: mark test for performance benchmark validation"
    )

    # Configure async test settings
    config.addinivalue_line(
        "asyncio_mode",
        "auto"  # Enable automatic async test detection
    )
    config.addinivalue_line(
        "asyncio_timeout",
        "60"  # Set default async test timeout
    )

    # Configure test isolation and cleanup
    config.addinivalue_line(
        "filterwarnings",
        "error::DeprecationWarning"  # Treat deprecation warnings as errors
    )
    config.addinivalue_line(
        "filterwarnings",
        "error::pytest.PytestUnhandledThreadExceptionWarning"
    )

def pytest_collection_modifyitems(session: Any, config: Any, items: List[Any]) -> None:
    """
    Modifies test collection to add custom markers, configure test ordering,
    and setup performance monitoring.

    Args:
        session: Pytest session object
        config: Pytest configuration object
        items: List of collected test items
    """
    # Add markers based on test module and function names
    for item in items:
        # Add segmentation marker with performance monitoring
        if "segmentation" in item.nodeid:
            item.add_marker(pytest.mark.segmentation)
            item.add_marker(
                pytest.mark.timeout(PERFORMANCE_THRESHOLDS['segmentation_time'])
            )

        # Add targeting marker with compliance validation
        if "targeting" in item.nodeid:
            item.add_marker(pytest.mark.targeting)
            item.add_marker(
                pytest.mark.timeout(PERFORMANCE_THRESHOLDS['targeting_time'])
            )

        # Add performance marker for benchmark tests
        if "performance" in item.nodeid:
            item.add_marker(pytest.mark.performance)

        # Add async marker for async test functions
        if item.get_closest_marker('asyncio'):
            item.add_marker(
                pytest.mark.timeout(60)  # Default 60s timeout for async tests
            )

    # Configure test ordering for optimal execution
    items.sort(key=lambda x: (
        # Run integration tests last
        1 if "integration" in x.keywords else 0,
        # Run performance tests after unit tests
        1 if "performance" in x.keywords else 0,
        # Maintain file order for remaining tests
        x.nodeid
    ))