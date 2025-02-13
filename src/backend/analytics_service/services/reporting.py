"""
Core reporting service module providing comprehensive analytics and reporting capabilities
for campaign performance across advertising platforms with enhanced caching and horizontal scaling.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID

import numpy as np  # numpy ^1.24.0
import pandas as pd  # pandas ^2.0.0
from cachetools import TTLCache, cached  # cachetools ^5.3.0

from analytics_service.models.campaign_metrics import CampaignMetrics
from analytics_service.models.performance_data import PerformanceData

# Report types and cache TTL configuration
REPORT_TYPES = ['daily', 'weekly', 'monthly', 'custom', 'real_time']
CACHE_TTL = {
    'daily': 3600,  # 1 hour
    'weekly': 86400,  # 24 hours
    'monthly': 604800,  # 1 week
    'custom': 1800,  # 30 minutes
    'real_time': 60  # 1 minute
}

# Metrics configuration for statistical analysis
METRICS_MANAGER = {
    'service_name': 'analytics_reporting',
    'enable_tracing': True
}

class ReportGenerator:
    """
    Enhanced report generator with caching, concurrent processing, and horizontal scaling support.
    """

    def __init__(self, db_session, cache_manager, config: Dict[str, Any]) -> None:
        """
        Initialize report generator with enhanced configuration.

        Args:
            db_session: Database session with connection pooling
            cache_manager: Cache manager with TTL configuration
            config: Configuration dictionary
        """
        self.db_session = db_session
        self.cache_manager = cache_manager
        self.config = config
        self.performance_data = {}
        self.report_templates = {}
        
        # Initialize cache with TTL configuration
        self.report_cache = TTLCache(
            maxsize=1000,
            ttl=CACHE_TTL['daily']
        )

    async def create_report(self, campaign_id: UUID, report_config: Dict[str, Any], 
                          force_refresh: bool = False) -> Dict[str, Any]:
        """
        Creates a new performance report with caching and validation.

        Args:
            campaign_id: Campaign identifier
            report_config: Report configuration parameters
            force_refresh: Force cache refresh flag

        Returns:
            Dict[str, Any]: Generated report data with caching metadata

        Raises:
            ValueError: If validation fails
        """
        cache_key = f"{campaign_id}:{report_config['type']}"
        
        # Check cache unless force refresh
        if not force_refresh and cache_key in self.report_cache:
            return self.report_cache[cache_key]

        # Initialize performance data if not exists
        if campaign_id not in self.performance_data:
            self.performance_data[campaign_id] = PerformanceData(
                campaign_id=campaign_id,
                platform=report_config['platform'],
                initial_metrics={}
            )

        # Fetch metrics concurrently
        metrics_tasks = [
            self._fetch_campaign_metrics(campaign_id, report_config['start_date'], report_config['end_date']),
            self._fetch_performance_trends(campaign_id, report_config.get('metrics', ['ctr', 'conversion_rate', 'roas']))
        ]
        metrics_results = await asyncio.gather(*metrics_tasks)
        
        # Generate report content
        report = {
            'campaign_id': str(campaign_id),
            'report_type': report_config['type'],
            'generated_at': datetime.utcnow().isoformat(),
            'date_range': {
                'start': report_config['start_date'].isoformat(),
                'end': report_config['end_date'].isoformat()
            },
            'metrics': metrics_results[0],
            'trends': metrics_results[1],
            'statistical_significance': self._calculate_statistical_significance(metrics_results[0]),
            'metadata': {
                'cache_ttl': CACHE_TTL[report_config['type']],
                'data_freshness': self.performance_data[campaign_id].last_updated.isoformat()
            }
        }

        # Cache report
        self.report_cache[cache_key] = report
        return report

    async def _fetch_campaign_metrics(self, campaign_id: UUID, 
                                    start_date: datetime, 
                                    end_date: datetime) -> Dict[str, Any]:
        """
        Fetch campaign metrics with concurrent processing.

        Args:
            campaign_id: Campaign identifier
            start_date: Start date for metrics
            end_date: End date for metrics

        Returns:
            Dict[str, Any]: Aggregated campaign metrics
        """
        perf_data = self.performance_data[campaign_id]
        
        # Calculate date range metrics
        metrics = {
            'summary': await self._calculate_summary_metrics(perf_data, start_date, end_date),
            'daily_breakdown': perf_data.daily_metrics,
            'weekly_aggregates': perf_data.weekly_metrics,
            'benchmarks': await self._fetch_industry_benchmarks(perf_data.platform)
        }
        
        return metrics

    async def _fetch_performance_trends(self, campaign_id: UUID, 
                                      metrics: List[str]) -> Dict[str, Any]:
        """
        Fetch performance trends with forecasting.

        Args:
            campaign_id: Campaign identifier
            metrics: List of metrics to analyze

        Returns:
            Dict[str, Any]: Performance trends with forecasting
        """
        perf_data = self.performance_data[campaign_id]
        trends = {}
        
        for metric in metrics:
            trends[metric] = perf_data.get_performance_trends(
                metric_name=metric,
                time_period='30d',
                include_forecasting=True
            )
            
        return trends

    def _calculate_statistical_significance(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate statistical significance of metrics.

        Args:
            metrics: Campaign metrics data

        Returns:
            Dict[str, Any]: Statistical significance analysis
        """
        significance = {}
        
        for metric, data in metrics['summary'].items():
            if isinstance(data, (int, float)):
                # Calculate confidence intervals
                std_dev = metrics.get('std_dev', {}).get(metric, 0)
                sample_size = len(metrics.get('daily_breakdown', []))
                
                if sample_size > 0:
                    confidence_interval = np.sqrt(std_dev / sample_size) * 1.96
                    significance[metric] = {
                        'value': data,
                        'confidence_interval': float(confidence_interval),
                        'sample_size': sample_size,
                        'is_significant': confidence_interval < (data * 0.1)  # 10% threshold
                    }
                    
        return significance

@cached(cache=TTLCache(maxsize=100, ttl=CACHE_TTL['real_time']))
async def generate_campaign_report(campaign_id: UUID, report_type: str,
                                 start_date: datetime, end_date: datetime,
                                 metrics_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generates a comprehensive campaign performance report with enhanced caching.

    Args:
        campaign_id: Campaign identifier
        report_type: Type of report to generate
        start_date: Report start date
        end_date: Report end date
        metrics_config: Metrics configuration

    Returns:
        Dict[str, Any]: Comprehensive performance report

    Raises:
        ValueError: If validation fails
    """
    if report_type not in REPORT_TYPES:
        raise ValueError(f"Invalid report type: {report_type}")

    # Initialize report generator
    generator = ReportGenerator(
        db_session=None,  # Inject actual session
        cache_manager=None,  # Inject actual cache manager
        config=metrics_config
    )
    
    # Generate report
    report = await generator.create_report(
        campaign_id=campaign_id,
        report_config={
            'type': report_type,
            'start_date': start_date,
            'end_date': end_date,
            'platform': metrics_config.get('platform', 'ALL'),
            'metrics': metrics_config.get('metrics', ['ctr', 'conversion_rate', 'roas'])
        }
    )
    
    return report