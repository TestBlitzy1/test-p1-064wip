"""
AI service configuration module providing comprehensive settings for ML models,
performance parameters, GPU acceleration, monitoring, and service-specific configurations.

Version: 1.0.0
"""

import torch  # v2.0.1
import pydantic  # v2.0.0
from typing import Dict, Optional

from ...common.config.settings import BaseConfig
from ...common.monitoring.metrics import MetricsManager
from ...common.logging.logger import ServiceLogger
from .constants import MODEL_PATHS, MODEL_PARAMETERS

# Global constants
SERVICE_NAME = "ai_service"
DEFAULT_MODEL_DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

@pydantic.dataclasses.dataclass
class AIServiceConfig(BaseConfig):
    """
    Comprehensive AI service configuration class with support for GPU acceleration,
    distributed deployment, and A/B testing.
    """

    def __init__(self):
        """Initialize AI service configuration with enhanced validation and monitoring setup."""
        super().__init__(service_name=SERVICE_NAME)
        
        # Initialize core components
        self.model_device = DEFAULT_MODEL_DEVICE
        self.model_paths = MODEL_PATHS
        self.model_parameters = MODEL_PARAMETERS
        
        # Performance settings
        self.inference_timeout = MODEL_PARAMETERS['PROCESSING_TIMEOUT']
        self.max_batch_size = MODEL_PARAMETERS['BATCH_SIZE']
        self.min_confidence_score = MODEL_PARAMETERS['MIN_MODEL_CONFIDENCE']
        
        # Initialize monitoring
        self._setup_monitoring()
        
        # Feature flags for A/B testing
        self.feature_flags = {
            'enable_gpu_acceleration': torch.cuda.is_available(),
            'enable_batch_processing': True,
            'enable_model_caching': True,
            'enable_performance_tracking': True
        }
        
        # Monitoring thresholds
        self.monitoring_thresholds = {
            'max_processing_time': MODEL_PARAMETERS['PROCESSING_TIMEOUT'],
            'max_memory_usage': 0.9,  # 90% GPU memory threshold
            'max_error_rate': 0.01,   # 1% maximum error rate
            'min_success_rate': 0.99  # 99% minimum success rate
        }
        
        # Scaling parameters
        self.scaling_parameters = {
            'min_instances': 2,
            'max_instances': 8,
            'cpu_threshold': 0.7,     # Scale up at 70% CPU utilization
            'memory_threshold': 0.8,   # Scale up at 80% memory utilization
            'gpu_memory_threshold': 0.85  # Scale up at 85% GPU memory utilization
        }

    def _setup_monitoring(self) -> None:
        """Initialize monitoring and metrics configuration."""
        self.metrics_manager = MetricsManager(SERVICE_NAME)
        self.logger = ServiceLogger(SERVICE_NAME, self)
        
        # Create core metrics
        self.metrics_manager.create_histogram(
            name="model_inference_time",
            description="Model inference time in seconds",
            labels=["model_name", "version"],
            buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 30.0]
        )
        
        self.metrics_manager.create_counter(
            name="model_inference_errors",
            description="Model inference error count",
            labels=["model_name", "error_type"]
        )
        
        self.metrics_manager.create_gauge(
            name="gpu_memory_usage",
            description="GPU memory usage percentage",
            labels=["device_id"]
        )

    def get_model_config(self, model_name: str, version: str) -> Dict:
        """
        Returns comprehensive configuration for specific AI model with version management.
        
        Args:
            model_name: Name of the model to configure
            version: Model version identifier
            
        Returns:
            Dict containing complete model configuration
        """
        if model_name not in self.model_paths:
            raise ValueError(f"Invalid model name: {model_name}")
            
        model_path = self.model_paths[model_name] / version
        if not model_path.exists():
            raise ValueError(f"Model version not found: {version}")
            
        # Construct model configuration
        config = {
            'model_path': str(model_path),
            'device': self.model_device,
            'parameters': self.model_parameters,
            'batch_size': self.max_batch_size,
            'timeout': self.inference_timeout,
            'min_confidence': self.min_confidence_score
        }
        
        # Add GPU-specific configuration if available
        if self.feature_flags['enable_gpu_acceleration']:
            config.update({
                'gpu_memory_fraction': 0.8,  # Use up to 80% of GPU memory
                'cuda_visible_devices': "0",  # Use first GPU by default
                'mixed_precision': True       # Enable mixed precision training
            })
            
        return config

    def get_inference_config(self) -> Dict:
        """
        Returns inference configuration with performance optimization settings.
        
        Returns:
            Dict containing optimized inference configuration
        """
        config = {
            'device': self.model_device,
            'batch_size': self.max_batch_size,
            'timeout': self.inference_timeout,
            'max_retries': MODEL_PARAMETERS['MAX_RETRY_ATTEMPTS'],
            'retry_delay': MODEL_PARAMETERS['RETRY_DELAY'],
            'cache_ttl': MODEL_PARAMETERS['CACHE_TTL'],
            'max_concurrent_requests': MODEL_PARAMETERS['MAX_CONCURRENT_REQUESTS']
        }
        
        # Add GPU optimization settings if available
        if self.feature_flags['enable_gpu_acceleration']:
            config.update({
                'cuda_graphs': True,           # Enable CUDA graphs for optimization
                'memory_format': 'channels_last',  # Optimize memory layout
                'benchmark_mode': True,        # Enable cuDNN benchmarking
                'deterministic': False         # Disable deterministic mode for performance
            })
            
        return config