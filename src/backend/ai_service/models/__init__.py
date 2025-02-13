"""
Entry point for the AI service models package that exposes core AI model classes
for campaign generation, content generation, keyword recommendation, and performance prediction.

Version: 1.0.0
"""

from typing import List, Dict, Any, Optional, Union
import torch

# Internal imports with model classes
from ai_service.models.campaign_generator import CampaignGenerator
from ai_service.models.content_generator import ContentGenerator
from ai_service.models.keyword_recommender import KeywordRecommender
from ai_service.models.performance_predictor import PerformancePredictor

# Package metadata
__version__ = '1.0.0'
__author__ = 'Sales & Intelligence Platform Team'
__description__ = 'AI Service Models Package for Campaign Generation and Optimization'

# Export core model classes
__all__ = [
    'CampaignGenerator',
    'ContentGenerator', 
    'KeywordRecommender',
    'PerformancePredictor'
]

# Configure default device with GPU support
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

def validate_imports() -> bool:
    """
    Validates that all required model classes are properly imported and available.
    
    Returns:
        bool: True if all imports are valid, raises ImportError otherwise
    
    Raises:
        ImportError: If any required model class is missing or invalid
    """
    required_classes = {
        'CampaignGenerator': [
            'generate_campaign_structure',
            'optimize_structure'
        ],
        'ContentGenerator': [
            'generate_ad_copies',
            'validate_content'
        ],
        'KeywordRecommender': [
            'generate_keywords',
            'rank_keywords'
        ],
        'PerformancePredictor': [
            'predict_performance',
            'generate_optimization_recommendations'
        ]
    }
    
    for class_name, required_methods in required_classes.items():
        # Check class exists
        if class_name not in globals():
            raise ImportError(f"Required class not found: {class_name}")
            
        # Check required methods exist
        class_obj = globals()[class_name]
        for method in required_methods:
            if not hasattr(class_obj, method):
                raise ImportError(
                    f"Required method {method} not found in {class_name}"
                )
                
        # Verify class can be instantiated
        try:
            if class_name == 'CampaignGenerator':
                CampaignGenerator(model_path="", device=DEVICE)
            elif class_name == 'ContentGenerator':
                ContentGenerator(model_path="", device=DEVICE)
            elif class_name == 'KeywordRecommender':
                KeywordRecommender(model_path="", model_config={}, device=DEVICE)
            elif class_name == 'PerformancePredictor':
                PerformancePredictor(platform="linkedin", model_config={})
        except Exception as e:
            raise ImportError(
                f"Failed to initialize {class_name}: {str(e)}"
            )
            
    return True

def setup_monitoring() -> None:
    """
    Initializes performance monitoring for model usage.
    
    Sets up metrics collectors, performance tracking, logging and monitoring callbacks
    for all AI models.
    """
    # Import monitoring components
    from common.monitoring.metrics import MetricsManager
    from common.logging.logger import ServiceLogger
    
    # Initialize metrics manager
    metrics = MetricsManager("ai_service")
    
    # Create core metrics
    metrics.create_histogram(
        name="model_inference_time",
        description="Model inference time in seconds",
        labels=["model_name", "operation"],
        buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 30.0]
    )
    
    metrics.create_counter(
        name="model_errors",
        description="Model operation error count",
        labels=["model_name", "error_type"]
    )
    
    metrics.create_gauge(
        name="gpu_memory_usage",
        description="GPU memory usage percentage",
        labels=["device_id"]
    )
    
    # Initialize logger
    logger = ServiceLogger("ai_service")
    logger.info(
        f"AI models initialized successfully on device: {DEVICE}"
    )

# Initialize monitoring on module import
setup_monitoring()

# Validate imports on module import
validate_imports()