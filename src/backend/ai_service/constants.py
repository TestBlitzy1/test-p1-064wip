"""
Constants and configurations for the AI service module.

This module defines constant values, thresholds, and configurations used across the AI service,
including model paths, campaign types, ad formats, and various parameters for AI model operations.

Version: 1.0.0
"""

from pathlib import Path  # version 3.11

# Model file paths for different AI components
MODEL_PATHS = {
    'CAMPAIGN_GENERATOR': Path('models/campaign_generator'),
    'CONTENT_GENERATOR': Path('models/content_generator'),
    'KEYWORD_RECOMMENDER': Path('models/keyword_recommender'),
    'PERFORMANCE_PREDICTOR': Path('models/performance_predictor')
}

# Supported campaign types across advertising platforms
CAMPAIGN_TYPES = [
    'BRAND_AWARENESS',
    'LEAD_GENERATION',
    'WEBSITE_TRAFFIC',
    'ENGAGEMENT',
    'CONVERSIONS'
]

# Platform-specific ad format definitions
AD_FORMATS = {
    'LINKEDIN': [
        'SINGLE_IMAGE_AD',
        'CAROUSEL_AD',
        'VIDEO_AD',
        'TEXT_AD',
        'SPOTLIGHT_AD'
    ],
    'GOOGLE': [
        'RESPONSIVE_SEARCH_AD',
        'RESPONSIVE_DISPLAY_AD',
        'DISCOVERY_AD',
        'APP_CAMPAIGN_AD'
    ]
}

# AI model configuration parameters
MODEL_PARAMETERS = {
    # Sequence and batch processing
    'MAX_SEQUENCE_LENGTH': 512,
    'BATCH_SIZE': 32,
    
    # Generation parameters
    'NUM_BEAMS': 5,
    'TEMPERATURE': 0.7,
    'TOP_K': 50,
    'TOP_P': 0.95,
    
    # Ad copy generation limits
    'MAX_AD_COPIES': 10,
    'MIN_AD_COPIES': 3,
    
    # Performance and timeout settings
    'PROCESSING_TIMEOUT': 30,  # 30-second processing requirement
    'MAX_RETRY_ATTEMPTS': 3,
    'RETRY_DELAY': 1.0,
    
    # Caching and concurrency
    'CACHE_TTL': 3600,  # 1 hour
    'MAX_CONCURRENT_REQUESTS': 100
}

# Platform-specific limitations and constraints
PLATFORM_LIMITS = {
    'LINKEDIN': {
        'MAX_TITLE_LENGTH': 200,
        'MAX_DESCRIPTION_LENGTH': 600,
        'MAX_AD_COPIES': 50,
        'MAX_DAILY_BUDGET': 100000,  # $100,000
        'MAX_CAMPAIGNS_PER_ACCOUNT': 1000,
        'MAX_ADS_PER_CAMPAIGN': 100,
        'API_RATE_LIMIT': 100,  # requests
        'API_RATE_WINDOW': 60   # seconds
    },
    'GOOGLE': {
        'MAX_HEADLINE_LENGTH': 30,
        'MAX_DESCRIPTION_LENGTH': 90,
        'MAX_AD_COPIES': 100,
        'MAX_DAILY_BUDGET': 1000000,  # $1,000,000
        'MAX_CAMPAIGNS_PER_ACCOUNT': 10000,
        'MAX_ADS_PER_CAMPAIGN': 150,
        'API_RATE_LIMIT': 150,  # requests
        'API_RATE_WINDOW': 60   # seconds
    }
}

# Performance metric thresholds for optimization
PERFORMANCE_THRESHOLDS = {
    'MIN_CTR': 0.01,              # 1% minimum click-through rate
    'MIN_CONVERSION_RATE': 0.02,   # 2% minimum conversion rate
    'MIN_ROAS': 2.0,              # 2x minimum return on ad spend
    'MAX_CPC': 100.0,             # Maximum cost per click
    'MAX_PROCESSING_TIME': 30.0,   # 30-second processing requirement
    'MIN_API_SUCCESS_RATE': 0.99,  # 99% minimum API success rate
    'MAX_ERROR_RATE': 0.01,        # 1% maximum error rate
    'MIN_MODEL_CONFIDENCE': 0.8    # 80% minimum model confidence
}

# Standardized error messages for AI service
ERROR_MESSAGES = {
    'MODEL_LOAD_ERROR': 'Failed to load AI model: {model_name}',
    'INVALID_CAMPAIGN_TYPE': 'Invalid campaign type. Must be one of: {valid_types}',
    'INVALID_AD_FORMAT': 'Invalid ad format for platform {platform}',
    'GENERATION_TIMEOUT': 'Campaign generation timed out after {timeout} seconds',
    'VALIDATION_ERROR': 'Campaign structure validation failed: {reason}',
    'RATE_LIMIT_EXCEEDED': 'Platform rate limit exceeded for {platform}',
    'PROCESSING_ERROR': 'Error processing campaign: {error_details}',
    'PERFORMANCE_THRESHOLD_BREACH': 'Performance threshold breached: {metric}'
}