"""
Core configuration module for backend microservices providing centralized settings management
with enhanced security, validation, and monitoring capabilities.

Version: 1.0.0
"""

import os
import json
import logging
from typing import Dict, List, Optional, Union
from pathlib import Path
from functools import lru_cache

# External package imports with versions
import pydantic  # v2.0.0
from pydantic import BaseModel, Field, validator
from dotenv import load_dotenv  # v1.0.0

# Global constants
ENV: str = os.getenv('ENV', 'development')
DEBUG: bool = os.getenv('DEBUG', 'False').lower() == 'true'
SERVICE_NAMES: List[str] = [
    'ai_service',
    'analytics_service',
    'audience_service',
    'campaign_service',
    'integration_service'
]
CONFIG_PATHS: Dict[str, str] = {
    'development': '.env.development',
    'staging': '.env.staging',
    'production': '.env.production'
}

# Configure logging
logging.basicConfig(
    level=logging.INFO if not DEBUG else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class DatabaseConfig(BaseModel):
    """Database configuration with replication and connection pooling support."""
    host: str = Field(..., description="Database host")
    port: int = Field(..., description="Database port")
    name: str = Field(..., description="Database name")
    user: str = Field(..., description="Database user")
    password: str = Field(..., description="Database password")
    max_connections: int = Field(default=100, description="Maximum connections")
    min_connections: int = Field(default=10, description="Minimum connections")
    ssl_mode: str = Field(default='verify-full', description="SSL mode")
    replica_hosts: Optional[List[str]] = Field(default=None, description="Read replica hosts")
    connection_timeout: int = Field(default=30, description="Connection timeout in seconds")

class RedisConfig(BaseModel):
    """Redis configuration with cluster mode support."""
    hosts: List[str] = Field(..., description="Redis hosts")
    port: int = Field(..., description="Redis port")
    password: Optional[str] = Field(None, description="Redis password")
    db: int = Field(default=0, description="Redis database number")
    cluster_mode: bool = Field(default=False, description="Cluster mode enabled")
    ssl: bool = Field(default=True, description="SSL enabled")
    connection_pool_size: int = Field(default=100, description="Connection pool size")

class KafkaConfig(BaseModel):
    """Kafka configuration with consumer group settings."""
    bootstrap_servers: List[str] = Field(..., description="Kafka brokers")
    security_protocol: str = Field(default="SASL_SSL", description="Security protocol")
    sasl_mechanism: str = Field(default="PLAIN", description="SASL mechanism")
    consumer_group_id: str = Field(..., description="Consumer group ID")
    auto_offset_reset: str = Field(default="earliest", description="Auto offset reset")
    enable_auto_commit: bool = Field(default=True, description="Auto commit enabled")

class MonitoringConfig(BaseModel):
    """Monitoring configuration with comprehensive observability settings."""
    prometheus_port: int = Field(default=9090, description="Prometheus metrics port")
    enable_tracing: bool = Field(default=True, description="Enable distributed tracing")
    trace_sample_rate: float = Field(default=0.1, description="Trace sampling rate")
    log_level: str = Field(default="INFO", description="Logging level")
    health_check_interval: int = Field(default=30, description="Health check interval")

@pydantic.dataclasses.dataclass
class BaseConfig:
    """Enhanced base configuration class with comprehensive settings management."""
    
    service_name: str
    
    def __post_init__(self):
        """Initialize configuration with validation and security checks."""
        if self.service_name not in SERVICE_NAMES:
            raise ValueError(f"Invalid service name: {self.service_name}")
        
        self.env: str = ENV
        self.debug: bool = DEBUG
        self._load_configurations()
        
    def _load_configurations(self) -> None:
        """Load and validate all configuration components."""
        self.database_config = self.get_database_config()
        self.redis_config = self.get_redis_config()
        self.kafka_config = self.get_kafka_config()
        self.monitoring_config = self.get_monitoring_config()
        
    def get_database_config(self) -> Dict:
        """Returns comprehensive database configuration with replication support."""
        config = DatabaseConfig(
            host=os.getenv('DB_HOST', 'localhost'),
            port=int(os.getenv('DB_PORT', '5432')),
            name=os.getenv('DB_NAME', f'{self.service_name}_db'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', ''),
            max_connections=int(os.getenv('DB_MAX_CONNECTIONS', '100')),
            min_connections=int(os.getenv('DB_MIN_CONNECTIONS', '10')),
            ssl_mode=os.getenv('DB_SSL_MODE', 'verify-full'),
            replica_hosts=json.loads(os.getenv('DB_REPLICA_HOSTS', '[]')),
            connection_timeout=int(os.getenv('DB_CONNECTION_TIMEOUT', '30'))
        )
        return config.model_dump()

    def get_redis_config(self) -> Dict:
        """Returns Redis configuration with cluster support."""
        config = RedisConfig(
            hosts=json.loads(os.getenv('REDIS_HOSTS', '["localhost"]')),
            port=int(os.getenv('REDIS_PORT', '6379')),
            password=os.getenv('REDIS_PASSWORD'),
            db=int(os.getenv('REDIS_DB', '0')),
            cluster_mode=os.getenv('REDIS_CLUSTER_MODE', 'false').lower() == 'true',
            ssl=os.getenv('REDIS_SSL', 'true').lower() == 'true',
            connection_pool_size=int(os.getenv('REDIS_POOL_SIZE', '100'))
        )
        return config.model_dump()

    def get_kafka_config(self) -> Dict:
        """Returns Kafka configuration with consumer groups."""
        config = KafkaConfig(
            bootstrap_servers=json.loads(os.getenv('KAFKA_SERVERS', '["localhost:9092"]')),
            security_protocol=os.getenv('KAFKA_SECURITY_PROTOCOL', 'SASL_SSL'),
            sasl_mechanism=os.getenv('KAFKA_SASL_MECHANISM', 'PLAIN'),
            consumer_group_id=f"{self.service_name}_group",
            auto_offset_reset=os.getenv('KAFKA_AUTO_OFFSET_RESET', 'earliest'),
            enable_auto_commit=os.getenv('KAFKA_AUTO_COMMIT', 'true').lower() == 'true'
        )
        return config.model_dump()

    def get_monitoring_config(self) -> Dict:
        """Returns comprehensive monitoring configuration."""
        config = MonitoringConfig(
            prometheus_port=int(os.getenv('PROMETHEUS_PORT', '9090')),
            enable_tracing=os.getenv('ENABLE_TRACING', 'true').lower() == 'true',
            trace_sample_rate=float(os.getenv('TRACE_SAMPLE_RATE', '0.1')),
            log_level=os.getenv('LOG_LEVEL', 'INFO'),
            health_check_interval=int(os.getenv('HEALTH_CHECK_INTERVAL', '30'))
        )
        return config.model_dump()

def load_environment_config() -> None:
    """Enhanced environment configuration loader with validation."""
    if ENV not in CONFIG_PATHS:
        raise ValueError(f"Invalid environment: {ENV}")
    
    config_path = Path(CONFIG_PATHS[ENV])
    if not config_path.exists():
        raise FileNotFoundError(f"Configuration file not found: {config_path}")
    
    load_dotenv(config_path)
    logger.info(f"Loaded configuration for environment: {ENV}")

@lru_cache()
def get_service_config(service_name: str) -> BaseConfig:
    """Enhanced service configuration factory with validation and caching."""
    if service_name not in SERVICE_NAMES:
        raise ValueError(f"Invalid service name: {service_name}")
    
    try:
        config = BaseConfig(service_name=service_name)
        logger.info(f"Successfully created configuration for service: {service_name}")
        return config
    except Exception as e:
        logger.error(f"Failed to create configuration for service {service_name}: {str(e)}")
        raise

# Initialize environment configuration on module import
load_environment_config()