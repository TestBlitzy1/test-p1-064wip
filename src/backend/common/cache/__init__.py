"""
High-performance Redis cache initialization module with thread-safe singleton pattern,
cluster mode support, and health monitoring capabilities.

Version: 1.0.0
"""

import threading
from typing import Optional, Dict, Any

from .redis import RedisCache, RedisConfig

# Default cache configuration with production-ready settings
DEFAULT_CACHE_CONFIG: Dict[str, Any] = {
    'host': 'localhost',
    'port': 6379,
    'db': 0,
    'pool_size': 10,
    'cluster_mode': False,
    'health_check_interval': 30,
    'retry_attempts': 3,
    'retry_delay': 1,
    'socket_timeout': 5,
    'socket_connect_timeout': 2
}

# Global cache instance and thread lock
cache_instance: Optional[RedisCache] = None
_cache_lock = threading.Lock()

def get_cache_instance() -> RedisCache:
    """
    Returns a thread-safe singleton instance of RedisCache, creating it if not exists.
    
    Returns:
        RedisCache: Thread-safe singleton cache instance
        
    Raises:
        ConnectionError: If cache initialization fails
    """
    global cache_instance
    
    if cache_instance is None:
        with _cache_lock:
            if cache_instance is None:
                config = RedisConfig(**DEFAULT_CACHE_CONFIG)
                cache_instance = RedisCache(config)
                
                # Perform initial health check
                if not cache_instance.health_check():
                    cache_instance = None
                    raise ConnectionError("Failed to initialize Redis cache")
    
    return cache_instance

def initialize_cache(config: RedisConfig) -> RedisCache:
    """
    Initializes the Redis cache with custom configuration and health monitoring.
    
    Args:
        config: RedisConfig instance with custom configuration parameters
        
    Returns:
        RedisCache: Initialized cache instance with health monitoring
        
    Raises:
        ValueError: If configuration parameters are invalid
        ConnectionError: If cache initialization fails
    """
    global cache_instance
    
    with _cache_lock:
        # Validate configuration
        if not isinstance(config, RedisConfig):
            raise ValueError("Config must be an instance of RedisConfig")
            
        try:
            # Create new cache instance with provided config
            new_cache = RedisCache(config)
            
            # Perform health check before replacing existing instance
            if not new_cache.health_check():
                raise ConnectionError("Health check failed for new cache instance")
                
            # Update global instance
            cache_instance = new_cache
            return cache_instance
            
        except Exception as e:
            cache_instance = None
            raise ConnectionError(f"Failed to initialize cache: {str(e)}")

__all__ = [
    'RedisCache',
    'RedisConfig',
    'get_cache_instance',
    'initialize_cache'
]