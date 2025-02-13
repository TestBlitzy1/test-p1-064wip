"""
High-performance Redis cache implementation with cluster mode support, connection pooling,
and comprehensive error handling for backend services.

Version: 1.0.0
"""

import json
import asyncio
from typing import Any, Dict, Optional
from redis import Redis, ConnectionPool, ConnectionError, RedisError  # v4.5.0
from common.config.settings import BaseConfig

# Global constants for Redis configuration
REDIS_ENCODING = 'utf-8'
DEFAULT_EXPIRY = 3600  # Default expiry time in seconds
MAX_RETRIES = 3  # Maximum number of retry attempts
RETRY_DELAY = 0.1  # Delay between retries in seconds
POOL_SIZE = 100  # Default connection pool size
HEALTH_CHECK_INTERVAL = 30  # Health check interval in seconds

class RedisCache:
    """
    Enhanced Redis cache client with cluster mode support, connection pooling,
    and comprehensive error handling.
    """

    def __init__(self, config: BaseConfig) -> None:
        """
        Initialize Redis cache with cluster mode and connection pooling support.
        
        Args:
            config: BaseConfig instance containing Redis configuration
        """
        self._config = config.get_redis_config()
        self._metrics = {
            'hits': 0,
            'misses': 0,
            'errors': 0,
            'latency': []
        }
        
        # Initialize connection pool with optimal settings
        pool_kwargs = {
            'host': self._config['hosts'][0],
            'port': self._config['port'],
            'db': self._config['db'],
            'password': self._config['password'],
            'ssl': self._config['ssl'],
            'max_connections': self._config['connection_pool_size'],
            'health_check_interval': HEALTH_CHECK_INTERVAL,
            'retry_on_timeout': True
        }
        
        self._pool = ConnectionPool(**pool_kwargs)
        self._is_cluster_mode = self._config['cluster_mode']
        
        # Initialize Redis client with connection pool
        client_kwargs = {
            'connection_pool': self._pool,
            'decode_responses': True,
            'encoding': REDIS_ENCODING,
            'socket_timeout': 5.0,
            'socket_connect_timeout': 2.0
        }
        
        if self._is_cluster_mode:
            from redis.cluster import RedisCluster
            self._client = RedisCluster(
                startup_nodes=[{'host': host, 'port': self._config['port']} 
                             for host in self._config['hosts']],
                **client_kwargs
            )
        else:
            self._client = Redis(**client_kwargs)
        
        # Validate connection
        if not self.health_check():
            raise ConnectionError("Failed to establish Redis connection")

    async def get(self, key: str) -> Any:
        """
        Retrieve value from cache with retry logic and monitoring.
        
        Args:
            key: Cache key to retrieve
            
        Returns:
            Cached value or None if not found
        """
        start_time = asyncio.get_event_loop().time()
        
        for attempt in range(MAX_RETRIES):
            try:
                value = self._client.get(key)
                
                if value is not None:
                    self._metrics['hits'] += 1
                    try:
                        return json.loads(value)
                    except json.JSONDecodeError:
                        return value
                
                self._metrics['misses'] += 1
                return None
                
            except RedisError as e:
                if attempt == MAX_RETRIES - 1:
                    self._metrics['errors'] += 1
                    raise e
                await asyncio.sleep(RETRY_DELAY)
                
        finally:
            latency = asyncio.get_event_loop().time() - start_time
            self._metrics['latency'].append(latency)

    async def set(self, key: str, value: Any, expiry: int = DEFAULT_EXPIRY) -> bool:
        """
        Set cache value with optimized serialization and monitoring.
        
        Args:
            key: Cache key
            value: Value to cache
            expiry: Expiration time in seconds
            
        Returns:
            True if successful
        """
        try:
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            
            for attempt in range(MAX_RETRIES):
                try:
                    return bool(self._client.setex(key, expiry, value))
                except RedisError as e:
                    if attempt == MAX_RETRIES - 1:
                        self._metrics['errors'] += 1
                        raise e
                    await asyncio.sleep(RETRY_DELAY)
                    
        except Exception as e:
            self._metrics['errors'] += 1
            raise e

    async def delete(self, key: str) -> bool:
        """
        Remove key from cache with cluster awareness.
        
        Args:
            key: Cache key to delete
            
        Returns:
            True if key was deleted
        """
        try:
            for attempt in range(MAX_RETRIES):
                try:
                    return bool(self._client.delete(key))
                except RedisError as e:
                    if attempt == MAX_RETRIES - 1:
                        self._metrics['errors'] += 1
                        raise e
                    await asyncio.sleep(RETRY_DELAY)
                    
        except Exception as e:
            self._metrics['errors'] += 1
            raise e

    async def exists(self, key: str) -> bool:
        """
        Check if key exists in cache with optimization.
        
        Args:
            key: Cache key to check
            
        Returns:
            True if key exists
        """
        try:
            for attempt in range(MAX_RETRIES):
                try:
                    return bool(self._client.exists(key))
                except RedisError as e:
                    if attempt == MAX_RETRIES - 1:
                        self._metrics['errors'] += 1
                        raise e
                    await asyncio.sleep(RETRY_DELAY)
                    
        except Exception as e:
            self._metrics['errors'] += 1
            raise e

    async def clear_pattern(self, pattern: str) -> int:
        """
        Clear all keys matching pattern across cluster.
        
        Args:
            pattern: Pattern to match keys against
            
        Returns:
            Number of keys cleared
        """
        try:
            deleted_count = 0
            cursor = 0
            
            while True:
                cursor, keys = self._client.scan(cursor, match=pattern, count=100)
                if keys:
                    deleted_count += await self.delete(*keys)
                if cursor == 0:
                    break
                    
            return deleted_count
            
        except Exception as e:
            self._metrics['errors'] += 1
            raise e

    def health_check(self) -> bool:
        """
        Perform connection and cluster health check.
        
        Returns:
            True if cache is healthy
        """
        try:
            # Basic ping check
            self._client.ping()
            
            # Cluster mode specific checks
            if self._is_cluster_mode:
                cluster_info = self._client.cluster_info()
                if cluster_info['cluster_state'] != 'ok':
                    return False
                
            # Test basic operations
            test_key = '_health_check_'
            self._client.setex(test_key, 10, '1')
            self._client.delete(test_key)
            
            return True
            
        except Exception as e:
            self._metrics['errors'] += 1
            return False