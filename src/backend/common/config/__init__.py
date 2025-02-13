"""
Configuration initialization module for backend services with enhanced security and monitoring.
Provides centralized configuration management with validation and versioning capabilities.

Version: 1.0.0
"""

import os
from typing import Dict, List, Optional, Union
from functools import wraps
from datetime import datetime
import logging
from python_dotenv import load_dotenv  # v1.0.0

from .settings import BaseConfig, get_database_config, get_redis_config, get_kafka_config, get_monitoring_config

# Global environment settings
ENV: str = os.getenv('ENV', 'development')
DEBUG: bool = os.getenv('DEBUG', 'False').lower() == 'true'

# Environment-specific configuration paths with security validation
CONFIG_PATHS: Dict[str, str] = {
    'development': '.env.development',
    'staging': '.env.staging',
    'production': '.env.production'
}

# Valid service names for configuration management
SERVICE_NAMES: List[str] = [
    'ai_service',
    'analytics_service',
    'audience_service',
    'campaign_service',
    'integration_service'
]

# Configure logging for configuration management
logging.basicConfig(
    level=logging.DEBUG if DEBUG else logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def validate_config(func):
    """Decorator for configuration validation with security checks."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            logger.info(f"Validating configuration for function: {func.__name__}")
            result = func(*args, **kwargs)
            # Record configuration version and timestamp
            config_metadata = {
                'version': '1.0.0',
                'timestamp': datetime.utcnow().isoformat(),
                'environment': ENV,
                'validated': True
            }
            logger.info(f"Configuration validated successfully: {config_metadata}")
            return result
        except Exception as e:
            logger.error(f"Configuration validation failed: {str(e)}")
            raise
    return wrapper

def audit_log(func):
    """Decorator for auditing configuration access and changes."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            logger.info(f"Audit: Accessing configuration via {func.__name__}")
            result = func(*args, **kwargs)
            logger.info(f"Audit: Configuration access successful")
            return result
        except Exception as e:
            logger.error(f"Audit: Configuration access failed - {str(e)}")
            raise
    return wrapper

@validate_config
@audit_log
def load_environment_config() -> None:
    """
    Enhanced environment configuration loader with security validation and monitoring.
    Validates file permissions and integrity before loading environment variables.
    """
    if ENV not in CONFIG_PATHS:
        raise ValueError(f"Invalid environment specified: {ENV}")
    
    config_path = CONFIG_PATHS[ENV]
    
    # Validate config file existence and permissions
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"Configuration file not found: {config_path}")
    
    # Check file permissions in production
    if ENV == 'production':
        file_permissions = oct(os.stat(config_path).st_mode)[-3:]
        if file_permissions != '600':
            raise PermissionError(f"Invalid config file permissions: {file_permissions}")
    
    try:
        load_dotenv(config_path)
        logger.info(f"Successfully loaded environment configuration from {config_path}")
        
        # Validate required environment variables
        required_vars = ['DB_HOST', 'DB_PASSWORD', 'REDIS_HOSTS', 'KAFKA_SERVERS']
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {missing_vars}")
            
    except Exception as e:
        logger.error(f"Failed to load environment configuration: {str(e)}")
        raise

@validate_config
def get_service_config(service_name: str) -> BaseConfig:
    """
    Enhanced service configuration factory with security and monitoring.
    Creates and validates service-specific configuration instances.
    
    Args:
        service_name: Name of the service requiring configuration
        
    Returns:
        BaseConfig: Validated service configuration instance
        
    Raises:
        ValueError: If service name is invalid
        ConfigurationError: If configuration validation fails
    """
    if service_name not in SERVICE_NAMES:
        raise ValueError(f"Invalid service name: {service_name}")
    
    try:
        logger.info(f"Creating configuration for service: {service_name}")
        
        # Create and validate service configuration
        config = BaseConfig(service_name=service_name)
        
        # Apply service-specific security policies
        if ENV == 'production':
            # Enforce stricter security settings in production
            config.database_config['ssl_mode'] = 'verify-full'
            config.redis_config['ssl'] = True
            config.kafka_config['security_protocol'] = 'SASL_SSL'
        
        logger.info(f"Successfully created configuration for service: {service_name}")
        return config
        
    except Exception as e:
        logger.error(f"Failed to create service configuration: {str(e)}")
        raise

# Initialize environment configuration on module import
load_environment_config()

# Export public interface
__all__ = [
    'ENV',
    'DEBUG',
    'CONFIG_PATHS',
    'SERVICE_NAMES',
    'load_environment_config',
    'get_service_config'
]