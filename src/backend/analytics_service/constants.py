"""
Analytics Service Constants Module

Defines comprehensive constants for metrics calculation, reporting, and data validation
used throughout the analytics service. Includes platform identifiers, metric names,
time periods, report formats, and threshold values.

Version: 1.0.0
"""

from datetime import timedelta  # built-in
from ...common.config.settings import ENV  # v1.0.0

# Service identifier
SERVICE_NAME = 'analytics_service'

# Supported advertising platforms
SUPPORTED_PLATFORMS = [
    'LINKEDIN',
    'GOOGLE_ADS'
]

# Standard metric names for performance tracking
METRIC_NAMES = [
    'impressions',
    'clicks',
    'conversions',
    'spend',
    'revenue',
    'ctr',  # Click-through rate
    'cpc',  # Cost per click
    'conversion_rate',
    'roas'  # Return on ad spend
]

# Standard time periods for analytics calculations
TIME_PERIODS = {
    'LAST_24H': timedelta(hours=24),
    'LAST_7D': timedelta(days=7),
    'LAST_30D': timedelta(days=30),
    'LAST_90D': timedelta(days=90)
}

# Supported report export formats
REPORT_FORMATS = [
    'JSON',
    'CSV',
    'PDF',
    'EXCEL'
]

# Cache time-to-live settings (in seconds)
CACHE_TTL = {
    'DASHBOARD': 300,  # 5 minutes for real-time dashboard data
    'REPORTS': 3600    # 1 hour for generated reports
}

# Performance metric thresholds for alerts and optimization
METRIC_THRESHOLDS = {
    'MIN_CTR': 0.5,            # Minimum click-through rate percentage
    'MIN_CONVERSION_RATE': 1.0, # Minimum conversion rate percentage
    'TARGET_ROAS': 3.0,        # Target return on ad spend ratio
    'MAX_CPC': 50.0            # Maximum cost per click in currency units
}

# Time periods for metric aggregation
AGGREGATION_PERIODS = [
    'HOURLY',
    'DAILY',
    'WEEKLY',
    'MONTHLY'
]

# Export and processing limits
EXPORT_CHUNK_SIZE = 1000      # Number of rows per processing chunk
MAX_REPORT_ROWS = 100000      # Maximum rows in a single report

# Environment-specific metric calculation adjustments
if ENV == 'development':
    METRIC_THRESHOLDS['MIN_CTR'] = 0.1  # Relaxed thresholds for development
    CACHE_TTL['DASHBOARD'] = 60         # Shorter cache for development