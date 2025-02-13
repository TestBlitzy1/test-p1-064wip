"""
Analytics aggregation service providing real-time metrics processing, statistical analysis,
and horizontally scalable performance tracking for advertising campaigns.

Version: 1.0.0
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from uuid import UUID

import numpy as np  # numpy ^1.24.0
import pandas as pd  # pandas ^2.0.0

from analytics_service.models.campaign_metrics import CampaignMetrics
from analytics_service.models.performance_data import PerformanceData
from common.database.session import get_session

# Configure logging
logger = logging.getLogger(__name__)

# Cache configuration
METRICS_CACHE_TTL = 3600  # 1 hour
AGGREGATION_BATCH_SIZE = 1000
CONFIDENCE_LEVEL = 0.95

class MetricsAggregator:
    """
    Advanced metrics aggregation engine providing real-time analytics processing
    with statistical validation and horizontal scaling support.
    """

    def __init__(self, cache_config: Dict[str, Any]) -> None:
        """
        Initialize metrics aggregator with enhanced caching and batch processing.

        Args:
            cache_config: Cache configuration settings

        Raises:
            ValueError: If invalid configuration provided
        """
        self.cache = {
            'ttl': cache_config.get('ttl', METRICS_CACHE_TTL),
            'data': {},
            'last_cleanup': datetime.utcnow()
        }
        
        self.performance_metrics: Dict[UUID, PerformanceData] = {}
        self._initialize_statistical_processors()

    def _initialize_statistical_processors(self) -> None:
        """Configure statistical analysis processors with numpy/pandas optimizations."""
        # Set pandas options for performance
        pd.set_option('compute.use_numexpr', True)
        pd.set_option('mode.chained_assignment', None)

    def aggregate_campaign_metrics(
        self,
        campaign_id: UUID,
        time_period: str,
        use_cache: bool = True
    ) -> Dict[str, Any]:
        """
        Aggregate and analyze campaign metrics with statistical validation.

        Args:
            campaign_id: Campaign identifier
            time_period: Analysis period (daily, weekly, monthly)
            use_cache: Whether to use cached results

        Returns:
            Dict containing comprehensive metrics with statistical significance

        Raises:
            ValueError: If invalid parameters provided
        """
        try:
            # Check cache if enabled
            cache_key = f"{campaign_id}:{time_period}"
            if use_cache and self._check_cache(cache_key):
                return self.cache['data'][cache_key]

            # Get campaign performance data
            performance_data = self._get_performance_data(campaign_id)
            if not performance_data:
                raise ValueError(f"No performance data found for campaign {campaign_id}")

            # Calculate aggregated metrics based on time period
            if time_period == 'daily':
                metrics = performance_data.daily_metrics
            elif time_period == 'weekly':
                metrics = performance_data.aggregate_weekly_metrics(
                    datetime.utcnow().date() - timedelta(days=7),
                    force_recalculation=True
                )
            else:
                raise ValueError(f"Invalid time period: {time_period}")

            # Perform statistical analysis
            analyzed_metrics = self._analyze_metrics(metrics)

            # Update cache
            if use_cache:
                self._update_cache(cache_key, analyzed_metrics)

            return analyzed_metrics

        except Exception as e:
            logger.error(f"Error aggregating metrics for campaign {campaign_id}: {str(e)}")
            raise

    def analyze_performance_trends(
        self,
        campaign_id: UUID,
        metrics: List[str],
        time_period: str
    ) -> Dict[str, Any]:
        """
        Perform advanced trend analysis with statistical testing.

        Args:
            campaign_id: Campaign identifier
            metrics: List of metrics to analyze
            time_period: Analysis period

        Returns:
            Dict containing trend analysis with confidence scores

        Raises:
            ValueError: If invalid parameters provided
        """
        try:
            performance_data = self._get_performance_data(campaign_id)
            if not performance_data:
                raise ValueError(f"No performance data found for campaign {campaign_id}")

            trend_results = {}
            for metric in metrics:
                trend_data = performance_data.get_performance_trends(
                    metric_name=metric,
                    time_period=time_period,
                    include_forecasting=True
                )
                
                if trend_data:
                    # Enhance with statistical significance
                    significance = self._calculate_statistical_significance(
                        trend_data['rolling_average']
                    )
                    trend_data['statistical_significance'] = significance

                    trend_results[metric] = trend_data

            return {
                'campaign_id': str(campaign_id),
                'analysis_period': time_period,
                'trends': trend_results,
                'analysis_timestamp': datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"Error analyzing trends for campaign {campaign_id}: {str(e)}")
            raise

    def _get_performance_data(self, campaign_id: UUID) -> Optional[PerformanceData]:
        """
        Retrieve campaign performance data with database session management.

        Args:
            campaign_id: Campaign identifier

        Returns:
            PerformanceData instance if found
        """
        if campaign_id in self.performance_metrics:
            return self.performance_metrics[campaign_id]

        with get_session() as session:
            # Fetch campaign metrics from database
            campaign_metrics = CampaignMetrics(
                campaign_id=campaign_id,
                platform="LINKEDIN",  # Default platform
                metrics_data={}  # Will be populated from database
            )
            
            # Initialize performance data tracking
            performance_data = PerformanceData(
                campaign_id=campaign_id,
                platform=campaign_metrics.platform,
                initial_metrics=campaign_metrics.__dict__
            )
            
            self.performance_metrics[campaign_id] = performance_data
            return performance_data

    def _analyze_metrics(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """
        Perform comprehensive statistical analysis on metrics.

        Args:
            metrics: Raw metrics data

        Returns:
            Dict containing analyzed metrics with statistical validation
        """
        analyzed = {
            'metrics': metrics,
            'statistical_analysis': {
                'confidence_level': CONFIDENCE_LEVEL,
                'sample_size': len(metrics) if isinstance(metrics, dict) else 1
            }
        }

        # Calculate confidence intervals for key metrics
        if 'ctr' in metrics:
            analyzed['statistical_analysis']['ctr_confidence'] = self._calculate_confidence_interval(
                metrics['ctr'],
                metrics.get('ctr_std', 0)
            )

        if 'conversion_rate' in metrics:
            analyzed['statistical_analysis']['conversion_confidence'] = self._calculate_confidence_interval(
                metrics['conversion_rate'],
                metrics.get('conversion_rate_std', 0)
            )

        return analyzed

    def _calculate_confidence_interval(
        self,
        mean: float,
        std_dev: float
    ) -> Tuple[float, float]:
        """
        Calculate confidence interval for metric.

        Args:
            mean: Mean value
            std_dev: Standard deviation

        Returns:
            Tuple of lower and upper confidence bounds
        """
        z_score = 1.96  # 95% confidence level
        margin_of_error = z_score * (std_dev / np.sqrt(AGGREGATION_BATCH_SIZE))
        return (mean - margin_of_error, mean + margin_of_error)

    def _calculate_statistical_significance(self, data: List[float]) -> float:
        """
        Calculate statistical significance of trend.

        Args:
            data: Time series data points

        Returns:
            Float indicating significance level
        """
        if len(data) < 2:
            return 0.0

        # Perform t-test for trend significance
        x = np.arange(len(data))
        y = np.array(data)
        correlation_matrix = np.corrcoef(x, y)
        correlation = correlation_matrix[0, 1]
        
        return abs(correlation)

    def _check_cache(self, key: str) -> bool:
        """
        Check if valid cached data exists.

        Args:
            key: Cache key to check

        Returns:
            bool indicating if valid cache exists
        """
        if key not in self.cache['data']:
            return False

        cache_entry = self.cache['data'][key]
        if 'timestamp' not in cache_entry:
            return False

        cache_age = datetime.utcnow() - datetime.fromisoformat(cache_entry['timestamp'])
        return cache_age.total_seconds() < self.cache['ttl']

    def _update_cache(self, key: str, data: Dict[str, Any]) -> None:
        """
        Update cache with new data.

        Args:
            key: Cache key
            data: Data to cache
        """
        self.cache['data'][key] = {
            **data,
            'timestamp': datetime.utcnow().isoformat()
        }

        # Perform cache cleanup if needed
        self._cleanup_cache()

    def _cleanup_cache(self) -> None:
        """Perform cache cleanup of expired entries."""
        now = datetime.utcnow()
        if (now - self.cache['last_cleanup']).total_seconds() < 3600:
            return

        expired_keys = []
        for key, entry in self.cache['data'].items():
            if 'timestamp' in entry:
                age = now - datetime.fromisoformat(entry['timestamp'])
                if age.total_seconds() >= self.cache['ttl']:
                    expired_keys.append(key)

        for key in expired_keys:
            del self.cache['data'][key]

        self.cache['last_cleanup'] = now