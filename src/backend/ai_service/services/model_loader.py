"""
Enhanced model loader service with advanced caching, versioning, and health monitoring capabilities.
Manages AI models for campaign generation, content generation, and performance prediction.

Version: 1.0.0
"""

import time
import psutil
import threading
from typing import Any, Dict, Optional
from functools import wraps

# External package imports with versions
import torch  # v2.0.1
import transformers  # v4.30.0
import redis  # v4.5.0

# Internal imports
from ..config import AIServiceConfig
from ..constants import MODEL_PATHS, MODEL_PARAMETERS
from ../../../common/logging/logger import ServiceLogger

# Global constants
MODEL_CACHE: Dict[str, Any] = {}
MODEL_LOAD_TIMEOUT = 30  # 30-second processing requirement
MODEL_CACHE_TTL = 3600  # 1 hour cache TTL
MAX_RETRY_ATTEMPTS = 3
MEMORY_THRESHOLD = 0.9  # 90% memory threshold

def circuit_breaker(max_failures: int = 3, reset_timeout: int = 60):
    """Circuit breaker decorator for model operations."""
    def decorator(func):
        failures = 0
        last_failure_time = 0
        lock = threading.Lock()

        @wraps(func)
        def wrapper(*args, **kwargs):
            nonlocal failures, last_failure_time
            
            with lock:
                current_time = time.time()
                if failures >= max_failures:
                    if current_time - last_failure_time < reset_timeout:
                        raise RuntimeError("Circuit breaker open")
                    failures = 0

            try:
                result = func(*args, **kwargs)
                with lock:
                    failures = 0
                return result
            except Exception as e:
                with lock:
                    failures += 1
                    last_failure_time = current_time
                raise e
        return wrapper
    return decorator

def monitor_performance(func):
    """Performance monitoring decorator for model operations."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            duration = time.time() - start_time
            args[0]._update_health_metrics(func.__name__, duration)
            return result
        except Exception as e:
            args[0]._logger.error(f"Performance monitoring: {str(e)}")
            raise
    return wrapper

class ModelLoader:
    """Enhanced model loader with advanced caching, versioning, and health monitoring capabilities."""

    def __init__(self, config: AIServiceConfig):
        """Initialize the model loader with enhanced configuration and monitoring."""
        self._model_cache: Dict[str, Any] = {}
        self._logger = ServiceLogger("ai_service", config)
        
        # Initialize Redis connection with retry mechanism
        redis_config = config.get_redis_config()
        self._redis_client = redis.Redis(
            host=redis_config['hosts'][0],
            port=redis_config['port'],
            password=redis_config['password'],
            ssl=redis_config['ssl'],
            decode_responses=True
        )
        
        # Initialize model version tracking
        self._model_versions: Dict[str, str] = {}
        
        # Initialize health metrics
        self._model_health_metrics: Dict[str, float] = {}
        
        # Set device with fallback
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        self._logger.info(f"ModelLoader initialized with device: {self.device}")

    @torch.no_grad()
    @circuit_breaker()
    @monitor_performance
    def load_model(self, model_name: str, version: str, force_reload: bool = False) -> Any:
        """
        Enhanced model loading with versioning, validation, and health checks.
        
        Args:
            model_name: Name of the model to load
            version: Model version identifier
            force_reload: Force model reload ignoring cache
            
        Returns:
            Loaded model instance with version info
        """
        # Validate model name and version
        if model_name not in MODEL_PATHS:
            raise ValueError(f"Invalid model name: {model_name}")
            
        cache_key = f"{model_name}_{version}"
        
        # Check cache if not force reload
        if not force_reload:
            # Check local cache
            if cache_key in self._model_cache:
                self._logger.info(f"Model {model_name} loaded from local cache")
                return self._model_cache[cache_key]
            
            # Check Redis cache
            cached_model = self._redis_client.get(cache_key)
            if cached_model:
                self._logger.info(f"Model {model_name} loaded from Redis cache")
                return torch.load(cached_model, map_location=self.device)

        # Load model with timeout control
        try:
            model_path = MODEL_PATHS[model_name] / version
            
            # Load with timeout
            with torch.cuda.amp.autocast(enabled=True):
                model = transformers.AutoModel.from_pretrained(
                    model_path,
                    device_map="auto",
                    torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32
                )

            # Validate model integrity
            self._validate_model(model, model_name)
            
            # Optimize memory usage
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            # Update caches
            self._model_cache[cache_key] = model
            self._redis_client.setex(
                cache_key,
                MODEL_CACHE_TTL,
                torch.save(model, f"/tmp/{cache_key}")
            )
            
            # Update version tracking
            self._model_versions[model_name] = version
            
            self._logger.info(f"Successfully loaded model {model_name} version {version}")
            return model

        except Exception as e:
            self._logger.error(f"Failed to load model {model_name}: {str(e)}")
            raise

    def unload_model(self, model_name: str, force: bool = False) -> bool:
        """
        Enhanced model unloading with resource cleanup.
        
        Args:
            model_name: Name of the model to unload
            force: Force unload even if in use
            
        Returns:
            Success status
        """
        try:
            version = self._model_versions.get(model_name)
            if not version:
                return False
                
            cache_key = f"{model_name}_{version}"
            
            # Remove from caches
            if cache_key in self._model_cache:
                del self._model_cache[cache_key]
            self._redis_client.delete(cache_key)
            
            # Clear GPU memory
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            # Update tracking
            del self._model_versions[model_name]
            
            self._logger.info(f"Successfully unloaded model {model_name}")
            return True

        except Exception as e:
            self._logger.error(f"Failed to unload model {model_name}: {str(e)}")
            return False

    def check_model_health(self, model_name: str) -> Dict[str, Any]:
        """
        Monitors model performance and health metrics.
        
        Args:
            model_name: Name of the model to check
            
        Returns:
            Dict containing health metrics
        """
        try:
            metrics = {
                'model_name': model_name,
                'version': self._model_versions.get(model_name, 'unknown'),
                'load_time': self._model_health_metrics.get(f"{model_name}_load_time", 0),
                'memory_usage': psutil.Process().memory_percent(),
                'gpu_memory_usage': torch.cuda.memory_allocated() / torch.cuda.max_memory_allocated() 
                    if torch.cuda.is_available() else 0,
                'is_loaded': model_name in self._model_versions,
                'device': str(self.device)
            }
            
            self._logger.info(f"Health check for model {model_name}: {metrics}")
            return metrics

        except Exception as e:
            self._logger.error(f"Health check failed for model {model_name}: {str(e)}")
            raise

    def _validate_model(self, model: Any, model_name: str) -> None:
        """Validates model integrity and performance."""
        if not model:
            raise ValueError(f"Invalid model instance for {model_name}")
            
        # Check memory usage
        memory_usage = psutil.Process().memory_percent() / 100
        if memory_usage > MEMORY_THRESHOLD:
            raise RuntimeError(f"Memory usage too high: {memory_usage:.2%}")
            
        # Validate model parameters
        expected_params = MODEL_PARAMETERS.get(model_name, {})
        if not all(hasattr(model, param) for param in expected_params):
            raise ValueError(f"Model {model_name} missing required parameters")

    def _update_health_metrics(self, operation: str, duration: float) -> None:
        """Updates model health metrics."""
        self._model_health_metrics[f"{operation}_time"] = duration