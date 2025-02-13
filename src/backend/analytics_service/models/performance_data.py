"""
Performance data model providing comprehensive analytics capabilities for campaign performance tracking
with support for real-time analytics, efficient time-series data handling, and statistical aggregations.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, Any, Optional, List
from uuid import UUID

import pandas as pd  # pandas ^2.0.0
from pydantic import Field

from common.schemas.base import BaseSchema
from analytics_service.models.campaign_metrics import CampaignMetrics

# Cache configuration
METRICS_CACHE_TTL = 3600  # 1 hour in seconds
AGGREGATION_WINDOW = 7  # days for rolling calculations

# Statistical confidence levels
CONFIDENCE_LEVEL = 0.95

@dataclass
class PerformanceData:
    """
    Core class for managing and aggregating campaign performance data with support 
    for real-time analytics and horizontal scaling.
    """

    def __init__(self, campaign_id: UUID, platform: str, initial_metrics: Dict[str, Any]) -> None:
        """
        Initialize performance data tracking with enhanced caching and time series support.

        Args:
            campaign_id: Unique campaign identifier
            platform: Advertising platform (LINKEDIN/GOOGLE)
            initial_metrics: Initial performance metrics

        Raises:
            ValueError: If validation fails
        """
        self.campaign_id = campaign_id
        self.platform = platform.upper()
        self.last_updated = datetime.utcnow()

        # Initialize metrics storage with TTL-based caching
        self.daily_metrics: Dict[str, Dict[str, Any]] = {}
        self.weekly_metrics: Dict[str, Dict[str, Any]] = {}
        self.monthly_metrics: Dict[str, Dict[str, Any]] = {}
        self.metrics_cache: Dict[str, Dict[str, Any]] = {
            'ttl': self.last_updated + timedelta(seconds=METRICS_CACHE_TTL),
            'data': {}
        }

        # Initialize time series data structure
        self.time_series_data = pd.DataFrame(columns=[
            'date', 'impressions', 'clicks', 'conversions', 
            'spend', 'revenue', 'ctr', 'conversion_rate', 
            'cpc', 'roas'
        ])
        
        # Set up initial metrics
        if initial_metrics:
            self.update_daily_metrics(
                date=self.last_updated.date(),
                metrics=initial_metrics,
                force_update=True
            )

    def update_daily_metrics(self, date: datetime, metrics: Dict[str, Any], 
                           force_update: bool = False) -> bool:
        """
        Update daily performance metrics with optimized storage and caching.

        Args:
            date: Date for metrics update
            metrics: New metrics data
            force_update: Force update regardless of cache

        Returns:
            bool: Success status of update operation

        Raises:
            ValueError: If validation fails
        """
        date_key = date.strftime('%Y-%m-%d')

        # Validate metrics using CampaignMetrics
        campaign_metrics = CampaignMetrics(
            campaign_id=self.campaign_id,
            platform=self.platform,
            metrics_data=metrics
        )

        # Check cache unless force update
        if not force_update and date_key in self.metrics_cache['data']:
            if datetime.utcnow() < self.metrics_cache['ttl']:
                return True

        # Update daily metrics with calculated values
        self.daily_metrics[date_key] = {
            'impressions': campaign_metrics.impressions,
            'clicks': campaign_metrics.clicks,
            'conversions': campaign_metrics.conversions,
            'spend': float(campaign_metrics.spend),
            'revenue': float(campaign_metrics.revenue),
            'ctr': float(campaign_metrics.ctr),
            'conversion_rate': float(campaign_metrics.conversion_rate),
            'cpc': float(campaign_metrics.cpc),
            'roas': float(campaign_metrics.roas),
            'timestamp': datetime.utcnow().isoformat()
        }

        # Update time series data
        new_row = pd.DataFrame([{
            'date': date,
            **self.daily_metrics[date_key]
        }])
        self.time_series_data = pd.concat([self.time_series_data, new_row], ignore_index=True)

        # Trigger aggregation for completed weeks/months
        if self._should_aggregate_weekly(date):
            week_start = date - timedelta(days=date.weekday())
            self.aggregate_weekly_metrics(week_start, force_update=True)

        # Update cache
        self.metrics_cache['data'][date_key] = self.daily_metrics[date_key]
        self.metrics_cache['ttl'] = datetime.utcnow() + timedelta(seconds=METRICS_CACHE_TTL)
        
        self.last_updated = datetime.utcnow()
        return True

    def aggregate_weekly_metrics(self, week_start: datetime, 
                               force_recalculation: bool = False) -> Dict[str, Any]:
        """
        Aggregate daily metrics into weekly statistics using pandas operations.

        Args:
            week_start: Start date of the week
            force_recalculation: Force recalculation of aggregates

        Returns:
            Dict[str, Any]: Aggregated weekly metrics with statistical analysis
        """
        week_key = week_start.strftime('%Y-W%W')
        
        if not force_recalculation and week_key in self.weekly_metrics:
            return self.weekly_metrics[week_key]

        # Get date range for the week
        week_end = week_start + timedelta(days=6)
        
        # Filter time series data for the week
        week_data = self.time_series_data[
            (self.time_series_data['date'] >= week_start) & 
            (self.time_series_data['date'] <= week_end)
        ]

        if len(week_data) == 0:
            return {}

        # Calculate aggregated metrics
        aggregated = {
            'impressions': int(week_data['impressions'].sum()),
            'clicks': int(week_data['clicks'].sum()),
            'conversions': int(week_data['conversions'].sum()),
            'spend': float(week_data['spend'].sum()),
            'revenue': float(week_data['revenue'].sum()),
            'ctr': float(week_data['ctr'].mean()),
            'conversion_rate': float(week_data['conversion_rate'].mean()),
            'cpc': float(week_data['cpc'].mean()),
            'roas': float(week_data['roas'].mean()),
            'statistics': {
                'ctr_std': float(week_data['ctr'].std()),
                'conversion_rate_std': float(week_data['conversion_rate'].std()),
                'cpc_std': float(week_data['cpc'].std()),
                'roas_std': float(week_data['roas'].std()),
                'confidence_level': CONFIDENCE_LEVEL
            }
        }

        self.weekly_metrics[week_key] = aggregated
        return aggregated

    def get_performance_trends(self, metric_name: str, time_period: str = '30d',
                             include_forecasting: bool = False) -> Dict[str, Any]:
        """
        Calculate detailed performance trends with statistical analysis.

        Args:
            metric_name: Name of the metric to analyze
            time_period: Time period for analysis (7d, 30d, 90d)
            include_forecasting: Whether to include trend forecasting

        Returns:
            Dict[str, Any]: Comprehensive trend analysis results

        Raises:
            ValueError: If invalid metric or time period
        """
        valid_metrics = {'ctr', 'conversion_rate', 'cpc', 'roas'}
        if metric_name not in valid_metrics:
            raise ValueError(f"Invalid metric: {metric_name}")

        # Calculate date range
        days = int(time_period.replace('d', ''))
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days)

        # Filter time series data
        period_data = self.time_series_data[
            (self.time_series_data['date'] >= start_date) & 
            (self.time_series_data['date'] <= end_date)
        ]

        if len(period_data) == 0:
            return {}

        # Calculate trend statistics
        trend_data = {
            'metric': metric_name,
            'period': time_period,
            'current_value': float(period_data[metric_name].iloc[-1]),
            'mean': float(period_data[metric_name].mean()),
            'median': float(period_data[metric_name].median()),
            'std_dev': float(period_data[metric_name].std()),
            'min': float(period_data[metric_name].min()),
            'max': float(period_data[metric_name].max()),
            'trend_direction': 'up' if period_data[metric_name].iloc[-1] > 
                              period_data[metric_name].iloc[0] else 'down',
            'rolling_average': period_data[metric_name]
                .rolling(window=AGGREGATION_WINDOW)
                .mean()
                .fillna(method='bfill')
                .tolist()
        }

        if include_forecasting:
            # Calculate simple moving average forecast
            forecast_window = min(AGGREGATION_WINDOW, len(period_data))
            last_values = period_data[metric_name].tail(forecast_window)
            trend_data['forecast_next_value'] = float(last_values.mean())
            trend_data['forecast_confidence'] = 1.0 - float(last_values.std() / last_values.mean())

        return trend_data

    def _should_aggregate_weekly(self, date: datetime) -> bool:
        """
        Determine if weekly aggregation should be triggered.

        Args:
            date: Date to check

        Returns:
            bool: True if weekly aggregation should be performed
        """
        return date.weekday() == 6  # Sunday