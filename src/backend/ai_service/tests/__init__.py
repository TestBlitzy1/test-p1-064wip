"""
Test package initialization for AI service tests providing comprehensive test configuration,
fixtures, and markers for validating AI model performance and inference capabilities.

Version: 1.0.0
"""

# External imports
import pytest  # v7.4.0

# Internal imports
from common.config.settings import get_service_config

# Global test configuration constants
TEST_MODEL_PATH = "models/test"
TEST_TIMEOUT = 30  # Aligns with 30-second campaign generation requirement
TEST_BATCH_SIZE = 10

def pytest_configure(config):
    """
    Configure pytest with custom markers and settings for AI service test suite.
    
    Args:
        config: Pytest configuration object
    """
    # Register custom markers for test categorization
    config.addinivalue_line(
        "markers",
        "ai_models: mark tests that validate AI model performance"
    )
    config.addinivalue_line(
        "markers",
        "inference: mark tests that validate inference performance"
    )
    config.addinivalue_line(
        "markers",
        "performance: mark tests that validate performance requirements"
    )
    
    # Load service configuration for testing
    test_config = get_service_config("ai_service")
    
    # Configure test timeouts
    config.timeout = TEST_TIMEOUT
    
    # Configure test paths and resources
    config.option.model_path = TEST_MODEL_PATH
    config.option.batch_size = TEST_BATCH_SIZE
    
    # Configure test isolation
    config.option.isolated_download = True
    
    # Configure logging for tests
    config.option.log_level = "INFO"
    config.option.log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Configure test cleanup
    config.option.clean = True

def pytest_collection_modifyitems(config, items):
    """
    Modify test collection to handle async tests and apply appropriate markers.
    
    Args:
        config: Pytest configuration object
        items: List of collected test items
    """
    for item in items:
        # Handle async tests
        if item.get_closest_marker("asyncio"):
            item.add_marker(pytest.mark.asyncio)
        
        # Apply model test markers
        if "model" in item.nodeid:
            item.add_marker(pytest.mark.ai_models)
        
        # Apply inference test markers
        if "inference" in item.nodeid:
            item.add_marker(pytest.mark.inference)
        
        # Apply performance markers for timing-sensitive tests
        if "performance" in item.nodeid:
            item.add_marker(pytest.mark.performance)
            
        # Set test priorities
        if item.get_closest_marker("performance"):
            item.priority = 1
        elif item.get_closest_marker("ai_models"):
            item.priority = 2
        else:
            item.priority = 3
            
        # Configure parallel test execution
        item.add_marker(pytest.mark.parallel)
        
        # Set test dependencies
        if item.get_closest_marker("inference"):
            item.add_marker(pytest.mark.depends(on=["test_model_loading"]))
            
        # Configure performance monitoring
        if item.get_closest_marker("performance"):
            item.add_marker(pytest.mark.monitor)
            
        # Configure test data versioning
        item.add_marker(pytest.mark.data_version("1.0.0"))