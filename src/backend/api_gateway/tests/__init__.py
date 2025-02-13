"""
API Gateway Test Package Initialization
Version: 1.0.0

Provides comprehensive test utilities, fixtures, and configuration for API Gateway testing,
including authentication, rate limiting, and integration test support.
"""

import asyncio
import logging
from typing import Dict, List

# External imports with versions
import pytest  # v7.4.0
import pytest_asyncio  # v0.21.0
import fakeredis  # v2.0.0
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import AsyncClient

# Internal imports
from ....common.config.settings import Settings

# Test configuration constants
TEST_JWT_SECRET = Settings.JWT_SECRET_KEY
TEST_JWT_ALGORITHM = Settings.JWT_ALGORITHM

# Rate limit configurations for different endpoints
RATE_LIMIT_CONFIGS = {
    'campaign_creation': 100,  # requests per minute
    'campaign_management': 150,
    'reporting': 500,
    'data_sync': 50
}

# Test markers with descriptions
TEST_MARKERS = {
    'auth': 'Authentication tests',
    'rate_limit': 'Rate limiting tests',
    'integration': 'Integration tests',
    'performance': 'Performance tests',
    'security': 'Security tests'
}

def pytest_configure(config: pytest.Config) -> None:
    """
    Configure pytest environment with comprehensive test markers and settings.
    
    Args:
        config: pytest configuration object
    """
    # Register custom markers
    for marker, description in TEST_MARKERS.items():
        config.addinivalue_line('markers', f'{marker}: {description}')
    
    # Configure async test settings
    config.addinivalue_line('asyncio_mode', 'auto')
    
    # Set up test logging
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Configure test timeouts
    config.addinivalue_line('timeout', '60')
    
    # Set up parallel test execution
    config.addinivalue_line('xdist_auto', 'true')

def pytest_collection_modifyitems(config: pytest.Config, items: List[pytest.Item]) -> None:
    """
    Modify test collection with proper markers and execution order.
    
    Args:
        config: pytest configuration object
        items: List of collected test items
    """
    for item in items:
        # Add async marker to async test functions
        if asyncio.iscoroutinefunction(item.function):
            item.add_marker(pytest.mark.asyncio)
        
        # Add appropriate markers based on test path and name
        if 'auth' in item.nodeid:
            item.add_marker(pytest.mark.auth)
        elif 'rate_limit' in item.nodeid:
            item.add_marker(pytest.mark.rate_limit)
        elif 'integration' in item.nodeid:
            item.add_marker(pytest.mark.integration)
        elif 'performance' in item.nodeid:
            item.add_marker(pytest.mark.performance)

class BaseTestCase:
    """
    Base test class providing comprehensive test utilities and fixtures for API Gateway testing.
    """
    
    def __init__(self):
        """Initialize base test case with all required test utilities."""
        self.app = FastAPI()
        self.client = TestClient(self.app)
        self.async_client = AsyncClient(app=self.app, base_url="http://test")
        self.redis_mock = fakeredis.FakeStrictRedis()
        self.jwt_token = None
        self.rate_limit_store: Dict[str, int] = {}
        
        # Configure test logging
        self.logger = logging.getLogger(__name__)
        self.logger.setLevel(logging.DEBUG)

    async def setup_method(self) -> None:
        """Setup method run before each test to ensure clean test state."""
        # Reset rate limit tracking
        self.rate_limit_store.clear()
        
        # Clear Redis mock data
        await self.redis_mock.flushall()
        
        # Initialize test JWT token
        self.jwt_token = "test_token"
        
        # Reset test metrics
        self._reset_test_metrics()
        
        self.logger.info("Test setup completed")

    async def teardown_method(self) -> None:
        """Teardown method run after each test to clean up resources."""
        # Clear rate limit data
        self.rate_limit_store.clear()
        
        # Clear Redis mock
        await self.redis_mock.flushall()
        
        # Clear JWT token
        self.jwt_token = None
        
        # Store test metrics
        self._store_test_metrics()
        
        # Close async client
        await self.async_client.aclose()
        
        self.logger.info("Test teardown completed")

    def _reset_test_metrics(self) -> None:
        """Reset test performance metrics."""
        self.test_start_time = asyncio.get_event_loop().time()
        self.request_count = 0
        self.error_count = 0

    def _store_test_metrics(self) -> None:
        """Store test execution metrics."""
        test_duration = asyncio.get_event_loop().time() - self.test_start_time
        self.logger.info(
            f"Test metrics - Duration: {test_duration:.2f}s, "
            f"Requests: {self.request_count}, "
            f"Errors: {self.error_count}"
        )