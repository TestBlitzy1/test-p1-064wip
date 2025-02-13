"""
Test package initialization file configuring test environment, fixtures, and common test utilities
for LinkedIn Ads and Google Ads integration testing.

Version: 1.0.0
"""

import pytest
import pytest_asyncio

# Test environment configuration with platform-specific settings
TEST_ENVIRONMENT = {
    'env': 'test',
    'mock_external_apis': True,
    'platform_configs': {
        'linkedin': {
            'api_version': 'v2',
            'mock_responses_path': 'tests/mock_data/linkedin/',
            'rate_limits': {
                'campaign_creation': {'requests': 100, 'window_seconds': 60},
                'reporting': {'requests': 500, 'window_seconds': 60}
            }
        },
        'google_ads': {
            'api_version': 'v14',
            'mock_responses_path': 'tests/mock_data/google_ads/',
            'rate_limits': {
                'campaign_operations': {'requests': 150, 'window_seconds': 60},
                'reporting': {'requests': 1000, 'window_seconds': 60}
            }
        }
    },
    'test_timeouts': {
        'default': 30,
        'long_running': 60
    },
    'mock_behavior': {
        'strict_mode': True,
        'record_new_interactions': False
    }
}

# Global test timeout setting
INTEGRATION_TEST_TIMEOUT = 30

def pytest_configure(config):
    """
    Configures pytest for integration service tests with comprehensive setup for both 
    LinkedIn and Google Ads testing.
    
    Args:
        config: Pytest configuration object
    """
    # Register custom markers
    config.addinivalue_line(
        "markers", 
        "linkedin: mark test as LinkedIn Ads integration test"
    )
    config.addinivalue_line(
        "markers", 
        "google_ads: mark test as Google Ads integration test"
    )
    config.addinivalue_line(
        "markers", 
        "mock: mark test as using mock responses"
    )
    config.addinivalue_line(
        "markers", 
        "integration: mark test as requiring external API access"
    )

    # Configure async test settings
    pytest_asyncio.main(
        default_timeout=TEST_ENVIRONMENT['test_timeouts']['default'],
        long_running_timeout=TEST_ENVIRONMENT['test_timeouts']['long_running']
    )

    # Set up test environment variables
    config.option.env = 'test'
    config.option.mock_external_apis = TEST_ENVIRONMENT['mock_external_apis']

    # Configure platform-specific test settings
    config.option.linkedin_config = TEST_ENVIRONMENT['platform_configs']['linkedin']
    config.option.google_ads_config = TEST_ENVIRONMENT['platform_configs']['google_ads']

    # Set up mock behavior configuration
    config.option.strict_mock_mode = TEST_ENVIRONMENT['mock_behavior']['strict_mode']
    config.option.record_new_interactions = TEST_ENVIRONMENT['mock_behavior']['record_new_interactions']

    # Configure test result collectors
    config.option.report_format = 'json'
    config.option.report_path = 'test-reports'

    # Initialize cleanup handlers
    config.option.cleanup_test_data = True
    config.option.cleanup_mock_files = True

    # Configure coverage reporting
    config.option.cov_report = 'html'
    config.option.cov_config = '.coveragerc'

    # Set up performance metrics collection
    config.option.performance_metrics = True
    config.option.metrics_path = 'test-metrics'

    # Configure logging for tests
    config.option.log_level = 'INFO'
    config.option.log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    config.option.log_file = 'test.log'

    # Set up debugging configuration
    config.option.debug_mode = False
    config.option.pdb_on_failure = False